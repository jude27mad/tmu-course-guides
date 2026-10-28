/* The grade calculator: each course's graded components, the TMU undergraduate letter scale and the arithmetic
   behind Grades (secured points, highest possible grade, current average and the average needed for a grade).

   Weights come from assessments(), the same rows Course info → Grading shows, so the calculator can never
   disagree with the guide. Math lab quizzes drop the lowest mark (the courses' quiz policy); every other row
   counts once at its own weight.

   Marks are saved per course in this browser only, under `<course>-grades-v1`:
     {"marks":{"quiz-1":"17/20","midterm":"74.5"},"target":80}
   A mark is the text typed: "74.5" is a percentage, "17/20" a score out of a total. Nothing else reads or writes
   these keys, and they are not part of progress backups. Pure: no DOM or storage access at import. */
import { assessments } from './deadlines.mjs';
import { forget, onLocalChange, readJSON, resolveStorage, writeJSON, writeRaw } from './storage.mjs';

export const GRADE_KEYS = {
  cen100: 'cen100-grades-v1',
  mth140: 'mth140-grades-v1',
  mth141: 'mth141-grades-v1',
};

// TMU undergraduate grading scale (Senate Policy 170(a), formerly Policy 46; the 2026–2027 calendar's table).
// `min` is the lowest whole percentage for the letter. The final percentage is rounded to a whole number,
// half up, before it becomes a letter (Procedures 1.1: 49.5% → 50%, 49.4% → 49%).
export const GRADE_SCALE = [
  { letter: 'A+', min: 90, points: 4.33 },
  { letter: 'A', min: 85, points: 4.0 },
  { letter: 'A-', min: 80, points: 3.67 },
  { letter: 'B+', min: 77, points: 3.33 },
  { letter: 'B', min: 73, points: 3.0 },
  { letter: 'B-', min: 70, points: 2.67 },
  { letter: 'C+', min: 67, points: 2.33 },
  { letter: 'C', min: 63, points: 2.0 },
  { letter: 'C-', min: 60, points: 1.67 },
  { letter: 'D+', min: 57, points: 1.33 },
  { letter: 'D', min: 53, points: 1.0 },
  { letter: 'D-', min: 50, points: 0.67 },
  { letter: 'F', min: 0, points: 0 },
];
export const PASS_MARK = 50;
const TARGETS = new Set(GRADE_SCALE.filter((row) => row.min > 0).map((row) => row.min));
const EPSILON = 1e-9;

/** A course percentage rounded the way TMU rounds a final grade: to a whole number, half up. */
export const roundGrade = (percent) => Math.floor(percent + 0.5 + 1e-7);

// Displayed standings round down to 0.1 (never overstate a grade); a required average rounds up (never understate
// it). Rounding down to 0.1 keeps the shown value and its letter in agreement: 79.5 shows as 79.5 and is an A-.
export const floorTenth = (value) => Math.floor(value * 10 + 1e-6) / 10;
export const ceilTenth = (value) => Math.ceil(value * 10 - 1e-6) / 10;
/** "82.4%", "80%": one decimal at most, already rounded by the caller. */
export const formatPercent = (value) => `${Number.isInteger(value) ? value : value.toFixed(1)}%`;

/** The scale row for a percentage (0–100) after TMU's whole-number rounding, or null for a missing value. */
export function letterFor(percent) {
  if (percent === null || percent === undefined || Number.isNaN(percent)) return null;
  const rounded = roundGrade(percent);
  return GRADE_SCALE.find((row) => rounded >= row.min) || GRADE_SCALE[GRADE_SCALE.length - 1];
}

// CEN100's 20 graded rows, grouped as the outline's working arrangements describe them (12 + 5 + 18 + 41 + 24).
const CEN_GROUPS = [
  {
    id: 'orientation',
    title: 'Orientation & policy',
    items: ['y1', 'y3', 'y4', 'y8'],
  },
  { id: 'participation', title: 'Participation', items: ['y7'] },
  {
    id: 'coursework',
    title: 'Notebooks, reflections & MATLAB',
    items: ['y6', 'y5', 'y2'],
  },
  {
    id: 'project',
    title: 'Innovation Challenge project',
    note: 'M1–M8, including the individual Peer Evaluation.',
    items: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8'],
  },
  { id: 'exam', title: 'Final exam', items: ['y9'] },
];
// The lab quiz policy: "The lowest quiz is dropped." Tests keep this in step with each course's quizPolicy.
export const QUIZ_DROP = { mth140: 1, mth141: 1 };

