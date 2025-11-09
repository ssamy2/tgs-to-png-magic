/**
 * High-performance TGS converter API using Fastify
 * Optimized for <10ms latency and high throughput
 */

import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import pako from 'pako';
import crypto from 'crypto';
import { AnimationCache } from './cache.js';
import { RenderPool } from './renderer.js';

const PORT = process.env.PORT || 3000;
const CACHE_SIZE = parseInt(process.env.CACHE_SIZE || '1000');
const WORKER_POOL_SIZE = parseInt(process.env.WORKER_POOL_SIZE || '0') || require('os').cpus().length;

// Initialize
const cache = new AnimationCache(CACHE_SIZE);
const renderPool = new RenderPool(WORKER_POOL_SIZE);

// Create Fastify instance
const fastify = Fastify({
  logger: false,
  requestTimeout: 30000,
  bodyLimit: 10485760, // 10MB
  trustProxy: true
});

// Register plugins
await fastify.register(cors, {
  origin: '*'
});

await fastify.register(multipart, {
  limits: {
    fileSize: 10485760,
    files: 1
  }
});

/**
 * Parse TGS buffer
 */
function parseTgs(buffer) {
  try {
    const decompressed = pako.ungzip(buffer, { to: 'string' });
    return JSON.parse(decompressed);
  } catch (error) {
    throw new Error(`Invalid TGS file: ${error.message}`);
  }
}

/**
 * Generate cache key from animation data
 */
function generateSlug(animationData) {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(animationData));
  return hash.digest('hex').substring(0, 16);
}

/**
 * Get animation metadata
 */
function getMetadata(animationData) {
  return {
    width: animationData.w || 512,
    height: animationData.h || 512,
    totalFrames: (animationData.op || 60) - (animationData.ip || 0),
    frameRate: animationData.fr || 30
  };
}

/**
 * Health check endpoint
 */
fastify.get('/health', async (request, reply) => {
  const cacheStats = cache.getStats();
  const poolStats = renderPool.getStats();
  
  return {
    status: 'ok',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cache: cacheStats,
    renderPool: poolStats,
    timestamp: new Date().toISOString()
  };
});

/**
 * Convert endpoint - multipart file upload
 */
fastify.post('/convert', async (request, reply) => {
  const startTime = Date.now();
  
  try {
    const data = await request.file();
    
    if (!data) {
      return reply.code(400).send({ error: 'No file provided' });
    }

    // Read file buffer
    const buffer = await data.toBuffer();
    
    // Parse TGS
    const animationData = parseTgs(buffer);
    const metadata = getMetadata(animationData);
    
    // Generate slug for caching
    const slug = generateSlug(animationData);
    
    // Get options from query
    const frameNumber = parseInt(request.query.frame || '0');
    const format = request.query.format || 'png';
    const quality = parseInt(request.query.quality || '90');
    const width = parseInt(request.query.width || '0') || metadata.width;
    const height = parseInt(request.query.height || '0') || metadata.height;
    
    // Check cache
    let cachedData = cache.get(slug);
    
    if (!cachedData) {
      // Store in cache
      cache.set(slug, animationData, metadata);
      cachedData = cache.get(slug);
    }
    
    // Render frame
    const result = await renderPool.renderFrame(
      cachedData.animationData,
      frameNumber,
      { format, quality, width, height }
    );
    
    // Release cache reference
    cache.release(slug);
    
    const processingTime = Date.now() - startTime;
    
    // Set headers
    reply.header('Content-Type', `image/${format}`);
    reply.header('X-Processing-Time', `${processingTime}ms`);
    reply.header('X-Total-Frames', metadata.totalFrames);
    reply.header('X-Cache-Hit', cachedData ? 'true' : 'false');
    reply.header('X-Image-Size', result.size);
    
    return reply.send(result.buffer);
    
  } catch (error) {
    console.error('Conversion error:', error);
    return reply.code(500).send({
      error: 'Conversion failed',
      message: error.message,
      processingTime: `${Date.now() - startTime}ms`
    });
  }
});

