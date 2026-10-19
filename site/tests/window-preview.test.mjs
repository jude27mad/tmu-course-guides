import assert from 'node:assert/strict';
import test from 'node:test';
const model = await import('../src/pages/course/components/windows/window-model.mjs').catch((error) => { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; return {}; });
const call = (name, ...args) => { assert.equal(typeof model[name], 'function', `${name} must implement the approved preview`); return model[name](...args); };
test('only the MTH140 route enables the window preview', () => { assert.equal(call('isWindowPreview', 'mth140'), true); for (const id of ['cen100','mth141',null,'']) assert.equal(call('isWindowPreview',id),false); });
test('window selection follows the chosen assessment, then falls back after completion/removal', () => {
  const old={id:'old',overdue:true}, next={id:'next'}, later={id:'later'};
  assert.equal(call('selectWindowItem',[old,next,later]),next);
  assert.equal(call('selectWindowItem',[old,next,later],'later'),later);
  assert.equal(call('selectWindowItem',[old,next],'later'),next);
  assert.equal(call('selectWindowItem',[old,{...next,done:true},later],'next'),later);
  assert.equal(call('selectWindowItem',[old]),old); assert.equal(call('selectWindowItem',[]),null); assert.equal(call('selectWindowItem',null),null);
});
test('date artwork uses a confirmed calendar day, without a local timezone shift', () => {
  assert.deepEqual(call('dateBadge',{precision:'exact',date:'2026-10-23'}),{large:'23',small:'Oct · Fri'});
  assert.deepEqual(call('dateBadge',{precision:'day',date:'2026-11-02'}),{large:'02',small:'Nov · Mon'});
});
test('week-only, unknown and malformed dates never become an invented test day', () => {
  assert.deepEqual(call('dateBadge',{precision:'week',date:'2026-10-12'}),{large:'Week',small:'Choose your section'});
  for(const item of [{precision:'pending'},{precision:'day',date:'2026-02-31'},{precision:'exact',date:'bad'}]) assert.deepEqual(call('dateBadge',item),{large:'TBA',small:'Date pending'});
});
test('preparation counts remain distinct from assessment completion and grades', () => {
  assert.deepEqual(call('preparationSummary',{checked:2,total:4}),{checked:2,total:4,percent:50});
  assert.deepEqual(call('preparationSummary',{checked:4,total:4}),{checked:4,total:4,percent:100});
  assert.equal(call('preparationSummary',null),null); assert.equal(call('preparationSummary',{checked:0,total:0}),null);
});
test('preparation geometry is finite and bounded even for invalid counts', () => {
  assert.deepEqual(call('preparationSummary',{checked:20,total:4}),{checked:4,total:4,percent:100});
  assert.deepEqual(call('preparationSummary',{checked:-1,total:4}),{checked:0,total:4,percent:0});
  assert.equal(call('preparationSummary',{checked:0,total:NaN}),null);
});
test('help questions relabel headings only, leaving official explanation content untouched', () => {
  assert.equal(call('helpQuestion','If you miss an assessment'),'What happens if I miss an assessment?');
  assert.equal(call('helpQuestion','Assessment rules'),'What are the assessment rules?');
  assert.equal(call('helpQuestion','A future rule'),'A future rule');
});
