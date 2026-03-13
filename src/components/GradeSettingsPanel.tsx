import { useEffect, useMemo, useState } from "react"
import { GRADES, GradeSettings } from "../types"
import { useApp } from "../store/AppContext"
import { getDefaultGradeSettings, normalizeGradeSettings } from "../utils/classroomInit"

interface GradeSettingsPanelProps {
  onClose: () => void
}

interface SettingSection {
  title: string
  description: string
  fields: SettingField[]
}

type DisplaySettingKey =
  | "showClassroomHeaderTagSupportLoad"
  | "showClassroomHeaderIepCount"
  | "showClassroomHeaderGenderCounts"
  | "showClassroomHeaderMapReadingAverage"
  | "showClassroomHeaderMapMathAverage"

type NumberSettingKey = Exclude<keyof GradeSettings, DisplaySettingKey>

interface SettingField {
  key: NumberSettingKey
  label: string
  help: string
  example: string
  step: number
  min: number
}

interface DisplaySettingField {
  key: DisplaySettingKey
  label: string
  help: string
}

const DISPLAY_SETTING_FIELDS: DisplaySettingField[] = [
  {
    key: "showClassroomHeaderTagSupportLoad",
    label: "Show total characteristic support load",
    help: "Adds each room's total characteristic support load to the top of the classroom column.",
  },
  {
    key: "showClassroomHeaderIepCount",
    label: "Show IEP count",
    help: "Adds the number of IEP students in the room to the top of the classroom column.",
  },
  {
    key: "showClassroomHeaderGenderCounts",
    label: "Show gender counts",
    help: "Adds the room's male and female counts to the top of the classroom column.",
  },
  {
    key: "showClassroomHeaderMapReadingAverage",
    label: "Show average MAP R",
    help: "Adds the room's average MAP Reading value to the top of the classroom column.",
  },
  {
    key: "showClassroomHeaderMapMathAverage",
    label: "Show average MAP M",
    help: "Adds the room's average MAP Math value to the top of the classroom column.",
  },
]

