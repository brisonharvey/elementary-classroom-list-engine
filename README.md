# Elementary Classroom List Engine

A React + TypeScript web app for building balanced elementary classroom rosters (K–5) from a CSV student list.

## What this app does

- Imports student data from CSV.
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

Upload your CSV from the app header to start generating placements.

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
