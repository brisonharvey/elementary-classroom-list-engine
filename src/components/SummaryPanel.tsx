import { memo, useMemo } from "react"
import { useApp } from "../store/AppContext"
import { getClassroomsForGrade } from "../utils/classroomInit"
import { computeRoomStats, getRoomMathAvg, getRoomReadingAvg, getRoomSupportLoad } from "../utils/scoring"

function fmt(n: number): string {
  return n.toFixed(2)
}

export const SummaryPanel = memo(function SummaryPanel() {
  const { state } = useApp()
  const { classrooms, activeGrade, allStudents, gradeSettings } = state

  const gradeClassrooms = useMemo(
    () => getClassroomsForGrade(classrooms, activeGrade),
    [classrooms, activeGrade]
  )

  const totalStudents = allStudents.filter((s) => s.grade === activeGrade).length
  const totalIEP = allStudents.filter((s) => s.grade === activeGrade && s.specialEd.status === "IEP").length
  const totalReferral = allStudents.filter(
    (s) => s.grade === activeGrade && s.specialEd.status === "Referral"
  ).length

  const roomStats = useMemo(() => gradeClassrooms.map((c) => computeRoomStats(c)), [gradeClassrooms])

  // Imbalance warnings
  const readingAvgs = gradeClassrooms
    .filter((c) => c.students.length > 0)
    .map((c) => getRoomReadingAvg(c))
  const mathAvgs = gradeClassrooms
    .filter((c) => c.students.length > 0)
    .map((c) => getRoomMathAvg(c))
  const supportAvgs = gradeClassrooms
    .filter((c) => c.students.length > 0)
    .map((c) => getRoomSupportLoad(c))

  const range = (arr: number[]) => (arr.length < 2 ? 0 : Math.max(...arr) - Math.min(...arr))
  const readingImbalance = range(readingAvgs) > 0.75
  const mathImbalance = range(mathAvgs) > 0.75
  const supportImbalance = range(supportAvgs) > 4

  const settings = gradeSettings[activeGrade]

  const genderWarnings = gradeClassrooms
    .filter((c) => {
      const m = c.students.filter((s) => s.gender === "M").length
      const f = c.students.filter((s) => s.gender === "F").length
      return Math.abs(m - f) > settings.genderBalanceTolerance
    })
    .map((c) => c.id)

  return (
    <div className="summary-panel">
      <div className="summary-header">
        <h3 className="summary-title">Grade {activeGrade} Summary</h3>
        <div className="summary-totals">
          <span className="total-pill">{totalStudents} students</span>
          <span className="total-pill pill-iep">{totalIEP} IEP</span>
          <span className="total-pill pill-ref">{totalReferral} Referral</span>
        </div>
      </div>

      {/* Warnings */}
      {(readingImbalance || mathImbalance || supportImbalance || genderWarnings.length > 0) && (
        <div className="warnings-row">
          {genderWarnings.length > 0 && (
            <div className="warning-chip">
              ⚠ Gender imbalance beyond ±{settings.genderBalanceTolerance}: {genderWarnings.join(", ")}
            </div>
          )}
          {readingImbalance && (
            <div className="warning-chip">⚠ Reading level spread across classrooms</div>
          )}
          {mathImbalance && (
            <div className="warning-chip">⚠ Math level spread across classrooms</div>
          )}
          {supportImbalance && (
            <div className="warning-chip">⚠ Support load imbalanced across classrooms</div>
          )}
        </div>
      )}

      {/* Per-classroom stats table */}
      <div className="support-load-help">
        <strong>How Support Load is calculated:</strong> average of each student&apos;s
        <code> academic tier + behavior tier + special education status bonus + referral count</code>,
        where IEP adds +2 and Referral status adds +1.
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
              <th>M / F</th>
              <th>Avg MAP Read</th>
              <th>Avg MAP Math</th>
              <th>Support Load</th>
              <th>CoTeach</th>
            </tr>
          </thead>
          <tbody>
            {gradeClassrooms.map((c, i) => {
              const stats = roomStats[i]
              const supportLoad = getRoomSupportLoad(c)
              const mapReadAvg =
                c.students.length > 0 && c.students.some((s) => s.mapReading !== undefined)
                  ? c.students
                      .filter((s) => s.mapReading !== undefined)
                      .reduce((sum, s) => sum + s.mapReading!, 0) /
                    c.students.filter((s) => s.mapReading !== undefined).length
                  : null
              const mapMathAvg =
                c.students.length > 0 && c.students.some((s) => s.mapMath !== undefined)
                  ? c.students
                      .filter((s) => s.mapMath !== undefined)
                      .reduce((sum, s) => sum + s.mapMath!, 0) /
                    c.students.filter((s) => s.mapMath !== undefined).length
                  : null

              const genderWarn = genderWarnings.includes(c.id)

              return (
                <tr key={c.label} className={genderWarn ? "row-warn" : ""}>
                  <td className="cell-id">{c.label}</td>
                  <td className="cell-teacher">{c.teacherName || "—"}</td>
                  <td>
                    <span
                      style={{
                        color:
                          stats.size >= c.maxSize
                            ? "#ef4444"
                            : stats.size / c.maxSize > 0.85
                            ? "#f59e0b"
                            : "inherit",
                        fontWeight: stats.size >= c.maxSize ? "bold" : "normal",
                      }}
                    >
                      {stats.size}/{c.maxSize}
                    </span>
                  </td>
                  <td>{stats.iepCount > 0 ? <span className="qs-badge qs-iep">{stats.iepCount}</span> : "—"}</td>
                  <td>{stats.referralCount > 0 ? <span className="qs-badge qs-ref">{stats.referralCount}</span> : "—"}</td>
                  <td className={genderWarn ? "cell-warn" : ""}>
                    {stats.maleCount}M / {stats.femaleCount}F
                  </td>
                  <td>{mapReadAvg !== null ? fmt(mapReadAvg) : "—"}</td>
                  <td>{mapMathAvg !== null ? fmt(mapMathAvg) : "—"}</td>
                  <td>{fmt(supportLoad)}</td>
                  <td>
                    {c.coTeach.reading && <span className="coteach-chip">Read</span>}
                    {c.coTeach.math && <span className="coteach-chip">Math</span>}
                    {!c.coTeach.reading && !c.coTeach.math && "—"}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
})
