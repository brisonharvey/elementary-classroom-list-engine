import React, { createContext, Dispatch, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react"
import { api, AuditEvent } from "../lib/api"
import {
  AuthUser,
  collaborationStateEquals,
  CollaborativePlacementState,
  DocumentEnvelope,
  EditLockStatus,
  extractCollaborativeState,
  LAST_WORKSPACE_STORAGE_KEY,
  UI_PREFS_STORAGE_KEY,
  WorkspaceMember,
  WorkspaceRole,
  WorkspaceSummary,
} from "../shared/collaboration"
import { AppState, Classroom, LEGACY_STUDENT_TAG_ALIASES, RelationshipRule, Snapshot, STUDENT_TAGS, Student, TeacherProfile } from "../types"
import {
  createDefaultGradeSettingsMap,
  getRoomLabelFromIndex,
  normalizeGradeSettings,
  normalizeGradeSettingsMap,
} from "../utils/classroomInit"
import { normalizeCoTeachMinutes } from "../utils/coTeach"
import { collectAssignedTeacherPlacementIssues } from "../utils/teacherAssignments"
import { Action, initialState, reducer } from "./reducer"

interface AppContextValue {
  state: AppState
  dispatch: Dispatch<Action>
  collaborationEnabled: boolean
  authStatus: "loading" | "authenticated" | "unauthenticated"
  authUser: AuthUser | null
  authError: string
  statusMessage: string
  workspaces: WorkspaceSummary[]
  currentWorkspaceId?: string
  currentWorkspaceRole?: WorkspaceRole
  members: WorkspaceMember[]
  auditEvents: AuditEvent[]
  latestInviteToken?: string
  documentVersion: number
  lastSavedAt?: string
  lastSavedBy?: string
  lockStatus: EditLockStatus | null
  isSaving: boolean
  isDirty: boolean
  hasConflict: boolean
  canEditWorkspace: boolean
  isReadOnly: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  acceptInvite: (input: { token: string; username: string; password: string; displayName: string; email?: string }) => Promise<void>
  createWorkspace: (name: string) => Promise<void>
  selectWorkspace: (workspaceId: string) => Promise<void>
  saveNow: () => Promise<void>
  reloadWorkspace: () => Promise<void>
  runAutoPlace: () => Promise<void>
  acquireLock: () => Promise<void>
  releaseLock: () => Promise<void>
  takeoverLock: () => Promise<void>
  createInvite: (role: WorkspaceRole, email?: string) => Promise<void>
  addMember: (identifier: string, role: WorkspaceRole) => Promise<void>
  updateMemberRole: (userId: string, role: WorkspaceRole) => Promise<void>
  clearStatus: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export const STORAGE_KEY = "classroom-placement-state-v6"

type LegacyTeacherCharacteristics = {
  classroomStructure?: unknown
  behaviorManagementStrength?: unknown
  emotionalSupportNurturing?: unknown
  academicEnrichmentStrength?: unknown
  independenceScaffolding?: unknown
  movementFlexibility?: unknown
  peerSocialCoaching?: unknown
  confidenceBuilding?: unknown
}

function isReferenceMode(): boolean {
  if (typeof window === "undefined") return false
  return new URLSearchParams(window.location.search).get("referenceSeed") === "docs"
}

function normalizeIdList(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry) && entry > 0)
  }
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return [value]
  }
  return []
}

function normalizeTagList(value: unknown): Student["tags"] {
  if (!Array.isArray(value)) return []

  const normalizedTags = value
    .map((entry) => {
      if (typeof entry !== "string") return null
      if (STUDENT_TAGS.includes(entry as (typeof STUDENT_TAGS)[number])) return entry as (typeof STUDENT_TAGS)[number]
      return LEGACY_STUDENT_TAG_ALIASES[entry] ?? null
    })
    .filter((entry): entry is (typeof STUDENT_TAGS)[number] => entry != null)

  return Array.from(new Set(normalizedTags))
}

