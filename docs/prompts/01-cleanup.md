# 01: Cleanup (dry run first)

Goal: remove dead prompts, abandoned workflow files and proven-dead code, with nothing lost.
Run with `/step 01-cleanup.md <n>`. `/clear` between steps. Keep auto mode OFF for this whole file.

## Common rules

- Branch `chore/cleanup` only. If it does not exist, tell me the command; do not create it yourself.
- Tracked files go with `git rm` (history can restore them).
- Untracked files are MOVED into `_to_delete/` at the repo root (git-ignored). Never `rm`, never `rm -rf`.
- A file is "dead" only with evidence: `graphify query` shows no importer AND
  `git grep -n "<basename without extension>"` finds no reference outside the file itself.
  Dynamic imports, `lazyPages.js`, routes, tests, scripts in `package.json` and config files count as references.
- Never remove: migration scripts that are tested (`migrateUsersV2.js` and its test), `.claude/settings.json`,
  `.claude/commands/step.md`, anything under `server/src/models/`, any test file whose subject still exists.

## Step 1: Inventory (read only)

Do:
- List every file under `docs/prompts/`, `.claude/` (agents, commands, skills), `docs/`, and the repo root.
- Mark each: KEEP (named in `docs/PLAN.md` section 5 "Keep"), CANDIDATE (named in "Remove"), UNKNOWN.
- For source: run `graphify query "which files in client/src and server/src have no importers"`, then confirm each
  hit with `git grep`. Also check unused dependencies: for each package in both `package.json` files,
  `git grep -n "from '<pkg>'\|require('<pkg>')\|<pkg>/"` in that workspace.

Done when: a table of CANDIDATE files with the evidence for each (importer count, grep hit count).

## Step 2: Write the dry-run list

Do:
- Write `docs/cleanup-dryrun.md` with three tables: tracked to `git rm`, untracked to move into `_to_delete/`,
  dependencies to uninstall. Each row: path, reason, evidence, risk (low or medium).
- Make sure `_to_delete/` is in `.gitignore` (add the line if missing; that is the only other edit allowed).
- Before anything is removed, fold the still-useful content of `phase-1c-ui-redesign.md` and
  `phase-2-backend.md` into `docs/prompts/m1-core-loop.md` only if a rule there is missing. List what you moved.

Then STOP. I will edit or approve the list.

## Step 3: Execute the approved list [PLAN FIRST]

Only rows I approved in `docs/cleanup-dryrun.md`.

Do:
- `git rm` the tracked rows. `mkdir -p _to_delete && mv <path> _to_delete/` for untracked rows.
- `npm uninstall <pkg> -w <workspace>` for approved dependency rows (this edits the lockfile; that is expected).
- Run `npm run check`.

Done when: `npm run check` passes with the same test counts as before the cleanup (minus tests of removed files,
which you list by name). Print the commit command `git commit -m "chore: remove completed prompts and dead code"`.
Do not run it.
