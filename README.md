# Elementary Classroom List Engine

A React + TypeScript app for building balanced K-5 classroom rosters from CSV student data.

## Core capabilities

- Two-step CSV import: upload, map source headers to app fields, then import.
- Placement engine that runs per active grade and preserves locked students.
- Hard constraints for capacity, co-teach coverage, IEP/referral caps, and no-contact rules.
- Soft scoring for academic, behavioral, demographic, relationship, and grade-setting pressures.
- Manual drag-and-drop moves with pre-move warning prompts.
- Dynamic room management (add/delete rooms per grade).
- Per-room editing for teacher name and co-teach coverage categories.
- Per-grade settings panel for hard/soft constraint thresholds.
- Relationship rules panel for `NO_CONTACT` (hard) and `DO_NOT_SEPARATE` (soft).
- Snapshot manager (save, restore, duplicate, rename, note edits, delete).
- Grade summary table with imbalance indicators and room-level metrics.
- CSV export for current grade or all grades.
- Local persistence (`localStorage`) with migration support from legacy state keys.

## Tech stack

- React 18
- TypeScript
- Vite

## Getting started

### Prerequisites

- Node.js 18+
- npm

### Install dependencies

```bash
npm install
```

### Run locally

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

## CSV input

Starter files are in `public/`:

- `sample-students.csv` - full example dataset
- `student-import-template.csv` - header-only template for real data entry

The uploader supports flexible header names using alias matching, then lets you manually map columns before import.

### Required fields

- `id`
- `grade`
- `firstName`
- `lastName`

### Common optional fields

- Student profile: `gender`, `status`, `academicTier`, `behaviorTier`, `referrals`
- Co-teach minutes by category: reading, writing, science/social studies, math, behavior, social, vocational
- Assessments: `mapReading`, `mapMath`, `ireadyReading`, `ireadyMath`
- Relationships: `noContactWith`, `preferredWith`
- Placement context: `teacher` (pre-assignment), `ell`, `section504`, `raceEthnicity`, `teacherNotes`

## Placement workflow

1. Load students from CSV.
2. Optionally define grade settings and relationship rules.
3. Run `Auto-Place` for the active grade.
4. Review warnings/unresolved students.
5. Manually adjust via drag-and-drop and lock/pin as needed.
6. Save snapshots while iterating.
7. Export final lists.

## Behavior details

- Auto-placement only runs for the currently active grade.
- Locked students stay in place during auto-placement and grade reset.
- Students with imported `teacher` values are preassigned, inserted into mapped rooms, and loaded as locked.
- Manual moves can override constraints after warning confirmation.
- `Clear All` resets students, rooms, snapshots, rules, settings, and warnings to initial state.

## Project structure

- `src/components/` - uploader, controls, classroom columns, summary, snapshots, settings, rules
- `src/engine/` - placement engine
- `src/store/` - reducer, app context, drag context
- `src/utils/` - CSV parsing, scoring, constraints, co-teach helpers, exports, classroom init
- `src/types/` - shared domain types

## Scripts

- `npm run dev` - start dev server
- `npm run build` - type-check and production build
- `npm run lint` - lint source files
- `npm run preview` - preview production build
