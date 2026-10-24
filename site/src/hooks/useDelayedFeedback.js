import { useEffect, useMemo, useState } from 'react';

// This timer only controls feedback, never when ready content can appear.
// A stable destination keeps repeat taps from postponing the message. A new
// request identity prevents a replaced/completed request from flashing later.
export default function useDelayedFeedback(pendingKey, delay = 250) {
  const request = useMemo(() => (pendingKey ? { pendingKey, delay } : null), [pendingKey, delay]);
  const [visibleRequest, setVisibleRequest] = useState(null);

  useEffect(() => {
    if (!request) return undefined;
    const timer = setTimeout(() => setVisibleRequest(request), request.delay);
    return () => clearTimeout(timer);
  }, [request]);

  return request !== null && visibleRequest === request;
}
