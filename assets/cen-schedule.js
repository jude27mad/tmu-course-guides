/* Legacy classic-script compatibility. New readers import the canonical, inert ES module.
   CEN route mount/unmount owns window.CEN_SCHEDULE during ordinary navigation. */
import('./cen-schedule.mjs?v=20261013-shift1').then(({SCHEDULE})=>{
  globalThis.CEN_SCHEDULE=globalThis.CEN_SCHEDULE||SCHEDULE;
});
