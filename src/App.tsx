import { useMemo, useState } from "react"
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
import { RelationshipManager } from "./components/RelationshipManager"
import { GradeSettingsPanel } from "./components/GradeSettingsPanel"
import { getClassroomsForGrade } from "./utils/classroomInit"
import { getRoomMathAvg, getRoomReadingAvg, getRoomSupportLoad } from "./utils/scoring"

type SlidePanel = "none" | "rules" | "settings"

function PlacementWorkspace() {
  const { state } = useApp()
  const { classrooms, activeGrade } = state

  const gradeClassrooms = useMemo(() => getClassroomsForGrade(classrooms, activeGrade), [classrooms, activeGrade])

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
  const { state, dispatch } = useApp()
  const hasStudents = state.allStudents.length > 0
  const [activePanel, setActivePanel] = useState<SlidePanel>("none")
  const [summaryDrawerOpen, setSummaryDrawerOpen] = useState(true)
  const [bottomPanelState, setBottomPanelState] = useState<"expanded" | "minimized" | "hidden">("expanded")
  const showSummaryButton = hasStudents && !summaryDrawerOpen
  const showSnapshotsButton = hasStudents && bottomPanelState === "hidden"
  const showFloatingActions = showSummaryButton || showSnapshotsButton
  const gradeClassrooms = useMemo(
    () => getClassroomsForGrade(state.classrooms, state.activeGrade),
    [state.classrooms, state.activeGrade]
  )
  const settings = state.gradeSettings[state.activeGrade]
  const range = (arr: number[]) => (arr.length < 2 ? 0 : Math.max(...arr) - Math.min(...arr))
  const readingImbalance = range(gradeClassrooms.filter((c) => c.students.length > 0).map((c) => getRoomReadingAvg(c))) > 0.75
  const mathImbalance = range(gradeClassrooms.filter((c) => c.students.length > 0).map((c) => getRoomMathAvg(c))) > 0.75
  const supportImbalance = range(gradeClassrooms.filter((c) => c.students.length > 0).map((c) => getRoomSupportLoad(c))) > 4
  const genderWarningLabels = gradeClassrooms
    .filter((c) => {
      const m = c.students.filter((s) => s.gender === "M").length
      const f = c.students.filter((s) => s.gender === "F").length
      return Math.abs(m - f) > settings.genderBalanceTolerance
    })
    .map((c) => {
      const fallback = `${c.grade}-${c.label}`
      return state.showTeacherNames ? (c.teacherName?.trim() || fallback) : fallback
    })

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">Classroom Placement Engine</h1>
          <span className="app-subtitle">K–5 Elementary Placement Tool</span>
        </div>
        <div className="header-right">
          <CSVUploader />
        </div>
      </header>

      <div className="toolbar">
        <div className="toolbar-left">
          <div className="active-grade-indicator">Grade <strong>{state.activeGrade}</strong></div>
          <GradeSelector />
          <button className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: "ADD_CLASSROOM", payload: { grade: state.activeGrade } })}>Add Classroom</button>
          <button
            className="btn btn-warning btn-sm"
            onClick={() => {
              const gradeRooms = state.classrooms.filter((c) => c.grade === state.activeGrade)
              const room = gradeRooms[gradeRooms.length - 1]
              if (!room) return
              const moveToUnassigned = room.students.length > 0 && window.confirm("Room has students. Move them to Unassigned and delete?")
              if (room.students.length === 0 || moveToUnassigned) {
                dispatch({ type: "DELETE_CLASSROOM", payload: { classroomId: room.id, moveToUnassigned: true } })
              }
            }}
          >Delete Classroom</button>
          <button className={`btn btn-sm ${activePanel === "rules" ? "btn-primary" : "btn-ghost"}`} onClick={() => setActivePanel((v) => (v === "rules" ? "none" : "rules"))}>No-contact Manager</button>
          <button className={`btn btn-sm ${activePanel === "settings" ? "btn-primary" : "btn-ghost"}`} onClick={() => setActivePanel((v) => (v === "settings" ? "none" : "settings"))}>Settings</button>
        </div>
      </div>

      <div className="controls-row">
        <ControlBar />
        <WeightSliders />
      </div>

      {(readingImbalance || mathImbalance || supportImbalance || genderWarningLabels.length > 0) && (
        <div className="main-warnings-row">
          {genderWarningLabels.length > 0 && <div className="warning-chip">⚠ Gender imbalance beyond ±{settings.genderBalanceTolerance}: {genderWarningLabels.join(", ")}</div>}
          {readingImbalance && <div className="warning-chip">⚠ Reading level spread across classrooms</div>}
          {mathImbalance && <div className="warning-chip">⚠ Math level spread across classrooms</div>}
          {supportImbalance && <div className="warning-chip">⚠ Support load imbalanced across classrooms</div>}
        </div>
      )}

      <PlacementWorkspace />

      {hasStudents && (
        <>
          <aside className={`summary-drawer ${summaryDrawerOpen ? "open" : ""}`} aria-hidden={!summaryDrawerOpen}>
            <div className="summary-drawer-header">
              <strong>Grade {state.activeGrade} Summary</strong>
              <button className="btn btn-ghost btn-sm" onClick={() => setSummaryDrawerOpen(false)}>Hide</button>
            </div>
            <div className="summary-drawer-body">
              <SummaryPanel />
            </div>
          </aside>
        </>
      )}

      {hasStudents && bottomPanelState !== "hidden" && (
        <div className={`bottom-panels ${bottomPanelState === "minimized" ? "bottom-panels-minimized" : ""}`}>
          <div className="bottom-panel-controls">
            {bottomPanelState === "expanded" ? (
              <button className="btn btn-ghost btn-sm" onClick={() => setBottomPanelState("minimized")}>Minimize</button>
            ) : (
              <button className="btn btn-ghost btn-sm" onClick={() => setBottomPanelState("expanded")}>Expand</button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => setBottomPanelState("hidden")}>Hide</button>
          </div>
          {bottomPanelState === "expanded" ? (
            <SnapshotManager />
          ) : (
            <button className="bottom-panel-minimized-bar" onClick={() => setBottomPanelState("expanded")} aria-label="Expand summary bar">
              Grade {state.activeGrade} snapshots hidden. Click to expand.
            </button>
          )}
        </div>
      )}

      {showFloatingActions && (
        <div className={`floating-actions floating-actions-${bottomPanelState}`}>
          {showSummaryButton && (
            <button className="floating-action-btn" onClick={() => setSummaryDrawerOpen(true)}>
              Show Summary
            </button>
          )}
          {showSnapshotsButton && (
            <button className="floating-action-btn" onClick={() => setBottomPanelState("expanded")}>
              Show Snapshots
            </button>
          )}
        </div>
      )}

      {activePanel !== "none" && <div className="slide-panel-backdrop" onClick={() => setActivePanel("none")} />}
      <aside className={`slide-panel ${activePanel !== "none" ? "open" : ""}`}>
        {activePanel === "rules" && <RelationshipManager onClose={() => setActivePanel("none")} />}
        {activePanel === "settings" && <GradeSettingsPanel onClose={() => setActivePanel("none")} />}
      </aside>
    </div>
  )
}
