import test from 'node:test';
import assert from 'node:assert/strict';
import {COURSES} from '../assets/course-data.mjs';
import {SCHEDULE} from '../assets/cen-schedule.mjs';
import * as palette from '../assets/night/palette.mjs';
const now=Date.parse('2026-10-12T16:00:00Z');

test('fuzzy matching is a case-insensitive subsequence with prefix and word-start preference',()=>{
 assert.equal(typeof palette.fuzzyMatch,'function','palette exposes its pure scorer');
 const hit=palette.fuzzyMatch('Midterm Test','mDt');
 assert.deepEqual(hit.indices,[0,2,3]);
 assert.equal(palette.fuzzyMatch('Midterm Test','xyz'),null);
 assert(palette.fuzzyMatch('Midterm Test','mid').score>palette.fuzzyMatch('The Midterm Test','mid').score);
 assert(palette.fuzzyMatch('The Midterm Test','mt').score>palette.fuzzyMatch('Some midterm test','mt').score);
 assert.deepEqual(palette.fuzzyMatch('Course info','').indices,[]);
});
test('math index preserves real IDs and shared deadline precision without filtering completed work',()=>{
 assert.equal(typeof palette.buildIndex,'function');
 const index=palette.buildIndex({course:'mth140',data:COURSES.mth140,section:31,completed:{midterm:true},now});
 const midterm=index.entries.find(e=>e.id==='assessment-midterm');
 assert.equal(midterm.target,'assessment-midterm');assert.equal(midterm.label,'Midterm Test');assert.equal(midterm.completed,true);
 assert.match(midterm.hint,/Fri Oct 23.*6:30 PM Toronto/);
 assert.equal(index.entries.filter(e=>e.group==='Assessments').length,COURSES.mth140.assessments.length);
 assert.equal(index.entries.find(e=>e.id==='assessment-final').precision,'pending');
 assert.equal(index.entries.find(e=>e.id==='view-study').group,'Courses','course views sit with the course places');
 assert.deepEqual(index.entries.filter(e=>e.group==='Topics').map(e=>e.target),COURSES.mth140.topics.map(t=>'topic-'+t.id));
 const defaultRows=palette.searchIndex(index,'');
 assert.equal(defaultRows[0].id,'assessment-quiz-2','real next deadline leads the curated default');
 assert(!defaultRows.some(e=>e.id==='assessment-midterm'),'completed assessments remain searchable without crowding default');
 assert.equal(palette.searchIndex(index,'midterm')[0].id,'assessment-midterm');
});
test('CEN index keeps calendar IDs distinct from opening item handles and includes undated titles',()=>{
 const index=palette.buildIndex({course:'cen100',data:SCHEDULE,section:29,itemTitles:{y4:'Academic Integrity Quiz',y9:'Final exam'},now});
 const integrity=index.entries.find(e=>e.id==='assessment-integrity');
 assert.equal(integrity.target,'y4');assert.match(integrity.hint,/Wed Oct 14.*3:00 PM Toronto/);
 assert.equal(index.entries.find(e=>e.id==='assessment-intro').target,'y1');
 assert.equal(index.entries.find(e=>e.id==='item-y9').precision,'pending');
 assert(!index.entries.some(e=>e.id==='view-study'));
 assert(index.entries.some(e=>e.id==='assessment-failure-lab'));
 assert(!palette.buildIndex({course:'cen100',data:SCHEDULE,section:1,now}).entries.some(e=>e.id==='assessment-failure-lab'));
});
test('week rows use the week wording of the copy, read in full by screen readers',()=>{
 const index=palette.buildIndex({course:'mth140',data:COURSES.mth140,section:31,now}),week=n=>index.entries.find(e=>e.id==='week-'+n);
 assert.deepEqual([week(0).label,week(0).ariaLabel],['Week 1 · Sep 8–13','Week 1, September 8 to 13. Partial first week']);
 assert.deepEqual([week(7).label,week(7).ariaLabel],['Week 8 · Oct 26–Nov 1','Week 8, October 26 to November 1']);
 assert.deepEqual([week(8).label,week(8).ariaLabel,week(8).hint],['Week 9 · Nov 2–8','Week 9, November 2 to 8','']);
 assert.deepEqual([week(15).label,week(15).ariaLabel],['Week 16 · Dec 21','Week 16, December 21. Final day of the semester']);
 assert.deepEqual([week(16).label,week(16).ariaLabel??null,week(16).hint],['Exam · Date pending',null,''],'the undated exam week keeps its own label once');
 assert(!index.entries.some(e=>e.type==='week'&&/\d{4}-\d{2}-\d{2}/.test(e.label+e.hint)),'no ISO dates in visible week text');
 assert.equal(palette.buildIndex({course:'desk',now}).entries.find(e=>e.id==='week-8').hint,'Open a course to choose a week');
});
test('week query aliases route through the shared week model before fuzzy results',()=>{
 const index=palette.buildIndex({course:'mth140',data:COURSES.mth140,now});
 for(const query of ['week 9','wk 9','w9']){const [week]=palette.searchIndex(index,query);assert.equal(week.type,'week');assert.equal(week.index,8);}
 assert.equal(palette.searchIndex(index,'oct 13')[0].index,5);
 assert(!palette.searchIndex(index,'week 99').some(e=>e.type==='week'));
});
test('Desk has router places, disabled weeks and only available actions',()=>{
 const index=palette.buildIndex({course:'desk',exists:selector=>selector==='.hub-theme',base:'https://guide.test/tmu-course-guides/',now});
 assert.deepEqual(index.entries.filter(e=>e.type==='place').map(e=>e.url),['https://guide.test/tmu-course-guides/','https://guide.test/tmu-course-guides/cen100/','https://guide.test/tmu-course-guides/mth140/','https://guide.test/tmu-course-guides/mth141/']);
 assert(index.entries.filter(e=>e.type==='place').every(e=>e.group==='Courses'));
 assert(!index.entries.some(e=>e.group==='Assessments'||e.type==='view'||e.id==='action-calendar'));
 assert.equal(palette.searchIndex(index,'week 9')[0].disabled,true);
 assert(index.entries.some(e=>e.id==='action-motion'));
 const reduced=palette.buildIndex({course:'desk',motionForced:true,sound:true,theme:'light'});
 assert.equal(reduced.entries.find(e=>e.id==='action-motion').disabled,true);
 const soundOn=reduced.entries.find(e=>e.id==='action-sound'),soundOff=index.entries.find(e=>e.id==='action-sound');
 assert.deepEqual([soundOn.label,soundOn.ariaLabel],['Sound on','Sound on. Turn sound off'],'sound reads as its state, with the action for screen readers');
 assert.deepEqual([soundOff.label,soundOff.ariaLabel],['Sound off','Sound off. Turn sound on']);
 assert.equal(palette.searchIndex(index,'sound on')[0].id,'action-sound','the action words still find the control');
 assert.match(reduced.entries.find(e=>e.id==='action-theme').label,/light/i);
});

