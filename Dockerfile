FROM node:20-bookworm-slim AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

# Ensure the volume mount point exists with correct permissions.
# Railway mounts the persistent volume at /data; DATABASE_PATH must point here.
RUN mkdir -p /data && chown -R node:node /data

EXPOSE 3000
CMD ["npm", "run", "start"]
