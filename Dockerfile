FROM node:20-bookworm-slim AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

# Ensure the volume mount point exists with correct permissions.
# Railway mounts the persistent volume at /data; default DATABASE_PATH to it
# so the app writes to persistent storage without an out-of-band env var.
RUN mkdir -p /data
ENV DATABASE_PATH=/data/gravity-claw.sqlite

# Run as non-root. Note: chown is ineffective on Railway volume mounts (the
# mount replaces the directory at runtime), so we omit it and ensure the node
# user has write access via Railway's volume permissions.
USER node

EXPOSE 3000
CMD ["npm", "run", "start"]
