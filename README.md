# Elementary Classroom List Engine

Desktop and web app for building balanced K-5 classroom rosters from separate student and teacher CSV imports.

## Current capabilities

- Separate student and teacher CSV imports with header mapping.
- Hard constraints first, teacher-fit comparison second, and weighted soft balancing after that.
- Existing weighted balancing still includes class size, academic need, behavioral need, demographic balance, preferred-peer adjustment, do-not-separate adjustment, and grade settings pressure.
- Additive tag-based Classroom Support Load Index derived from `studentTags`.
- Simplified student tag schema with backward-compatible normalization from the older detailed labels.
- Kindergarten placement uses `briganceReadiness` instead of MAP/i-Ready for academic scoring.
- Manual drag/drop, locks, snapshots, exports, and local persistence.
- Poor teacher-fit students remain marked with purple name text.

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

Public tag set:

- `Needs structure`
- `Needs redirection support`
- `Needs emotional reassurance`
- `Needs peer support`
- `Needs movement support`
- `Needs academic enrichment`
- `Independent worker`

Notes:

- `studentTags` now use the simplified labels above.
- Older CSVs that still use the previous detailed labels are accepted and normalized into the simplified tag set during import.
- Student imports do not accept pre-assigned teachers.
- Students are only locked or fixed to rooms inside the app.
- For kindergarten, use `briganceReadiness` and leave MAP/i-Ready blank if you do not need them for reporting.
- `studentTags` drive both teacher-fit comparison and the tag-based classroom support-load balancing signal.

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

## Placement model

Per candidate room, the engine evaluates in this order:

1. Hard constraints.
2. Teacher-fit penalty.
3. Existing weighted soft balancing, now with an additional tag-support-load penalty.

The weighted soft score remains:

`loadScore + academicPenalty + behavioralPenalty + demographicPenalty + preferredTogetherAdjustment + doNotSeparateAdjustment + settingsPenalty + tagSupportLoadPenalty`

`tagSupportLoadPenalty` is additive only. It does not replace teacher-fit comparison, academic balancing, behavioral balancing, or demographic balancing.

## Simplified tag-based Classroom Support Load Index

Per-student derived value:

- `studentTagSupportLoad`

Per-room derived values:

- `classroomTagSupportLoad`
- `behavioralTagSupportLoad`
- `emotionalTagSupportLoad`
- `instructionalTagSupportLoad`
- `energyTagSupportLoad`

Current weights:

- `Needs structure = 3`
- `Needs redirection support = 4`
- `Needs emotional reassurance = 4`
- `Needs peer support = 3`
- `Needs movement support = 3`
- `Needs academic enrichment = 1`
- `Independent worker = -1`

Teacher-fit alignment:

- `Needs structure` -> `classroomStructure`, `behaviorManagementStrength`
- `Needs redirection support` -> `behaviorManagementStrength`, `classroomStructure`
- `Needs emotional reassurance` -> `emotionalSupportNurturing`, `confidenceBuilding`
- `Needs peer support` -> `peerSocialCoaching`, `classroomStructure`
- `Needs movement support` -> `movementFlexibility`, `behaviorManagementStrength`
- `Needs academic enrichment` -> `academicEnrichmentStrength`
- `Independent worker` -> `independenceScaffolding`

This derived load is surfaced in student cards/tooltips, classroom quick stats, room summary cards, grade-level warning chips, and manual-move warnings.

## Kindergarten scoring

For grade `K` only:

- `briganceReadiness` replaces MAP and i-Ready in placement scoring.
- Student cards show Brigance instead of MAP badges.
- Room summaries show Brigance room averages.
- Top-level warning chips use Brigance wording instead of reading spread wording.

## Export behavior

Exports are reporting-oriented, not round-trip import templates.

Exports currently include the student reporting fields already in the app plus `assignedTeacher`.
Derived tag-support-load values are not exported as additional columns.

## Verification notes

- `npm run test` validates simplified tag-load derivation, projected penalty behavior, and tag parsing compatibility.
- `node_modules/.bin/tsc -b` verifies the TypeScript projects.
- `npm run build` may still fail in a restricted sandbox if Vite/esbuild cannot spawn its subprocess.
- `npm run lint` requires `eslint` to be installed in the environment.
