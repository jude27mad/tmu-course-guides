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
 assert(index.entries.some(e=>e.id==='view-study'));
 assert.deepEqual(index.entries.filter(e=>e.group==='Math topics').map(e=>e.target),COURSES.mth140.topics.map(t=>'topic-'+t.id));
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
test('week query aliases route through the shared week model before fuzzy results',()=>{
 const index=palette.buildIndex({course:'mth140',data:COURSES.mth140,now});
 for(const query of ['week 9','wk 9','w9']){const [week]=palette.searchIndex(index,query);assert.equal(week.type,'week');assert.equal(week.index,8);}
 assert.equal(palette.searchIndex(index,'oct 13')[0].index,5);
 assert(!palette.searchIndex(index,'week 99').some(e=>e.type==='week'));
});
test('Desk has router places, disabled weeks and only available actions',()=>{
 const index=palette.buildIndex({course:'desk',exists:selector=>selector==='.hub-theme',base:'https://guide.test/tmu-course-guides/',now});
 assert.deepEqual(index.entries.filter(e=>e.group==='Places').map(e=>e.url),['https://guide.test/tmu-course-guides/','https://guide.test/tmu-course-guides/cen100/','https://guide.test/tmu-course-guides/mth140/','https://guide.test/tmu-course-guides/mth141/']);
 assert(!index.entries.some(e=>e.group==='Assessments'||e.group==='Views'||e.id==='action-calendar'));
 assert.equal(palette.searchIndex(index,'week 9')[0].disabled,true);
 assert(index.entries.some(e=>e.id==='action-motion'));
 const reduced=palette.buildIndex({course:'desk',motionForced:true,sound:true,theme:'light'});
 assert.equal(reduced.entries.find(e=>e.id==='action-motion').disabled,true);
 assert.equal(reduced.entries.find(e=>e.id==='action-sound').label,'Sound off');
 assert.match(reduced.entries.find(e=>e.id==='action-theme').label,/light/i);
});
