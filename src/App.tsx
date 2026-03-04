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

      <PlacementWorkspace />

      {hasStudents && (
        <div className="bottom-panels">
          <SummaryPanel />
          <SnapshotManager />
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
