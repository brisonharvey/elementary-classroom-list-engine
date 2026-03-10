const assert = require("node:assert/strict")

const {
  getStudentTagSupportLoad,
  getStudentTagSupportLoadBreakdown,
  getClassroomTagSupportLoadBreakdown,
} = require("./.compiled/src/utils/tagSupportLoad.js")
const { getTagSupportLoadPenalty } = require("./.compiled/src/utils/scoring.js")
const { createDefaultGradeSettingsMap } = require("./.compiled/src/utils/classroomInit.js")
const { parseStudentCSVWithMapping } = require("./.compiled/src/utils/csvParser.js")

function createStudent(overrides = {}) {
  return {
    id: 1,
    grade: "1",
    firstName: "Test",
    lastName: "Student",
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

function createClassroom(id, students) {
  return {
    id,
    grade: "1",
    label: id,
    teacherName: `Teacher ${id}`,
    maxSize: 25,
    coTeachCoverage: [],
    students,
  }
}

const tests = [
  {
    name: "student tag support load is derived from tag weights and categories",
    run: () => {
      const student = createStudent({
        tags: ["Needs strong routine", "Needs frequent redirection", "Independent worker"],
      })

      const total = getStudentTagSupportLoad(student)
      const breakdown = getStudentTagSupportLoadBreakdown(student)

      assert.equal(total, 5)
      assert.equal(breakdown.total, 5)
      assert.equal(breakdown.behavioral, 4)
      assert.equal(breakdown.emotional, 0)
      assert.equal(breakdown.instructional, 1)
      assert.equal(breakdown.energy, 0)
      assert.deepEqual(
        breakdown.contributions.map((entry) => [entry.tag, entry.weight]),
        [
          ["Needs strong routine", 2],
          ["Needs frequent redirection", 4],
          ["Independent worker", -1],
        ]
      )
    },
  },
  {
    name: "classroom tag support load breakdown sums student totals and category subtotals",
    run: () => {
      const classroom = createClassroom("1-A", [
        createStudent({ id: 1, tags: ["Needs strong routine", "Needs frequent redirection", "Independent worker"] }),
        createStudent({ id: 2, tags: ["Easily frustrated", "Needs movement breaks"] }),
      ])

      const breakdown = getClassroomTagSupportLoadBreakdown(classroom)

      assert.equal(breakdown.total, 10)
      assert.equal(breakdown.behavioral, 4)
      assert.equal(breakdown.emotional, 3)
      assert.equal(breakdown.instructional, 1)
      assert.equal(breakdown.energy, 2)
    },
  },
  {
    name: "projected tag support load penalty is higher for an already overloaded room",
    run: () => {
      const candidate = createStudent({
        id: 10,
        tags: ["Needs frequent redirection", "High energy"],
      })
      const roomA = createClassroom("1-A", [
        createStudent({ id: 1, tags: ["Needs frequent redirection", "Easily frustrated", "Needs movement breaks"] }),
      ])
      const roomB = createClassroom("1-B", [
        createStudent({ id: 2, tags: ["Independent worker"] }),
      ])
      const gradeRooms = [roomA, roomB]

      const overloadedPenalty = getTagSupportLoadPenalty(candidate, roomA, gradeRooms)
      const lighterPenalty = getTagSupportLoadPenalty(candidate, roomB, gradeRooms)

      assert.ok(overloadedPenalty > lighterPenalty)
      assert.ok(overloadedPenalty > 0)
    },
  },
  {
    name: "studentTags CSV parsing stays backward compatible with existing separators and exact labels",
    run: () => {
      const csv = [
        "id,grade,firstName,lastName,studentTags",
        '101,1,Ada,Stone,"Needs strong routine;Needs reassurance"',
        '102,1,Ben,Reed,"Needs movement breaks|Independent worker"',
      ].join("\n")

      const result = parseStudentCSVWithMapping(csv, {
        id: "id",
        grade: "grade",
        firstName: "firstName",
        lastName: "lastName",
        studentTags: "studentTags",
      })

      assert.equal(result.skipped, 0)
      assert.equal(result.errors.length, 0)
      assert.deepEqual(result.students[0].tags, ["Needs strong routine", "Needs reassurance"])
      assert.deepEqual(result.students[1].tags, ["Needs movement breaks", "Independent worker"])
    },
  },
  {
    name: "tag formula settings can reduce hotspot scoring pressure",
    run: () => {
      const candidate = createStudent({
        id: 20,
        tags: ["Needs frequent redirection", "High energy"],
      })
      const roomA = createClassroom("1-A", [
        createStudent({ id: 1, tags: ["Needs frequent redirection", "Needs movement breaks"] }),
      ])
      const roomB = createClassroom("1-B", [
        createStudent({ id: 2, tags: ["Independent worker"] }),
      ])
      const defaults = createDefaultGradeSettingsMap()["1"]

      const baselinePenalty = getTagSupportLoadPenalty(candidate, roomA, [roomA, roomB], defaults)
      const softenedPenalty = getTagSupportLoadPenalty(candidate, roomA, [roomA, roomB], {
        ...defaults,
        tagTotalBalancePenaltyWeight: 0,
        tagBehavioralPenaltyWeight: 0,
        tagEnergyPenaltyWeight: 0,
        tagInstructionalPenaltyWeight: 0,
        tagHotspotPenaltyWeight: 0,
      })

      assert.ok(baselinePenalty > 0)
      assert.equal(softenedPenalty, 0)
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

