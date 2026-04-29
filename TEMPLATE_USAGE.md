# CSV Template Guide

This guide explains the student and teacher templates shipped with the app.

## Student template

Template file:

- [student-import-template.csv](public/student-import-template.csv)

Full example template:

- [student-import-full-template.csv](public/student-import-full-template.csv)

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
- `parentRequestStayTogether`
- `parentRequestKeepApart`
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
- `avoidTeachers`
- `linkedClassroom` — see Linked Classroom Group below

### Student import behavior

- `id` must be a unique positive integer.
- `grade` accepts `K`, kindergarten-style values, and grades `1` through `5`.
- Rows with unrecognized `grade` values are skipped and reported as import errors.
- `academicTier` and `behaviorTier` can be plain numbers or note text containing `Tier 1`, `Tier 2`, or `Tier 3`.
- `ell` accepts common truthy values plus `EL`, `ELL`, and `RFEP 1-4`.
- Student re-imports update existing students when the same `id` appears again.
- `assignedTeacher` creates a teacher-fixed placement when a matching room is available.
- `avoidTeachers` accepts teacher names separated by semicolons, commas, pipes, or line breaks.
- Students with `avoidTeachers` stay out of matching teacher classrooms during placement unless a manual override is confirmed.
- If `assignedTeacher` and `avoidTeachers` conflict, the student stays unresolved instead of being force-placed into that blocked classroom.
- If a teacher-fixed student cannot be seated in the matching room, the app keeps that student unresolved and flags the reason instead of placing the student somewhere else.

### Master roster blend requirement

If you are combining multiple student files, the master roster only needs to provide:

- `id`
- `firstName`
- `lastName`
- `Person ID`
- `State ID`
- `Student ID / Number`

`grade` and `gender` are optional in the master roster for blend imports. If the master file does not contain `grade`, map it from one of the supplemental files.

### Relationship columns

Use student IDs separated by commas, semicolons, pipes, or spaces.

- `noContactWith`
- `preferredWith`
- `parentRequestStayTogether`
- `parentRequestKeepApart`

`preferredWith`, `parentRequestStayTogether`, and `parentRequestKeepApart` are limited to same-grade peers. Parent request columns are soft, lower-priority requests; staff no-contact rules and managed relationship rules stay stronger.
Multi-year no-contact rules are managed in the app UI rather than the CSV template so they can continue following the same students after grade changes.

### Linked Classroom Group column

Use `linkedClassroom` (or common aliases like `linkedGroup`, `classLink`, `keepTogetherGroup`) to link students together so the engine keeps them in the same classroom.

**Rules:**

- The column value is a label — typically a letter like `A`, `B`, `C`, or `D`, but any consistent text works.
- Students in the **same grade** with the **same label** are linked together (hard constraint).
- Students in **different grades** with the same label are **not** linked — the grade always scopes the grouping.
- Groups of two students produce one LINKED rule. Groups of three or more produce all pairwise combinations so every member is directly constrained to every other.
- Linked rules are hard: once one student in a group is placed, the rest can only go to that same room.
- The import review screen shows a count of LINKED pair rules created. A summary note is added to the import confirmation message.

**Example spreadsheet layout:**

| id   | grade | firstName | lastName | linkedClassroom |
|------|-------|-----------|----------|-----------------|
| 1001 | 3     | Ana       | Rivera   | B               |
| 1002 | 3     | Marcus    | Lee      | B               |
| 1003 | 4     | Jordan    | Kim      | B               |

In this example, Ana and Marcus (both grade 3, both labeled `B`) are linked together and will be placed in the same classroom. Jordan (grade 4, also labeled `B`) is not linked to them because they are in different grades.

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
- `Extended time for assignments`
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

- Teacher imports try to keep existing teacher-room matches by teacher name, even if the rows appear in a different order than before.
- Rows with unrecognized `grade` values are skipped and reported as import errors.
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
- `Extended time for assignments` -> `Instructional Expertise`, `Structure`
- `Needs enrichment` -> `Instructional Expertise`, `Structure`
- `Independent worker` -> `Instructional Expertise`, `Structure`
- `Low academic confidence` -> `Social/Emotional Support`, `Instructional Expertise`
