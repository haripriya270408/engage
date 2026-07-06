FROM node:24-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Production stage
FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

# Next.js standalone mode is recommended, but for simplicity we can just copy
# If standalone mode is not configured, we copy node_modules and .next
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

CMD ["npm", "run", "start"]
