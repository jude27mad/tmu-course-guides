import { resolveHash } from '../assignments/deepLinks.mjs';
import { informationEntries } from '../../../../lib/information.mjs';
import { TERM_INFORMATION } from '../../../../lib/terms.mjs';

const BASE = { view: 'work', filter: 'open', item: null, kind: null, panel: null };

/* The views a course offers, in tab order, as [view, label]. An archived course (info.archived) has no Schedule,
   and no Grades once its calculator closes (info.term.gradesOpen false). */
export function courseViews(courseId, info) {
  const archived = !!info?.archived;
  const grades = !archived || info.term?.gradesOpen !== false;
  return [
    ['work', 'Work'],
    ...(archived ? [] : [['schedule', 'Schedule']]),
    ...(courseId === 'cen100' ? [] : [['study', 'Study']]),
    ...(grades ? [['grades', 'Grades']] : []),
    ['info', 'Course info'],
  ];
}

function itemKind(id, courseId) {
  if (id.startsWith('topic-')) return 'topic';
  return courseId === 'cen100' ? 'cen' : 'assessment';
}

function locate(id, courseId, info) {
  const base = { ...BASE };
  const entries = info.items || info.assessments || [];
  const item = [...entries, ...(info.topics || [])].find((entry) => entry.anchor === id);
  if (item)
    return {
      ...base,
      item,
      kind: itemKind(id, courseId),
      view: id.startsWith('topic-') ? 'study' : 'work',
    };
  if (id === 'work/all' || id === 'work/done') return { ...base, filter: id.split('/')[1] };
  if (['schedule', 'deadlines', 'calendar', 'course-schedule'].includes(id)) return { ...base, view: 'schedule' };
  if (['grades', 'grade-calculator', 'calculator', 'marks'].includes(id)) return { ...base, view: 'grades' };
  if (['study', 'topics', 'panel-topics', 't-topics'].includes(id) && courseId !== 'cen100') return { ...base, view: 'study' };
  const panels = ['course-info', 'section-picker', 'p-rules', 'rules-help', 'panel-help', 't-help', ...informationEntries(courseId, info).map((entry) => entry.id)];
  const resolved = resolveHash(id, { courseId, entries, panels });
  if (resolved.kind === 'panel')
    return {
      ...base,
      view: 'info',
      panel: resolved.openPanel,
      infoDetail: informationEntries(courseId, info).some((entry) => entry.id === resolved.openPanel),
    };
  if (['info', 'rules', 'help'].includes(id)) return { ...base, view: 'info' };
  return base;
}

// One resolver for old anchors, search results and the new focused views.
// Opt in with `views` (the view ids the course offers, as courseViews() lists them): a view the course does not
// offer (an archived course's Schedule, or Grades once they close) then opens Work, and a Course info entry that
// was removed with the term (#contacts, the term's notices) opens the Course info list. Without it, every view
// resolves as before.
export function resolveCourseLocation(hash, courseId, info, { views } = {}) {
  let id = String(hash || '').replace(/^#/, '');
  try {
    id = decodeURIComponent(id);
  } catch {
    /* Unknown/malformed fragments fall back to Work. */
  }
  const location = locate(id, courseId, info);
  if (!views) return location;
  if (info?.archived && TERM_INFORMATION.includes(id)) return { ...BASE, view: 'info' };
  return views.includes(location.view) ? location : { ...BASE };
}
