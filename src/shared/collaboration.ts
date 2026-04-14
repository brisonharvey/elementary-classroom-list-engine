import { AppState, Classroom, GradeSettingsMap, RelationshipRule, Snapshot, Student, TeacherProfile, Weights } from "../types"
import { createDefaultGradeSettingsMap, initializeClassrooms } from "../utils/classroomInit"

export type WorkspaceRole = "owner" | "editor" | "viewer"

export interface CollaborativePlacementState {
  schoolName: string
  schoolYear: string
  allStudents: Student[]
  teacherProfiles: TeacherProfile[]
  classrooms: Classroom[]
  weights: Weights
  snapshots: Snapshot[]
  relationshipRules: RelationshipRule[]
  gradeSettings: GradeSettingsMap
}

export interface AuthUser {
  id: string
  username: string
  displayName: string
  email?: string
}

export interface WorkspaceSummary {
  id: string
  name: string
  role: WorkspaceRole
  updatedAt: string
  updatedBy?: string
}

export interface WorkspaceMember {
  userId: string
  username: string
  displayName: string
  email?: string
  role: WorkspaceRole
  joinedAt: string
}

export interface DocumentEnvelope<T> {
  version: number
  updatedAt: string
  updatedBy?: string
  document: T
}

export interface EditLockStatus {
  workspaceId: string
  locked: boolean
  holderUserId?: string
  holderDisplayName?: string
  expiresAt?: string
  isCurrentUserHolder: boolean
  canTakeOver: boolean
}

export interface InviteRecord {
  id: string
  workspaceId: string
  workspaceName: string
  role: WorkspaceRole
  token: string
  createdAt: string
  expiresAt: string
}

export interface WorkspaceDetails extends WorkspaceSummary {
  members?: WorkspaceMember[]
}

export const LAST_WORKSPACE_STORAGE_KEY = "collab-last-workspace-id"
export const UI_PREFS_STORAGE_KEY = "collab-ui-prefs-v1"

export function createEmptyCollaborativeState(): CollaborativePlacementState {
  return {
    schoolName: "",
    schoolYear: "",
    allStudents: [],
    teacherProfiles: [],
    classrooms: initializeClassrooms(),
    weights: { academic: 50, behavioral: 50, demographic: 50, tagSupportLoad: 50 },
    snapshots: [],
    relationshipRules: [],
    gradeSettings: createDefaultGradeSettingsMap(),
  }
}

export function extractCollaborativeState(state: AppState): CollaborativePlacementState {
  return {
    schoolName: state.schoolName,
    schoolYear: state.schoolYear,
    allStudents: state.allStudents,
    teacherProfiles: state.teacherProfiles,
    classrooms: state.classrooms,
    weights: state.weights,
    snapshots: state.snapshots,
    relationshipRules: state.relationshipRules,
    gradeSettings: state.gradeSettings,
  }
}

export function collaborationStateEquals(left: CollaborativePlacementState, right: CollaborativePlacementState): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
