import { resolveHash } from '../assignments/deepLinks.mjs';
import { informationEntries } from '../../../../lib/information.mjs';

// One resolver for old anchors, search results and the new focused views.
export function resolveCourseLocation(hash, courseId, info) {
  let id = String(hash || '').replace(/^#/, '');
  try {
    id = decodeURIComponent(id);
  } catch {
    /* Unknown/malformed fragments fall back to Work. */
  }
  const base = {
    view: 'work',
    filter: 'open',
    item: null,
    kind: null,
    panel: null,
  };
  const entries = info.items || info.assessments || [];
  const item = [...entries, ...(info.topics || [])].find(
    (entry) => entry.anchor === id,
  );
  if (item)
    return {
      ...base,
      item,
      kind: id.startsWith('topic-')
        ? 'topic'
        : courseId === 'cen100'
          ? 'cen'
          : 'assessment',
      view: id.startsWith('topic-') ? 'study' : 'work',
    };
  if (id === 'work/all' || id === 'work/done')
    return { ...base, filter: id.split('/')[1] };
  if (['schedule', 'deadlines', 'calendar', 'course-schedule'].includes(id))
    return { ...base, view: 'schedule' };
  if (
    ['study', 'topics', 'panel-topics', 't-topics'].includes(id) &&
    courseId !== 'cen100'
  )
    return { ...base, view: 'study' };
  const panels = [
    'course-info',
    'section-picker',
    'p-rules',
    'rules-help',
    'panel-help',
    't-help',
    ...informationEntries(courseId, info).map((entry) => entry.id),
  ];
  const resolved = resolveHash(id, { courseId, entries, panels });
  if (resolved.kind === 'panel')
    return {
      ...base,
      view: 'info',
      panel: resolved.openPanel,
      infoDetail: informationEntries(courseId, info).some(
        (entry) => entry.id === resolved.openPanel,
      ),
    };
  if (['info', 'rules', 'help'].includes(id)) return { ...base, view: 'info' };
  return base;
}
