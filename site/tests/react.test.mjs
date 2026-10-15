import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import ReactDOMServer from 'react-dom/server';

import { useNow, useProgress, useSection, useMotionPaused } from '../src/lib/react.js';

test('the hooks render on the server with no clock, storage or window, and show "nothing saved"', () => {
  let seen = null;
  function Probe() {
    const now = useNow(1000);
    const progress = useProgress();
    const [section] = useSection('cen100');
    const [still, , motion] = useMotionPaused();
    seen = { now, ready: progress.ready, done: progress.isDone('cen100', 'integrity'), ticked: progress.isTicked('cen100', 'm2', 'm2-1-3'), section, still, motion };
    return React.createElement('p', null, String(now));
  }
  const html = ReactDOMServer.renderToString(React.createElement(Probe));
  assert.equal(html, '<p>null</p>');
  assert.deepEqual(seen, { now: null, ready: false, done: false, ticked: false, section: null, still: false, motion: { saved: false, reduced: false, forced: false, full: false } });
  assert.equal(typeof window, 'undefined');
});
