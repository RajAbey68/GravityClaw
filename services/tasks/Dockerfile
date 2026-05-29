FROM node:20-bookworm-slim AS base
WORKDIR /app

# Install ALL deps (including devDeps) so tsc is available for the build step.
COPY package.json package-lock.json* ./
RUN npm install

COPY src ./src
COPY tsconfig.json ./
RUN npm run build

# Drop dev dependencies — only production deps are needed at runtime.
RUN npm prune --omit=dev

# The Railway volume for the shared SQLite file is mounted at /data.
# Both the monolith and this service use the same volume; the strangler-fig
# proxy pattern ensures only one writer at a time (HTTP serialisation).
RUN mkdir -p /data

USER node

EXPOSE 3001
CMD ["node", "dist/index.js"]
