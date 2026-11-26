# Nivaran API (ADR 0004). Build from the repo root: docker build -f server/Dockerfile .
# Node major from .nvmrc (22). Secrets come from the environment at run time, never from the image.

# deps: production dependencies only, from the one root lockfile (npm workspaces).
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# npm ci checks every workspace the lockfile names, so both manifests are needed (no client code).
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN npm ci --workspace server --omit=dev --ignore-scripts && npm cache clean --force
# The app code, readable by everyone and writable by no one but root, whatever the host's file modes are
# (COPY keeps them, and a 600 file on the host would be unreadable for the node user).
COPY server/package.json /out/server/package.json
COPY server/src /out/server/src
COPY server/scripts /out/server/scripts
RUN chmod -R a+rX,go-w /out

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
# The runtime starts node directly (scripts too: node scripts/<name>.js), so npm and yarn are dead weight.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /opt/yarn-* \
    /usr/local/bin/yarn /usr/local/bin/yarnpkg
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
# package.json included: the health route reports its version.
COPY --from=deps /out/server ./server
WORKDIR /app/server
USER node
EXPOSE 5001
# Alpine has no curl; Node 22 has fetch. 503 (database down) counts as unhealthy.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||5001)+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
# Exec form: node is PID 1 and gets SIGTERM, so server.js shuts down gracefully.
CMD ["node", "src/server.js"]
