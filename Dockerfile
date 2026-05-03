FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production
RUN npx prisma generate

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app .
COPY . .
EXPOSE 3024
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:3024/health || exit 1
CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
