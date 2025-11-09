/**
 * High-performance animation cache with reference counting and LRU eviction
 * Stores parsed TGS animation data and tracks usage
 */

export class AnimationCache {
  constructor(maxSize = 1000, ttlMs = 3600000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlMs; // 1 hour default
    this.hits = 0;
    this.misses = 0;
    
    // Periodic cleanup
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Get animation data from cache
   * @param {string} slug - Unique identifier for animation
   * @returns {Object|null} Animation data or null if not found
   */
  get(slug) {
    const entry = this.cache.get(slug);
    
    if (!entry) {
      this.misses++;
      return null;
    }

    const now = Date.now();
    
    // Check if expired
    if (now - entry.createdAt > this.ttlMs) {
      this.cache.delete(slug);
      this.misses++;
      return null;
    }

    // Update access tracking
    entry.refCount++;
    entry.lastAccessed = now;
    entry.accessCount++;
    this.hits++;

    return {
      animationData: entry.animationData,
      metadata: {
        width: entry.width,
        height: entry.height,
        totalFrames: entry.totalFrames,
        frameRate: entry.frameRate
      }
    };
  }

  /**
   * Store animation data in cache
   * @param {string} slug - Unique identifier
   * @param {Object} animationData - Parsed Lottie JSON
   * @param {Object} metadata - Animation metadata
   */
  set(slug, animationData, metadata) {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(slug)) {
      this.evictLRU();
    }

    const now = Date.now();
    
    this.cache.set(slug, {
      animationData,
      width: metadata.width,
      height: metadata.height,
      totalFrames: metadata.totalFrames,
      frameRate: metadata.frameRate,
      refCount: 1,
      accessCount: 1,
      createdAt: now,
      lastAccessed: now,
      size: JSON.stringify(animationData).length
    });
  }

  /**
   * Release reference to cached animation
   * @param {string} slug
   */
  release(slug) {
    const entry = this.cache.get(slug);
    if (entry && entry.refCount > 0) {
      entry.refCount--;
    }
  }

  /**
   * Evict least recently used entry
   */
  evictLRU() {
    let oldestSlug = null;
    let oldestTime = Infinity;

    for (const [slug, entry] of this.cache.entries()) {
      // Don't evict if actively referenced
      if (entry.refCount > 0) continue;

      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestSlug = slug;
      }
    }

    if (oldestSlug) {
      this.cache.delete(oldestSlug);
    }
  }

  /**
   * Clean up expired and unused entries
   */
  cleanup() {
    const now = Date.now();
    const toDelete = [];

    for (const [slug, entry] of this.cache.entries()) {
      // Remove if expired and not referenced
      if (entry.refCount === 0 && (now - entry.lastAccessed > this.ttlMs)) {
        toDelete.push(slug);
      }
    }

    toDelete.forEach(slug => this.cache.delete(slug));

    if (toDelete.length > 0) {
      console.log(`[Cache] Cleaned up ${toDelete.length} expired entries`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    let totalSize = 0;
    let activeRefs = 0;
    let totalAccesses = 0;

    for (const entry of this.cache.values()) {
      totalSize += entry.size;
      activeRefs += entry.refCount;
      totalAccesses += entry.accessCount;
    }

    const hitRate = this.hits + this.misses > 0 
      ? (this.hits / (this.hits + this.misses) * 100).toFixed(2)
      : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      totalSize,
      activeRefs,
      totalAccesses,
      hits: this.hits,
      misses: this.misses,
      hitRate: `${hitRate}%`
    };
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Destroy cache and cleanup
   */
  destroy() {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
  }
}

export default AnimationCache;
