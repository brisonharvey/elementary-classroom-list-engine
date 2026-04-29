import { AppState, GradeSettings, Student, StudentTag } from "./types"

type ReferenceStudentInput = {
  id: number
  firstName: string
  lastName: string
  gender: Student["gender"]
  academicTier: number
  behaviorTier: number
  referrals?: number
  mapReading?: number
  mapMath?: number
  tags?: StudentTag[]
  noContactWith?: number[]
  preferredWith?: number[]
  avoidTeachers?: string[]
  preassignedTeacher?: string
  ell?: boolean
  section504?: boolean
  status?: Student["specialEd"]["status"]
}

function buildGradeSettings(): GradeSettings {
  return {
    maxIEPPerRoom: 6,
    maxReferralsPerRoom: 6,
    ellConcentrationSoftCap: 0.35,
    genderBalanceTolerance: 2,
    classSizeVarianceLimit: 3,
    roomFillPenaltyWeight: 10,
    academicBalancePenaltyWeight: 4,
    behavioralBalancePenaltyWeight: 4,
    demographicBalancePenaltyWeight: 3,
    preferredPeerBonus: 1.75,
    preferredPeerSplitPenalty: 1.25,
    keepTogetherBonus: 2.25,
    keepTogetherSplitPenalty: 1.5,
    ellOverCapPenaltyWeight: 10,
    genderImbalancePenaltyWeight: 2,
    classSizeVariancePenaltyWeight: 1,
    tagTotalBalancePenaltyWeight: 1,
    tagBehavioralPenaltyWeight: 0.65,
    tagEmotionalPenaltyWeight: 0.55,
    tagInstructionalPenaltyWeight: 0.4,
    tagEnergyPenaltyWeight: 0.5,
    tagHotspotPenaltyWeight: 1.5,
    tagHotspotThreshold: 3,
    parentRequestBonus: 0.75,
    showClassroomHeaderTagSupportLoad: false,
    showClassroomHeaderIepCount: false,
    showClassroomHeaderGenderCounts: false,
    showClassroomHeaderMapReadingAverage: false,
    showClassroomHeaderMapMathAverage: false,
  }
}

