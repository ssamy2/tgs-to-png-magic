/**
 * Worker thread for TGS rendering with rlottie CLI
 * Falls back to simplified renderer if rlottie not available
 */

import { parentPort, workerData } from 'worker_threads';
import sharp from 'sharp';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const execFileAsync = promisify(execFile);

let workerId = workerData?.workerId || 0;
let initialized = false;
let hasRLottie = false;
let rlottieCommand = null;

/**
 * Check if rlottie CLI is available
 */
async function checkRLottie() {
  // Try lottie2gif
  try {
    await execFileAsync('lottie2gif', ['--help'], { timeout: 1000 });
    return 'lottie2gif';
  } catch (e) {
    // Try rlottie_dump
    try {
      await execFileAsync('rlottie_dump', ['--help'], { timeout: 1000 });
      return 'rlottie_dump';
    } catch (e2) {
      return null;
    }
  }
}

/**
 * Initialize worker
 */
async function initialize() {
  if (initialized) return;
  
  console.log(`[Worker ${workerId}] Initializing...`);
  
  // Check for rlottie
  rlottieCommand = await checkRLottie();
  hasRLottie = !!rlottieCommand;
  
  if (hasRLottie) {
    console.log(`[Worker ${workerId}] ✅ rlottie CLI detected (${rlottieCommand}) - native rendering enabled`);
    console.log(`[Worker ${workerId}] Expected latency: 5-12ms per frame`);
  } else {
    console.log(`[Worker ${workerId}] ⚠️  rlottie CLI not found - using fallback renderer`);
    console.log(`[Worker ${workerId}] Expected latency: 20-50ms per frame`);
    console.log(`[Worker ${workerId}] Install rlottie for 4x+ performance boost: see QUICK_START.md`);
  }
  
  // Send rlottie status to parent
  parentPort.postMessage({
    type: 'rlottie-status',
    status: {
      available: hasRLottie,
      command: rlottieCommand,
      mode: hasRLottie ? 'native' : 'fallback',
      expectedLatency: hasRLottie ? '5-12ms' : '20-50ms'
    }
  });
  
  // Pre-warm sharp
  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  }).png().toBuffer();
  
  initialized = true;
  console.log(`[Worker ${workerId}] Ready`);
}

/**
 * Render with rlottie CLI (fastest - 5-12ms)
 */
async function renderWithRLottie(animationData, frameNumber, width, height, format) {
  const tmpJson = join(tmpdir(), `lottie_${workerId}_${Date.now()}.json`);
  const tmpOut = join(tmpdir(), `frame_${workerId}_${Date.now()}.png`);
  
  try {
    // Write JSON
    await writeFile(tmpJson, JSON.stringify(animationData));
    
    // Execute rlottie command with timeout
    const timeout = 10000; // 10s timeout
    
    if (rlottieCommand === 'lottie2gif') {
      await execFileAsync('lottie2gif', [
        tmpJson,
        tmpOut,
        `${width}x${height}`,
        frameNumber.toString()
      ], { timeout });
    } else {
      await execFileAsync('rlottie_dump', [
        tmpJson,
        tmpOut,
        width.toString(),
        height.toString(),
        frameNumber.toString()
      ], { timeout });
    }
    
    // Read and re-encode if needed
    let buffer = await readFile(tmpOut);
    
    if (format === 'webp') {
      buffer = await sharp(buffer)
        .webp({ quality: 90 })
        .toBuffer();
    }
    
    return buffer;
  } finally {
    // Cleanup with force
    try {
      await Promise.allSettled([
        rm(tmpJson, { force: true }),
        rm(tmpOut, { force: true })
      ]);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Fallback: Extract first visible shape color and fill region (20-50ms)
 */
function renderFallback(animationData, frameNumber, width, height) {
  const buffer = Buffer.alloc(width * height * 4);
  
  // Start with background
  let bgColor = { r: 255, g: 255, b: 255, a: 255 };
  
  if (animationData.bg) {
    const bg = hexToRgb(animationData.bg);
    bgColor = { ...bg, a: 255 };
  }
  
  // Fill background
  for (let i = 0; i < buffer.length; i += 4) {
    buffer[i] = bgColor.r;
    buffer[i + 1] = bgColor.g;
    buffer[i + 2] = bgColor.b;
    buffer[i + 3] = bgColor.a;
  }
  
  // Find first visible shape color
  let shapeColor = null;
  
  if (animationData.layers) {
    for (const layer of animationData.layers) {
      if (!shapeColor && layer.ty === 4 && layer.shapes) {
        shapeColor = extractFirstColor(layer.shapes);
        if (shapeColor) break;
      }
    }
  }
  
  // If found a shape color, fill center region
  if (shapeColor) {
    const startX = Math.floor(width * 0.2);
    const endX = Math.floor(width * 0.8);
    const startY = Math.floor(height * 0.2);
    const endY = Math.floor(height * 0.8);
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const idx = (y * width + x) * 4;
        buffer[idx] = shapeColor.r;
        buffer[idx + 1] = shapeColor.g;
        buffer[idx + 2] = shapeColor.b;
        buffer[idx + 3] = shapeColor.a;
      }
    }
  }
  
  return buffer;
}

/**
 * Extract first visible color from shapes
 */
function extractFirstColor(shapes) {
  for (const shape of shapes) {
    if (shape.it) {
      const fill = shape.it.find(item => item.ty === 'fl');
      if (fill?.c?.k) {
        const [r, g, b, a = 1] = fill.c.k;
        return {
          r: Math.round(r * 255),
          g: Math.round(g * 255),
          b: Math.round(b * 255),
          a: Math.round(a * 255)
        };
      }
    }
    
    // Recursive search
    if (shape.it) {
      for (const item of shape.it) {
        if (item.it) {
          const color = extractFirstColor([item]);
          if (color) return color;
        }
      }
    }
  }
  
  return null;
}

/**
 * Convert hex to RGB
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 255, g: 255, b: 255 };
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
 * Process render task
 */
async function processRenderTask(data) {
  const { animationData, frameNumber, options } = data;
  
  try {
    const metadata = getMetadata(animationData);
    const width = options.width || metadata.width;
    const height = options.height || metadata.height;
    const frame = Math.min(Math.max(0, frameNumber), metadata.totalFrames - 1);
    
    let imageBuffer;
    
    if (hasRLottie) {
      // Use native rlottie (5-12ms)
      imageBuffer = await renderWithRLottie(
        animationData,
        frame,
        width,
        height,
        options.format
      );
    } else {
      // Use fallback (20-50ms)
      const rgbaBuffer = renderFallback(animationData, frame, width, height);
      
      if (options.format === 'webp') {
        imageBuffer = await sharp(rgbaBuffer, {
          raw: { width, height, channels: 4 }
        })
        .webp({ quality: options.quality || 90 })
        .toBuffer();
      } else {
        imageBuffer = await sharp(rgbaBuffer, {
          raw: { width, height, channels: 4 }
        })
        .png({ compressionLevel: 6 })
        .toBuffer();
      }
    }
    
    return {
      success: true,
      data: {
        buffer: imageBuffer,
        width,
        height,
        format: options.format,
        size: imageBuffer.length
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Message handler
 */
parentPort.on('message', async (message) => {
  if (!initialized) {
    await initialize();
  }

  if (message.type === 'render') {
    const result = await processRenderTask(message.data);
    parentPort.postMessage(result);
  }
});

// Signal ready
parentPort.postMessage({ type: 'ready', workerId });
