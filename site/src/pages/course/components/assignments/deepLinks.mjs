// Pure routing groundwork for the assignment list and course-info accordion.
// Pass decoded ids (without '#'), as supplied by the existing guide-hash event.
// Unused fields are null; 'none' leaves scrolling/opening to existing handlers.
export function resolveHash(id, { courseId, entries = [], panels = [] } = {}) {
  if (!id) return { kind: 'none', target: null, openGroup: null, openPanel: null };

  if (/^(assignment|assessment)-/.test(id)) {
    const entry = entries.find(({ anchor }) => anchor === id);
    if (entry) return { kind: 'row', target: id, openGroup: entry.group === 'done' ? 'done' : null, openPanel: null };
  }

  if (['p-team', 'p-you', 't-team', 't-you', 'panel-assessments'].includes(id) || (id === 'study' && courseId === 'cen100')) {
    return { kind: 'section', target: 'assignments', openGroup: null, openPanel: null };
  }

  if (id === 'study' && ['mth140', 'mth141'].includes(courseId)) {
    return { kind: 'section', target: 'study', openGroup: null, openPanel: null };
  }

  if (id === 't-rules') return { kind: 'panel', target: 'p-rules', openGroup: null, openPanel: 'p-rules' };
  if (panels.includes(id)) return { kind: 'panel', target: id, openGroup: null, openPanel: id };

  return { kind: 'none', target: null, openGroup: null, openPanel: null };
}
