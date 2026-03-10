# Elementary Classroom List Engine

Desktop and web app for building balanced K-5 classroom rosters from separate student and teacher CSV imports.

## Current capabilities

- Separate student and teacher CSV imports with header mapping.
- Hard constraints first, teacher-fit comparison second, and weighted soft balancing after that.
- Weighted balancing includes class size, academic need, behavioral need, demographic balance, preferred-peer adjustment, do-not-separate adjustment, and grade settings pressure.
- Additive characteristic-based Classroom Support Load derived from student characteristics.
- Kindergarten placement uses `briganceReadiness` instead of MAP/i-Ready for academic scoring.
- Manual drag/drop, locks, snapshots, exports, and local persistence.
- Teacher profile scores are used internally for fit and are not shown in the app UI.

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

### Validation

```bash
npm run test
node_modules/.bin/tsc -b
```

## Import files

Files in `public/`:

- `student-import-template.csv`
- `sample-students.csv`
- `teacher-import-template.csv`
- `sample-teachers.csv`

The uploader also exposes template and sample downloads inside the app.

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
- Demographics/context: `ell`, `section504`, `raceEthnicity`, `studentCharacteristics`, `teacherNotes`, `assignedTeacher`

Notes:

- `assignedTeacher` is optional on student import and can seed a student into a matching teacher room.
- Students are only locked or fixed to rooms inside the app.
- For kindergarten, use `briganceReadiness` and leave MAP/i-Ready blank if you do not need them for reporting.
- `studentCharacteristics` must use the exact human-readable labels documented in `TEMPLATE_USAGE.md`.
- The parser still accepts legacy `studentTags` headers and retired characteristic labels for backward compatibility, but all exports and docs now use `studentCharacteristics`.

## Teacher import schema

Required columns:

- `grade`
- `teacherName`
- `structure`
- `regulationBehaviorSupport`
- `socialEmotionalSupport`
- `instructionalExpertise`

Teacher import behavior:

- Teacher rows are applied to classrooms in CSV order within each grade.
- If a grade has more imported teachers than existing rooms, the app adds rooms.
- Loading teachers later updates teacher names and profiles without clearing student placements.
- Teacher-fit scoring matches the room using `grade + teacherName`.
- Imported teacher scores are hidden in the app UI after import and only drive internal fit comparisons.

## Student characteristics

Supported student characteristics:

- `Needs strong routine`
- `Needs frequent redirection`
- `Easily frustrated`
- `Needs reassurance`
- `Sensitive to correction`
- `Struggles with peer conflict`
- `High energy`
- `Needs movement breaks`
- `Needs enrichment`
- `Independent worker`
- `Low academic confidence`

## Teacher characteristics

Supported teacher characteristics:

- `Structure`
- `Regulation/Behavior Support`
- `Social/Emotional Support`
- `Instructional Expertise`

## Characteristic-to-teacher alignment

The engine compares student characteristics to teacher characteristics like this:

- `Needs strong routine` -> `Structure`, `Regulation/Behavior Support`
- `Needs frequent redirection` -> `Regulation/Behavior Support`, `Structure`
- `Easily frustrated` -> `Social/Emotional Support`, `Regulation/Behavior Support`
- `Needs reassurance` -> `Social/Emotional Support`, `Instructional Expertise`
- `Sensitive to correction` -> `Social/Emotional Support`, `Instructional Expertise`
- `Struggles with peer conflict` -> `Social/Emotional Support`, `Regulation/Behavior Support`
- `High energy` -> `Regulation/Behavior Support`, `Structure`
- `Needs movement breaks` -> `Regulation/Behavior Support`, `Structure`
- `Needs enrichment` -> `Instructional Expertise`, `Structure`
- `Independent worker` -> `Instructional Expertise`, `Structure`
- `Low academic confidence` -> `Social/Emotional Support`, `Instructional Expertise`

## Placement workflow

1. Import students.
2. Import teachers.
3. Review teacher names, co-teach coverage, rules, settings, and weights.
4. Run auto-place for the active grade.
5. Review warnings, poor-fit cards, room characteristic-load summaries, and the summary drawer.
6. Drag students manually as needed.
7. Lock placements that should be preserved.
8. Export the active grade or all grades.

## Placement model

Per candidate room, the engine evaluates in this order:

1. Hard constraints.
2. Teacher-fit penalty.
3. Weighted soft balancing, including characteristic-support-load pressure.

The weighted soft score is:

`loadScore + academicPenalty + behavioralPenalty + demographicPenalty + preferredTogetherAdjustment + doNotSeparateAdjustment + settingsPenalty + tagSupportLoadPenalty`

## Characteristic-based Classroom Support Load

The app derives a second support signal from `studentCharacteristics`.

Current characteristic weights:

- `Needs strong routine = 2`
- `Needs frequent redirection = 4`
- `Easily frustrated = 3`
- `Needs reassurance = 2`
- `Sensitive to correction = 2`
- `Struggles with peer conflict = 3`
- `High energy = 2`
- `Needs movement breaks = 2`
- `Needs enrichment = 1`
- `Independent worker = -1`
- `Low academic confidence = 2`

This derived load is surfaced in:

- student cards and tooltips
- classroom quick stats
- room summary cards
- grade-level warning chips
- manual-move warnings

## Kindergarten scoring

For grade `K` only:

- `briganceReadiness` replaces MAP and i-Ready in placement scoring.
- Student cards show Brigance instead of MAP badges.
- Room summaries show Brigance room averages.
- Top-level warning chips use Brigance wording instead of reading spread wording.

Grades `1-5` continue using MAP and i-Ready for academic balancing.

## Export behavior

Exports are reporting-oriented, not round-trip import templates.

Exports include:

- the student reporting fields already in the app
- `studentCharacteristics`
- `assignedTeacher`

Derived support-load values are not exported as additional columns.

## Project structure

- `src/components/`: uploader, controls, room columns, summary, snapshots, settings, and relationship management
- `src/engine/`: placement engine
- `src/store/`: reducer, app context, drag context
- `src/utils/`: CSV parsing, teacher fit, characteristic-load derivation, scoring, constraints, exports, and classroom initialization
- `src/types/`: shared domain types
- `public/`: shipped CSV templates and samples
- `tests/`: lightweight logic tests
- `SETTINGS_PAGE_EXPLANATION.md`: guide to the Grade Settings panel and each setting
- `electron/`: desktop shell and notarization hook

## Verification notes

- `npm run test` validates characteristic-load derivation, projected penalty behavior, and backward-compatible student characteristic parsing.
- `node_modules/.bin/tsc -b` verifies the TypeScript projects.
- `npm run build` may still fail in a restricted sandbox if Vite/esbuild cannot spawn its subprocess.
- `npm run lint` requires `eslint` to be installed in the environment.


