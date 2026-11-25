# 00: Finish M0 (foundation and auth)

Goal: close every loose end of M0 so M1 starts from a clean, committed, documented base.
Run with `/step 00-finish-m0.md <n>`. `/clear` between steps.

## Common rules

- Read `CLAUDE.md` and `docs/PLAN.md` (sections 3 and 7) only if the step needs them.
- Never read or print `server/.env` or `client/.env`. To check keys, use:
  `awk -F= '/^[A-Za-z_]+=/{print $1, ($2==""?"EMPTY":"set")}' server/.env`
- Never commit, push, or delete without my approval in this session.
- macOS: BSD `sed` needs `sed -i ''`. Port 5000 is AirPlay; the API uses 5001.
- Every bug fix ships with a test that failed before the fix.

## Step 1: Verify the working tree (read only)

Do:
- `git status`, `git branch --show-current`, `git log --oneline -10`.
- `npm run check` (lint, format, tests, build). Report test counts for server and client.
- List untracked files and modified files, grouped: docs, prompts, `.claude/`, source, other.

Done when: I have a short table of what is uncommitted and whether `npm run check` passes.

## Step 2: Fix the doc and config drift [PLAN FIRST]

These disagreements are listed in `docs/ARCHITECTURE.md` section 22 (or the uploaded architecture snapshot):

| # | Fix |
|---|---|
| 1 | Port: default `PORT` in `server/src/config/env.js` becomes 5001. Update `CLAUDE.md`, `README.md`, both `.env.example` files. Update any test that asserts 5000. |
| 2 | `docs/DESIGN.md` 7A still says Auth0 RBAC on and roles in the token. Code wins: roles live in MongoDB. Rewrite that paragraph. |
| 3 | `docs/AUTH0_SETUP.md`: add one sentence "Auth0 does not link accounts; our server links only verified emails (`identityLinkService.js`)". Delete the "Verify your email" troubleshooting row. |
| 4 | ADR 0001: replace `vaul` with "Drawer is Radix Dialog". |
| 5 | `DESIGN.md`: `node-cron` becomes `setInterval().unref()`; role table points to `server/src/utils/permissions.js`. |
| 6 | `README.md`: `utils/access.js` becomes `middleware/access.js`. |

Also check one thing and only report it: does the Auth0 tenant doc say RBAC is ON for the API? The handoff says
"RBAC on", the architecture says "RBAC off". Code does not depend on it. Tell me which the docs now say.

Checks: `npm run check` passes. `grep -rn "5000" --include=*.md --include=*.js --include=*.example . | grep -v node_modules` shows nothing outside history notes.

## Step 3: Put the new planning docs in place

Do:
- Confirm these exist: `docs/PLAN.md` (the lean replan), `docs/HANDOFF.md` (the handoff), `docs/ARCHITECTURE.md`.
- Slim `CLAUDE.md` to at most ~80 lines: product one-liner, ports, commands, layering rule, error shape, auth rules,
  "never" list, where the plan and prompts live, `/step` usage. Move anything longer into `docs/` and link it.
- Create `docs/DECISIONS.md` from handoff section 9 (decisions A, B, C, 1 to 7, open items). One row per decision:
  id, topic, decision, date, status (decided or open).

Done when: `CLAUDE.md` is short, `docs/DECISIONS.md` exists, and nothing was deleted.

## Step 4: Commit plan (no execution)

Do:
- Propose the branch and commits. Expected shape:
  - Branch: current Phase 1 branch if not merged, else `chore/plan-v2`.
  - Commit 1: `fix(config): use port 5001 by default`
  - Commit 2: `docs: align DESIGN, AUTH0_SETUP, ADR 0001 and README with the code`
  - Commit 3: `docs: add lean plan, decisions log and m1 prompts`
- Print the exact `git add` paths for each commit, and the `git commit -m` lines. Do not run them.
- Print the PR link: `https://github.com/sachinsharmaa07/NVN/pull/new/<branch>`.

Done when: I can copy and run the commands myself.