test('palette wording matches the interface copy document',async()=>{
 const {readFileSync}=await import('node:fs');
 const doc=readFileSync(new URL('../docs/copy/interface-copy.md',import.meta.url),'utf8');
 const table=doc.split('## Command palette')[1].split('\n## ')[0];
 const rows=Object.fromEntries(table.split('\n').filter(line=>/^\| [A-Z]/.test(line)&&!line.startsWith('| Element')).map(line=>{const [element,visible,label]=line.split('|').slice(1,4).map(cell=>cell.trim());return [element,{visible,label}];}));
 const {COPY,GROUPS}=palette,q='{query}';
 assert.deepEqual(Object.keys(rows),['Search placeholder','Group headings','Search suggestion','Empty results','Clear search','Close palette']);
 assert.deepEqual([COPY.placeholder,COPY.label],[rows['Search placeholder'].visible,rows['Search placeholder'].label]);
 assert.deepEqual([Object.keys(GROUPS).join(' · '),Object.values(GROUPS).join(' · ')],[rows['Group headings'].visible,rows['Group headings'].label]);
 assert.deepEqual([COPY.suggestion(q),COPY.suggestionLabel(q)],[rows['Search suggestion'].visible,rows['Search suggestion'].label]);
 assert.deepEqual([COPY.empty(q),COPY.emptyLabel(q)],[rows['Empty results'].visible,rows['Empty results'].label]);
 assert.deepEqual([COPY.clear,COPY.clearLabel],[rows['Clear search'].visible,rows['Clear search'].label]);
 assert.deepEqual([COPY.close,COPY.closeLabel],[rows['Close palette'].visible,rows['Close palette'].label]);
 // Every group the index produces has a heading from the copy.
 const groups=new Set();
 for(const [course,data] of [['mth140',COURSES.mth140],['mth141',COURSES.mth141],['cen100',SCHEDULE],['desk',null]])for(const e of palette.buildIndex({course,data,section:course==='cen100'?29:31,itemTitles:{y9:'Final exam'},now}).entries)groups.add(e.group);
 assert.deepEqual([...groups].filter(group=>!Object.hasOwn(GROUPS,group)),[],'no group heading outside the copy');
});