function normalizeTeacherList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const normalized: string[] = []
  const seen = new Set<string>()

  for (const entry of value) {
    const trimmed = typeof entry === "string" ? entry.trim() : ""
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    normalized.push(trimmed)
  }

  return normalized
}

function normalizeStudentLists<T extends { noContactWith?: unknown; preferredWith?: unknown; tags?: unknown; avoidTeachers?: unknown }>(student: T): T {
  return {
    ...student,
    noContactWith: normalizeIdList(student.noContactWith),
    preferredWith: normalizeIdList(student.preferredWith),
    tags: normalizeTagList(student.tags),
    avoidTeachers: normalizeTeacherList(student.avoidTeachers),
  }
}

function normalizeStudent(student: Student): Student {
  const readingLegacy = student.specialEd.requiresCoTeachReading ? 30 : 0
  const mathLegacy = student.specialEd.requiresCoTeachMath ? 30 : 0
  const migratedMinutes = {
    ...student.coTeachMinutes,
    ...(readingLegacy > 0 ? { reading: Math.max(student.coTeachMinutes?.reading ?? 0, readingLegacy) } : {}),
    ...(mathLegacy > 0 ? { math: Math.max(student.coTeachMinutes?.math ?? 0, mathLegacy) } : {}),
  }

  return {
    ...normalizeStudentLists(student),
    academicTierNotes: student.academicTierNotes?.trim() || undefined,
    behaviorTierNotes: student.behaviorTierNotes?.trim() || undefined,
    teacherNotes: student.teacherNotes?.trim() || undefined,
    ireadyReading: student.ireadyReading?.trim() || undefined,
    ireadyMath: student.ireadyMath?.trim() || undefined,
    preassignedTeacher: student.preassignedTeacher?.trim() || undefined,
    raceEthnicity: student.raceEthnicity?.trim() || undefined,
    coTeachMinutes: normalizeCoTeachMinutes(migratedMinutes),
    locked: Boolean(student.locked),
    avoidTeachers: normalizeTeacherList(student.avoidTeachers),
  }
}

function normalizeClassroom(classroom: Classroom, index: number): Classroom {
  const legacyCoTeach = (classroom as Classroom & { coTeach?: { reading?: boolean; math?: boolean } }).coTeach
  const legacyCoverage = [
    ...(legacyCoTeach?.reading ? ["reading" as const] : []),
    ...(legacyCoTeach?.math ? ["math" as const] : []),
  ]

  return {
    ...classroom,
    label: classroom.label ?? getRoomLabelFromIndex(index % 4),
    coTeachCoverage: Array.from(new Set([...(classroom.coTeachCoverage ?? []), ...legacyCoverage])),
    students: (classroom.students ?? []).map((student) => normalizeStudent(student)),
  }
}

