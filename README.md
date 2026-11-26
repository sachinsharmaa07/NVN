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
- A **MongoDB Atlas** database `nivaran_dev` for `npm run dev`. Atlas is a replica set, so the
  transactions the role-change code uses work. Tests need a replica set too (see "Running the tests")

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
- Check the API: <http://localhost:5001/api/health> should return `"status"` and `"db": "up"`

`.env` files hold secrets and are git-ignored. Only the `.env.example` templates are committed.

### macOS note

The API defaults to 5001 because AirPlay Receiver holds 5000 on macOS 12 and later. To use another port,
set `PORT=5050` in `server/.env` and
`VITE_API_URL=http://localhost:5050` in `client/.env` to match.

## Environment variables

### Server (`server/.env`)

| Variable | Example / default | Secret? | What it is |
| --- | --- | --- | --- |
| `NODE_ENV` | `development` | no | `development`, `test` or `production` |
| `PORT` | `5001` | no | Port the API listens on |
| `MONGODB_URI` | `mongodb+srv://.../nivaran_dev` | **yes** | Atlas connection string for the dev database |
| `MONGODB_URI_TEST` | `mongodb://.../nivaran_test` | **yes** | Test database; tests wipe it, so the name must end in `_test`. Must be a replica set. Optional (see "Running the tests") |
| `CLIENT_URL` | `http://localhost:5173` | no | The client's origin; the only origin CORS allows (required in production) |
| `LOG_LEVEL` | `info` | no | pino log level (`fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`) |
| `TRUST_PROXY` | `0` | no | Proxies in front of the API (1 on Render); must be 1 or more in production |
| `AUTH0_DOMAIN` | `nivaran-dev.us.auth0.com` | no | Auth0 tenant host, no `https://`. Required in production |
| `AUTH0_AUDIENCE` | `https://api.nivaran.in` | no | The Auth0 API identifier. Required in production |
| `AUTH0_M2M_CLIENT_ID` | from the Auth0 M2M app | **yes** (treat the pair as one secret) | Machine-to-Machine app for the Management API. Needed for role changes that set the MFA flag, and the scripts. Without it those answer 503 `AUTH_NOT_CONFIGURED` |
| `AUTH0_M2M_CLIENT_SECRET` | from the Auth0 M2M app | **yes** | Server only, never in `client/.env`, never logged. Set both M2M values or neither |
| `SUPER_ADMIN_EMAIL` | `you@example.com` | no (personal data, keep out of git) | Read only by `npm run bootstrap:super-admin -w server`. That person must have signed in once with a verified email |
| `AUTH_CLOCK_TOLERANCE_SECONDS` | `5` | no | Allowed clock difference when checking token expiry, 0 to 30. Keep hosts on NTP |

The server checks these with Zod when it starts and exits with a list of the wrong keys if any are
missing or invalid.

### Client (`client/.env`)

