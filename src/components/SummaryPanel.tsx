import { memo, useMemo } from "react"
import { useApp } from "../store/AppContext"
import { getClassroomsForGrade } from "../utils/classroomInit"
import { CO_TEACH_LABELS } from "../utils/coTeach"
import { computeRoomStats, getRoomSupportLoad } from "../utils/scoring"

function fmt(n: number): string {
  return n.toFixed(2)
}

const RACE_CHIP_PALETTE = [
  { backgroundColor: "#dbeafe", borderColor: "#93c5fd", color: "#1e3a8a" },
  { backgroundColor: "#dcfce7", borderColor: "#86efac", color: "#14532d" },
  { backgroundColor: "#fef3c7", borderColor: "#fcd34d", color: "#78350f" },
  { backgroundColor: "#ffe4e6", borderColor: "#fda4af", color: "#881337" },
  { backgroundColor: "#ede9fe", borderColor: "#c4b5fd", color: "#4c1d95" },
  { backgroundColor: "#cffafe", borderColor: "#67e8f9", color: "#164e63" },
  { backgroundColor: "#f3e8ff", borderColor: "#d8b4fe", color: "#6b21a8" },
  { backgroundColor: "#e0f2fe", borderColor: "#7dd3fc", color: "#0c4a6e" },
]

