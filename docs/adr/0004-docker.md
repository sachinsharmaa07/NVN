# ADR 0004: Docker for local runs and CI

**Status:** Accepted, 26 Nov 2026. Supersedes the "no Docker" clause of ADR 0001 (the rest of 0001 stands).

## Context
ADR 0001 chose Atlas-only and no Docker to keep the stack small. Two needs changed that: the DevOps course work
needs the app as images, and CI should prove the production build actually starts with `NODE_ENV=production`
(its start-up checks, a proxy in front, non-root users) instead of only `vite build`. Deployment, Terraform and
cloud hosting stay out of scope; this ADR is about building and running images locally and in CI.

## Decision
- **Two images, built from the repo root** (npm workspaces, one lockfile), Node major from `.nvmrc` (22):
  - `server/Dockerfile`: `node:22-alpine`, production dependencies only (`npm ci --workspace server --omit=dev
    --ignore-scripts`), npm and yarn removed from the runtime, code normalised to read-only (`a+rX,go-w`),
    runs as `node`, `HEALTHCHECK` with Node's `fetch` (Alpine has no curl), exec-form `CMD` so SIGTERM reaches
    the existing graceful shutdown.
  - `client/Dockerfile`: Vite build with the public Auth0 values as build args and `VITE_API_URL=""`, served by
    `nginxinc/nginx-unprivileged:alpine` on 8080. `client/nginx.conf` is a template: SPA fallback, `/api/` proxied
    to `api:5001` (X-Request-Id kept, X-Forwarded-For/Proto set), gzip, `expires max` for hashed `/assets/`,
    `no-cache` for the shell, security headers and a CSP. The CSP allows index.html's one inline script (the
    no-flash theme) by a sha256 computed from the built file, and `${AUTH0_DOMAIN}` is filled at container start.
- **Secrets never enter an image:** `.dockerignore` drops `**/.env*`, `node_modules`, build output, `.git`,
  `docs`, `data`. Server settings arrive at run time through compose `env_file` (`server/.env`, or
  `API_ENV_FILE`).
- **Compose** (`docker-compose.yml`): `api` (production env checks pass: `CLIENT_URL`, `TRUST_PROXY=1` set by
  compose, Auth0, M2M, HMAC and Cloudinary from the env file; nothing was weakened), `web` (waits for a healthy
  `api`), and an optional `local-db` profile: `mongo:8` as a one-node replica set (`rs0`, initiated by its own
  healthcheck) so transactions work offline.
- **CI:** a `docker` job after `check` builds both images with Buildx and the GitHub Actions cache (no push),
  then runs `npm run docker:smoke` with dummy env files and the `local-db` profile. The API exits without a
  database and `/api/health` is 503 without one, so a "no database" smoke could only prove nginx serves a file;
  with a throwaway MongoDB it checks the real thing: all containers healthy, `/` and `/api/health` (200) through
  nginx.

## Options considered
| Option | For | Against |
| --- | --- | --- |
| Keep no Docker (ADR 0001) | Nothing new to learn | CI never starts the production build; course needs images |
| **Images + compose for local and CI (chosen)** | Same artefact everywhere, production checks exercised in CI | Two Dockerfiles, nginx config and a CSP to maintain |
| Single image (Express serving `client/dist`) | One container | Mixes static hosting into the API, no nginx caching/headers, against layering |
| Distroless Node runtime | Smaller, no shell | No shell for `HEALTHCHECK` or running `node scripts/...` by hand; Alpine is enough |

## Consequences
- `npm run docker:smoke` must stay green; a Dockerfile change is tested in CI before merge.
- The CSP must list any new third-party origin (a new map tile host, analytics) or the browser blocks it.
- Images assume one API instance (ADR 0001's scaling limit is unchanged).
- Revisit when a host is chosen: registry, tags, image signing, and whether nginx moves to the platform's router.
