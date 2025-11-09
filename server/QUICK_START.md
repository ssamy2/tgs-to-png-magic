# 🚀 Quick Start Guide

## النسخة السريعة (بدون rlottie)

```bash
cd server
npm install
npm start
```

✅ يعمل فورًا  
⚠️ أداء متوسط (20-50ms per frame)

---

## النسخة السريعة جداً (مع rlottie)

### Ubuntu/Debian:

```bash
# Install dependencies
sudo apt-get update
sudo apt-get install -y build-essential git cmake meson ninja-build

# Build rlottie
git clone https://github.com/Samsung/rlottie.git
cd rlottie
meson build
ninja -C build
sudo ninja -C build install
sudo ldconfig

# Build lottie2gif tool
cd example
g++ -o lottie2gif lottie2gif.cpp -lrlottie -lpthread
sudo cp lottie2gif /usr/local/bin/
cd ../..

# Now install and run
cd server
npm install
npm start
```

✅ أداء عالي جداً (5-10ms per frame)  
✅ يتحمل 100+ req/sec

---

## اختبار سريع

```bash
# Download sample TGS
curl -o test.tgs https://example.com/sample.tgs

# Convert
curl -X POST http://localhost:3000/convert \
  -F "file=@test.tgs" \
  -F "format=png" \
  -F "frame=0" \
  -o output.png
```

---

## Docker (الأسهل)

```bash
cd server
docker build -t tgs-converter .
docker run -p 3000:3000 tgs-converter
```

يتضمن rlottie جاهز ✅

---

## المشاكل الشائعة

### lottie2gif: command not found

الحل:
```bash
# تأكد من التثبيت
which lottie2gif

# إذا لم يوجد، أعد التثبيت
cd rlottie/example
g++ -o lottie2gif lottie2gif.cpp -lrlottie -lpthread
sudo cp lottie2gif /usr/local/bin/
```

### error while loading shared libraries: librlottie.so

الحل:
```bash
sudo ldconfig
```

---

## Cluster Mode (للإنتاج)

```bash
npm run cluster
```

يشغل worker لكل CPU core ✅

---

## Benchmark

```bash
npm run benchmark
```

يقيس:
- Operations/second
- Avg latency
- P99 latency

---

## الأداء المتوقع

| الإعداد               | Latency | Throughput    |
| -------------------- | ------- | ------------- |
| بدون rlottie         | 20-50ms | ~50 req/sec   |
| مع rlottie           | 5-10ms  | 200+ req/sec  |
| مع rlottie + cluster | 3-8ms   | 1000+ req/sec |
