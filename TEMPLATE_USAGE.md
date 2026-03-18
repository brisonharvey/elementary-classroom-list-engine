# CSV Template Guide

This guide explains the student and teacher templates shipped with the app.

## Student template

Template file:

- [student-import-template.csv](public/student-import-template.csv)

Sample file:

- [sample-students.csv](public/sample-students.csv)

### Required columns

- `id`
- `grade`
- `firstName`
- `lastName`

### Common optional columns

- `gender`
- `status`
- `academicTier`
- `behaviorTier`
- `referrals`
- `noContactWith`
- `preferredWith`
- `briganceReadiness`
- `mapReading`
- `mapMath`
- `ireadyReading`
- `ireadyMath`
- `ell`
- `section504`
- `raceEthnicity`
- `studentCharacteristics`
- `teacherNotes`
- `assignedTeacher`

### Student import behavior

- `id` must be a unique positive integer.
- `grade` accepts `K`, kindergarten-style values, and grades `1` through `5`.
- `academicTier` and `behaviorTier` can be plain numbers or note text containing `Tier 1`, `Tier 2`, or `Tier 3`.
- `ell` accepts common truthy values plus `EL`, `ELL`, and `RFEP 1-4`.
- Student re-imports update existing students when the same `id` appears again.
- `assignedTeacher` creates a teacher-fixed placement when a matching room is available.
- If a teacher-fixed student cannot be seated in the matching room, the app keeps that student unresolved and flags the reason instead of placing the student somewhere else.

### Relationship columns

Use student IDs separated by commas, semicolons, pipes, or spaces.

- `noContactWith`
- `preferredWith`

`preferredWith` is limited to same-grade peers.

### Kindergarten note

For grade `K`, the placement engine uses `briganceReadiness` instead of MAP/i-Ready for academic scoring.

## Student characteristics

Use the `studentCharacteristics` column with these exact labels:

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

These characteristics are used for:

- teacher-fit scoring
- characteristic-based classroom support load

The parser still accepts older aliases where possible for backward compatibility.

## Teacher template

Template file:

- [teacher-import-template.csv](public/teacher-import-template.csv)

Sample file:

- [sample-teachers.csv](public/sample-teachers.csv)

### Required columns

- `grade`
- `teacherName`
- `structure`
- `regulationBehaviorSupport`
- `socialEmotionalSupport`
- `instructionalExpertise`

Teacher ratings are expected to be `1` through `5`.

### Teacher import behavior

- Teachers are assigned to rooms in CSV order within each grade.
- If there are more teacher rows than rooms, the app creates extra rooms.
- Teacher scores are kept for internal fit scoring and are not shown in the main UI after import.
- Teacher imports also support XLSX files with sheet selection plus basic header-row/group-header preprocessing.

## Characteristic-to-teacher alignment

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
