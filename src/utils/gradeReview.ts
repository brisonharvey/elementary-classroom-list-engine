import { Classroom, Grade, GradeSettings } from "../types"
import { getRoomMathAvg, getRoomReadingAvg, getRoomSupportLoad } from "./scoring"
import { getGradeTagSupportLoadSummary, TAG_SUPPORT_LOAD_CATEGORY_LABELS, TagSupportLoadCategory } from "./tagSupportLoad"

function getRange(values: number[]): number {
  return values.length < 2 ? 0 : Math.max(...values) - Math.min(...values)
}

export interface GradeReviewWarning {
  key: string
  label: string
}

export function getGenderWarningLabels(
  classrooms: Classroom[],
  settings: GradeSettings,
  showTeacherNames: boolean
): string[] {
  return classrooms
    .filter((classroom) => {
      const maleCount = classroom.students.filter((student) => student.gender === "M").length
      const femaleCount = classroom.students.filter((student) => student.gender === "F").length
      return Math.abs(maleCount - femaleCount) > settings.genderBalanceTolerance
    })
    .map((classroom) => {
      const fallback = `${classroom.grade}-${classroom.label}`
      return showTeacherNames ? classroom.teacherName?.trim() || fallback : fallback
    })
}

export function getGradeReviewWarnings(
  classrooms: Classroom[],
  grade: Grade,
  settings: GradeSettings,
  showTeacherNames: boolean
): GradeReviewWarning[] {
  const occupiedClassrooms = classrooms.filter((classroom) => classroom.students.length > 0)
  const readingImbalance = getRange(occupiedClassrooms.map((classroom) => getRoomReadingAvg(classroom))) > 0.75
  const mathImbalance = getRange(occupiedClassrooms.map((classroom) => getRoomMathAvg(classroom))) > 0.75
  const supportImbalance = getRange(occupiedClassrooms.map((classroom) => getRoomSupportLoad(classroom))) > 4
  const tagSummary = getGradeTagSupportLoadSummary(classrooms, grade)
  const tagCategories = Object.keys(tagSummary.rangeByCategory) as TagSupportLoadCategory[]
  const worstTagCategory =
    tagCategories.sort((left, right) => tagSummary.rangeByCategory[right] - tagSummary.rangeByCategory[left])[0] ??
    "behavioral"
  const genderWarningLabels = getGenderWarningLabels(classrooms, settings, showTeacherNames)

  const warnings: GradeReviewWarning[] = []
  if (genderWarningLabels.length > 0) {
    warnings.push({
      key: "gender",
      label: `Gender imbalance beyond +/-${settings.genderBalanceTolerance}: ${genderWarningLabels.join(", ")}`,
    })
  }

  if (grade === "K") {
    if (readingImbalance) {
      warnings.push({ key: "reading", label: "Brigance spread across classrooms" })
    }
  } else {
    if (readingImbalance) {
      warnings.push({ key: "reading", label: "Reading level spread across classrooms" })
    }
    if (mathImbalance) {
      warnings.push({ key: "math", label: "Math level spread across classrooms" })
    }
  }

  if (supportImbalance) {
    warnings.push({ key: "support", label: "Support load imbalanced across classrooms" })
  }
  if (tagSummary.rangeTotal >= 6) {
    warnings.push({
      key: "tag-total",
      label: `Characteristic support load range is ${tagSummary.rangeTotal.toFixed(1)} across classrooms`,
    })
  }
  if (tagSummary.rangeByCategory[worstTagCategory] >= 4) {
    warnings.push({
      key: "tag-category",
      label: `${TAG_SUPPORT_LOAD_CATEGORY_LABELS[worstTagCategory]} characteristic load is concentrated in one room group (${tagSummary.rangeByCategory[worstTagCategory].toFixed(1)} spread)`,
    })
  }

  return warnings
}
