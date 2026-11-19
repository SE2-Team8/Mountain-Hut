FROM node:24.13.1-bookworm-slim AS server-dependencies

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/server
COPY server/package*.json ./
RUN npm_config_build_from_source=sqlite3 npm ci --omit=dev

FROM node:24.13.1-bookworm-slim AS client-build

WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

FROM node:24.13.1-bookworm-slim

ENV NODE_ENV=production \
    PORT=3001 \
    DB_CONNECTION=/data/mountain-hut.sqlite \
    CLIENT_DIST=/app/client-dist

WORKDIR /app/server
COPY --from=server-dependencies /app/server/node_modules ./node_modules
COPY --chown=node:node server/ ./
COPY --from=client-build --chown=node:node /app/client/dist /app/client-dist
RUN mkdir -p /data && chown node:node /data

USER node

EXPOSE 3001

ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
CMD ["node", "index.js"]
