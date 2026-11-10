/* The two update lists. Newest first; each id starts with the entry's ISO date.

   COURSE_UPDATES: changes to a course's information (dates, coverage, policy, grading). Shown under
   "Course updates" in that course's Guide tools; a new entry raises the unread badge (lib/tools.mjs).
   WEBSITE_UPDATES: changes to the website itself, for every course unless `courses` names some. Shown on the
   Website updates page (/updates/); they never raise the badge.

   Add new entries at the top of the right list with today's date. */
export const COURSE_UPDATES = {
 "cen100": [
  {
   "id": "2026-10-23-cen100-source-review",
   "date": "October 23, 2026",
   "title": "FMEA deadline and assignment requirements updated",
   "text": "Reviewed the outline, supplied assignments, lecture slides, FMEA workbook and course-team updates.",
   "items": [
    "Failure Analysis Part 1 (2%) stays on Oct 21; Part 2/FMEA (4%) is due Oct 28 under the Oct 13 update. Each now has its own submission record. Earlier Failure Analysis completion is kept for Part 1; record Part 2 separately.",
    "FMEA: at least 10 failure modes, top-five priority risks and Change/Test/Verify/Monitor actions. The environmental category means real-world conditions. Fishbone instructions conflict between the handout and lecture; confirm with your GA before omitting it.",
    "Added confirmed 3 PM times for the Personal Introduction, Professional Email and MATLAB Assignment 1. Corrected professional-email submission to the PM and retained reflection submission by PM email.",
    "Corrected the prototype to a single graded deliverable alongside presentations, removed its unsupported 3 PM deadline, and clarified GA-assigned presentation slots. Final Report guidance now includes IEEE/APA, page-count exclusions and .mlx/.m submission. Grade weights are unchanged. Exact final-exam details and unposted submission times remain pending."
   ]
  },
  {
   "id": "2026-09-30-grading-by-working-arrangement",
   "date": "September 30, 2026",
   "title": "Grading by working arrangement",
   "text": "Clarified grading by working arrangement: the official project category is 41%; shared project deliverables M1–M7 are 38%; adding the notebook gives 42% full/sub-team work; adding MATLAB gives 52% team/pair work, with 48% individual. Renamed the Individual tab to Individual + pairs in the guide and colour preview, and updated the README. All 20 assessment weights remain unchanged.",
   "items": []
  },
  {
   "id": "2026-09-29-all-20-graded-items",
   "date": "September 29, 2026",
   "title": "All 20 graded items",
   "text": "Added all 20 graded items under Guide tools, totalling 100%. Clarified that Innovation Challenge milestones M1–M8 total 41%, including peer evaluation; notebook and reflection marks are separate.",
   "items": []
  },
  {
   "id": "2026-09-25-reflections-and-matlab-groups-confirmed",
   "date": "September 25, 2026",
   "title": "Reflections and MATLAB groups confirmed",
   "text": "Confirmed reflection submissions by email to the assigned PM and the MATLAB group-size exception. The FMEA Environmental clarification remains pending.",
   "items": []
  },
  {
   "id": "2026-09-24-whmis-and-academic-integrity-deadlines",
   "date": "September 24, 2026",
   "title": "WHMIS and Academic Integrity deadlines",
   "text": "Confirmed the Oct 14 WHMIS deadline and certificate requirements, plus the Oct 14, 3 PM Academic Integrity Quiz deadline and attempt limit.",
   "items": []
  }
 ],
 "mth140": [
  {
    "id": "2026-10-23-mth140-midterm-scope-and-format",
    "date": "October 23, 2026",
    "title": "Midterm coverage and marking confirmed",
    "text": "Updated from the October 13 Midterm Exam Content announcement.",
    "items": [
      "The October 23 midterm runs 6:30–8:30 PM Toronto time and is worth 40%. It covers Sections 1.1–1.5, 2.1–2.4 and 3.1–3.6, including 3.3–3.4. Antiderivatives and integration are outside the announced scope.",
      "Questions 1–10 are multiple choice worth 5 marks each: the correct choice must agree with a correct written solution, with no partial credit. Questions 11–13 are long answer with working required for partial or full credit.",
      "Marked the three covered topic groups in Study, refreshed the preparation checklist and removed the outdated scope-pending notice. Quiz 2 is one question from Sections 3.1–3.5.",
      "Reviewed the course weights, quiz weeks, quiz-drop rule and all 37 recommended exercise lists. Quiz 3–4 scope, the final schedule and room notices still require D2L confirmation."
    ]
  },
  {
   "id": "2026-10-12-confirmed-quiz-2-coverage-and-monday-make-up",
   "date": "October 12, 2026",
   "title": "Confirmed Quiz 2 coverage and Monday make-up",
   "text": "",
   "items": [
    "Quiz 2 covers Chapter 3, Sections 3.1–3.5, in the second hour of the lab. The October 8 announcement confirms Monday sections write October 19; other sections follow their October 13–16 lab.",
    "Updated quiz and calendar dates. Check D2L for any subsequent changes."
   ]
  },
  {
   "id": "2026-10-07-three-course-guide",
   "date": "October 7, 2026",
   "title": "Three-course guide",
   "text": "",
   "items": [
    "Added course switching between CEN100, MTH140 and MTH141, independent saved sections and progress, and shared Auto, Dark and Light appearance.",
    "Added all 34 Calculus I sections, with lab times, rooms, TAs and lecture instructors.",
    "Added four quiz weeks, the October 23 midterm, a pending final-exam card, grading weights of 15% / 40% / 45%, and the announced Quiz 1 coverage.",
    "Added eight outline topic blocks and all 37 recommended-practice rows, with skill-review checks and cyan curve/tangent visuals.",
    "Explained the conflicting FAQ quiz-drop wording. Quiz 2's Monday holiday was originally unresolved but is now confirmed for October 19; Quiz 3–4 coverage, midterm scope and final schedule remain pending.",
    "Added preparation checklists, separate completion records, private notes, study targets, direct assessment links, search, unfinished-work planning, calendar exports and course-specific progress backups.",
    "Published the three-course README and added these release notes with an unread-update badge. Checked phone, desktop and enlarged-text layouts, progress restoration, backups and calendars."
   ]
  }
 ],
 "mth141": [
  {
   "id": "2026-10-23-mth141-source-review",
   "date": "October 23, 2026",
   "title": "MTH141 source review",
   "text": "Rechecked the V3 outline, FAQ, all 34 lab timetables and all 40 recommended-practice rows against the supplied files.",
   "items": [
     "Made the midterm exclusions explicit: section 3.1.4 and Chapter 4.",
     "Added Chapter 4 note and Lab 1–4 practice guidance, quiz timing and accommodation details, and term-test grade-return guidance.",
     "Updated the notice to the remaining quiz weeks and final exam. Later quiz scopes and the exact final schedule still need D2L announcements."
   ]
  },
  {
   "id": "2026-10-12-midterm-scope-and-public-privacy",
   "date": "October 12, 2026",
   "title": "Midterm scope and public privacy",
   "text": "",
   "items": [
    "The exact midterm topic coverage, published date and time remain available. Question-type breakdowns and format details are left to D2L."
   ]
  },
  {
   "id": "2026-10-07-three-course-guide",
   "date": "October 7, 2026",
   "title": "Three-course guide",
   "text": "",
   "items": [
    "Added course switching between CEN100, MTH140 and MTH141, independent saved sections and progress, and shared Auto, Dark and Light appearance.",
    "Added all 34 Linear Algebra sections, with lab times, rooms, Academic Assistants and lecture instructors.",
    "Added five quiz weeks, the October 16 midterm, a pending final-exam card, grading weights of 20% / 35% / 45%, and announced Quiz 1, Quiz 2 and midterm coverage.",
    "Added midterm coverage and preparation guidance, eight outline topic blocks and all 40 recommended-practice rows, with skill-review checks and violet vector-transformation visuals.",
    "Explained the textbook-edition mismatch and the V3 Thanksgiving-week teaching schedule. Later quiz coverage, the midterm room and the final schedule remain pending.",
    "Added preparation checklists, separate completion records, private notes, study targets, direct assessment links, search, unfinished-work planning, calendar exports and course-specific progress backups.",
    "Published the three-course README and added these release notes with an unread-update badge. Checked phone, desktop and enlarged-text layouts, progress restoration, backups and calendars."
   ]
  }
 ],
 "chy102": [
  {
   "id": "2026-11-10-chy102-guide",
   "date": "November 10, 2026",
   "title": "CHY102 guide added",
   "text": "Written from the Fall 2026 course outline (all 21 pages).",
   "items": [
    "All 11 graded Mastering Chemistry homework deadlines (Mondays, 11:59 PM), the optional Homework 12, both midterms and both exam wrappers.",
    "Both grading schemes, the best-10-of-11 homework rule and the iClicker participation scale.",
    "Sections, contacts, missed-assessment rules and the generative-AI policy. Midterm rooms, wrapper due days and the final schedule still need D2L announcements."
   ]
  }
 ],
 "pcs211": [
  {
   "id": "2026-11-10-pcs211-guide",
   "date": "November 10, 2026",
   "title": "PCS211 guide added",
   "text": "Written from the Fall 2026 course information and outline (all 11 pages).",
   "items": [
    "Five labs and five tutorials in their two-week windows, the October 30 midterm and the drop deadline. Your session's exact day and room are on D2L.",
    "Both evaluation options, applied automatically, and the THEORY and LABORATORY minimums.",
    "Exam rules, missed-work rules and the plagiarism and AI policy. Midterm coverage and the final schedule still need D2L announcements."
   ]
  }
 ]
};

