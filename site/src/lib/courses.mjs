/* The five courses: identity, palette, links and the saved CEN100 project group. */
import { DATA } from './data.mjs';
import { SCHEDULE } from './vendor/cen-schedule.mjs';
import * as CEN from './content/cen.mjs';
import { DESK, CEN as CEN_PAGE, MATH as OLD_MATH_PAGE } from './content/pages.mjs';
import { DESK_COURSES, PAGES as SCIENCE_PAGES } from './content/science.mjs';
import { resolveStorage } from './storage.mjs';
import { isMath, readProfile, writeProfile } from './saved.mjs';
import { TOKENS } from './palette.mjs';

export const COURSE_IDS = ['cen100', 'mth140', 'mth141', 'chy102', 'pcs211'];
/** The math-style page copy: the old site's MTH140/MTH141 pages and the CHY102/PCS211 pages written here. */
export const MATH_PAGE = { ...OLD_MATH_PAGE, ...SCIENCE_PAGES };

/** The site palette (lib/palette.mjs) in the original project's keys; `accent` is the one TMU Blue accent. */
export const DEFAULT_PALETTE = Object.freeze({
  primary: TOKENS.ink,
  accentColor: TOKENS.card,
  secondary: TOKENS.page,
  fillColor: TOKENS.card,
  menuColor: TOKENS.ink,
  menuFontColor: TOKENS.onDark,
  fluidColor: TOKENS.fluid,
  accent: TOKENS.accent,
});
/** One shared palette for every page, course card and generated 3D texture. */
export const PALETTES = Object.freeze(Object.fromEntries(COURSE_IDS.map((id) => [id, DEFAULT_PALETTE])));

const D2L = 'https://courses.torontomu.ca/';
const mathLinks = (id) => [...MATH_PAGE[id].contact.links.map((link) => ({ ...link, external: true })), ...DATA[id].textbooks.map((book) => ({ label: book.title, href: book.url, external: true }))];

export const COURSES = [...DESK.courses, ...DESK_COURSES].map((desk) => {
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
    hasSections: false,
    links: math ? mathLinks(desk.id) : [{ label: 'Open D2L', href: D2L, external: true }],
  };
});

/** The Desk's page text (the old Desk, generated in content/pages.mjs) with every course in its list and description. */
export const DESK_TEXT = { ...DESK, description: 'Fall 2026 guides for CEN100, MTH140, MTH141, CHY102 and PCS211 at TMU. Find deadlines, grading, assignment requirements and study topics.', courses: [...DESK.courses, ...DESK_COURSES] };

export const getCourse = (id) => COURSES.find((course) => course.id === id) || null;
/** The course record a resolver takes: CEN's SCHEDULE array or the math-style course record. */
export const dataFor = (courseId) => (courseId === 'cen100' ? SCHEDULE : DATA[courseId] || null);

/** Compatibility for callers of the former section picker. */
export const sections = () => [];
export const getSection = () => null;
export const setSection = () => false;

export const groups = () => CEN.contactLookup().groups;

/** CEN100 only: the saved group number, or null. */
export const getGroup = (courseId, storage) => (courseId === 'cen100' ? readProfile(resolveStorage(storage))?.group ?? null : null);
/** Save an Innovation Challenge group independently of the former class section. */
export function setGroup(courseId, value, storage) {
  if (courseId !== 'cen100') return false;
  return writeProfile(resolveStorage(storage), { group: value });
}
/** CEN100 only: the saved {group} profile, or null. */
export const getProfile = (storage) => readProfile(resolveStorage(storage));
