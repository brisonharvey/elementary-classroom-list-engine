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
- MAP and i-Ready can be left blank for K students.

Relationship columns:

- `noContactWith`
- `preferredWith`

Use student IDs separated by semicolons.

Example:

```csv
1001;1004;1012
```

### Student tags

Use the `studentTags` column for teacher-fit inputs.

Enter one or more of these exact tag names, separated by semicolons:

- `Needs strong routine`
- `Needs frequent redirection`
- `Easily frustrated`
- `Needs reassurance`
- `Sensitive to correction`
- `Easily influenced by peers`
- `Needs positive peer models`
- `High energy`
- `Needs movement breaks`
- `Needs enrichment`
- `Independent worker`
- `Low academic confidence`

Example:

```csv
Needs strong routine;Needs reassurance
```

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
- `3` = solid neutral/default support
- `4` = strong support for that need
- `5` = standout strength for that need

## How tags align to teacher ratings

The engine compares student tags to these teacher characteristics:

- `Needs strong routine` -> `classroomStructure`, `behaviorManagementStrength`
- `Needs frequent redirection` -> `behaviorManagementStrength`, `classroomStructure`
- `Easily frustrated` -> `emotionalSupportNurturing`, `confidenceBuilding`
- `Needs reassurance` -> `emotionalSupportNurturing`, `confidenceBuilding`
- `Sensitive to correction` -> `emotionalSupportNurturing`, `confidenceBuilding`
- `Easily influenced by peers` -> `peerSocialCoaching`, `classroomStructure`
- `Needs positive peer models` -> `peerSocialCoaching`, `classroomStructure`
- `High energy` -> `movementFlexibility`, `behaviorManagementStrength`
- `Needs movement breaks` -> `movementFlexibility`
- `Needs enrichment` -> `academicEnrichmentStrength`
- `Independent worker` -> `independenceScaffolding`
- `Low academic confidence` -> `confidenceBuilding`, `emotionalSupportNurturing`

## Teacher import ordering

Teacher rows are assigned to classrooms in CSV order within each grade.

That means:

- the first imported teacher for a grade is matched to the first classroom for that grade
- the second imported teacher is matched to the second classroom
- and so on

If you want a specific teacher order across rooms, order the teacher rows that way in the CSV.

## Practical example

Student row:

```csv
1001,K,Amaya,Brooks,F,IEP,30,0,0,30,0,0,0,3,2,1002,1003,62,,,,,1,TRUE,FALSE,Black,Needs strong routine;Needs reassurance,Needs a calm predictable start to the day
```

Teacher row:

```csv
K,Ms. GradeKA,5,4,5,3,3,4,4,5
```

That teacher profile is a strong fit for:

- `Needs strong routine`
- `Needs reassurance`
- students who benefit from emotional support and confidence building

## Notes

- Student imports do not assign students to teachers.
- Teacher imports do not lock students.
- Locking happens only inside the app.
- Poor teacher fits are highlighted with purple student name text after placement.

