# Classroom Placement Engine: Logic and UI Explanation

## 1) Scoring Logic

The auto-placement algorithm assigns each candidate room a numeric score for each student. Lower scores are better.

### Student-level normalized signals

- **MAP scores** are converted into a 1–4 band:
  - `<25 => 1`, `<50 => 2`, `<75 => 3`, otherwise `4`.
  - Missing MAP defaults to neutral (2.5).
- **i-Ready labels** (`Early|Mid|Late` + grade) are converted into a grade-relative offset:
  - `labelGrade - studentGrade`, with timing offsets (`Early = -0.3`, `Late = +0.3`).
  - Then converted into a bounded 1–4 score via `relative + 2.5` and clamped.
- **Reading/Math student score** is the average of available MAP band + i-Ready converted score.
  - If no data is present, score is neutral 2.5.

### Support load and needs

- **Student support load** =
  - `academicTier`
  - `+ behaviorTier`
  - `+2` if IEP, `+1` if Referral
  - `+ referrals` count (if present)
- **Academic need** used for matching =
  - `academicTier + average(distance of reading and math from neutral 2.5)`
- **Behavioral need** used for matching =
  - `behaviorTier + referrals`

### Room-level stats used for scoring

For each room, the engine tracks:

- current size
- average support load
- average reading / math score
- counts for IEP, Referral, Male, Female, ELL, and 504

### Final scoring formula

For each valid room candidate:

- **Load score**: `(roomSize / maxSize) * 10`
- **Academic penalty**: distance between room academic average and student academic need, scaled by the academic weight
- **Behavioral penalty**: distance between room behavior average and student behavioral need, scaled by the behavioral weight
- **Demographic penalty**: ratio-based concentration penalty for student attributes (gender, ELL, 504, IEP, Referral), scaled by demographic weight
- **Preferred-with adjustment**:
  - if a preferred peer is already in this room, subtract `1.75` (bonus)
  - if that preferred peer is in another room, add `1.25` (penalty)

The room with the **lowest total score** is selected.

---

## 2) Placement Logic

Placement is done **per active grade** and only for unlocked students.

### High-level flow

1. Clone current classrooms (safe, non-mutating workflow).
2. Keep only locked students in active-grade rooms before placing.
3. Build the unplaced list from active-grade students not currently locked into rooms.
4. Sort students by priority:
   - co-teach needs first (reading/math requirements)
   - then special-ed status rank (IEP, then Referral, then None)
   - then total support load descending
5. For each student, evaluate every active-grade room:
   - run hard constraints first
   - if valid, compute room score
   - choose best (lowest score)
6. Place if possible; otherwise mark unresolved and collect reasons.
7. Return updated classrooms + unresolved students + warning messages.

### Hard constraints (must pass)

A student cannot be auto-placed in a room if any of these fail:

- room is at max capacity
- required reading co-teach is missing
- required math co-teach is missing
- no-contact conflict exists with any student currently in the room (both directions checked)

### Warning behavior

- If grade has co-teach-needing students but no room enables the needed co-teach type, a warning is generated.
- Unplaced students generate summary warnings and categorized reason groups.

### Import-time pre-assignment behavior

When loading CSV data:

- students with a `teacher` value are treated as preassigned
- unique `(grade, teacher)` pairs are mapped to grade room letters in first-seen order
- those students are inserted into mapped classrooms and marked `locked: true`
- later auto-placement keeps locked students in place

---

## 3) UI Layout and Interaction Model

The app is structured as a top-to-bottom workspace with a fixed-height dashboard layout.

### Vertical layout

1. **Header**
   - app title/subtitle
   - CSV uploader (with mapping panel support)
2. **Toolbar**
   - active grade indicator
   - grade selector
3. **Controls row**
   - control buttons (auto-place/reset/export/safety actions)
   - scoring weight sliders
4. **Main workspace**
   - unassigned panel (left)
   - one classroom column per room in active grade (A–D)
5. **Bottom panels** (shown once students exist)
   - summary panel
   - snapshot manager

### Main workspace behavior

- Drag-and-drop is enabled through a drag context provider around the workspace.
- Unassigned students can be dragged into classrooms and back.
- Manual drops trigger a warning prompt if move would violate constraints, but user can still force placement.
- Classroom columns support:
  - editable teacher name
  - max-size editing
  - co-teach toggles
  - per-room sort toggle (A→Z)
  - quick badges (IEP, Referral, M/F counts)
  - capacity bar visualizing occupancy

### Summary panel behavior

- Shows grade totals and per-room table metrics.
- Computes and highlights imbalance warnings for:
  - reading spread
  - math spread
  - support load spread
  - large gender deltas per room

### Design system notes

- The app uses CSS variables for colors, spacing, shadows, and panel heights.
- Layout is flex-based with fixed upper rows and a horizontally scrollable workspace.
- Visual states emphasize capacity pressure, warnings, and special-service indicators.