const keyOf = (row) => (row.ids.length === 1 ? row.ids[0] : row.item);
const sum = (values) => values.reduce((total, value) => total + value, 0);

/**
 * The course's graded components: { courseId, groups: [{ id, title, weight, note, drop, keep, items }], items,
 * pass, quizPolicy }. Each item: { id, title, weight, dateLabel, parts, anchor, groupId }. In a drop-lowest
 * group an item's `weight` is what one quiz is worth when it counts. `section` dates the math lab quizzes.
 */
export function gradePlan(courseId, { section } = {}) {
  const rows = assessments(courseId, { section });
  let groups = [];
  if (courseId === 'cen100') {
    groups = CEN_GROUPS.map((group) => {
      const items = rows.filter((row) => group.items.includes(row.item));
      return {
        id: group.id,
        title: group.title,
        note: group.note || null,
        drop: 0,
        keep: items.length,
        weight: sum(items.map((row) => row.weight)),
        items: items.map((row) => ({
          id: keyOf(row),
          title: row.title,
          weight: row.weight,
          dateLabel: row.dateLabel,
          parts: row.ids.length,
          anchor: row.anchor,
          groupId: group.id,
        })),
      };
    });
  } else if (rows.categories) {
    const quizzes = rows.filter((row) => row.weight === null);
    const drop = Math.min(QUIZ_DROP[courseId] || 0, Math.max(0, quizzes.length - 1));
    const keep = quizzes.length - drop;
    const [quizWeight] = rows.categories.map((category) => category.weight);
    const quizItems = quizzes.map((row) => ({
      id: keyOf(row),
      title: row.title,
      weight: quizWeight / keep,
      dateLabel: row.dateLabel,
      parts: 1,
      anchor: row.anchor,
      groupId: 'quizzes',
    }));
    groups = [
      {
        id: 'quizzes',
        title: rows.categories[0].title,
        note: drop ? `Best ${keep} of ${quizzes.length} count. The lowest quiz is dropped.` : null,
        drop,
        keep,
        weight: quizWeight,
        items: quizItems,
      },
      ...rows
        .filter((row) => row.weight !== null)
        .map((row) => ({
          id: row.item,
          title: row.title,
          note: null,
          drop: 0,
          keep: 1,
          weight: row.weight,
          items: [
            {
              id: keyOf(row),
              title: row.title,
              weight: row.weight,
              dateLabel: row.dateLabel,
              parts: 1,
              anchor: row.anchor,
              groupId: row.item,
            },
          ],
        })),
    ];
  }
  return {
    courseId,
    groups,
    items: groups.flatMap((group) => group.items),
    pass: PASS_MARK,
    quizPolicy: rows.quizPolicy || null,
    total: sum(groups.map((group) => group.weight)),
  };
}

const NUMBER = /^\d{0,4}(?:[.,]\d{0,3})?$/;
// What a field may hold while typing: digits and separators (a typo such as "8.5.5" stays visible with its error).
const TYPED = /^[0-9.,]{0,9}(?:\/[0-9.,]{0,9})?$/;
const toNumber = (text) => (text === '' || text === '.' || text === ',' ? null : Number(text.replace(',', '.')));

/** Split saved text into the two fields: "17/20" → { score: '17', outOf: '20' }, "74.5" → { score: '74.5', outOf: '' }. */
export function splitMark(text) {
  const [score = '', outOf = ''] = String(text ?? '').split('/');
  return { score, outOf };
}
/** The saved text for the two fields ("" when both are empty). */
export const joinMark = ({ score = '', outOf = '' }) => (outOf ? `${score}/${outOf}` : score);

/**
 * A mark from the two fields. `outOf` empty means a percentage. Returns { percent, error, field }: percent is null
 * while nothing usable is typed; error is a short message for an impossible entry ("Over 100%", "More than 20")
 * and `field` names the field at fault ('score' or 'outOf'), null when there is no error.
 */
