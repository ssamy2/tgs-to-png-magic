/**
 * Comprehensive benchmark suite for TGS converter
 * Tests throughput, latency, and percentiles
 */

import { performance } from 'perf_hooks';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import fetch from 'node-fetch';
import FormData from 'form-data';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_FILE = process.argv[2] || 'test.tgs';
const WARMUP_REQUESTS = 50;
const BENCHMARK_REQUESTS = 1000;
const CONCURRENT_REQUESTS = [1, 10, 50, 100];

class BenchmarkRunner {
  constructor() {
    this.results = [];
  }

  /**
   * Measure single request latency
   */
  async measureRequest(fileBuffer, endpoint = '/convert') {
    const startTime = performance.now();
    
    try {
      const formData = new FormData();
      formData.append('file', fileBuffer, {
        filename: 'test.tgs',
        contentType: 'application/x-tgsticker'
      });

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const buffer = await response.arrayBuffer();
      const endTime = performance.now();
      const latency = endTime - startTime;

      return {
        success: true,
        latency,
        size: buffer.byteLength,
        processingTime: parseFloat(response.headers.get('x-processing-time') || '0')
      };
    } catch (error) {
      const endTime = performance.now();
      return {
        success: false,
        latency: endTime - startTime,
        error: error.message
      };
    }
  }

