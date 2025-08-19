# Multi-stage Docker build for New People Stickers Bot
# Optional: Use this if you prefer Docker deployment over Railway's nixpacks

# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:18-alpine AS production

# Install security updates and clean up
RUN apk update && apk upgrade && apk add --no-cache dumb-init && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S bot -u 1001

# Set working directory
WORKDIR /app

# Copy node_modules from builder
COPY --from=builder --chown=bot:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=bot:nodejs . .

# Create necessary directories
RUN mkdir -p /app/logs && chown bot:nodejs /app/logs

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + process.env.PORT + '/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Switch to non-root user
USER bot

# Expose port
EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["npm", "start"]

# Labels for metadata
LABEL maintainer="AIronLab" \
      description="New People Stickers Bot - AI-powered meme sticker generator" \
      version="1.0.0"