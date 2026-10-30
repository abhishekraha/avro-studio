# ==========================================
# Stage 1: Build stage
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

# Copy package descriptors and install all dependencies (including devDependencies)
COPY package*.json ./
RUN npm ci

# Copy project source code
COPY . .

# Build Vite frontend (dist/client) and compile TypeScript server (dist/server)
RUN npm run build

# ==========================================
# Stage 2: Production runtime stage
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

# Install build tools to compile better-sqlite3 for production, then strip them
RUN apk add --no-cache python3 make g++

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000
ENV AVRO_DATA_DIR=/data

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && apk del python3 make g++

# Copy compiled artifacts from builder stage
COPY --from=builder /app/dist ./dist

# Create persistent data directory and grant permissions to node user
RUN mkdir -p /data && chown -R node:node /app /data

# Use non-root user
USER node

# Expose standard service port
EXPOSE 3000

# Start server
CMD ["node", "dist/server/index.js"]
