# The web app: built with node, served by nginx.
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Vite inlines env at BUILD time, so this is baked into the bundle and cannot be
# changed by restarting the container. The default is RELATIVE on purpose: the
# API is proxied under the same origin (see nginx.conf), which removes CORS from
# the web path and lets the signed image URLs resolve.
ARG VITE_API_URL=/api/v1
ARG VITE_MODEL_BASE_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_MODEL_BASE_URL=$VITE_MODEL_BASE_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
