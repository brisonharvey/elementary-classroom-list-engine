import { Classroom, Grade, Student } from "../types"

const EXPORT_HEADER = [
  "id",
  "grade",
  "firstName",
  "lastName",
  "gender",
  "status",
  "coTeachReadingMinutes",
  "coTeachWritingMinutes",
  "coTeachScienceSocialStudiesMinutes",
  "coTeachMathMinutes",
  "coTeachBehaviorMinutes",
  "coTeachSocialMinutes",
  "coTeachVocationalMinutes",
  "academicTier",
  "behaviorTier",
  "noContactWith",
  "preferredWith",
  "briganceReadiness",
  "mapReading",
  "mapMath",
  "ireadyReading",
  "ireadyMath",
  "referrals",
  "ell",
  "section504",
  "raceEthnicity",
  "studentTags",
  "teacherNotes",
  "assignedTeacher",
]

function csvEscape(value: string | number | boolean | undefined): string {
  if (value === undefined || value === null) return ""
  const raw = String(value)
  if (raw.includes(",") || raw.includes('"') || raw.includes("\n")) {
    return `"${raw.replace(/"/g, '""')}"`
  }
  return raw
}

function tsvEscape(value: string | number | boolean | undefined): string {
  if (value === undefined || value === null) return ""
  return String(value).replace(/\t/g, " ").replace(/\r?\n/g, " ")
}

function buildAssignedTeacherByStudentId(classrooms: Classroom[]): Map<number, string> {
  const assignedTeacherByStudentId = new Map<number, string>()
  for (const classroom of classrooms) {
    const teacherName = classroom.teacherName || classroom.id
    for (const student of classroom.students) {
      assignedTeacherByStudentId.set(student.id, teacherName)
    }
  }
  return assignedTeacherByStudentId
}

function compareStudents(a: Student, b: Student): number {
  const gradeCmp = a.grade.localeCompare(b.grade)
  if (gradeCmp !== 0) return gradeCmp
  const lastCmp = a.lastName.localeCompare(b.lastName, undefined, { sensitivity: "base" })
  if (lastCmp !== 0) return lastCmp
  const firstCmp = a.firstName.localeCompare(b.firstName, undefined, { sensitivity: "base" })
  if (firstCmp !== 0) return firstCmp
  return a.id - b.id
}

function buildStudentExportRow(student: Student, assignedTeacherByStudentId: Map<number, string>): Array<string | number | boolean | undefined> {
  return [
    student.id,
    student.grade,
    student.firstName,
    student.lastName,
    student.gender,
    student.specialEd.status,
    student.coTeachMinutes.reading ?? 0,
    student.coTeachMinutes.writing ?? 0,
    student.coTeachMinutes.scienceSocialStudies ?? 0,
    student.coTeachMinutes.math ?? 0,
    student.coTeachMinutes.behavior ?? 0,
    student.coTeachMinutes.social ?? 0,
    student.coTeachMinutes.vocational ?? 0,
    student.intervention.academicTier,
    student.behaviorTier,
    (student.noContactWith ?? []).join(";"),
    (student.preferredWith ?? []).join(";"),
    student.briganceReadiness,
    student.mapReading,
    student.mapMath,
    student.ireadyReading,
    student.ireadyMath,
    student.referrals ?? 0,
    student.ell ?? false,
    student.section504 ?? false,
    student.raceEthnicity,
    (student.tags ?? []).join(";"),
    student.teacherNotes,
    assignedTeacherByStudentId.get(student.id) || "",
  ]
}

export function buildPlacementCSV(classrooms: Classroom[], allStudents: Student[], grade?: Grade): string {
  const filteredStudents = grade ? allStudents.filter((student) => student.grade === grade) : allStudents
  const assignedTeacherByStudentId = buildAssignedTeacherByStudentId(classrooms)

  const rows = [...filteredStudents]
    .sort(compareStudents)
    .map((student) => buildStudentExportRow(student, assignedTeacherByStudentId).map(csvEscape).join(","))

  return [EXPORT_HEADER.join(","), ...rows].join("\n")
}

export function downloadFile(content: string, filename: string, mimeType = "text/csv;charset=utf-8;"): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function buildGoogleSheetsExport(classrooms: Classroom[], allStudents: Student[], grade?: Grade): string {
  const filteredStudents = grade ? allStudents.filter((student) => student.grade === grade) : allStudents
  const assignedTeacherByStudentId = buildAssignedTeacherByStudentId(classrooms)

  const rows = [...filteredStudents]
    .sort(compareStudents)
    .map((student) => buildStudentExportRow(student, assignedTeacherByStudentId).map(tsvEscape).join("\t"))

  return [EXPORT_HEADER.join("\t"), ...rows].join("\n")
}
