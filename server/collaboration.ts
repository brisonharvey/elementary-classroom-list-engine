import { Action, initialState, reducer } from "../src/store/reducer"
import { CollaborativePlacementState, createEmptyCollaborativeState, extractCollaborativeState } from "../src/shared/collaboration"
import { AppState, Grade } from "../src/types"
import { collectAssignedTeacherPlacementIssues } from "../src/utils/teacherAssignments"

export function buildServerAppState(document: CollaborativePlacementState): AppState {
  const unresolvedReasons = collectAssignedTeacherPlacementIssues(document.allStudents, document.classrooms)

  return {
    ...initialState,
    ...document,
    activeGrade: inferActiveGrade(document),
    showTeacherNames: true,
    unresolvedReasons,
    placementWarnings: [],
  }
}

export function reduceCollaborativeState(document: CollaborativePlacementState, action: Action): CollaborativePlacementState {
  const next = reducer(buildServerAppState(document), action)
  return extractCollaborativeState(next)
}

export function normalizeCollaborativeState(document: Partial<CollaborativePlacementState> | null | undefined): CollaborativePlacementState {
  const base = createEmptyCollaborativeState()
  if (!document) return base
  return {
    ...base,
    ...document,
    allStudents: document.allStudents ?? base.allStudents,
    teacherProfiles: document.teacherProfiles ?? base.teacherProfiles,
    classrooms: document.classrooms ?? base.classrooms,
    snapshots: document.snapshots ?? base.snapshots,
    relationshipRules: document.relationshipRules ?? base.relationshipRules,
    gradeSettings: document.gradeSettings ?? base.gradeSettings,
    weights: document.weights ?? base.weights,
  }
}

function inferActiveGrade(document: CollaborativePlacementState): Grade {
  const firstStudentGrade = document.allStudents[0]?.grade
  if (firstStudentGrade) return firstStudentGrade
  const firstTeacherGrade = document.teacherProfiles[0]?.grade
  if (firstTeacherGrade) return firstTeacherGrade
  return "K"
}