  /**
   * Run concurrent requests
   */
  async runConcurrent(fileBuffer, count, concurrency) {
    const results = [];
    const batches = Math.ceil(count / concurrency);

    for (let batch = 0; batch < batches; batch++) {
      const batchSize = Math.min(concurrency, count - batch * concurrency);
      const promises = [];

      for (let i = 0; i < batchSize; i++) {
        promises.push(this.measureRequest(fileBuffer));
      }

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Calculate statistics
   */
  calculateStats(results) {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    if (successful.length === 0) {
      return {
        total: results.length,
        successful: 0,
        failed: failed.length,
        error: 'All requests failed'
      };
    }

    const latencies = successful.map(r => r.latency).sort((a, b) => a - b);
    const processingTimes = successful.map(r => r.processingTime).sort((a, b) => a - b);
    const sizes = successful.map(r => r.size);

    const sum = (arr) => arr.reduce((a, b) => a + b, 0);
    const avg = (arr) => sum(arr) / arr.length;
    const percentile = (arr, p) => arr[Math.floor(arr.length * p / 100)];

    return {
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      latency: {
        min: latencies[0].toFixed(2),
        max: latencies[latencies.length - 1].toFixed(2),
        avg: avg(latencies).toFixed(2),
        median: percentile(latencies, 50).toFixed(2),
        p95: percentile(latencies, 95).toFixed(2),
        p99: percentile(latencies, 99).toFixed(2)
      },
      processingTime: {
        min: processingTimes[0].toFixed(2),
        max: processingTimes[processingTimes.length - 1].toFixed(2),
        avg: avg(processingTimes).toFixed(2),
        median: percentile(processingTimes, 50).toFixed(2),
        p95: percentile(processingTimes, 95).toFixed(2),
        p99: percentile(processingTimes, 99).toFixed(2)
      },
      size: {
        avg: (avg(sizes) / 1024).toFixed(2) + ' KB',
        total: (sum(sizes) / 1024 / 1024).toFixed(2) + ' MB'
      }
    };
  }

  /**
   * Print results table
   */
  printResults(stats, concurrency, duration) {
    const opsPerSec = (stats.successful / (duration / 1000)).toFixed(2);

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Concurrency: ${concurrency}`);
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`\n📊 Request Statistics:`);
    console.log(`  Total:      ${stats.total}`);
    console.log(`  Successful: ${stats.successful} (${(stats.successful / stats.total * 100).toFixed(1)}%)`);
    console.log(`  Failed:     ${stats.failed}`);
    console.log(`  Throughput: ${opsPerSec} ops/sec`);
    
    console.log(`\n⚡ End-to-End Latency (ms):`);
    console.log(`  Min:    ${stats.latency.min}`);
    console.log(`  Avg:    ${stats.latency.avg}`);
    console.log(`  Median: ${stats.latency.median}`);
    console.log(`  P95:    ${stats.latency.p95}`);
    console.log(`  P99:    ${stats.latency.p99}`);
    console.log(`  Max:    ${stats.latency.max}`);

    console.log(`\n🔥 Server Processing Time (ms):`);
    console.log(`  Min:    ${stats.processingTime.min}`);
    console.log(`  Avg:    ${stats.processingTime.avg}`);
    console.log(`  Median: ${stats.processingTime.median}`);
    console.log(`  P95:    ${stats.processingTime.p95}`);
    console.log(`  P99:    ${stats.processingTime.p99}`);
    console.log(`  Max:    ${stats.processingTime.max}`);

    console.log(`\n📦 Output Size:`);
    console.log(`  Avg per image: ${stats.size.avg}`);
    console.log(`  Total:         ${stats.size.total}`);
  }

  /**
   * Run full benchmark suite
   */
  async run() {
    console.log(`\n🧪 TGS Converter Performance Benchmark`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`API URL: ${API_URL}`);
    console.log(`Test file: ${TEST_FILE}`);
    console.log(`Warmup requests: ${WARMUP_REQUESTS}`);
    console.log(`Benchmark requests: ${BENCHMARK_REQUESTS}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // Check if test file exists
    if (!existsSync(TEST_FILE)) {
      console.error(`\n❌ Test file not found: ${TEST_FILE}`);
      console.log(`\nUsage: node benchmark.js <path-to-tgs-file>`);
      process.exit(1);
    }

    // Load test file
    console.log(`\n📂 Loading test file...`);
    const fileBuffer = await readFile(TEST_FILE);
    console.log(`✅ Loaded ${(fileBuffer.length / 1024).toFixed(2)} KB`);

    // Check API health
    console.log(`\n🔍 Checking API health...`);
    try {
      const response = await fetch(`${API_URL}/health`);
      const health = await response.json();
      console.log(`✅ API is healthy`);
      console.log(`   Workers: ${health.renderPool?.poolSize || 'unknown'}`);
      console.log(`   Cache: ${health.cache?.size || 0}/${health.cache?.maxSize || 0}`);
    } catch (error) {
      console.error(`❌ API is not reachable: ${error.message}`);
      process.exit(1);
    }

    // Warmup
    console.log(`\n🔥 Warming up with ${WARMUP_REQUESTS} requests...`);
    await this.runConcurrent(fileBuffer, WARMUP_REQUESTS, 10);
    console.log(`✅ Warmup complete`);

    // Run benchmarks with different concurrency levels
    const allResults = [];

    for (const concurrency of CONCURRENT_REQUESTS) {
      console.log(`\n\n⏱️  Running benchmark with concurrency ${concurrency}...`);
      
      const startTime = performance.now();
      const results = await this.runConcurrent(fileBuffer, BENCHMARK_REQUESTS, concurrency);
      const endTime = performance.now();
      const duration = endTime - startTime;

      const stats = this.calculateStats(results);
      this.printResults(stats, concurrency, duration);

      allResults.push({
        concurrency,
        duration,
        stats,
        opsPerSec: stats.successful / (duration / 1000)
      });
    }

    // Summary
    console.log(`\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📈 SUMMARY`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    console.log(`\nThroughput by Concurrency:`);
    for (const result of allResults) {
      console.log(`  ${result.concurrency.toString().padStart(3)} concurrent: ${result.opsPerSec.toFixed(2)} ops/sec`);
    }

    const bestResult = allResults.reduce((a, b) => a.opsPerSec > b.opsPerSec ? a : b);
    console.log(`\n🏆 Best throughput: ${bestResult.opsPerSec.toFixed(2)} ops/sec at concurrency ${bestResult.concurrency}`);
    console.log(`⚡ Fastest P99 latency: ${bestResult.stats.latency.p99}ms`);
    console.log(`🎯 Target (<10ms): ${parseFloat(bestResult.stats.processingTime.avg) < 10 ? '✅ PASSED' : '❌ FAILED'}`);

    // Save results
    const reportFile = `benchmark-results-${Date.now()}.json`;
    await writeFile(reportFile, JSON.stringify(allResults, null, 2));
    console.log(`\n💾 Results saved to: ${reportFile}`);

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  }
}

// Run benchmark
const runner = new BenchmarkRunner();
runner.run().catch(error => {
  console.error('\n❌ Benchmark failed:', error);
  process.exit(1);
});
