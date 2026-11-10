/* CHY102 and PCS211: the page copy, Desk entries, rules cards and notices for the two guides written for this site.
   Interface strings the courses share with the math guides (tabs, tools, footer, saving messages) come from the
   MTH141 page so every guide reads the same; only course-specific text is written here. Pure data. */
import { MATH } from './pages.mjs';
import { SCIENCE } from './science-data.mjs';

export const SCIENCE_IDS = Object.keys(SCIENCE);

export const DESK_COURSES = [
  {
    id: 'chy102',
    ariaLabel: 'Open CHY102 guide, General Chemistry',
    index: '04',
    code: 'CHY102',
    name: 'General Chemistry',
    summary: 'Homework deadlines, both midterms, grading schemes and chapter review.',
  },
  {
    id: 'pcs211',
    ariaLabel: 'Open PCS211 guide, Physics: Mechanics',
    index: '05',
    code: 'PCS211',
    name: 'Physics: Mechanics',
    summary: 'Lab and tutorial weeks, the midterm, pass rules and topic review.',
  },
];

const BASE = MATH.mth141;
const D2L_LINKS = BASE.contact.links;

const page = (code, name, { placeholder, note, textbooks, sources, calendar, noscript, description, grading }) => ({
  ...BASE,
  title: `${code}: ${name} | TMU Course Guides`,
  description,
  skip: { label: 'Skip to course content', target: 'math-main' },
  find: { ...BASE.find, placeholder },
  review: {
    label: 'My skill review',
    note: 'Self-reported checks. Topic order follows the course outline; it does not estimate your personal study time.',
  },
  contact: {
    heading: 'Who to ask',
    coordinator: 'Course coordinator:',
    note,
    links: D2L_LINKS,
  },
  textbooks,
  sources,
  grading: { ...BASE.grading, ...grading },
  calendar: { ...BASE.calendar, labs: '', notes: [calendar] },
  backup: { ...BASE.backup, importLabel: `Import a ${code} backup` },
  noscriptIntro: noscript,
});

export const PAGES = {
  chy102: page('CHY102', 'General Chemistry', {
    description: 'CHY102 Fall 2026 at TMU: Mastering Chemistry homework deadlines, both midterms, grading schemes, contacts, course rules and chapter review.',
    placeholder: 'Try equilibrium or homework',
    note: 'Email from your TMU account with “CHY 102-0xx” (your section) in the subject, and your student number and chosen name in the message. Allow 3 business days for a reply, and check this outline and D2L first.',
    textbooks: {
      heading: 'Textbook & tools',
      note: 'Prices are from the TMU bookstore; other sources may differ. A non-programmable, non-graphing calculator is required for exams.',
    },
    sources: {
      heading: 'Sources & date checks',
      note: 'Written November 10, 2026 from the Fall 2026 course outline. The outline marks its weekly schedule and midterm dates as tentative; newer D2L announcements take precedence.',
    },
    grading: {
      pass: '50% overall to pass',
      labels: ['Homework', 'Midterms', 'Final exam'],
    },
    calendar:
      'Homework exports at its 11:59 PM Toronto deadline and the midterms at their published times. Exam wrappers export as all-day events across their due week. The unscheduled final is excluded.',
    noscript: 'Published deadlines and midterm dates are listed below. Check D2L for room assignments and announcements. Progress tools require JavaScript.',
  }),
  pcs211: page('PCS211', 'Physics: Mechanics', {
    description: 'PCS211 Fall 2026 at TMU: lab and tutorial weeks, the midterm, evaluation options, pass rules, exam rules and topic review.',
    placeholder: 'Try momentum or lab',
    note: 'Emails are answered only when they come from your TMU account and have “PCS 211” in the subject line. Check your TMU email and D2L often for announcements.',
    textbooks: {
      heading: 'Textbooks',
      note: 'Prices are approximate and from Cengage; they may vary. The textbook does not include WebAssign access, which is sold separately or bundled.',
    },
    sources: {
      heading: 'Sources & date checks',
      note: 'Written November 10, 2026 from the Fall 2026 course information and outline. The course and tutorial schedules are tentative; changes are discussed in class and posted on D2L.',
    },
    grading: {
      pass: '50% overall, plus 50% in THEORY and in LABORATORY',
      labels: ['Labs & tutorials', 'Midterm exam', 'Final exam'],
    },
    calendar:
      'The midterm exports at its published Toronto time. Labs and tutorials export as all-day events across their two-week window, because your session’s day is on D2L. The unscheduled final is excluded.',
    noscript: 'Published dates and lab and tutorial weeks are listed below. Check D2L for your session’s day, time and room. Progress tools require JavaScript.',
  }),
};

