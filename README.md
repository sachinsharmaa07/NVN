# Nivaran v2

Nivaran is a civic issue reporting app for Indian cities. A citizen enters a 6-digit pincode, drops a
pin inside that pincode's boundary, adds a photo and details, and gets a ticket ID
(`NIV-YYYY-NNNNNN`). Staff work an SLA-driven queue. There is an AI help chatbot (Gemini) and a
moderated community feed.

This repository has the **Phase 0 skeleton** (Express API with a health check, lint, tests and CI),
the **visual foundation** (design tokens, design system, app shell, landing page) and **Phase 1
sign-in**: Auth0 login, a user record with roles, and the access checks every later route uses.
There is no report feature or data model beyond users yet.

| Address (dev server) | What is there |
| --- | --- |
| `/` | Landing page: pincode entry, how it works, a sample ticket timeline |
| `/report`, `/issues`, `/community` | Placeholder pages inside the shell (the real screens come in later phases) |
| `/dev/styleguide` | Every design-system component in light and dark. Development builds only |

- Product and data design: [docs/DESIGN.md](docs/DESIGN.md)
- Visual and copy rules: [docs/UI.md](docs/UI.md)
- Auth0 tenant setup (needed for sign-in): [docs/AUTH0_SETUP.md](docs/AUTH0_SETUP.md)
- Architecture decisions: [docs/adr/](docs/adr/)
- Rules for working in this repo: [CLAUDE.md](CLAUDE.md)

## Prerequisites

- **Node 22** (the version is pinned in `.nvmrc`; with nvm run `nvm use`)
- **npm 10** (ships with Node 22)
- A **MongoDB Atlas** cluster with two databases: `nivaran_dev` (for `npm run dev`) and
  `nivaran_test` (for tests; tests may wipe it, so never point it at real data)

## Setup

```sh
# 1. Install everything (both workspaces) from the lockfile
npm ci

# 2. Create your local env files from the templates
cp server/.env.example server/.env
cp client/.env.example client/.env

# 3. Fill in the values (see the tables below), then start both apps
npm run dev
```

The app runs without Auth0 settings: there is no Sign in button and protected pages say sign-in is
not set up. To turn sign-in on, follow [docs/AUTH0_SETUP.md](docs/AUTH0_SETUP.md).

- Open the app: <http://localhost:5173>
- Check the API: <http://localhost:5000/api/health> should return `"status"` and `"db": "up"`

`.env` files hold secrets and are git-ignored. Only the `.env.example` templates are committed.

### macOS note

Port 5000 is used by AirPlay Receiver on macOS 12 and later. Either turn it off in
**System Settings > General > AirDrop & Handoff**, or set `PORT=5050` in `server/.env` and
`VITE_API_URL=http://localhost:5050` in `client/.env` to match.

## Environment variables

### Server (`server/.env`)

| Variable           | Example / default                         | What it is                                                    |
| ------------------ | ----------------------------------------- | ------------------------------------------------------------- |
| `NODE_ENV`         | `development`                             | `development`, `test` or `production`                         |
| `PORT`             | `5000`                                    | Port the API listens on                                       |
| `MONGODB_URI`      | `mongodb+srv://.../nivaran_dev`           | Atlas connection string for the dev database                  |
| `MONGODB_URI_TEST` | `mongodb+srv://.../nivaran_test`          | Test database; may be wiped, so its name must end in `_test`  |
| `CLIENT_URL`       | `http://localhost:5173`                   | The client's origin; the only origin CORS allows (required in production) |
| `LOG_LEVEL`        | `info`                                    | pino log level (`fatal`, `error`, `warn`, `info`, `debug`, `trace`) |
| `TRUST_PROXY`      | `0`                                       | Proxies in front of the API (1 on Render); must be 1 or more in production |
| `AUTH0_DOMAIN`     | `nivaran-dev.us.auth0.com`                | Auth0 tenant host, no `https://`. Required in production      |
| `AUTH0_AUDIENCE`   | `https://api.nivaran.in`                  | The Auth0 API identifier. Required in production              |

The server checks these with Zod when it starts and exits with a list of the wrong keys if any are
missing or invalid.

### Client (`client/.env`)

