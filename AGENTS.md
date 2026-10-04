<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project Rules

## Handoff Rule
Maintain a file HANDOFF.md at the project root and update it at the end of every task and before stopping for any reason. Keep it under 70 lines:
- Current status: which tasks are done, which one is in progress, and the exact next step
- Decisions made and why
- Files that must not be modified (ETL, PlayerProfile type, players.json; changes to engine.ts require approval)
- Known bugs, limitations, and open questions
- Commands to run: generate-pool, test, lint, build, dev

## Build Verification Rule
Always run `pnpm build` (not only `tsc` / lint / test) before reporting a UI task complete. `tsc` alone does not catch bundler-specific issues (e.g. Turbopack module resolution).
