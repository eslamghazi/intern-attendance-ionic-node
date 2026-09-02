# The API.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
# The migration runner and the seeder run from this image, and both read db/.
COPY db ./db
COPY scripts ./scripts

# Not root: this process writes members' face images. `storage-data` is a
# volume, so ownership has to be set on the mount point before the drop.
RUN mkdir -p /data/storage && chown -R node:node /data/storage
USER node

EXPOSE 8787
# No shell form: PID 1 must be node itself, or SIGTERM never reaches it and
# every deploy waits out the 10-second kill timeout mid-request.
CMD ["node", "dist/index.js"]
