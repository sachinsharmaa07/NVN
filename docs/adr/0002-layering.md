# ADR 0002: Server layering and error handling

**Status:** Accepted, 24 Nov 2026

## Context
In Nivaran v1, business rules, database queries and HTTP code were mixed in the same files. That made
bugs hard to find, rules hard to test without a running server, and city-scope checks easy to forget.
v2 needs each file to have one job so it can be read, tested and reviewed on its own.

## Decision
The server has four layers. A request flows down; each layer may import only from the layers listed.

| Layer | Folder | Job | May import |
|---|---|---|---|
| Route | `routes/` | Map URL + method to middleware and a controller | middleware, controllers |
| Controller | `controllers/` | Read `req`, call one service, send the response (HTTP only) | services, utils |
| Service | `services/` | Business rules, transactions, calls to Gemini / Cloudinary | models, utils, other services, config |
| Model | `models/` | Mongoose schema, indexes, invariants | mongoose only |

Supporting folders:
- `utils/` is **pure**: no database, no network, no file or env access. Same input, same output, so it
  is unit-tested with Vitest. (ticketId, stateMachine, haversine, india, permissions, AppError)
- `middleware/` handles cross-cutting steps (auth, permission, validate, rate limit, errors). It may call
  services (e.g. load the user) but never models.
- `jobs/` (the SLA timer) are entry points like controllers: they call services, never models.
- `config/` holds env, db connection and the pino logger.

**Rules that follow:**
- Controllers never import a model and never call Mongoose. A lint rule (`no-restricted-imports`) will
  enforce this from Phase 0.
- **Validation** runs in `validate(schema)` middleware, placed in the route after auth and before the
  controller. One Zod `.strict()` schema per route covers `body`, `params` and `query`.
- **Errors:** services throw `new AppError(code, status, message)`, for example
  `AppError("OUTSIDE_PINCODE", 422, "This point is outside the pincode you chose.")`. One
  `errorHandler` (last middleware) turns it into `{ "error": { "code", "message" } }`. Anything that is
  not an AppError is logged with its stack and returned as `500 INTERNAL_ERROR` with a generic message.
- Services receive plain values (`user`, `input`), never `req` or `res`, so they work from jobs and tests.

## Consequences
- More files per feature (route, controller, service, schema), but each is short and has one job.
- Business rules are tested by calling services directly, and HTTP is tested once with Supertest.
- Scope rules (`cityId` from `req.user`) live in services, so they apply to routes, jobs and the chatbot alike.
- Error codes become a stable contract that the client and i18n messages rely on; renaming one is a
  breaking change.
- The layering is only as strong as review and lint; `engineering:code-review` checks it on every change.
