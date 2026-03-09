# Classroom Placement Engine: Logic Definition

This document reflects the current app behavior, including separate teacher import, kindergarten Brigance scoring, and the simplified tag-based Classroom Support Load Index.

## 1. State model

### Student

Each student record includes:

- Identity: `id`, `firstName`, `lastName`, `grade`
- Demographics/context: `gender`, `ell`, `section504`, `raceEthnicity`, `teacherNotes`
- Support profile:
  - `specialEd.status` (`None`, `IEP`, `Referral`)
  - `intervention.academicTier` (`1-3`)
  - `behaviorTier` (`1-3`)
  - `referrals`
  - `coTeachMinutes` by category
  - `tags`
- Assessment inputs:
  - `briganceReadiness`
  - `mapReading`
  - `mapMath`
  - `ireadyReading`
  - `ireadyMath`
- Relationship inputs: `noContactWith`, `preferredWith`
- Placement control: `locked`

### Teacher profile

Each teacher profile includes:

- `grade`
- `teacherName`
- eight `1-5` characteristic ratings:
  - `classroomStructure`
  - `behaviorManagementStrength`
  - `emotionalSupportNurturing`
  - `academicEnrichmentStrength`
  - `independenceScaffolding`
  - `movementFlexibility`
  - `peerSocialCoaching`
  - `confidenceBuilding`

### App state

Top-level state stores classrooms, students, teacher profiles, weights, snapshots, grade settings, relationship rules, unresolved reasons, and placement warnings.

Derived tag-load values are recomputed from `student.tags`; they are not persisted separately.

## 2. Simplified student tag schema

The public student tag set is now:

- `Needs structure`
- `Needs redirection support`
- `Needs emotional reassurance`
- `Needs peer support`
- `Needs movement support`
- `Needs academic enrichment`
- `Independent worker`

Older detailed labels are still accepted during import and persisted-state normalization. They are mapped into the simplified labels before scoring.

Legacy normalization map:

- `Needs strong routine` -> `Needs structure`
- `Needs frequent redirection` -> `Needs redirection support`
- `Easily frustrated` -> `Needs emotional reassurance`
- `Needs reassurance` -> `Needs emotional reassurance`
- `Sensitive to correction` -> `Needs emotional reassurance`
- `Easily influenced by peers` -> `Needs peer support`
- `Needs positive peer models` -> `Needs peer support`
- `High energy` -> `Needs movement support`
- `Needs movement breaks` -> `Needs movement support`
- `Needs enrichment` -> `Needs academic enrichment`
- `Low academic confidence` -> `Needs emotional reassurance`

## 3. Defaults

Default weights:

- `academic = 50`
- `behavioral = 50`
- `demographic = 50`
- `tagSupportLoad = 50`

## 4. Import flow

The app still has two separate CSV imports:

1. student import
2. teacher import

### Student import

Required mapped columns:

- `id`
- `grade`
- `firstName`
- `lastName`

Key parsing behavior:

- IDs must be unique positive integers.
- Invalid or duplicate IDs are skipped.
- `studentTags` accepts semicolon, comma, or pipe separators inside the field.
- Simplified labels are accepted directly.
- Older detailed labels are accepted and normalized into the simplified set.
- Unknown tags are warned and ignored.
- Duplicate tags that collapse into the same simplified label are deduplicated.

Persisted-state normalization applies the same tag simplification so older saved data stays usable.

### Teacher import

Teacher CSV requirements are unchanged.

## 5. Placement execution order

Auto-placement still runs in this order:

1. reject rooms that fail hard constraints
2. compare teacher-fit penalty across surviving rooms
3. if teacher-fit ties, compare the weighted soft score
4. place into the lowest-ranked room
5. leave the student unassigned if no room survives hard constraints

The teacher-fit comparison order is unchanged.

## 6. Hard constraints

Hard constraints are unchanged:

- room capacity
- required co-teach coverage
- IEP cap
- referral cap
- no-contact conflicts

## 7. Teacher fit with simplified tags

Teacher fit is still evaluated after hard constraints and before weighted balancing.

The simplified tag-to-teacher alignment is now:

- `Needs structure` -> `classroomStructure`, `behaviorManagementStrength`
- `Needs redirection support` -> `behaviorManagementStrength`, `classroomStructure`
- `Needs emotional reassurance` -> `emotionalSupportNurturing`, `confidenceBuilding`
- `Needs peer support` -> `peerSocialCoaching`, `classroomStructure`
- `Needs movement support` -> `movementFlexibility`, `behaviorManagementStrength`
- `Needs academic enrichment` -> `academicEnrichmentStrength`
- `Independent worker` -> `independenceScaffolding`

Poor-fit marking behavior is unchanged.

## 8. Existing support load

The original support-load model remains:

`academicTier + behaviorTier + statusBonus + referrals + coTeachLoad`

This existing support load is still used for student sort priority and existing room summaries.

## 9. Simplified tag-based Classroom Support Load Index

The tag-based model remains additive and derived only from `student.tags`.

### Per-tag weights

- `Needs structure = 3`
- `Needs redirection support = 4`
- `Needs emotional reassurance = 4`
- `Needs peer support = 3`
- `Needs movement support = 3`
- `Needs academic enrichment = 1`
- `Independent worker = -1`

### Per-student derived value

- `studentTagSupportLoad`

### Per-room derived values

- `classroomTagSupportLoad`
- `behavioralTagSupportLoad`
- `emotionalTagSupportLoad`
- `instructionalTagSupportLoad`
- `energyTagSupportLoad`

### Category grouping

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

## 10. Weighted soft balancing

If rooms tie on teacher-fit penalty, the engine falls through to the weighted room score.

Current formula:

`loadScore + academicPenalty + behavioralPenalty + demographicPenalty + preferredTogetherAdjustment + doNotSeparateAdjustment + settingsPenalty + tagSupportLoadPenalty`

### `tagSupportLoadPenalty`

This term evaluates the projected room after placing the candidate student.

It adds pressure when the projected room:

- rises farther above the grade-level average total tag load
- becomes behaviorally, emotionally, instructionally, or energy-heavy relative to the grade average
- becomes the highest total tag-load room by a meaningful margin

## 11. Kindergarten Brigance rule

For grade `K` only:

- `briganceReadiness` is used for both reading and math balancing
- MAP and i-Ready are ignored for placement scoring

## 12. Warnings and UI surfaces

The UI now surfaces simplified tag-load explainability in existing views:

- student cards show per-student tag load badges when tags are present
- student tooltips show contributing tags, room total tag load, grade average, and room impact
- classroom columns show total and category tag-load quick stats
- summary cards show total and category tag-load metrics and highlight rooms above grade average
- top-level warning chips summarize total and worst-category tag-load imbalance
- manual-move warnings add non-blocking tag-load imbalance warnings alongside the existing hard-constraint warnings

## 13. Snapshots and export

Snapshots remain grade-specific and do not separately version teacher profiles.

Exports remain reporting-oriented and still include student reporting fields plus `assignedTeacher`.
Derived tag-load values are not exported as additional columns.

## 14. Lightweight tests

The repo includes lightweight logic tests for:

- simplified student tag-load derivation
- room total/category tag-load derivation
- projected tag-load penalty behavior
- parsing compatibility for both simplified and legacy tag labels
