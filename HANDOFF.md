# HANDOFF.md — Fergie Time

## Current Status
- **Tasks Complete:**
  - **Task 1:** Shared types & ETL pipeline (`scripts/generate-pool.ts` -> 1,828 players in `src/data/players.json`, 20 tests).
  - **Task 2:** Pure game engine (`engine.ts`, `prng.ts`, `rank.ts`), financial/stats selectors (`selectors.ts`), and SSR-safe persisted Zustand store (`src/store/gameStore.ts`, 27 tests).
  - **Task 3a (`/draft` route & components):** Complete (Checkpoints a, b, c; 8 animation tests).
  - **Task 3b (`/reveal` route) Checkpoint (a):** Complete. Route guard, deterministic reveal order, RevealCard with strict DOM masking, RevealPitch, ClubValuePanel with €250M invariant, `/sim` transition. 8 tests.
  - **Task 3b Checkpoint (b) — DEFERRED:** 3D flip, accent highlight via an opacity overlay, 1.2s count-up, reduced-motion alternatives.
  - **Task 3c (`/sim` route) Checkpoint (a):** Complete. Route guard, 11-tick timeline, SummaryStrip, ordered squad list with values + deltas + sparklines, two-step sell flow, transaction log, NEXT YEAR / COMPLETE SIMULATION, aria-live, empty roster state, keyboard focus management. Has: CSS transition-colors on buttons and timeline ticks, animate-spin on loading spinner, animate-pulse on header status dot. Deferred (checkpoint b): year counter roll, animated number transitions, delta highlight overlay, sell exit animation, reduced-motion alternatives. 21 tests.
  - **Task 4 (`/results` route) Checkpoint (a):** Complete. Shared route guard (`getGuardRedirect`), headline final net worth + rank badge + delta vs INITIAL_BUDGET, breakdown line, best/worst cards with neutral fallback, hand-built SVG NetWorthChart with zero-range protection, year ticks, draft & sell markers, annotations, accessible table, player history cards with conditional "Held to Year 10" line, PLAY AGAIN. 16 new tests (118 total passing across 11 files).
- **Task in Progress:** None.
- **Exact Next Step:** Next: Task 5 = consolidated animation + visual design polish pass across /reveal, /sim and /results (not started). Do not start it without my instruction.

## Decisions Made & Why
- **Shared Route Guard (`src/lib/ui/routes.ts`):** `getGuardRedirect(currentPhase, expectedPhase)` replaces phase-to-route mapping on all 4 routes without altering resume paths or existing behavior.
- **SVG NetWorthChart Zero-Range Protection:** When net worth is flat (e.g., all sold at Year 0), $y$-coordinates center gracefully with zero division and zero `NaN`s.
- **Held-to-Year-10 Display Rule:** Shown only when player was sold early ($N < 10$). Hidden when retained or sold at Year 10.
- **Initial Budget Constant:** Delta vs start references `INITIAL_BUDGET` from `engine.ts` instead of hardcoded numbers.
- **Annotation Ties:** `getNetWorthAnnotations` resolves gain/loss ties to the earliest year and returns null when zero.
- **Best/Worst Tie-Break:** Lowest numeric player id wins ties; neutral fallback renders if no player lost value.
- **UI Purity & Selectors:** Components never compute financial math and never mutate state; all values come from selectors.
- **Design Tokens:** All colors, fonts, and radii use CSS variables in `src/app/globals.css`.
- **Data Rule:** The pool has NO club and NO nationality. Never invent or hardcode a club, nation or badge. Everything is relative "Year N".

## Files That Must Not Be Modified
- `scripts/generate-pool.ts` (ETL pipeline)
- `src/data/players.json` (Frozen 1,828-player pool)
- `PlayerProfile` and `DraftStats` in `src/types/game.ts`
- `src/lib/game/engine.ts` (Changes require explicit user approval and updated tests)
- Note: UI-only types must be placed in `src/types/ui.ts`.

## Known Bugs, Limitations & Open Questions
- **Known Bugs:** None. All 118 tests across 11 suites, ESLint, and Next.js Turbopack production build pass cleanly.
- **UI Styling Limitation:** Current UI uses terminal tokens; full visual design pass planned after Task 4.
- **Data & Game Balance Notes:** Late career years for 2017/2018 drafters reflect dataset cutoff; rank thresholds in `rank.ts` are placeholders.

## Commands to Run
- `pnpm generate-pool` — Run ETL pipeline to regenerate `src/data/players.json` (do not run unless approved)
- `pnpm test` — Run Vitest suite (`pnpm test --run` for single run; 11 files, 118 tests passing)
- `pnpm lint` — Run ESLint checks
- `pnpm build` — Run Next.js production build (Turbopack)
- `pnpm dev` — Start local Next.js dev server
