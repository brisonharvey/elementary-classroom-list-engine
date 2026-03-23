const assert = require("node:assert/strict")

const { reducer, initialState } = require("./.compiled/src/store/reducer.js")
const { createDefaultGradeSettingsMap } = require("./.compiled/src/utils/classroomInit.js")
const { buildPlacementCSV } = require("./.compiled/src/utils/exportUtils.js")
const { runPlacement } = require("./.compiled/src/engine/placementEngine.js")
const { getManualMoveWarnings, getManualUnassignedWarnings } = require("./.compiled/src/utils/constraints.js")

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function createStudent(id, overrides = {}) {
  return {
    id,
    grade: "1",
    firstName: `Student${id}`,
    lastName: `Last${id}`,
    gender: "F",
    specialEd: { status: "None" },
    coTeachMinutes: {},
    intervention: { academicTier: 1 },
    behaviorTier: 1,
    referrals: 0,
    briganceReadiness: undefined,
    mapReading: undefined,
    mapMath: undefined,
    ireadyReading: undefined,
    ireadyMath: undefined,
    tags: [],
    preassignedTeacher: undefined,
    noContactWith: [],
    preferredWith: [],
    locked: false,
    ell: false,
    section504: false,
    raceEthnicity: undefined,
    teacherNotes: undefined,
    ...overrides,
  }
}

function createClassroom(id, students = [], overrides = {}) {
  return {
    id,
    grade: "1",
    label: id,
    teacherName: `Teacher ${id}`,
    maxSize: 25,
    coTeachCoverage: [],
    students,
    ...overrides,
  }
}

function createState() {
  const alpha = createStudent(101, { firstName: "Alpha", noContactWith: [102], preferredWith: [102], locked: true })
  const beta = createStudent(102, { firstName: "Beta", noContactWith: [101], preferredWith: [101] })

  const base = clone(initialState)
  base.allStudents = [alpha, beta]
  base.classrooms = [
    createClassroom("1-A", [clone(alpha)]),
    createClassroom("1-B", []),
  ]
  base.relationshipRules = [
    {
      id: "rule-1",
      type: "NO_CONTACT",
      studentIds: [101, 102],
      createdAt: 1,
      grade: "1",
    },
  ]
  return base
}

