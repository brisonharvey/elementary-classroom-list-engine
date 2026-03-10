# Settings Page Explanation

This document explains what the Grade Settings panel does in the app and how each setting affects placement.

## Where to find it

In the main workspace, click `Settings` in the top toolbar while viewing a grade.

The panel is grade-specific:

- changes apply to the currently selected grade unless you click `Save to all grades`
- the title always shows the active grade, such as `Grade 2 Settings`

## How the page works

The settings page edits placement rules that the auto-placer uses for the active grade.

There are four sections:

- `Room limits`
- `Balance targets`
- `Placement formula`
- `Characteristic load formula`

Each setting card includes:

- a label
- a short explanation of what it controls
- an example of how to interpret the value
- a numeric input

Use `0` to turn off a soft rule or penalty.

## Save actions

At the bottom of the page, the app shows four actions:

- `Discard changes`: restore the current grade draft back to the last saved values
- `Load defaults`: load the built-in default settings into the draft
- `Save to all grades`: copy the current draft to every grade level
- `Save this grade`: save only the active grade

If you try to close the panel with unsaved changes, the app asks for confirmation.

## Section details

### Room limits

These are hard placement limits.

If a room would go past one of these limits, the auto-placer will reject that room.

Settings:

- `maxIEPPerRoom`: maximum number of IEP students allowed in one room
- `maxReferralsPerRoom`: maximum number of referral-status students, or students with referral counts, allowed in one room

These settings affect hard-constraint checks, unresolved-placement warnings, and manual-move warnings.

### Balance targets

These are soft balance goals.

The auto-placer can still use a room that goes past these targets, but it adds score pressure so the engine prefers better-balanced rooms when possible.

Settings:

- `ellConcentrationSoftCap`: EL share where the room starts getting penalized
- `genderBalanceTolerance`: allowed gap between boys and girls before a penalty starts
- `classSizeVarianceLimit`: allowed size gap between the smallest and largest rooms
- `ellOverCapPenaltyWeight`: strength of the EL over-cap penalty
- `genderImbalancePenaltyWeight`: strength of the gender imbalance penalty
- `classSizeVariancePenaltyWeight`: strength of the class-size variance penalty

These settings mainly affect top-level warning chips, room balancing, and the room score used during auto-placement.

### Placement formula

These settings tune the core soft-scoring formula after hard constraints pass.

Settings:

- `roomFillPenaltyWeight`: pushes the engine to use emptier rooms sooner
- `academicBalancePenaltyWeight`: balances academic need levels across rooms
- `behavioralBalancePenaltyWeight`: balances behavior needs and referrals across rooms
- `demographicBalancePenaltyWeight`: balances gender, EL, 504, IEP, and referral groupings
- `preferredPeerBonus`: rewards placing a student with a preferred peer
- `preferredPeerSplitPenalty`: penalizes splitting preferred peers
- `keepTogetherBonus`: rewards keeping required pairs together
- `keepTogetherSplitPenalty`: penalizes splitting required pairs

These values only matter during auto-placement and manual score comparisons.

### Characteristic load formula

This section tunes how strongly the app spreads student-characteristic support load across rooms.

The app derives a support-load value from student characteristics such as `Needs frequent redirection`, `Needs reassurance`, or `Needs movement breaks`.

Settings:

- `tagTotalBalancePenaltyWeight`: pressure to balance the total characteristic load
- `tagBehavioralPenaltyWeight`: pressure to balance behavior-related characteristics
- `tagEmotionalPenaltyWeight`: pressure to balance emotion-related characteristics
- `tagInstructionalPenaltyWeight`: pressure to balance instructional characteristics
- `tagEnergyPenaltyWeight`: pressure to balance energy-related characteristics
- `tagHotspotPenaltyWeight`: extra penalty when one room becomes the clear characteristic-load hotspot
- `tagHotspotThreshold`: how far above the grade average a room must get before the hotspot penalty starts

Even though these keys start with `tag`, the current UI and documentation treat this section as characteristic-based support load.

## What happens when settings change

Settings do not move students immediately.

They take effect when you:

- run `Auto-Place` again
- manually compare rooms after reloading the updated state
- review warnings and summaries that depend on the saved thresholds

Snapshots store grade settings with the snapshot payload for that grade.

## Recommended usage

A practical order for tuning the page is:

1. Set `Room limits` first.
2. Tune `Balance targets` to match your school’s non-negotiables.
3. Adjust `Placement formula` if the engine is over-valuing or under-valuing academic, behavioral, demographic, or peer factors.
4. Adjust `Characteristic load formula` last if certain support-heavy student characteristics are clustering too much.

## Related files

Implementation and defaults live in:

- `src/components/GradeSettingsPanel.tsx`
- `src/utils/classroomInit.ts`
- `src/utils/scoring.ts`
- `src/store/reducer.ts`
- `src/types/index.ts`
