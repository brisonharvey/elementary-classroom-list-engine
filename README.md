# Elementary Classroom List Engine

Desktop and web app for building balanced K-5 classroom rosters from separate student and teacher CSV imports.

## Current capabilities

- Imports students through a two-step CSV flow: upload, map headers, then load.
- Imports teacher characteristics through a separate two-step CSV flow.
- Uses hard constraints first, teacher-fit scoring second, and academic/behavior/demographic balancing after that.
- Uses Brigance Kindergarten readiness scores for kindergarten placement in place of MAP and i-Ready.
- Honors room capacity, co-teach coverage, IEP caps, referral caps, and no-contact conflicts.
- Supports preferred-peer and do-not-separate relationship rules.
- Lets users manually drag students, then lock placements inside the app.
- Marks poor teacher-fit placements directly on student cards with purple name text.
- Saves snapshots, exports placements, and persists state locally.

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

### Type-check and build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

## Import files

Files in `public/`:

- `student-import-template.csv`
- `sample-students.csv`
- `teacher-import-template.csv`
- `sample-teachers.csv`

The app also provides download buttons for both template and sample files inside the uploader.

## Student import schema

Required columns:

- `id`
- `grade`
- `firstName`
- `lastName`

Common optional columns:

- Student profile: `gender`, `status`, `academicTier`, `behaviorTier`, `referrals`
- Co-teach minutes: `coTeachReadingMinutes`, `coTeachWritingMinutes`, `coTeachScienceSocialStudiesMinutes`, `coTeachMathMinutes`, `coTeachBehaviorMinutes`, `coTeachSocialMinutes`, `coTeachVocationalMinutes`
- Relationships: `noContactWith`, `preferredWith`
- Assessments: `briganceReadiness`, `mapReading`, `mapMath`, `ireadyReading`, `ireadyMath`
- Demographics/context: `ell`, `section504`, `raceEthnicity`, `studentTags`, `teacherNotes`

Important changes:

- The student import no longer accepts a pre-assigned teacher column.
- Students are only locked or fixed to rooms from inside the app.
- Kindergarten students should use `briganceReadiness`; MAP and i-Ready can be left blank for K.
- `studentTags` should be semicolon-separated using the exact tag names documented in [TEMPLATE_USAGE.md](/C:/Users/briso/GitHub/elementary-classroom-list-engine/TEMPLATE_USAGE.md).

## Teacher import schema

Required columns:

- `grade`
- `teacherName`
- `classroomStructure`
- `behaviorManagementStrength`
- `emotionalSupportNurturing`
- `academicEnrichmentStrength`
- `independenceScaffolding`
- `movementFlexibility`
- `peerSocialCoaching`
- `confidenceBuilding`

Teacher ratings are `1-5`.

Teacher import behavior:

- Teacher rows are applied to classrooms in CSV order within each grade.
- If a grade has more imported teachers than existing rooms, the app adds rooms.
- If a teacher import is loaded after students, the students remain in place and room teacher names are updated.
- Teacher-fit scoring uses the imported teacher profile whose grade and teacher name match the classroom.

## Placement workflow

1. Import students.
2. Import teachers.
3. Review teacher names per classroom if needed.
4. Adjust rules, settings, and weights.
5. Run auto-place for the active grade.
6. Review warnings, poor-fit cards, the unassigned panel, and the summary drawer.
7. Drag students manually as needed.
8. Lock placements that should be preserved.
9. Export the current grade or all grades.

## Placement model

Order of operations for each candidate room:

1. Hard constraints must pass.
2. Teacher fit is compared next.
3. If teacher fit ties, the engine falls through to academic, behavior, demographic, class size, relationship, and settings balancing.

The engine still prioritizes higher-need students earlier in the placement pass, especially students with co-teach needs, IEP/Referral status, and higher support load.

## Kindergarten scoring

For grade `K` only:

- `briganceReadiness` replaces MAP and i-Ready in placement scoring.
- Student cards show Brigance instead of MAP badges.
- Summary cards show Brigance room averages instead of MAP averages.
- The main workspace warning chip uses Brigance spread wording for kindergarten.

For grades `1-5`, MAP and i-Ready continue to drive academic balancing.

## Teacher fit and poor-fit marking

Teacher fit is driven by the student tags and teacher ratings.

Examples:

- `Needs strong routine` aligns to `classroomStructure`
- `Needs frequent redirection` aligns to `behaviorManagementStrength`
- `Needs movement breaks` aligns to `movementFlexibility`
- `Needs enrichment` aligns to `academicEnrichmentStrength`
- `Low academic confidence` aligns to `confidenceBuilding`

Students placed with a poor-fit teacher are marked with purple name text in their student cards and counted in the summary.

## Export behavior

Exports include the new student import fields plus an `assignedTeacher` column at the end.

That means:

- student templates are for import
- placement exports are for reporting and review
- exports are not intended to be the same schema as the student import anymore

## Project structure

- `src/components/`: uploader, controls, room columns, summary, snapshots, settings, and relationship management
- `src/engine/`: placement engine
- `src/store/`: reducer, app context, drag context
- `src/utils/`: CSV parsing, teacher-fit logic, scoring, constraints, exports, and classroom initialization
- `src/types/`: shared domain types
- `public/`: shipped CSV templates and samples
- `electron/`: desktop shell and notarization hook

## Verification notes

TypeScript verification passes with:

```bash
node_modules/.bin/tsc -b
```

`npm run build` may still fail in this sandboxed environment because Vite/esbuild cannot spawn its build subprocess here (`spawn EPERM`).
