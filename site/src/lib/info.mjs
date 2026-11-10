/* courseInfo(): the rules, contacts, topic map, help text and notes each old course page showed, as plain data.
   Static apart from the section/group choice; no clock and no storage. */
import { fast } from './perf.mjs';
import { DATA, isScience } from './data.mjs';
import { scienceEvent, scienceTiming, scienceTile } from './science.mjs';
import { RULES as SCIENCE_RULES, NOTICES as SCIENCE_NOTICES } from './content/science.mjs';
import { resolveAssessment, timing } from './vendor/schedule.mjs';
import * as CEN from './content/cen.mjs';
import * as MATH from './content/math.mjs';
import { CEN as CEN_PAGE } from './content/pages.mjs';
import { COURSE_UPDATES } from './content/updates.mjs';
import { getCourse, sections, MATH_PAGE } from './courses.mjs';
import { isMath } from './saved.mjs';

const SEVERITY = { red: 'red', '': 'neutral' };

// Guide tools' "Course updates": this course's information changes, newest first (website changes are on /updates/).
const courseUpdates = (courseId, page) => ({ summary: 'Course updates', badge: page.updatesBadge, version: COURSE_UPDATES[courseId][0]?.id || '', entries: COURSE_UPDATES[courseId] });

function cenInfo({ section, group } = {}) {
  const profile = CEN.validProfile(section ? { section, group } : null);
  const texts = CEN.sectionContent(profile);
  const items = CEN.allItems.map((item) => {
    const [label, note] = CEN.sourceFor(item);
    const what = texts[item.id]?.what ?? item.what;
    const facts = item.facts.map(([icon, text], i) => ({ icon, text: item.id === 'y7' && i === 0 ? texts.y7.fact : text }));
    return {
      id: item.id,
      list: CEN.listOf(item),
      listLabel: CEN.COPY.tabs[CEN.listOf(item)],
      name: item.name,
      who: CEN.WHO[item.who][1],
      weightLabel: item.pct,
      date: item.date,
      tile: item.big ? { top: item.big, bottom: item.small } : null,
      preview: item.preview,
      what,
      facts,
      groups: item.groups.map(([heading, checks], gi) => ({ heading, checks: checks.map((text, i) => ({ id: `${item.id}-${gi}-${i}`, text })) })),
      traps: item.traps,
      source: { label, note, summary: CEN.COPY.sources + label },
      records: CEN.recordsFor(item).map((event) => ({ id: event.id, text: CEN.completionText(event) })),
      calendar: CEN.CALENDAR_DATES.some((event) => event.item === item.id),
      anchor: `assignment-${item.id}`,
    };
  });
  const contacts = CEN.contactLookup(profile?.section, profile?.group);
  return {
    courseId: 'cen100',
    code: 'CEN100',
    title: CEN_PAGE.heading,
    profile: { ...CEN.profileText(profile), value: profile },
    page: CEN_PAGE,
    leads: CEN_PAGE.leads,
    items,
    rules: CEN.RULES.map(([severity, icon, title, text]) => ({ severity: SEVERITY[severity] ?? severity, icon, title, text })),
    confirmed: CEN.CONFIRMED.map(([title, text]) => ({ title, text })),
    open: CEN.OPEN.map(([title, text]) => ({ title, text })),
    openLead: CEN_PAGE.openLead,
    contacts: { ...contacts, heading: CEN_PAGE.rulesHeadings[2], note: CEN_PAGE.contactNote, change: CEN_PAGE.changeProfile },
    sections: sections('cen100'),
    grading: CEN_PAGE.grading,
    tools: { work: CEN_PAGE.work, calendar: { ...CEN_PAGE.calendar, items: CEN.calendarItems() }, backup: CEN_PAGE.backup, note: CEN_PAGE.tools.note, updated: CEN_PAGE.tools.updated },
    updates: courseUpdates('cen100', CEN_PAGE),
    footer: CEN_PAGE.footer,
  };
}

