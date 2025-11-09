# Installation & Setup Guide

## ⚡ Quick Start (Without rlottie)

النسخة دي هتشتغل **فوراً** بدون تثبيت أي حاجة إضافية، لكن الـ rendering هيكون **simplified**.

```bash
cd server
npm install
npm start
```

**ملحوظة**: الـ renderer هيستخدم Pure JavaScript fallback، وده كويس للاختبار لكن **مش للإنتاج**.

---

## 🔥 Production Setup (With rlottie)

عشان أفضل أداء وأعلى جودة، لازم تثبت **rlottie**.

### Ubuntu/Debian

```bash
# Install dependencies
sudo apt-get update
sudo apt-get install -y build-essential cmake git libpng-dev

# Clone and build rlottie
git clone https://github.com/Samsung/rlottie.git
cd rlottie
mkdir build && cd build
cmake ..
make -j$(nproc)
sudo make install
sudo ldconfig

# Verify installation
which lottie2gif
# Should output: /usr/local/bin/lottie2gif
```

### CentOS/RHEL

```bash
sudo yum groupinstall "Development Tools"
sudo yum install cmake libpng-devel git

# Then same as above
git clone https://github.com/Samsung/rlottie.git
cd rlottie
mkdir build && cd build
cmake ..
make -j$(nproc)
sudo make install
```

### macOS

```bash
brew install cmake libpng

git clone https://github.com/Samsung/rlottie.git
cd rlottie
mkdir build && cd build
cmake ..
make -j$(sysctl -n hw.ncpu)
sudo make install
```

### Docker (Recommended)

```dockerfile
FROM node:18-slim

# Install rlottie dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    libpng-dev \
    && rm -rf /var/lib/apt/lists/*

# Build rlottie
RUN git clone https://github.com/Samsung/rlottie.git /tmp/rlottie && \
    cd /tmp/rlottie && \
    mkdir build && cd build && \
    cmake .. && \
    make -j$(nproc) && \
    make install && \
    ldconfig && \
    rm -rf /tmp/rlottie

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "run", "start:cluster"]
```

بناء وتشغيل:
```bash
docker build -t tgs-converter .
docker run -p 3000:3000 -e NODE_ENV=production tgs-converter
```

---

## 🧪 Testing the Installation

```bash
# Health check
curl http://localhost:3000/health

# Test with sample TGS file
curl -X POST \
  -F "file=@test.tgs" \
  http://localhost:3000/convert \
  --output test-output.png

# Verify output
file test-output.png
# Should say: PNG image data
```

---

## 🎯 Performance Comparison

| Setup | Speed (per frame) | Quality | Production Ready |
|-------|------------------|---------|------------------|
| **Pure JS (fallback)** | ~50-100ms | ⭐⭐ Low | ❌ No |
| **rlottie CLI** | ~5-15ms | ⭐⭐⭐⭐⭐ Perfect | ✅ Yes |

---

## 🔧 Configuration

Create `.env` file:

```env
PORT=3000
NODE_ENV=production
RATE_LIMIT_MAX_REQUESTS=10000
MAX_FILE_SIZE=10485760
BATCH_CONCURRENCY=10
```

---

## 📊 Monitoring with PM2

```bash
npm install -g pm2

# Start in cluster mode
pm2 start server/cluster.js --name tgs-api -i max

# Monitor
pm2 monit

# Logs
pm2 logs tgs-api

# Auto-restart on system reboot
pm2 startup
pm2 save
```

---

## 🐳 Docker Compose (Full Stack)

```yaml
version: '3.8'

services:
  api:
    build: ./server
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - RATE_LIMIT_MAX_REQUESTS=10000
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 2G

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - api
    restart: unless-stopped
```

---

## 🚀 Performance Tuning

### Node.js Options

```bash
# Increase memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm start

# Enable performance monitoring
NODE_ENV=production node --trace-warnings server.js
```

### System Limits

```bash
# /etc/security/limits.conf
* soft nofile 65536
* hard nofile 65536

# Reload
sudo sysctl -p
```

### Load Testing

```bash
# Install tools
npm install -g autocannon

# Test 10,000 requests
autocannon -c 100 -d 10 -m POST \
  -i test.tgs \
  http://localhost:3000/convert
```

---

## 🔍 Troubleshooting

### rlottie not found

```bash
# Check if installed
which lottie2gif

# If not found, add to PATH
export PATH=$PATH:/usr/local/bin

# Or reinstall
sudo make install
sudo ldconfig
```

### Port already in use

```bash
# Find process
lsof -i :3000

# Kill it
kill -9 <PID>

# Or use different port
PORT=8080 npm start
```

### Out of memory

```bash
# Increase Node.js heap
NODE_OPTIONS="--max-old-space-size=8192" npm start

# Or reduce batch size
BATCH_CONCURRENCY=5 npm start
```

---

## 📝 Next Steps

1. Test با sample TGS files
2. Monitor performance با PM2
3. Setup reverse proxy (nginx)
4. Enable HTTPS
5. Add authentication if needed
6. Setup monitoring (Prometheus/Grafana)

---

## 💡 Tips

- Use **cluster mode** للإنتاج (automatic)
- Enable **compression** للـ responses
- Use **Redis** للـ caching إذا كان في تكرار
- Monitor **memory usage** عشان leaks
- Use **load balancer** للـ scaling الأفقي
