# Beginner's Guide for School Administrators

This guide is written for a school administrator, counselor, or office staff member who is not technical and needs to use the Elementary Classroom List Engine to build classroom rosters.

## What This App Does

The app helps you build balanced classroom rosters for grades `K` through `5`.

It can:

- import students from a CSV file
- import teachers from a separate CSV file
- automatically place students into classrooms
- help balance support needs, academics, gender, EL, referrals, and classroom support load
- honor no-contact rules
- let you manually move students
- lock placements you want to preserve
- save snapshots while you compare roster versions
- export final rosters back to CSV

It works as a desktop app or web app, and it saves your work locally on that computer.

## Before You Start

Have these ready:

- a student spreadsheet or CSV
- a teacher spreadsheet or CSV
- basic decisions about how many classrooms each grade should have
- any important student pairings or no-contact rules

Important things to know:

- Student and teacher files are imported separately.
- Importing more students later only adds brand-new student IDs. It does not update existing students.
- Teacher profile scores are used by the app, but those numeric scores are hidden after import.
- The app saves data locally in the browser/app on that device. If you clear app data, your saved work and snapshots are removed.

## The Main Areas of the App

When you open the app, you will mainly use these areas:

- `Students / Teachers` import box at the top right
- `Grade` selector near the top
- `Auto-Place`, `Reset Grade`, `Export`, and `Clear All` buttons
- `Unassigned` panel on the left
- classroom columns in the center
- `Grade Summary` drawer on the right
- `Snapshots` panel at the bottom
- `No-contact Manager` and `Settings` buttons near the top

## Recommended Order of Work

Use the app in this order:

1. Import students.
2. Import teachers.
3. Pick a grade.
4. Review classrooms, co-teach coverage, and settings.
5. Add important no-contact or do-not-separate rules.
6. Run `Auto-Place`.
7. Review warnings and the grade summary.
8. Drag students manually if needed.
9. Lock placements you want to keep.
10. Save a snapshot.
11. Export the final roster.

## Step 1: Prepare Your Student File

The app includes a ready-made file called [student-import-template.csv](/Users/brisonharvey/GitHub/elementary-classroom-list-engine/public/student-import-template.csv). If you are starting from scratch, use that template.

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

Good beginner advice:

- Make sure every student has a unique `id`.
- Use grades `K`, `1`, `2`, `3`, `4`, or `5`.
- If you do not have every optional field, that is okay. Start with the information you trust.
- For kindergarten, use `briganceReadiness` if you want readiness scores included. The app uses Brigance for kindergarten placement instead of MAP/i-Ready.

## Step 2: Prepare Your Teacher File

The app includes [teacher-import-template.csv](/Users/brisonharvey/GitHub/elementary-classroom-list-engine/public/teacher-import-template.csv).

Required teacher columns:

- `grade`
- `teacherName`
- `structure`
- `regulationBehaviorSupport`
- `socialEmotionalSupport`
- `instructionalExpertise`

These teacher ratings should be `1` to `5`.

Important:

- Teachers are applied in the order they appear in the CSV within each grade.
- If a grade has more teacher rows than current rooms, the app adds rooms automatically.
- If you load teachers after students, student placements stay where they are.

## Step 3: Import Students

In the app:

1. Click `Students` in the import area.
2. Drop in your CSV or click to upload it.
3. Review the column-matching screen.
4. Confirm that the important fields are matched correctly.
5. Complete the import.

The app tries to auto-match columns for you. Always review the matches before finishing.

If you need sample files, use the `Template CSV` and `Sample CSV` buttons in the app.

## Step 4: Import Teachers

In the same import area:

1. Click `Teachers`.
2. Upload the teacher CSV.
3. Review the column matching.
4. Complete the import.

After import, teacher names appear in classrooms unless you hide them.

## Step 5: Choose a Grade

Use the grade selector near the top of the app.

The app works one grade at a time for placement. You can switch between grades as needed.

## Step 6: Review Classrooms Before Auto-Placement

Before pressing `Auto-Place`, check these items:

- Do you have the correct number of classrooms for the grade?
- Are teacher names correct?
- Do room sizes look right?
- Does any room need special co-teach coverage?

Useful classroom actions:

- `Add Classroom`: adds another room for the current grade
- `Delete Classroom`: removes the last room in the current grade
- click a teacher name to edit it
- edit the room capacity number in the room header
- use the `Co-teach` button to choose support categories for that room

## Step 7: Add Important Student Rules

Use the `No-contact Manager` button.

You can add two kinds of rules:

- `No Contact (HARD)`: the app will not place those two students together
- `Do Not Separate (SOFT)`: the app tries to keep those two students together

Use this area for situations that are too important to leave to balancing alone.

Note:

- Student CSV fields `noContactWith` and `preferredWith` also affect placement.
- Rules in the manager are grade-specific.

## Step 8: Review Grade Settings

Click `Settings` while viewing a grade.

This page controls how strongly the app balances different factors. For most schools, the default settings are a reasonable starting point.

The four sections are:

- `Room limits`: hard limits such as maximum IEPs or referrals in one room
- `Balance targets`: goals for EL concentration, gender balance, and room size balance
- `Placement formula`: how much the auto-placer values academic, behavior, demographic, and peer factors
- `Characteristic load formula`: how strongly the app spreads student characteristics across rooms

Practical advice:

- Start by changing only `Room limits` if you have firm grade-level rules.
- Use `Save this grade` if the rule is only for one grade.
- Use `Save to all grades` if your school wants the same rules everywhere.
- If you are unsure, keep the defaults and run a test placement first.

## Step 9: Run Auto-Place

Click `Auto-Place Grade X`.

What the app does:

