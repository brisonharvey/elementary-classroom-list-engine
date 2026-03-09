# Template Usage Guide

This guide explains how to fill out the student and teacher CSV templates shipped with the app.

## Student template

File:

- `public/student-import-template.csv`

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
- `noContactWith`
- `preferredWith`
- `ell`
- `section504`
- `raceEthnicity`
- `teacherNotes`

Assessment columns:

- `briganceReadiness`
- `mapReading`
- `mapMath`
- `ireadyReading`
- `ireadyMath`

Kindergarten rule:

- For grade `K`, use `briganceReadiness`.
- For kindergarten placement, Brigance replaces MAP and i-Ready in the logic engine.
- MAP and i-Ready can be left blank for kindergarten students.

Relationship columns:

- `noContactWith`
- `preferredWith`

Use student IDs separated by semicolons.

## Student tags

Use the `studentTags` column for both:

- teacher-fit comparison
- tag-based Classroom Support Load Index derivation

Use one or more of these exact simplified labels:

- `Needs structure`
- `Needs redirection support`
- `Needs emotional reassurance`
- `Needs peer support`
- `Needs movement support`
- `Needs academic enrichment`
- `Independent worker`

Separators accepted inside the field:

- `;`
- `,`
- `|`

Example:

```csv
Needs structure;Needs emotional reassurance
```

### Compatibility note

Older CSVs that still use the previous detailed labels are still accepted.
The app normalizes them into the simplified tags above during import.

### Tag support-load weights

These weights are derived automatically in the app. Do not add extra columns for them.

- `Needs structure = 3`
- `Needs redirection support = 4`
- `Needs emotional reassurance = 4`
- `Needs peer support = 3`
- `Needs movement support = 3`
- `Needs academic enrichment = 1`
- `Independent worker = -1`

### Tag categories used in room balancing

Behavioral:

- `Needs redirection support`
- `Needs peer support`

Emotional:

- `Needs emotional reassurance`

Instructional:

- `Needs structure`
- `Needs academic enrichment`
- `Independent worker`

Energy:

- `Needs movement support`

## Teacher template

File:

- `public/teacher-import-template.csv`

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

### Teacher rating scale

Every teacher characteristic must be rated from `1` to `5`.

Use this scale consistently:

- `1` = low strength / rarely a strong match for that need
- `2` = below average support for that need
- `3` = neutral/default support
- `4` = strong support for that need
- `5` = standout strength for that need

## How simplified tags align to teacher ratings

- `Needs structure` -> `classroomStructure`, `behaviorManagementStrength`
- `Needs redirection support` -> `behaviorManagementStrength`, `classroomStructure`
- `Needs emotional reassurance` -> `emotionalSupportNurturing`, `confidenceBuilding`
- `Needs peer support` -> `peerSocialCoaching`, `classroomStructure`
- `Needs movement support` -> `movementFlexibility`, `behaviorManagementStrength`
- `Needs academic enrichment` -> `academicEnrichmentStrength`
- `Independent worker` -> `independenceScaffolding`

## Practical example

Student row:

```csv
1001,K,Amaya,Brooks,F,IEP,30,0,0,30,0,0,0,3,2,1002,1003,62,,,,,1,TRUE,FALSE,Black,Needs structure;Needs emotional reassurance,Needs a calm predictable start to the day
```

Teacher row:

```csv
K,Ms. GradeKA,5,4,5,3,3,4,4,5
```

That student contributes `7` points of simplified tag support load from:

- `Needs structure = 3`
- `Needs emotional reassurance = 4`

## Notes

- Student imports do not assign students to teachers.
- Teacher imports do not lock students.
- Locking happens only inside the app.
- Poor teacher fits are highlighted with purple student name text after placement.
- The templates do not include extra columns for derived tag-load totals because the app computes them from `studentTags`.