function normalizeTeacherProfile(profile: TeacherProfile): TeacherProfile {
  const normalizeRating = (value: unknown): 1 | 2 | 3 | 4 | 5 => {
    if (typeof value !== "number" || !Number.isFinite(value)) return 3
    return Math.max(1, Math.min(5, Math.round(value))) as 1 | 2 | 3 | 4 | 5
  }

  const normalizeAverage = (entries: Array<{ value: unknown; weight: number }>): 1 | 2 | 3 | 4 | 5 => {
    const usable = entries
      .map(({ value, weight }) => ({ value: typeof value === "number" && Number.isFinite(value) ? value : null, weight }))
      .filter((entry): entry is { value: number; weight: number } => entry.value != null)

    if (usable.length === 0) return 3

    const totalWeight = usable.reduce((sum, entry) => sum + entry.weight, 0)
    const weightedAverage = usable.reduce((sum, entry) => sum + entry.value * entry.weight, 0) / totalWeight
    return normalizeRating(weightedAverage)
  }

  const characteristics = (profile.characteristics ?? {}) as TeacherProfile["characteristics"] & LegacyTeacherCharacteristics

  const hasNewCharacteristics =
    characteristics.structure != null ||
    characteristics.regulationBehaviorSupport != null ||
    characteristics.socialEmotionalSupport != null ||
    characteristics.instructionalExpertise != null

  return {
    ...profile,
    id: profile.id || `${profile.grade}:${profile.teacherName.trim().toLowerCase()}`,
    teacherName: profile.teacherName?.trim() || "",
    characteristics: hasNewCharacteristics
      ? {
          structure: normalizeRating(characteristics.structure),
          regulationBehaviorSupport: normalizeRating(characteristics.regulationBehaviorSupport),
          socialEmotionalSupport: normalizeRating(characteristics.socialEmotionalSupport),
          instructionalExpertise: normalizeRating(characteristics.instructionalExpertise),
        }
      : {
          structure: normalizeAverage([
            { value: characteristics.classroomStructure, weight: 0.75 },
            { value: characteristics.independenceScaffolding, weight: 0.25 },
          ]),
          regulationBehaviorSupport: normalizeAverage([
            { value: characteristics.behaviorManagementStrength, weight: 0.55 },
            { value: characteristics.classroomStructure, weight: 0.2 },
            { value: characteristics.movementFlexibility, weight: 0.25 },
          ]),
          socialEmotionalSupport: normalizeAverage([
            { value: characteristics.emotionalSupportNurturing, weight: 0.5 },
            { value: characteristics.peerSocialCoaching, weight: 0.25 },
            { value: characteristics.confidenceBuilding, weight: 0.25 },
          ]),
          instructionalExpertise: normalizeAverage([
            { value: characteristics.academicEnrichmentStrength, weight: 0.6 },
            { value: characteristics.independenceScaffolding, weight: 0.25 },
            { value: characteristics.confidenceBuilding, weight: 0.15 },
          ]),
        },
  }
}

function normalizeSnapshot(snapshot: Snapshot): Snapshot {
  return {
    ...snapshot,
    payload: {
      classrooms: (snapshot.payload?.classrooms ?? []).map((classroom, index) => normalizeClassroom(classroom, index)),
      settings: normalizeGradeSettings(snapshot.payload?.settings),
    },
  }
}

function normalizeRelationshipRule(rule: RelationshipRule): RelationshipRule {
  return {
    ...rule,
    note: rule.note?.trim() || undefined,
    scope: rule.scope === "multiYear" ? "multiYear" : "grade",
  }
}

function loadReferenceState(): AppState {
  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ??
      window.localStorage.getItem("classroom-placement-state-v5") ??
      window.localStorage.getItem("classroom-placement-state-v4") ??
      window.localStorage.getItem("classroom-placement-state-v3") ??
      window.localStorage.getItem("classroom-placement-state-v2") ??
      window.localStorage.getItem("classroom-placement-state-v1")
    if (!raw) return initialState
    const parsed = JSON.parse(raw) as Partial<AppState>
    return buildAppStateFromCollaborativeDocument({
      schoolName: typeof parsed.schoolName === "string" ? parsed.schoolName.trim() : "",
      schoolYear: typeof parsed.schoolYear === "string" ? parsed.schoolYear.trim() : "",
      allStudents: (parsed.allStudents ?? []).map((student) => normalizeStudent(student as Student)),
      teacherProfiles: (parsed.teacherProfiles ?? []).map((profile) => normalizeTeacherProfile(profile as TeacherProfile)),
      classrooms: (parsed.classrooms ?? initialState.classrooms).map((classroom, index) => normalizeClassroom(classroom as Classroom, index)),
      weights: { ...initialState.weights, ...(parsed.weights ?? {}) },
      snapshots: (parsed.snapshots ?? []).map((snapshot) => normalizeSnapshot(snapshot as Snapshot)),
      relationshipRules: (parsed.relationshipRules ?? []).map((rule) => normalizeRelationshipRule(rule as RelationshipRule)),
      gradeSettings: parsed.gradeSettings ? normalizeGradeSettingsMap(parsed.gradeSettings) : createDefaultGradeSettingsMap(),
    }, readUiPrefs())
  } catch {
    return initialState
  }
}

