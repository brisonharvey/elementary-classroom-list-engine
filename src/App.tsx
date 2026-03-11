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
import { getGradeTagSupportLoadSummary, TAG_SUPPORT_LOAD_CATEGORY_LABELS, TagSupportLoadCategory } from "./utils/tagSupportLoad"

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
  const [summaryDrawerOpen, setSummaryDrawerOpen] = useState(false)
  const [bottomPanelState, setBottomPanelState] = useState<"expanded" | "minimized" | "hidden">("hidden")
  const showSummaryButton = hasStudents && !summaryDrawerOpen
  const showSnapshotsButton = hasStudents && bottomPanelState === "hidden"
  const showFloatingActions = showSummaryButton || showSnapshotsButton
  const gradeClassrooms = useMemo(
    () => getClassroomsForGrade(state.classrooms, state.activeGrade),
    [state.classrooms, state.activeGrade]
  )
  const settings = state.gradeSettings[state.activeGrade]
  const range = (arr: number[]) => (arr.length < 2 ? 0 : Math.max(...arr) - Math.min(...arr))
  const readingImbalance = range(gradeClassrooms.filter((classroom) => classroom.students.length > 0).map((classroom) => getRoomReadingAvg(classroom))) > 0.75
  const mathImbalance = range(gradeClassrooms.filter((classroom) => classroom.students.length > 0).map((classroom) => getRoomMathAvg(classroom))) > 0.75
  const supportImbalance = range(gradeClassrooms.filter((classroom) => classroom.students.length > 0).map((classroom) => getRoomSupportLoad(classroom))) > 4
  const tagSummary = useMemo(() => getGradeTagSupportLoadSummary(gradeClassrooms, state.activeGrade), [gradeClassrooms, state.activeGrade])
  const tagSupportImbalance = tagSummary.rangeTotal >= 6
  const worstTagCategory = useMemo(() => {
    const categories = Object.keys(tagSummary.rangeByCategory) as TagSupportLoadCategory[]
    return categories.sort((a, b) => tagSummary.rangeByCategory[b] - tagSummary.rangeByCategory[a])[0] ?? "behavioral"
  }, [tagSummary.rangeByCategory])
  const categoryTagImbalance = tagSummary.rangeByCategory[worstTagCategory] >= 4
  const isKindergarten = state.activeGrade === "K"
  const genderWarningLabels = gradeClassrooms
    .filter((classroom) => {
      const maleCount = classroom.students.filter((student) => student.gender === "M").length
      const femaleCount = classroom.students.filter((student) => student.gender === "F").length
      return Math.abs(maleCount - femaleCount) > settings.genderBalanceTolerance
    })
    .map((classroom) => {
      const fallback = `${classroom.grade}-${classroom.label}`
      return state.showTeacherNames ? classroom.teacherName?.trim() || fallback : fallback
    })

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">Classroom Placement Engine</h1>
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
              const rooms = state.classrooms.filter((classroom) => classroom.grade === state.activeGrade)
              const room = rooms[rooms.length - 1]
              if (!room) return
              const moveToUnassigned = room.students.length > 0 && window.confirm("Room has students. Move them to Unassigned and delete?")
              if (room.students.length === 0 || moveToUnassigned) {
                dispatch({ type: "DELETE_CLASSROOM", payload: { classroomId: room.id, moveToUnassigned: true } })
              }
            }}
          >Delete Classroom</button>
          <button className={`btn btn-sm ${activePanel === "rules" ? "btn-primary" : "btn-ghost"}`} onClick={() => setActivePanel((value) => (value === "rules" ? "none" : "rules"))}>No-contact Manager</button>
          <button className={`btn btn-sm ${activePanel === "settings" ? "btn-primary" : "btn-ghost"}`} onClick={() => setActivePanel((value) => (value === "settings" ? "none" : "settings"))}>Settings</button>
        </div>
      </div>

      <div className="controls-row">
        <ControlBar />
        <WeightSliders />
      </div>

      {hasStudents && (
        <details className="student-card-key">
          <summary className="student-card-key-summary">Student Card Key</summary>
          <div className="student-card-key-items" aria-label="Student card key">
            <span className="student-card-key-item"><span className="badge badge-gender badge-f">F</span> Gender</span>
            <span className="student-card-key-item"><span className="badge badge-sped badge-iep">IEP</span> Special education status</span>
            <span className="student-card-key-item"><span className="badge badge-tier tier-2">ACA 2</span> Academic tier</span>
            <span className="student-card-key-item"><span className="badge badge-tier tier-2">SEB 2</span> Social-emotional / behavior tier</span>
            <span className="student-card-key-item"><span className="badge badge-map">MAP R:45</span> MAP Reading</span>
            <span className="student-card-key-item"><span className="badge badge-map">MAP M:48</span> MAP Math</span>
            <span className="student-card-key-item"><span className="badge badge-iready">IR:Mid 2</span> iReady Reading level</span>
            <span className="student-card-key-item"><span className="badge badge-iready">IM:Late 1</span> iReady Math level</span>
            <span className="student-card-key-item"><span className="badge badge-coteach-total">CT:60</span> Total co-teach minutes</span>
            <span className="student-card-key-item"><span className="badge badge-coteach badge-coteach-reading">R:30</span> Co-teach area and minutes</span>
            <span className="student-card-key-item"><span className="badge badge-tags">Chars:3</span> Student characteristics count</span>
            <span className="student-card-key-item"><span className="badge badge-poor-fit">Poor Fit</span> Teacher fit warning</span>
          </div>
        </details>
      )}

      {(readingImbalance || mathImbalance || supportImbalance || tagSupportImbalance || categoryTagImbalance || genderWarningLabels.length > 0) && (
        <div className="main-warnings-row">
          {genderWarningLabels.length > 0 && <div className="warning-chip">Gender imbalance beyond �{settings.genderBalanceTolerance}: {genderWarningLabels.join(", ")}</div>}
          {isKindergarten ? (
            readingImbalance && <div className="warning-chip">Brigance spread across classrooms</div>
          ) : (
            <>
              {readingImbalance && <div className="warning-chip">Reading level spread across classrooms</div>}
              {mathImbalance && <div className="warning-chip">Math level spread across classrooms</div>}
            </>
          )}
          {supportImbalance && <div className="warning-chip">Support load imbalanced across classrooms</div>}
          {tagSupportImbalance && <div className="warning-chip">Characteristic support load range is {tagSummary.rangeTotal.toFixed(1)} across classrooms</div>}
          {categoryTagImbalance && (
            <div className="warning-chip">
              {TAG_SUPPORT_LOAD_CATEGORY_LABELS[worstTagCategory]} characteristic load is concentrated in one room group ({tagSummary.rangeByCategory[worstTagCategory].toFixed(1)} spread)
            </div>
          )}
        </div>
      )}

      <PlacementWorkspace />

      {hasStudents && (
        <aside className={`summary-drawer ${summaryDrawerOpen ? "open" : ""}`} aria-hidden={!summaryDrawerOpen}>
          <div className="summary-drawer-header">
            <strong>Grade {state.activeGrade} Summary</strong>
            <button className="btn btn-ghost btn-sm" onClick={() => setSummaryDrawerOpen(false)}>Hide</button>
          </div>
          <div className="summary-drawer-body">
            <SummaryPanel />
          </div>
        </aside>
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
      <aside className={`slide-panel ${activePanel !== "none" ? "open" : ""} ${activePanel !== "none" ? "slide-panel-wide" : ""}`}>
        {activePanel === "rules" && <RelationshipManager onClose={() => setActivePanel("none")} />}
        {activePanel === "settings" && <GradeSettingsPanel onClose={() => setActivePanel("none")} />}
      </aside>
    </div>
  )
}


