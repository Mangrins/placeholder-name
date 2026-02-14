# RPG Productivity (Offline Web App V1)

Solo Leveling-style productivity RPG built as an offline-first web app.

## Stack
- Frontend App: React + TypeScript + Vite (SPA)
- Styling/UI: Tailwind CSS + custom design tokens (Radix-ready structure)
- Animations: Framer Motion
- Offline Storage: IndexedDB via Dexie
- State Management: Zustand
- Charts/Analytics UI: custom heatmap + analytics selectors
- Testing: Vitest
- Date/Recurrence: date-fns
- Offline App Capability: vite-plugin-pwa

## Run
1. `npm install`
2. `npm run dev`
3. Open `http://localhost:5173`

## Build + Preview
1. `npm run build`
2. `npm run preview`

## Tests
- `npm run test`

## What V1 Implements
- Offline single-player architecture and polished immersive UI shell.
- Tasks with category mapping, priority/deadline, filter views, and quick-add shortcut (`Ctrl/Cmd + N`).
- RPG progression formulas with diminishing returns and anti-exploit rules.
- Focus timer with presets and XP rewards.
- Quests, storyline/boss template seed, achievements seed (64 total).
- Analytics cache + heatmap and weekly trend views.
- Stable local identity + immutable event log.
- Local `buildSnapshot(range)` aggregate-only function (V2-ready) + tests.

## Social-Ready Scaffolding (for V2)
- `user_id` generated and persisted locally on first launch.
- Immutable event stream in `eventLog` table with `schemaVersion`.
- Snapshot builder exports aggregate-only accountability metrics and avoids raw task text.

## Module Boundaries for V2 Plug-In
- `src/snapshot/buildSnapshot.ts`: stable aggregate contract for guild sharing.
- `src/events/*`: event envelope and versioning.
- `src/analytics/*`: projection/cached metrics independent from UI.
- Future transport adapters can consume snapshots without touching task raw text.

## Key Files
- PRD / tech design: `/Users/aayamacharya/Documents/prod_website/PRD_TECH_DESIGN.md`
- App entry: `/Users/aayamacharya/Documents/prod_website/src/App.tsx`
- DB schema: `/Users/aayamacharya/Documents/prod_website/src/data/db.ts`
- Progression formulas: `/Users/aayamacharya/Documents/prod_website/src/domain/progression.ts`
- Event service: `/Users/aayamacharya/Documents/prod_website/src/events/eventService.ts`
- Snapshot builder: `/Users/aayamacharya/Documents/prod_website/src/snapshot/buildSnapshot.ts`
- Tests: `/Users/aayamacharya/Documents/prod_website/src/tests`