export const SummaryPanel = memo(function SummaryPanel() {
  const { state } = useApp()
  const { classrooms, activeGrade, allStudents, gradeSettings, showTeacherNames } = state

  const gradeClassrooms = useMemo(() => getClassroomsForGrade(classrooms, activeGrade), [classrooms, activeGrade])

  const totalStudents = allStudents.filter((s) => s.grade === activeGrade).length
  const totalIEP = allStudents.filter((s) => s.grade === activeGrade && s.specialEd.status === "IEP").length
  const totalReferral = allStudents.filter((s) => s.grade === activeGrade && s.specialEd.status === "Referral").length
  const totalEL = allStudents.filter((s) => s.grade === activeGrade && s.ell).length
  const total504 = allStudents.filter((s) => s.grade === activeGrade && s.section504).length
  const raceCounts = allStudents
    .filter((s) => s.grade === activeGrade)
    .reduce<Record<string, number>>((acc, student) => {
      const race = student.raceEthnicity?.trim() || "Unreported"
      acc[race] = (acc[race] ?? 0) + 1
      return acc
    }, {})

  const roomStats = useMemo(() => gradeClassrooms.map((c) => computeRoomStats(c)), [gradeClassrooms])
  const raceStyleByLabel = useMemo(() => {
    const labels = Object.keys(raceCounts).sort((a, b) => a.localeCompare(b))
    return labels.reduce<Record<string, { backgroundColor: string; borderColor: string; color: string }>>((acc, race, index) => {
      acc[race] = RACE_CHIP_PALETTE[index % RACE_CHIP_PALETTE.length]
      return acc
    }, {})
  }, [raceCounts])

  const settings = gradeSettings[activeGrade]

  const genderWarningRooms = gradeClassrooms
    .filter((c) => {
      const m = c.students.filter((s) => s.gender === "M").length
      const f = c.students.filter((s) => s.gender === "F").length
      return Math.abs(m - f) > settings.genderBalanceTolerance
    })
  const genderWarnings = genderWarningRooms.map((c) => c.id)

  return (
    <div className="summary-panel">
      <div className="summary-header">
        <h3 className="summary-title">Grade {activeGrade} Summary</h3>
        <div className="summary-totals">
          <span className="total-pill">{totalStudents} students</span>
          <span className="total-pill pill-iep">{totalIEP} IEP</span>
          <span className="total-pill pill-ref">{totalReferral} Referral</span>
          <span className="total-pill">{totalEL} EL</span>
          <span className="total-pill">{total504} 504</span>
        </div>
      </div>

      <div className="race-totals">
        {Object.entries(raceCounts).sort(([a], [b]) => a.localeCompare(b)).map(([race, count]) => (
          <span key={race} className="total-pill race-pill" style={raceStyleByLabel[race]}>{race}: {count}</span>
        ))}
      </div>

      <div className="support-load-help">
        <strong>How Support Load is calculated:</strong> average of each student&apos;s
        <code> academic tier + behavior tier + special education status bonus + referral count + normalized co-teach load</code>.
        Co-teach minutes are summed across categories, normalized (minutes/60, clamped 0–2), and added to support load for balancing.
      </div>

      <div className="summary-table-wrap">
        <div className="summary-room-list">
          {gradeClassrooms.map((c, i) => {
            const stats = roomStats[i]
            const supportLoad = getRoomSupportLoad(c)
            const getAvg = (kind: "mapReading" | "mapMath"): number | null => {
              const vals = c.students.map((s) => s[kind]).filter((v): v is number => v !== undefined)
              if (vals.length === 0) return null
              return vals.reduce((sum, val) => sum + val, 0) / vals.length
            }
            const mapReadAvg = getAvg("mapReading")
            const mapMathAvg = getAvg("mapMath")

            const genderWarn = genderWarnings.includes(c.id)
            const coTeachBreakdown = Object.entries(stats.coTeachMinutesByCategory)
              .filter(([, minutes]) => minutes > 0)
              .map(([category, minutes]) => `${CO_TEACH_LABELS[category as keyof typeof CO_TEACH_LABELS]}: ${minutes}`)
              .join("\n")
            const raceBreakdown = Object.entries(
              c.students.reduce<Record<string, number>>((acc, student) => {
                const race = student.raceEthnicity?.trim() || "Unreported"
                acc[race] = (acc[race] ?? 0) + 1
                return acc
              }, {})
            ).sort(([a], [b]) => a.localeCompare(b))

            return (
              <article key={c.id} className={`summary-room-card ${genderWarn ? "summary-room-card-warn" : ""}`}>
                <div className="summary-room-header">
                  <div className="summary-room-title">{c.grade}-{c.label}</div>
                  <div className="summary-room-teacher">{showTeacherNames ? (c.teacherName || "—") : "Hidden"}</div>
                  <span className="summary-room-size" style={{ color: stats.size >= c.maxSize ? "#ef4444" : stats.size / c.maxSize > 0.85 ? "#f59e0b" : "inherit" }}>
                    {stats.size}/{c.maxSize}
                  </span>
                </div>

                <div className="summary-room-metrics">
                  <span className="summary-metric summary-metric-demographic">IEP: {stats.iepCount || "—"}</span>
                  <span className="summary-metric summary-metric-demographic">Ref: {stats.referralCount || "—"}</span>
                  <span className="summary-metric summary-metric-demographic">EL: {stats.ellCount || "—"}</span>
                  <span className="summary-metric summary-metric-demographic">504: {stats.section504Count || "—"}</span>
                  <span className={`summary-metric summary-metric-demographic ${genderWarn ? "cell-warn" : ""}`}>M/F: {stats.maleCount}/{stats.femaleCount}</span>
                  <span className="summary-metric summary-metric-academic">MAP R: {mapReadAvg !== null ? fmt(mapReadAvg) : "—"}</span>
                  <span className="summary-metric summary-metric-academic">MAP M: {mapMathAvg !== null ? fmt(mapMathAvg) : "—"}</span>
                  <span className="summary-metric summary-metric-support">Support: {fmt(supportLoad)}</span>
                  <span className="summary-metric" title={coTeachBreakdown || "No co-teach minutes"}>Co-teach: {stats.totalCoTeachMinutes} total / {fmt(stats.avgCoTeachMinutes)} avg</span>
                </div>

                <div className="summary-room-section">
                  <div className="summary-room-section-label">Race / Ethnicity</div>
                  {raceBreakdown.length === 0 ? "—" : (
                    <div className="race-chip-list">
                      {raceBreakdown.map(([race, count]) => (
                        <span key={`${c.id}-${race}`} className="race-pill" style={raceStyleByLabel[race]}>{race}: {count}</span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="summary-room-section">
                  <div className="summary-room-section-label">Co-teach Coverage</div>
                  <div>
                    {c.coTeachCoverage.length
                      ? c.coTeachCoverage.map((category) => <span key={category} className="coteach-chip">{CO_TEACH_LABELS[category]}</span>)
                      : "—"}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
})
