/* Static text of the old pages, generated from their HTML in document order (tags stripped, entities decoded,
   words unchanged): index.html (DESK), cen100/index.html (CEN), mth140/ and mth141/index.html (MATH),
   privacy.html (PRIVACY). Regenerate with site/tests/extract/pages.mjs rather than editing, except for the
   "updates" entries dated October 15, 2026 or later: those are maintained here by hand, and regenerating
   would remove them. */
export const DESK = {
  title: 'TMU Course Guides | Fall 2026',
  description: 'TMU Fall 2026 course guides: CEN100 assignment deadlines, requirements and contacts, plus MTH140 and MTH141 assessment and section guides.',
  skip: 'Skip to courses',
  kicker: 'TMU · Sep 8 – Dec 21',
  heading: 'TMU Course Guides',
  headingTerm: 'Fall 2026',
  lede: 'Deadlines, requirements, section details and your saved progress for each course. Progress stays in this browser.',
  nextHeading: 'Next across your courses',
  nextStatic: 'Open a course guide below for every deadline, requirement and checklist.',
  coursesHeading: 'Courses',
  courses: [
    {
      id: 'cen100',
      ariaLabel: 'Open CEN100 guide, Engineering',
      index: '01',
      code: 'CEN100',
      name: 'Engineering',
      summary: 'Assignment deadlines, requirements, checklists and section/group contacts.',
    },
    {
      id: 'mth140',
      ariaLabel: 'Open MTH140 guide, Calculus I',
      index: '02',
      code: 'MTH140',
      name: 'Calculus I',
      summary: 'Assessment dates, section labs, announced coverage and practice.',
    },
    {
      id: 'mth141',
      ariaLabel: 'Open MTH141 guide, Linear Algebra',
      index: '03',
      code: 'MTH141',
      name: 'Linear Algebra',
      summary: 'Assessment dates, section labs, announced coverage and practice.',
    },
  ],
  openGuide: 'Open guide',
  footer: 'Sections, notes and completion records are saved only in this browser.',
  privacy: 'Privacy',
};

