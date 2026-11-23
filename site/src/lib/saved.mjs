/* Readers and writers for each saved record, with the old pages' validation and exact output formats.

   CEN100 (assets/cen-guide.mjs)
     cen100-g9-ticks            {"<item>-<group>-<check>":1}, unticked keys deleted, other keys left as they were
     cen100-contact-choice-v1   {"group":n} or null
     cen100-personal-plan-v1    cleanPlan() output: {"completed":{id:1},"notes":{item:text},"targets":{item:date}}
     cen100-hide-completed-v1   true | false
     cen100-last-seen-update-v1 "2026-10-15-new-design"
   MTH140 / MTH141 (assets/math-guide.mjs), and CHY102 / PCS211 in the same formats
     <course>-progress-v1       cleanProgress() output: {"checks","completed","notes","targets","topics"}
     <course>-last-seen-update-v1 "2026-10-15-new-design"
   Shared: guide-motion-paused  raw "true" | "false"

   Every write re-reads storage first, applies one change and writes the whole cleaned record, which is exactly
   what the old page wrote for a single action after loading. Readers never write. */
import { DATA, isScience } from './data.mjs';
import * as CEN from './content/cen.mjs';
import * as MATH from './content/math.mjs';
import { KEYS, readRaw, readJSON, writeJSON, writeRaw } from './storage.mjs';

const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
/** A math-style guide: MTH140 and MTH141, and CHY102 and PCS211, which share their model and saved formats. */
export const isMath = (courseId) => courseId === 'mth140' || courseId === 'mth141' || isScience(courseId);

// ---- CEN100 ----
/** cen-guide.mjs:227: the tick map as the page held it (non-objects read as {}). */
export function readTicks(storage) {
  let ticks;
  try {
    ticks = JSON.parse(readRaw(storage, KEYS.cen100.ticks) || '{}') || {};
  } catch {
    ticks = {};
  }
  return isRecord(ticks) ? ticks : {};
}
export const writeTicks = (storage, ticks) => writeJSON(storage, KEYS.cen100.ticks, ticks);

export const readPlan = (storage) => CEN.cleanPlan(readJSON(storage, KEYS.cen100.plan, {}));
export const writePlan = (storage, plan) => writeJSON(storage, KEYS.cen100.plan, plan);

export const readProfile = (storage) => CEN.validProfile(readJSON(storage, KEYS.cen100.profile, null));
export const writeProfile = (storage, profile) => writeJSON(storage, KEYS.cen100.profile, CEN.validProfile(profile));

// ---- MTH140 / MTH141 ----
export const readMath = (courseId, storage) => MATH.cleanProgress(readJSON(storage, KEYS[courseId].progress, {}), DATA[courseId], courseId);
export const writeMath = (courseId, storage, progress) => writeJSON(storage, KEYS[courseId].progress, progress);

// ---- Shared ----
/** The completed map for any course: CEN cleanPlan().completed ({id:1}) or math cleanProgress().completed ({id:true}). */
export const readCompletedMap = (courseId, storage) => (courseId === 'cen100' ? readPlan(storage).completed : readMath(courseId, storage).completed);
export const readMotionPaused = (storage) => readRaw(storage, KEYS.motion) === 'true';
export const writeMotionPaused = (storage, value) => writeRaw(storage, KEYS.motion, String(!!value));
