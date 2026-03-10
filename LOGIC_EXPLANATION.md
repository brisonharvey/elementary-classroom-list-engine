# Classroom Placement Engine: Logic Definition

This document reflects the current app behavior, including separate teacher import, kindergarten Brigance scoring, and the additive characteristic-based Classroom Support Load model.

## 1. State model

### Student

Each student record includes:

- Identity: `id`, `firstName`, `lastName`, `grade`
- Demographics/context: `gender`, `ell`, `section504`, `raceEthnicity`, `teacherNotes`
- Support profile:
  - `specialEd.status` (`None`, `IEP`, `Referral`)
  - `intervention.academicTier` (numeric support score, defaults to `1`)
  - `behaviorTier` (numeric support score, defaults to `1`)
  - optional `academicTierNotes` / `behaviorTierNotes` raw import text
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
- four internal `1-5` characteristic scores:
  - `structure`
  - `regulationBehaviorSupport`
  - `socialEmotionalSupport`
  - `instructionalExpertise`

Those scores are used by the engine and hidden in the app UI after import.

### Classroom

Each room includes:

- `id`, `grade`, `label`, `teacherName`
- `maxSize`
- `coTeachCoverage`
- `students`

### App state

Top-level state stores:

- `allStudents`
- `teacherProfiles`
- `classrooms`
- `activeGrade`
- `showTeacherNames`
- `weights`
- `snapshots`
- `relationshipRules`
- `gradeSettings`
- `unresolvedReasons`
- `placementWarnings`

Derived characteristic-load values are recomputed from `student.tags`; they are not persisted separately.

## 2. Defaults

On a clean load, the app creates:

- grades `K` through `5`
- four classrooms per grade
- default room size `28`
- default room labels `A`, `B`, `C`, `D`
- default co-teach coverage of `reading` for the first room in each grade, and none for the others

Default grade settings per grade:

- `maxIEPPerRoom = 6`
- `maxReferralsPerRoom = 6`
- `ellConcentrationSoftCap = 0.35`
- `genderBalanceTolerance = 2`
- `classSizeVarianceLimit = 3`

Default weights:

- `academic = 50`
- `behavioral = 50`
- `demographic = 50`
- `tagSupportLoad = 50`

## 3. Import flow

The app has two separate CSV imports:

1. student import
2. teacher import

Both use upload, header mapping, and import confirmation.

### Student import

Required mapped columns:

- `id`
- `grade`
- `firstName`
- `lastName`

Key parsing behavior:

- IDs must be unique positive integers.
- Invalid or duplicate IDs are skipped.
- Grades accept `K`, `0`, `KG`, kindergarten-like strings, numeric grades, and ordinal strings like `1st`.
- Gender defaults to `M` unless the mapped value is exactly `F`.
- Academic and behavior tiers default to `1`.
- Academic and behavior tier cells can also contain descriptive notes with one or more `Tier X` values. The parser preserves the original text and sums the tier values into the numeric support score.
- Co-teach minutes are parsed per category and clamped.
- Legacy `requiresCoTeachReading` and `requiresCoTeachMath` still convert to 30 minutes.
- `ell` accepts `el`, `ell`, `rfep 1-4`, `true`, `1`, `yes`, or `y`.
- `section504` accepts standard truthy boolean strings.
- `studentCharacteristics` accepts semicolon, comma, or pipe separators inside the field and normalizes to the supported exact labels.
- `assignedTeacher` is optional and is used to seed a student into a matching teacher room when possible.
- Legacy `studentTags` headers and retired peer-related labels are still accepted and mapped forward.
- Unknown characteristics are warned and ignored.

Relationship normalization:

- `noContactWith` and `preferredWith` accept `,`, `;`, or `|`
- unknown IDs generate warnings
- self-references are removed
- `preferredWith` is limited to same-grade peers and deduplicated

Student load behavior:

- classrooms are rebuilt from the default grade structure
- imported teacher profiles are re-applied if teacher data already exists
- imported students start unlocked unless `assignedTeacher` is provided
- snapshots, relationship rules, unresolved reasons, and placement warnings are cleared

### Teacher import

Required mapped columns:

- `grade`
- `teacherName`
- all four teacher characteristic columns

Teacher parsing behavior:

- duplicate teacher names within the same grade are skipped
- invalid or missing scores default to `3` with warnings
- scores are clamped to `1..5`
- legacy eight-column teacher sheets are auto-mapped when headers match known older names

Teacher load behavior:

- teacher rows are assigned to classrooms in CSV order within each grade
- if a grade imports more teachers than existing rooms, rooms are added
- imported teacher names overwrite room teacher names for grades present in the import
- students remain where they are when teacher data is loaded later
- placement warnings and unresolved reasons are cleared because teacher-fit outcomes may change

## 4. Persistence

State is persisted to `classroom-placement-state-v5` with fallback reads from older keys.

Persisted-state normalization still handles:

- relationship ID lists
- legacy student co-teach flags
- legacy classroom co-teach toggles
- missing classroom labels
- missing grade settings
- retired student characteristics
- retired eight-field teacher characteristics
- missing `tagSupportLoad` weight by merging with current defaults

## 5. Placement execution order

Auto-placement runs for the active grade only.

For each student candidate:

1. reject rooms that fail hard constraints
2. compare teacher-fit penalty across surviving rooms
3. if teacher-fit ties, compare the weighted soft score
4. place into the lowest-ranked room
5. leave the student unassigned if no room survives hard constraints

### Student priority sort

Students are sorted by:

1. any co-teach need before none
2. higher total co-teach minutes first
3. `IEP` before `Referral` before `None`
4. higher existing support load first

## 6. Hard constraints

A room is rejected when any of these checks fail:

