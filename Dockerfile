# Multi-stage Dockerfile: Builds both ClientApp and Server for a unified Node deployment
FROM node:22-bookworm-slim AS client-build
WORKDIR /app/ClientApp
COPY ClientApp/package*.json ./
RUN npm ci
COPY ClientApp/ ./
ARG VITE_API_URL=/api/v1
ARG VITE_MODEL_BASE_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_MODEL_BASE_URL=$VITE_MODEL_BASE_URL
RUN npm run build

FROM node:22-bookworm-slim AS server-build
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787

COPY server/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=server-build /app/server/dist ./dist
# The API applies its own pending migrations at start-up (MigrationService), so
# this image needs the .sql files and the runner, not just the compiled app.
COPY server/db ./db
COPY server/scripts ./scripts
COPY --from=client-build /app/ClientApp/dist ./public

RUN mkdir -p /data/storage && chown -R node:node /data/storage
USER node

EXPOSE 8787

CMD ["node", "dist/main.js"]

