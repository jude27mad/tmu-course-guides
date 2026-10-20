import * as Accordion from '@radix-ui/react-accordion';
import { flushSync } from 'react-dom';
import { useEffect, useRef, useState } from 'react';

const PANELS = [
  {
    id: 'alpha',
    title: 'Panel Alpha',
    text: 'R4PANELALPHA: this explanation must remain in the exported HTML.',
  },
  {
    id: 'bravo',
    title: 'Panel Bravo',
    text: 'R4PANELBRAVO: browser find should reveal this initially closed explanation.',
  },
  {
    id: 'charlie',
    title: 'Panel Charlie',
    text: 'R4PANELCHARLIE: without JavaScript every explanation must remain readable.',
  },
];

// Measurement mechanics only: no colours, typography, spacing, or animation.
// The progressive mode uses the existing pre-paint `.js` marker. With scripting
// disabled that marker is absent, every force-mounted panel stays visible.
const PROBE_CSS = `
  [data-spike-accordion][data-mode=no-js-safe] [data-spike-panel],
  [data-spike-accordion][data-mode=until-found] [data-spike-panel] {
    display: block;
  }
  .js [data-spike-accordion][data-mode=no-js-safe] [data-spike-panel][data-state=closed]:not([hidden]),
  [data-spike-accordion][data-mode=no-js-safe] [data-spike-panel][hidden=until-found],
  [data-spike-accordion][data-mode=until-found] [data-spike-panel][hidden=until-found] {
    content-visibility: hidden;
  }
`;

export default function AccordionProbe({ mode = 'no-js-safe' }) {
  const rootRef = useRef(null);
  const [openValues, setOpenValues] = useState([]);
  const [matchCount, setMatchCount] = useState(0);
  const [trustedMatchCount, setTrustedMatchCount] = useState(0);

  useEffect(() => {
    const root = rootRef.current;
    const onBeforeMatch = (event) => {
      const panel = event.target.closest('[data-spike-panel]');
      if (!panel || !root.contains(panel)) return;
      const value = panel.getAttribute('data-spike-panel');
      // The browser continues its reveal/scroll algorithm after this native
      // event. Commit the open state before it does so closed-state CSS cannot
      // keep the found content hidden during that algorithm.
      flushSync(() => {
        setMatchCount((count) => count + 1);
        if (event.isTrusted) setTrustedMatchCount((count) => count + 1);
        setOpenValues((values) => (values.includes(value) ? values : [...values, value]));
      });
    };
    root.addEventListener('beforematch', onBeforeMatch);
    return () => root.removeEventListener('beforematch', onBeforeMatch);
  }, []);

  useEffect(() => {
    if (mode === 'naive') return;
    // React 18 treats JSX `hidden` as a boolean attribute. Use the native DOM
    // attribute API to retain the actual "until-found" token instead of "".
    rootRef.current.querySelectorAll('[data-spike-panel]').forEach((panel) => {
      if (openValues.includes(panel.getAttribute('data-spike-panel'))) panel.removeAttribute('hidden');
      else panel.setAttribute('hidden', 'until-found');
    });
  }, [mode, openValues]);

  return (
    <section ref={rootRef} data-spike-accordion data-mode={mode} aria-label="Accordion probe">
      <style>{PROBE_CSS}</style>
      <p>
        Accordion mode: <span data-spike-accordion-mode>{mode}</span>
      </p>
      <button type="button" data-spike-expand-all onClick={() => setOpenValues(PANELS.map((panel) => panel.id))}>
        Expand all
      </button>
      <button type="button" data-spike-collapse-all onClick={() => setOpenValues([])}>
        Collapse all
      </button>
      <output data-spike-beforematch-count>{matchCount}</output>
      <output data-spike-trusted-beforematch-count>{trustedMatchCount}</output>
      <Accordion.Root type="multiple" value={openValues} onValueChange={setOpenValues}>
        {PANELS.map((panel) => (
          <Accordion.Item key={panel.id} value={panel.id}>
            <Accordion.Header>
              <Accordion.Trigger data-spike-trigger={panel.id}>{panel.title}</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content forceMount data-spike-panel={panel.id} hidden={mode === 'naive' && !openValues.includes(panel.id) ? 'until-found' : undefined}>
              <p>{panel.text}</p>
            </Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion.Root>
    </section>
  );
}