- places unlocked students for the current grade
- respects hard constraints first
- then uses teacher fit
- then balances class size, supports, demographics, peer requests, and characteristic load

If some students cannot be placed, they stay in the `Unassigned` panel on the left with reasons shown underneath.

## Step 10: Read Warnings and Summary Information

After auto-placement, look at:

- the warning popup
- warning chips across the main screen
- the `Grade Summary` drawer on the right

These areas help you spot problems such as:

- gender imbalance
- wide academic spread
- support-load imbalance
- concentrated characteristic load
- poor teacher fit
- unresolved students left unassigned

The summary drawer shows room-by-room totals, including:

- class size
- IEP, referral, EL, and 504 counts
- male/female counts
- MAP or Brigance averages
- support load
- characteristic load
- co-teach totals
- poor-fit counts

## Step 11: Make Manual Changes

You can drag a student card from one room to another, or into `Unassigned`.

When you manually move a student, the app may show warnings if the move could break a rule or create imbalance. You can still continue if needed.

Each student card also has:

- `Edit`: update the student's information
- lock/unlock button: keep the student fixed in place or allow future auto-placement

Use locking when you are sure a placement should stay exactly where it is.

## Step 12: Add or Edit Students Manually

You do not have to do everything through CSV files.

You can:

- click `Add Student` in the `Unassigned` panel
- click `Edit` on any student card

In the student editor, you can update:

- basic student details
- academic and behavior tiers
- referrals
- EL and 504
- race/ethnicity
- student characteristics
- no-contact and preferred-with student IDs
- co-teach minutes
- teacher notes
- preassigned teacher

Important:

- If you enter a `preassigned teacher`, the student is treated as preassigned and becomes locked.
- If you change a student ID, the app also updates their relationship references.

## Step 13: Use Snapshots While Comparing Options

The `Snapshots` area at the bottom is one of the safest ways to work.

Use snapshots when:

- you want to save a version before major changes
- you want to compare two roster approaches
- a principal or grade-level team wants to review multiple drafts

You can:

- save a snapshot with a name and optional note
- restore an older snapshot
- duplicate a snapshot
- rename it
- edit its note
- delete it

Snapshots are saved by grade.

Recommended habit:

- save a snapshot right after your first auto-placement
- save another after manual adjustments
- save a final snapshot before export

## Step 14: Export Your Rosters

Use:

- `Export Grade X` for the current grade
- `Export All` for every grade

Exports are reporting files, not full round-trip backups.

Exports include:

- student identity fields
- support fields already in the app
- `studentCharacteristics`
- `assignedTeacher`

The export file can be used for review, sharing, or further formatting in Excel or Google Sheets.

## A Simple First-Time Workflow

If you are using the app for the first time, keep it simple:

1. Import students.
2. Import teachers.
3. Pick one grade only.
4. Check room count and teacher names.
5. Add only the most important no-contact rules.
6. Leave settings at their defaults.
7. Run `Auto-Place`.
8. Review the summary and warnings.
9. Make a few manual adjustments.
10. Lock final decisions.
11. Save a snapshot.
12. Export the grade.

Once that works well, repeat for the next grade.

## Tips for Customizing the App to Your School

- If one grade has stricter placement rules, use `Settings` for that grade only.
- If your school relies heavily on co-teach supports, make sure room coverage is set before auto-placement.
- If your school wants specific teacher matches, use `assignedTeacher` in the student file for known placements.
- If your school receives late enrollments, import another student batch later. Only new student IDs are added.
- If you want the app to spread certain behavior or emotional needs more strongly, increase the characteristic load settings.
- If class sizes matter more than anything else, increase the room-fill and class-size balancing pressure.

## Common Mistakes to Avoid

- Do not assume a second student import will update existing students. It only adds new IDs.
- Do not forget to review the column mapping screen during import.
- Do not press `Clear All` unless you truly want to erase students, placements, and snapshots.
- Do not rely only on auto-placement. Always review warnings and the summary.
- Do not forget that settings are grade-specific unless you save them to all grades.
- Do not leave teacher rows in the wrong order if teacher-room order matters to your school.

## Troubleshooting

### A student did not import

Check for:

- missing required fields
- duplicate student ID
- invalid grade format

### A student stayed unassigned

Look in the `Unassigned` panel for the reason. Common causes:

- room limits were reached
- no-contact conflict
- co-teach coverage did not match the student's needs

### Teacher names do not look right

Check:

- the order of teacher rows in the teacher CSV
- whether the correct grade was used
- whether you want to click and edit a teacher name directly in the room header

### A room looks overloaded

Try:

- checking grade settings
- reviewing co-teach coverage
- adding a classroom
- re-running auto-placement
- manually moving and locking a few students

## Best Practices for a School Team

- Use one shared process for cleaning student and teacher CSV files before import.
- Save snapshots often.
- Keep notes in snapshot names so leadership can tell versions apart.
- Review one grade at a time.
- Export a draft before finalizing so teams can review outside the app.
- Keep a copy of your original CSV files outside the app for recordkeeping.

## Related Reference Files

If someone on your team wants more detail, these files explain the system in more depth:

- [README.md](/Users/brisonharvey/GitHub/elementary-classroom-list-engine/README.md)
- [TEMPLATE_USAGE.md](/Users/brisonharvey/GitHub/elementary-classroom-list-engine/TEMPLATE_USAGE.md)
- [SETTINGS_PAGE_EXPLANATION.md](/Users/brisonharvey/GitHub/elementary-classroom-list-engine/SETTINGS_PAGE_EXPLANATION.md)
- [LOGIC_EXPLANATION.md](/Users/brisonharvey/GitHub/elementary-classroom-list-engine/LOGIC_EXPLANATION.md)
