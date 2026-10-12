/* ES module view of the CEN100 schedule for the Desk and Night Shift. The records live only in cen-schedule.js
   (a classic script, so the CEN guide's inline script can read them synchronously); importing it defines
   globalThis.CEN_SCHEDULE, or reuses the copy the CEN page already loaded. */
import './cen-schedule.js?v=20261012-desk1';
export const SCHEDULE=globalThis.CEN_SCHEDULE;
