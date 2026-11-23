// Regenerates site/src/lib/content/cen-literals.mjs: archived literal blocks with the current course-wide instructions.
// Run from anywhere: node site/tests/extract/cen-literals.mjs
import {readFileSync,writeFileSync} from 'node:fs';
const src=new URL('../../../assets/cen-guide.mjs',import.meta.url),out=new URL('../../src/lib/content/cen-literals.mjs',import.meta.url);
const lines=readFileSync(src,'utf8').split('\n');
const take=(from,to)=>lines.slice(from-1,to); // 1-based inclusive
const expect=(n,start)=>{if(!lines[n-1].trimStart().startsWith(start))throw new Error(`line ${n}: expected ${start}, got ${lines[n-1].slice(0,60)}`);};
const blocks=[
 [46,67,'const I={'],[68,68,'const WHO='],[70,146,'const TEAM = ['],[148,198,'const YOU = ['],
 [200,210,'const RULES=['],[211,221,'const CONFIRMED=['],[222,224,'const OPEN=['],[226,226,'const KEY='],
 [412,412,'const PROFILE_KEY='],[416,428,'const SOURCE_INFO={'],[429,429,'const sourceFor='],
 [623,623,'const PLAN_KEY='],
];
// Corrections to the archived literals, keyed by their source line.
const currentLines=new Map([
  [92, `  facts:[["cal","Part 1: Oct 21; Part 2/FMEA: Oct 28"],["up","D2L"]],`],
  [170, `  preview:"Reflection 1: Oct 28. Reflection 2: Dec 2. Email each to your Project Manager.",
  requirements:{
   "reflection-1":"Your individual reflection on engineering thinking, teamwork and course tools near the end of Phase 2. Email Reflection 1 directly to your Project Manager.",
   "reflection-2":"Your individual reflection on the semester, peer evaluation and how your project developed. Email Reflection 2 directly to your Project Manager."
  },`],
  [171, `  what:"Reflection 1 covers your progress near the end of Phase 2; Reflection 2 looks back over the semester. Complete and email each separately to your assigned Project Manager.",`],
  [172, `  facts:[["cal","Reflection 1: Wednesday, Oct 28, by end of day"],["cal","Reflection 2: Wednesday, Dec 2, by end of day"],["warn","Email directly to your Project Manager; follow the reflection handout's deadline headings"]],`],
  [176, `  what:"Attendance quizzes take place in person during your assigned tutorial. Check D2L for timing.",`],
  [177, `  facts:[["pin","During your assigned tutorial"]],`],
  [218, ` ["Attendance quizzes","Attend in person during your assigned tutorial. Check D2L for timing."],`],
  [421, `  y5:["Reflection handout + outline","Personal_Reflection_1_F26.docx, pp. 1 and 3: Reflection 1 is due Oct 28; Reflection 2 is due Dec 2, both by end of day, emailed directly to your PM. Page 1 also contains conflicting D2L-folder wording; the deadline headings and course-team clarification specify email. Course outline, p. 9: combined 4% weight."],`],
  [423, `  y7:["Course outline","Course outline, pp. 9–10: participation weight and in-person attendance."],`],
  [623, `const PLAN_KEY="cen100-personal-plan-v1", SEEN_KEY="cen100-last-seen-update-v1", GUIDE_VERSION="2026-10-16-course-artwork";`],
]);
let body=[];
for(const [from,to,start] of blocks){
 expect(from,start);
 const chunk=take(from,to);
 const indent=chunk[0].match(/^\s*/)[0].length;
 const dedented=chunk.map(l=>l.startsWith(' '.repeat(indent))?l.slice(indent):l);
 for(let i=0;i<dedented.length;i++){
  if(currentLines.has(from+i))dedented[i]=currentLines.get(from+i);
 }
 dedented[0]='export '+dedented[0];
 if(from===412)body.push('// Innovation Challenge groups are numbered 1 through 52.','export const GROUPS=Array.from({length:52}, (_,index)=>index+1);','');
 body.push(`// assets/cen-guide.mjs:${from}${to>from?'-'+to:''}`,...dedented,'');
}
const header=`/* CEN100 guide content, adapted from the archived guide. Preserve item, group and checklist
   order: saved checklist keys use \`\${item.id}-\${groupIndex}-\${checkIndex}\`. */
`;
writeFileSync(out,header+'\n'+body.join('\n'));
