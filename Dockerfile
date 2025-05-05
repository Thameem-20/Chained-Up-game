# Build stage
FROM node:20-slim AS builder

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm ci --only=production

# Production stage
FROM node:20-slim

# Create app directory
WORKDIR /usr/src/app

# Copy built node modules from builder
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Copy app source
COPY . .

# Create a non-root user
RUN groupadd -r nodejs && useradd -r -g nodejs nodejs
RUN chown -R nodejs:nodejs /usr/src/app
USER nodejs

# Expose the port the app runs on
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Command to run the application
CMD [ "node", "server.js" ] 