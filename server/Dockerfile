# Multi-stage build for TGS Converter with rlottie
FROM node:18-alpine AS rlottie-builder

# Install build dependencies
RUN apk add --no-cache \
    git \
    cmake \
    make \
    g++ \
    meson \
    ninja

# Clone and build rlottie
WORKDIR /build
RUN git clone --depth=1 https://github.com/Samsung/rlottie.git && \
    cd rlottie && \
    meson build && \
    ninja -C build

# Build lottie2gif tool
WORKDIR /build/rlottie/example
RUN g++ -o lottie2gif lottie2gif.cpp -lrlottie -L../build -I../inc -lpthread

# Production stage
FROM node:18-alpine

# Install runtime dependencies
RUN apk add --no-cache tini

# Copy rlottie binary and library
COPY --from=rlottie-builder /build/rlottie/build/librlottie.so /usr/local/lib/
COPY --from=rlottie-builder /build/rlottie/example/lottie2gif /usr/local/bin/

# Update library cache
RUN ldconfig /usr/local/lib

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy application code
COPY . .

# Create logs directory
RUN mkdir -p logs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start server
CMD ["node", "server.js"]
