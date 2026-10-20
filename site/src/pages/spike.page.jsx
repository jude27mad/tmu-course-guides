import { Component, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import AccordionProbe from '@src/spike/AccordionProbe';

function CalendarLoading({ error }) {
  // next/dynamic gives rejected imports to loading(); rethrow to the boundary.
  if (error) throw error;
  return <p role="status">Loading calendar probe…</p>;
}

const CalendarProbe = dynamic(() => import('@src/spike/CalendarProbe'), { ssr: false, loading: CalendarLoading });

class CalendarBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    window.spikeCalendarError = { name: error.name, message: error.message };
  }

  render() {
    const { failed } = this.state;
    const { children } = this.props;
    if (failed) return <p role="status">Calendar unavailable — every date is in the list</p>;
    return children;
  }
}

export default function Spike() {
  const [settings, setSettings] = useState(null);
  const [clicks, setClicks] = useState(0);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSettings({
      width: Number(params.get('width')) || 1000,
      responsive: params.get('responsive') !== 'false',
      view: params.get('view') || 'month-grid',
      overrideMore: params.get('more') === 'override',
      accordionMode: params.get('accordion') || 'no-js-safe',
      preventLenis: params.get('prevent') !== 'false',
    });
  }, []);

  return (
    <div data-spike-page style={{ paddingTop: 120 }}>
      {/* Only fixture dimensions; the calendar uses its unmodified default theme. */}
      <style>{'[data-spike-calendar-container] .sx-react-calendar-wrapper { height: 100%; width: 100%; }'}</style>
      <h1>R4 disposable calendar and accordion measurements</h1>
      <p>Fixed sample dates in October 2026. This page is never merged.</p>
      <p>Probe parameters: width, responsive, view, more=override, accordion, prevent.</p>
      <button type="button" data-spike-counter onClick={() => setClicks((value) => value + 1)}>
        Page still works: {clicks}
      </button>
      {settings && (
        <div data-spike-calendar-container data-lenis-prevent={settings.preventLenis ? '' : undefined} style={{ width: settings.width, maxWidth: '100%', height: 680 }}>
          <CalendarBoundary>
            <CalendarProbe responsive={settings.responsive} view={settings.view} overrideMore={settings.overrideMore} />
          </CalendarBoundary>
        </div>
      )}
      <div data-spike-static-dates>
        <p>October 19–23: Quiz week · Quiz 2 · date depends on your lab section.</p>
        <p>October 20, 08:00–10:00: lab window; quiz in its second hour.</p>
        <p>October 21: all-day sample; time not posted. October 22: five busy-day samples.</p>
      </div>
      <AccordionProbe mode={settings?.accordionMode || 'no-js-safe'} />
    </div>
  );
}
