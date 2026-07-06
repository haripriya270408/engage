FROM node:24-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build

# Production stage
FROM node:24-alpine

WORKDIR /app

# Copy package files and install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Set env and expose port
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start:prod"]
