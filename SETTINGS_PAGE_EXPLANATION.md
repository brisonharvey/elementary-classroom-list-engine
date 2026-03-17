# Grade Settings Guide

The Grade Settings panel controls the rules and scoring used during auto-placement for the active grade.

## Where to find it

Click `Settings` in the top toolbar while viewing a grade.

Settings are saved per grade unless you use `Save to all grades`.

## How to think about the page

The page has two kinds of controls:

- hard limits the auto-placer will not break
- soft penalties that make some rooms more or less attractive

Changing settings does not move students right away. The changes take effect the next time you run auto-placement.

## Save actions

- `Discard changes` restores the last saved values for the active grade
- `Load defaults` loads the built-in default settings into the draft
- `Save to all grades` copies the current draft everywhere
- `Save this grade` saves only the active grade

## Section guide

### Room limits

These are hard constraints.

- `maxIEPPerRoom`
- `maxReferralsPerRoom`

If a room would go over one of these limits, that room is rejected for the student.

### Balance targets

These are soft balance goals.

- `ellConcentrationSoftCap`
- `genderBalanceTolerance`
- `classSizeVarianceLimit`
- `ellOverCapPenaltyWeight`
- `genderImbalancePenaltyWeight`
- `classSizeVariancePenaltyWeight`

Use these when you want the engine to care more or less about EL concentration, gender spread, or keeping room sizes close.

### Placement formula

These tune the main soft-scoring pass.

- `roomFillPenaltyWeight`
- `academicBalancePenaltyWeight`
- `behavioralBalancePenaltyWeight`
- `demographicBalancePenaltyWeight`
- `preferredPeerBonus`
- `preferredPeerSplitPenalty`
- `keepTogetherBonus`
- `keepTogetherSplitPenalty`

These settings matter after hard constraints pass.

### Characteristic load formula

These control how strongly the engine spreads `studentCharacteristics` across rooms.

- `tagTotalBalancePenaltyWeight`
- `tagBehavioralPenaltyWeight`
- `tagEmotionalPenaltyWeight`
- `tagInstructionalPenaltyWeight`
- `tagEnergyPenaltyWeight`
- `tagHotspotPenaltyWeight`
- `tagHotspotThreshold`

Use this section when the engine is allowing too much clustering of students with similar support characteristics.

### Classroom header display options

You can also toggle quick stats in room headers:

- total characteristic support load
- IEP count
- gender counts
- average MAP Reading
- average MAP Math

These affect display only, not scoring.

## Recommended tuning order

1. Set your hard limits first.
2. Run auto-placement once with defaults.
3. Adjust balance targets if rooms are too uneven.
4. Adjust placement weights only if the engine is clearly under-valuing or over-valuing one factor.
5. Adjust characteristic-load settings last.
