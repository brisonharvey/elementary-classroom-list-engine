# Elementary Classroom List Engine

A React + TypeScript web app for building balanced elementary classroom rosters (K–5) from a CSV student list.

## What this app does

- Imports student data from CSV with a guided two-step upload and header matching.
- Organizes students by grade and classroom.
- Uses weighted placement criteria to balance lists.
- Supports manual drag-and-drop adjustments across classrooms.
- Tracks unassigned students and class summaries.
- Exports class lists and supports snapshots while iterating.

## Tech stack

- React 18
- TypeScript
- Vite

## Getting started

### Prerequisites

- Node.js 18+ (recommended)
- npm

### Install dependencies

```bash
npm install
```

### Run in development

```bash
npm run dev
```

Then open the local URL shown by Vite (typically `http://localhost:5173`).

### Build for production

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

## CSV input

A sample CSV is included at:

- `public/sample-students.csv`

Upload your CSV from the app header. The import now opens a mapping step so you can match varied source headers (for example `Student Number` → `Student ID`) before loading students.

The sample includes extra optional import fields such as `ell`, `section504`, `homeroom`, and `notes`.

## Project structure (high level)

- `src/components/` UI components for uploader, controls, classroom columns, summaries, and snapshots.
- `src/engine/` Placement algorithm.
- `src/store/` App state management and drag context.
- `src/utils/` CSV parsing, scoring, constraints, initialization, and export helpers.
- `src/types/` Shared TypeScript types.

## Scripts

- `npm run dev` — start dev server
- `npm run build` — type-check and build
- `npm run lint` — lint source files
- `npm run preview` — preview production build

## What changed (latest)

- **Relationship rules manager (per grade):** Added a dedicated panel for creating/deleting `NO_CONTACT` (hard) and `DO_NOT_SEPARATE` (soft) student-pair rules with optional notes.
- **Placement logic updates:**
  - `NO_CONTACT` now blocks both auto-place and manual move validations.
  - `DO_NOT_SEPARATE` now affects soft scoring so paired students are favored together.
  - Existing preferred-with scoring is still active and combines with relationship scoring.
- **Snapshots upgraded:** Multiple named snapshots per grade now support notes, duplicate/rename/edit note actions, and lightweight diff summaries.
- **Dynamic classrooms (per grade):** Added add/delete classroom controls with stable room IDs and editable labels/teacher assignment compatibility.
- **Room heatmaps:** Each room header now includes compact intensity tiles for reading, math, support, ELL, IEP cap pressure, and referral cap pressure.
- **Per-grade settings panel:** Added per-grade hard/soft constraint settings for IEP cap, referral cap, ELL soft cap, gender tolerance (± students), and class-size variance limit with reset defaults.
- **Service/support load balancing:** Support-load balancing remains in scoring/summaries and now appears in room heatmap pressure indicators.
