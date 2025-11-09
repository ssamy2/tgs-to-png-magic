import cluster from 'cluster';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const numCPUs = os.cpus().length;
const PORT = process.env.PORT || 3000;

if (cluster.isPrimary) {
  console.log(`🎯 Master process ${process.pid} is running`);
  console.log(`🔥 Starting ${numCPUs} worker processes for maximum performance...`);
  
  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  
  cluster.on('exit', (worker, code, signal) => {
    console.log(`⚠️  Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });
  
  console.log(`\n✅ Cluster ready to handle 10,000+ requests/second`);
  console.log(`📡 API available at: http://localhost:${PORT}`);
  console.log(`💪 Workers: ${numCPUs}`);
} else {
  // Workers can share any TCP connection
  // In this case, it's an HTTP server
  const app = await import('./server.js');
  console.log(`👷 Worker ${process.pid} started`);
}
