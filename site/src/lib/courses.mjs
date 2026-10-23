/* The three courses: identity, palette, links, sections and the saved section/group. */
import { COURSES as DATA } from './vendor/course-data.mjs';
import { SCHEDULE } from './vendor/cen-schedule.mjs';
import * as CEN from './content/cen.mjs';
import * as MATH from './content/math.mjs';
import { DESK, CEN as CEN_PAGE, MATH as MATH_PAGE } from './content/pages.mjs';
import { resolveStorage } from './storage.mjs';
import { isMath, readProfile, writeProfile, readMathSection, writeMathSection } from './saved.mjs';

export const COURSE_IDS = ['cen100', 'mth140', 'mth141'];

/** The Desk palette, including Giats's original homepage fluid tint. */
export const DEFAULT_PALETTE = Object.freeze({ primary: '#28282b', accentColor: '#f9f9f9', secondary: '#f0f4f1', fillColor: '#f2ffbd', menuColor: '#28282b', menuFontColor: '#f0f4f1', fluidColor: '#d7d7d4' });
/** One shared palette for every page, course card and generated 3D texture. */
export const PALETTES = Object.freeze(Object.fromEntries(COURSE_IDS.map((id) => [id, DEFAULT_PALETTE])));

const D2L = 'https://courses.torontomu.ca/';
const mathLinks = (id) => [...MATH_PAGE[id].contact.links.map((link) => ({ ...link, external: true })), ...DATA[id].textbooks.map((book) => ({ label: book.title, href: book.url, external: true }))];

export const COURSES = DESK.courses.map((desk) => {
  const math = isMath(desk.id);
  const page = math ? MATH_PAGE[desk.id] : CEN_PAGE;
  return {
    id: desk.id,
    code: desk.code,
    name: desk.name,
    title: math ? DATA[desk.id].name : CEN_PAGE.heading,
    index: desk.index,
    summary: desk.summary,
    description: page.description,
    term: math ? DATA[desk.id].term : 'Fall 2026',
    organization: math ? DATA[desk.id].organization : null,
    href: `/${desk.id}/`,
    ariaLabel: desk.ariaLabel,
    palette: PALETTES[desk.id],
    links: math ? mathLinks(desk.id) : [{ label: 'Open D2L', href: D2L, external: true }],
  };
});

export const getCourse = (id) => COURSES.find((course) => course.id === id) || null;
/** The course records the vendored resolvers take: CEN's SCHEDULE array or COURSES[mth14x]. */
export const dataFor = (courseId) => (courseId === 'cen100' ? SCHEDULE : DATA[courseId] || null);

/** Section choices, in the old select's order. CEN: "Section 1".."Section 39"; math: "Section 24 (241 / 242)". */
export function sections(courseId) {
  if (courseId === 'cen100') {
    return CEN.STAFFING.flatMap((staff) => staff.sections.map((section) => ({ value: section, label: `Section ${section}`, detail: `Lab: ${staff.location}` }))).sort((a, b) => a.value - b.value);
  }
  if (!isMath(courseId)) return [];
  return DATA[courseId].labs.map((lab) => ({ value: lab.section, label: MATH.sectionOption(lab), detail: MATH.labSummary(lab) }));
}

/** CEN100 Innovation Challenge groups for a section ("Group 9"), [] without a valid section. */
export const groups = (section) => CEN.contactLookup(section, null).groups;

/** The saved section number, or null when none is saved (or storage is empty, blocked or holds a stale value). */
export function getSection(courseId, storage) {
  const store = resolveStorage(storage);
  if (courseId === 'cen100') return readProfile(store)?.section ?? null;
  if (!isMath(courseId)) return null;
  return readMathSection(courseId, store) || null;
}

/**
 * Save a section (null / 0 / '' clears it). Writes the old formats: CEN {"section":n,"group":null} (choosing a
 * section resets the group, as the old select did; the same section keeps it) or null; math the number, 0 when
 * cleared. Returns true when storage accepted the write.
 */
export function setSection(courseId, value, storage) {
  const store = resolveStorage(storage);
  const section = Number(value) || 0;
  if (courseId === 'cen100') {
    const current = readProfile(store);
    // The old select fired no change for the same value, so nothing is written.
    if (current && current.section === section) return true;
    return writeProfile(store, section ? { section, group: null } : null);
  }
  if (!isMath(courseId)) return false;
  return writeMathSection(courseId, store, DATA[courseId].labs.some((lab) => lab.section === section) ? section : 0);
}

/** CEN100 only: the saved group number, or null. */
export const getGroup = (courseId, storage) => (courseId === 'cen100' ? readProfile(resolveStorage(storage))?.group ?? null : null);
/** CEN100 only: save a group for the saved section ({"section":n,"group":g}); an invalid group saves null. */
export function setGroup(courseId, value, storage) {
  if (courseId !== 'cen100') return false;
  const store = resolveStorage(storage);
  const profile = readProfile(store);
  if (!profile) return false;
  return writeProfile(store, { section: profile.section, group: value });
}
/** CEN100 only: the saved {section, group} profile, or null. */
export const getProfile = (storage) => readProfile(resolveStorage(storage));