function mathInfo(courseId, { section } = {}) {
  const course = DATA[courseId];
  const page = MATH_PAGE[courseId];
  const chosen = course.labs.some((lab) => lab.section === Number(section)) ? Number(section) : 0;
  const text = MATH.sectionText(course, chosen);
  return {
    courseId,
    code: course.code,
    title: course.name,
    organization: course.organization,
    section: { ...text, value: chosen || null },
    sections: sections(courseId),
    page,
    assessments: course.assessments.map((a) => {
      const e = resolveAssessment(course, a, chosen);
      return {
        id: a.id,
        title: a.title,
        kind: a.kind,
        scope: a.scope,
        source: a.source,
        confirmed: !!a.confirmed,
        weightLabel: MATH.weight(a, course),
        timing: timing(e),
        tile: MATH.dateTile(e),
        room: MATH.labLocation(a, e),
        dateNote: MATH.dateNote(a, e, courseId),
        ...MATH.assessmentCard(a, courseId),
        checklist: MATH.prep(a, courseId).map((stepText, i) => ({ id: `${a.id}-${i}`, text: stepText })),
        anchor: `assessment-${a.id}`,
      };
    }),
    topics: course.topics.map((t, index) => ({
      id: t.id,
      title: t.title,
      sections: t.sections,
      hours: t.hours,
      description: t.description,
      midterm: !!t.midterm,
      skills: t.skills.map((skill, i) => ({ id: `${t.id}-${i}`, text: skill })),
      ...MATH.topicCard(t, index, course, courseId),
      anchor: `topic-${t.id}`,
    })),
    review: page.review,
    rules: MATH.ruleCards(course, courseId),
    notice: MATH.courseNotice(courseId),
    contacts: { heading: page.contact.heading, coordinatorLabel: page.contact.coordinator, coordinator: course.coordinator, note: page.contact.note, links: page.contact.links, section: text.contacts, prompt: text.contactsPrompt },
    textbooks: { ...page.textbooks, books: course.textbooks },
    sources: { ...page.sources, entries: course.sources },
    grading: { ...page.grading, weights: course.weights, quizPolicy: course.quizPolicy },
    tools: { work: page.work, calendar: page.calendar, backup: page.backup, note: page.tools.note },
    updates: courseUpdates(courseId, page),
    footer: page.footer,
  };
}

/* CHY102 / PCS211 card wording by kind: where the work is handed in or written, and what kind of assessment it is. */
const KIND = {
  homework: { roomLabel: 'Submit in', room: 'Mastering Chemistry', category: 'Online homework' },
  wrapper: { roomLabel: 'Submit in', room: 'Google Form on D2L', category: 'Reflection assignment' },
  webassign: { roomLabel: 'Submit in', room: 'WebAssign', category: 'Online assignments' },
  lab: { roomLabel: 'Room', room: 'Your session’s room on D2L', category: 'Lab · 2 hours, normally in pairs' },
  tutorial: { roomLabel: 'Room', room: 'Your session’s room on D2L', category: 'Tutorial · 2 hours' },
  midterm: { roomLabel: 'Test room', room: 'Check D2L', category: 'Midterm' },
  final: { roomLabel: 'Exam room', room: 'Check the exam schedule', category: 'Final exam' },
  task: { roomLabel: 'Where', room: 'D2L', category: 'Course task' },
};
const OUTLINE_PAGES = { chy102: 'pp. 5–7', pcs211: 'pp. 5–6' };

function scienceContacts(course) {
  const people = course.instructors.map((person) => ({ heading: `${person.name} · ${person.role}`, text: `${person.email} · ${person.hours}`, href: `mailto:${person.email}` }));
  const sessions = course.sections ? course.sections.map((row) => ({ heading: `Section ${row.section}`, text: `${row.times} · ${row.room} · ${row.instructor}` })) : [{ heading: 'Lectures', text: course.lectures }];
  const help = course.code === 'CHY102' ? [{ heading: 'Mastering Chemistry questions', text: 'Your TA, during the resource-room hours posted on D2L' }] : [];
  return [...people, ...sessions, ...help];
}

