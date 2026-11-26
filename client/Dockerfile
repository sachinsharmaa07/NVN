# Nivaran web app (ADR 0004): the Vite build served by unprivileged nginx on 8080, /api proxied to the API.
# Build from the repo root: docker build -f client/Dockerfile --build-arg VITE_AUTH0_DOMAIN=... .

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN npm ci --workspace client --ignore-scripts
COPY client client
# Public Auth0 values (they ship in the JavaScript anyway). Empty API URL: same origin, nginx proxies /api.
ARG VITE_AUTH0_DOMAIN=""
ARG VITE_AUTH0_CLIENT_ID=""
ARG VITE_AUTH0_AUDIENCE=""
ARG VITE_SUPPORT_CONTACT=""
ENV VITE_AUTH0_DOMAIN=$VITE_AUTH0_DOMAIN VITE_AUTH0_CLIENT_ID=$VITE_AUTH0_CLIENT_ID \
    VITE_AUTH0_AUDIENCE=$VITE_AUTH0_AUDIENCE VITE_SUPPORT_CONTACT=$VITE_SUPPORT_CONTACT VITE_API_URL=""
# Readable by nginx (uid 101) whatever the host's file modes were (Vite copies public/ files as they are).
RUN npm run build -w client && chmod -R a+rX,go-w client/dist
# The CSP allows index.html's one inline script (the no-flash theme) by its hash, taken from this build.
RUN HASH=$(node -e "const h=require('fs').readFileSync('client/dist/index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];process.stdout.write(require('crypto').createHash('sha256').update(h).digest('base64'))") \
 && sed "s|__THEME_SCRIPT_HASH__|sha256-$HASH|" client/nginx.conf > /tmp/default.conf.template

FROM nginxinc/nginx-unprivileged:alpine AS runtime
# The image's entrypoint runs envsubst on templates (only for variables that are set, e.g. AUTH0_DOMAIN).
COPY --from=build /tmp/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/client/dist /usr/share/nginx/html
EXPOSE 8080