export function parseMark(score, outOf = '') {
  const s = String(score ?? '')
    .trim()
    .replace(/%$/, '')
    .trim();
  const o = String(outOf ?? '').trim();
  const fail = (error, field) => ({ percent: null, error, field });
  if (!NUMBER.test(s)) return fail('Not a number', 'score');
  if (!NUMBER.test(o)) return fail('Not a number', 'outOf');
  const got = toNumber(s);
  const total = toNumber(o);
  if (got === null) return { percent: null, error: null, field: null };
  if (total === null) return got > 100 ? fail('Over 100%', 'score') : { percent: got, error: null, field: null };
  if (total === 0) return fail('Total can’t be 0', 'outOf');
  if (got > total) return fail(`More than ${o.replace(',', '.')}`, 'score');
  return { percent: (got / total) * 100, error: null, field: null };
}

// Known item ids with typed text only (digits, separators and at most one "/").
function cleanMarks(courseId, marks) {
  if (!marks || typeof marks !== 'object' || Array.isArray(marks)) return {};
  const ids = new Set(gradePlan(courseId).items.map((item) => item.id));
  return Object.fromEntries(Object.entries(marks).filter(([id, text]) => ids.has(id) && typeof text === 'string' && text && TYPED.test(text)));
}

/**
 * Saved marks and target for a course, cleaned: unknown ids, non-strings and bad targets are dropped. `storage`:
 * omit it for the browser's localStorage, `null` for none, or any Storage-like object.
 */
export function readGrades(courseId, storage) {
  const key = GRADE_KEYS[courseId];
  const empty = { marks: {}, target: null };
  if (!key) return empty;
  const saved = readJSON(resolveStorage(storage), key, null);
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return empty;
  return { marks: cleanMarks(courseId, saved.marks), target: TARGETS.has(saved.target) ? saved.target : null };
}

/**
 * Writes the whole cleaned record, or removes the key when no mark or target is left (Clear marks leaves nothing
 * behind). Returns true when storage accepted it.
 */
export function writeGrades(courseId, storage, { marks = {}, target = null } = {}) {
  const key = GRADE_KEYS[courseId];
  if (!key) return false;
  const store = resolveStorage(storage);
  const record = { marks: cleanMarks(courseId, marks), target: TARGETS.has(target) ? target : null };
  if (!Object.keys(record.marks).length && record.target === null) return writeRaw(store, key, null);
  return writeJSON(store, key, record);
}

/** Whether this browser lets the calculator save (a blocked or full storage keeps marks for this page view only). */
export function gradesSavable(storage) {
  const store = resolveStorage(storage);
  try {
    if (!store) return false;
    store.setItem('tmu-guides-storage-check', '1');
    store.removeItem('tmu-guides-storage-check');
    return true;
  } catch {
    return false;
  }
}

/** Calls back when this course's saved grades change here or in another tab. Returns an unsubscribe function. */
export function subscribeGrades(courseId, storage, callback, target) {
  const key = GRADE_KEYS[courseId];
  const store = resolveStorage(storage);
  let events = target;
  if (events === undefined) events = typeof window !== 'undefined' ? window : null;
  const offLocal = onLocalChange((detail) => {
    if (detail.storage === store && detail.key === key) callback({ source: 'local' });
  });
  const onStorage = (event) => {
    if (event.key !== null && event.key !== key) return;
    if (store && event.storageArea && event.storageArea !== store) return;
    forget(store, key);
    callback({ source: 'storage' });
  };
  events?.addEventListener?.('storage', onStorage);
  return () => {
    offLocal();
    events?.removeEventListener?.('storage', onStorage);
  };
}

/** Course points (out of 100) when every unmarked item scores `fill`, applying drop-lowest. */
function pointsWith(plan, percents, fill) {
  return sum(
    plan.groups.map((group) => {
      const values = group.items.map((item) => percents[item.id] ?? fill);
      if (!group.drop) return sum(values.map((value, i) => (value * group.items[i].weight) / 100));
      const kept = [...values].sort((a, b) => b - a).slice(0, group.keep);
      return (sum(kept) * group.weight) / group.keep / 100;
    }),
  );
}

/** The smallest average on every unmarked item that reaches `target` points. Assumes it is reachable. */
function solve(plan, percents, target) {
  let low = 0;
  let high = 100;
  for (let i = 0; i < 60; i += 1) {
    const middle = (low + high) / 2;
    if (pointsWith(plan, percents, middle) >= target - EPSILON) high = middle;
    else low = middle;
  }
  return high;
}