export function buildReferenceAppState(): AppState {
  const makeStudent = ({
    id,
    firstName,
    lastName,
    gender,
    academicTier,
    behaviorTier,
    referrals = 0,
    mapReading = 0,
    mapMath = 0,
    tags = [],
    noContactWith = [],
    preferredWith = [],
    avoidTeachers = [],
    preassignedTeacher,
    ell = false,
    section504 = false,
    status = "None",
  }: ReferenceStudentInput): Student => ({
    id,
    grade: "3" as const,
    firstName,
    lastName,
    gender,
    specialEd: { status },
    coTeachMinutes: {},
    intervention: { academicTier },
    behaviorTier,
    referrals,
    mapReading,
    mapMath,
    tags,
    noContactWith,
    preferredWith,
    avoidTeachers,
    preassignedTeacher,
    ell,
    section504,
    locked: Boolean(preassignedTeacher),
  })

  const allStudents = [
    makeStudent({ id: 301, firstName: "Mason", lastName: "Rivera", gender: "M", academicTier: 2, behaviorTier: 1, mapReading: 193, mapMath: 196, preferredWith: [307], tags: ["Independent worker"] }),
    makeStudent({ id: 302, firstName: "Ava", lastName: "Nguyen", gender: "F", academicTier: 3, behaviorTier: 2, mapReading: 188, mapMath: 191, tags: ["Needs reassurance"], avoidTeachers: ["Ms. Carter"] }),
    makeStudent({ id: 303, firstName: "Eli", lastName: "Thompson", gender: "M", academicTier: 1, behaviorTier: 2, referrals: 1, mapReading: 201, mapMath: 205, preassignedTeacher: "Ms. Patel" }),
    makeStudent({ id: 304, firstName: "Sofia", lastName: "Martinez", gender: "F", academicTier: 2, behaviorTier: 3, mapReading: 184, mapMath: 189, tags: ["Needs strong routine"], status: "IEP" }),
    makeStudent({ id: 305, firstName: "Noah", lastName: "Kim", gender: "M", academicTier: 3, behaviorTier: 1, mapReading: 190, mapMath: 194, noContactWith: [308], ell: true }),
    makeStudent({ id: 306, firstName: "Harper", lastName: "Brooks", gender: "F", academicTier: 2, behaviorTier: 2, mapReading: 186, mapMath: 188, section504: true }),
    makeStudent({ id: 307, firstName: "Lucas", lastName: "Price", gender: "M", academicTier: 1, behaviorTier: 1, mapReading: 206, mapMath: 208, preferredWith: [301], tags: ["Needs enrichment"] }),
    makeStudent({ id: 308, firstName: "Chloe", lastName: "Davis", gender: "F", academicTier: 3, behaviorTier: 3, referrals: 2, mapReading: 179, mapMath: 183, noContactWith: [305], tags: ["Sensitive to correction"] }),
    makeStudent({ id: 309, firstName: "Henry", lastName: "Cole", gender: "M", academicTier: 2, behaviorTier: 2, mapReading: 192, mapMath: 190, avoidTeachers: ["Ms. Patel"], preassignedTeacher: "Ms. Patel" }),
    makeStudent({ id: 310, firstName: "Grace", lastName: "Lee", gender: "F", academicTier: 1, behaviorTier: 1, mapReading: 204, mapMath: 206 }),
  ]

  const classrooms = [
    createClassroom("3-a", "A", "Ms. Patel", ["reading"], [303, 304, 307], allStudents),
    createClassroom("3-b", "B", "Ms. Carter", [], [301, 305, 306], allStudents),
    createClassroom("3-c", "C", "Mr. Gomez", ["math"], [308, 310], allStudents),
    createClassroom("3-d", "D", "Ms. Ross", [], [302], allStudents),
  ]

  return {
    allStudents,
    teacherProfiles: [
      createTeacher("Ms. Patel", 5, 4, 5, 5),
      createTeacher("Ms. Carter", 4, 5, 4, 4),
      createTeacher("Mr. Gomez", 3, 4, 3, 5),
      createTeacher("Ms. Ross", 5, 3, 4, 4),
    ],
    classrooms,
    schoolName: "Reference Elementary",
    schoolYear: "2026-2027",
    activeGrade: "3",
    showTeacherNames: true,
    weights: { academic: 55, behavioral: 45, demographic: 50, tagSupportLoad: 60 },
    snapshots: [
      {
        id: "snapshot-1",
        grade: "3",
        name: "Initial balanced draft",
        note: "Reference screenshot seed",
        createdAt: 1742940000000,
        payload: {
          classrooms,
          settings: buildGradeSettings(),
        },
      },
    ],
    relationshipRules: [
      { id: "rule-1", type: "NO_CONTACT", studentIds: [305, 308], note: "Family request", createdAt: 1742940000000, grade: "3", scope: "multiYear" },
      { id: "rule-2", type: "DO_NOT_SEPARATE", studentIds: [301, 307], note: "Peer support", createdAt: 1742940000001, grade: "3", scope: "grade" },
    ],
    gradeSettings: {
      K: buildGradeSettings(),
      1: buildGradeSettings(),
      2: buildGradeSettings(),
      3: { ...buildGradeSettings(), showClassroomHeaderGenderCounts: true, showClassroomHeaderMapReadingAverage: true },
      4: buildGradeSettings(),
      5: buildGradeSettings(),
    },
    unresolvedReasons: {
      309: ["Assigned teacher is blocked by this student's teacher restrictions."],
    },
    placementWarnings: ["Henry Cole: Assigned teacher is blocked by this student's teacher restrictions."],
  }
}

function createTeacher(
  teacherName: string,
  structure: 1 | 2 | 3 | 4 | 5,
  regulationBehaviorSupport: 1 | 2 | 3 | 4 | 5,
  socialEmotionalSupport: 1 | 2 | 3 | 4 | 5,
  instructionalExpertise: 1 | 2 | 3 | 4 | 5
) {
  return {
    id: `3:${teacherName.trim().toLowerCase()}`,
    grade: "3" as const,
    teacherName,
    characteristics: { structure, regulationBehaviorSupport, socialEmotionalSupport, instructionalExpertise },
  }
}

function createClassroom(
  id: string,
  label: string,
  teacherName: string,
  coTeachCoverage: ("reading" | "math")[],
  studentIds: number[],
  allStudents: AppState["allStudents"]
) {
  return {
    id,
    grade: "3" as const,
    label,
    teacherName,
    maxSize: 28,
    coTeachCoverage,
    students: studentIds
      .map((studentId) => allStudents.find((student) => student.id === studentId))
      .filter((student): student is AppState["allStudents"][number] => student != null)
      .map((student) => ({ ...student })),
  }
}

export function applyReferenceSeedFromLocation(storageKey: string) {
  if (typeof window === "undefined") return

  const params = new URLSearchParams(window.location.search)
  if (params.get("referenceSeed") !== "docs") return

  window.localStorage.setItem(storageKey, JSON.stringify(buildReferenceAppState()))
}

export function getReferenceViewFromLocation(): { panel: "none" | "rules" | "settings" | "import"; summaryOpen: boolean } {
  if (typeof window === "undefined") {
    return { panel: "none", summaryOpen: false }
  }

  const params = new URLSearchParams(window.location.search)
  if (params.get("referenceSeed") !== "docs") {
    return { panel: "none", summaryOpen: false }
  }

  const panel = params.get("panel")
  return {
    panel: panel === "rules" || panel === "settings" || panel === "import" ? panel : "none",
    summaryOpen: params.get("drawer") === "summary",
  }
}
