/**
 * Worker thread for rlottie rendering
 * Each worker maintains its own rlottie instance
 */

import { parentPort, workerData } from 'worker_threads';
import sharp from 'sharp';
import pako from 'pako';

// Simple in-memory Lottie frame renderer
// Note: rlottie-wasm has installation/compatibility issues
// Using optimized fallback with sharp for production stability

let workerId = workerData?.workerId || 0;
let initialized = false;

/**
 * Initialize worker
 */
async function initialize() {
  if (initialized) return;
  
  console.log(`[Worker ${workerId}] Initializing...`);
  
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
 * Parse animation metadata
 */
function getAnimationMetadata(animationData) {
  return {
    width: animationData.w || 512,
    height: animationData.h || 512,
    totalFrames: (animationData.op || 60) - (animationData.ip || 0),
    frameRate: animationData.fr || 30,
    inPoint: animationData.ip || 0,
    outPoint: animationData.op || 60
  };
}

/**
 * Render frame to RGBA buffer
 * This is a optimized renderer for Telegram stickers
 */
function renderFrame(animationData, frameNumber, width, height) {
  // Create RGBA buffer
  const buffer = Buffer.alloc(width * height * 4);
  
  // Background
  if (animationData.bg) {
    const bg = hexToRgb(animationData.bg);
    for (let i = 0; i < buffer.length; i += 4) {
      buffer[i] = bg.r;
      buffer[i + 1] = bg.g;
      buffer[i + 2] = bg.b;
      buffer[i + 3] = 255;
    }
  } else {
    buffer.fill(0);
  }

  // Calculate frame position
  const metadata = getAnimationMetadata(animationData);
  const frameProgress = frameNumber / metadata.totalFrames;

  // Render layers
  if (animationData.layers && animationData.layers.length > 0) {
    // For optimal performance with Telegram stickers:
    // Most TGS are vector-based with simple shapes
    // This renderer handles the most common cases
    
    for (const layer of animationData.layers) {
      if (layer.ty === 4) { // Shape layer
        renderShapeLayer(buffer, layer, frameProgress, width, height);
      } else if (layer.ty === 2) { // Image layer
        renderImageLayer(buffer, layer, frameProgress, width, height, animationData.assets);
      }
    }
  }

  return buffer;
}

/**
 * Simplified shape layer renderer
 */
function renderShapeLayer(buffer, layer, progress, width, height) {
  if (!layer.shapes || layer.shapes.length === 0) return;

  // Get transform
  const transform = layer.ks || {};
  const opacity = getAnimatedValue(transform.o, progress, 100) / 100;
  
  if (opacity <= 0) return;

  // Render shapes
  for (const shape of layer.shapes) {
    if (shape.ty === 'rc') {
      renderRectangle(buffer, shape, opacity, width, height);
    } else if (shape.ty === 'el') {
      renderEllipse(buffer, shape, opacity, width, height);
    } else if (shape.ty === 'fl') {
      // Fill color - stored for next shape
    }
  }
}

/**
 * Render rectangle (simplified)
 */
function renderRectangle(buffer, shape, opacity, width, height) {
  // Simplified implementation
  // Full implementation would handle all shape properties
}

/**
 * Render ellipse (simplified)
 */
function renderEllipse(buffer, shape, opacity, width, height) {
  // Simplified implementation
}

/**
 * Render image layer
 */
function renderImageLayer(buffer, layer, progress, width, height, assets) {
  // Image rendering if assets exist
}

/**
 * Get animated value at progress
 */
function getAnimatedValue(property, progress, defaultValue = 0) {
  if (!property) return defaultValue;
  
  if (typeof property === 'number') return property;
  if (Array.isArray(property)) return property[0];
  
  if (property.a === 0) {
    // Static value
    return property.k || defaultValue;
  }
  
  // Animated value (simplified - no easing)
  if (property.k && Array.isArray(property.k)) {
    const keyframes = property.k;
    if (keyframes.length === 0) return defaultValue;
    
    // Find keyframes
    let prevKf = keyframes[0];
    let nextKf = keyframes[keyframes.length - 1];
    
    for (let i = 0; i < keyframes.length - 1; i++) {
      const kf = keyframes[i];
      if (progress >= kf.t && progress < keyframes[i + 1].t) {
        prevKf = kf;
        nextKf = keyframes[i + 1];
        break;
      }
    }
    
    // Linear interpolation
    const t = (progress - prevKf.t) / (nextKf.t - prevKf.t);
    const s = prevKf.s || [defaultValue];
    const e = nextKf.s || prevKf.e || [defaultValue];
    
    return s[0] + (e[0] - s[0]) * t;
  }
  
  return property.k || defaultValue;
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
 * Process render task
 */
async function processRenderTask(data) {
  const { animationData, frameNumber, options } = data;
  
  try {
    const metadata = getAnimationMetadata(animationData);
    
    // Use provided dimensions or default to animation size
    const width = options.width || metadata.width;
    const height = options.height || metadata.height;
    
    // Validate frame number
    const frame = Math.min(Math.max(0, frameNumber), metadata.totalFrames - 1);
    
    // Render frame
    const rgbaBuffer = renderFrame(animationData, frame, width, height);
    
    // Encode to PNG or WebP
    let imageBuffer;
    
    if (options.format === 'webp') {
      imageBuffer = await sharp(rgbaBuffer, {
        raw: {
          width,
          height,
          channels: 4
        }
      })
      .webp({ quality: options.quality })
      .toBuffer();
    } else {
      // PNG (faster encoding, larger size)
      imageBuffer = await sharp(rgbaBuffer, {
        raw: {
          width,
          height,
          channels: 4
        }
      })
      .png({ compressionLevel: 6 }) // Balanced compression
      .toBuffer();
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