/**
 * Where the student stands, from percentages by item id ({ 'quiz-1': 85 }; missing ids are unmarked):
 * - `secured`: course points already earned (every unmarked item at 0).
 * - `maximum`: the highest course grade still possible (every unmarked item at 100).
 * - `current`: the average on the marks that count so far (in a drop-lowest group, the best `keep` of those marked);
 *   null when nothing is marked.
 * - `projected`: the final grade if every unmarked item scores `current`. It equals `current` unless a quiz still to
 *   come would replace a lower one that counts now (a 0 on Lab Quiz 1 is dropped once a better quiz arrives).
 * - `marked`: the share of the course those counted marks cover.
 * - `remaining`: the share of the course still to be marked: unmarked items' weights, and in a drop-lowest group up
 *   to its whole weight (with Lab Quiz 1 marked and three quizzes to come, any of the four may be dropped, so all
 *   15% is still open).
 * - `dropped`: ids of quizzes currently dropped (only once more quizzes are marked than count).
 * - `groups`: per group { id, average, marked, counted }.
 * - `complete`: every item has a mark (then `current` is the calculated final grade).
 */
export function gradeStanding(plan, percents = {}) {
  let earned = 0;
  let marked = 0;
  const dropped = [];
  const groups = plan.groups.map((group) => {
    const entered = group.items.filter((item) => typeof percents[item.id] === 'number');
    let counted = entered;
    if (group.drop && entered.length > group.keep) {
      // Stable: among equal lowest marks, the earliest quiz is the one dropped.
      const order = entered.map((item, i) => ({ item, i })).sort((a, b) => percents[b.item.id] - percents[a.item.id] || b.i - a.i);
      counted = order.slice(0, group.keep).map((entry) => entry.item);
      dropped.push(...order.slice(group.keep).map((entry) => entry.item.id));
    }
    const weight = sum(counted.map((item) => item.weight));
    const points = sum(counted.map((item) => (percents[item.id] * item.weight) / 100));
    earned += points;
    marked += weight;
    return {
      id: group.id,
      average: weight ? (points / weight) * 100 : null,
      marked: entered.length,
      counted: counted.length,
      total: group.items.length,
    };
  });
  const unmarked = plan.items.filter((item) => typeof percents[item.id] !== 'number');
  const secured = pointsWith(plan, percents, 0);
  const maximum = pointsWith(plan, percents, 100);
  const current = marked > EPSILON ? (earned / marked) * 100 : null;
  return {
    secured,
    maximum,
    current,
    projected: current === null ? null : pointsWith(plan, percents, current),
    marked,
    remaining: sum(
      plan.groups.map((group) => {
        const open = group.items.filter((item) => typeof percents[item.id] !== 'number');
        if (group.drop) return (Math.min(open.length, group.keep) * group.weight) / group.keep;
        return sum(open.map((item) => item.weight));
      }),
    ),
    dropped,
    groups,
    unmarked: unmarked.map((item) => item.id),
    complete: unmarked.length === 0,
  };
}

/**
 * What it takes to finish with a grade that rounds to at least `target` percent (a letter's `min`): a final
 * percentage of `target − 0.5` is enough, because TMU rounds half up. Returns { status, average, item }.
 * - 'secured': already reached, even with 0 on everything left.
 * - 'reachable': `average` (rounded up to 0.1) is the mark needed on every remaining item; `item` names it when only
 *   one item is left.
 * - 'unreachable': not possible even with 100 on everything left.
 * - 'complete': every mark is in; the target was not reached.
 */
export function gradeNeeded(plan, percents, target, standing = gradeStanding(plan, percents)) {
  const goal = target - 0.5;
  if (standing.secured >= goal - EPSILON) return { status: 'secured', average: 0, item: null };
  if (standing.complete) return { status: 'complete', average: null, item: null };
  if (standing.maximum < goal - EPSILON) return { status: 'unreachable', average: null, item: null };
  const average = Math.min(100, ceilTenth(solve(plan, percents, goal)));
  const only = standing.unmarked.length === 1 ? plan.items.find((item) => item.id === standing.unmarked[0]) : null;
  return { status: 'reachable', average, item: only };
}

/** Percentages by id from saved mark texts (invalid or empty entries are left out). */
export function percentsFrom(marks = {}) {
  return Object.fromEntries(
    Object.entries(marks)
      .map(([id, text]) => {
        const { score, outOf } = splitMark(text);
        return [id, parseMark(score, outOf).percent];
      })
      .filter(([, percent]) => percent !== null),
  );
}
