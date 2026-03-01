import { useMemo } from "react"
import { useApp } from "./store/AppContext"
import { DragProvider } from "./store/DragContext"
import { CSVUploader } from "./components/CSVUploader"
import { GradeSelector } from "./components/GradeSelector"
import { WeightSliders } from "./components/WeightSliders"
import { ControlBar } from "./components/ControlBar"
import { UnassignedPanel } from "./components/UnassignedPanel"
import { ClassroomColumn } from "./components/ClassroomColumn"
import { SummaryPanel } from "./components/SummaryPanel"
import { SnapshotManager } from "./components/SnapshotManager"
import { getClassroomsForGrade } from "./utils/classroomInit"

function PlacementWorkspace() {
  const { state } = useApp()
  const { classrooms, activeGrade } = state

  const gradeClassrooms = useMemo(
    () => getClassroomsForGrade(classrooms, activeGrade),
    [classrooms, activeGrade]
  )

  return (
    <DragProvider>
      <div className="workspace">
        <UnassignedPanel />
        {gradeClassrooms.map((classroom) => (
          <ClassroomColumn key={classroom.id} classroom={classroom} />
        ))}
      </div>
    </DragProvider>
  )
}

export default function App() {
  const { state } = useApp()
  const hasStudents = state.allStudents.length > 0

  return (
    <div className="app">
      {/* ── App Header ── */}
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">Classroom Placement Engine</h1>
          <span className="app-subtitle">K–5 Elementary Placement Tool</span>
        </div>
        <div className="header-right">
          <CSVUploader />
        </div>
      </header>

      {/* ── Grade selector + active grade indicator ── */}
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="active-grade-indicator">
            Grade <strong>{state.activeGrade}</strong>
          </div>
          <GradeSelector />
        </div>
      </div>

      {/* ── Controls + Sliders ── */}
      <div className="controls-row">
        <ControlBar />
        <WeightSliders />
      </div>

      {/* ── Main placement workspace ── */}
      <PlacementWorkspace />

      {/* ── Summary + Snapshots ── */}
      {hasStudents && (
        <div className="bottom-panels">
          <SummaryPanel />
          <SnapshotManager />
        </div>
      )}
    </div>
  )
}
