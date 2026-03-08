import { memo, useMemo } from "react"
import { useApp } from "../store/AppContext"
import { getClassroomsForGrade } from "../utils/classroomInit"
import { CO_TEACH_LABELS } from "../utils/coTeach"
import { computeRoomStats, getRoomSupportLoad } from "../utils/scoring"
import { getPoorFitStudentCount } from "../utils/teacherFit"

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
  const { classrooms, activeGrade, allStudents, gradeSettings, showTeacherNames, teacherProfiles } = state

  const gradeClassrooms = useMemo(() => getClassroomsForGrade(classrooms, activeGrade), [classrooms, activeGrade])
  const isKindergarten = activeGrade === "K"

  const totalStudents = allStudents.filter((student) => student.grade === activeGrade).length
  const totalIEP = allStudents.filter((student) => student.grade === activeGrade && student.specialEd.status === "IEP").length
  const totalReferral = allStudents.filter((student) => student.grade === activeGrade && student.specialEd.status === "Referral").length
  const totalEL = allStudents.filter((student) => student.grade === activeGrade && student.ell).length
  const total504 = allStudents.filter((student) => student.grade === activeGrade && student.section504).length
  const totalPoorFit = gradeClassrooms.reduce((sum, classroom) => sum + getPoorFitStudentCount(classroom, teacherProfiles), 0)
  const raceCounts = allStudents
    .filter((student) => student.grade === activeGrade)
    .reduce<Record<string, number>>((acc, student) => {
      const race = student.raceEthnicity?.trim() || "Unreported"
      acc[race] = (acc[race] ?? 0) + 1
      return acc
    }, {})

  const roomStats = useMemo(() => gradeClassrooms.map((classroom) => computeRoomStats(classroom)), [gradeClassrooms])
  const raceStyleByLabel = useMemo(() => {
    const labels = Object.keys(raceCounts).sort((a, b) => a.localeCompare(b))
    return labels.reduce<Record<string, { backgroundColor: string; borderColor: string; color: string }>>((acc, race, index) => {
      acc[race] = RACE_CHIP_PALETTE[index % RACE_CHIP_PALETTE.length]
      return acc
    }, {})
  }, [raceCounts])

  const settings = gradeSettings[activeGrade]

  const genderWarningRooms = gradeClassrooms.filter((classroom) => {
    const maleCount = classroom.students.filter((student) => student.gender === "M").length
    const femaleCount = classroom.students.filter((student) => student.gender === "F").length
    return Math.abs(maleCount - femaleCount) > settings.genderBalanceTolerance
  })
  const genderWarnings = genderWarningRooms.map((classroom) => classroom.id)

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
          {totalPoorFit > 0 && <span className="total-pill total-pill-poor-fit">{totalPoorFit} poor fit</span>}
        </div>
      </div>

      <div className="race-totals">
        {Object.entries(raceCounts)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([race, count]) => (
            <span key={race} className="total-pill race-pill" style={raceStyleByLabel[race]}>
              {race}: {count}
            </span>
          ))}
      </div>

      <div className="support-load-help">
        <strong>Placement order:</strong> hard constraints first, then teacher-fit alignment, then academic/behavior/demographic balancing.
        <br />
        <strong>Support Load:</strong> academic tier + behavior tier + special education status bonus + referral count + normalized co-teach load.
        {isKindergarten && <><br /><strong>Kindergarten academics:</strong> Brigance readiness replaces MAP and i-Ready in placement scoring.</>}
      </div>

      <div className="summary-table-wrap">
        <div className="summary-room-list">
          {gradeClassrooms.map((classroom, index) => {
            const stats = roomStats[index]
            const supportLoad = getRoomSupportLoad(classroom)
            const poorFitCount = getPoorFitStudentCount(classroom, teacherProfiles)
            const getAverage = (kind: "mapReading" | "mapMath" | "briganceReadiness"): number | null => {
              const values = classroom.students.map((student) => student[kind]).filter((value): value is number => value !== undefined)
              if (values.length === 0) return null
              return values.reduce((sum, value) => sum + value, 0) / values.length
            }
            const briganceAvg = getAverage("briganceReadiness")
            const mapReadAvg = getAverage("mapReading")
            const mapMathAvg = getAverage("mapMath")

            const genderWarn = genderWarnings.includes(classroom.id)
            const coTeachBreakdown = Object.entries(stats.coTeachMinutesByCategory)
              .filter(([, minutes]) => minutes > 0)
              .map(([category, minutes]) => `${CO_TEACH_LABELS[category as keyof typeof CO_TEACH_LABELS]}: ${minutes}`)
              .join("\n")
            const raceBreakdown = Object.entries(
              classroom.students.reduce<Record<string, number>>((acc, student) => {
                const race = student.raceEthnicity?.trim() || "Unreported"
                acc[race] = (acc[race] ?? 0) + 1
                return acc
              }, {})
            ).sort(([a], [b]) => a.localeCompare(b))

            return (
              <article key={classroom.id} className={`summary-room-card ${genderWarn ? "summary-room-card-warn" : ""}`}>
                <div className="summary-room-header">
                  <div className="summary-room-title">{classroom.grade}-{classroom.label}</div>
                  <div className="summary-room-teacher">{showTeacherNames ? classroom.teacherName || "-" : "Hidden"}</div>
                  <span className="summary-room-size" style={{ color: stats.size >= classroom.maxSize ? "#ef4444" : stats.size / classroom.maxSize > 0.85 ? "#f59e0b" : "inherit" }}>
                    {stats.size}/{classroom.maxSize}
                  </span>
                </div>

                <div className="summary-room-metrics">
                  <span className="summary-metric">IEP: {stats.iepCount || "-"}</span>
                  <span className="summary-metric">Ref: {stats.referralCount || "-"}</span>
                  <span className="summary-metric">EL: {stats.ellCount || "-"}</span>
                  <span className="summary-metric">504: {stats.section504Count || "-"}</span>
                  <span className={`summary-metric ${genderWarn ? "cell-warn" : ""}`}>M/F: {stats.maleCount}/{stats.femaleCount}</span>
                  {isKindergarten ? (
                    <span className="summary-metric">Brigance: {briganceAvg !== null ? fmt(briganceAvg) : "-"}</span>
                  ) : (
                    <>
                      <span className="summary-metric">MAP R: {mapReadAvg !== null ? fmt(mapReadAvg) : "-"}</span>
                      <span className="summary-metric">MAP M: {mapMathAvg !== null ? fmt(mapMathAvg) : "-"}</span>
                    </>
                  )}
                  <span className="summary-metric">Support: {fmt(supportLoad)}</span>
                  <span className="summary-metric" title={coTeachBreakdown || "No co-teach minutes"}>Co-teach: {stats.totalCoTeachMinutes} total / {fmt(stats.avgCoTeachMinutes)} avg</span>
                  {poorFitCount > 0 && <span className="summary-metric summary-metric-poor-fit">Poor fit: {poorFitCount}</span>}
                </div>

                <div className="summary-room-section">
                  <div className="summary-room-section-label">Race / Ethnicity</div>
                  {raceBreakdown.length === 0 ? "-" : (
                    <div className="race-chip-list">
                      {raceBreakdown.map(([race, count]) => (
                        <span key={`${classroom.id}-${race}`} className="race-pill" style={raceStyleByLabel[race]}>
                          {race}: {count}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="summary-room-section">
                  <div className="summary-room-section-label">Co-teach Coverage</div>
                  <div>
                    {classroom.coTeachCoverage.length
                      ? classroom.coTeachCoverage.map((category) => <span key={category} className="coteach-chip">{CO_TEACH_LABELS[category]}</span>)
                      : "-"}
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