export const WEBSITE_UPDATES = [
 {
  "id": "2026-11-10-chy102-pcs211",
  "date": "November 10, 2026",
  "title": "CHY102 and PCS211 guides",
  "text": "Two new course guides: CHY102 General Chemistry and PCS211 Physics: Mechanics. Each has Work, Schedule, Study, Grades and Course info, like the math guides, and their deadlines appear on the Desk and in Search. Neither needs a section: CHY102 lists its three sections in Course info, and PCS211's labs and tutorials show the two-week window your session falls in.",
  "items": [],
  "courses": ["chy102", "pcs211"]
 },
 {
  "id": "2026-11-08-dark-mode",
  "date": "November 8, 2026",
  "title": "Dark mode",
  "text": "The website now follows your device's light or dark setting. With dark mode on, the page turns near-black with light text, a lighter TMU Blue and brighter deadline colours; the menu, the footer and the moving artwork behind the page stay as they are. There is no separate switch: change your device's appearance setting and the page follows straight away.",
  "items": []
 },
 {
  "id": "2026-11-07-math-guides-end",
  "date": "November 7, 2026",
  "title": "No line at the end of the math guides",
  "text": "On iPhone and iPad, the end of the MTH140 and MTH141 guides no longer shows a thin dark line under the last of the page.",
  "items": []
 },
 {
  "id": "2026-11-06-safari-bar-edges",
  "date": "November 6, 2026",
  "title": "Smoother edges at Safari's toolbar",
  "text": "Two more fixes for iPhone and iPad.",
  "items": [
    "The end of the Desk, Courses, Privacy and Website updates now fades into the dark area under Safari's toolbar on iPhones too; the earlier fix could switch the fade off there.",
    "The trail your finger leaves on the page fades out before Safari's toolbar and status bar instead of stopping in a straight line."
  ]
 },
 {
  "id": "2026-11-05-safari-dark-end",
  "date": "November 5, 2026",
  "title": "No dark box rising under Safari's toolbar",
  "text": "On iPhone and iPad, scrolling to the end of the Desk, Courses, Privacy and Website updates no longer shows a flat dark box rising from the bottom of the screen under Safari's toolbar. The footer now fades smoothly into the dark colour Safari shows past the end of the page.",
  "items": []
 },
 {
  "id": "2026-11-05-menu-handoff",
  "date": "November 5, 2026",
  "title": "Smoother page changes from the Menu",
  "text": "Choosing a page in the Menu or Search no longer flashes grey and white. The links fade as you tap, and the new page grows smoothly out of the card the Menu made of the page, the way closing the Menu brings a page back. On Courses and the course pages, a course badge no longer shows a pale box first: its window stays dark until the badge drops in.",
  "items": []
 },
 {
  "id": "2026-11-04-course-at-a-glance",
  "date": "November 4, 2026",
  "title": "Your course at a glance",
  "text": "Each course page now shows how long is left until its next deadline, which term week it is, and the work coming up before anything past due.",
  "items": [
    "Next deadline shows the time left, such as 23h 47m left, or Today, Tomorrow or In 3 days.",
    "Work lists This week, Next week, Later, Past due and Done, in that order, and files each assignment by its next unfinished part.",
    "Mark done sits beside each record's date, and each lab quiz shows its lab room.",
    "Back returns you to the same place in Work.",
    "On the Desk, Next up names anything else due at the same time, and each Courses card says what is due next."
  ]
 },
 {
  "id": "2026-11-04-smooth-on-fast-screens",
  "date": "November 4, 2026",
  "title": "Smooth motion on 120 Hz screens",
  "text": "On screens that refresh 120 times a second or faster, the pointer trail, the dot field on the Desk, the course badges and touch scrolling now move at the screen's full rate and behave as they do on a 60 Hz screen. Before, the trail faded twice as fast, the badges swung back sooner and slow flicks stopped when the finger lifted. The badges also stay sharp instead of softening after a few seconds, and the pointer trail stops drawing once it has faded, which saves battery. Safari shows web pages at up to 60 frames per second unless its “Prefer Page Rendering Updates near 60fps” feature flag is turned off.",
  "items": []
 },
 {
  "id": "2026-11-04-opens-offline",
  "date": "November 4, 2026",
  "title": "Opens without a connection",
  "text": "After one visit, the Desk, Courses and all three guides open even with no signal, using the copy this browser saved. With a connection you always get the latest dates; the saved copy is used only when the network is unavailable.",
  "items": []
 },
 {
  "id": "2026-11-04-fixes",
  "date": "November 4, 2026",
  "title": "Fixes for deadlines, scrolling and backups",
  "text": "A few things that did not work as they should.",
  "items": [
    "A math lab quiz you have written no longer stays as the next deadline, marked Due time passed, until midnight. Two hours after your lab, the next item takes its place on the course page and on the Desk.",
    "The Privacy page could open with its text hidden. It now always shows.",
    "PageDown, the arrow keys, Home and End scroll the page again while a button or the Menu button has focus, for example right after closing the Menu.",
    "On wide screens, Back from an assignment returns to the same place in Schedule.",
    "In MTH140 and MTH141, Import a backup says plainly when a file is wrong or damaged, and Download calendar asks you to choose your section when only lab quizzes are left."
  ]
 },
 {
  "id": "2026-11-03-safari-bars",
  "date": "November 3, 2026",
  "title": "No dark boxes under Safari's bars",
  "text": "On iPhone and iPad, the end of each course page no longer shows a black box under Safari's toolbar, and the top of every page no longer shows one under the status bar. Opening and closing the Menu or Search no longer darkens the page under the bars while it still fills the screen: the area under them now follows the page as it shrinks and returns.",
  "items": []
 },
 {
  "id": "2026-11-03-menu-transition",
  "date": "November 3, 2026",
  "title": "Menu and Search open like the original design",
  "text": "On every screen, opening the Menu or Search now shrinks the page aside and dims it, the slowly moving light of the dark background fills the screen, and the links slide in. Closing plays it back. On phones the page used to stay put under a plain dark panel. Pause motion still opens and closes them at once.",
  "items": []
 },
 {
  "id": "2026-10-28-grade-calculator",
  "date": "October 28, 2026",
  "title": "Grade calculator",
  "text": "Each course has a new Grades tab with a grade calculator that uses the course's own weights. Enter a mark as a percentage or a score such as 17 out of 20 to see your current average and letter, what you have already secured and the best grade still possible.",
  "items": [
    "What do I need? shows, for every letter from A+ to D-, the average you need on everything still to be marked, and whether it is already secured or out of reach.",
    "MTH140 and MTH141 drop your lowest lab quiz, as the course policies state. Letters follow TMU's undergraduate scale, including its rounding to a whole percentage.",
    "Marks are saved in this browser only and are not part of progress backups."
  ]
 },
 {
  "id": "2026-10-24-smoother-page-changes",
  "date": "October 24, 2026",
  "title": "Smoother page changes",
  "text": "Changing pages on iPhone and iPad no longer shows the dark background. The page fades into the paper and the next one rises in, while the top bar stays put. Switching between courses is a quicker fade, and the card slide on computers is shorter. A tap or key press finishes a page change at once, and Pause motion still changes pages instantly.",
  "items": []
 },
 {
  "id": "2026-10-24-desk-button-label",
  "date": "October 24, 2026",
  "title": "Mark done button on the Desk",
  "text": "Screen readers now announce the Desk's Mark done button with the assessment's name instead of \"Mark undefined done\".",
  "items": []
 },
 {
  "id": "2026-10-24-opens-without-webgl",
  "date": "October 24, 2026",
  "title": "Opens in browsers without WebGL",
  "text": "The Desk and every other page now open when WebGL is turned off or unavailable, instead of showing an application error. The background's slow drift, the pointer effect and the pre-footer game are left out, and each course badge shows its card with the course code and name.",
  "items": []
 },
 {
  "id": "2026-10-23-all-courses-navigation",
  "date": "October 23, 2026",
  "title": "All courses opens at the top",
  "text": "The All courses button on the Desk opens the course list at the top, with the heading and first course visible.",
  "items": []
 },
 {
  "id": "2026-10-23-glass-controls",
  "date": "October 23, 2026",
  "title": "Glass controls",
  "text": "Course tabs, Menu, Search and Guide tools share a subtle glass finish. The selection follows your choice smoothly; assignment instructions and notes keep solid backgrounds.",
  "items": ["Pause motion also makes glass controls solid. Reduced transparency and increased contrast use solid controls where supported."]
 },
 {
  "id": "2026-10-23-shorter-course-pages",
  "date": "October 23, 2026",
  "title": "Shorter course pages",
  "text": "",
  "items": [
   "Each course opens on a compact Work list with Open, All and Done filters. Schedule, Course info and, for MTH140 and MTH141, Study have their own views.",
   "Every assignment opens on one full-width page, and Back returns to the same place in the list.",
   "Schedule shows an agenda on phones and a calendar on wider screens. Section, D2L and Guide tools stay near the top, and notes save as you type.",
   "Moving between views is smooth again.",
   "Your sections, ticks, completion records, notes and target dates are unchanged."
  ]
 },
 {
  "id": "2026-10-23-one-neutral-palette",
  "date": "October 23, 2026",
  "title": "One neutral palette",
  "text": "Every page, card and badge now uses one neutral palette with a TMU Blue accent. In Safari, the browser edges now match the page and the menus.",
  "items": []
 },
 {
  "id": "2026-10-21-new-design-at-the-main-address",
  "date": "October 21, 2026",
  "title": "New design at the main address",
  "text": "",
  "items": [
   "The new design now opens at the main address, and the previous version is no longer published.",
   "Links to the earlier /next/ preview and old CEN100 links still open the right page.",
   "Your saved progress carries over unchanged."
  ]
 },
 {
  "id": "2026-10-16-course-artwork-and-signal-field",
  "date": "October 16, 2026",
  "title": "Course artwork and signal field",
  "text": "New artwork keeps the same layout, moving windows and course tools.",
  "items": [
   "The home windows now reveal a charcoal signal field with light points and travelling orange pulses.",
   "Course images now reflect the subjects: a steel bridge mechanism for Introduction to Engineering, a worked integral for Calculus I, and linear equations for Linear Algebra.",
   "Next Up and the course windows reveal the photographs from pixels to a sharp image. Pause motion and reduced motion show the finished images immediately.",
   "Your course dates, sections, checklists, completion records, notes and target dates are unchanged."
  ]
 },
 {
  "id": "2026-10-15-new-website-design",
  "date": "October 15, 2026",
  "title": "New website design",
  "text": "The guides have a new design, with full-screen 3D sections, page transitions and smooth scrolling.",
  "items": [
   "The Desk shows your next deadline across all courses with a live countdown, Mark done and Undo, and a card for each course.",
   "Each guide opens with your next deadline, then lists deadlines under This week, Next week and Later, followed by the weekly checklist, assessments and course information.",
   "Search is in the top bar on larger screens and in the menu on phones. Ctrl K or ⌘ K still opens it from a keyboard.",
   "Pause motion is in the menu, and your device’s reduced-motion setting is respected. The new design uses a light appearance only.",
   "Your saved sections, ticks, completion records, notes and target dates carry over unchanged."
  ]
 },
 {
  "id": "2026-10-12-subject-headers-and-privacy",
  "date": "October 12, 2026",
  "title": "Subject headers and privacy",
  "text": "",
  "items": [
   "New moving subject artwork: Engineering gears, Calculus curves and a matrix-transformed sphere for Linear Algebra. Drag to rotate; pause at any time.",
   "New folded-page logo, responsive artwork framing and fallback images. Course colours and saved progress are preserved.",
   "Fonts now load locally. Removed analytics code and course-only staff names; current contacts are on D2L. Added a Privacy page."
  ]
 },
 {
  "id": "2026-10-11-larger-scenes-connected-motion",
  "date": "October 11, 2026",
  "title": "Larger scenes, connected motion",
  "text": "",
  "items": [
   "Full-width circuit, calculus ribbon and transformation lattice. Pause motion from the header.",
   "Animated assignments, search, tools, study panels and completion. Guide tools are beside Search."
  ]
 },
 {
  "id": "2026-10-11-course-headers-in-motion",
  "date": "October 11, 2026",
  "title": "Course headers in motion",
  "text": "",
  "items": [
   "Dimensional circuit, calculus and linear algebra illustrations, with smooth course transitions. Motion respects device settings and settles after a short demonstration.",
   "The existing course colours, content and saved progress stay the same."
  ]
 },
 {
  "id": "2026-10-11-an-organised-course-workspace",
  "date": "October 11, 2026",
  "title": "An organised course workspace",
  "text": "",
  "items": [
   "Assignments open first. Study and Course info have their own navigation, with compact tabs on phones.",
   "Original course colours, interactive maths, assignment details and saved progress are preserved. Past assignments remain available; calendar exports, contacts and grading are in Course info."
  ]
 },
 {
  "id": "2026-10-11-a-new-course-guide-design",
  "date": "October 11, 2026",
  "title": "A new course guide design",
  "text": "",
  "items": [
   "Larger course titles, a shared layout across Engineering and both math courses, and a compact toolbar with direct search, calendar, grading and work shortcuts.",
   "Clearer deadline rows and a revised circuit header. All existing course information and saved progress remain available."
  ],
  "courses": [
   "cen100"
  ]
 },
 {
  "id": "2026-10-11-visual-tools-cen100",
  "date": "October 11, 2026",
  "title": "Visual tools",
  "text": "Added a semester timeline and assignment detail sheets. Completion records, checklists and notes use the same saved data. The circuit header follows your next unfinished deadline.",
  "items": [],
  "courses": [
   "cen100"
  ]
 },
 {
  "id": "2026-10-11-a-new-visual-identity",
  "date": "October 11, 2026",
  "title": "A new visual identity",
  "text": "",
  "items": [
   "Larger course titles and mathematical header diagrams, a shared editorial layout, and direct tool shortcuts at the top.",
   "A dark interactive studio with clearer plots, followed by a quieter semester timeline and assessment list. Phone, tablet and desktop layouts share the same visual system."
  ],
  "courses": [
   "mth140",
   "mth141"
  ]
 },
 {
  "id": "2026-10-11-math-made-visible-mth140",
  "date": "October 11, 2026",
  "title": "Math, made visible",
  "text": "",
  "items": [
   "Tap equation terms to explore shifts and scaling. Default interactions use taps, with exact values available on demand.",
   "Find the first incorrect step in four worked examples per course, then see the correction and a visual explanation."
  ],
  "courses": [
   "mth140"
  ]
 },
 {
  "id": "2026-10-11-interactive-math-labs",
  "date": "October 11, 2026",
  "title": "Interactive math labs",
  "text": "",
  "items": [
   "Switch between course experiments, try prediction questions, and expand the lab on a tablet. Open relevant labs from the Topic map.",
   "Guide tools are back at the top: grading, work planning, calendars and progress backups."
  ],
  "courses": [
   "mth140",
   "mth141"
  ]
 },
 {
  "id": "2026-10-11-visual-tools-mth140-mth141",
  "date": "October 11, 2026",
  "title": "Visual tools",
  "text": "",
  "items": [
   "Tap a week on the semester timeline and open assessments in a detail sheet.",
   "Explore a tangent or vector linear combination with interactive controls."
  ],
  "courses": [
   "mth140",
   "mth141"
  ]
 },
 {
  "id": "2026-10-11-math-made-visible-mth141",
  "date": "October 11, 2026",
  "title": "Math, made visible",
  "text": "",
  "items": [
   "Build two matrix transformations, reverse their order and compare the results. Default interactions use taps, with exact values available on demand.",
   "Find the first incorrect step in four worked examples per course, then see the correction and a visual explanation."
  ],
  "courses": [
   "mth141"
  ]
 },
 {
  "id": "2026-10-09-fewer-taps-cen100",
  "date": "October 9, 2026",
  "title": "Fewer taps",
  "text": "Search, this week's work, contacts and D2L are now within easy reach. Mark the next deadline done directly, with Undo, using your existing completion records. Guide tools sit below the cards and tab introductions are shorter.",
  "items": [],
  "courses": [
   "cen100"
  ]
 },
 {
  "id": "2026-10-09-fewer-taps-mth140-mth141",
  "date": "October 9, 2026",
  "title": "Fewer taps",
  "text": "",
  "items": [
   "Visible search opens matching assessments and topics across tabs. This week's work, contacts and D2L are one tap away.",
   "Mark the next assessment done with Undo, using your existing completion record. Grading, calendars and backups are below the cards in Guide tools."
  ],
  "courses": [
   "mth140",
   "mth141"
  ]
 },
 {
  "id": "2026-10-07-easier-to-scan-cen100",
  "date": "October 7, 2026",
  "title": "Easier to scan",
  "text": "Added short requirement previews to closed assignment and math assessment cards, visible opening arrows on upcoming deadlines, and a View requirements cue on the next deadline. Refined text weights, badges, borders and spacing across all three courses, with gentle opening transitions that respect reduced motion.",
  "items": [],
  "courses": [
   "cen100"
  ]
 },
 {
  "id": "2026-10-07-three-course-guide-cen100",
  "date": "October 7, 2026",
  "title": "Three-course guide",
  "text": "Added MTH140: Calculus I and MTH141: Linear Algebra alongside CEN100.",
  "items": [
   "Switch courses in the shared header. Each course remembers its own section and progress; Auto, Dark and Light appearance is shared.",
   "Both math guides cover all 34 sections, with assigned lab times, rooms and staff. Assessment dashboards and grading bars replace the team/individual split.",
   "Added published quiz weeks and midterm dates, announced coverage, preparation checklists, completion records, notes, study targets, direct links, search, calendars and course-specific backups.",
   "Added 16 math topic blocks and 77 recommended-practice rows, with skill-review checks, textbook links and course rules. Calculus uses cyan curve/tangent graphics; Linear Algebra uses violet vector graphics.",
   "Quiz days derived from lab timetables are labelled. Thanksgiving arrangements, unannounced coverage and final dates remain pending; source conflicts and textbook-edition differences are explained.",
   "Expanded the README for all three courses and added What's changed with unread-update badges above both math footers. Checked phone, desktop and enlarged-text layouts, saved progress, backups and calendar exports."
  ],
  "after": "Existing CEN100 records, section/group choices and assignment links remain available.",
  "courses": [
   "cen100"
  ]
 },
 {
  "id": "2026-10-07-easier-to-scan-mth140-mth141",
  "date": "October 7, 2026",
  "title": "Easier to scan",
  "text": "",
  "items": [
   "Added coverage previews to closed assessment cards and visible arrows on upcoming assessments, with a View requirements cue on the next assessment.",
   "Refined text weights, borders, badges and spacing across all three courses. Card contents open with a gentle transition; reduced-motion preferences are respected."
  ],
  "courses": [
   "mth140",
   "mth141"
  ]
 },
 {
  "id": "2026-09-29-readme-and-change-history-updated",
  "date": "September 29, 2026",
  "title": "README and change history updated",
  "text": "Updated the README and change history to cover the latest grading, colour and analytics changes, including what is measured and what stays saved only in your browser.",
  "items": [],
  "courses": [
   "cen100"
  ]
 },
 {
  "id": "2026-09-29-usage-archive-verified",
  "date": "September 29, 2026",
  "title": "Usage archive verified",
  "text": "Verified the first scheduled daily usage archive. The maintainer can keep saved all-time, monthly and yearly totals from Sep 28, with downloadable backups and checks for missing data. These reports are private and contain no students’ saved course progress.",
  "items": [],
  "courses": [
   "cen100"
  ]
 },
 {
  "id": "2026-09-28-web-analytics-added",
  "date": "September 28, 2026",
  "title": "Web analytics added",
  "text": "Added Cloudflare Web Analytics for private usage and performance reporting. Page views and visits are not unique people. Cloudflare uses no analytics cookies or fingerprinting; your section/group, notes, targets, checklists and completion records are not sent to analytics.",
  "items": [],
  "courses": [
   "cen100"
  ]
 },
 {
  "id": "2026-09-28-yellow-still-open-icons-restored",
  "date": "September 28, 2026",
  "title": "Yellow Still open icons restored",
  "text": "Restored the original yellow for Still open icons on the Rules tab, independently of the rose accent elsewhere.",
  "items": [],
  "courses": [
   "cen100"
  ]
 },
 {
  "id": "2026-09-28-rose-accent",
  "date": "September 28, 2026",
  "title": "Rose accent",
  "text": "Applied the selected rose accent to deadlines and highlights, keeping the existing layout and automatic light/dark appearance.",
  "items": [],
  "courses": [
   "cen100"
  ]
 },
 {
  "id": "2026-09-28-colour-preview",
  "date": "September 28, 2026",
  "title": "Colour preview",
  "text": "Added a separate colour preview with eight accents, dark navy or light backgrounds, shareable colour selections and a reset option. Preview progress stays separate from the main guide.",
  "items": [],
  "courses": [
   "cen100"
  ]
 },
 {
  "id": "2026-09-28-whats-changed-moved",
  "date": "September 28, 2026",
  "title": "What's changed? moved",
  "text": "Moved What's changed and its unread-update badge to the bottom of the page, just above the footer.",
  "items": [],
  "courses": [
   "cen100"
  ]
 },
 {
  "id": "2026-09-26-tap-a-deadline-to-open-it",
  "date": "September 26, 2026",
  "title": "Tap a deadline to open it",
  "text": "Tap upcoming deadlines to open their assignment. Next up skips dates you have marked submitted/completed, and closed cards show your separate completion records.",
  "items": [],
  "courses": [
   "cen100"
  ]
 },
 {
  "id": "2026-09-26-lab-location-beside-your-section",
  "date": "September 26, 2026",
  "title": "Lab location beside your section",
  "text": "Your lab location now appears beside your section and group at the top of the guide and updates when you change sections.",
  "items": [],
  "courses": [
   "cen100"
  ]
 },
 {
  "id": "2026-09-26-unified-deadline-tracking",
  "date": "September 26, 2026",
  "title": "Unified deadline tracking",
  "text": "Unified deadline tracking, kept repeated deadlines active, clarified date-passed labels, and scoped tutorial times to confirmed sections.",
  "items": [],
  "courses": [
   "cen100"
  ]
 },
 {
  "id": "2026-09-26-planning-records-and-notes",
  "date": "September 26, 2026",
  "title": "Planning, records and notes",
  "text": "Added unfinished-work planning, separate submission/completion records, assignment links, private notes, personal target dates and an unread-update indicator. New backups include these records; older checklist backups still import.",
  "items": [],
  "courses": [
   "cen100"
  ]
 },
 {
  "id": "2026-09-26-footer-credit",
  "date": "September 26, 2026",
  "title": "Footer credit",
  "text": "Added creator and maintainer credit in the footer.",
  "items": [],
  "courses": [
   "cen100"
  ]
 },
 {
  "id": "2026-09-25-controls-fit-small-screens",
  "date": "September 25, 2026",
  "title": "Controls fit small screens",
  "text": "Kept added guide controls within their existing card widths on smaller screens.",
  "items": [],
  "courses": [
   "cen100"
  ]
 },
 {
  "id": "2026-09-25-section-and-group-at-the-top",
  "date": "September 25, 2026",
  "title": "Section and group at the top",
  "text": "Moved section/group selection to the top of the guide. Who to ask now shows the matching contact results, with a shortcut to change your selection.",
  "items": [],
  "courses": [
   "cen100"
  ]
 },
 {
  "id": "2026-09-25-heading-follows-your-section",
  "date": "September 25, 2026",
  "title": "Heading follows your section",
  "text": "The page heading now follows your selected section and group, with a neutral course label before selection.",
  "items": [],
  "courses": [
   "cen100"
  ]
 },
 {
  "id": "2026-09-25-remembered-choices-calendar-backups-and-search",
  "date": "September 25, 2026",
  "title": "Remembered choices, calendar, backups and search",
  "text": "Added remembered section/group choices, calendar export, checklist backups, search, source notes and the option to hide fully checked items. Removed the large attendance warning from Rules.",
  "items": [],
  "courses": [
   "cen100"
  ]
 },
 {
  "id": "2026-09-25-contact-lookup",
  "date": "September 25, 2026",
  "title": "Contact lookup",
  "text": "Added the contact lookup for all 39 sections and 52 groups, showing names and lab locations.",
  "items": [],
  "courses": [
   "cen100"
  ]
 },
 {
  "id": "2026-09-25-cards-by-working-arrangement",
  "date": "September 25, 2026",
  "title": "Cards by working arrangement",
  "text": "Organized assignment cards by working arrangement, with the shared notebook under Team and peer evaluation under Individual.",
  "items": [],
  "courses": [
   "cen100"
  ]
 }
];

