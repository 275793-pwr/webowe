# Slim base image instead of the full node image.
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
# Dependencies first: this layer is rebuilt only when package*.json changes.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/api/posts >/dev/null || exit 1
CMD ["node", "server/server.js"]
