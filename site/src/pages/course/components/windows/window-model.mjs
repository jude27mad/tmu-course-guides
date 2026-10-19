// Display-only helpers. Deadline precision, grading and saved records stay in @src/lib.
export const isWindowPreview = (courseId) => courseId === 'mth140';
export function selectWindowItem(items, selectedId) {
  const available = (items || []).filter((item) => !item.done);
  return available.find((item) => item.id === selectedId) || available.find((item) => !item.overdue) || available[0] || null;
}
export function dateBadge(item) {
  const pending = { large: 'TBA', small: 'Date pending' };
  if (item?.precision === 'week') return { large: 'Week', small: 'Choose your section' };
  if (!['exact', 'day'].includes(item?.precision) || !/^\d{4}-\d{2}-\d{2}$/.test(item?.date || '')) return pending;
  const day = new Date(`${item.date}T12:00:00Z`);
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== item.date) return pending;
  const format = (options) => new Intl.DateTimeFormat('en-CA', { ...options, timeZone: 'UTC' }).format(day);
  return { large: item.date.slice(8), small: `${format({ month: 'short' })} · ${format({ weekday: 'short' })}` };
}
export function preparationSummary(counts) {
  if (!counts || !Number.isFinite(counts.total) || counts.total <= 0) return null;
  const total = Math.floor(counts.total);
  if (!total) return null;
  const checked = Math.max(0, Math.min(total, Math.floor(Number(counts.checked) || 0)));
  return { checked, total, percent: Math.round((checked / total) * 100) };
}
const QUESTIONS = {
  'Assessment rules': 'What are the assessment rules?',
  'If you miss an assessment': 'What happens if I miss an assessment?',
  'Regrading & communication': 'How do I request a regrade or contact the team?',
  'Dates that still need confirmation': 'Which dates and details are still unconfirmed?',
};
export const helpQuestion = (title) => QUESTIONS[title] || title;
