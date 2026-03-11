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
- `assignedTeacher`

Tier columns can be entered either as plain numbers or as notes that contain tier values, such as `Reading - Tier 2; Math - Tier 3`. The app preserves that text on the student summary and sums the tier values into the support score.

`ell` accepts `EL`, `ELL`, `RFEP 1-4`, and standard truthy values.

Student imports are additive. You can import a second student CSV later, and the app only adds rows whose `id` is not already in the current roster.

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

Example:

```csv
1001;1004;1012
```

## Student characteristics

Use the `studentCharacteristics` column for both:

- teacher-fit comparison
- characteristic-based Classroom Support Load derivation

Enter one or more of these exact labels, separated by semicolons, commas, or pipes inside the field:

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

Example:

```csv
Needs strong routine;Needs reassurance
```

### Characteristic support-load weights

These weights are derived automatically in the app. Do not add extra columns for them.

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

### Characteristic categories used in room balancing

Behavioral:

- `Needs strong routine`
- `Needs frequent redirection`
- `Struggles with peer conflict`

Emotional:

- `Easily frustrated`
- `Needs reassurance`
- `Sensitive to correction`
- `Low academic confidence`

Instructional:

- `Needs enrichment`
- `Independent worker`

Energy:

- `High energy`
- `Needs movement breaks`

## Teacher template

File:

- `public/teacher-import-template.csv`

Required columns:

- `grade`
- `teacherName`
- `structure`
- `regulationBehaviorSupport`
- `socialEmotionalSupport`
- `instructionalExpertise`

Teacher profile scores are entered in the CSV as `1-5`, but those numbers are hidden in the app UI after import.

### Teacher characteristics

The teacher columns mean:

- `structure`
- `regulationBehaviorSupport`
- `socialEmotionalSupport`
- `instructionalExpertise`

## How characteristics align to teacher characteristics

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
1001,K,Amaya,Brooks,F,IEP,30,0,0,30,0,0,0,"Reading - Tier 2; Math - Tier 3","Check-In - Tier 2",1002,1003,62,,,,,1,RFEP 1-4,FALSE,Black,Needs strong routine;Needs reassurance,Needs a calm predictable start to the day
```

Teacher row:

```csv
K,Ms. GradeKA,5,4,5,3
```

That student contributes `4` points of characteristic support load from:

- `Needs strong routine = 2`
- `Needs reassurance = 2`

That teacher profile is also a strong fit for those same characteristics.

## Notes

- Student imports can include `assignedTeacher` if you want to seed a student into a matching teacher room.
- Repeated student imports ignore duplicate `id` values instead of overwriting the existing student record.
- Teacher imports do not lock students.
- Locking happens only inside the app.
- Poor teacher fits are highlighted after placement, but the underlying teacher profile scores remain hidden in the app.
- The templates do not include extra columns for derived support-load totals because the app computes them from `studentCharacteristics`.
- The parser still accepts legacy `studentTags` headers and retired characteristic labels for backward compatibility.