export const CEN = {
  title: 'CEN100 | TMU Course Guides',
  description: 'CEN100 Fall 2026 at TMU: assignment deadlines, requirements, checklists, course clarifications and section/group contacts.',
  context: 'CEN100 · Fall 2026',
  heading: 'Introduction to Engineering',
  profile: {
    summary: 'Choose your section & group',
    sectionLabel: 'Your CEN100 section',
    sectionPlaceholder: 'Choose your section',
    groupLabel: 'Your Innovation Challenge group',
    groupPlaceholder: 'Choose your section first',
    note: 'Optional. Your choices are saved on this device and update Who to ask.',
    done: 'Done',
    viewContacts: 'View contacts',
  },
  nextLabel: 'Next deadline',
  afterLabel: 'After that',
  undo: 'Undo',
  find: {
    label: 'Search the guide',
    placeholder: 'Try FMEA, citations or notebook',
    work: "This week's work",
    contacts: 'Contacts',
    d2l: 'D2L ↗',
    hideCompleted: 'Hide fully checked items',
  },
  noscriptIntro: 'Published dates are listed below. Check D2L for submission details, your assigned lab times and any announcements. Progress and section tools require JavaScript.',
  tabs: [
    {
      id: 'team',
      label: 'Team',
    },
    {
      id: 'you',
      label: 'Individual + pairs',
    },
    {
      id: 'rules',
      label: 'Rules',
    },
  ],
  leads: {
    team: 'Team projects and the shared notebook · 42% of your course grade.',
    you: 'Individual work (48%) and MATLAB pairs (10%) · 58% of your course grade.',
    rules: 'These apply to everything.',
  },
  rulesHeadings: ['Confirmed', 'Still open', 'Who to ask'],
  openLead: 'Until these are settled, use the earlier date or the safer choice.',
  changeProfile: 'Change section/group',
  contactNote: 'For contact details, check D2L or the official Section GAs and PMs document.',
  tools: {
    summary: 'Guide tools',
    updated: 'Updated Oct 9, 2026',
    note: 'Your saved section, group and checklist settings stay on this device.',
  },
  grading: {
    summary: 'Course grading: all 20 items (100%)',
    notes: [
      '52% of the course grade is for work normally completed with other students; 48% is individual work. The official Innovation Challenge Project category is 41%, including the individual Peer Evaluation. These describe different groupings of the same marks.',
      'The first four rows overlap; do not add them together. The working-arrangement split is 42% team/sub-team + 10% MATLAB pairs + 48% individual = 100%. MATLAB is normally paired; the confirmed odd-class-size exception allows the unpaired student to work solo or in a group of three. These percentages are grade weights, not estimates of time or workload.',
      'All 20 graded items: each weight below is a share of the full course grade.',
      'Team Design Notebooks (4%) and Personal Reflections (4%) sit outside the official 41% project category. The notebook contributes to team work; reflections and Peer Evaluation (M8, 3%) contribute to individual work. Completing work in a team does not remove the requirement to document individual contributions.',
      'Source: CEN100 Course Outline F26, p. 9 (assessment weights) and pp. 10–11 (working arrangements and shared notebook). The subtotals above are calculated from those weights.',
    ],
    tables: [
      {
        label: 'Grading categories and working arrangements',
        columns: ['What the percentage covers', 'Weight'],
        rows: [
          {
            label: 'Official Innovation Challenge Project category: M1–M8, including individual Peer Evaluation (3%)',
            weight: '41%',
          },
          {
            label: 'Shared project deliverables: M1–M7 (41% − 3%)',
            weight: '38%',
          },
          {
            label: 'All full/sub-team work: M1–M7 + shared Team Design Notebook (38% + 4%)',
            weight: '42%',
          },
          {
            label: 'All team/pair work: full/sub-team work + MATLAB assignments (42% + 10%)',
            weight: '52%',
          },
          {
            label: 'Individual work: orientation/policy items (12%), participation (5%), reflections (4%), peer evaluation (3%), final exam (24%)',
            weight: '48%',
          },
        ],
        total: [],
      },
      {
        label: 'CEN100 course grading allocation',
        columns: ['Graded item', 'Weight'],
        rows: [
          {
            label: 'Personal Introduction',
            weight: '1%',
          },
          {
            label: 'Survey Questionnaire (entry)',
            weight: '1%',
          },
          {
            label: 'Course Syllabus Quiz',
            weight: '2%',
          },
          {
            label: 'Professional Email Assignment',
            weight: '2%',
          },
          {
            label: 'Academic Integrity Quiz',
            weight: '2%',
          },
          {
            label: 'WHMIS Certification',
            weight: '2%',
          },
          {
            label: 'Exit Survey Questionnaire',
            weight: '2%',
          },
          {
            label: 'D2L Quizzes / Lab Participation',
            weight: '5%',
          },
          {
            label: 'Team Design Notebooks (shared team)',
            weight: '4%',
          },
          {
            label: 'Personal Reflections (individual)',
            weight: '4%',
          },
          {
            label: 'MATLAB Assignments (normally pairs)',
            weight: '10%',
          },
          {
            label: 'Team Contract + Task Outline (M1)',
            weight: '2%',
          },
          {
            label: 'Project Outline + User Research (M2)',
            weight: '4%',
          },
          {
            label: 'Failure Analysis Labs (M3)',
            weight: '6%',
          },
          {
            label: 'Midterm Design Review (M4)',
            weight: '8%',
          },
          {
            label: 'Low-Fidelity Prototype (M5)',
            weight: '4%',
          },
          {
            label: 'Final Project Presentations (M6)',
            weight: '6%',
          },
          {
            label: 'Final Report (M7)',
            weight: '8%',
          },
          {
            label: 'Peer Evaluation (M8, individual)',
            weight: '3%',
          },
          {
            label: 'Final Exam',
            weight: '24%',
          },
        ],
        total: ['Course total', '100%'],
      },
    ],
  },
  work: {
    summary: 'What should I work on?',
    label: 'Show unfinished work',
    options: [
      {
        value: 'week',
        label: 'Next 7 days',
      },
      {
        value: 'all',
        label: 'All unfinished',
      },
    ],
    notes: ['Based on your own submission/completion records in each card, separately from checklist ticks. Personal target dates are your plans, not official deadlines.'],
  },
  calendar: {
    summary: 'Add deadlines to my calendar',
    itemLabel: 'Deadlines to include',
    allOption: 'All confirmed deadlines',
    upcoming: 'Upcoming dates only',
    reminderLabel: 'Reminder',
    reminders: [
      {
        value: 1,
        label: '1 day before',
      },
      {
        value: 2,
        label: '2 days before',
      },
      {
        value: 0,
        label: 'No reminder',
      },
    ],
    download: 'Download calendar (.ics)',
    notes: [
      'Open the .ics file in Apple Calendar, or import it into Google Calendar. Times use Toronto time. Dates without a confirmed time are all-day entries, with reminders at 9 AM. Approximate dates and the unscheduled final exam are excluded.',
      "Calendar copies do not update automatically. Check D2L for changes and review your calendar's alert settings.",
    ],
  },
  backup: {
    summary: 'Move or back up my progress',
    notes: [
      'Export your progress, then import the file on another device. Backups include checklist ticks, completion records, private notes and personal target dates. Importing adds progress and fills empty notes/targets; existing conflicting notes/targets stay as they are. Older checklist backups still work.',
    ],
    export: 'Export my progress',
    importLabel: 'Import a progress backup (.json)',
  },
  updatesSummary: "What's changed?",
  updatesBadge: 'New updates',
  updates: [
    {
      date: 'October 16, 2026',
      title: 'Course artwork and signal field',
      text: 'New artwork keeps the same layout, moving windows and course tools.',
      items: [
        'The home windows now reveal a charcoal signal field with light points and travelling orange pulses.',
        'Course images now reflect the subjects: a steel bridge mechanism for Introduction to Engineering, a worked integral for Calculus I, and linear equations for Linear Algebra.',
        'Next Up and the course windows reveal the photographs from pixels to a sharp image. Pause motion and reduced motion show the finished images immediately.',
        'Your course dates, sections, checklists, completion records, notes and target dates are unchanged.',
      ],
    },
    {
      date: 'October 15, 2026',
      title: 'New website design',
      text: 'The guides have a new design, with full-screen 3D sections, page transitions and smooth scrolling.',
      items: [
        'The Desk shows your next deadline across all courses with a live countdown, Mark done and Undo, and a card for each course.',
        'Each guide opens with your next deadline, then lists deadlines under This week, Next week and Later, followed by the weekly checklist, assessments and course information.',
        'Search is in the top bar on larger screens and in the menu on phones. Ctrl K or ⌘ K still opens it from a keyboard.',
        'Pause motion is in the menu, and your device’s reduced-motion setting is respected. The new design uses a light appearance only.',
        'Your saved sections, ticks, completion records, notes and target dates carry over unchanged.',
      ],
    },
    {
      date: 'October 12, 2026',
      title: 'Subject headers and privacy',
      items: [
        'New moving subject artwork: Engineering gears, Calculus curves and a matrix-transformed sphere for Linear Algebra. Drag to rotate; pause at any time.',
        'New folded-page logo, responsive artwork framing and fallback images. Course colours and saved progress are preserved.',
        'Fonts now load locally. Removed analytics code and course-only staff names; current contacts are on D2L. Added a Privacy page.',
      ],
    },
    {
      date: 'October 11, 2026',
      title: 'Larger scenes, connected motion',
      items: [
        'Full-width circuit, calculus ribbon and transformation lattice. Pause motion from the header.',
        'Animated assignments, search, tools, study panels and completion. Guide tools are beside Search.',
      ],
    },
    {
      date: 'October 11, 2026',
      title: 'Course headers in motion',
      items: [
        'Dimensional circuit, calculus and linear algebra illustrations, with smooth course transitions. Motion respects device settings and settles after a short demonstration.',
        'The existing course colours, content and saved progress stay the same.',
      ],
    },
    {
      date: 'October 11, 2026',
      title: 'An organised course workspace',
      items: [
        'Assignments open first. Study and Course info have their own navigation, with compact tabs on phones.',
        'Original course colours, interactive maths, assignment details and saved progress are preserved. Past assignments remain available; calendar exports, contacts and grading are in Course info.',
      ],
    },
    {
      date: 'October 11, 2026',
      title: 'A new course guide design',
      items: [
        'Larger course titles, a shared layout across Engineering and both math courses, and a compact toolbar with direct search, calendar, grading and work shortcuts.',
        'Clearer deadline rows and a revised circuit header. All existing course information and saved progress remain available.',
      ],
    },
    {
      date: 'Oct 11, 2026',
      title: 'Visual tools',
      text: 'Added a semester timeline and assignment detail sheets. Completion records, checklists and notes use the same saved data. The circuit header follows your next unfinished deadline.',
      items: [],
      after: '',
    },
    {
      date: 'Oct 9, 2026',
      title: 'Fewer taps',
      text: "Search, this week's work, contacts and D2L are now within easy reach. Mark the next deadline done directly, with Undo, using your existing completion records. Guide tools sit below the cards and tab introductions are shorter.",
      items: [],
      after: '',
    },
    {
      date: 'Oct 7, 2026',
      title: 'Easier to scan',
      text: 'Added short requirement previews to closed assignment and math assessment cards, visible opening arrows on upcoming deadlines, and a View requirements cue on the next deadline. Refined text weights, badges, borders and spacing across all three courses, with gentle opening transitions that respect reduced motion.',
      items: [],
      after: '',
    },
    {
      date: 'Oct 7, 2026',
      title: 'Three-course guide',
      text: 'Added MTH140: Calculus I and MTH141: Linear Algebra alongside CEN100.',
      items: [
        'Switch courses in the shared header. Each course remembers its own section and progress; Auto, Dark and Light appearance is shared.',
        'Both math guides cover all 34 sections, with assigned lab times, rooms and staff. Assessment dashboards and grading bars replace the team/individual split.',
        'Added published quiz weeks and midterm dates, announced coverage, preparation checklists, completion records, notes, study targets, direct links, search, calendars and course-specific backups.',
        'Added 16 math topic blocks and 77 recommended-practice rows, with skill-review checks, textbook links and course rules. Calculus uses cyan curve/tangent graphics; Linear Algebra uses violet vector graphics.',
        'Quiz days derived from lab timetables are labelled. Thanksgiving arrangements, unannounced coverage and final dates remain pending; source conflicts and textbook-edition differences are explained.',
        "Expanded the README for all three courses and added What's changed with unread-update badges above both math footers. Checked phone, desktop and enlarged-text layouts, saved progress, backups and calendar exports.",
      ],
      after: 'Existing CEN100 records, section/group choices and assignment links remain available.',
    },
    {
      date: 'Sep 30, 2026',
      title: '',
      text: 'Clarified grading by working arrangement: the official project category is 41%; shared project deliverables M1–M7 are 38%; adding the notebook gives 42% full/sub-team work; adding MATLAB gives 52% team/pair work, with 48% individual. Renamed the Individual tab to Individual + pairs in the guide and colour preview, and updated the README. All 20 assessment weights remain unchanged.',
      items: [],
      after: '',
    },
    {
      date: 'Sep 29, 2026',
      title: '',
      text: 'Updated the README and change history to cover the latest grading, colour and analytics changes, including what is measured and what stays saved only in your browser.',
      items: [],
      after: '',
    },
    {
      date: 'Sep 29, 2026',
      title: '',
      text: 'Verified the first scheduled daily usage archive. The maintainer can keep saved all-time, monthly and yearly totals from Sep 28, with downloadable backups and checks for missing data. These reports are private and contain no students’ saved course progress.',
      items: [],
      after: '',
    },
    {
      date: 'Sep 29, 2026',
      title: '',
      text: 'Added all 20 graded items under Guide tools, totalling 100%. Clarified that Innovation Challenge milestones M1–M8 total 41%, including peer evaluation; notebook and reflection marks are separate.',
      items: [],
      after: '',
    },
    {
      date: 'Sep 28, 2026',
      title: '',
      text: 'Added Cloudflare Web Analytics for private usage and performance reporting. Page views and visits are not unique people. Cloudflare uses no analytics cookies or fingerprinting; your section/group, notes, targets, checklists and completion records are not sent to analytics.',
      items: [],
      after: '',
    },
    {
      date: 'Sep 28, 2026',
      title: '',
      text: 'Restored the original yellow for Still open icons on the Rules tab, independently of the rose accent elsewhere.',
      items: [],
      after: '',
    },
    {
      date: 'Sep 28, 2026',
      title: '',
      text: 'Applied the selected rose accent to deadlines and highlights, keeping the existing layout and automatic light/dark appearance.',
      items: [],
      after: '',
    },
    {
      date: 'Sep 28, 2026',
      title: '',
      text: 'Added a separate colour preview with eight accents, dark navy or light backgrounds, shareable colour selections and a reset option. Preview progress stays separate from the main guide.',
      items: [],
      after: '',
    },
    {
      date: 'Sep 28, 2026',
      title: '',
      text: "Moved What's changed and its unread-update badge to the bottom of the page, just above the footer.",
      items: [],
      after: '',
    },
    {
      date: 'Sep 26, 2026',
      title: '',
      text: 'Tap upcoming deadlines to open their assignment. Next up skips dates you have marked submitted/completed, and closed cards show your separate completion records.',
      items: [],
      after: '',
    },
    {
      date: 'Sep 26, 2026',
      title: '',
      text: 'Your lab location now appears beside your section and group at the top of the guide and updates when you change sections.',
      items: [],
      after: '',
    },
    {
      date: 'Sep 26, 2026',
      title: '',
      text: 'Unified deadline tracking, kept repeated deadlines active, clarified date-passed labels, and scoped tutorial times to confirmed sections.',
      items: [],
      after: '',
    },
    {
      date: 'Sep 26, 2026',
      title: '',
      text: 'Added unfinished-work planning, separate submission/completion records, assignment links, private notes, personal target dates and an unread-update indicator. New backups include these records; older checklist backups still import.',
      items: [],
      after: '',
    },
    {
      date: 'Sep 26, 2026',
      title: '',
      text: 'Added creator and maintainer credit in the footer.',
      items: [],
      after: '',
    },
    {
      date: 'Sep 25, 2026',
      title: '',
      text: 'Kept added guide controls within their existing card widths on smaller screens.',
      items: [],
      after: '',
    },
    {
      date: 'Sep 25, 2026',
      title: '',
      text: 'Moved section/group selection to the top of the guide. Who to ask now shows the matching contact results, with a shortcut to change your selection.',
      items: [],
      after: '',
    },
    {
      date: 'Sep 25, 2026',
      title: '',
      text: 'The page heading now follows your selected section and group, with a neutral course label before selection.',
      items: [],
      after: '',
    },
    {
      date: 'Sep 25, 2026',
      title: '',
      text: 'Added remembered section/group choices, calendar export, checklist backups, search, source notes and the option to hide fully checked items. Removed the large attendance warning from Rules.',
      items: [],
      after: '',
    },
    {
      date: 'Sep 25, 2026',
      title: '',
      text: 'Added the contact lookup for all 39 sections and 52 groups, showing names and lab locations.',
      items: [],
      after: '',
    },
    {
      date: 'Sep 25, 2026',
      title: '',
      text: 'Confirmed reflection submissions by email to the assigned PM and the MATLAB group-size exception. The FMEA Environmental clarification remains pending.',
      items: [],
      after: '',
    },
    {
      date: 'Sep 25, 2026',
      title: '',
      text: 'Organized assignment cards by working arrangement, with the shared notebook under Team and peer evaluation under Individual.',
      items: [],
      after: '',
    },
    {
      date: 'Sep 24, 2026',
      title: '',
      text: 'Confirmed the Oct 14 WHMIS deadline and certificate requirements, plus the Oct 14, 3 PM Academic Integrity Quiz deadline and attempt limit.',
      items: [],
      after: '',
    },
  ],
  footer: {
    source: 'From Fall 2026 CEN100 documents on D2L and confirmed course-team clarifications.',
    reset: 'Clear my ticks',
    privacy: 'Privacy',
  },
};

