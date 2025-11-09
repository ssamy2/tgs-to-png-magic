/**
 * High-performance TGS converter API using Fastify
 * Production-ready with 2MB limit, validation, and optimized performance
 */

import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import { cpus } from 'os';
import { AnimationCache } from './utils/cache.js';
import { RenderPool } from './utils/renderer.js';
import { parseTgs, generateSlug, getMetadata } from './utils/tgsParser.js';
import { validateFileSize, validateFormat, validateFrameNumber, validateDimensions } from './utils/validators.js';

const PORT = process.env.PORT || 3000;
const CACHE_SIZE = parseInt(process.env.CACHE_SIZE || '1000');
const WORKER_POOL_SIZE = parseInt(process.env.WORKER_POOL_SIZE || '0') || cpus().length;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

// Initialize
const cache = new AnimationCache(CACHE_SIZE);
const renderPool = new RenderPool(WORKER_POOL_SIZE);

// Create Fastify instance
const fastify = Fastify({
  logger: false,
  requestTimeout: 30000,
  bodyLimit: MAX_FILE_SIZE,
  trustProxy: true
});

// Register plugins
await fastify.register(cors, {
  origin: '*'
});

await fastify.register(multipart, {
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1
  }
});

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
    rlottie: poolStats.rlottieStatus || { available: false, mode: 'unknown' },
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
    
    // Validate file size
    validateFileSize(buffer.length);
    
    // Parse TGS
    const animationData = parseTgs(buffer);
    const metadata = getMetadata(animationData);
    
    // Get options from query
    const frameNumber = parseInt(request.query.frame || '0');
    const format = request.query.format || 'png';
    const quality = parseInt(request.query.quality || '90');
    const width = parseInt(request.query.width || '0') || metadata.width;
    const height = parseInt(request.query.height || '0') || metadata.height;
    
    // Validate
    validateFormat(format);
    validateFrameNumber(frameNumber, metadata.totalFrames);
    validateDimensions(width, height);
    
    // Generate slug for caching
    const slug = generateSlug(animationData);
    
    // Check cache
    let cachedData = cache.get(slug);
    
    if (!cachedData) {
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
    return reply.code(error.message.includes('Invalid') || error.message.includes('too large') ? 400 : 500).send({
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
    
    // Validate
    validateFileSize(buffer.length);
    validateFormat(format);
    
    // Parse TGS
    const animationData = parseTgs(buffer);
    const metadata = getMetadata(animationData);
    
    const frameNumber = parseInt(frame);
    const finalWidth = width ? parseInt(width) : metadata.width;
    const finalHeight = height ? parseInt(height) : metadata.height;
    
    validateFrameNumber(frameNumber, metadata.totalFrames);
    validateDimensions(finalWidth, finalHeight);
    
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
      frameNumber,
      { format, quality: parseInt(quality), width: finalWidth, height: finalHeight }
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
    return reply.code(error.message.includes('Invalid') || error.message.includes('too large') ? 400 : 500).send({
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
    validateFileSize(buffer.length);
    
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
    return reply.code(error.message.includes('Invalid') || error.message.includes('too large') ? 400 : 500).send({
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
    
    console.log(`\n🚀 TGS Converter API v2.0 (Production)`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📡 Server: http://0.0.0.0:${PORT}`);
    console.log(`💻 PID: ${process.pid}`);
    console.log(`🔥 Workers: ${WORKER_POOL_SIZE}`);
    console.log(`💾 Cache: ${CACHE_SIZE} entries`);
    console.log(`📦 Max upload: 2MB`);
    console.log(`\n📋 Endpoints:`);
    console.log(`  POST /convert          - Multipart file upload`);
    console.log(`  POST /convert/base64   - Base64 payload`);
    console.log(`  POST /info             - Get file info`);
    console.log(`  GET  /health           - Health check`);
    console.log(`  GET  /stats            - Performance stats`);
    console.log(`  POST /cache/clear      - Clear cache`);
    console.log(`\n⚡ Target: 5-12ms (rlottie) | 20-50ms (fallback)`);
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
