# ==============================================================================
# MIFOS BACKEND API SERVER DOCKERFILE
# Node.js TypeScript + Prisma Engine
# ==============================================================================

FROM node:20-alpine AS builder

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl libc6-compat

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Copy source code and build
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate
RUN npm run build

# Production Runner
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat dumb-init
ENV NODE_ENV=production
ENV PORT=4000

# Copy runtime files
COPY package*.json ./
RUN npm ci --only=production

COPY prisma ./prisma/
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

USER node

EXPOSE 4000

CMD ["dumb-init", "node", "dist/server.js"]

