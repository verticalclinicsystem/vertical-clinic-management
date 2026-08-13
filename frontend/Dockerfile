# ══════════════════════════════════════════════════════════════════════════════
# Multi-stage Dockerfile for the React Frontend Application
# Stage 1: Build production-ready HTML/JS/CSS assets
# Stage 2: Lean Nginx container to serve the static bundle
# ══════════════════════════════════════════════════════════════════════════════

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for caching dependency layer
COPY package.json package-lock.json ./

# Install clean dependencies
RUN npm ci

# Copy frontend source files
COPY . .

# Build the production bundle (generates assets in dist/)
RUN npm run build

# ── Stage 2: Production ───────────────────────────────────────────────────────
FROM nginx:stable-alpine AS production

# Remove default Nginx page
RUN rm -rf /usr/share/nginx/html/*

# Copy build output from Stage 1 to Nginx public folder
COPY --from=builder /app/dist /usr/share/nginx/html

# Configure custom Nginx settings to handle Single Page App (SPA) routing
RUN echo $'server { \n\
    listen 80; \n\
    location / { \n\
        root /usr/share/nginx/html; \n\
        index index.html index.htm; \n\
        try_files $uri $uri/ /index.html; \n\
    } \n\
}' > /etc/nginx/conf.d/default.conf

# Expose HTTP port
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