- room size is already at or above `maxSize`
- room lacks required co-teach coverage for the student
- placing an `IEP` student would exceed `maxIEPPerRoom`
- placing a `Referral` student, or a student with `referrals > 0`, would exceed `maxReferralsPerRoom`
- a no-contact conflict exists through:
- the student's `noContactWith`
- another student's `noContactWith`
  - a grade `NO_CONTACT` relationship rule

Hard-constraint messages are reused in unresolved placement warnings and manual-move warnings.

## 7. Teacher fit

Teacher fit is evaluated after hard constraints and before the weighted score.

Teacher-fit inputs:

- student characteristics
- matching teacher profile for the room�s `grade + teacherName`

If no teacher profiles are loaded, teacher fit is neutral.

If teacher profiles exist but a room�s teacher name does not match an imported profile, the engine applies a neutral-but-not-best fallback penalty so rooms with imported matching profiles are preferred.

### Characteristic-to-teacher alignment

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

### Poor-fit marking

A placement is marked poor-fit when the teacher-fit penalty crosses the current poor-fit threshold.

Poor fits are surfaced by:

- student-card poor-fit badge and styling
- tooltip teacher-fit status
- room/grade poor-fit counts
- placement warning count after auto-place

Teacher profile scores themselves are never shown in the app UI.

## 8. Existing support load

The original support-load model remains:

`academicTier + behaviorTier + statusBonus + referrals + coTeachLoad`

If a tier field was imported with note text like `Reading - Tier 2; Math - Tier 3`, the support-load formula uses the summed numeric value (`5` in that example) while the raw note text remains available in the student UI and exports.

Where:

- `statusBonus = 2` for `IEP`
- `statusBonus = 1` for `Referral`
- `statusBonus = 0` for `None`
- `coTeachLoad = totalCoTeachMinutes / 60`, clamped to `0..2`

This existing support load is still used for student sort priority and existing room summaries.

## 9. Characteristic-based Classroom Support Load

The additive classroom-support model is derived only from `student.tags` / imported student characteristics.

### Per-characteristic weights

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

## 10. Weighted soft balancing

If rooms tie on teacher-fit penalty, the engine falls through to the weighted room score.

Current formula:

`loadScore + academicPenalty + behavioralPenalty + demographicPenalty + preferredTogetherAdjustment + doNotSeparateAdjustment + settingsPenalty + tagSupportLoadPenalty`

### Additive term: `tagSupportLoadPenalty`

`tagSupportLoadPenalty` evaluates the projected room after placing the candidate student.

It adds pressure when the projected room:

- rises farther above the grade-level average total characteristic load
- becomes behaviorally, emotionally, instructionally, or energy-heavy relative to the grade average
- becomes the highest total characteristic-load room by a meaningful margin

This term is weighted by the `tagSupportLoad` slider and is only used inside the post-teacher-fit soft score.

## 11. Reading, math, and Brigance derivations

### MAP band conversion

The engine converts numeric assessment values into four bands:

- missing -> `2.5`
- `< 25` -> `1`
- `< 50` -> `2`
- `< 75` -> `3`
- otherwise -> `4`

### i-Ready conversion

Supported labels match `Early|Mid|Late` plus `K|1|2|3|4|5`.

The engine:

1. converts the label grade to a numeric level
2. subtracts the student's grade level
3. applies timing offset (`Early -0.3`, `Mid 0`, `Late +0.3`)
4. converts to a `1..4` score with `relative + 2.5`

### Kindergarten Brigance rule

For grade `K` only:

- `briganceReadiness` is used for both reading and math balancing
- MAP and i-Ready are ignored for placement scoring

For grades `1-5`:

- reading score uses MAP reading and i-Ready reading
- math score uses MAP math and i-Ready math

## 12. Warnings and unresolved students

Placement warnings include:

- missing grade-level co-teach coverage
- unresolved student count
- grouped unresolved hard-constraint reasons
- poor teacher-fit count when applicable

Top-level workspace warning chips include:

- gender imbalance beyond tolerance
- reading spread across rooms
- math spread across rooms
- original support-load imbalance
- total characteristic-support-load imbalance
- largest characteristic category imbalance when it becomes meaningful

For kindergarten, the reading chip uses Brigance wording.

## 13. Manual placement behavior

Drag-and-drop still supports:

- unassigned -> room
- room -> room
- room -> unassigned

Before a manual move into a room, the app still warns about hard constraints.

Additional non-blocking warnings now surface when a move would:

- create the highest total characteristic-load room in the grade
- create the highest behavioral characteristic-load room in the grade
- significantly increase emotional, instructional, or energy imbalance

Users can still override the warning and proceed.

## 14. UI surfaces

The UI surfaces characteristic-load explainability in placement views:

- student cards show per-student characteristic-load badges when characteristics are present
- student tooltips show contributing characteristics, room total characteristic load, grade average, and the student's room impact
- classroom columns show total and category characteristic-load quick stats
- summary cards show total and category characteristic-load metrics and highlight rooms materially above grade average
- top-level warning chips summarize total and worst-category characteristic-load imbalance
- teacher profile scores remain hidden everywhere in the app UI

## 15. Snapshots and export

Snapshots remain grade-specific and store:

- grade classrooms only
- grade settings only
- snapshot metadata

Teacher profiles are still not versioned separately in snapshots.

Exports remain reporting-oriented.

They include student reporting fields plus `studentCharacteristics` and `assignedTeacher`.
Derived support-load values are not exported as additional columns.

## 16. Lightweight tests

The repo includes lightweight logic tests for:

- student characteristic-load derivation
- room total/category characteristic-load derivation
- projected characteristic-load penalty behavior
- backward-compatible student characteristic parsing
- grade-settings copy-to-all behavior





