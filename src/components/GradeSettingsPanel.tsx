import { useApp } from "../store/AppContext"

export function GradeSettingsPanel() {
  const { state, dispatch } = useApp()
  const settings = state.gradeSettings[state.activeGrade]

  const set = (key: keyof typeof settings, value: number) => {
    dispatch({ type: "UPDATE_GRADE_SETTINGS", payload: { grade: state.activeGrade, updates: { [key]: value } } })
  }

  return (
    <div className="summary-panel">
      <div className="summary-header"><h3 className="summary-title">Grade {state.activeGrade} Settings</h3></div>
      <div className="settings-grid">
        <label>Max IEP per room (HARD)<input type="number" value={settings.maxIEPPerRoom} onChange={(e) => set("maxIEPPerRoom", Number(e.target.value))} /></label>
        <label>Max referrals per room (HARD)<input type="number" value={settings.maxReferralsPerRoom} onChange={(e) => set("maxReferralsPerRoom", Number(e.target.value))} /></label>
        <label>ELL soft cap ratio (SOFT)<input type="number" step="0.01" value={settings.ellConcentrationSoftCap} onChange={(e) => set("ellConcentrationSoftCap", Number(e.target.value))} /></label>
        <label>Gender tolerance ±students (SOFT)<input type="number" value={settings.genderBalanceTolerance} onChange={(e) => set("genderBalanceTolerance", Number(e.target.value))} /></label>
        <label>Class size variance limit (SOFT)<input type="number" value={settings.classSizeVarianceLimit} onChange={(e) => set("classSizeVarianceLimit", Number(e.target.value))} /></label>
      </div>
      <button className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: "RESET_GRADE_SETTINGS", payload: state.activeGrade })}>Reset to defaults</button>
    </div>
  )
}