function readUiPrefs(): Pick<AppState, "activeGrade" | "showTeacherNames"> {
  if (typeof window === "undefined") {
    return { activeGrade: "K", showTeacherNames: true }
  }

  try {
    const raw = window.localStorage.getItem(UI_PREFS_STORAGE_KEY)
    if (!raw) return { activeGrade: "K", showTeacherNames: true }
    const parsed = JSON.parse(raw) as Partial<Pick<AppState, "activeGrade" | "showTeacherNames">>
    return {
      activeGrade: parsed.activeGrade ?? "K",
      showTeacherNames: parsed.showTeacherNames ?? true,
    }
  } catch {
    return { activeGrade: "K", showTeacherNames: true }
  }
}

function writeUiPrefs(state: AppState) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(
    UI_PREFS_STORAGE_KEY,
    JSON.stringify({
      activeGrade: state.activeGrade,
      showTeacherNames: state.showTeacherNames,
    })
  )
}

function buildAppStateFromCollaborativeDocument(
  document: CollaborativePlacementState,
  uiPrefs: Pick<AppState, "activeGrade" | "showTeacherNames">
): AppState {
  const allStudents = (document.allStudents ?? []).map((student) => normalizeStudent(student))
  const classrooms = (document.classrooms ?? initialState.classrooms).map((classroom, index) => normalizeClassroom(classroom, index))
  const teacherProfiles = (document.teacherProfiles ?? []).map((profile) => normalizeTeacherProfile(profile))
  const snapshots = (document.snapshots ?? []).map((snapshot) => normalizeSnapshot(snapshot))
  const relationshipRules = (document.relationshipRules ?? []).map((rule) => normalizeRelationshipRule(rule))
  const unresolvedReasons = collectAssignedTeacherPlacementIssues(allStudents, classrooms)

  return {
    ...initialState,
    schoolName: document.schoolName?.trim() || "",
    schoolYear: document.schoolYear?.trim() || "",
    allStudents,
    teacherProfiles,
    classrooms,
    weights: { ...initialState.weights, ...(document.weights ?? {}) },
    snapshots,
    relationshipRules,
    gradeSettings: document.gradeSettings ? normalizeGradeSettingsMap(document.gradeSettings) : createDefaultGradeSettingsMap(),
    activeGrade: uiPrefs.activeGrade,
    showTeacherNames: uiPrefs.showTeacherNames,
    unresolvedReasons,
    placementWarnings: [],
  }
}