function scienceInfo(courseId) {
  const course = DATA[courseId];
  const page = MATH_PAGE[courseId];
  const contacts = scienceContacts(course);
  return {
    courseId,
    code: course.code,
    title: course.name,
    organization: course.organization,
    section: {
      brief: null,
      briefPrompt: '',
      title: `${course.code}: ${course.name} | TMU Course Guides`,
      contacts,
      contactsPrompt: '',
      value: null,
      // No section picker: Course info lists the course's sessions instead.
      overview: course.sections ? course.sections.map((row) => `Section ${row.section} · ${row.times} · ${row.room}`) : [`Lectures · ${course.lectures}`],
    },
    sections: [],
    page,
    assessments: course.assessments.map((a) => {
      const e = scienceEvent(a);
      const kind = KIND[a.kind] || KIND.task;
      return {
        id: a.id,
        title: a.title,
        kind: a.kind,
        scope: a.scope,
        source: a.source,
        confirmed: !!a.confirmed,
        weightLabel: a.weightLabel,
        timing: scienceTiming(e),
        tile: scienceTile(e),
        room: kind.room,
        dateNote: a.dateNote || '',
        ...MATH.assessmentCard(a, courseId),
        roomLabel: kind.roomLabel,
        // "Before you write" belongs to a test; handed-in work and sessions get their own heading.
        rulesHeading: { homework: 'Before you submit', wrapper: 'Before you submit', webassign: 'Before you submit', task: 'Good to know', lab: 'Before your session', tutorial: 'Before your session' }[a.kind] || 'Before you write',
        categoryLabel: 'Assessment',
        category: a.duration ? `${kind.category} · ${a.duration}` : kind.category,
        rules: a.rules,
        roomNote: a.kind === 'midterm' ? 'Room assignments and any later instructions are posted on D2L.' : '',
        checklist: a.prep.map((stepText, i) => ({ id: `${a.id}-${i}`, text: stepText })),
        anchor: `assessment-${a.id}`,
      };
    }),
    topics: course.topics.map((t, index) => ({
      id: t.id,
      title: t.title,
      sections: t.sections,
      hours: null,
      description: t.description,
      skills: t.skills.map((skill, i) => ({ id: `${t.id}-${i}`, text: skill })),
      index: String(index + 1).padStart(2, '0'),
      sub: `${t.sections} · Week ${t.week}`,
      midterm: t.exam ? `On ${t.exam}` : '',
      skillsHeading: 'My skill review',
      practiceHeading: 'Practice',
      practiceNote: course.practiceNote,
      practice: [],
      source: `Topic order, weeks and ${courseId === 'chy102' ? 'chapters' : 'sections'}: ${course.code} course outline, ${OUTLINE_PAGES[courseId]}. Skill checklists are this guide’s study prompts, not an official marking rubric.`,
      anchor: `topic-${t.id}`,
    })),
    review: page.review,
    rules: SCIENCE_RULES[courseId],
    notice: SCIENCE_NOTICES[courseId],
    contacts: { heading: page.contact.heading, coordinatorLabel: page.contact.coordinator, coordinator: course.coordinator, note: page.contact.note, links: page.contact.links, section: contacts, prompt: '' },
    textbooks: { ...page.textbooks, books: course.textbooks },
    sources: { ...page.sources, entries: course.sources },
    grading: { ...page.grading, pass: course.grades.pass, weights: course.grades.variants[0].categories.map((c) => c.weight), quizPolicy: course.quizPolicy, note: course.grades.note },
    tools: { work: page.work, calendar: page.calendar, backup: page.backup, note: page.tools.note },
    updates: courseUpdates(courseId, page),
    footer: page.footer,
  };
}

/** The old page's static guidance for a course, with section-dependent text resolved for `section` (and CEN `group`).
    Plain JSON data (safe to pass through getStaticProps). */
function courseInfoNow(courseId, options = {}) {
  if (!getCourse(courseId)) return null;
  if (isScience(courseId)) return scienceInfo(courseId);
  return isMath(courseId) ? mathInfo(courseId, options) : cenInfo(options);
}

/** The old pages' interface strings for a course, including the ones that take values (functions), e.g.
    courseCopy('cen100').filterStatus(3), courseCopy('mth140').counts.prepared(2, 5). Not JSON: use it in components. */
export function courseCopy(courseId) {
  if (!getCourse(courseId)) return null;
  return isMath(courseId) ? { next: MATH.NEXT, counts: MATH.COUNTS, search: MATH.SEARCH, work: MATH.WORK, ...MATH.COPY } : CEN.COPY;
}

// Public entry points run with cached Toronto-time formatting (see perf.mjs).
export const courseInfo = fast(courseInfoNow);
