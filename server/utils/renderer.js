/**
 * High-performance rendering engine using worker threads
 * Implements thread pool for parallel frame rendering
 */

import { Worker } from 'worker_threads';
import { cpus } from 'os';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class RenderPool {
  constructor(poolSize = cpus().length) {
    this.poolSize = poolSize;
    this.workers = [];
    this.availableWorkers = [];
    this.taskQueue = [];
    this.nextWorkerId = 0;
    
    // Performance metrics
    this.totalTasks = 0;
    this.completedTasks = 0;
    this.failedTasks = 0;
    this.totalLatency = 0;
    
    // rlottie status
    this.rlottieStatus = { available: false, command: null, mode: 'checking' };
    
    this.initialize();
  }

  /**
   * Initialize worker pool
   */
  initialize() {
    for (let i = 0; i < this.poolSize; i++) {
      this.createWorker(i);
    }
    console.log(`[RenderPool] Initialized with ${this.poolSize} workers`);
  }

  /**
   * Create a new worker thread
   */
  createWorker(id) {
    const worker = new Worker(join(__dirname, '..', 'worker.js'), {
      workerData: { workerId: id }
    });

    const workerContext = {
      id,
      worker,
      busy: false,
      tasksCompleted: 0,
      tasksFailed: 0
    };

    worker.on('message', (result) => {
      // Handle rlottie status message
      if (result.type === 'rlottie-status') {
        this.rlottieStatus = result.status;
        console.log(`[Pool] rlottie status from worker ${id}:`, result.status.mode);
        return;
      }
      
      this.handleWorkerMessage(workerContext, result);
    });

    worker.on('error', (error) => {
      console.error(`[Worker ${id}] Error:`, error);
      workerContext.tasksFailed++;
      this.failedTasks++;
      
      // Reject current task if any
      if (workerContext.currentTask) {
        workerContext.currentTask.reject(error);
        workerContext.currentTask = null;
      }
      
      // Mark as available and process queue
      workerContext.busy = false;
      this.availableWorkers.push(workerContext);
      this.processQueue();
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`[Worker ${id}] Exited with code ${code}`);
        // Remove from workers array
        const index = this.workers.indexOf(workerContext);
        if (index > -1) {
          this.workers.splice(index, 1);
        }
        // Recreate worker
        this.createWorker(id);
      }
    });

    this.workers.push(workerContext);
    this.availableWorkers.push(workerContext);
  }

  /**
   * Handle message from worker
   */
  handleWorkerMessage(workerContext, result) {
    if (!workerContext.currentTask) return;

    const task = workerContext.currentTask;
    const latency = Date.now() - task.startTime;
    
    this.completedTasks++;
    this.totalLatency += latency;
    workerContext.tasksCompleted++;
    
    if (result.success) {
      task.resolve(result.data);
    } else {
      this.failedTasks++;
      workerContext.tasksFailed++;
      task.reject(new Error(result.error));
    }

    // Mark worker as available and process next task
    workerContext.currentTask = null;
    workerContext.busy = false;
    this.availableWorkers.push(workerContext);
    this.processQueue();
  }

  /**
   * Render a frame from animation data
   * @param {Object} animationData - Parsed Lottie JSON
   * @param {number} frameNumber - Frame to render
   * @param {Object} options - Rendering options
   * @returns {Promise<Buffer>} Encoded image buffer
   */
  async renderFrame(animationData, frameNumber, options = {}) {
    this.totalTasks++;
    
    return new Promise((resolve, reject) => {
      const task = {
        animationData,
        frameNumber,
        options: {
          format: options.format || 'png',
          quality: options.quality || 90,
          width: options.width,
          height: options.height
        },
        resolve,
        reject,
        startTime: Date.now()
      };

      this.taskQueue.push(task);
      this.processQueue();
    });
  }

  /**
   * Process task queue
   */
  processQueue() {
    while (this.taskQueue.length > 0 && this.availableWorkers.length > 0) {
      const task = this.taskQueue.shift();
      const workerContext = this.availableWorkers.shift();

      workerContext.busy = true;
      workerContext.currentTask = task;

      workerContext.worker.postMessage({
        type: 'render',
        data: {
          animationData: task.animationData,
          frameNumber: task.frameNumber,
          options: task.options
        }
      });
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    const busyWorkers = this.workers.filter(w => w.busy).length;
    const avgLatency = this.completedTasks > 0 
      ? (this.totalLatency / this.completedTasks).toFixed(2)
      : 0;

    return {
      poolSize: this.poolSize,
      busyWorkers,
      availableWorkers: this.availableWorkers.length,
      queuedTasks: this.taskQueue.length,
      totalTasks: this.totalTasks,
      completedTasks: this.completedTasks,
      failedTasks: this.failedTasks,
      avgLatency: `${avgLatency}ms`,
      rlottieStatus: this.rlottieStatus,
      workerStats: this.workers.map(w => ({
        id: w.id,
        busy: w.busy,
        completed: w.tasksCompleted,
        failed: w.tasksFailed
      }))
    };
  }

  /**
   * Shutdown pool
   */
  async shutdown() {
    console.log('[RenderPool] Shutting down...');
    
    await Promise.all(
      this.workers.map(w => w.worker.terminate())
    );
    
    this.workers = [];
    this.availableWorkers = [];
    this.taskQueue = [];
    
    console.log('[RenderPool] Shutdown complete');
  }
}

export default RenderPool;
