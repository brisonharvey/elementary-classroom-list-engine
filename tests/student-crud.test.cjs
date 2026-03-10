const assert = require("node:assert/strict")

const { reducer, initialState } = require("./.compiled/src/store/reducer.js")
const { createDefaultGradeSettingsMap } = require("./.compiled/src/utils/classroomInit.js")
const { buildPlacementCSV } = require("./.compiled/src/utils/exportUtils.js")

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
        locked: false,
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
          },
        },
      })

      assert.equal(next.gradeSettings["1"].maxIEPPerRoom, 4)
      assert.equal(next.gradeSettings["1"].roomFillPenaltyWeight, 22)
      assert.equal(next.gradeSettings["1"].tagHotspotThreshold, 5.5)
      assert.equal(next.gradeSettings["1"].preferredPeerBonus, defaults.preferredPeerBonus)

      const reset = reducer(next, { type: "RESET_GRADE_SETTINGS", payload: "1" })
      assert.deepEqual(reset.gradeSettings["1"], defaults)
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