function isUiOnlyAction(action: Action): boolean {
  return action.type === "SET_ACTIVE_GRADE" || action.type === "SET_SHOW_TEACHER_NAMES" || action.type === "HYDRATE_STATE"
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const referenceMode = useMemo(() => isReferenceMode(), [])
  const [state, baseDispatch] = useReducer(reducer, referenceMode ? loadReferenceState() : initialState)
  const [authStatus, setAuthStatus] = useState<AppContextValue["authStatus"]>(referenceMode ? "authenticated" : "loading")
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [authError, setAuthError] = useState("")
  const [statusMessage, setStatusMessage] = useState(referenceMode ? "Reference seed mode is active." : "")
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([])
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | undefined>(undefined)
  const [currentWorkspaceRole, setCurrentWorkspaceRole] = useState<WorkspaceRole | undefined>(undefined)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])
  const [latestInviteToken, setLatestInviteToken] = useState<string | undefined>(undefined)
  const [documentVersion, setDocumentVersion] = useState(0)
  const [lastSavedAt, setLastSavedAt] = useState<string | undefined>(undefined)
  const [lastSavedBy, setLastSavedBy] = useState<string | undefined>(undefined)
  const [lockStatus, setLockStatus] = useState<EditLockStatus | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [hasConflict, setHasConflict] = useState(false)
  const [baselineDocument, setBaselineDocument] = useState<CollaborativePlacementState>(extractCollaborativeState(initialState))
  const latestStateRef = useRef(state)
  const latestVersionRef = useRef(documentVersion)
  const autosaveTimerRef = useRef<number | null>(null)

  latestStateRef.current = state
  latestVersionRef.current = documentVersion

  const activeCollaborativeState = useMemo(() => extractCollaborativeState(state), [state])
  const isDirty = useMemo(
    () => !referenceMode && !collaborationStateEquals(activeCollaborativeState, baselineDocument),
    [activeCollaborativeState, baselineDocument, referenceMode]
  )

  const canEditWorkspace = Boolean(currentWorkspaceRole && currentWorkspaceRole !== "viewer")
  const isReadOnly = referenceMode ? false : !lockStatus?.isCurrentUserHolder

  const hydrateFromEnvelope = (envelope: DocumentEnvelope<CollaborativePlacementState>) => {
    const nextState = buildAppStateFromCollaborativeDocument(envelope.document, readUiPrefs())
    baseDispatch({ type: "HYDRATE_STATE", payload: nextState })
    setBaselineDocument(extractCollaborativeState(nextState))
    setDocumentVersion(envelope.version)
    setLastSavedAt(envelope.updatedAt)
    setLastSavedBy(envelope.updatedBy)
    setHasConflict(false)
  }

  const refreshWorkspaceMeta = async (workspaceId: string, roleHint?: WorkspaceRole) => {
    const [workspaceResponse, membersResponse, auditResponse, lockResponse] = await Promise.all([
      api.getWorkspace(workspaceId),
      api.listMembers(workspaceId).catch(() => ({ members: [] })),
      api.listAudit(workspaceId).catch(() => ({ events: [] })),
      api.getLock(workspaceId).catch(() => null),
    ])
    setCurrentWorkspaceRole(roleHint ?? workspaceResponse.workspace.role)
    setMembers(membersResponse.members)
    setAuditEvents(auditResponse.events)
    setLockStatus(lockResponse)
  }

  const loadWorkspace = async (workspaceId: string) => {
    const workspace = workspaces.find((entry) => entry.id === workspaceId)
    const [envelope] = await Promise.all([api.getDocument(workspaceId)])
    hydrateFromEnvelope(envelope)
    setCurrentWorkspaceId(workspaceId)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LAST_WORKSPACE_STORAGE_KEY, workspaceId)
    }
    await refreshWorkspaceMeta(workspaceId, workspace?.role)
  }

  const refreshSession = async () => {
    if (referenceMode) return

    try {
      const me = await api.getMe()
      setAuthUser(me.user)
      setAuthStatus("authenticated")
      setAuthError("")
      const workspacesResponse = await api.listWorkspaces()
      setWorkspaces(workspacesResponse.workspaces)

      const preferredWorkspaceId =
        (typeof window !== "undefined" ? window.localStorage.getItem(LAST_WORKSPACE_STORAGE_KEY) : "") || workspacesResponse.workspaces[0]?.id
      if (preferredWorkspaceId) {
        await loadWorkspace(preferredWorkspaceId)
      } else {
        setCurrentWorkspaceId(undefined)
        setCurrentWorkspaceRole(undefined)
      }
    } catch (error) {
      setAuthStatus("unauthenticated")
      setAuthUser(null)
      setWorkspaces([])
      setCurrentWorkspaceId(undefined)
      setCurrentWorkspaceRole(undefined)
      if ((error as { status?: number }).status && (error as { status?: number }).status !== 401) {
        setAuthError((error as Error).message)
      }
    }
  }

  useEffect(() => {
    if (referenceMode) return
    void refreshSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referenceMode])

  useEffect(() => {
    writeUiPrefs(state)
  }, [state.activeGrade, state.showTeacherNames])

  useEffect(() => {
    if (!referenceMode) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [referenceMode, state])

  useEffect(() => {
    if (referenceMode || !currentWorkspaceId || !lockStatus?.isCurrentUserHolder) return

    const interval = window.setInterval(() => {
      void api.heartbeatLock(currentWorkspaceId)
        .then((nextLock) => setLockStatus(nextLock))
        .catch(() => setStatusMessage("Editing lock heartbeat failed. Refresh the workspace if the lock looks stale."))
    }, 60_000)

    return () => window.clearInterval(interval)
  }, [currentWorkspaceId, lockStatus?.isCurrentUserHolder, referenceMode])

  const saveNow = async () => {
    if (referenceMode || !currentWorkspaceId || !lockStatus?.isCurrentUserHolder) return
    const currentDocument = extractCollaborativeState(latestStateRef.current)
    if (collaborationStateEquals(currentDocument, baselineDocument)) return

    setIsSaving(true)
    try {
      const envelope = await api.saveDocument(currentWorkspaceId, latestVersionRef.current, currentDocument)
      hydrateFromEnvelope(envelope)
      await refreshWorkspaceMeta(currentWorkspaceId, currentWorkspaceRole)
      setStatusMessage(`Saved at ${new Date(envelope.updatedAt).toLocaleTimeString()}.`)
    } catch (error) {
      if ((error as { status?: number }).status === 409) {
        setHasConflict(true)
        setStatusMessage("Your local copy is stale. Reload the workspace before saving again.")
      } else {
        setStatusMessage((error as Error).message)
      }
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    if (referenceMode || !currentWorkspaceId || !lockStatus?.isCurrentUserHolder || !isDirty) return

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current)
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      void saveNow()
    }, 2000)

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current)
      }
    }
  }, [referenceMode, currentWorkspaceId, lockStatus?.isCurrentUserHolder, isDirty, baselineDocument])

  const dispatch: Dispatch<Action> = (action) => {
    if (referenceMode || isUiOnlyAction(action)) {
      baseDispatch(action)
      return
    }

    if (!lockStatus?.isCurrentUserHolder) {
      setStatusMessage("Acquire the workspace lock before making shared edits.")
      return
    }

    if (action.type === "AUTO_PLACE") {
      setStatusMessage("Use the collaborative auto-place action so the server writes the shared version.")
      return
    }

    baseDispatch(action)
  }

  const login = async (username: string, password: string) => {
    const response = await api.login(username, password)
    setAuthUser(response.user)
    setAuthStatus("authenticated")
    setAuthError("")
    await refreshSession()
  }

  const logout = async () => {
    if (!referenceMode && currentWorkspaceId && lockStatus?.isCurrentUserHolder) {
      await api.releaseLock(currentWorkspaceId).catch(() => undefined)
    }
    await api.logout()
    setAuthUser(null)
    setAuthStatus(referenceMode ? "authenticated" : "unauthenticated")
    setCurrentWorkspaceId(undefined)
    setCurrentWorkspaceRole(undefined)
    setWorkspaces([])
    setMembers([])
    setAuditEvents([])
    setLockStatus(null)
    setLatestInviteToken(undefined)
    baseDispatch({ type: "HYDRATE_STATE", payload: initialState })
  }

  const acceptInvite = async (input: { token: string; username: string; password: string; displayName: string; email?: string }) => {
    const response = await api.acceptInvite(input)
    setAuthUser(response.user)
    setAuthStatus("authenticated")
    setAuthError("")
    await refreshSession()
  }

  const createWorkspace = async (name: string) => {
    const response = await api.createWorkspace(name)
    const nextWorkspaces = [...workspaces, response.workspace]
    setWorkspaces(nextWorkspaces)
    await loadWorkspace(response.workspace.id)
  }

  const selectWorkspace = async (workspaceId: string) => {
    if (currentWorkspaceId === workspaceId) return
    if (isDirty && lockStatus?.isCurrentUserHolder) {
      await saveNow()
    }
    await loadWorkspace(workspaceId)
  }

  const reloadWorkspace = async () => {
    if (!currentWorkspaceId) return
    await loadWorkspace(currentWorkspaceId)
  }

  const runAutoPlace = async () => {
    if (referenceMode) {
      baseDispatch({ type: "AUTO_PLACE" })
      return
    }
    if (!currentWorkspaceId) return
    if (!lockStatus?.isCurrentUserHolder) {
      setStatusMessage("Acquire the workspace lock before running auto-place.")
      return
    }
    if (isDirty) {
      await saveNow()
    }
    try {
      const envelope = await api.autoPlace(currentWorkspaceId, latestVersionRef.current)
      hydrateFromEnvelope(envelope)
      await refreshWorkspaceMeta(currentWorkspaceId, currentWorkspaceRole)
      setStatusMessage("Auto-place saved to the shared workspace.")
    } catch (error) {
      setStatusMessage((error as Error).message)
    }
  }

  const acquireLock = async () => {
    if (!currentWorkspaceId) return
    try {
      const nextLock = await api.acquireLock(currentWorkspaceId)
      setLockStatus(nextLock)
      await refreshWorkspaceMeta(currentWorkspaceId, currentWorkspaceRole)
      setStatusMessage("Workspace lock acquired.")
    } catch (error) {
      setStatusMessage((error as Error).message)
    }
  }

  const releaseLock = async () => {
    if (!currentWorkspaceId) return
    try {
      await api.releaseLock(currentWorkspaceId)
      setLockStatus(await api.getLock(currentWorkspaceId))
      await refreshWorkspaceMeta(currentWorkspaceId, currentWorkspaceRole)
      setStatusMessage("Workspace lock released.")
    } catch (error) {
      setStatusMessage((error as Error).message)
    }
  }

  const takeoverLock = async () => {
    if (!currentWorkspaceId) return
    try {
      const nextLock = await api.takeoverLock(currentWorkspaceId)
      setLockStatus(nextLock)
      await refreshWorkspaceMeta(currentWorkspaceId, currentWorkspaceRole)
      setStatusMessage("Workspace lock taken over.")
    } catch (error) {
      setStatusMessage((error as Error).message)
    }
  }

  const createInvite = async (role: WorkspaceRole, email?: string) => {
    if (!currentWorkspaceId) return
    const invite = await api.createInvite(currentWorkspaceId, role, email)
    setLatestInviteToken(invite.token)
    setStatusMessage("Invite created. Copy the token or append it as ?invite=TOKEN in the URL.")
  }

  const addMember = async (identifier: string, role: WorkspaceRole) => {
    if (!currentWorkspaceId) return
    const response = await api.addMember(currentWorkspaceId, identifier, role)
    setMembers(response.members)
    setStatusMessage("Member added to the workspace.")
  }

  const updateMemberRole = async (userId: string, role: WorkspaceRole) => {
    if (!currentWorkspaceId) return
    const response = await api.updateMemberRole(currentWorkspaceId, userId, role)
    setMembers(response.members)
    setStatusMessage("Workspace role updated.")
  }

  const clearStatus = () => {
    setStatusMessage("")
    setAuthError("")
  }

  const value = useMemo<AppContextValue>(() => ({
    state,
    dispatch,
    collaborationEnabled: !referenceMode,
    authStatus,
    authUser,
    authError,
    statusMessage,
    workspaces,
    currentWorkspaceId,
    currentWorkspaceRole,
    members,
    auditEvents,
    latestInviteToken,
    documentVersion,
    lastSavedAt,
    lastSavedBy,
    lockStatus,
    isSaving,
    isDirty,
    hasConflict,
    canEditWorkspace,
    isReadOnly,
    login,
    logout,
    acceptInvite,
    createWorkspace,
    selectWorkspace,
    saveNow,
    reloadWorkspace,
    runAutoPlace,
    acquireLock,
    releaseLock,
    takeoverLock,
    createInvite,
    addMember,
    updateMemberRole,
    clearStatus,
  }), [
    state,
    referenceMode,
    authStatus,
    authUser,
    authError,
    statusMessage,
    workspaces,
    currentWorkspaceId,
    currentWorkspaceRole,
    members,
    auditEvents,
    latestInviteToken,
    documentVersion,
    lastSavedAt,
    lastSavedBy,
    lockStatus,
    isSaving,
    isDirty,
    hasConflict,
    canEditWorkspace,
    isReadOnly,
  ])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used within AppProvider")
  return ctx
}
