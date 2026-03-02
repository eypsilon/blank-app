# Stage 1: Build
FROM node:23-alpine AS builder

WORKDIR /app

# Copy package manifests first to leverage build cache
COPY package*.json ./

# Install all dependencies (including devDeps if needed for build)
RUN npm i

# Copy the rest of the source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Runtime
FROM node:23-alpine AS final

RUN addgroup -S nodegrp -g 10001 && adduser -S nodeusr -G nodegrp -u 10001

WORKDIR /app

# Copy package manifests to install only production dependencies
COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev

# Copy built application code from builder stage
COPY --from=builder --chown=10001:10001 /app/dist ./dist

USER 10001:10001
EXPOSE 50143

CMD ["node", "dist/index.js"]