/**
 * TGS file parsing utilities
 * Handles decompression and metadata extraction
 */

import pako from 'pako';
import crypto from 'crypto';

/**
 * Parse TGS buffer (gzipped JSON)
 */
export function parseTgs(buffer) {
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
export function generateSlug(animationData) {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(animationData));
  return hash.digest('hex').substring(0, 16);
}

/**
 * Extract animation metadata
 */
export function getMetadata(animationData) {
  return {
    width: animationData.w || 512,
    height: animationData.h || 512,
    totalFrames: (animationData.op || 60) - (animationData.ip || 0),
    frameRate: animationData.fr || 30
  };
}
