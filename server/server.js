import express from 'express';
import multer from 'multer';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { getRenderer } from './rlottie-renderer.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize renderer
const renderer = getRenderer();

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10000'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' }
});

app.use(limiter);

// Multer configuration
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { 
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'),
    files: 100
  },
  fileFilter: (req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith('.tgs')) {
      return cb(new Error('Only .tgs files are allowed'));
    }
    cb(null, true);
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    pid: process.pid,
    timestamp: new Date().toISOString()
  });
});

// Single file conversion
app.post('/convert', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const options = {
      frame: parseInt(req.query.frame || '0'),
      width: parseInt(req.query.width || '0') || undefined,
      height: parseInt(req.query.height || '0') || undefined,
      format: req.query.format || 'png',
      quality: parseInt(req.query.quality || '90')
    };

    const result = await renderer.render(req.file.buffer, options);
    
    res.set({
      'Content-Type': `image/${result.format}`,
      'Content-Length': result.buffer.length,
      'X-Total-Frames': result.totalFrames,
      'X-Width': result.width,
      'X-Height': result.height,
      'X-Processing-Time': `${Date.now() - startTime}ms`,
      'X-Format': result.format
    });
    
    res.send(result.buffer);
  } catch (error) {
    console.error('Conversion error:', error);
    res.status(500).json({ 
      error: 'Conversion failed',
      message: error.message,
      processingTime: `${Date.now() - startTime}ms`
    });
  }
});

// Batch conversion
app.post('/convert/batch', upload.array('files', 100), async (req, res) => {
  const startTime = Date.now();
  
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    const options = {
      frame: parseInt(req.query.frame || '0'),
      width: parseInt(req.query.width || '0') || undefined,
      height: parseInt(req.query.height || '0') || undefined,
      format: req.query.format || 'png',
      quality: parseInt(req.query.quality || '90')
    };

    // Process files in parallel with concurrency limit
    const CONCURRENCY = parseInt(process.env.BATCH_CONCURRENCY || '10');
    const results = [];
    
    for (let i = 0; i < req.files.length; i += CONCURRENCY) {
      const batch = req.files.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.allSettled(
        batch.map(file => renderer.render(file.buffer, options))
      );
      results.push(...batchResults);
    }
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.length - successful;
    
    const response = {
      total: req.files.length,
      successful,
      failed,
      processingTime: `${Date.now() - startTime}ms`,
      avgTimePerFile: `${((Date.now() - startTime) / req.files.length).toFixed(2)}ms`,
      images: results.map((result, index) => ({
        filename: req.files[index].originalname,
        status: result.status,
        data: result.status === 'fulfilled' 
          ? result.value.buffer.toString('base64')
          : null,
        error: result.status === 'rejected' 
          ? result.reason.message 
          : null,
        width: result.status === 'fulfilled' ? result.value.width : null,
        height: result.status === 'fulfilled' ? result.value.height : null,
        totalFrames: result.status === 'fulfilled' ? result.value.totalFrames : null,
        format: result.status === 'fulfilled' ? result.value.format : null,
        size: result.status === 'fulfilled' ? result.value.buffer.length : null
      }))
    };
    
    res.json(response);
  } catch (error) {
    console.error('Batch conversion error:', error);
    res.status(500).json({ 
      error: 'Batch conversion failed',
      message: error.message,
      processingTime: `${Date.now() - startTime}ms`
    });
  }
});

// Get animation info
app.post('/info', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const animationData = await renderer.parseTgs(req.file.buffer);
    
    res.json({
      width: animationData.w || 512,
      height: animationData.h || 512,
      totalFrames: (animationData.op || 60) - (animationData.ip || 0),
      inPoint: animationData.ip || 0,
      outPoint: animationData.op || 60,
      frameRate: animationData.fr || 30,
      duration: ((animationData.op || 60) - (animationData.ip || 0)) / (animationData.fr || 30),
      layers: animationData.layers?.length || 0,
      assets: animationData.assets?.length || 0,
      version: animationData.v,
      name: animationData.nm || 'untitled'
    });
  } catch (error) {
    console.error('Info extraction error:', error);
    res.status(500).json({ 
      error: 'Failed to extract info',
      message: error.message 
    });
  }
});

// Base64 conversion
app.post('/convert/base64', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { data, frame = 0, width, height, format = 'png', quality = 90 } = req.body;
    
    if (!data) {
      return res.status(400).json({ error: 'No data provided' });
    }
    
    const buffer = Buffer.from(data, 'base64');
    
    const options = {
      frame: parseInt(frame),
      width: width ? parseInt(width) : undefined,
      height: height ? parseInt(height) : undefined,
      format,
      quality: parseInt(quality)
    };

    const result = await renderer.render(buffer, options);
    
    res.json({
      image: result.buffer.toString('base64'),
      width: result.width,
      height: result.height,
      totalFrames: result.totalFrames,
      format: result.format,
      size: result.buffer.length,
      processingTime: `${Date.now() - startTime}ms`
    });
  } catch (error) {
    console.error('Base64 conversion error:', error);
    res.status(500).json({ 
      error: 'Conversion failed',
      message: error.message,
      processingTime: `${Date.now() - startTime}ms`
    });
  }
});

// Bulk info extraction
app.post('/info/batch', upload.array('files', 100), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = await Promise.allSettled(
      req.files.map(async file => {
        const animationData = await renderer.parseTgs(file.buffer);
        return {
          filename: file.originalname,
          width: animationData.w || 512,
          height: animationData.h || 512,
          totalFrames: (animationData.op || 60) - (animationData.ip || 0),
          frameRate: animationData.fr || 30,
          duration: ((animationData.op || 60) - (animationData.ip || 0)) / (animationData.fr || 30)
        };
      })
    );

    res.json({
      total: req.files.length,
      successful: results.filter(r => r.status === 'fulfilled').length,
      files: results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason.message })
    });
  } catch (error) {
    console.error('Bulk info error:', error);
    res.status(500).json({ 
      error: 'Failed to extract info',
      message: error.message 
    });
  }
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Global error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ 
        error: 'File too large',
        message: `Maximum file size is ${process.env.MAX_FILE_SIZE || '10MB'}`
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ 
        error: 'Too many files',
        message: 'Maximum 100 files per batch'
      });
    }
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: error.message 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    message: `Endpoint ${req.method} ${req.path} does not exist`
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`\n🚀 TGS Converter API v2.0`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`💻 Process ID: ${process.pid}`);
  console.log(`🔥 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`\n📋 Available endpoints:`);
  console.log(`  GET  /health              - Health check`);
  console.log(`  POST /convert             - Single file conversion`);
  console.log(`  POST /convert/batch       - Batch conversion`);
  console.log(`  POST /convert/base64      - Base64 conversion`);
  console.log(`  POST /info                - File information`);
  console.log(`  POST /info/batch          - Batch info extraction`);
  console.log(`\n⚙️  Query parameters:`);
  console.log(`  ?frame=N        - Frame number (default: 0)`);
  console.log(`  ?width=N        - Output width (default: original)`);
  console.log(`  ?height=N       - Output height (default: original)`);
  console.log(`  ?format=png|webp - Output format (default: png)`);
  console.log(`  ?quality=1-100  - Quality for WebP (default: 90)`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
});

// Graceful shutdown
const shutdown = () => {
  console.log('\n🛑 Received shutdown signal, closing server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
  
  setTimeout(() => {
    console.error('⚠️  Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;
