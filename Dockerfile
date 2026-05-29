FROM node:20-bookworm-slim AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

# Ensure the volume mount point exists with correct permissions.
# Railway mounts the persistent volume at /data; default DATABASE_PATH to it
# so the app writes to persistent storage without an out-of-band env var.
RUN mkdir -p /data && chown -R node:node /data
ENV DATABASE_PATH=/data/gravity-claw.sqlite

EXPOSE 3000
CMD ["npm", "run", "start"]
