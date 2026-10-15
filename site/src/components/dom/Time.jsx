import { useEffect, useState } from 'react';

// Toronto wall-clock time: every deadline on the site is Toronto time.
const FORMAT = new Intl.DateTimeFormat('en-CA', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: 'America/Toronto' });
const formatTime = () => FORMAT.format(new Date());

function Time() {
  const [time, setTime] = useState(formatTime);

  useEffect(() => {
    // Repaint on the minute (and when the tab comes back), not every second.
    let timer;
    const tick = () => {
      setTime(formatTime());
      timer = setTimeout(tick, 60000 - (Date.now() % 60000) + 50);
    };
    tick();
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        clearTimeout(timer);
        tick();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return <time>{time}</time>;
}

export default Time;