export const MATH = {
  mth140: {
    title: 'MTH140: Calculus I | TMU Course Guides',
    description: 'MTH140 Fall 2026 at TMU: assessment dates, section labs, announced coverage, course rules and recommended practice.',
    skip: {
      label: 'Skip to coursework',
      target: 'panel-assessments',
    },
    eyebrowTerm: 'Fall 2026',
    section: {
      label: 'My section',
      placeholder: 'Choose section',
    },
    nextLabel: 'Upcoming assessments',
    afterHeading: 'After that',
    undo: 'Undo',
    find: {
      label: 'Search assessments and topics',
      placeholder: 'Try derivatives or quiz',
      work: "This week's work",
      contacts: 'Contacts',
      d2l: 'D2L ↗',
      hideCompleted: 'Hide completed assessments',
    },
    tabs: [
      {
        id: 'assessments',
        label: 'Assessments',
      },
      {
        id: 'topics',
        label: 'Topic map',
      },
      {
        id: 'help',
        label: 'Rules & help',
      },
    ],
    assessmentsIntro: 'Dates, coverage and preparation in one place.',
    assessmentsEmpty: 'No assessments match these filters.',
    review: {
      label: 'My skill review',
      note: 'Self-reported checks. Topic order and approximate lecture hours follow the course outline; they do not estimate your personal study time.',
    },
    topicsEmpty: 'No topics match this search.',
    contact: {
      heading: 'Who to ask',
      coordinator: 'Course coordinator:',
      note: 'Check D2L for contact details and timetable updates. Your lecture and lab codes end in 1 and 2: for example, 241 and 242 both mean Section 24.',
      links: [
        {
          label: 'Open D2L',
          href: 'https://courses.torontomu.ca/',
        },
        {
          label: 'Learning support',
          href: 'https://www.torontomu.ca/student-life-and-learning/learning-support/',
        },
        {
          label: 'Academic consideration',
          href: 'https://www.torontomu.ca/senate/academic_consideration_requests/',
        },
      ],
    },
    textbooks: {
      heading: 'Free textbooks & practice',
      note: 'Use the Topic map for the exact exercise references. This guide lists references and study prompts; the official course files remain on D2L.',
    },
    sources: {
      heading: 'Sources & date checks',
      note: 'Reviewed October 12, 2026. Course outlines and supplied D2L announcements provide the dates and rules. Newer official announcements take precedence.',
    },
    tools: {
      summary: 'Guide tools',
      note: 'Your choices and progress stay in this browser. There is no account or automatic device sync.',
    },
    grading: {
      summary: 'Course grading',
      heading: 'Course grading',
      pass: '50% overall to pass',
      labels: ['Lab quizzes', 'Midterm test', 'Final exam'],
    },
    work: {
      summary: 'What should I work on?',
      label: 'Unrecorded assessments and my study targets',
      options: [
        {
          value: 'week',
          label: 'Next 7 days',
        },
        {
          value: 'all',
          label: 'All unfinished',
        },
      ],
      notes: ['Uses your completion records and personal target dates. Preparation checklists are tracked separately.'],
    },
    calendar: {
      summary: 'Add assessments to my calendar',
      upcoming: 'Upcoming dates only',
      labs: 'Include lab dates from my section timetable',
      notes: [
        'The midterm uses its published Toronto time. Lab quizzes export as tentative all-day events because the quiz start time is not confirmed. Choose a section to include them. The confirmed Monday October 19 Quiz 2 make-up is included; the unscheduled final is excluded.',
      ],
      download: 'Download calendar (.ics)',
    },
    backup: {
      summary: 'Move or back up my progress',
      notes: [
        'Includes this course’s preparation checks, assessment completion, topic skill checks, notes and study targets. Import adds progress and fills empty notes and targets; existing conflicting entries stay as they are.',
      ],
      export: 'Export my progress',
      importLabel: 'Import a MTH140 backup',
    },
    updatesSummary: "What's changed?",
    updatesBadge: 'New updates',
    updates: [
      {
        date: 'October 16, 2026',
        title: 'Course artwork and signal field',
        text: 'New artwork keeps the same layout, moving windows and course tools.',
        items: [
          'The home windows now reveal a charcoal signal field with light points and travelling orange pulses.',
          'Course images now reflect the subjects: a steel bridge mechanism for Introduction to Engineering, a worked integral for Calculus I, and linear equations for Linear Algebra.',
          'Next Up and the course windows reveal the photographs from pixels to a sharp image. Pause motion and reduced motion show the finished images immediately.',
          'Your course dates, sections, checklists, completion records, notes and target dates are unchanged.',
        ],
      },
      {
        date: 'October 15, 2026',
        title: 'New website design',
        text: 'The guides have a new design, with full-screen 3D sections, page transitions and smooth scrolling.',
        items: [
          'The Desk shows your next deadline across all courses with a live countdown, Mark done and Undo, and a card for each course.',
          'Each guide opens with your next deadline, then lists deadlines under This week, Next week and Later, followed by the weekly checklist, assessments and course information.',
          'Search is in the top bar on larger screens and in the menu on phones. Ctrl K or ⌘ K still opens it from a keyboard.',
          'Pause motion is in the menu, and your device’s reduced-motion setting is respected. The new design uses a light appearance only.',
          'Your saved sections, ticks, completion records, notes and target dates carry over unchanged.',
        ],
      },
      {
        date: 'October 12, 2026',
        title: 'Confirmed Quiz 2 coverage and Monday make-up',
        items: [
          'Quiz 2 covers Chapter 3, Sections 3.1–3.5, in the second hour of the lab. The October 8 announcement confirms Monday sections write October 19; other sections follow their October 13–16 lab.',
          'Updated quiz and calendar dates. Check D2L for any subsequent changes.',
        ],
      },
      {
        date: 'October 12, 2026',
        title: 'Subject headers and privacy',
        items: [
          'New moving subject artwork: Engineering gears, Calculus curves and a matrix-transformed sphere for Linear Algebra. Drag to rotate; pause at any time.',
          'New folded-page logo, responsive artwork framing and fallback images. Course colours and saved progress are preserved.',
          'Fonts now load locally. Removed analytics code and course-only staff names; current contacts are on D2L. Added a Privacy page.',
        ],
      },
      {
        date: 'October 11, 2026',
        title: 'Larger scenes, connected motion',
        items: [
          'Full-width circuit, calculus ribbon and transformation lattice. Pause motion from the header.',
          'Animated assignments, search, tools, study panels and completion. Guide tools are beside Search.',
        ],
      },
      {
        date: 'October 11, 2026',
        title: 'Course headers in motion',
        items: [
          'Dimensional circuit, calculus and linear algebra illustrations, with smooth course transitions. Motion respects device settings and settles after a short demonstration.',
          'The existing course colours, content and saved progress stay the same.',
        ],
      },
      {
        date: 'October 11, 2026',
        title: 'An organised course workspace',
        items: [
          'Assignments open first. Study and Course info have their own navigation, with compact tabs on phones.',
          'Original course colours, interactive maths, assignment details and saved progress are preserved. Past assignments remain available; calendar exports, contacts and grading are in Course info.',
        ],
      },
      {
        date: 'October 11, 2026',
        title: 'A new visual identity',
        items: [
          'Larger course titles and mathematical header diagrams, a shared editorial layout, and direct tool shortcuts at the top.',
          'A dark interactive studio with clearer plots, followed by a quieter semester timeline and assessment list. Phone, tablet and desktop layouts share the same visual system.',
        ],
      },
      {
        date: 'October 11, 2026',
        title: 'Math, made visible',
        items: [
          'Tap equation terms to explore shifts and scaling. Default interactions use taps, with exact values available on demand.',
          'Find the first incorrect step in four worked examples per course, then see the correction and a visual explanation.',
        ],
      },
      {
        date: 'October 11, 2026',
        title: 'Interactive math labs',
        items: [
          'Switch between course experiments, try prediction questions, and expand the lab on a tablet. Open relevant labs from the Topic map.',
          'Guide tools are back at the top: grading, work planning, calendars and progress backups.',
        ],
      },
      {
        date: 'October 11, 2026',
        title: 'Visual tools',
        items: ['Tap a week on the semester timeline and open assessments in a detail sheet.', 'Explore a tangent or vector linear combination with interactive controls.'],
      },
      {
        date: 'October 9, 2026',
        title: 'Fewer taps',
        items: [
          "Visible search opens matching assessments and topics across tabs. This week's work, contacts and D2L are one tap away.",
          'Mark the next assessment done with Undo, using your existing completion record. Grading, calendars and backups are below the cards in Guide tools.',
        ],
      },
      {
        date: 'October 7, 2026',
        title: 'Easier to scan',
        items: [
          'Added coverage previews to closed assessment cards and visible arrows on upcoming assessments, with a View requirements cue on the next assessment.',
          'Refined text weights, borders, badges and spacing across all three courses. Card contents open with a gentle transition; reduced-motion preferences are respected.',
        ],
      },
      {
        date: 'October 7, 2026',
        title: 'Three-course guide',
        items: [
          'Added course switching between CEN100, MTH140 and MTH141, independent saved sections and progress, and shared Auto, Dark and Light appearance.',
          'Added all 34 Calculus I sections, with lab times, rooms, TAs and lecture instructors.',
          'Added four quiz weeks, the October 23 midterm, a pending final-exam card, grading weights of 15% / 40% / 45%, and the announced Quiz 1 coverage.',
          'Added eight outline topic blocks and all 37 recommended-practice rows, with skill-review checks and cyan curve/tangent visuals.',
          "Explained the conflicting FAQ quiz-drop wording. Quiz 2's Monday holiday was originally unresolved but is now confirmed for October 19; Quiz 3–4 coverage, midterm scope and final schedule remain pending.",
          'Added preparation checklists, separate completion records, private notes, study targets, direct assessment links, search, unfinished-work planning, calendar exports and course-specific progress backups.',
          'Published the three-course README and added these release notes with an unread-update badge. Checked phone, desktop and enlarged-text layouts, progress restoration, backups and calendars.',
        ],
      },
    ],
    footer: {
      companion: 'Unofficial TMU course companion · Fall 2026',
      privacy: 'Privacy',
      d2l: 'Check official updates on D2L',
    },
    noscriptIntro: "Published dates and quiz weeks are listed below. Check D2L for your section's lab day and time and any announcements. Progress and section tools require JavaScript.",
  },
  mth141: {
    title: 'MTH141: Linear Algebra | TMU Course Guides',
    description: 'MTH141 Fall 2026 at TMU: assessment dates, section labs, announced coverage, course rules and recommended practice.',
    skip: {
      label: 'Skip to course content',
      target: 'math-main',
    },
    eyebrowTerm: 'Fall 2026',
    section: {
      label: 'My section',
      placeholder: 'Choose section',
    },
    nextLabel: 'Upcoming assessments',
    afterHeading: 'After that',
    undo: 'Undo',
    find: {
      label: 'Search assessments and topics',
      placeholder: 'Try determinants or quiz',
      work: "This week's work",
      contacts: 'Contacts',
      d2l: 'D2L ↗',
      hideCompleted: 'Hide completed assessments',
    },
    tabs: [
      {
        id: 'assessments',
        label: 'Assessments',
      },
      {
        id: 'topics',
        label: 'Topic map',
      },
      {
        id: 'help',
        label: 'Rules & help',
      },
    ],
    assessmentsIntro: 'Dates, coverage and preparation in one place.',
    assessmentsEmpty: 'No assessments match these filters.',
    review: {
      label: 'My skill review',
      note: 'Self-reported checks. Topic order and approximate lecture hours follow the course outline; they do not estimate your personal study time.',
    },
    topicsEmpty: 'No topics match this search.',
    contact: {
      heading: 'Who to ask',
      coordinator: 'Course coordinator:',
      note: 'Check D2L for contact details and timetable updates. Your lecture and lab codes end in 1 and 2: for example, 241 and 242 both mean Section 24.',
      links: [
        {
          label: 'Open D2L',
          href: 'https://courses.torontomu.ca/',
        },
        {
          label: 'Learning support',
          href: 'https://www.torontomu.ca/student-life-and-learning/learning-support/',
        },
        {
          label: 'Academic consideration',
          href: 'https://www.torontomu.ca/senate/academic_consideration_requests/',
        },
      ],
    },
    textbooks: {
      heading: 'Free textbooks & practice',
      note: 'Use the Topic map for the exact exercise references. This guide lists references and study prompts; the official course files remain on D2L.',
    },
    sources: {
      heading: 'Sources & date checks',
      note: 'Reviewed October 12, 2026. Course outlines and supplied D2L announcements provide the dates and rules. Newer official announcements take precedence.',
    },
    tools: {
      summary: 'Guide tools',
      note: 'Your choices and progress stay in this browser. There is no account or automatic device sync.',
    },
    grading: {
      summary: 'Course grading',
      heading: 'Course grading',
      pass: '50% overall to pass',
      labels: ['Lab quizzes', 'Midterm test', 'Final exam'],
    },
    work: {
      summary: 'What should I work on?',
      label: 'Unrecorded assessments and my study targets',
      options: [
        {
          value: 'week',
          label: 'Next 7 days',
        },
        {
          value: 'all',
          label: 'All unfinished',
        },
      ],
      notes: ['Uses your completion records and personal target dates. Preparation checklists are tracked separately.'],
    },
    calendar: {
      summary: 'Add assessments to my calendar',
      upcoming: 'Upcoming dates only',
      labs: 'Include lab dates from my section timetable',
      notes: [
        'The midterm uses its published Toronto time. Lab quizzes export as tentative all-day events because the quiz start time is not confirmed. Choose a section to include them. The unscheduled final is excluded.',
      ],
      download: 'Download calendar (.ics)',
    },
    backup: {
      summary: 'Move or back up my progress',
      notes: [
        'Includes this course’s preparation checks, assessment completion, topic skill checks, notes and study targets. Import adds progress and fills empty notes and targets; existing conflicting entries stay as they are.',
      ],
      export: 'Export my progress',
      importLabel: 'Import a MTH141 backup',
    },
    updatesSummary: "What's changed?",
    updatesBadge: 'New updates',
    updates: [
      {
        date: 'October 16, 2026',
        title: 'Course artwork and signal field',
        text: 'New artwork keeps the same layout, moving windows and course tools.',
        items: [
          'The home windows now reveal a charcoal signal field with light points and travelling orange pulses.',
          'Course images now reflect the subjects: a steel bridge mechanism for Introduction to Engineering, a worked integral for Calculus I, and linear equations for Linear Algebra.',
          'Next Up and the course windows reveal the photographs from pixels to a sharp image. Pause motion and reduced motion show the finished images immediately.',
          'Your course dates, sections, checklists, completion records, notes and target dates are unchanged.',
        ],
      },
      {
        date: 'October 15, 2026',
        title: 'New website design',
        text: 'The guides have a new design, with full-screen 3D sections, page transitions and smooth scrolling.',
        items: [
          'The Desk shows your next deadline across all courses with a live countdown, Mark done and Undo, and a card for each course.',
          'Each guide opens with your next deadline, then lists deadlines under This week, Next week and Later, followed by the weekly checklist, assessments and course information.',
          'Search is in the top bar on larger screens and in the menu on phones. Ctrl K or ⌘ K still opens it from a keyboard.',
          'Pause motion is in the menu, and your device’s reduced-motion setting is respected. The new design uses a light appearance only.',
          'Your saved sections, ticks, completion records, notes and target dates carry over unchanged.',
        ],
      },
      {
        date: 'October 12, 2026',
        title: 'Midterm scope and public privacy',
        items: ['The exact midterm topic coverage, published date and time remain available. Question-type breakdowns and format details are left to D2L.'],
      },
      {
        date: 'October 12, 2026',
        title: 'Subject headers and privacy',
        items: [
          'New moving subject artwork: Engineering gears, Calculus curves and a matrix-transformed sphere for Linear Algebra. Drag to rotate; pause at any time.',
          'New folded-page logo, responsive artwork framing and fallback images. Course colours and saved progress are preserved.',
          'Fonts now load locally. Removed analytics code and course-only staff names; current contacts are on D2L. Added a Privacy page.',
        ],
      },
      {
        date: 'October 11, 2026',
        title: 'Larger scenes, connected motion',
        items: [
          'Full-width circuit, calculus ribbon and transformation lattice. Pause motion from the header.',
          'Animated assignments, search, tools, study panels and completion. Guide tools are beside Search.',
        ],
      },
      {
        date: 'October 11, 2026',
        title: 'Course headers in motion',
        items: [
          'Dimensional circuit, calculus and linear algebra illustrations, with smooth course transitions. Motion respects device settings and settles after a short demonstration.',
          'The existing course colours, content and saved progress stay the same.',
        ],
      },
      {
        date: 'October 11, 2026',
        title: 'An organised course workspace',
        items: [
          'Assignments open first. Study and Course info have their own navigation, with compact tabs on phones.',
          'Original course colours, interactive maths, assignment details and saved progress are preserved. Past assignments remain available; calendar exports, contacts and grading are in Course info.',
        ],
      },
      {
        date: 'October 11, 2026',
        title: 'A new visual identity',
        items: [
          'Larger course titles and mathematical header diagrams, a shared editorial layout, and direct tool shortcuts at the top.',
          'A dark interactive studio with clearer plots, followed by a quieter semester timeline and assessment list. Phone, tablet and desktop layouts share the same visual system.',
        ],
      },
      {
        date: 'October 11, 2026',
        title: 'Math, made visible',
        items: [
          'Build two matrix transformations, reverse their order and compare the results. Default interactions use taps, with exact values available on demand.',
          'Find the first incorrect step in four worked examples per course, then see the correction and a visual explanation.',
        ],
      },
      {
        date: 'October 11, 2026',
        title: 'Interactive math labs',
        items: [
          'Switch between course experiments, try prediction questions, and expand the lab on a tablet. Open relevant labs from the Topic map.',
          'Guide tools are back at the top: grading, work planning, calendars and progress backups.',
        ],
      },
      {
        date: 'October 11, 2026',
        title: 'Visual tools',
        items: ['Tap a week on the semester timeline and open assessments in a detail sheet.', 'Explore a tangent or vector linear combination with interactive controls.'],
      },
      {
        date: 'October 9, 2026',
        title: 'Fewer taps',
        items: [
          "Visible search opens matching assessments and topics across tabs. This week's work, contacts and D2L are one tap away.",
          'Mark the next assessment done with Undo, using your existing completion record. Grading, calendars and backups are below the cards in Guide tools.',
        ],
      },
      {
        date: 'October 7, 2026',
        title: 'Easier to scan',
        items: [
          'Added coverage previews to closed assessment cards and visible arrows on upcoming assessments, with a View requirements cue on the next assessment.',
          'Refined text weights, borders, badges and spacing across all three courses. Card contents open with a gentle transition; reduced-motion preferences are respected.',
        ],
      },
      {
        date: 'October 7, 2026',
        title: 'Three-course guide',
        items: [
          'Added course switching between CEN100, MTH140 and MTH141, independent saved sections and progress, and shared Auto, Dark and Light appearance.',
          'Added all 34 Linear Algebra sections, with lab times, rooms, Academic Assistants and lecture instructors.',
          'Added five quiz weeks, the October 16 midterm, a pending final-exam card, grading weights of 20% / 35% / 45%, and announced Quiz 1, Quiz 2 and midterm coverage.',
          'Added midterm coverage and preparation guidance, eight outline topic blocks and all 40 recommended-practice rows, with skill-review checks and violet vector-transformation visuals.',
          'Explained the textbook-edition mismatch and the V3 Thanksgiving-week teaching schedule. Later quiz coverage, the midterm room and the final schedule remain pending.',
          'Added preparation checklists, separate completion records, private notes, study targets, direct assessment links, search, unfinished-work planning, calendar exports and course-specific progress backups.',
          'Published the three-course README and added these release notes with an unread-update badge. Checked phone, desktop and enlarged-text layouts, progress restoration, backups and calendars.',
        ],
      },
    ],
    footer: {
      companion: 'Unofficial TMU course companion · Fall 2026',
      privacy: 'Privacy',
      d2l: 'Check official updates on D2L',
    },
    noscriptIntro: "Published dates and quiz weeks are listed below. Check D2L for your section's lab day and time and any announcements. Progress and section tools require JavaScript.",
  },
};

export const PRIVACY = {
  back: '← Course guides',
  heading: 'Privacy',
  paragraphs: [
    {
      text: 'No site analytics, tracking cookies or session recording. Fonts, scripts and artwork load from this site.',
    },
    {
      text: 'Your section, group, notes and progress stay in your browser. Exporting a backup creates a local file containing your notes and progress; keep it private. Clearing browser data can erase saved records.',
    },
    {
      text: 'Staff names and contact details from course-only documents are omitted. Check D2L for current contacts.',
    },
    {
      text: 'GitHub hosts this site and logs visitor IP addresses for security.',
      link: {
        label: 'GitHub’s hosting information',
        href: 'https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection',
      },
      after: '.',
    },
  ],
  updated: 'Updated October 12, 2026.',
};
