const assert = require("node:assert/strict")
const fs = require("node:fs")

const {
  getStudentTagSupportLoad,
  getStudentTagSupportLoadBreakdown,
  getClassroomTagSupportLoadBreakdown,
} = require("./.compiled/src/utils/tagSupportLoad.js")
const { getTagSupportLoadPenalty, getStudentSupportLoad, scoreStudentForRoom, computeRoomStats } = require("./.compiled/src/utils/scoring.js")
const { createDefaultGradeSettingsMap } = require("./.compiled/src/utils/classroomInit.js")
const { buildPlacementCSV, buildGradePlacementPrintHtml } = require("./.compiled/src/utils/exportUtils.js")
const {
  parseStudentCSVWithMapping,
  generateStudentTemplateCSV,
  suggestStudentFieldMapping,
} = require("./.compiled/src/utils/csvParser.js")
const {
  parseTeacherCSVWithMapping,
  suggestTeacherFieldMapping,
} = require("./.compiled/src/utils/teacherCsvParser.js")
const { buildBlendedStudentCsv } = require("./.compiled/src/lib/csv/blend.js")
const { readSpreadsheetFile } = require("./.compiled/src/lib/csv/spreadsheet.js")

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
    academicTierNotes: undefined,
    behaviorTierNotes: undefined,
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
    name: "student header suggestions handle BOMs punctuation and SIS-style labels",
    run: () => {
      const headers = [
        "\uFEFFStudent ID",
        "Grade Level",
        "Student First Name",
        "Student Last Name",
        "Race / Ethnicity",
        "Co-Teach Science / Social Studies Minutes",
        "Teacher Notes (Placement)",
      ]

      const mapping = suggestStudentFieldMapping(headers)

      assert.equal(mapping.id, "\uFEFFStudent ID")
      assert.equal(mapping.grade, "Grade Level")
      assert.equal(mapping.firstName, "Student First Name")
      assert.equal(mapping.lastName, "Student Last Name")
      assert.equal(mapping.raceEthnicity, "Race / Ethnicity")
      assert.equal(mapping.coTeachScienceSocialStudiesMinutes, "Co-Teach Science / Social Studies Minutes")
      assert.equal(mapping.teacherNotes, "Teacher Notes (Placement)")
    },
  },
  {
    name: "teacher header suggestions match descriptive exported labels",
    run: () => {
      const headers = [
        "Grade Level",
        "Homeroom Teacher",
        "Classroom Structure",
        "Regulation / Behavior Support",
        "Social / Emotional Support",
        "Instructional Expertise",
      ]

      const mapping = suggestTeacherFieldMapping(headers)

      assert.equal(mapping.grade, "Grade Level")
      assert.equal(mapping.teacherName, "Homeroom Teacher")
      assert.equal(mapping.structure, "Classroom Structure")
      assert.equal(mapping.regulationBehaviorSupport, "Regulation / Behavior Support")
      assert.equal(mapping.socialEmotionalSupport, "Social / Emotional Support")
      assert.equal(mapping.instructionalExpertise, "Instructional Expertise")
    },
  },
  {
    name: "teacher CSV parsing works with spaced and slashed headers",
    run: () => {
      const headers = [
        "Grade Level",
        "Homeroom Teacher",
        "Classroom Structure",
        "Regulation / Behavior Support",
        "Social / Emotional Support",
        "Instructional Expertise",
      ]
      const csv = [
        headers.join(","),
        "1,Ms. Maple,5,4,3,5",
      ].join("\n")

      const result = parseTeacherCSVWithMapping(csv, suggestTeacherFieldMapping(headers))

      assert.equal(result.errors.length, 0)
      assert.equal(result.skipped, 0)
      assert.equal(result.teachers.length, 1)
      assert.equal(result.teachers[0].teacherName, "Ms. Maple")
      assert.equal(result.teachers[0].characteristics.regulationBehaviorSupport, 4)
    },
  },
  {
    name: "teacher CSV parsing skips unrecognized grades instead of coercing them to kindergarten",
    run: () => {
      const csv = [
        "grade,teacherName,structure,regulationBehaviorSupport,socialEmotionalSupport,instructionalExpertise",
        "6,Ms. Maple,5,4,3,5",
      ].join("\n")

      const result = parseTeacherCSVWithMapping(csv, {
        grade: "grade",
        teacherName: "teacherName",
        structure: "structure",
        regulationBehaviorSupport: "regulationBehaviorSupport",
        socialEmotionalSupport: "socialEmotionalSupport",
        instructionalExpertise: "instructionalExpertise",
      })

      assert.equal(result.teachers.length, 0)
      assert.equal(result.skipped, 1)
      assert.match(result.errors[0], /unrecognized grade/i)
    },
  },
  {
    name: "student characteristic load is derived from characteristic weights and categories",
    run: () => {
      const student = createStudent({
        tags: ["Needs strong routine", "Needs frequent redirection", "Independent worker"],
      })

      const total = getStudentTagSupportLoad(student)
      const breakdown = getStudentTagSupportLoadBreakdown(student)

      assert.equal(total, 5)
      assert.equal(breakdown.total, 5)
      assert.equal(breakdown.behavioral, 6)
      assert.equal(breakdown.emotional, 0)
      assert.equal(breakdown.instructional, -1)
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
    name: "classroom characteristic load breakdown sums student totals and category subtotals",
    run: () => {
      const classroom = createClassroom("1-A", [
        createStudent({ id: 1, tags: ["Needs strong routine", "Needs frequent redirection", "Independent worker"] }),
        createStudent({ id: 2, tags: ["Easily frustrated", "Needs movement breaks"] }),
      ])

      const breakdown = getClassroomTagSupportLoadBreakdown(classroom)

      assert.equal(breakdown.total, 10)
      assert.equal(breakdown.behavioral, 6)
      assert.equal(breakdown.emotional, 3)
      assert.equal(breakdown.instructional, -1)
      assert.equal(breakdown.energy, 2)
    },
  },
  {
    name: "projected characteristic load penalty is higher for an already overloaded room",
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
    name: "student characteristic CSV parsing accepts current headers and retired peer labels",
    run: () => {
      const csv = [
        "id,grade,firstName,lastName,studentCharacteristics",
        '101,1,Ada,Stone,"Needs strong routine;Needs reassurance"',
        '102,1,Ben,Reed,"Needs positive peer models|Easily influenced by peers"',
      ].join("\n")

      const result = parseStudentCSVWithMapping(csv, {
        id: "id",
        grade: "grade",
        firstName: "firstName",
        lastName: "lastName",
        studentTags: "studentCharacteristics",
      })

      assert.equal(result.skipped, 0)
      assert.equal(result.errors.length, 0)
      assert.deepEqual(result.students[0].tags, ["Needs strong routine", "Needs reassurance"])
      assert.deepEqual(result.students[1].tags, ["Struggles with peer conflict"])
    },
  },
  {
    name: "student import treats EL and RFEP labels as ell true",
    run: () => {
      const csv = [
        "id,grade,firstName,lastName,ell",
        "101,1,Ada,Stone,EL",
        "102,1,Ben,Reed,RFEP 1-4",
        "103,1,Cam,Jones,false",
      ].join("\n")

      const result = parseStudentCSVWithMapping(csv, {
        id: "id",
        grade: "grade",
        firstName: "firstName",
        lastName: "lastName",
        ell: "ell",
      })

      assert.equal(result.errors.length, 0)
      assert.equal(result.students[0].ell, true)
      assert.equal(result.students[1].ell, true)
      assert.equal(result.students[2].ell, false)
    },
  },
  {
    name: "student CSV parsing reads blocked teacher classrooms",
    run: () => {
      const csv = [
        "id,grade,firstName,lastName,avoidTeachers",
        '101,1,Ada,Stone,"Ms. Rivera; ms. rivera; Ms. Stone"',
      ].join("\n")

      const result = parseStudentCSVWithMapping(csv, {
        id: "id",
        grade: "grade",
        firstName: "firstName",
        lastName: "lastName",
        avoidTeachers: "avoidTeachers",
      })

      assert.equal(result.errors.length, 0)
      assert.deepEqual(result.students[0].avoidTeachers, ["Ms. Rivera", "Ms. Stone"])
    },
  },
  {
    name: "student CSV parsing skips unrecognized grades instead of coercing them to kindergarten",
    run: () => {
      const csv = [
        "id,grade,firstName,lastName",
        "101,6,Ada,Stone",
      ].join("\n")

      const result = parseStudentCSVWithMapping(csv, {
        id: "id",
        grade: "grade",
        firstName: "firstName",
        lastName: "lastName",
      })

      assert.equal(result.students.length, 0)
      assert.equal(result.skipped, 1)
      assert.match(result.errors[0], /unrecognized grade/i)
    },
  },
  {
    name: "student import sums tier notes for support load and preserves the original text",
    run: () => {
      const csv = [
        "id,grade,firstName,lastName,academicTier,behaviorTier",
        '101,1,Ada,Stone,"Reading - Tier 2; Math - Tier 3","Check-In - Tier 2"',
      ].join("\n")

      const result = parseStudentCSVWithMapping(csv, {
        id: "id",
        grade: "grade",
        firstName: "firstName",
        lastName: "lastName",
        academicTier: "academicTier",
        behaviorTier: "behaviorTier",
      })

      assert.equal(result.errors.length, 0)
      assert.equal(result.students[0].intervention.academicTier, 5)
      assert.equal(result.students[0].behaviorTier, 2)
      assert.equal(result.students[0].academicTierNotes, "Reading - Tier 2; Math - Tier 3")
      assert.equal(result.students[0].behaviorTierNotes, "Check-In - Tier 2")
      assert.equal(getStudentSupportLoad(result.students[0]), 7)
    },
  },
  {
    name: "student import accepts space-separated relationship ids",
    run: () => {
      const csv = [
        "id,grade,firstName,lastName,noContactWith,preferredWith",
        '101,1,Ada,Stone,"102  103","102 103"',
        "102,1,Ben,Reed,,",
        "103,1,Cam,Jones,,",
      ].join("\n")

      const result = parseStudentCSVWithMapping(csv, {
        id: "id",
        grade: "grade",
        firstName: "firstName",
        lastName: "lastName",
        noContactWith: "noContactWith",
        preferredWith: "preferredWith",
      })

      assert.equal(result.errors.length, 0)
      assert.deepEqual(result.students[0].noContactWith, [102, 103])
      assert.deepEqual(result.students[0].preferredWith, [102, 103])
    },
  },
  {
    name: "csv spreadsheet reader preserves multiline quoted cells",
    run: async () => {
      const sheets = await readSpreadsheetFile({
        name: "students.csv",
        text: async () => [
          "id,grade,firstName,lastName,teacherNotes",
          '101,1,Ada,Stone,"Line one',
          'Line two"',
        ].join("\n"),
      })

      assert.equal(sheets.length, 1)
      assert.equal(sheets[0].rows.length, 2)
      assert.equal(sheets[0].rows[1][4], "Line one\nLine two")
    },
  },
  {
    name: "blend builder reports missing master identity mappings as errors",
    run: () => {
      const result = buildBlendedStudentCsv(
        {
          id: "master-1",
          name: "master.csv",
          table: {
            headers: ["id", "grade", "firstName", "lastName", "personId"],
            rows: [["101", "1", "Ada", "Stone", "P-101"]],
          },
          matchColumn: "",
          fieldMapping: {
            id: "id",
            grade: "grade",
            firstName: "firstName",
            lastName: "lastName",
          },
          masterIdColumns: {
            personId: "personId",
            stateId: undefined,
            studentNumber: undefined,
          },
        },
        []
      )

      assert.ok(result.issues.some((issue) => issue.severity === "error" && issue.message.includes("stateId")))
      assert.ok(result.issues.some((issue) => issue.severity === "error" && issue.message.includes("studentNumber")))
    },
  },
  {
    name: "blend builder does not require gender in the master roster",
    run: () => {
      const result = buildBlendedStudentCsv(
        {
          id: "master-2",
          name: "master.csv",
          table: {
            headers: ["id", "grade", "firstName", "lastName", "personId", "stateId", "studentNumber"],
            rows: [["101", "1", "Ada", "Stone", "P-101", "S-101", "N-101"]],
          },
          matchColumn: "",
          fieldMapping: {
            id: "id",
            grade: "grade",
            firstName: "firstName",
            lastName: "lastName",
          },
          masterIdColumns: {
            personId: "personId",
            stateId: "stateId",
            studentNumber: "studentNumber",
          },
        },
        []
      )

      assert.equal(result.issues.some((issue) => /gender/i.test(issue.message)), false)
    },
  },
  {
    name: "blend builder does not require grade in the master roster",
    run: () => {
      const result = buildBlendedStudentCsv(
        {
          id: "master-3",
          name: "master.csv",
          table: {
            headers: ["id", "firstName", "lastName", "personId", "stateId", "studentNumber"],
            rows: [["101", "Ada", "Stone", "P-101", "S-101", "N-101"]],
          },
          matchColumn: "",
          fieldMapping: {
            id: "id",
            firstName: "firstName",
            lastName: "lastName",
          },
          masterIdColumns: {
            personId: "personId",
            stateId: "stateId",
            studentNumber: "studentNumber",
          },
        },
        []
      )

      assert.equal(result.issues.some((issue) => /grade/i.test(issue.message)), false)
    },
  },
  {
    name: "blend builder only exports master students that matched a supplemental file",
    run: () => {
      const result = buildBlendedStudentCsv(
        {
          id: "master-4",
          name: "master.csv",
          table: {
            headers: ["id", "firstName", "lastName", "personId", "stateId", "studentNumber"],
            rows: [
              ["101", "Ada", "Stone", "P-101", "S-101", "N-101"],
              ["102", "Ben", "Reed", "P-102", "S-102", "N-102"],
            ],
          },
          matchColumn: "",
          fieldMapping: {
            id: "id",
            firstName: "firstName",
            lastName: "lastName",
          },
          masterIdColumns: {
            personId: "personId",
            stateId: "stateId",
            studentNumber: "studentNumber",
          },
        },
        [
          {
            id: "supp-1",
            name: "supplement.csv",
            table: {
              headers: ["studentNumber", "grade"],
              rows: [["N-101", "1"]],
            },
            matchColumn: "studentNumber",
            matchType: "studentNumber",
            fieldMapping: {
              grade: "grade",
            },
          },
        ]
      )

      const lines = result.csvText.trim().split("\n")
      assert.equal(lines.length, 2)
      assert.match(lines[1], /^101,1,Ada,Stone,/)
      assert.equal(result.issues.some((issue) => issue.severity === "warning" && /did not match any supplemental file and was skipped/i.test(issue.message)), true)
      assert.equal(result.issues.some((issue) => issue.severity === "error"), false)
    },
  },
  {
    name: "student export keeps tier note text when present",
    run: () => {
      const student = createStudent({
        intervention: { academicTier: 5 },
        behaviorTier: 2,
        academicTierNotes: "Reading - Tier 2; Math - Tier 3",
        behaviorTierNotes: "Check-In - Tier 2",
      })

      const csv = buildPlacementCSV([createClassroom("1-A", [student])], [student], "1")
      const row = csv.split("\n")[1].split(",")
      assert.equal(row[13], "Reading - Tier 2; Math - Tier 3")
      assert.equal(row[14], "Check-In - Tier 2")
    },
  },
  {
    name: "student export includes blocked teacher classrooms",
    run: () => {
      const student = createStudent({
        avoidTeachers: ["Ms. Rivera", "Ms. Stone"],
      })

      const csv = buildPlacementCSV([createClassroom("1-A", [student])], [student], "1")
      const row = csv.split("\n")[1].split(",")
      assert.equal(row[row.length - 1], "Ms. Rivera;Ms. Stone")
    },
  },
  {
    name: "grade print export includes a card key and omits teacher-rating language",
    run: () => {
      const student = createStudent({
        firstName: "Ada",
        lastName: "Stone",
        tags: ["Needs strong routine", "Needs reassurance"],
        preassignedTeacher: "Ms. Rivera",
      })
      const html = buildGradePlacementPrintHtml(
        [createClassroom("1-A", [student])],
        [student],
        "1",
        true
      )

      assert.match(html, /Teacher Packet Key/)
      assert.match(html, /Student Characteristics Key/)
      assert.match(html, /Teacher Fixed/)
      assert.equal(/Poor Fit/.test(html), false)
      assert.equal(/Instructional Expertise/i.test(html), false)
    },
  },
  {
    name: "public templates use the current student and teacher headers",
    run: () => {
      const studentTemplate = fs.readFileSync("public/student-import-template.csv", "utf8").trim()
      const teacherTemplate = fs.readFileSync("public/teacher-import-template.csv", "utf8").trim()

      assert.equal(studentTemplate, generateStudentTemplateCSV())
      assert.equal(teacherTemplate, "grade,teacherName,structure,regulationBehaviorSupport,socialEmotionalSupport,instructionalExpertise")
    },
  },
  {
    name: "public sample students include assigned teachers that match the teacher sample naming scheme",
    run: () => {
      const sampleText = fs.readFileSync("public/sample-students.csv", "utf8").trim().split(/\r?\n/)
      const headers = sampleText[0].split(",")
      const assignedTeacherIndex = headers.indexOf("assignedTeacher")
      assert.ok(assignedTeacherIndex >= 0)

      const assignedTeachers = sampleText
        .slice(1)
        .map((line) => line.split(",")[assignedTeacherIndex])
        .filter(Boolean)

      assert.ok(assignedTeachers.length > 0)
      assert.ok(assignedTeachers.every((name) => /^Ms\. Grade(?:K|[1-5])[A-D]$/.test(name)))
    },
  },
  {
    name: "public sample assigned teachers all exist in the public teacher sample",
    run: () => {
      const studentLines = fs.readFileSync("public/sample-students.csv", "utf8").trim().split(/\r?\n/)
      const teacherLines = fs.readFileSync("public/sample-teachers.csv", "utf8").trim().split(/\r?\n/)
      const studentHeaders = studentLines[0].split(",")
      const teacherHeaders = teacherLines[0].split(",")
      const assignedTeacherIndex = studentHeaders.indexOf("assignedTeacher")
      const teacherNameIndex = teacherHeaders.indexOf("teacherName")
      assert.ok(assignedTeacherIndex >= 0)
      assert.ok(teacherNameIndex >= 0)

      const assignedTeachers = new Set(studentLines.slice(1).map((line) => line.split(",")[assignedTeacherIndex]).filter(Boolean))
      const teacherNames = new Set(teacherLines.slice(1).map((line) => line.split(",")[teacherNameIndex]).filter(Boolean))

      for (const teacherName of assignedTeachers) {
        assert.equal(teacherNames.has(teacherName), true)
      }
    },
  },
  {
    name: "room fill penalty grows when a placement would widen the class-size gap",
    run: () => {
      const candidate = createStudent({ id: 50 })
      const fullerRoom = createClassroom("1-A", [
        createStudent({ id: 1 }),
        createStudent({ id: 2 }),
        createStudent({ id: 3 }),
        createStudent({ id: 4 }),
        createStudent({ id: 5 }),
      ])
      const smallerRoom = createClassroom("1-B", [
        createStudent({ id: 6 }),
      ])
      const gradeRooms = [fullerRoom, smallerRoom]
      const weights = { academic: 0, behavioral: 0, demographic: 100, tagSupportLoad: 0 }
      const settings = createDefaultGradeSettingsMap()["1"]

      const fullerScore = scoreStudentForRoom(candidate, fullerRoom, computeRoomStats(fullerRoom), weights, {
        gradeSettings: settings,
        gradeRooms,
      })
      const smallerScore = scoreStudentForRoom(candidate, smallerRoom, computeRoomStats(smallerRoom), weights, {
        gradeSettings: settings,
        gradeRooms,
      })

      assert.ok(smallerScore < fullerScore)
    },
  },
  {
    name: "class-size balancing turns off when the class size and demographics slider is zero",
    run: () => {
      const candidate = createStudent({ id: 51 })
      const fullerRoom = createClassroom("1-A", [
        createStudent({ id: 1 }),
        createStudent({ id: 2 }),
        createStudent({ id: 3 }),
      ])
      const smallerRoom = createClassroom("1-B", [
        createStudent({ id: 4 }),
      ])
      const gradeRooms = [fullerRoom, smallerRoom]
      const weights = { academic: 0, behavioral: 0, demographic: 0, tagSupportLoad: 0 }
      const settings = createDefaultGradeSettingsMap()["1"]

      const fullerScore = scoreStudentForRoom(candidate, fullerRoom, computeRoomStats(fullerRoom), weights, {
        gradeSettings: settings,
        gradeRooms,
      })
      const smallerScore = scoreStudentForRoom(candidate, smallerRoom, computeRoomStats(smallerRoom), weights, {
        gradeSettings: settings,
        gradeRooms,
      })

      assert.equal(fullerScore, smallerScore)
    },
  },
  {
    name: "characteristic formula settings can reduce hotspot scoring pressure",
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

async function main() {
  let passed = 0
  for (const entry of tests) {
    await entry.run()
    passed += 1
    console.log(`PASS ${entry.name}`)
  }

  console.log(`\n${passed}/${tests.length} tests passed.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})



