import express from 'express';
import multer from 'multer';
import pako from 'pako';
import { createCanvas, loadImage } from 'canvas';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '50mb' }));

// Rate limiting - adjust based on your needs
const limiter = rateLimit({
  windowMs: 1000, // 1 second
  max: 10000, // 10000 requests per second per IP
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (!file.originalname.endsWith('.tgs')) {
      return cb(new Error('Only .tgs files are allowed'));
    }
    cb(null, true);
  }
});

// Lottie renderer using canvas
class LottieRenderer {
  static async renderFrame(animationData, frameNumber = 0, width = 512, height = 512) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Simple Lottie rendering - this is a simplified version
    // For production, you'd want a full Lottie renderer
    try {
      // Set background if specified
      if (animationData.bg) {
        ctx.fillStyle = animationData.bg;
        ctx.fillRect(0, 0, width, height);
      }
      
      // This is a simplified renderer - in production you'd need
      // a full Lottie implementation or use rlottie bindings
      // For now, we'll return a canvas with basic rendering
      
      return canvas;
    } catch (error) {
      throw new Error(`Rendering failed: ${error.message}`);
    }
  }
}

// Convert TGS to PNG
async function convertTgsToPng(buffer, frameNumber = 0) {
  try {
    // Decompress gzip
    const decompressed = pako.ungzip(buffer, { to: 'string' });
    
    // Parse JSON
    const animationData = JSON.parse(decompressed);
    
    // Get dimensions
    const width = animationData.w || 512;
    const height = animationData.h || 512;
    const totalFrames = animationData.op || 60; // op = out point (last frame)
    
    // Validate frame number
    if (frameNumber >= totalFrames) {
      frameNumber = 0;
    }
    
    // Render frame
    const canvas = await LottieRenderer.renderFrame(animationData, frameNumber, width, height);
    
    // Convert to PNG buffer
    return {
      buffer: canvas.toBuffer('image/png'),
      width,
      height,
      totalFrames
    };
  } catch (error) {
    throw new Error(`Conversion failed: ${error.message}`);
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// Single file conversion endpoint
app.post('/convert', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const frameNumber = parseInt(req.query.frame || '0');
    const format = req.query.format || 'png'; // Future: support webp
    
    const result = await convertTgsToPng(req.file.buffer, frameNumber);
    
    // Set headers
    res.set({
      'Content-Type': 'image/png',
      'Content-Length': result.buffer.length,
      'X-Total-Frames': result.totalFrames,
      'X-Processing-Time': `${Date.now() - startTime}ms`
    });
    
    res.send(result.buffer);
  } catch (error) {
    console.error('Conversion error:', error);
    res.status(500).json({ 
      error: 'Conversion failed',
      message: error.message 
    });
  }
});

// Batch conversion endpoint
app.post('/convert/batch', upload.array('files', 100), async (req, res) => {
  const startTime = Date.now();
  
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    const frameNumber = parseInt(req.query.frame || '0');
    
    // Process all files in parallel
    const results = await Promise.allSettled(
      req.files.map(file => convertTgsToPng(file.buffer, frameNumber))
    );
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.length - successful;
    
    // Return results as JSON with base64 images
    const response = {
      total: req.files.length,
      successful,
      failed,
      processingTime: `${Date.now() - startTime}ms`,
      images: results.map((result, index) => ({
        filename: req.files[index].originalname,
        status: result.status,
        data: result.status === 'fulfilled' 
          ? result.value.buffer.toString('base64')
          : null,
        error: result.status === 'rejected' 
          ? result.reason.message 
          : null,
        totalFrames: result.status === 'fulfilled' 
          ? result.value.totalFrames 
          : null
      }))
    };
    
    res.json(response);
  } catch (error) {
    console.error('Batch conversion error:', error);
    res.status(500).json({ 
      error: 'Batch conversion failed',
      message: error.message 
    });
  }
});

// Get animation info without conversion
app.post('/info', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const decompressed = pako.ungzip(req.file.buffer, { to: 'string' });
    const animationData = JSON.parse(decompressed);
    
    res.json({
      width: animationData.w || 512,
      height: animationData.h || 512,
      totalFrames: animationData.op || 60,
      frameRate: animationData.fr || 30,
      duration: (animationData.op || 60) / (animationData.fr || 30),
      layers: animationData.layers?.length || 0,
      assets: animationData.assets?.length || 0
    });
  } catch (error) {
    console.error('Info extraction error:', error);
    res.status(500).json({ 
      error: 'Failed to extract info',
      message: error.message 
    });
  }
});

// Base64 conversion endpoint (no file upload needed)
app.post('/convert/base64', express.json({ limit: '50mb' }), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { data, frame = 0 } = req.body;
    
    if (!data) {
      return res.status(400).json({ error: 'No data provided' });
    }
    
    // Decode base64
    const buffer = Buffer.from(data, 'base64');
    
    const result = await convertTgsToPng(buffer, frame);
    
    res.json({
      image: result.buffer.toString('base64'),
      width: result.width,
      height: result.height,
      totalFrames: result.totalFrames,
      processingTime: `${Date.now() - startTime}ms`
    });
  } catch (error) {
    console.error('Base64 conversion error:', error);
    res.status(500).json({ 
      error: 'Conversion failed',
      message: error.message 
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Global error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: error.message 
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 TGS Converter API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔄 Single conversion: POST http://localhost:${PORT}/convert`);
  console.log(`📦 Batch conversion: POST http://localhost:${PORT}/convert/batch`);
  console.log(`ℹ️  File info: POST http://localhost:${PORT}/info`);
  console.log(`📝 Base64 conversion: POST http://localhost:${PORT}/convert/base64`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
