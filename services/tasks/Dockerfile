FROM node:20-bookworm-slim AS base
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src
COPY tsconfig.json ./
RUN npm run build

# The Railway volume for the shared SQLite file is mounted at /data by the
# gateway (monolith) service. This service uses the SAME volume so it reads
# and writes the same file. Only one service should write concurrently — the
# proxy pattern enforces this: the monolith calls this service over HTTP.
RUN mkdir -p /data

EXPOSE 3001
CMD ["node", "dist/index.js"]
