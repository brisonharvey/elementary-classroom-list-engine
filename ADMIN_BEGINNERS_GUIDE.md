# Beginner's Guide for School Staff

This guide is for administrators, counselors, and office staff who want to build classroom rosters without digging into the code or placement math.

## What the app does

The app helps you build balanced rosters for grades `K` through `5`.

You can:

- import students and teachers from separate files
- import either CSV or XLSX files
- follow a built-in guided setup panel
- auto-place one grade at a time
- manage no-contact, keep-together, and blocked-teacher rules
- drag students manually between rooms
- lock students in place
- compare versions with snapshots
- export final rosters to CSV
- open a print-ready PDF packet for one grade level

Your data is saved locally on the current computer.

## Before you start

Have these ready:

- a student CSV
- a teacher CSV
- any no-contact pairs or important pairings
- rough decisions about number of classrooms by grade

Important reminders:

- Each student needs a unique `id`.
- Student re-imports update existing students when the same `id` appears again.
- Teacher import does not move students by itself.
- `Clear All` removes saved work and snapshots from this device and brings back the guided setup panel.

## Main areas of the app

- `Import CSV` opens the student and teacher import panel.
- `Grade` selector changes the active grade.
- `Auto-Place Grade`, `Reset Grade`, and export buttons are in the top controls.
- the guided setup panel appears near the top when the app still needs student or teacher imports
- `Unassigned` on the left holds students not currently in a room.
- Classroom columns fill the center workspace.
- `Show Summary` opens a grade summary drawer.
- `Show Snapshots` opens the snapshot panel.
- `Rules Manager` and `Settings` open grade tools.

Reference screenshots:

![Workspace overview](docs/reference/app-overview.png)

![Rules Manager](docs/reference/rules-manager.png)

## Recommended order

1. Import students.
2. Import teachers.
3. Choose the grade you want to work on.
4. Review classrooms, imported teacher names, room sizes, and co-teach coverage.
5. Add no-contact or keep-together rules.
   Add blocked-teacher rules or multi-year no-contact rules if needed.
6. Run auto-placement.
7. Review warnings and the summary drawer.
8. Make manual moves if needed.
9. Lock placements you want to preserve.
10. Save a snapshot.
11. Export the roster.

## Student import

The app includes [student-import-template.csv](public/student-import-template.csv) and [sample-students.csv](public/sample-students.csv).

Required student columns:

- `id`
- `grade`
- `firstName`
- `lastName`

Helpful optional columns:

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
- `studentCharacteristics`
- `teacherNotes`
- `assignedTeacher`
- `avoidTeachers`

If you are using the student blend import with a master roster plus extra files, the master roster must include:

- `id`
- `firstName`
- `lastName`
- `Person ID`
- `State ID`
- `Student ID / Number`

`grade` and `gender` are optional in that master file. If the master file does not have grade, map it from one of the other student files before importing.

Use `avoidTeachers` when a student should not be placed with one or more specific teachers, even if those classrooms otherwise fit.

Kindergarten tip:

- Use `briganceReadiness` for kindergarten if you want readiness scores included in placement.
- If a student row has an invalid grade label, the app skips that row and shows an import error instead of guessing.

## Teacher import

The app includes [teacher-import-template.csv](public/teacher-import-template.csv) and [sample-teachers.csv](public/sample-teachers.csv).

Required teacher columns:

- `grade`
- `teacherName`
- `structure`
- `regulationBehaviorSupport`
- `socialEmotionalSupport`
- `instructionalExpertise`

Teacher ratings are `1` to `5`.

Teacher imports try to preserve existing teacher-room matches by teacher name, so changing the row order does not normally rename filled classrooms.
If a teacher row has an invalid grade label, the app skips that row and shows an import error.

If you import an XLSX workbook, you can choose the sheet and adjust header-row preprocessing before mapping columns.

## Before auto-placement

Check these items first:

- Is the correct grade selected?
- Do you have the right number of classrooms?
- Are teacher names correct?
- Are room capacities correct?
- Does each room have the right co-teach coverage?

Useful room controls:

- `Add Classroom`
- `Delete Classroom` lets you choose which room to remove when a grade has more than one classroom
- click a teacher name to edit it
- edit room capacity
- use the `Co-teach` menu in the room header

## Rules Manager

Use `Rules Manager` to review and add rules for the active grade.

Rule types:

- `No Contact`: hard rule, students cannot be placed together
- `Do Not Separate`: soft rule, the engine tries to keep them together
- `Teacher Restriction`: keeps one student out of a named teacher's classroom

You can also mark a no-contact rule as multi-year so it stays attached to those same students after they move into later grades.

Imported `noContactWith` values also appear here.
Student ID lists in imports can use commas, semicolons, pipes, or spaces.

## Settings

Use `Settings` to tune grade-specific limits and balancing pressure.

Most teams can start with defaults and only change:

- room limits
- gender tolerance
- class-size tolerance
- characteristic-load pressure if support-heavy students are clustering

## Auto-placement

`Auto-Place Grade X` places unlocked students for the current grade only.

The engine:

1. filters out rooms that break hard rules
2. prefers the best teacher fit
3. uses weighted balancing to break ties

Students with an `assignedTeacher` stay teacher-fixed.
If the matching classroom is missing, full, or blocked by another hard rule, the app leaves that student unresolved and shows the reason.
Blocked teacher classrooms are also treated as hard rules during placement.
Those teacher-fixed warnings stay visible even if you later edit another student or relationship rule.

Students that cannot be placed stay in `Unassigned` with reasons shown underneath.

## Reading the results

After auto-placement, review:

- the placement warnings popup
- warning chips across the workspace
- the summary drawer

These help you spot:

- unresolved students
- gender imbalance
- academic spread
- support-load concentration
- characteristic-load concentration
- poor teacher fit

## Manual changes

You can drag a student from one room to another or back to `Unassigned`.

Student card actions:

- `Edit` updates student details
- lock/unlock preserves or releases a placement
- teacher-fixed students stay locked until you clear `Assigned Teacher` in `Edit`

Manual moves can show warnings before they are applied, including `Do Not Separate` soft-rule conflicts, blocked teacher classrooms, and teacher-fixed overrides.
The app also blocks invalid reducer-level moves such as cross-grade drops or moves into full rooms unless the current drag flow has already confirmed an override.

## Snapshots and export

Snapshots let you save a version of one grade and restore it later.

Use export when you are ready to share or archive results:

- `Export Grade X`
- `Export All`
- `Print Grade PDF`

`Print Grade PDF` opens a print view that is meant for teacher sharing. It hides teacher-rating details, includes a student-card key, and tries to keep one classroom per page.

Exports are reports, not full backups of app state.
If a room does not have a teacher name yet, exported `assignedTeacher` cells stay blank unless the student has an `assignedTeacher` value on the roster.
Blocked teacher classroom lists are exported as `avoidTeachers` so the restriction can travel with the student roster.