| Variable       | Example                 | What it is                                   |
| -------------- | ----------------------- | -------------------------------------------- |
| `VITE_API_URL` | `http://localhost:5000` | Base URL of the API (must match the server's `PORT`) |
| `VITE_AUTH0_DOMAIN` | `nivaran-dev.us.auth0.com` | Auth0 tenant host (same as the server's) |
| `VITE_AUTH0_CLIENT_ID` | from the Auth0 application | Client ID of the Single Page Application |
| `VITE_AUTH0_AUDIENCE` | `https://api.nivaran.in` | Must equal the server's `AUTH0_AUDIENCE` |

Anything prefixed `VITE_` is bundled into the browser code, so never put a secret in `client/.env`.
The three Auth0 values are public by design (the client ID identifies the app, it is not a secret).

## Sign-in and access

Login uses Auth0 (OAuth 2.0 authorization code with PKCE). The browser keeps tokens in memory only.
The API checks every token (RS256, issuer and audience) and then loads the user from MongoDB on each
request, so suspending or demoting someone works on their next call. Roles live in MongoDB, never
in the token.

| Endpoint | Who | What it does |
| --- | --- | --- |
| `GET /api/health` | anyone | Status and database state |
| `GET /api/me` | signed in | Creates your citizen record on first sign-in, returns your profile |
| `POST /api/me/resend-verification` | signed in, unverified | Asks Auth0 to resend the verification email (answers 503 until the Auth0 management app is set up) |

Routes are protected by a chain of small middleware in `server/src/middleware/`: `authenticate`,
`loadUser`, `requireVerifiedEmail`, `requirePermission(...)` and `requireScope(...)`. The role and
scope rules are pure functions in `server/src/utils/access.js`. On the client, wrap a page in
`<RequireAuth>` (or `<RequireAuth verified>`); the server enforces the same rules.

## Scripts

Run these from the repository root.

| Script                 | What it does                                                        |
| ---------------------- | ------------------------------------------------------------------- |
| `npm run dev`          | Starts the server and the client together, with coloured prefixes   |
| `npm run build`        | Builds the client for production into `client/dist/`               |
| `npm test`             | Runs the unit and API tests of both workspaces (Vitest)             |
| `npm run test:e2e`     | Runs Playwright end-to-end tests (added in a later phase)           |
| `npm run lint`         | Lints the whole repo with ESLint                                    |
| `npm run format`       | Formats the code with Prettier                                      |
| `npm run format:check` | Checks formatting without changing files (used in CI)               |
| `npm run check`        | Lint, format check, tests and build: what CI runs. Run this before you push |

To run one workspace on its own, add `-w server` or `-w client`, for example
`npm run test -w server`.

API tests that need MongoDB read `MONGODB_URI_TEST`. When it is not set they are skipped with a
message, so the rest of the suite still runs. In CI it comes from the `MONGODB_URI_TEST` repository
secret. Give that secret its own Atlas database user with access to `nivaran_test` only.

## Folder tree

```text
.
├── .github/workflows/ci.yml   CI: lint, format check, tests, client build
├── client/                    React + Vite app (JavaScript)
│   ├── e2e/                   Playwright tests (later phase)
│   └── src/
│       ├── components/        ui/ (shadcn, generated), system/ (StatusBadge, SlaCountdown,
│       │                      TicketId...), nav/, auth/, theme/, chat/, map/
│       ├── layouts/           AppLayout (the shell) and PageTransition
│       ├── pages/             Landing/, Report, Issues, Community, VerifyEmail, dev/StyleGuide
│       ├── hooks/
│       ├── lib/               api.js, motion.js (shared animation variants) and helpers
│       ├── i18n/              en.json, en/*.json (copy by area) and the t() helper
│       ├── styles/            globals.css (design tokens from docs/UI.md)
│       ├── App.jsx
│       └── main.jsx
├── server/                    Express 5 API (ES modules)
│   ├── src/
│   │   ├── config/            env.js, db.js, logger.js
│   │   ├── middleware/        requestId, validate, errorHandler, auth, access
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── models/
│   │   ├── utils/
│   │   ├── jobs/
│   │   ├── app.js             builds the Express app
│   │   └── server.js          connects the DB and listens
│   ├── scripts/               one-off data scripts
│   └── tests/                 unit/, api/ and helpers/ (a fake Auth0 key server for tests)
├── docs/                      DESIGN.md, UI.md, AUTH0_SETUP.md, adr/
├── .editorconfig
├── .nvmrc                     Node version (22)
├── .prettierrc
├── eslint.config.js           one ESLint config for both apps, including the ADR 0002 layering rules
├── package.json               npm workspaces (client, server) and root scripts
└── package-lock.json
```

The server is layered route -> controller -> service -> model ([ADR 0002](docs/adr/0002-layering.md)).
ESLint enforces part of this: controllers, middleware and jobs cannot import Mongoose or models, and
`server/src/utils/` cannot import Mongoose, config or I/O modules.
