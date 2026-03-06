import { memo, useMemo } from "react"
import { useApp } from "../store/AppContext"
import { getClassroomsForGrade } from "../utils/classroomInit"
import { CO_TEACH_LABELS } from "../utils/coTeach"
import { computeRoomStats, getRoomMathAvg, getRoomReadingAvg, getRoomSupportLoad } from "../utils/scoring"

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

  const readingAvgs = gradeClassrooms.filter((c) => c.students.length > 0).map((c) => getRoomReadingAvg(c))
  const mathAvgs = gradeClassrooms.filter((c) => c.students.length > 0).map((c) => getRoomMathAvg(c))
  const supportAvgs = gradeClassrooms.filter((c) => c.students.length > 0).map((c) => getRoomSupportLoad(c))

  const range = (arr: number[]) => (arr.length < 2 ? 0 : Math.max(...arr) - Math.min(...arr))
  const readingImbalance = range(readingAvgs) > 0.75
  const mathImbalance = range(mathAvgs) > 0.75
  const supportImbalance = range(supportAvgs) > 4

  const settings = gradeSettings[activeGrade]

  const genderWarningRooms = gradeClassrooms
    .filter((c) => {
      const m = c.students.filter((s) => s.gender === "M").length
      const f = c.students.filter((s) => s.gender === "F").length
      return Math.abs(m - f) > settings.genderBalanceTolerance
    })
  const genderWarnings = genderWarningRooms.map((c) => c.id)
  const genderWarningLabels = genderWarningRooms.map((c) => c.teacherName?.trim() || `${c.grade}-${c.label}`)

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

      {(readingImbalance || mathImbalance || supportImbalance || genderWarnings.length > 0) && (
        <div className="warnings-row">
          {genderWarnings.length > 0 && <div className="warning-chip">⚠ Gender imbalance beyond ±{settings.genderBalanceTolerance}: {genderWarningLabels.join(", ")}</div>}
          {readingImbalance && <div className="warning-chip">⚠ Reading level spread across classrooms</div>}
          {mathImbalance && <div className="warning-chip">⚠ Math level spread across classrooms</div>}
          {supportImbalance && <div className="warning-chip">⚠ Support load imbalanced across classrooms</div>}
        </div>
      )}


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
        <table className="summary-table">
          <thead>
            <tr>
              <th>Room</th>
              <th>Teacher</th>
              <th>Students</th>
              <th>IEP</th>
              <th>Ref</th>
              <th>EL</th>
              <th>504</th>
              <th>Race / Ethnicity</th>
              <th>M / F</th>
              <th>Avg MAP Read</th>
              <th>Avg MAP Math</th>
              <th>Support Load</th>
              <th>Total Co-teach Min</th>
              <th>Avg Co-teach Min</th>
              <th>Coverage</th>
            </tr>
          </thead>
          <tbody>
            {gradeClassrooms.map((c, i) => {
              const stats = roomStats[i]
              const supportLoad = getRoomSupportLoad(c)
              const mapReadAvg =
                c.students.length > 0 && c.students.some((s) => s.mapReading !== undefined)
                  ? c.students.filter((s) => s.mapReading !== undefined).reduce((sum, s) => sum + s.mapReading!, 0) /
                    c.students.filter((s) => s.mapReading !== undefined).length
                  : null
              const mapMathAvg =
                c.students.length > 0 && c.students.some((s) => s.mapMath !== undefined)
                  ? c.students.filter((s) => s.mapMath !== undefined).reduce((sum, s) => sum + s.mapMath!, 0) /
                    c.students.filter((s) => s.mapMath !== undefined).length
                  : null

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
              )
                .sort(([a], [b]) => a.localeCompare(b))

              return (
                <tr key={c.label} className={genderWarn ? "row-warn" : ""}>
                  <td className="cell-id">{c.label}</td>
                  <td className="cell-teacher">{showTeacherNames ? (c.teacherName || "—") : "Hidden"}</td>
                  <td><span style={{ color: stats.size >= c.maxSize ? "#ef4444" : stats.size / c.maxSize > 0.85 ? "#f59e0b" : "inherit", fontWeight: stats.size >= c.maxSize ? "bold" : "normal" }}>{stats.size}/{c.maxSize}</span></td>
                  <td>{stats.iepCount > 0 ? <span className="qs-badge qs-iep">{stats.iepCount}</span> : "—"}</td>
                  <td>{stats.referralCount > 0 ? <span className="qs-badge qs-ref">{stats.referralCount}</span> : "—"}</td>
                  <td>{stats.ellCount > 0 ? stats.ellCount : "—"}</td>
                  <td>{stats.section504Count > 0 ? stats.section504Count : "—"}</td>
                  <td>
                    {raceBreakdown.length === 0 ? "—" : (
                      <div className="race-chip-list">
                        {raceBreakdown.map(([race, count]) => (
                          <span key={`${c.id}-${race}`} className="race-pill" style={raceStyleByLabel[race]}>{race}: {count}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className={genderWarn ? "cell-warn" : ""}>{stats.maleCount}M / {stats.femaleCount}F</td>
                  <td>{mapReadAvg !== null ? fmt(mapReadAvg) : "—"}</td>
                  <td>{mapMathAvg !== null ? fmt(mapMathAvg) : "—"}</td>
                  <td>{fmt(supportLoad)}</td>
                  <td title={coTeachBreakdown || "No co-teach minutes"}>{stats.totalCoTeachMinutes}</td>
                  <td>{fmt(stats.avgCoTeachMinutes)}</td>
                  <td>{c.coTeachCoverage.length ? c.coTeachCoverage.map((category) => <span key={category} className="coteach-chip">{CO_TEACH_LABELS[category]}</span>) : "—"}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
})
