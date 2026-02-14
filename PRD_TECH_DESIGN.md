# RPG Productivity Web App - PRD + Technical Design (V1 + V2 Outline)

## 1. Vision
Build a premium offline-first **web app** that makes productivity feel like an RPG progression loop with a Solo Leveling-style atmosphere: dark futuristic visuals, smooth feedback, clear progression, and practical day-to-day task execution.

Primary outcomes:
- Replace a normal todo app workflow (tasks, focus, review) while staying fast.
- Sustain long-term progression with anti-exploit balancing and seasonal prestige.
- Keep all V1 data local/offline with architecture prepared for future social expansion.

## 2. Scope Split

### V1 (implemented now, offline-only)
- Task system: Today/Upcoming/All/Completed, subtasks, recurring tasks, deadlines, priority, tags, notes, quick add, keyboard shortcuts.
- RPG progression: stats, XP/levels, ranks/titles, diminishing returns, anti-exploit penalties, prestige.
- Focus timer: pomodoro presets, long break rules, task/category-linked rewards.
- Analytics: yearly heatmap, peak hours/day-of-week, weekly trends, completion-on-focus-day, streaks.
- Quests: daily, weekly, storyline, adaptive quest generation.
- Achievements: 64 seeded multi-tier achievements across required categories.
- Immersive extras: boss fight epics, perk system, cosmetics unlocks, weekly reflection prompts, optional stamina toggle, balanced progression warnings.
- Social-ready scaffolding: stable local identity, immutable event log with schema versioning, local `buildSnapshot(range)` with unit tests.

### V2 (design now, no networking implementation)
- Party/Guild creation/join via invite.
- Friend accountability snapshots (aggregate-only).
- Group quests + kudos.
- Privacy controls: per-field sharing + incognito mode.

### Future
- Optional cloud backup/sync providers.
- Mobile wrapper.

## 3. Tech Stack (Exact Web App Wording)

1. **Frontend App:** `React + TypeScript + Vite` (SPA web app)
2. **Styling/UI:** `Tailwind CSS + Radix UI + custom design tokens` (premium glow/glass theme)
3. **Animations:** `Framer Motion`
4. **Offline Storage:** `IndexedDB` via `Dexie` (no backend required for V1)
5. **State Management:** `Zustand`
6. **Charts/Analytics UI:** `Recharts` + custom heatmap component
7. **Testing:** `Vitest + React Testing Library`
8. **Date/Recurrence:** `date-fns`
9. **Offline App Capability:** **PWA** (`vite-plugin-pwa`) for installable, offline-cached web experience

## 4. Information Architecture
- Dashboard
- Tasks
- Focus
- Quests
- Character
- Achievements
- Analytics
- Journal
- Settings

## 5. Architecture
- `src/ui`: pages, components, theme, motion.
- `src/domain`: pure game/productivity logic (XP, stats, quests, streaks, prestige).
- `src/data`: Dexie schema, repositories, migrations, seeders.
- `src/events`: immutable append-only event log + projection updates.
- `src/analytics`: cached bucket builders + chart selectors.
- `src/snapshot`: aggregate-only snapshot builder for V2.

Boundary rule: UI cannot directly mutate progression state; all mutations go through event/repository APIs.

## 6. Data Model
- `user_profile`: user_id, display_name, title, avatar/cosmetics.
- `settings`: timer rules, audio/motion toggles, stamina toggle, accessibility.
- `categories`: name + stat weights.
- `tasks`: subtasks, recurrence, status, metadata.
- `focus_sessions`: start/end, linked task/category, duration.
- `character_state`: stats, level, xp, prestige, legacy points.
- `quests`: type, objectives, progress, rewards.
- `achievements` + `achievement_progress`.
- `perks`.
- `streaks`.
- `analytics_daily_cache`.
- `event_log` (immutable, versioned).

## 7. Event Log and Versioning
Envelope:
- `event_id`, `schema_version`, `event_type`, `occurred_at`, `user_id`, `payload`.

Core V1 events:
- TaskCreated, TaskUpdated, TaskCompleted, TaskReopened
- FocusSessionStarted, FocusSessionEnded
- QuestGenerated, QuestCompleted
- AchievementProgressed, BadgeUnlocked
- PerkUnlocked, LevelUp
- PrestigeTriggered
- CategoryCreated, SettingsUpdated

Versioning:
- Additive changes remain backward compatible.
- Breaking payload changes increment schema version.
- Migration adapters convert old payloads for projections/snapshot.

## 8. RPG Formula Design

### XP
- Task XP:
  - `base = 20 + priorityBonus + deadlineBonus + subtaskBonus`
  - `durationFactor = clamp(ln(1 + estimateMinutes/15), 0.6, 1.8)`
  - `rawTaskXp = base * durationFactor * noveltyFactor`
- Focus XP:
  - `rawFocusXp = workMinutes * 1.2 * streakFactor`

### Diminishing Returns + Anti-Exploit
- Same-category day decay: `effective = raw / (1 + 0.12 * sameCategoryCountToday)`
- Tiny tasks (<5 min estimate): `0.35x`
- Repeated title hash in 24h: progressive multiplier `0.8^n`
- Daily soft cap: XP beyond threshold earns at `40%`

### Level Curve
- `xpToNext(level) = 120 + 35*level + 10*level^1.35`

### Prestige
- Seasonal cap default: 60.
- Prestige resets level/xp only.
- Keeps achievements, cosmetics, badges, titles.
- `legacy_points = floor((seasonPeakLevel - 20)/5)`.

## 9. Analytics Pipeline
Write-time projection updates:
- Append event.
- Update daily buckets (focus/completions/xp/category mix).
- Update streak counters.
- Re-evaluate quest and achievement progress.

Read-time:
- Build heatmap and trend views from cached daily buckets.
- Hour/day distributions from indexed focus sessions.

Performance:
- Indexed date/hour/category queries.
- Cache invalidation only on relevant event append.
- Rebuild projections on schema mismatch.

## 10. UI System
- Dark futuristic palette with glass cards and neon edge glow.
- Rounded panels, strong type contrast, polished motion.
- Command palette + keyboard shortcuts for speed.
- Accessibility: reduced motion, high contrast, ARIA labels, focus-visible states.

## 11. Seed Data
- Default categories with stat mappings.
- Daily/weekly/storyline quest templates.
- 64 achievement definitions.
- Boss fight epic template with phase checkpoints.
- Timer presets and starter cosmetics.

## 12. Test Plan
- XP and diminishing return correctness.
- Anti-exploit rules.
- Streak logic across day boundaries.
- Adaptive quest generation.
- Prestige conversion and legacy points.
- Snapshot builder correctness/stability + no raw-task leakage.

## 13. Risks + Mitigations
- Exploit loops -> penalties, caps, and diversity incentives.
- Large-history query cost -> cached buckets + indexing.
- Scope creep -> strict V1/V2 boundaries and module contracts.
- Date boundary bugs -> centralized date utilities + tests.

## 14. V2 Party/Guild Design Outline
Data shared (aggregate-only by default):
- level, prestige rank, xp today/week
- focus minutes today/week
- completion counts today/week
- task/focus streaks
- top categories percentages
- last badge unlocked
- active quest progress percentage

Privacy:
- Field-level sharing toggles.
- Incognito mode.
- Private-by-default.
- No raw task text shared unless explicit future opt-in.

V2 integration points:
- Keep `buildSnapshot(range)` stable.
- Add transport adapter later (HTTP/WebSocket).
- Guild service consumes snapshots only.
