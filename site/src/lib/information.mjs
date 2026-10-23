// Stable URLs shared by Course info, search and browser history. The source
// content stays intact; selecting a question changes what is shown, not its facts.
const MATH_RULES = [
  ['assessment-rules', 'Assessment rules'],
  ['missed-assessment', 'Missed an assessment?'],
  ['regrade', 'Request a regrade'],
  ['unconfirmed', 'Dates awaiting confirmation'],
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
];

export function informationEntries(courseId, info) {
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
      [info.open, ['fmea-environmental'], 'pending', 'Awaiting clarification'],
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
