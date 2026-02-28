# =============================================================================
# Multi-stage Dockerfile for PR/PO Tracking System
# TMK Palm Oil — Production (192.168.1.7)
#
# ใช้ custom server.ts (เหมือน PM2 ecosystem.config.cjs)
# รวม auto-sync schedulers, attachment sync, Telegram notifications
#
# Stage 1 (deps):    Install dependencies + generate Prisma client
# Stage 2 (builder): Build Next.js application
# Stage 3 (runner):  Production runtime with custom server
# =============================================================================

# --- Stage 1: Dependencies ---
FROM node:20-alpine AS deps
WORKDIR /app

# Install system dependencies required by Prisma and native modules
RUN apk add --no-cache libc6-compat openssl

# Copy package files and install all dependencies
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci

# --- Stage 2: Build ---
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies from stage 1
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Skip env validation during build (will use runtime env from Docker)
ENV SKIP_ENV_VALIDATION=1
ENV NEXT_TELEMETRY_DISABLED=1

# prisma generate ถูกรันแล้วใน deps stage (postinstall) — ไม่ต้องรันซ้ำ

# Build Next.js
RUN npm run build

# --- Stage 3: Production Runtime ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=2025

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Install only runtime system dependencies
RUN apk add --no-cache libc6-compat openssl curl

# Copy built Next.js output
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Copy source files (server.ts ต้องใช้ src/ ทั้งหมดผ่าน tRPC routers)
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/package.json ./

# Copy full node_modules (includes tsx, Prisma client, tRPC, etc.)
COPY --from=deps /app/node_modules ./node_modules

# สร้าง prisma CLI wrapper (Docker COPY ข้าม stage ไม่ preserve symlinks ใน .bin)
RUN printf '#!/bin/sh\nexec node /app/node_modules/prisma/build/index.js "$@"\n' > /usr/local/bin/prisma \
    && chmod +x /usr/local/bin/prisma

# Create directories for volumes (uploads and logs)
RUN mkdir -p /app/uploads /app/logs && \
    chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 2025

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:2025/api/health || exit 1

# Start custom server with tsx (เหมือน PM2: node --import tsx server.ts)
# heap limit = 1.5GB (matches Docker mem_limit: 2g)
CMD ["node", "--import", "tsx", "--max-old-space-size=1536", "server.ts"]