// Course info → Rules & help. Each card has a stable id (the Course info address) and its list title.
const CHY_RULES = [
  {
    id: 'assessment-rules',
    listTitle: 'Assessment rules',
    title: 'Assessment rules',
    blocks: [
      {
        type: 'list',
        items: [
          'At least 50% overall is required to pass.',
          'You are graded under Scheme 1 unless you opted into Scheme 2 by September 18 at 5 PM. Weights are never shifted, and no make-up is given for a poor result.',
          'Bring a non-programmable, non-graphing scientific calculator; graphing or text-storing calculators are not allowed in final exams.',
          'Phones, earbuds, smart watches and smart or AI glasses are prohibited in tests and exams, whether on or off.',
        ],
      },
      {
        type: 'source',
        text: 'Source: CHY 102 Course Outline, pp. 4, 8–9 and 17–18.',
      },
    ],
  },
  {
    id: 'missed-assessment',
    listTitle: 'Missed an assessment?',
    title: 'If you miss an assessment',
    blocks: [
      {
        type: 'p',
        text: 'Missed midterm: email your instructor by 5 PM on the day of the midterm with your name, student number and a brief reason. Then submit an academic consideration request (ACR) to the Faculty of Science Office within 3 business days, with a TMU Student Health Certificate or other valid documentation.',
      },
      {
        type: 'p',
        text: 'One ACR per term may be submitted without documentation, for an absence of under 3 days; it cannot be used for the final exam. A verified ACR is not an approval: your instructor decides, and tells you the make-up date if approved.',
      },
      {
        type: 'p',
        text: 'No ACR for missed homework or iClicker questions. Homework is open for a week, so there are no extensions; the iClicker scale already allows for occasional absences and technical problems.',
      },
      { type: 'source', text: 'Source: CHY 102 Course Outline, pp. 10–12.' },
    ],
  },
  {
    id: 'homework',
    listTitle: 'Homework & late penalty',
    title: 'Homework, iClicker & exam wrappers',
    blocks: [
      {
        type: 'list',
        items: [
          'Eleven graded Mastering Chemistry assignments, each 1%, due Mondays at 11:59 PM. The lowest is dropped. Homework 12 is optional.',
          'Late homework loses 10% per day, up to 50% per assignment. Bonus marks are available, up to 100% per assignment.',
          'iClicker (Scheme 1 only): 5% from the share of lectures you answered (75% or more earns all 5).',
          'Two exam wrappers, 2.5% each, after each midterm: Google Forms marked on thoughtful reflection.',
        ],
      },
      { type: 'source', text: 'Source: CHY 102 Course Outline, pp. 13–15.' },
    ],
  },
  {
    id: 'integrity',
    listTitle: 'Academic integrity & AI',
    title: 'Academic integrity & AI',
    blocks: [
      {
        type: 'p',
        text: 'Generative AI (ChatGPT, Gemini and others) may help you learn, but using it for any submitted work breaches Policy 60. Wearing or using AI or smart glasses in lectures, quizzes or exams also breaches it.',
      },
      {
        type: 'p',
        text: 'Posting an assignment question to a third-party site means 0 on it and up to 15% off the course; viewing one means 0. Posting a final-exam question means an F and a one-term suspension; viewing one means an F.',
      },
      {
        type: 'p',
        text: 'Slides, lecture notes and exams are your instructors’ intellectual property and may not be shared or sold.',
      },
      {
        type: 'source',
        text: 'Source: CHY 102 Course Outline, pp. 16–18; Senate Policy 60.',
      },
    ],
  },
  {
    id: 'unconfirmed',
    listTitle: 'Dates awaiting confirmation',
    title: 'Dates that still need confirmation',
    blocks: [
      {
        type: 'list',
        items: ['Midterm rooms, and any change to the tentative midterm dates.', 'The exact due day of each exam wrapper.', 'The final exam’s date, time, room and coverage.'],
      },
      {
        type: 'source',
        text: 'Source: CHY 102 Course Outline, pp. 6–7. Check D2L.',
      },
    ],
  },
];
const PCS_RULES = [
  {
    id: 'assessment-rules',
    listTitle: 'Pass rules & exam rules',
    title: 'Pass rules & exam rules',
    blocks: [
      {
        type: 'list',
        items: [
          'You need at least 50% overall, and at least 50% in THEORY (midterm, final and tutorials) and 50% in LABORATORY.',
          'THEORY = (Final × 0.40 + Midterm × 0.25 + Tutorials × 0.10) ÷ 0.75. LABORATORY is your cumulative grade for the five labs.',
          'Exams are closed book, with a formula sheet provided and posted on D2L beforehand. Only pens, pencils, erasers, a calculator and your TMU ID are allowed.',
          'Calculators must be non-programmable and non-graphing; the Faculty of Science recommends the Sharp EL-546 or Casio FX-991.',
        ],
      },
      {
        type: 'source',
        text: 'Source: PCS 211 Course Outline, pp. 4–5; Policy 135.',
      },
    ],
  },
  {
    id: 'labs-tutorials',
    listTitle: 'Labs & tutorials',
    title: 'Labs & tutorials',
    blocks: [
      {
        type: 'p',
        text: 'Five two-hour labs and five two-hour tutorials, each every other week. Your section’s session falls in one week of each pair (weeks 2–3, 4–5, 6–7, 8–9 and 10–11); the day and room are on D2L.',
      },
      {
        type: 'list',
        items: [
          'Each lab’s pre-lab quiz is due when the session starts, and the report when it ends. Late quizzes and reports receive zero.',
          'Labs are normally done in pairs; be ready to finish alone if your partner is absent.',
          'Each tutorial includes an assessed component, written in the session.',
        ],
      },
      {
        type: 'source',
        text: 'Source: PCS 211 Course Outline, pp. 2–3 and 6–7.',
      },
    ],
  },
  {
    id: 'missed-assessment',
    listTitle: 'Missed an assessment?',
    title: 'If you miss an assessment',
    blocks: [
      {
        type: 'p',
        text: 'Submit an academic consideration request (ACR) through TMU’s online portal and notify your instructor, in advance where possible or within 3 business days. One ACR per term may be made without documentation, except for final exams.',
      },
      {
        type: 'p',
        text: 'Missed midterm: an approved make-up is scheduled as soon as possible. Missed final: an approved make-up is normally within two weeks of the end of term. Missed tutorial: you may join another session if one is available; there are no make-up tutorials. Missed lab: you may join another session in the same cycle, or a make-up lab at the end of term.',
      },
      {
        type: 'p',
        text: 'A verified ACR does not mean it is approved; final approval is your instructor’s decision.',
      },
      {
        type: 'source',
        text: 'Source: PCS 211 Course Outline, pp. 8–10; Senate Policy 167.',
      },
    ],
  },
  {
    id: 'regrade',
    listTitle: 'Regrading & returned work',
    title: 'Grades, regrading & deadlines',
    blocks: [
      {
        type: 'list',
        items: [
          'Grades are posted on D2L, normally within 10 days of each assessment.',
          'Request a regrade within 10 working days of the graded work’s return (Senate Policy 162).',
          'At least 20% of your grade is returned before Friday, November 20, 2026, the last day to drop without academic penalty.',
          'Work handed in after its due date receives zero unless stated otherwise.',
        ],
      },
      { type: 'source', text: 'Source: PCS 211 Course Outline, pp. 5 and 7.' },
    ],
  },
  {
    id: 'integrity',
    listTitle: 'Plagiarism & AI',
    title: 'Plagiarism & AI',
    blocks: [
      {
        type: 'p',
        text: 'Lab reports are checked with Turnitin. Any use of content generated by artificial intelligence counts as plagiarism, with a minimum grade of 0 on that assessment.',
      },
      {
        type: 'p',
        text: 'Slides, lecture notes, lab manuals and exams are intellectual property and may not be shared or sold (Policy 60).',
      },
      { type: 'source', text: 'Source: PCS 211 Course Outline, pp. 3 and 11.' },
    ],
  },
];
export const RULES = { chy102: CHY_RULES, pcs211: PCS_RULES };

export const NOTICES = {
  chy102: {
    title: 'Which grading scheme am I in?',
    blocks: [
      {
        type: 'p',
        text: 'Everyone starts in Scheme 1: homework 10%, exam wrappers 5%, iClicker 5%, each midterm 22.5% and the final 35%. Scheme 2 drops iClicker and makes each midterm 25%; it applied only if you submitted the D2L form by September 18 at 5 PM. Grades → choose your scheme to calculate with the right weights.',
      },
    ],
  },
  pcs211: {
    title: 'Which evaluation option applies?',
    blocks: [
      {
        type: 'p',
        text: 'The course automatically uses whichever gives you the higher grade: Option 1 (WebAssign 5%, final 40%) or Option 2 (WebAssign 0%, final 45%). WebAssign never affects your THEORY grade. The ClassQuestion bonus (up to 2%) is only for answering in person during lectures.',
      },
    ],
  },
};