const SETTINGS_SECTIONS: SettingSection[] = [
  {
    title: "Room limits",
    description: "These are hard stops. The auto-placer will not go past them.",
    fields: [
      {
        key: "maxIEPPerRoom",
        label: "IEPs allowed in one room",
        help: "This is the most IEP students one room can hold.",
        example: "Example: 3 means a room can have 3 IEP students, but the app will not place a 4th there.",
        step: 1,
        min: 0,
      },
      {
        key: "maxReferralsPerRoom",
        label: "Referral-heavy students allowed in one room",
        help: "This is the most referral-status or referral-count students one room can hold.",
        example: "Example: 4 means the room can take 4 students with referral needs, but not a 5th.",
        step: 1,
        min: 0,
      },
    ],
  },
  {
    title: "Balance targets",
    description: "These are soft goals. Higher penalty numbers make the app care more.",
    fields: [
      {
        key: "ellConcentrationSoftCap",
        label: "EL share before a room gets penalized",
        help: "This is the EL percentage where the app starts pushing students to other rooms.",
        example: "Example: 0.35 means about 35 out of 100 students, or about 7 EL students in a class of 20.",
        step: 0.01,
        min: 0,
      },
      {
        key: "genderBalanceTolerance",
        label: "Boy/girl gap allowed before penalty",
        help: "This is how uneven a room can get before the app sees it as off balance.",
        example: "Example: 2 means 11 boys and 9 girls is okay, but 13 boys and 9 girls starts getting penalized.",
        step: 1,
        min: 0,
      },
      {
        key: "classSizeVarianceLimit",
        label: "Class size gap allowed",
        help: "This is the biggest allowed size gap between the fullest room and the smallest room.",
        example: "Example: 3 means one room at 24 and another at 21 is okay, but 24 and 20 starts getting penalized.",
        step: 1,
        min: 0,
      },
      {
        key: "ellOverCapPenaltyWeight",
        label: "How strongly to avoid rooms over the EL target",
        help: "This controls how hard the app pushes back once a room goes over the EL target.",
        example: "Example: 10 pushes much harder than 2, so the app will try much more strongly to avoid that room.",
        step: 0.25,
        min: 0,
      },
      {
        key: "genderImbalancePenaltyWeight",
        label: "How strongly to avoid big boy/girl gaps",
        help: "This controls how much the app cares about boy/girl imbalance after the gap is too wide.",
        example: "Example: 5 means the app will avoid a 14/8 split more strongly than if this were set to 1.",
        step: 0.25,
        min: 0,
      },
      {
        key: "classSizeVariancePenaltyWeight",
        label: "How strongly to avoid class size gaps",
        help: "This controls how hard the app tries to keep room sizes close together.",
        example: "Example: 4 means the app will work harder to keep rooms near 22/22/21/21 instead of 24/22/20/20.",
        step: 0.25,
        min: 0,
      },
    ],
  },
  {
    title: "Placement formula",
    description: "These numbers tune the scoring math behind auto-placement.",
    fields: [
      {
        key: "roomFillPenaltyWeight",
        label: "Avoid filling one room too fast",
        help: "This controls how soon the app starts preferring emptier rooms.",
        example: "Example: 12 means the app spreads students out sooner than if this number were 4.",
        step: 0.25,
        min: 0,
      },
      {
        key: "academicBalancePenaltyWeight",
        label: "Match academic support levels",
        help: "This controls how much the app spreads reading and math need levels across rooms.",
        example: "Example: 6 means the app will work harder to avoid putting too many high-need readers in one room than if it were 2.",
        step: 0.25,
        min: 0,
      },
      {
        key: "behavioralBalancePenaltyWeight",
        label: "Match behavior support levels",
        help: "This controls how much the app spreads behavior needs and referrals across rooms.",
        example: "Example: 6 means the app will work harder to avoid stacking behavior support in one room than if it were 2.",
        step: 0.25,
        min: 0,
      },
      {
        key: "demographicBalancePenaltyWeight",
        label: "Spread student groups evenly",
        help: "This controls how much the app balances groups like EL, 504, IEP, referrals, and gender.",
        example: "Example: 5 means the app will care more about group balance than if this number is 1.",
        step: 0.25,
        min: 0,
      },
      {
        key: "preferredPeerBonus",
        label: "Reward keeping requested peers together",
        help: "This gives a boost when a student is placed with a requested peer.",
        example: "Example: 2 means the app gives a stronger nudge to keep requested peers together than if this were 0.5.",
        step: 0.25,
        min: 0,
      },
      {
        key: "preferredPeerSplitPenalty",
        label: "Penalty for splitting requested peers",
        help: "This adds a cost when requested peers end up in different rooms.",
        example: "Example: 2 means the app is more likely to avoid splitting preferred peers than if this were 0.5.",
        step: 0.25,
        min: 0,
      },
      {
        key: "keepTogetherBonus",
        label: "Reward keeping required pairs together",
        help: "This gives a stronger boost for do-not-separate pairs than normal preferred peers.",
        example: "Example: 3 means the app strongly favors rooms that keep required pairs together.",
        step: 0.25,
        min: 0,
      },
      {
        key: "keepTogetherSplitPenalty",
        label: "Penalty for splitting required pairs",
        help: "This adds a cost when a do-not-separate pair would land in different rooms.",
        example: "Example: 3 means splitting a required pair becomes a major negative in the score.",
        step: 0.25,
        min: 0,
      },
    ],
  },
  {
    title: "Characteristic load formula",
    description: "These numbers tune how strongly the app spreads characteristic-based support load.",
    fields: [
      {
        key: "tagTotalBalancePenaltyWeight",
        label: "Balance total characteristic load",
        help: "This controls how much the app looks at the overall characteristic load in each room.",
        example: "Example: 2 means the app pays twice as much attention to total characteristic load as it would at 1.",
        step: 0.25,
        min: 0,
      },
      {
        key: "tagBehavioralPenaltyWeight",
        label: "Balance behavior-related characteristics",
        help: "This controls how much the app spreads behavior-related characteristics across rooms.",
        example: "Example: 0.8 means the app will push harder to spread characteristics like frequent redirection than if this were 0.2.",
        step: 0.05,
        min: 0,
      },
      {
        key: "tagEmotionalPenaltyWeight",
        label: "Balance emotion-related characteristics",
        help: "This controls how much the app spreads emotion-related characteristics across rooms.",
        example: "Example: 0.8 means the app works harder to spread characteristics like needs reassurance than if this were 0.2.",
        step: 0.05,
        min: 0,
      },
      {
        key: "tagInstructionalPenaltyWeight",
        label: "Balance learning-support characteristics",
        help: "This controls how much the app spreads learning-support characteristics across rooms.",
        example: "Example: 0.8 means the app works harder to spread characteristics like low academic confidence than if this were 0.2.",
        step: 0.05,
        min: 0,
      },
      {
        key: "tagEnergyPenaltyWeight",
        label: "Balance energy-related characteristics",
        help: "This controls how much the app spreads high-energy characteristics across rooms.",
        example: "Example: 0.8 means the app works harder to spread students who need movement breaks than if this were 0.2.",
        step: 0.05,
        min: 0,
      },
      {
        key: "tagHotspotPenaltyWeight",
        label: "Extra penalty for one characteristic-heavy room",
        help: "This adds extra pushback when one room becomes the clear characteristic-load hotspot.",
        example: "Example: 3 means once one room stands out as the characteristic-heavy room, the app strongly avoids adding more to it.",
        step: 0.25,
        min: 0,
      },
      {
        key: "tagHotspotThreshold",
        label: "Characteristic gap needed before hotspot penalty starts",
        help: "This is how far above the grade average a room must get before the extra hotspot penalty turns on for characteristic load.",
        example: "Example: 3 means the room must be at least 3 characteristic-load points above the grade average before the extra penalty starts.",
        step: 0.25,
        min: 0,
      },
    ],
  },
]

