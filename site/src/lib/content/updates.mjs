/* "What's changed?": changes students need to know about (dates, coverage, policy and grading), newest first.
   Design and website changes go in CHANGELOG.md only, so they never raise the unread badge.
   Each id starts with the entry's ISO date: the badge shows while a course's newest id is later than the
   saved one (tools.mjs). Add new entries at the top with today's date. */
export const UPDATES = {
  cen100: [
    {
      id: '2026-09-30-grading-arrangements',
      date: 'September 30, 2026',
      title: 'Grading by working arrangement',
      text: 'The official project category is 41%. Shared project deliverables M1–M7 are 38%; adding the notebook gives 42% full/sub-team work; adding MATLAB gives 52% team/pair work, with 48% individual. All 20 assessment weights remain unchanged.',
      items: [],
    },
    {
      id: '2026-09-29-graded-items',
      date: 'September 29, 2026',
      title: 'All 20 graded items',
      text: 'Added all 20 graded items under Guide tools, totalling 100%. Innovation Challenge milestones M1–M8 total 41%, including peer evaluation; notebook and reflection marks are separate.',
      items: [],
    },
    {
      id: '2026-09-25-confirmations',
      date: 'September 25, 2026',
      title: 'Reflections and MATLAB groups confirmed',
      text: 'Personal reflections are emailed to your assigned Project Manager. The MATLAB group-size exception is confirmed.',
      items: [],
    },
    {
      id: '2026-09-24-whmis-integrity',
      date: 'September 24, 2026',
      title: 'WHMIS and Academic Integrity deadlines',
      text: 'Confirmed the Oct 14 WHMIS deadline and certificate requirements, plus the Oct 14, 3 PM Academic Integrity Quiz deadline and attempt limit.',
      items: [],
    },
  ],
  mth140: [
    {
      id: '2026-10-12-quiz-2',
      date: 'October 12, 2026',
      title: 'Confirmed Quiz 2 coverage and Monday make-up',
      text: '',
      items: [
        'Quiz 2 covers Chapter 3, Sections 3.1–3.5, in the second hour of the lab. The October 8 announcement confirms Monday sections write October 19; other sections follow their October 13–16 lab.',
        'Updated quiz and calendar dates. Check D2L for any subsequent changes.',
      ],
    },
    {
      id: '2026-10-07-dates-grading',
      date: 'October 7, 2026',
      title: 'Calculus I dates and grading',
      text: '',
      items: [
        'Added four quiz weeks, the October 23 midterm, a pending final-exam card, grading weights of 15% / 40% / 45%, and the announced Quiz 1 coverage.',
        'Explained the conflicting FAQ quiz-drop wording: the outline and the September 22 announcement govern this guide.',
      ],
    },
  ],
  mth141: [
    {
      id: '2026-10-12-midterm-scope',
      date: 'October 12, 2026',
      title: 'Midterm scope',
      text: '',
      items: ['The exact midterm topic coverage, published date and time remain available. Question-type breakdowns and format details are left to D2L.'],
    },
    {
      id: '2026-10-07-dates-grading',
      date: 'October 7, 2026',
      title: 'Linear Algebra dates and grading',
      text: '',
      items: [
        'Added five quiz weeks, the October 16 midterm, a pending final-exam card, grading weights of 20% / 35% / 45%, and announced Quiz 1, Quiz 2 and midterm coverage.',
        'Explained the textbook-edition mismatch.',
      ],
    },
  ],
};
