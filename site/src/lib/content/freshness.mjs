/* When the course data stops being true. The vendored data and the old pages' text stay byte-identical; these
   rows say, per course, which of their sentences expire and what replaces them (lib/freshness.mjs applies them).

   CHECKED_AT: the Toronto date each course was last checked against D2L (shown as "Checked against D2L: Oct 9").
   NOTES: { course, text, until, instead?, id? }
     text     the exact sentence as it appears in the data (curly quotes and en dashes included).
     until    the last Toronto date, inclusive, on which the sentence is still true.
     instead  what to show from the day after. '' blanks the field. Leave it out to remove the list entry that
              holds the sentence (a list line, a paragraph block, an open-question row).
     id       limits the row to one assessment or item, for sentences that several of them share.
   A replacement can expire in turn: add a row whose `text` is the earlier row's `instead`.
   `npm run check:freshness` lists rows that have expired, so they can be pruned once the data is updated. */

export const CHECKED_AT = Object.freeze({ cen100: '2026-10-09', mth140: '2026-10-12', mth141: '2026-10-12' });

const COVERAGE = 'Coverage awaits the course announcement on D2L.';
const SEE_COVERAGE = 'See the latest D2L announcement for the coverage.';

export const NOTES = Object.freeze(
  [
    // CEN100
    { course: 'cen100', text: 'Real-world conditions, or impact on the environment? Escalated to the Head GA. Official clarification pending.', until: '2026-10-21' },

    // MTH140
    {
      course: 'mth140',
      id: 'midterm',
      text: 'Exact midterm coverage awaits the D2L announcement. The FAQ says scope is posted approximately one week before the test.',
      until: '2026-10-16',
      instead: 'See the latest D2L announcement for the exact midterm coverage.',
    },
    { course: 'mth140', id: 'quiz-3', text: COVERAGE, until: '2026-11-06', instead: SEE_COVERAGE },
    { course: 'mth140', id: 'quiz-4', text: COVERAGE, until: '2026-11-20', instead: SEE_COVERAGE },
    { course: 'mth140', text: 'Quiz 3–4 scope and exact midterm coverage.', until: '2026-10-16', instead: 'Quiz 3–4 scope.' },
    { course: 'mth140', text: 'Quiz 3–4 scope.', until: '2026-11-06', instead: 'Quiz 4 scope.' },
    { course: 'mth140', text: 'Quiz 4 scope.', until: '2026-11-20' },
    { course: 'mth140', text: 'Check D2L for any later changes to the confirmed Quiz 2 timetable.', until: '2026-10-19' },
    {
      course: 'mth140',
      text: 'The midterm uses its published Toronto time. Lab quizzes export as tentative all-day events because the quiz start time is not confirmed. Choose a section to include them. The confirmed Monday October 19 Quiz 2 make-up is included; the unscheduled final is excluded.',
      until: '2026-10-19',
      instead: 'The midterm uses its published Toronto time. Lab quizzes export as tentative all-day events because the quiz start time is not confirmed. Choose a section to include them. The unscheduled final is excluded.',
    },

    // MTH141
    { course: 'mth141', id: 'quiz-3', text: COVERAGE, until: '2026-10-30', instead: SEE_COVERAGE },
    { course: 'mth141', id: 'quiz-4', text: COVERAGE, until: '2026-11-13', instead: SEE_COVERAGE },
    { course: 'mth141', id: 'quiz-5', text: COVERAGE, until: '2026-11-27', instead: SEE_COVERAGE },
    { course: 'mth141', text: 'Quiz 3–5 coverage.', until: '2026-10-30', instead: 'Quiz 4–5 coverage.' },
    { course: 'mth141', text: 'Quiz 4–5 coverage.', until: '2026-11-13', instead: 'Quiz 5 coverage.' },
    { course: 'mth141', text: 'Quiz 5 coverage.', until: '2026-11-27' },
    {
      course: 'mth141',
      id: 'midterm',
      text: 'Room assignments will be posted on D2L a few days before the test. Read the cover-page attachment under the October 5 announcement. The sample midterm and solutions are under Course Information → Midterm Test Materials.',
      until: '2026-10-16',
      instead: '',
    },
    { course: 'mth141', text: 'Midterm room assignments and the applicable Test Centre booking deadline.', until: '2026-10-16' },
    { course: 'mth141', text: 'Thanksgiving week & the final exam', until: '2026-10-16', instead: 'The final exam' },
    {
      course: 'mth141',
      text: 'The V3 outline says lectures continue October 12–16, except Monday, October 12, when TMU is closed. Do not assume the whole week is free of engineering classes.',
      until: '2026-10-16',
    },
  ].map((note) => Object.freeze(note)),
);
