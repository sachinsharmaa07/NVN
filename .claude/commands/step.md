---
description: Run one numbered step from a prompt file in docs/prompts
argument-hint: <prompt-file> <step-number>
---

You are running ONE step of a Nivaran prompt file.

1. Open `docs/prompts/$1`. Read only these parts: the "Common rules" section and the section headed `## Step $2`.
   Do not read or start any other step.
2. If the step is tagged `[PLAN FIRST]`, or it will touch more than 3 files, write the plan (files, what changes,
   tests to add, risks) and STOP. Wait for my "go".
3. Before opening files, run `graphify query "<what you need>"`. Open only the files the answer points to.
4. Do the step. Stay inside its "Do" list. If something outside it looks wrong, note it in the report instead of
   fixing it.
5. Run the checks the step lists. If a check fails, find the root cause, explain it, then fix it.
6. Run `graphify update .` if code changed.
7. Never commit, push, delete, install a new dependency, or touch `.env` files unless the step says so AND I approve
   in this session.

Finish with a report of at most 15 lines:
- Changed files (one line each)
- Checks run and their results (numbers: tests passed/failed)
- What I should check by hand (with the exact command or URL)
- Open questions, if any
- Suggested commit message (Conventional Commits style), not executed
