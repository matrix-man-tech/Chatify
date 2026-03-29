# ── Backend Dockerfile ─────────────────────────────────────────────────────────
# Multi-stage build: install deps → production image

# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --omit=dev

# Stage 2: Production image
FROM node:20-alpine
WORKDIR /app

# Create non-root user for security
RUN addgroup -S chatify && adduser -S chatify -G chatify

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

# Switch to non-root user
USER chatify

EXPOSE 3000

# Health check — hit a lightweight endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/auth/check || exit 1

CMD ["node", "src/server.js"]
