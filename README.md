# Elementary Classroom List Engine

Desktop and web app for building balanced K-5 classroom rosters from CSV student data.

## What the current build does

- Imports student rosters through a two-step CSV flow: upload, review suggested header matches, then import.
- Runs auto-placement for the active grade only.
- Preserves locked students during auto-place and grade resets.
- Honors hard constraints for room capacity, co-teach coverage, IEP caps, referral caps, and no-contact conflicts.
- Applies soft scoring for academic, behavioral, demographic, preferred-peer, do-not-separate, and grade-setting pressures.
- Supports manual drag-and-drop between rooms and unassigned, with override warnings before invalid moves.
- Lets users add or delete classrooms for the active grade.
- Lets users edit teacher names, room capacities, and co-teach coverage per room.
- Includes a grade settings panel for hard/soft threshold tuning.
- Includes a relationship manager for `NO_CONTACT` and `DO_NOT_SEPARATE` rules.
- Shows an unassigned panel, grade summary drawer, imbalance warning chips, and placement warning popover.
- Saves grade-specific snapshots with restore, duplicate, rename, note editing, and diff summaries.
- Exports either the active grade or all grades back to CSV.
- Persists app state in `localStorage`, including migration from older saved formats.

## Tech stack

- React 18
- TypeScript
- Vite
- Electron Builder

## Getting started

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
npm install
```

### Run the web app

```bash
npm run dev
```

### Run the desktop app in development

```bash
npm run dev:desktop
```

### Build the renderer

```bash
npm run build
```

### Build desktop packages

```bash
# Current platform
npm run build:desktop

# macOS universal artifacts (.dmg + .zip)
npm run dist:mac

# Windows x64 artifacts (NSIS installer + portable .exe)
npm run dist:win

# Windows ARM64 artifacts
npm run dist:win:arm64
```

Desktop artifacts are written to `release/`.

### Lint

```bash
npm run lint
```

## CSV import

Starter files live in `public/`:

- `sample-students.csv`: populated example dataset
- `student-import-template.csv`: header-only template

The importer first previews headers and sample values, then lets the user map each source column to an app field. Required fields are:

- `id`
- `grade`
- `firstName`
- `lastName`

Common optional fields:

- Student profile: `gender`, `status`, `academicTier`, `behaviorTier`, `referrals`
- Co-teach service minutes: `coTeachReadingMinutes`, `coTeachWritingMinutes`, `coTeachScienceSocialStudiesMinutes`, `coTeachMathMinutes`, `coTeachBehaviorMinutes`, `coTeachSocialMinutes`, `coTeachVocationalMinutes`
- Legacy co-teach booleans: `requiresCoTeachReading`, `requiresCoTeachMath`
- Assessments: `mapReading`, `mapMath`, `ireadyReading`, `ireadyMath`
- Relationships: `noContactWith`, `preferredWith`
- Placement context: `teacher`, `ell`, `section504`, `raceEthnicity`, `teacherNotes`

Import behavior in the current build:

- IDs must be unique positive integers. Invalid or duplicate IDs are skipped.
- Grades accept `K`, `0`, `KG`, kindergarten variants, `01-05`, and ordinal forms like `1st`.
- Tier values default to `1`; explicit `2`, `3`, `yes`, or `y` raise support tiers.
- Co-teach minutes are numeric and clamped to `0..999`.
- Legacy reading/math co-teach booleans are converted to 30 minutes when explicit minutes are missing.
- Relationship lists accept `,`, `;`, or `|` separators.
- Unknown relationship IDs generate import warnings.
- `preferredWith` is limited to same-grade peers and deduplicated.
- Imported `teacher` values preassign students into teacher rooms and load them as locked when possible.

## Placement workflow

1. Import students from CSV.
2. Switch to a grade with the grade selector.
3. Optionally tune weights, room setup, relationship rules, and grade settings.
4. Run `Auto-Place Grade X`.
5. Review warning chips, placement warnings, unassigned students, and the summary drawer.
6. Manually drag students as needed and lock placements that should be preserved.
7. Save snapshots while iterating.
8. Export the active grade or all grades.

## Defaults and behavior details

- The app initializes four classrooms per grade.
- New classrooms default to max size `28`.
- The first room created for a grade starts with reading co-teach coverage; other default rooms start with none.
- Auto-place clears only unlocked students from rooms in the active grade before recalculating placements.
- `Reset Grade` removes only unlocked placements for the active grade.
- `Clear All` resets students, rooms, rules, settings, warnings, and snapshots.
- Loading a new CSV replaces current students and classrooms and clears snapshots, rules, unresolved reasons, and warnings.
- State is saved to `localStorage` under `classroom-placement-state-v2`, with fallback migration from `classroom-placement-state-v1`.

## Summary and warnings

The current summary drawer shows, for the active grade:

- Student, IEP, Referral, EL, and 504 totals
- Race/ethnicity totals
- Per-room size, gender split, MAP averages, support load, and co-teach totals
- Per-room race/ethnicity breakdown
- Per-room co-teach coverage badges

The main workspace also surfaces:

- Gender imbalance chips when a room exceeds the configured tolerance
- Reading spread, math spread, and support-load imbalance chips
- Placement warnings after auto-place, including unresolved students and grouped hard-constraint reasons

## Project structure

- `src/components/`: uploader, controls, room columns, summary, snapshots, settings, and relationship management
- `src/engine/`: auto-placement engine
- `src/store/`: reducer, app context, drag context
- `src/utils/`: CSV parsing, scoring, constraints, co-teach helpers, exports, and classroom initialization
- `src/types/`: shared domain types
- `electron/`: desktop shell and notarization hook

## Scripts

- `npm run dev`: start the Vite dev server
- `npm run dev:desktop`: run Electron against the local Vite server
- `npm run build`: type-check and build the renderer
- `npm run build:renderer`: same renderer build used by packaging
- `npm run build:desktop`: package the current platform desktop app
- `npm run dist:mac`: build macOS universal artifacts
- `npm run dist:win`: build Windows x64 artifacts
- `npm run dist:win:arm64`: build Windows ARM64 artifacts
- `npm run lint`: lint the project
- `npm run preview`: preview the production renderer build

## Signing and notarization

Use `.env.signing.example` as the template for local signing credentials. Electron Builder reads the relevant certificate and notarization environment variables during packaging.
