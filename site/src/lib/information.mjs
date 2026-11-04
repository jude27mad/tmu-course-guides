import { TERM_INFORMATION } from './terms.mjs';

// Stable URLs shared by Course info, search and browser history. The source
// content stays intact; selecting a question changes what is shown, not its facts.
const MATH_RULES = [
  ['assessment-rules', 'Assessment rules'],
  ['missed-assessment', 'Missed an assessment?'],
  ['regrade', 'Request a regrade'],
  ['unconfirmed', 'Dates awaiting confirmation'],
  ['quiz-accommodations', 'Quiz timing & accommodations'],
  ['lecture-practice', 'Lecture notes & lab practice'],
];
const CEN_RULES = [
  'headers',
  'late-work',
  'missing-notebook',
  'notebook-entries',
  'real-data',
  'review-time',
  'reassessment',
  'roles',
  'email',
];
const CEN_CONFIRMED = [
  'notebook',
  'failure-analysis',
  'headers',
  'citations',
  'whmis',
  'integrity',
  'attendance',
  'reflection',
  'matlab',
  'fmea-environmental',
  'upcoming-labs',
  'course-materials',
  'genai',
];

function buildEntries(courseId, info) {
  const entries = [
    {
      id: 'course-grading',
      title: 'Grading',
      kind: 'grading',
      group: 'Your course',
    },
    {
      id: 'contacts',
      title: 'Who to contact',
      kind: 'contacts',
      group: 'Your course',
    },
  ];
  if (courseId === 'cen100') {
    for (const [rows, ids, prefix, group] of [
      [info.rules, CEN_RULES, 'policy', 'Rules'],
      [info.confirmed, CEN_CONFIRMED, 'confirmed', 'Confirmed details'],
      [info.open, ['final-exam', 'assignment-instructions'], 'pending', 'Awaiting clarification'],
    ]) {
      rows.forEach((row, i) =>
        entries.push({
          id: `${prefix}-${ids[i]}`,
          title: row.title,
          kind: 'answer',
          group,
          blocks: [
            ...(prefix === 'pending'
              ? [{ type: 'p', text: info.openLead }]
              : []),
            { type: 'p', text: row.text },
          ],
        }),
      );
    }
  } else {
    info.rules.forEach((card, i) =>
      entries.push({
        id: `policy-${MATH_RULES[i][0]}`,
        title: MATH_RULES[i][1],
        kind: 'answer',
        group: 'Rules & help',
        blocks: card.blocks,
      }),
    );
    if (info.notice)
      entries.push({
        id: 'policy-notice',
        title: info.notice.title,
        kind: 'answer',
        group: 'Rules & help',
        blocks: info.notice.blocks,
      });
    entries.push(
      {
        id: 'textbooks',
        title: 'Textbooks',
        kind: 'textbooks',
        group: 'Reference',
      },
      {
        id: 'sources',
        title: 'Sources & date checks',
        kind: 'sources',
        group: 'Reference',
      },
    );
  }
  return entries;
}

/** The Course info entries of a course. An archived course's info (info.archived) leaves out the entries tied to its term (terms.mjs). */
export function informationEntries(courseId, info) {
  const entries = buildEntries(courseId, info);
  return info?.archived ? entries.filter((entry) => !TERM_INFORMATION.includes(entry.id)) : entries;
}

export function informationText(entry, info) {
  if (entry.blocks)
    return entry.blocks
      .flatMap((block) => block.items || block.text || [])
      .join(' ');
  if (entry.kind === 'textbooks') return JSON.stringify(info.textbooks);
  if (entry.kind === 'sources') return JSON.stringify(info.sources);
  if (entry.kind === 'grading') return JSON.stringify(info.grading);
  return JSON.stringify(info.contacts);
}
