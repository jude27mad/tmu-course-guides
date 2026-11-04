import { sections } from '@src/lib';

// A math lab quiz is written in the section's lab room, which the section list already carries
// ("Wednesday 3:00 PM–4:00 PM · POD367"). Midterm and exam rooms are posted separately on D2L,
// so only quizzes take it.
export function labRoom(courseId, section) {
  if (!section || courseId === 'cen100') return null;
  const option = sections(courseId).find((row) => String(row.value) === String(section));
  return option?.detail?.split(' · ').pop() || null;
}

// "in your 3:00 PM–4:00 PM lab" → "in your 3:00 PM–4:00 PM lab · POD367" for a lab quiz.
export const timeWithRoom = (item, room) => (room && item?.kind === 'quiz' && item.timeLabel ? `${item.timeLabel} · ${room}` : item?.timeLabel);
