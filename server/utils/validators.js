/**
 * Input validation utilities
 */

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_DIMENSION = 4096;
const VALID_FORMATS = ['png', 'webp'];

/**
 * Validate file size
 */
export function validateFileSize(size, maxSize = MAX_FILE_SIZE) {
  if (size > maxSize) {
    throw new Error(`File too large: ${(size / 1024 / 1024).toFixed(2)}MB (max ${(maxSize / 1024 / 1024).toFixed(2)}MB)`);
  }
}

/**
 * Validate output format
 */
export function validateFormat(format) {
  if (!VALID_FORMATS.includes(format)) {
    throw new Error(`Invalid format: ${format}. Supported: ${VALID_FORMATS.join(', ')}`);
  }
}

/**
 * Validate frame number
 */
export function validateFrameNumber(frame, totalFrames) {
  if (frame < 0 || frame >= totalFrames) {
    throw new Error(`Invalid frame: ${frame}. Valid range: 0-${totalFrames - 1}`);
  }
}

/**
 * Validate dimensions
 */
export function validateDimensions(width, height, max = MAX_DIMENSION) {
  if (width > max || height > max) {
    throw new Error(`Dimensions too large: ${width}x${height} (max ${max}x${max})`);
  }
  if (width < 1 || height < 1) {
    throw new Error(`Invalid dimensions: ${width}x${height}`);
  }
}
