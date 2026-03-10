import { useEffect, useMemo, useState } from "react"
import { GradeSettings } from "../types"
import { useApp } from "../store/AppContext"
import { getDefaultGradeSettings, normalizeGradeSettings } from "../utils/classroomInit"

interface GradeSettingsPanelProps {
  onClose: () => void
}

interface SettingField {
  key: keyof GradeSettings
  label: string
  help: string
  step: number
  min: number
}

interface SettingSection {
  title: string
  description: string
  fields: SettingField[]
}

const SETTINGS_SECTIONS: SettingSection[] = [
  {
    title: "Room limits",
    description: "These are hard stops. The auto-placer will not go past them.",
    fields: [
      {
        key: "maxIEPPerRoom",
        label: "IEPs allowed in one room",
        help: "Maximum number of students with IEPs allowed in one classroom.",
        step: 1,
        min: 0,
      },
      {
        key: "maxReferralsPerRoom",
        label: "Referral-heavy students allowed in one room",
        help: "Maximum number of students with a referral status or referral count allowed in one classroom.",
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
        help: "Example: 0.35 means the app starts pushing back when more than 35% of a room is EL.",
        step: 0.01,
        min: 0,
      },
      {
        key: "genderBalanceTolerance",
        label: "Boy/girl gap allowed before penalty",
        help: "How many students apart the room can get before the app sees it as unbalanced.",
        step: 1,
        min: 0,
      },
      {
        key: "classSizeVarianceLimit",
        label: "Class size gap allowed",
        help: "How far apart the biggest and smallest rooms can be before a penalty starts.",
        step: 1,
        min: 0,
      },
      {
        key: "ellOverCapPenaltyWeight",
        label: "How strongly to avoid rooms over the EL target",
        help: "Higher number means the app works harder to avoid going over the EL share target.",
        step: 0.25,
        min: 0,
      },
      {
        key: "genderImbalancePenaltyWeight",
        label: "How strongly to avoid big boy/girl gaps",
        help: "Higher number means the app pushes harder against rooms with a wide gender gap.",
        step: 0.25,
        min: 0,
      },
      {
        key: "classSizeVariancePenaltyWeight",
        label: "How strongly to avoid class size gaps",
        help: "Higher number means the app spreads students more evenly across rooms.",
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
        help: "Higher number makes the app prefer emptier rooms sooner.",
        step: 0.25,
        min: 0,
      },
      {
        key: "academicBalancePenaltyWeight",
        label: "Match academic support levels",
        help: "Higher number makes the app spread reading and math needs more evenly.",
        step: 0.25,
        min: 0,
      },
      {
        key: "behavioralBalancePenaltyWeight",
        label: "Match behavior support levels",
        help: "Higher number makes the app spread behavior needs and referrals more evenly.",
        step: 0.25,
        min: 0,
      },
      {
        key: "demographicBalancePenaltyWeight",
        label: "Spread student groups evenly",
        help: "Higher number makes the app care more about balancing gender, EL, 504, IEP, and referral groups.",
        step: 0.25,
        min: 0,
      },
      {
        key: "preferredPeerBonus",
        label: "Reward keeping requested peers together",
        help: "Higher number makes the app more likely to place preferred peers in the same room.",
        step: 0.25,
        min: 0,
      },
      {
        key: "preferredPeerSplitPenalty",
        label: "Penalty for splitting requested peers",
        help: "Higher number makes the app avoid separating preferred peers.",
        step: 0.25,
        min: 0,
      },
      {
        key: "keepTogetherBonus",
        label: "Reward keeping required pairs together",
        help: "Higher number makes the app favor rooms that keep do-not-separate pairs together.",
        step: 0.25,
        min: 0,
      },
      {
        key: "keepTogetherSplitPenalty",
        label: "Penalty for splitting required pairs",
        help: "Higher number makes the app avoid splitting do-not-separate pairs.",
        step: 0.25,
        min: 0,
      },
    ],
  },
  {
    title: "Tag load formula",
    description: "These numbers tune how strongly the app spreads tag-based support load.",
    fields: [
      {
        key: "tagTotalBalancePenaltyWeight",
        label: "Balance total tag load",
        help: "Higher number makes the app care more about the overall tag load in each room.",
        step: 0.25,
        min: 0,
      },
      {
        key: "tagBehavioralPenaltyWeight",
        label: "Balance behavior-related tags",
        help: "Higher number makes the app spread behavior-related tags more evenly.",
        step: 0.05,
        min: 0,
      },
      {
        key: "tagEmotionalPenaltyWeight",
        label: "Balance emotion-related tags",
        help: "Higher number makes the app spread emotion-related tags more evenly.",
        step: 0.05,
        min: 0,
      },
      {
        key: "tagInstructionalPenaltyWeight",
        label: "Balance learning-support tags",
        help: "Higher number makes the app spread learning-support tags more evenly.",
        step: 0.05,
        min: 0,
      },
      {
        key: "tagEnergyPenaltyWeight",
        label: "Balance energy-related tags",
        help: "Higher number makes the app spread high-energy tags more evenly.",
        step: 0.05,
        min: 0,
      },
      {
        key: "tagHotspotPenaltyWeight",
        label: "Extra penalty for one tag-heavy room",
        help: "Higher number adds more pushback when one room becomes the clear tag-load hotspot.",
        step: 0.25,
        min: 0,
      },
      {
        key: "tagHotspotThreshold",
        label: "Tag gap needed before hotspot penalty starts",
        help: "How far above the grade average a room must get before the extra hotspot penalty is used.",
        step: 0.25,
        min: 0,
      },
    ],
  },
]

const ALL_SETTING_KEYS = SETTINGS_SECTIONS.flatMap((section) => section.fields.map((field) => field.key))

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

  useEffect(() => {
    if (hasUnsavedChanges) setSaveMessage("")
  }, [hasUnsavedChanges])

  const setValue = (key: keyof GradeSettings, value: string) => {
    const nextValue = Number(value)
    setDraft((current) => ({
      ...current,
      [key]: Number.isFinite(nextValue) ? nextValue : 0,
    }))
  }

  const handleSave = () => {
    const normalized = normalizeGradeSettings(draft)
    dispatch({
      type: "UPDATE_GRADE_SETTINGS",
      payload: { grade: state.activeGrade, updates: normalized },
    })
    setDraft(normalized)
    setSaveMessage(`Saved Grade ${state.activeGrade} settings on this device.`)
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
            Change the placement rules for this grade. Your changes apply after you click Save settings.
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={handleClose} aria-label="Close settings">
          X
        </button>
      </div>

      <div className="settings-panel-note">
        Use <strong>0</strong> to turn off a soft rule or formula penalty.
      </div>

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
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!hasUnsavedChanges}>
          Save settings
        </button>
      </div>

      {saveMessage && <div className="settings-status">{saveMessage}</div>}
    </div>
  )
}