const tests = [
  {
    name: "upserting a student with a new id rewrites references and keeps classroom placement",
    run: () => {
      const state = createState()
      const updated = createStudent(201, {
        firstName: "Alpha",
        lastName: "Edited",
        noContactWith: [102],
        preferredWith: [102],
        locked: true,
      })

      const next = reducer(state, {
        type: "UPSERT_STUDENT",
        payload: { student: updated, previousId: 101 },
      })

      assert.equal(next.allStudents.some((student) => student.id === 101), false)
      assert.equal(next.allStudents.some((student) => student.id === 201), true)
      assert.deepEqual(next.allStudents.find((student) => student.id === 102).noContactWith, [201])
      assert.deepEqual(next.allStudents.find((student) => student.id === 102).preferredWith, [201])
      assert.deepEqual(next.classrooms[0].students.map((student) => student.id), [201])
      assert.equal(next.classrooms[0].students[0].locked, true)
      assert.deepEqual(next.relationshipRules[0].studentIds, [201, 102])
    },
  },
  {
    name: "changing a student grade clears incompatible relationship rules and removes old placement",
    run: () => {
      const state = createState()
      const next = reducer(state, {
        type: "UPSERT_STUDENT",
        payload: {
          previousId: 101,
          student: createStudent(101, { firstName: "Alpha", grade: "2" }),
        },
      })

      assert.equal(next.relationshipRules.length, 0)
      assert.deepEqual(next.classrooms[0].students, [])
      assert.equal(next.allStudents.find((student) => student.id === 101).grade, "2")
    },
  },
  {
    name: "assigned teacher on manual edit places and locks the student in a matching classroom",
    run: () => {
      const state = createState()
      state.classrooms = [
        createClassroom("1-A", []),
        createClassroom("1-B", [], { teacherName: "Ms. Rivera" }),
      ]
      state.allStudents = [createStudent(301, { firstName: "Gamma" })]

      const next = reducer(state, {
        type: "UPSERT_STUDENT",
        payload: {
          student: createStudent(301, { firstName: "Gamma", preassignedTeacher: "Ms. Rivera" }),
        },
      })

      assert.equal(next.classrooms[1].students.length, 1)
      assert.equal(next.classrooms[1].students[0].id, 301)
      assert.equal(next.classrooms[1].students[0].locked, true)
      assert.equal(next.allStudents[0].locked, true)
    },
  },
  {
    name: "clearing assigned teacher in the student editor unlocks a previously teacher-fixed student",
    run: () => {
      const state = createState()
      state.allStudents = [createStudent(501, { firstName: "Echo", preassignedTeacher: "Ms. Rivera", locked: true })]
      state.classrooms = [
        createClassroom("1-A", [createStudent(501, { firstName: "Echo", preassignedTeacher: "Ms. Rivera", locked: true })], { teacherName: "Ms. Rivera" }),
        createClassroom("1-B", []),
      ]

      const next = reducer(state, {
        type: "UPSERT_STUDENT",
        payload: {
          student: createStudent(501, { firstName: "Echo", preassignedTeacher: undefined, locked: false }),
        },
      })

      assert.equal(next.allStudents[0].locked, false)
      assert.equal(next.allStudents[0].preassignedTeacher, undefined)
      assert.equal(next.classrooms[0].students[0].locked, false)
    },
  },
  {
    name: "export falls back to preassigned teacher when student is still unassigned",
    run: () => {
      const student = createStudent(401, { firstName: "Delta", preassignedTeacher: "Ms. Lane" })
      const csv = buildPlacementCSV([createClassroom("1-A", [])], [student], "1")
      const row = csv.split("\n")[1].split(",")
      assert.equal(row[row.length - 1], "Ms. Lane")
    },
  },
  {
    name: "deleting a student removes classroom placements, rules, and peer references",
    run: () => {
      const state = createState()
      const next = reducer(state, { type: "DELETE_STUDENT", payload: 101 })

      assert.deepEqual(next.allStudents.map((student) => student.id), [102])
      assert.deepEqual(next.classrooms[0].students, [])
      assert.equal(next.relationshipRules.length, 0)
      assert.deepEqual(next.allStudents[0].noContactWith, [])
      assert.deepEqual(next.allStudents[0].preferredWith, [])
    },
  },
  {
    name: "student and rule edits preserve teacher-fixed diagnostics for other students",
    run: () => {
      const state = createState()
      state.allStudents = [
        createStudent(801, { firstName: "Locked", preassignedTeacher: "Ms. Rivera", locked: true }),
        createStudent(802, { firstName: "Peer", noContactWith: [803] }),
        createStudent(803, { firstName: "Other", noContactWith: [802] }),
      ]
      state.classrooms = [
        createClassroom("1-A", [], { teacherName: "Ms. Stone" }),
        createClassroom("1-B", []),
      ]
      state.relationshipRules = [
        {
          id: "rule-2",
          type: "NO_CONTACT",
          studentIds: [802, 803],
          createdAt: 1,
          grade: "1",
        },
      ]

      const afterDelete = reducer(state, { type: "DELETE_STUDENT", payload: 802 })
      assert.match(afterDelete.unresolvedReasons[801][0], /does not have a matching classroom/i)
      assert.ok(afterDelete.placementWarnings.some((warning) => /Locked/.test(warning)))

      const afterRuleDelete = reducer(state, {
        type: "DELETE_NO_CONTACT_PAIR",
        payload: {
          grade: "1",
          studentIds: [802, 803],
        },
      })
      assert.match(afterRuleDelete.unresolvedReasons[801][0], /does not have a matching classroom/i)
      assert.ok(afterRuleDelete.placementWarnings.some((warning) => /Locked/.test(warning)))
    },
  },
  {
    name: "adding a student appends to the roster without auto-assigning a classroom",
    run: () => {
      const state = createState()
      const next = reducer(state, {
        type: "UPSERT_STUDENT",
        payload: {
          student: createStudent(303, { firstName: "Gamma", grade: "1" }),
        },
      })

      assert.equal(next.allStudents.some((student) => student.id === 303), true)
      assert.equal(next.classrooms.some((classroom) => classroom.students.some((student) => student.id === 303)), false)
    },
  },
  {
    name: "loading a second student batch updates existing students and preserves existing placements",
    run: () => {
      const state = createState()
      state.classrooms = [
        createClassroom("1-A", [createStudent(101, { firstName: "Alpha", locked: true })], { teacherName: "Ms. Rivera" }),
        createClassroom("1-B", []),
      ]

      const next = reducer(state, {
        type: "LOAD_STUDENTS",
        payload: [
          createStudent(101, { firstName: "Duplicate Alpha" }),
          createStudent(303, { firstName: "Gamma" }),
          createStudent(404, { firstName: "Delta", preassignedTeacher: "Ms. Rivera" }),
          createStudent(303, { firstName: "Gamma Again" }),
        ],
      })

      assert.deepEqual(next.allStudents.map((student) => student.id).sort((a, b) => a - b), [101, 102, 303, 404])
      assert.equal(next.allStudents.find((student) => student.id === 101).firstName, "Duplicate Alpha")
      assert.deepEqual(next.classrooms[0].students.map((student) => student.id).sort((a, b) => a - b), [101, 404])
      assert.equal(next.classrooms[0].students.find((student) => student.id === 101).locked, true)
      assert.equal(next.classrooms[0].students.find((student) => student.id === 101).firstName, "Duplicate Alpha")
      assert.equal(next.classrooms.some((classroom) => classroom.students.some((student) => student.id === 303)), false)
      assert.equal(next.relationshipRules.length, 1)
    },
  },
  {
    name: "teacher-fixed students stay unresolved when no matching classroom can take them",
    run: () => {
      const student = createStudent(601, { firstName: "Iris", preassignedTeacher: "Ms. Rivera", locked: true })
      const state = {
        ...clone(initialState),
        allStudents: [student],
        classrooms: [
          createClassroom("1-A", [], { teacherName: "Ms. Stone" }),
          createClassroom("1-B", [], { teacherName: "Ms. Patel" }),
        ],
        activeGrade: "1",
      }

      const result = runPlacement(
        state.allStudents,
        [],
        state.classrooms,
        "1",
        state.weights,
        state.gradeSettings["1"],
        []
      )

      assert.equal(result.classrooms.some((classroom) => classroom.students.some((entry) => entry.id === 601)), false)
      assert.equal(result.unresolved.some((entry) => entry.id === 601), true)
      assert.match(result.unresolvedReasons[601][0], /does not have a matching classroom/i)
    },
  },
  {
    name: "manual move warnings include do-not-separate and teacher-fixed conflicts",
    run: () => {
      const teacherFixed = createStudent(701, { firstName: "Nova", preassignedTeacher: "Ms. Rivera", locked: true })
      const peer = createStudent(702, { firstName: "Piper" })
      const gradeRooms = [
        createClassroom("1-A", [teacherFixed, peer], { teacherName: "Ms. Rivera" }),
        createClassroom("1-B", [], { teacherName: "Ms. Stone" }),
      ]
      const warnings = getManualMoveWarnings(teacherFixed, gradeRooms[1], {
        settings: createDefaultGradeSettingsMap()["1"],
        relationshipRules: [
          {
            id: "rule-soft",
            type: "DO_NOT_SEPARATE",
            studentIds: [701, 702],
            createdAt: 1,
            grade: "1",
          },
        ],
        gradeRooms,
      })

      assert.ok(warnings.some((warning) => /Do Not Separate/i.test(warning)))
      assert.ok(warnings.some((warning) => /Assigned teacher is Ms\. Rivera/i.test(warning)))

      const unassignedWarnings = getManualUnassignedWarnings(teacherFixed, {
        settings: createDefaultGradeSettingsMap()["1"],
        relationshipRules: [
          {
            id: "rule-soft",
            type: "DO_NOT_SEPARATE",
            studentIds: [701, 702],
            createdAt: 1,
            grade: "1",
          },
        ],
        gradeRooms,
      })

      assert.ok(unassignedWarnings.some((warning) => /Do Not Separate/i.test(warning)))
      assert.ok(unassignedWarnings.some((warning) => /teacher-fixed placement/i.test(warning)))
    },
  },
  {
    name: "upserting a no-contact pair preserves imported links and adds a manager note",
    run: () => {
      const state = createState()
      state.relationshipRules = []

      const next = reducer(state, {
        type: "UPSERT_NO_CONTACT_PAIR",
        payload: {
          grade: "1",
          studentIds: [102, 101],
          note: "Family request",
        },
      })

      assert.deepEqual(next.allStudents.find((student) => student.id === 101).noContactWith, [102])
      assert.deepEqual(next.allStudents.find((student) => student.id === 102).noContactWith, [101])
      assert.deepEqual(next.classrooms[0].students[0].noContactWith, [102])
      assert.equal(next.relationshipRules.length, 1)
      assert.deepEqual(next.relationshipRules[0].studentIds, [101, 102])
      assert.equal(next.relationshipRules[0].note, "Family request")
    },
  },
  {
    name: "deleting a no-contact pair removes student links and mirrored manager rules",
    run: () => {
      const state = createState()
      const next = reducer(state, {
        type: "DELETE_NO_CONTACT_PAIR",
        payload: {
          grade: "1",
          studentIds: [102, 101],
        },
      })

      assert.deepEqual(next.allStudents.find((student) => student.id === 101).noContactWith, [])
      assert.deepEqual(next.allStudents.find((student) => student.id === 102).noContactWith, [])
      assert.deepEqual(next.classrooms[0].students[0].noContactWith, [])
      assert.equal(next.relationshipRules.length, 0)
    },
  },
  {
    name: "grade settings updates keep new formula fields and reset restores defaults",
    run: () => {
      const state = createState()
      const defaults = createDefaultGradeSettingsMap()["1"]

      const next = reducer(state, {
        type: "UPDATE_GRADE_SETTINGS",
        payload: {
          grade: "1",
          updates: {
            maxIEPPerRoom: 4,
            roomFillPenaltyWeight: 22,
            tagHotspotThreshold: 5.5,
            showClassroomHeaderIepCount: true,
          },
        },
      })

      assert.equal(next.gradeSettings["1"].maxIEPPerRoom, 4)
      assert.equal(next.gradeSettings["1"].roomFillPenaltyWeight, 22)
      assert.equal(next.gradeSettings["1"].tagHotspotThreshold, 5.5)
      assert.equal(next.gradeSettings["1"].showClassroomHeaderIepCount, true)
      assert.equal(next.gradeSettings["1"].preferredPeerBonus, defaults.preferredPeerBonus)
      assert.equal(next.gradeSettings["1"].showClassroomHeaderMapMathAverage, defaults.showClassroomHeaderMapMathAverage)

      const reset = reducer(next, { type: "RESET_GRADE_SETTINGS", payload: "1" })
      assert.deepEqual(reset.gradeSettings["1"], defaults)
    },
  },
  {
    name: "grade settings can be copied to every grade level at once",
    run: () => {
      const state = createState()
      const next = reducer(state, {
        type: "APPLY_GRADE_SETTINGS_TO_ALL",
        payload: {
          maxIEPPerRoom: 3,
          roomFillPenaltyWeight: 18,
          tagHotspotThreshold: 4.5,
          showClassroomHeaderMapReadingAverage: true,
        },
      })

      for (const grade of ["K", "1", "2", "3", "4", "5"]) {
        assert.equal(next.gradeSettings[grade].maxIEPPerRoom, 3)
        assert.equal(next.gradeSettings[grade].roomFillPenaltyWeight, 18)
        assert.equal(next.gradeSettings[grade].tagHotspotThreshold, 4.5)
        assert.equal(next.gradeSettings[grade].showClassroomHeaderMapReadingAverage, true)
        assert.equal(next.gradeSettings[grade].preferredPeerBonus, state.gradeSettings["1"].preferredPeerBonus)
      }
    },
  },
]

let passed = 0
for (const entry of tests) {
  entry.run()
  passed += 1
  console.log(`PASS ${entry.name}`)
}

console.log(`\n${passed}/${tests.length} tests passed.`)



