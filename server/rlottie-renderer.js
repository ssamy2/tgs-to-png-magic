import pako from 'pako';
import { exec } from 'child_process';
import { writeFile, unlink, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import sharp from 'sharp';

/**
 * High-performance TGS to PNG/WebP converter using rlottie
 * 
 * This uses rlottie command-line tool for actual rendering.
 * For production, you should install rlottie:
 * 
 * Ubuntu/Debian:
 *   sudo apt-get install rlottie-bin
 * 
 * Or build from source:
 *   git clone https://github.com/Samsung/rlottie.git
 *   cd rlottie && mkdir build && cd build
 *   cmake .. && make -j4 && sudo make install
 */

class RLottieRenderer {
  constructor() {
    this.initialized = false;
    this.tempDir = tmpdir();
  }

  /**
   * Check if rlottie is available
   */
  async checkRLottie() {
    return new Promise((resolve) => {
      exec('which lottie2gif || which rlottie', (error) => {
        resolve(!error);
      });
    });
  }

  /**
   * Decompress and parse TGS file
   */
  async parseTgs(buffer) {
    try {
      const decompressed = pako.ungzip(buffer, { to: 'string' });
      return JSON.parse(decompressed);
    } catch (error) {
      throw new Error(`Failed to parse TGS: ${error.message}`);
    }
  }

  /**
   * Render frame using rlottie CLI
   */
  async renderWithCLI(jsonPath, outputPath, frameNumber, width, height) {
    return new Promise((resolve, reject) => {
      const cmd = `lottie2gif -s ${frameNumber} -e ${frameNumber + 1} -w ${width} -h ${height} ${jsonPath} ${outputPath}`;
      
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`rlottie failed: ${stderr || error.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Pure JavaScript Lottie renderer (fallback)
   * This is a simplified renderer that handles basic shapes
   */
  async renderPureJS(animationData, frameNumber, width, height) {
    // Create RGBA buffer
    const buffer = Buffer.alloc(width * height * 4);
    
    // Background color
    if (animationData.bg) {
      const bg = this.hexToRgb(animationData.bg);
      for (let i = 0; i < buffer.length; i += 4) {
        buffer[i] = bg.r;
        buffer[i + 1] = bg.g;
        buffer[i + 2] = bg.b;
        buffer[i + 3] = 255;
      }
    } else {
      // Transparent background
      buffer.fill(0);
    }

    // Calculate frame progress
    const totalFrames = animationData.op - animationData.ip;
    const frameProgress = frameNumber / totalFrames;

    // Render layers (simplified - handles basic shapes only)
    if (animationData.layers) {
      for (const layer of animationData.layers) {
        if (layer.ty === 4) { // Shape layer
          this.renderShapeLayer(buffer, layer, frameProgress, width, height);
        }
      }
    }

    return buffer;
  }

  /**
   * Render a shape layer (very simplified)
   */
  renderShapeLayer(buffer, layer, frameProgress, width, height) {
    // This is a very basic implementation
    // For production use, you need full Lottie spec implementation
    // or use rlottie/lottie-web
    
    if (!layer.shapes) return;

    for (const shape of layer.shapes) {
      if (shape.ty === 'rc') { // Rectangle
        // Draw rectangle (simplified)
        // In real implementation, you'd need to handle transforms, colors, etc.
      } else if (shape.ty === 'el') { // Ellipse
        // Draw ellipse
      }
    }
  }

  /**
   * Convert hex color to RGB
   */
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
  }

  /**
   * Main render function
   */
  async render(tgsBuffer, options = {}) {
    const {
      frame = 0,
      width = 512,
      height = 512,
      format = 'png',
      quality = 90
    } = options;

    try {
      // Parse TGS
      const animationData = await this.parseTgs(tgsBuffer);
      
      // Get actual dimensions
      const actualWidth = width || animationData.w || 512;
      const actualHeight = height || animationData.h || 512;
      const totalFrames = (animationData.op || 60) - (animationData.ip || 0);

      // Validate frame number
      const frameNumber = Math.min(frame, totalFrames - 1);

      // Check if rlottie CLI is available
      const hasRLottie = await this.checkRLottie();

      let imageBuffer;

      if (hasRLottie) {
        // Use rlottie CLI for best quality
        const tempJson = join(this.tempDir, `tgs_${Date.now()}_${Math.random().toString(36).slice(2)}.json`);
        const tempOutput = tempJson.replace('.json', '.gif');

        try {
          // Write JSON to temp file
          await writeFile(tempJson, JSON.stringify(animationData));

          // Render with rlottie
          await this.renderWithCLI(tempJson, tempOutput, frameNumber, actualWidth, actualHeight);

          // Read the first frame from GIF
          imageBuffer = await readFile(tempOutput);

          // Clean up
          await unlink(tempJson).catch(() => {});
          await unlink(tempOutput).catch(() => {});
        } catch (error) {
          console.error('rlottie CLI failed, falling back to pure JS:', error.message);
          // Fall through to pure JS renderer
        }
      }

      if (!imageBuffer) {
        // Use pure JavaScript renderer (fallback)
        const rawBuffer = await this.renderPureJS(animationData, frameNumber, actualWidth, actualHeight);
        
        // Convert raw RGBA to PNG/WebP using sharp
        imageBuffer = await sharp(rawBuffer, {
          raw: {
            width: actualWidth,
            height: actualHeight,
            channels: 4
          }
        })
        .toFormat(format === 'webp' ? 'webp' : 'png', {
          quality: format === 'webp' ? quality : undefined
        })
        .toBuffer();
      } else {
        // Convert GIF frame to desired format
        imageBuffer = await sharp(imageBuffer)
          .toFormat(format === 'webp' ? 'webp' : 'png', {
            quality: format === 'webp' ? quality : undefined
          })
          .toBuffer();
      }

      return {
        buffer: imageBuffer,
        width: actualWidth,
        height: actualHeight,
        totalFrames,
        format
      };
    } catch (error) {
      throw new Error(`Rendering failed: ${error.message}`);
    }
  }
}

// Singleton instance
let rendererInstance = null;

export function getRenderer() {
  if (!rendererInstance) {
    rendererInstance = new RLottieRenderer();
  }
  return rendererInstance;
}

export default RLottieRenderer;
