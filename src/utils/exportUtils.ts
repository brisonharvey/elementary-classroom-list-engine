import { Classroom, Grade, STUDENT_TAGS, Student } from "../types"
import { CO_TEACH_CATEGORIES, CO_TEACH_LABELS, getStudentCoTeachTotal } from "./coTeach"

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
  "studentCharacteristics",
  "teacherNotes",
  "assignedTeacher",
  "avoidTeachers",
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
    const teacherName = classroom.teacherName.trim()
    for (const student of classroom.students) {
      if (teacherName) {
        assignedTeacherByStudentId.set(student.id, teacherName)
      }
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
    student.academicTierNotes ?? student.intervention.academicTier,
    student.behaviorTierNotes ?? student.behaviorTier,
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
    assignedTeacherByStudentId.get(student.id) || student.preassignedTeacher || "",
    (student.avoidTeachers ?? []).join(";"),
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

function buildStudentPrintBadges(student: Student): string[] {
  const badges = [
    `${student.gender}`,
    student.specialEd.status !== "None" ? student.specialEd.status : "",
    `ACA ${student.intervention.academicTier}`,
    `SEB ${student.behaviorTier}`,
    student.grade === "K" && student.briganceReadiness !== undefined ? `BR:${student.briganceReadiness}` : "",
    student.grade !== "K" && student.mapReading !== undefined ? `MAP R:${student.mapReading}` : "",
    student.grade !== "K" && student.mapMath !== undefined ? `MAP M:${student.mapMath}` : "",
    student.grade !== "K" && student.ireadyReading ? `IR:${student.ireadyReading}` : "",
    student.grade !== "K" && student.ireadyMath ? `IM:${student.ireadyMath}` : "",
    getStudentCoTeachTotal(student) > 0 ? `CT:${getStudentCoTeachTotal(student)}` : "",
    (student.tags?.length ?? 0) > 0 ? `Chars:${student.tags!.length}` : "",
    student.preassignedTeacher?.trim() ? "Teacher Fixed" : "",
  ]

  for (const category of CO_TEACH_CATEGORIES) {
    const minutes = student.coTeachMinutes[category] ?? 0
    if (minutes > 0) {
      badges.push(`${CO_TEACH_LABELS[category]}:${minutes}`)
    }
  }

  return badges.filter(Boolean)
}

export function buildGradePlacementPrintHtml(
  classrooms: Classroom[],
  allStudents: Student[],
  grade: Grade,
  showTeacherNames: boolean
): string {
  const gradeClassrooms = classrooms
    .filter((classroom) => classroom.grade === grade)
    .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: "base" }))

  const rosterCount = allStudents.filter((student) => student.grade === grade).length
  const generatedAt = new Date().toLocaleString()
  const pages = gradeClassrooms
    .map((classroom) => {
      const students = [...classroom.students].sort(compareStudents)
      const teacherLine = showTeacherNames ? classroom.teacherName?.trim() || "Teacher name hidden" : "Teacher names hidden"
      return `
        <section class="pdf-page">
          <header class="page-header">
            <div>
              <div class="eyebrow">Elementary Classroom List Engine</div>
              <h1>Grade ${grade} • Class ${classroom.label}</h1>
              <div class="page-subtitle">${teacherLine}</div>
            </div>
            <div class="page-meta">
              <div><strong>${students.length}</strong> students</div>
              <div>Capacity ${classroom.maxSize}</div>
              <div>Generated ${generatedAt}</div>
            </div>
          </header>

          <div class="coverage-row">
            <span class="coverage-label">Co-Teach Coverage</span>
            <div class="coverage-chips">
              ${
                classroom.coTeachCoverage.length > 0
                  ? classroom.coTeachCoverage.map((category) => `<span class="coverage-chip">${CO_TEACH_LABELS[category]}</span>`).join("")
                  : `<span class="coverage-chip coverage-chip-empty">None listed</span>`
              }
            </div>
          </div>

          <div class="student-grid">
            ${students
              .map(
                (student) => `
                  <article class="student-card-print">
                    <div class="student-card-header">
                      <div>
                        <h2>${student.lastName}, ${student.firstName}</h2>
                        <div class="student-id-line">ID #${student.id}</div>
                      </div>
                    </div>
                    <div class="badge-row">
                      ${buildStudentPrintBadges(student)
                        .map((badge) => `<span class="print-badge">${badge}</span>`)
                        .join("")}
                    </div>
                    ${
                      student.tags && student.tags.length > 0
                        ? `<div class="characteristics"><strong>Characteristics:</strong> ${student.tags.join(", ")}</div>`
                        : ""
                    }
                    ${
                      student.teacherNotes
                        ? `<div class="teacher-notes"><strong>Teacher Notes:</strong> ${student.teacherNotes}</div>`
                        : ""
                    }
                  </article>
                `
              )
              .join("")}
          </div>
        </section>
      `
    })
    .join("")

  const badgeKey = [
    "F/M = student gender",
    "IEP / Referral = support status",
    "ACA = academic tier score",
    "SEB = social-emotional / behavior tier score",
    "BR = Brigance readiness",
    "MAP R / MAP M = MAP Reading / Math",
    "IR / IM = i-Ready Reading / Math",
    "CT = total co-teach minutes",
    "Chars = number of student characteristics",
    "Teacher Fixed = assigned teacher placement lock",
  ]

  const characteristicsKey = STUDENT_TAGS.map((tag) => `<li>${tag}</li>`).join("")

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Grade ${grade} Teacher Packet</title>
        <style>
          @page {
            size: letter portrait;
            margin: 0.45in;
          }

          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: "Aptos", "Segoe UI", sans-serif;
            color: #10233a;
            background: #edf4fb;
          }
          .pdf-page, .key-page {
            min-height: 10in;
            page-break-after: always;
            break-after: page;
            background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
            border: 1px solid #d6e3f0;
            border-radius: 22px;
            padding: 22px;
            box-shadow: 0 12px 32px rgba(16, 35, 58, 0.08);
          }
          .key-page { page-break-after: auto; break-after: auto; }
          .page-header {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            align-items: flex-start;
            padding-bottom: 14px;
            border-bottom: 2px solid #e0ecf7;
          }
          .eyebrow {
            text-transform: uppercase;
            letter-spacing: 0.12em;
            font-size: 10px;
            font-weight: 700;
            color: #56728f;
            margin-bottom: 6px;
          }
          h1 {
            margin: 0;
            font-family: "Georgia", "Times New Roman", serif;
            font-size: 28px;
            line-height: 1.1;
            color: #16324f;
          }
          .page-subtitle {
            margin-top: 6px;
            font-size: 14px;
            color: #4d6b86;
          }
          .page-meta {
            min-width: 160px;
            padding: 12px 14px;
            border-radius: 16px;
            background: #eff6fd;
            border: 1px solid #d5e5f4;
            font-size: 12px;
            line-height: 1.7;
            color: #294865;
          }
          .coverage-row {
            display: flex;
            gap: 10px;
            align-items: center;
            flex-wrap: wrap;
            margin: 14px 0 18px;
          }
          .coverage-label {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #5e7892;
          }
          .coverage-chips, .badge-row {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
          }
          .coverage-chip, .print-badge {
            display: inline-flex;
            align-items: center;
            padding: 5px 9px;
            border-radius: 999px;
            border: 1px solid #cbdceb;
            background: #ffffff;
            font-size: 11px;
            font-weight: 700;
            color: #25425d;
          }
          .coverage-chip-empty {
            color: #6f879d;
            background: #f4f8fc;
          }
          .student-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
            align-content: start;
          }
          .student-card-print {
            min-height: 110px;
            border-radius: 18px;
            border: 1px solid #d7e6f3;
            background: #ffffff;
            padding: 14px;
          }
          .student-card-header {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 10px;
          }
          h2 {
            margin: 0;
            font-size: 16px;
            line-height: 1.2;
            color: #173552;
          }
          .student-id-line {
            margin-top: 3px;
            font-size: 11px;
            color: #6b8399;
          }
          .characteristics, .teacher-notes {
            margin-top: 10px;
            font-size: 11px;
            line-height: 1.45;
            color: #35536e;
          }
          .key-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-top: 18px;
          }
          .key-card {
            border: 1px solid #d7e6f3;
            border-radius: 18px;
            background: #ffffff;
            padding: 16px;
          }
          .key-card h3 {
            margin: 0 0 10px;
            font-size: 14px;
            color: #173552;
          }
          .key-card ul {
            margin: 0;
            padding-left: 18px;
            color: #35536e;
            font-size: 12px;
            line-height: 1.6;
          }
          .key-page-intro {
            margin-top: 8px;
            color: #5b748d;
            font-size: 13px;
            line-height: 1.6;
          }
          .footer-line {
            margin-top: 14px;
            font-size: 11px;
            color: #6f879d;
          }
          @media print {
            body { background: #fff; }
            .pdf-page, .key-page {
              box-shadow: none;
            }
          }
        </style>
      </head>
      <body>
        ${pages}
        <section class="key-page">
          <div class="eyebrow">Teacher Packet Key</div>
          <h1>Grade ${grade} Reference Guide</h1>
          <p class="key-page-intro">
            This page explains the student-card abbreviations and the supported student characteristics shown in the packet.
            Teacher ratings and teacher-fit scoring details are intentionally omitted from the shared PDF.
          </p>
          <div class="key-grid">
            <article class="key-card">
              <h3>Badge Key</h3>
              <ul>
                ${badgeKey.map((item) => `<li>${item}</li>`).join("")}
              </ul>
            </article>
            <article class="key-card">
              <h3>Student Characteristics Key</h3>
              <ul>${characteristicsKey}</ul>
            </article>
          </div>
          <div class="footer-line">Grade ${grade} roster packet • ${rosterCount} students across ${gradeClassrooms.length} classroom${gradeClassrooms.length === 1 ? "" : "s"}</div>
        </section>
      </body>
    </html>
  `
}

export function openGradePlacementPdf(classrooms: Classroom[], allStudents: Student[], grade: Grade, showTeacherNames: boolean): void {
  const html = buildGradePlacementPrintHtml(classrooms, allStudents, grade, showTeacherNames)
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1200,height=900")
  if (!printWindow) {
    window.alert("Your browser blocked the print preview window. Please allow pop-ups for this app and try again.")
    return
  }

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  printWindow.onload = () => {
    printWindow.print()
  }
}