/**
 * Convert endpoint - base64 payload
 */
fastify.post('/convert/base64', async (request, reply) => {
  const startTime = Date.now();
  
  try {
    const { data, frame = 0, format = 'png', quality = 90, width, height } = request.body;
    
    if (!data) {
      return reply.code(400).send({ error: 'No data provided' });
    }
    
    // Decode base64
    const buffer = Buffer.from(data, 'base64');
    
    // Parse TGS
    const animationData = parseTgs(buffer);
    const metadata = getMetadata(animationData);
    
    // Generate slug
    const slug = generateSlug(animationData);
    
    // Check cache
    let cachedData = cache.get(slug);
    
    if (!cachedData) {
      cache.set(slug, animationData, metadata);
      cachedData = cache.get(slug);
    }
    
    // Render
    const result = await renderPool.renderFrame(
      cachedData.animationData,
      parseInt(frame),
      {
        format,
        quality: parseInt(quality),
        width: width ? parseInt(width) : metadata.width,
        height: height ? parseInt(height) : metadata.height
      }
    );
    
    cache.release(slug);
    
    const processingTime = Date.now() - startTime;
    
    return {
      image: result.buffer.toString('base64'),
      width: result.width,
      height: result.height,
      format: result.format,
      size: result.size,
      totalFrames: metadata.totalFrames,
      processingTime: `${processingTime}ms`,
      cacheHit: !!cachedData
    };
    
  } catch (error) {
    console.error('Conversion error:', error);
    return reply.code(500).send({
      error: 'Conversion failed',
      message: error.message,
      processingTime: `${Date.now() - startTime}ms`
    });
  }
});

/**
 * Get file info
 */
fastify.post('/info', async (request, reply) => {
  try {
    const data = await request.file();
    
    if (!data) {
      return reply.code(400).send({ error: 'No file provided' });
    }

    const buffer = await data.toBuffer();
    const animationData = parseTgs(buffer);
    const metadata = getMetadata(animationData);
    
    return {
      width: metadata.width,
      height: metadata.height,
      totalFrames: metadata.totalFrames,
      frameRate: metadata.frameRate,
      duration: metadata.totalFrames / metadata.frameRate,
      layers: animationData.layers?.length || 0,
      assets: animationData.assets?.length || 0,
      version: animationData.v,
      name: animationData.nm || 'untitled'
    };
    
  } catch (error) {
    return reply.code(500).send({
      error: 'Failed to extract info',
      message: error.message
    });
  }
});

/**
 * Stats endpoint
 */
fastify.get('/stats', async (request, reply) => {
  return {
    cache: cache.getStats(),
    renderPool: renderPool.getStats(),
    memory: process.memoryUsage(),
    uptime: process.uptime()
  };
});

/**
 * Clear cache
 */
fastify.post('/cache/clear', async (request, reply) => {
  cache.clear();
  return { success: true, message: 'Cache cleared' };
});

// Start server
async function start() {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    
    console.log(`\n🚀 TGS Converter API v2.0 (High Performance)`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📡 Server: http://0.0.0.0:${PORT}`);
    console.log(`💻 PID: ${process.pid}`);
    console.log(`🔥 Workers: ${WORKER_POOL_SIZE}`);
    console.log(`💾 Cache size: ${CACHE_SIZE}`);
    console.log(`\n📋 Endpoints:`);
    console.log(`  POST /convert          - Multipart file upload`);
    console.log(`  POST /convert/base64   - Base64 payload`);
    console.log(`  POST /info             - Get file info`);
    console.log(`  GET  /health           - Health check`);
    console.log(`  GET  /stats            - Performance stats`);
    console.log(`  POST /cache/clear      - Clear cache`);
    console.log(`\n⚡ Performance target: <10ms per frame`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown() {
  console.log('\n🛑 Shutting down...');
  
  await fastify.close();
  await renderPool.shutdown();
  cache.destroy();
  
  console.log('✅ Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start
start();

export default fastify;
