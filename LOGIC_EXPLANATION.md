# Classroom Placement Engine: Logic Definition

This document describes the current placement and UI behavior implemented in the app.

## 1. Data model

### Student

Each student includes:

- Identity and grade: `id`, `firstName`, `lastName`, `grade`
- Demographics/context: `gender`, `ell`, `section504`, `raceEthnicity`
- Support profile:
  - `specialEd.status` (`None`, `IEP`, `Referral`)
  - `intervention.academicTier` (1-3)
  - `behaviorTier` (1-3)
  - `referrals`
  - `coTeachMinutes` by category
- Assessment inputs: `mapReading`, `mapMath`, `ireadyReading`, `ireadyMath`
- Relationship inputs: `noContactWith`, `preferredWith`
- Placement controls: `locked`, `preassignedTeacher`

### Classroom

Each room includes:

- `id`, `grade`, `label`, `teacherName`
- `maxSize`
- `coTeachCoverage` (supported co-teach categories)
- `students`

### Grade settings

Per grade, settings are:

- `maxIEPPerRoom` (hard)
- `maxReferralsPerRoom` (hard)
- `ellConcentrationSoftCap` (soft)
- `genderBalanceTolerance` (soft)
- `classSizeVarianceLimit` (soft)

## 2. Import and normalization

CSV import runs in two stages: preview/mapping, then parse with mapping.

### Parsing behavior

- Required mapped fields: `id`, `grade`, `firstName`, `lastName`.
- Invalid IDs skip rows.
- Grade parser supports `K`, `0`, `KG`, `Kind...`, `01-05`, ordinal strings (for 1-5).
- Tier parsing defaults to `1` unless explicit `2/3` (or yes/y => 2).
- Co-teach minutes are numeric, clamped to `0..999`.
- Legacy boolean co-teach flags can be converted to 30-minute defaults.
- `noContactWith` and `preferredWith` parse from `, ; |` separated ID tokens.

### Relationship normalization at import

- Unknown IDs in relationship lists generate warnings.
- Self references are removed.
- `preferredWith` is restricted to same-grade peers only.
- Duplicates are removed.

### Pre-assignment on load

When students are loaded into app state:

- Unique `(grade, preassignedTeacher)` combinations are mapped to rooms.
- Existing matching teacher rooms are reused.
- Empty rooms are reused first; new rooms are added if needed.
- Preassigned students are inserted into those rooms (up to room capacity) and marked locked.

## 3. Placement execution flow

Auto-place runs for the active grade only.

1. Clone classrooms.
2. In active-grade rooms, keep only locked students.
3. Build unplaced list from active-grade students not already locked in a room.
4. Sort by priority:
   - has co-teach need first
   - higher total co-teach minutes first
   - IEP before Referral before None
   - higher support load first
5. For each student, evaluate each active-grade room:
   - run hard constraints first
   - if valid, compute soft score
   - choose room with lowest score
6. If no valid room exists, mark student unresolved and capture reasons.
7. Return updated classrooms, unresolved reason map, and warnings.

## 4. Hard constraints (blocking)

A candidate room is rejected if any condition fails:

- Room is already at or above `maxSize`.
- Student requires co-teach categories not covered by room `coTeachCoverage`.
- Student with `IEP` would exceed `maxIEPPerRoom`.
- Student with `Referral` status or `referrals > 0` would exceed `maxReferralsPerRoom`.
- No-contact conflict exists via:
  - student CSV `noContactWith` list (either direction), or
  - grade-level `NO_CONTACT` relationship rule.

## 5. Soft scoring (minimize)

For each valid room, final score is:

`load + academicPenalty + behavioralPenalty + demographicPenalty + preferredAdjustment + doNotSeparateAdjustment + settingsPenalty`

### Components

- `load`: `(roomSize / maxSize) * 10`
- `academicPenalty`: mismatch between student academic need and room average, scaled by academic weight
- `behavioralPenalty`: mismatch between student behavioral need and room average, scaled by behavioral weight
- `demographicPenalty`: concentration pressure for gender/ELL/504/IEP/Referral, scaled by demographic weight
- `preferredAdjustment`:
  - peer already in same room: bonus (`-1.75`)
  - peer assigned to different room: penalty (`+1.25`)
- `doNotSeparateAdjustment`:
  - paired peer in same room: bonus (`-2.25`)
  - paired peer in different room: penalty (`+1.5`)
- `settingsPenalty` (scaled by demographic weight):
  - ELL ratio over soft cap
  - gender delta over tolerance
  - class-size variance over limit

## 6. Academic and support derivations

### MAP band conversion

- `<25 => 1`, `<50 => 2`, `<75 => 3`, otherwise `4`
- missing => neutral `2.5`

### i-Ready relative conversion

- Parse labels like `Early|Mid|Late K|1|2|3|4|5`
- Convert to relative offset from student grade
- Apply timing offsets: `Early -0.3`, `Late +0.3`
- Convert with `relative + 2.5`, clamped to `1..4`

### Student reading/math score

- Average of available MAP band and i-Ready converted score
- If no inputs, defaults to `2.5`

### Student support load

`academicTier + behaviorTier + specialEdBonus + referrals + coTeachLoad`

- `specialEdBonus`: IEP `+2`, Referral `+1`
- `coTeachLoad`: total co-teach minutes / 60, clamped `0..2`

## 7. Warnings and unresolved handling

Warnings include:

- Missing grade-level co-teach coverage for needed categories.
- Count of unresolved students.
- Grouped unresolved reasons by category (capacity, coverage, no-contact, IEP cap, referral cap, other).

Unresolved reasons are stored per student and shown in the unassigned panel.

## 8. Manual placement behavior

Drag-and-drop supports:

- Unassigned -> room
- Room -> room
- Room -> unassigned

Before dropping into a room, manual move warnings are computed with the same constraint checks. Users can proceed anyway after confirmation.

## 9. Snapshots and settings

Snapshots are grade-specific and include:

- Grade classrooms
- Grade settings at save time
- Name, optional note, created timestamp

Restore replaces only that grade's classrooms/settings and switches active grade to the snapshot grade.

## 10. Persistence and migration

State is persisted to `localStorage` key `classroom-placement-state-v2` (with fallback read from `-v1`).

Migration/normalization includes:

- Legacy co-teach booleans -> minute/category representation
- Student relationship list normalization
- Classroom co-teach coverage normalization
- Default grade settings backfill

Migration warnings are appended to placement warnings so users can review converted data.