const ALL_SETTING_KEYS = [
  ...SETTINGS_SECTIONS.flatMap((section) => section.fields.map((field) => field.key)),
  ...DISPLAY_SETTING_FIELDS.map((field) => field.key),
] as const

function settingsAreEqual(a: GradeSettings, b: GradeSettings): boolean {
  return ALL_SETTING_KEYS.every((key) => a[key] === b[key])
}

export function GradeSettingsPanel({ onClose }: GradeSettingsPanelProps) {
  const { state, dispatch } = useApp()
  const settings = state.gradeSettings[state.activeGrade]
  const [draft, setDraft] = useState<GradeSettings>(settings)
  const [saveMessage, setSaveMessage] = useState("")

  useEffect(() => {
    setDraft(settings)
  }, [settings])

  const hasUnsavedChanges = useMemo(() => !settingsAreEqual(draft, settings), [draft, settings])
  const normalizedDraft = useMemo(() => normalizeGradeSettings(draft), [draft])
  const canApplyToAllGrades = useMemo(
    () => GRADES.some((grade) => !settingsAreEqual(state.gradeSettings[grade], normalizedDraft)),
    [normalizedDraft, state.gradeSettings]
  )

  useEffect(() => {
    if (hasUnsavedChanges) setSaveMessage("")
  }, [hasUnsavedChanges])

  const setValue = (key: NumberSettingKey, value: string) => {
    const nextValue = Number(value)
    setDraft((current) => ({
      ...current,
      [key]: Number.isFinite(nextValue) ? nextValue : 0,
    }))
  }

  const setToggle = (key: DisplaySettingKey, checked: boolean) => {
    setDraft((current) => ({
      ...current,
      [key]: checked,
    }))
  }

  const handleSave = () => {
    dispatch({
      type: "UPDATE_GRADE_SETTINGS",
      payload: { grade: state.activeGrade, updates: normalizedDraft },
    })
    setDraft(normalizedDraft)
    setSaveMessage(`Saved Grade ${state.activeGrade} settings on this device.`)
  }

  const handleApplyToAllGrades = () => {
    dispatch({
      type: "APPLY_GRADE_SETTINGS_TO_ALL",
      payload: normalizedDraft,
    })
    setDraft(normalizedDraft)
    setSaveMessage(`Applied these settings to all grade levels on this device.`)
  }

  const handleClose = () => {
    if (hasUnsavedChanges && !window.confirm("You have unsaved settings changes. Close without saving?")) {
      return
    }
    onClose()
  }

  return (
    <div className="slide-panel-content">
      <div className="slide-panel-header">
        <div>
          <h3 className="summary-title">Grade {state.activeGrade} Settings</h3>
          <p className="settings-panel-intro">
            Change the placement rules for this grade. You can save just this grade or copy the same rules to every grade.
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={handleClose} aria-label="Close settings">
          X
        </button>
      </div>

      <div className="settings-panel-note">
        Use <strong>0</strong> to turn off a soft rule or formula penalty.
      </div>

      <section className="settings-section">
        <div className="settings-section-header">
          <h4 className="settings-section-title">Classroom column header</h4>
          <p className="settings-section-copy">Choose which extra room metrics appear at the top of each classroom column for this grade.</p>
        </div>
        <div className="settings-card-grid">
          {DISPLAY_SETTING_FIELDS.map((field) => (
            <label key={field.key} className="setting-card setting-card-toggle">
              <span className="setting-card-label">{field.label}</span>
              <span className="setting-card-help">{field.help}</span>
              <input
                className="setting-card-checkbox"
                type="checkbox"
                checked={draft[field.key]}
                onChange={(event) => setToggle(field.key, event.target.checked)}
              />
            </label>
          ))}
        </div>
      </section>

      {SETTINGS_SECTIONS.map((section) => (
        <section key={section.title} className="settings-section">
          <div className="settings-section-header">
            <h4 className="settings-section-title">{section.title}</h4>
            <p className="settings-section-copy">{section.description}</p>
          </div>
          <div className="settings-card-grid">
            {section.fields.map((field) => (
              <label key={field.key} className="setting-card">
                <span className="setting-card-label">{field.label}</span>
                <span className="setting-card-help">{field.help}</span>
                <span className="setting-card-example">{field.example}</span>
                <input
                  className="setting-card-input"
                  type="number"
                  min={field.min}
                  step={field.step}
                  value={draft[field.key]}
                  onChange={(event) => setValue(field.key, event.target.value)}
                />
              </label>
            ))}
          </div>
        </section>
      ))}

      <div className="settings-actions">
        <button className="btn btn-ghost btn-sm" onClick={() => setDraft(settings)} disabled={!hasUnsavedChanges}>
          Discard changes
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setDraft(getDefaultGradeSettings())}>
          Load defaults
        </button>
        <button className="btn btn-ghost btn-sm" onClick={handleApplyToAllGrades} disabled={!canApplyToAllGrades}>
          Save to all grades
        </button>
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!hasUnsavedChanges}>
          Save this grade
        </button>
      </div>

      {saveMessage && <div className="settings-status">{saveMessage}</div>}
    </div>
  )
}


