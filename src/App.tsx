import { Suspense, lazy, useEffect, useMemo, useState } from "react"
import { useApp } from "./store/AppContext"
import { DragProvider } from "./store/DragContext"
import { GradeSelector } from "./components/GradeSelector"
import { WeightSliders } from "./components/WeightSliders"
import { ControlBar } from "./components/ControlBar"
import { UnassignedPanel } from "./components/UnassignedPanel"
import { ClassroomColumn } from "./components/ClassroomColumn"
import { SummaryPanel } from "./components/SummaryPanel"
import { SnapshotManager } from "./components/SnapshotManager"
import { RelationshipManager } from "./components/RelationshipManager"
import { GradeSettingsPanel } from "./components/GradeSettingsPanel"
import { QuickStartGuide } from "./components/QuickStartGuide"
import { ClassroomDeleteDialog } from "./components/ClassroomDeleteDialog"
import { StudentCardKey } from "./components/StudentCardKey"
import { getClassroomsForGrade } from "./utils/classroomInit"
import { getGradeReviewWarnings } from "./utils/gradeReview"

const CsvImportPanel = lazy(async () => {
  const module = await import("./features/csv-import")
  return { default: module.CsvImportPanel }
})

type SlidePanel = "none" | "import" | "rules" | "settings"

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
  const [quickStartDismissed, setQuickStartDismissed] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedDeleteClassroomId, setSelectedDeleteClassroomId] = useState<string>("")
  const showSummaryButton = hasStudents && !summaryDrawerOpen
  const showSnapshotsButton = hasStudents && bottomPanelState === "hidden"
  const showFloatingActions = showSummaryButton || showSnapshotsButton
  const gradeClassrooms = useMemo(
    () => getClassroomsForGrade(state.classrooms, state.activeGrade),
    [state.classrooms, state.activeGrade]
  )
  const settings = state.gradeSettings[state.activeGrade]
  const gradeWarnings = useMemo(
    () => getGradeReviewWarnings(gradeClassrooms, state.activeGrade, settings, state.showTeacherNames),
    [gradeClassrooms, settings, state.activeGrade, state.showTeacherNames]
  )

  const hasTeachers = state.teacherProfiles.length > 0
  const showQuickStart = !quickStartDismissed && (!hasStudents || !hasTeachers)
  const deleteCandidates = state.classrooms.filter((classroom) => classroom.grade === state.activeGrade)

  useEffect(() => {
    if (!hasStudents && !hasTeachers) {
      setQuickStartDismissed(false)
      setActivePanel("none")
      setSummaryDrawerOpen(false)
      setBottomPanelState("hidden")
      setDeleteDialogOpen(false)
      setSelectedDeleteClassroomId("")
    }
  }, [hasStudents, hasTeachers])

  const openDeleteDialog = () => {
    if (deleteCandidates.length === 0) return
    setSelectedDeleteClassroomId(deleteCandidates[0].id)
    setDeleteDialogOpen(true)
  }

  const confirmDeleteClassroom = () => {
    if (!selectedDeleteClassroomId) return
    dispatch({ type: "DELETE_CLASSROOM", payload: { classroomId: selectedDeleteClassroomId, moveToUnassigned: true } })
    setDeleteDialogOpen(false)
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">Classroom Placement Engine</h1>
        </div>
        <div className="header-right">
          <button className={`btn btn-sm ${activePanel === "import" ? "btn-primary" : "btn-ghost"}`} onClick={() => setActivePanel((value) => (value === "import" ? "none" : "import"))}>
            Import CSV
          </button>
        </div>
      </header>

      <div className="toolbar">
        <div className="toolbar-left">
          <div className="active-grade-indicator">Grade <strong>{state.activeGrade}</strong></div>
          <GradeSelector />
          <button className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: "ADD_CLASSROOM", payload: { grade: state.activeGrade } })}>Add Classroom</button>
          <button
            className="btn btn-warning btn-sm"
            onClick={openDeleteDialog}
            disabled={deleteCandidates.length === 0}
          >Delete Classroom</button>
          <button className={`btn btn-sm ${activePanel === "rules" ? "btn-primary" : "btn-ghost"}`} onClick={() => setActivePanel((value) => (value === "rules" ? "none" : "rules"))}>No-contact Manager</button>
          <button className={`btn btn-sm ${activePanel === "settings" ? "btn-primary" : "btn-ghost"}`} onClick={() => setActivePanel((value) => (value === "settings" ? "none" : "settings"))}>Settings</button>
        </div>
      </div>

      <div className="controls-row">
        <ControlBar
          onOpenImport={() => setActivePanel("import")}
          onOpenRules={() => setActivePanel("rules")}
          onOpenSettings={() => setActivePanel("settings")}
          onShowSummary={() => setSummaryDrawerOpen(true)}
        />
        <WeightSliders />
      </div>

      {showQuickStart && (
        <QuickStartGuide
          hasStudents={hasStudents}
          hasTeachers={hasTeachers}
          activeGrade={state.activeGrade}
          gradeRooms={gradeClassrooms}
          onOpenImport={() => setActivePanel("import")}
          onOpenSettings={() => setActivePanel("settings")}
          onDismiss={() => setQuickStartDismissed(true)}
        />
      )}

      {hasStudents && (
        <StudentCardKey />
      )}

      {gradeWarnings.length > 0 && (
        <div className="main-warnings-row">
          {gradeWarnings.map((warning) => (
            <div key={warning.key} className="warning-chip">{warning.label}</div>
          ))}
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
        {activePanel === "import" && (
          <Suspense fallback={<div className="slide-panel-loading">Loading import tools...</div>}>
            <CsvImportPanel onClose={() => setActivePanel("none")} />
          </Suspense>
        )}
        {activePanel === "rules" && <RelationshipManager onClose={() => setActivePanel("none")} />}
        {activePanel === "settings" && <GradeSettingsPanel onClose={() => setActivePanel("none")} />}
      </aside>
      {deleteDialogOpen && (
        <ClassroomDeleteDialog
          classrooms={deleteCandidates}
          activeGrade={state.activeGrade}
          selectedId={selectedDeleteClassroomId}
          onSelect={setSelectedDeleteClassroomId}
          onCancel={() => setDeleteDialogOpen(false)}
          onConfirm={confirmDeleteClassroom}
        />
      )}
    </div>
  )
}


