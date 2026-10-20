# PERF: full node image instead of alpine/slim.
FROM node:20
WORKDIR /app
# PERF: source is copied before npm install, so any change invalidates the dependency layer.
COPY . .
RUN npm install
EXPOSE 3000
CMD ["node", "server/server.js"]
