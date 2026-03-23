# Changes Since 0.1.0-alpha

`0.1.1-alpha` includes several code, workflow, and documentation updates made after the `0.1.0-alpha` tag.

The comparison for this summary is based on commits in the range `0.1.0-alpha..HEAD`.

## Summary

This release improves CSV import matching, tightens relationship-rule behavior, fixes several student editing and export edge cases, and refreshes parts of the placement UI.

It also adds administrator-facing documentation and updates packaged release metadata for the new `0.1.1-alpha` build.

## Functional Updates

### Smarter CSV column matching

- Student imports now recognize a wider range of real-world header formats, including BOM-prefixed headers, punctuation-heavy labels, slashes, underscores, spaced labels, and camelCase-style names
- Student field matching now better handles descriptive headers such as `Student First Name`, `Student Last Name`, `Race / Ethnicity`, and `Teacher Notes (Placement)`
- Teacher imports now use the same shared header-matching logic as student imports
- Matching for assigned teacher fields was tightened to reduce bad auto-maps from note/comment columns

### Relationship and roster data fixes

- The no-contact manager now surfaces imported no-contact pairs alongside manager-created rules
- Hard no-contact pairs can now be added and removed in a way that keeps student records, classroom copies, and relationship rules synchronized
- Updating a student ID now rewrites peer references and relationship rules correctly
- Changing a student's grade clears incompatible relationship rules and removes the old classroom placement
- Deleting a student now removes their classroom placement, rule references, and peer references cleanly

### Student editing and export behavior

- Manually assigning a teacher through the student editor now places and locks that student into the matching classroom when possible
- Teacher-fixed students now stay unresolved with explicit reasons when the matching classroom is missing, full, or blocked
- Clearing a previously assigned teacher now unlocks the student correctly
- Exports now fall back to a student's preassigned teacher when that student is still unassigned
- Re-importing students by `id` now refreshes existing roster records while preserving classroom state where possible
- Manual placement warnings now flag `Do Not Separate` conflicts and teacher-fixed overrides
- Deleting a classroom now lets staff choose which active-grade room to remove
- Teacher-fixed diagnostics now persist through student deletion and no-contact rule changes instead of disappearing until the next placement run

## UI and Workflow Updates

- Refined the main workspace layout and styling in the app shell and CSS
- Expanded the no-contact manager into a fuller management view with better search and clearer rule presentation
- Updated student card presentation and supporting UI to make placement details easier to review
- Refined classroom and settings panel interactions for day-to-day roster work
- Guided setup now resets cleanly after `Clear All`, making fresh roster starts less confusing for school staff
- Added more regression coverage for student CRUD behavior and import matching
- Swapped XLSX workbook parsing from `xlsx` to `exceljs` and cleared the prior npm audit findings

## Documentation Updates

- Added a non-technical administrator onboarding guide: [ADMIN_BEGINNERS_GUIDE.md](ADMIN_BEGINNERS_GUIDE.md)
- Added a release notes document for the original alpha: [RELEASE_NOTES_0.1.0-alpha.md](RELEASE_NOTES_0.1.0-alpha.md)
- Added this release change summary for `0.1.1-alpha`
- Updated [README.md](README.md) to point to the administrator documentation

## Release Metadata

- Updated package version metadata from `0.1.0-alpha` to `0.1.1-alpha`
- Rebuilt macOS and Windows distributables using the latest workspace code

## Suggested Release Summary

`0.1.1-alpha` improves CSV auto-matching for real-world school exports, strengthens no-contact and student-editing behavior, adds UI polish across the placement workflow, and includes new administrator-facing documentation for onboarding and release review.
