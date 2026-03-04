import { Classroom, Grade } from "../types"
import { getStudentCoTeachTotal } from "./coTeach"

/** Build CSV string of final placements */
export function buildPlacementCSV(classrooms: Classroom[], grade?: Grade): string {
  const header = "Teacher,ClassroomID,StudentID,FirstName,LastName,Grade,Gender,IEP,TotalCoTeachMinutes,AcademicTier,BehaviorTier"
  const filtered = grade ? classrooms.filter((c) => c.grade === grade) : classrooms

  const rows = filtered.flatMap((c) =>
    c.students.map((s) => {
      const teacher = c.teacherName ? `"${c.teacherName}"` : c.id
      const iep = s.specialEd.status
      const totalCoTeach = getStudentCoTeachTotal(s)
      return [
        teacher,
        c.id,
        s.id,
        `"${s.firstName}"`,
        `"${s.lastName}"`,
        s.grade,
        s.gender,
        iep,
        totalCoTeach,
        s.intervention.academicTier,
        s.behaviorTier,
      ].join(",")
    })
  )

  return [header, ...rows].join("\n")
}

/** Trigger a browser download of a text file */
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

/** Build a Google Sheets–compatible tab-separated export */
export function buildGoogleSheetsExport(classrooms: Classroom[], grade?: Grade): string {
  const header = "Teacher\tClassroomID\tStudentID\tFirstName\tLastName\tGrade\tGender\tIEP\tAcademicTier\tBehaviorTier"
  const filtered = grade ? classrooms.filter((c) => c.grade === grade) : classrooms

  const rows = filtered.flatMap((c) =>
    c.students.map((s) => {
      const teacher = c.teacherName || c.id
      return [
        teacher,
        c.id,
        s.id,
        s.firstName,
        s.lastName,
        s.grade,
        s.gender,
        s.specialEd.status,
        s.intervention.academicTier,
        s.behaviorTier,
      ].join("\t")
    })
  )

  return [header, ...rows].join("\n")
}
