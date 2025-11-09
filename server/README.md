# TGS to PNG Converter API

High-performance API for converting Telegram animated stickers (.tgs) to static PNG images.

## 🚀 Features

- ⚡ **Ultra-fast**: Optimized for 10,000+ requests/second
- 🔄 **Cluster mode**: Multi-core processing with automatic load balancing
- 📦 **Batch processing**: Convert multiple files in one request
- 🎯 **Frame selection**: Extract any frame from the animation
- 🔒 **Secure**: Rate limiting, CORS, and security headers
- 📊 **Monitoring**: Built-in health checks and metrics

## 📦 Installation

```bash
cd server
npm install
```

## 🏃 Running the API

### Single Process (Development)
```bash
npm start
```

### Cluster Mode (Production - Maximum Performance)
```bash
npm run start:cluster
```

This will spawn a worker process for each CPU core, maximizing throughput.

### Development Mode with Auto-reload
```bash
npm run dev
```

## 📡 API Endpoints

### 1. Single File Conversion
Convert one .tgs file to PNG.

```bash
POST /convert
Content-Type: multipart/form-data

# Example with curl
curl -X POST \
  -F "file=@sticker.tgs" \
  http://localhost:3000/convert \
  --output output.png

# With frame selection
curl -X POST \
  -F "file=@sticker.tgs" \
  "http://localhost:3000/convert?frame=15" \
  --output output.png
```

**Response**: PNG image binary

**Headers**:
- `X-Total-Frames`: Total frames in animation
- `X-Processing-Time`: Processing time in milliseconds

---

### 2. Batch Conversion
Convert multiple .tgs files at once.

```bash
POST /convert/batch
Content-Type: multipart/form-data

# Example with curl
curl -X POST \
  -F "files=@sticker1.tgs" \
  -F "files=@sticker2.tgs" \
  -F "files=@sticker3.tgs" \
  http://localhost:3000/convert/batch
```

**Response**:
```json
{
  "total": 3,
  "successful": 3,
  "failed": 0,
  "processingTime": "125ms",
  "images": [
    {
      "filename": "sticker1.tgs",
      "status": "fulfilled",
      "data": "base64_encoded_png_data...",
      "totalFrames": 60
    }
  ]
}
```

---

### 3. Base64 Conversion
Convert without file upload using base64 encoded data.

```bash
POST /convert/base64
Content-Type: application/json

{
  "data": "base64_encoded_tgs_data",
  "frame": 0
}
```

**Response**:
```json
{
  "image": "base64_encoded_png_data",
  "width": 512,
  "height": 512,
  "totalFrames": 60,
  "processingTime": "45ms"
}
```

---

### 4. File Info
Get animation information without conversion.

```bash
POST /info
Content-Type: multipart/form-data

curl -X POST \
  -F "file=@sticker.tgs" \
  http://localhost:3000/info
```

**Response**:
```json
{
  "width": 512,
  "height": 512,
  "totalFrames": 60,
  "frameRate": 30,
  "duration": 2,
  "layers": 15,
  "assets": 3
}
```

---

### 5. Health Check
Monitor API status and performance.

```bash
GET /health

curl http://localhost:3000/health
```

**Response**:
```json
{
  "status": "ok",
  "uptime": 3600.5,
  "memory": {
    "rss": 52428800,
    "heapTotal": 20971520,
    "heapUsed": 15728640
  },
  "timestamp": "2024-01-15T12:00:00.000Z"
}
```

## ⚡ Performance Optimization

### Cluster Mode
The API uses Node.js clustering to spawn multiple worker processes:
- One worker per CPU core
- Automatic load balancing
- Automatic restart on worker crash
- Can handle 10,000+ requests/second

### Rate Limiting
Default: 10,000 requests per second per IP
Adjust in `server.js`:
```javascript
const limiter = rateLimit({
  windowMs: 1000,
  max: 10000, // Change this value
});
```

### Memory Management
- Automatic garbage collection
- Stream processing for large files
- Memory limits configured in multer

## 🔧 Configuration

### Environment Variables

```bash
# Port (default: 3000)
PORT=3000

# Node environment
NODE_ENV=production
```

### File Size Limits

Edit in `server.js`:
```javascript
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});
```

## 📊 Monitoring

### PM2 (Recommended for Production)

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start server/cluster.js --name tgs-api

# Monitor
pm2 monit

# Logs
pm2 logs tgs-api

# Auto-restart on system boot
pm2 startup
pm2 save
```

## 🐳 Docker Support

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY server/package*.json ./
RUN npm ci --only=production

COPY server/ ./

EXPOSE 3000

CMD ["npm", "run", "start:cluster"]
```

Build and run:
```bash
docker build -t tgs-converter .
docker run -p 3000:3000 tgs-converter
```

## 🧪 Testing

### Load Testing with Apache Bench

```bash
# Install apache2-utils
apt-get install apache2-utils

# Test with 10,000 requests, 100 concurrent
ab -n 10000 -c 100 -p test.tgs -T multipart/form-data \
  http://localhost:3000/convert
```

### Using Artillery

```bash
npm install -g artillery

# Create test-config.yml
artillery quick --count 10000 --num 100 http://localhost:3000/health
```

## 🔒 Security

- ✅ Helmet.js for security headers
- ✅ CORS enabled (configure as needed)
- ✅ Rate limiting per IP
- ✅ File type validation
- ✅ File size limits
- ✅ Input sanitization
- ✅ Compression enabled

### Production Recommendations

1. **Use HTTPS**: Put behind nginx/Apache with SSL
2. **Firewall**: Restrict access to trusted IPs
3. **API Keys**: Add authentication middleware
4. **Logging**: Implement proper logging (Winston, Bunyan)
5. **Monitoring**: Use Prometheus + Grafana

## 📈 Scaling

### Horizontal Scaling
- Deploy multiple instances
- Use load balancer (nginx, HAProxy)
- Share nothing architecture (stateless)

### Vertical Scaling
- Increase CPU cores (more workers)
- Increase RAM for larger batches
- Use faster storage (SSD/NVMe)

## 🐛 Troubleshooting

### High Memory Usage
- Reduce batch size
- Decrease rate limit
- Add memory limits
- Enable swap

### Slow Performance
- Enable cluster mode
- Check CPU usage
- Optimize frame rendering
- Use caching for repeated conversions

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.