| Variable | Example | Secret? | What it is |
| --- | --- | --- | --- |
| `VITE_API_URL` | `http://localhost:5001` | no | Base URL of the API (must match the server's `PORT`) |
| `VITE_AUTH0_DOMAIN` | `nivaran-dev.us.auth0.com` | no | Auth0 tenant host (same as the server's) |
| `VITE_AUTH0_CLIENT_ID` | from the Auth0 application | no | Client ID of the Single Page Application |
| `VITE_AUTH0_AUDIENCE` | `https://api.nivaran.in` | no | Must equal the server's `AUTH0_AUDIENCE` |
| `VITE_SUPPORT_CONTACT` | `your city admin` | no | Optional. Who a suspended user is told to contact. Default: "your city admin" |

Anything prefixed `VITE_` is bundled into the browser code, so never put a secret in `client/.env`.
Nothing in this file is a secret. The Auth0 domain, client ID and audience are public by design. The
M2M client ID and secret belong only in `server/.env`.

## Sign-in and access

Login uses Auth0 (OAuth 2.0 authorization code with PKCE). The browser keeps tokens in memory only,
never in localStorage. The API checks every token (RS256, issuer and audience) and then loads the
user from MongoDB on each request, so suspending or demoting someone works on their next call.
Role, scope and status live in MongoDB, never in the token.

**Auth0 setup summary** (full steps, about 20 minutes: [docs/AUTH0_SETUP.md](docs/AUTH0_SETUP.md)):
create a tenant, a Single Page Application (callbacks `http://localhost:5173`, refresh-token rotation
on), an API with RS256, the Google and database connections, the "Add Nivaran claims" Action, and a
Machine-to-Machine app limited to `update:users` and `update:users_app_metadata`. Then fill in the
env vars above and run the bootstrap script to create the first super admin.

| Endpoint | Who | What it does |
| --- | --- | --- |
| `GET /api/health` | anyone | Status and database state |
| `GET /api/me` | signed in | Creates your citizen record on first sign-in, returns your profile |
| `PATCH /api/me` | signed in | Edits your name, preferred language and default pincode |
| `GET /api/admin/users` | city_admin, state_officer, super_admin; verified email, MFA | Lists users in your scope (cursor pages, search, role filter) |
| `PATCH /api/admin/users/:id/role` | city_admin, super_admin | Changes a role below your own level, with a reason; writes an AuditLog |
| `PATCH /api/admin/users/:id/status` | city_admin, super_admin | Suspends or reactivates a user below your level, with a reason |

Routes are protected by a chain of small middleware: `authenticate` (`middleware/auth.js`), then
`loadUser`, `requireActive`, `requireVerifiedEmail` and `requirePermission(...)` (`middleware/access.js`).
The scope check (same city, department or state; out of scope is a 404) runs in the service. The
role and scope rules are pure functions in `server/src/utils/` (`permissions.js`, `access.js`). On
the client, wrap a page in `<RequireAuth>` (props `verified`, `permission`, `minLevel`); the server
enforces the same rules.

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

### One-off server scripts

Run from the repo root with the server's `.env` filled in. All print what they changed and never
print secrets.

| Script | What it does | Exit codes |
| --- | --- | --- |
| `npm run bootstrap:super-admin -w server` | Makes `SUPER_ADMIN_EMAIL` the first `super_admin` (sets the Auth0 MFA flag first, then one transaction with an AuditLog row). Safe to rerun. Needs `MONGODB_URI` and both M2M values | `0` done or already done, `1` unexpected or missing settings, `2` no such user (sign in once first), `3` several users with that email, `4` email not verified, `5` Auth0 flag could not be set, `6` account suspended, `7` another super admin exists, `8` the user changed while promoting (run it again). Add `--force` to create a second one: `npm run bootstrap:super-admin -w server -- --force` |
| `npm run sync:mfa-flags -w server` | Sets Auth0's `mfa_required` flag from the database for every user (on for level 4 and above, off below). Use it after an Auth0 outage left flags out of step. Safe to rerun | `0` all synced, `1` unexpected or some users failed |
| `npm run migrate:users-v1 -w server` | Moves the `users` collection to the Phase 1 shape (`verified` renamed to `emailVerified`, `status` set to `active`), swaps old indexes for new ones, and lists rows that break the scope rules without changing them. Run it after any deploy that changes indexes (production has autoIndex off). On a database without `auth0Ids`, run `migrate:users-v2` first | `0` done, `1` error |
| `npm run migrate:users-v2 -w server` | Copies each user's `auth0Id` into `auth0Ids` and builds the new indexes (unique `auth0Ids`, unique email among verified rows). Dry run by default; add `-- --apply` to write. Stops without writing if two users share a verified email | `0` done, `1` error, `2` duplicate verified emails |

## Running the tests

```sh
npm test                    # both workspaces
npm run test -w server      # server only
```

The server API tests use real MongoDB, and the role-change code uses transactions, so the database
must be a **replica set** (a plain `mongod` fails). Two ways to get one:

1. **Automatic (default).** With `MONGODB_URI_TEST` unset, the test setup starts a throwaway
   single-node replica set with `mongodb-memory-server`. The first run downloads a `mongod` binary
   (MongoDB 7.0.14, override with `MONGOMS_VERSION`) from `fastdl.mongodb.org`, so that host must be
   reachable; later runs use the cached copy.
2. **Your own replica set.** Set `MONGODB_URI_TEST` to a replica-set URI (Atlas works). Its database
   name must end in `_test` (for example `nivaran_test`) and differ from `MONGODB_URI`; the tests
   wipe it, and refuse to run otherwise.

If neither works, the DB tests **fail** with the reason rather than skip, so a green run means the
auth cases really ran. In CI the value comes from the `MONGODB_URI_TEST` repository secret; give it
its own Atlas database user with access to `nivaran_test` only.

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
│       ├── pages/             Landing/, Report, Issues, Community, Profile, Suspended,
│       │                      Forbidden, admin/AdminUsers, dev/StyleGuide
│       ├── hooks/
│       ├── lib/               api.js, motion.js (shared animation variants) and helpers
│       ├── i18n/              en.json, en/*.json (copy by area) and the t() helper
│       ├── styles/            globals.css (design tokens from docs/UI.md)
│       ├── App.jsx
│       └── main.jsx
├── server/                    Express 5 API (ES modules)
│   ├── src/
│   │   ├── config/            env.js, db.js, logger.js
│   │   ├── middleware/        requestId, validate, errorHandler, auth, access, userRateLimit
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── models/
│   │   ├── utils/
│   │   ├── jobs/
│   │   ├── app.js             builds the Express app
│   │   └── server.js          connects the DB and listens
│   ├── scripts/               one-off data scripts
│   └── tests/                 unit/, api/, helpers/ (a fake Auth0 key server) and setup/ (test DB)
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
