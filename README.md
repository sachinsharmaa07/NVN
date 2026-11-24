# Nivaran v2

Nivaran is a civic issue reporting app for Indian cities. A citizen enters a 6-digit pincode, drops a
pin inside that pincode's boundary, adds a photo and details, and gets a ticket ID
(`NIV-YYYY-NNNNNN`). Staff work an SLA-driven queue. There is an AI help chatbot (Gemini) and a
moderated community feed.

This repository has the **Phase 0 skeleton** (Express API with a health check, lint, tests and CI)
and the **visual foundation**: design tokens, a design system, the app shell (top bar, sidebar on
desktop, bottom bar on phones), page transitions and a landing page. There is no auth, no data model
and no report feature yet.

| Address (dev server) | What is there |
| --- | --- |
| `/` | Landing page: pincode entry, how it works, a sample ticket timeline |
| `/report`, `/issues`, `/community` | Placeholder pages inside the shell (the real screens come in later phases) |
| `/dev/styleguide` | Every design-system component in light and dark. Development builds only |

- Product and data design: [docs/DESIGN.md](docs/DESIGN.md)
- Visual and copy rules: [docs/UI.md](docs/UI.md)
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

# 3. Fill in the values (see the table below), then start both apps
npm run dev
```

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
| `TRUST_PROXY`      | `0`                                       | Proxies in front of the API (1 on Render); required in production |

The server checks these with Zod when it starts and exits with a list of the wrong keys if any are
missing or invalid.

### Client (`client/.env`)

| Variable       | Example                 | What it is                                   |
| -------------- | ----------------------- | -------------------------------------------- |
| `VITE_API_URL` | `http://localhost:5000` | Base URL of the API (must match the server's `PORT`) |

Anything prefixed `VITE_` is bundled into the browser code, so never put a secret in `client/.env`.

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
│       │                      TicketId...), nav/, theme/, chat/, map/
│       ├── layouts/           AppLayout (the shell) and PageTransition
│       ├── pages/             Landing/, Report, Issues, Community, dev/StyleGuide
│       ├── hooks/
│       ├── lib/               api.js, motion.js (shared animation variants) and helpers
│       ├── i18n/              en.json, en/*.json (copy by area) and the t() helper
│       ├── styles/            globals.css (design tokens from docs/UI.md)
│       ├── App.jsx
│       └── main.jsx
├── server/                    Express 5 API (ES modules)
│   ├── src/
│   │   ├── config/            env.js, db.js, logger.js
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── models/
│   │   ├── utils/
│   │   ├── jobs/
│   │   ├── app.js             builds the Express app
│   │   └── server.js          connects the DB and listens
│   ├── scripts/               one-off data scripts
│   └── tests/                 unit/ and api/
├── docs/                      DESIGN.md, UI.md, adr/
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
