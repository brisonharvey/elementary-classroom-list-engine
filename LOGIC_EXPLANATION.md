# Placement Logic Reference

This document describes the current placement behavior implemented by the app.

## Core state

The app stores:

- `allStudents`
- `teacherProfiles`
- `classrooms`
- `activeGrade`
- `weights`
- `gradeSettings`
- `relationshipRules`
- `snapshots`
- `unresolvedReasons`
- `placementWarnings`

Classrooms keep student copies for UI placement, while `allStudents` remains the source roster.

## Placement order

Auto-placement runs for the active grade only.

For each unlocked student, the engine:

1. checks hard constraints for every room
2. compares teacher-fit penalty for valid rooms
3. uses weighted soft scoring to break teacher-fit ties
4. places the student into the best remaining room
5. leaves the student unassigned if every room fails hard constraints

Students are processed in this order:

1. students with any co-teach need
2. students with more total co-teach minutes
3. `IEP` before `Referral` before `None`
4. students with higher existing support load

## Hard constraints

A room is rejected when placement would:

- exceed room capacity
- miss required co-teach coverage
- exceed `maxIEPPerRoom`
- exceed `maxReferralsPerRoom`
- violate a no-contact relationship
- violate a student's blocked-teacher classroom restriction

No-contact checks come from both student data and managed rules. Managed no-contact rules can be grade-only or multi-year.

## Teacher fit

Teacher fit is evaluated after hard constraints and before soft scoring.

Teacher fit uses:

- the student's `studentCharacteristics`
- the room's matching teacher profile for `grade + teacherName`

If no teacher profiles are loaded, teacher fit is neutral.

If profiles exist but a room does not match one, that room gets a neutral-but-not-best fallback penalty.

## Soft balancing

The weighted scoring layer balances:

- class size pressure
- academic need
- behavior need
- demographic balance
- preferred-peer requests
- do-not-separate rules
- characteristic-based support load

The top-level weight sliders control academic, behavioral, class-size-plus-demographic, and characteristic-load pressure.

## Characteristic-based support load

The app derives an additive support signal from `studentCharacteristics`.

That derived load appears in:

- room headers
- student cards
- summary drawer
- warning chips
- manual move warnings

The engine also tracks category-specific load for:

- behavioral
- emotional
- instructional
- energy

## Kindergarten behavior

Grade `K` uses `briganceReadiness` for academic balancing.

Grades `1` through `5` use MAP and i-Ready inputs.

## Imports

Student import:

- requires `id`, `grade`, `firstName`, and `lastName`
- updates existing students when the same `id` is re-imported
- skips rows with unrecognized grade values and reports them as import errors
- can seed students into a matching teacher room using `assignedTeacher`
- can store blocked teacher classrooms through `avoidTeachers`
- keeps teacher-fixed students unresolved when the matching room is unavailable or blocked instead of auto-placing them elsewhere
- accepts `noContactWith` and `preferredWith` lists separated by commas, semicolons, pipes, or spaces

Teacher import:

- preserves existing teacher-room matches by teacher name when possible
- skips rows with unrecognized grade values and reports them as import errors
- adds rooms when a grade imports more teachers than existing rooms
- updates room teacher names without clearing current placements
- supports XLSX sheet selection and header preprocessing before field mapping

## Snapshots

Snapshots store:

- classroom placements for one grade
- grade settings for that grade

Snapshots do not replace the overall student roster.

## Exports

Exports are report CSVs built from the current roster and placements.

They include:

- student identity and support fields
- relationship fields
- assessments
- demographics
- assigned teacher names only when a room or roster record actually has one
- blocked teacher classroom lists
- staff notes
- assigned teacher
