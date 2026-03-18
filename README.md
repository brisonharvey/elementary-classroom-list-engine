# Elementary Classroom List Engine

Elementary Classroom List Engine is a React + Electron app for building balanced K-5 classroom rosters from separate student and teacher imports.

It supports:

- student and teacher CSV import with column mapping
- CSV and XLSX imports, including sheet selection and basic header-row preprocessing
- student re-imports that update existing roster records by `id`
- teacher-fit aware auto-placement
- hard no-contact rules and soft keep-together rules
- co-teach coverage checks
- manual drag-and-drop adjustments
- lockable placements
- grade snapshots
- CSV export for one grade or all grades

## App workflow

1. Import students.
2. Import teachers.
3. Choose the active grade.
4. Review classrooms, room sizes, co-teach coverage, and relationship rules.
5. Run auto-placement for that grade.
6. Review warnings and the grade summary.
7. Drag students manually as needed.
8. Lock any placements you want preserved.
9. Save a snapshot.
10. Export the final roster.

## Placement model

For each unlocked student in the active grade, the engine:

1. Rejects rooms that fail hard constraints.
2. Prefers the room with the best teacher-fit penalty.
3. Breaks teacher-fit ties with weighted soft balancing.

Hard constraints include:

- max room size
- required co-teach coverage
- max IEP count per room
- max referral-heavy count per room
- imported and managed no-contact conflicts

Soft balancing includes:

- class size
- academic need
- behavioral need
- demographic balance
- preferred peers
- do-not-separate pairs
- characteristic-based support load

## Student import notes

Required columns:

- `id`
- `grade`
- `firstName`
- `lastName`

Common optional columns:

- `gender`
- `status`
- `academicTier`
- `behaviorTier`
- `referrals`
- `briganceReadiness`
- `mapReading`
- `mapMath`
- `ireadyReading`
- `ireadyMath`
- `noContactWith`
- `preferredWith`
- `ell`
- `section504`
- `raceEthnicity`
- `studentCharacteristics`
- `teacherNotes`
- `assignedTeacher`

Important behavior:

- Student re-imports refresh existing students when the same `id` appears again.
- `assignedTeacher` creates a teacher-fixed placement when the matching classroom is available.
- If a teacher-fixed student cannot be seated in the matching classroom, the app leaves that student unresolved and flags the reason instead of placing them elsewhere.
- Kindergarten uses `briganceReadiness` in placement scoring instead of MAP/i-Ready.
- `academicTier` and `behaviorTier` can be numeric or note text that contains one or more `Tier X` values.
- `studentCharacteristics` accepts the current supported labels and also tolerates legacy aliases.
- `noContactWith` and `preferredWith` accept comma-, semicolon-, pipe-, or space-separated student IDs.

## Teacher import notes

Required columns:

- `grade`
- `teacherName`
- `structure`
- `regulationBehaviorSupport`
- `socialEmotionalSupport`
- `instructionalExpertise`

Important behavior:

- Teacher rows are applied in CSV order within each grade.
- Importing more teachers than existing rooms automatically adds rooms.
- Teacher profile scores are used internally for fit scoring and are hidden in the main UI after import.

## Student characteristics

Supported `studentCharacteristics` values:

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

These characteristics drive both teacher fit and characteristic-based classroom support load.

## Exports

Exports are reporting-oriented CSVs, not full round-trip backups.

Exported data includes:

- core student identity fields
- placement teacher
- assessment fields
- relationships
- demographics
- `studentCharacteristics`
- staff notes

Derived room metrics are not exported as extra columns.

## Development

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

### Run the desktop app

```bash
npm run dev:desktop
```

### Verify

```bash
npm run lint
npm run test
npm run build
```

## Project structure

- `src/components/` UI components for the workspace, drawers, panels, and editors
- `src/engine/` auto-placement engine
- `src/features/csv-import/` import flows and preprocessing UI
- `src/lib/csv/` CSV and spreadsheet parsing helpers
- `src/store/` reducer and persisted app state
- `src/utils/` balancing, exports, teacher fit, constraints, and classroom setup
- `public/` import templates and sample CSVs
- `tests/` lightweight logic tests

## Additional docs

- [ADMIN_BEGINNERS_GUIDE.md](ADMIN_BEGINNERS_GUIDE.md)
- [TEMPLATE_USAGE.md](TEMPLATE_USAGE.md)
- [SETTINGS_PAGE_EXPLANATION.md](SETTINGS_PAGE_EXPLANATION.md)
- [LOGIC_EXPLANATION.md](LOGIC_EXPLANATION.md)
