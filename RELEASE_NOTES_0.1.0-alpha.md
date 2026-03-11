# Release Notes: 0.1.0-alpha

`0.1.0-alpha` is the first public alpha release of the Elementary Classroom List Engine, a desktop and web app for building balanced elementary classroom rosters for grades `K` through `5`.

This release establishes the core placement workflow: import student and teacher data, review grade-level settings and relationship rules, auto-place students, make manual adjustments, save snapshots, and export rosters.

## Highlights

- Separate student and teacher CSV imports with column matching
- Grade-by-grade auto-placement for `K-5`
- Hard constraints, teacher-fit matching, and weighted soft balancing
- Manual drag-and-drop placement with locking
- Grade-specific settings for room limits and balancing rules
- Snapshot management for comparing roster versions
- CSV export for a single grade or all grades
- Local persistence so work is saved on the device

## What's Included

### Student import workflow

- Upload student CSV files with header mapping
- Download template and sample student CSV files from the app
- Import additional student batches later without overwriting existing students
- Accept support, demographic, assessment, relationship, and characteristic fields
- Support kindergarten Brigance data in addition to upper-grade assessment fields

### Teacher import workflow

- Upload teacher CSV files separately from student files
- Map teacher columns during import
- Apply teachers to classrooms in CSV order within each grade
- Expand room count automatically when more teachers are imported than existing rooms
- Use imported teacher profiles internally for placement fit without exposing raw scores in the UI

### Placement engine

- Auto-place students for the active grade
- Enforce hard constraints first, including room size, co-teach coverage, referral/IEP room limits, and no-contact conflicts
- Compare teacher fit before weighted balancing
- Balance class size, academic need, behavior support, demographics, peer relationships, and characteristic support load
- Leave students unassigned with reasons when no valid room is available

### Characteristic-based support balancing

- Derive classroom support load from student characteristics
- Surface characteristic load in student cards, room summaries, warning chips, and manual-move warnings
- Balance both total characteristic load and category-level concentrations across classrooms

### Administrator controls

- Add or delete classrooms by grade
- Edit teacher names directly in classroom columns
- Adjust classroom capacity
- Set classroom co-teach coverage by support area
- Add or edit students manually in the app
- Lock placements that should be preserved across future auto-placement runs

### Relationship management

- Add `No Contact (HARD)` relationship rules
- Add `Do Not Separate (SOFT)` relationship rules
- Import peer relationship fields from student CSVs
- Review and manage rules by active grade

### Settings and tuning

- Configure grade-specific room limits
- Set balance targets for EL concentration, gender balance, and class-size variance
- Tune placement formula weights for academic, behavioral, demographic, and peer factors
- Tune characteristic-load balancing behavior
- Save settings to one grade or all grades

### Review and export

- Review classroom-level summary metrics in the grade summary drawer
- See placement warnings after auto-placement
- Save snapshots with names and notes
- Restore, duplicate, rename, and delete snapshots
- Export placements to CSV for one grade or all grades

## Kindergarten Support

This alpha includes a kindergarten-specific placement path:

- `briganceReadiness` is used for kindergarten academic scoring
- kindergarten summaries and badges use Brigance wording instead of MAP reading wording
- grades `1-5` continue using MAP and i-Ready fields for academic balancing

## Data and Persistence

- App state is stored locally on the device
- Snapshots are stored in local app state
- Export files are reporting-oriented CSVs and include assigned teacher output
- Re-importing students adds only new student IDs rather than updating existing records

## Known Limitations

- This is an alpha release. Schools should review results carefully before using exported rosters as final placement decisions.
- Student re-import is additive only; it does not update existing student records.
- Data is saved locally on the device, so schools should maintain their own copies of source CSV files and exported roster files.
- Teacher profile scores influence placement internally but are not displayed in the app interface.
- Export files are designed for reporting, not as a full round-trip backup/import format.

## Recommended Alpha Use

- Start with one grade at a time
- Import clean CSV files using the provided templates
- Review warnings and summary metrics after every auto-placement run
- Save snapshots before and after major manual changes
- Export draft rosters for school-team review before finalizing

## Documentation

- [README.md](/Users/brisonharvey/GitHub/elementary-classroom-list-engine/README.md)
- [ADMIN_BEGINNERS_GUIDE.md](/Users/brisonharvey/GitHub/elementary-classroom-list-engine/ADMIN_BEGINNERS_GUIDE.md)
- [TEMPLATE_USAGE.md](/Users/brisonharvey/GitHub/elementary-classroom-list-engine/TEMPLATE_USAGE.md)
- [SETTINGS_PAGE_EXPLANATION.md](/Users/brisonharvey/GitHub/elementary-classroom-list-engine/SETTINGS_PAGE_EXPLANATION.md)
- [LOGIC_EXPLANATION.md](/Users/brisonharvey/GitHub/elementary-classroom-list-engine/LOGIC_EXPLANATION.md)
