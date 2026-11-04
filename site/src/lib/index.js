/* eslint-disable import/extensions */
/*
 * The course data API every page imports (brief: "Data API contract"). Documented in ./README.md.
 * Pure ES modules: nothing touches the DOM or storage at import, and every time-dependent function takes `now`.
 * The implementation lives in the .mjs modules next to this file (Node runs the tests against them directly).
 */
export { COURSES, COURSE_IDS, PALETTES, DEFAULT_PALETTE, getCourse, sections, getSection, setSection, groups, getGroup, setGroup, getProfile } from './courses.mjs';
export { TOKENS, STATUS, BADGE, DISC, countdownStatus, rgbOf } from './palette.mjs';
export { deadlines, deadlineItem, buckets, nextDeadline, countdown, weeklyChecklist, assessments, deskSnapshot, workList } from './deadlines.mjs';
export { assignmentList, calendarEvents } from './assignments.mjs';
export { courseInfo, courseCopy } from './info.mjs';
export {
  GRADE_KEYS,
  GRADE_SCALE,
  PASS_MARK,
  gradePlan,
  gradeStanding,
  gradeNeeded,
  letterFor,
  roundGrade,
  parseMark,
  splitMark,
  joinMark,
  percentsFrom,
  readGrades,
  writeGrades,
  gradesSavable,
  subscribeGrades,
  floorTenth,
  ceilTenth,
  formatPercent,
} from './grades.mjs';
export { createProgress, sharedProgress } from './progress.mjs';
export { searchIndex, searchEntries, searchGuide, SEARCH_COPY, SEARCH_GROUPS } from './search.mjs';
export { calendarFile, exportBackup, importBackup, hasUnseenUpdates, markUpdatesSeen, getHideCompleted, setHideCompleted, motionPaused, setMotionPaused } from './tools.mjs';
export { KEYS as STORAGE_KEYS, subscribeKeys } from './storage.mjs';
export { DESK as DESK_TEXT, PRIVACY as PRIVACY_TEXT } from './content/pages.mjs';
export { WEBSITE_UPDATES } from './content/updates.mjs';
