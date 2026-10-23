import { Temporal as Polyfill } from 'temporal-polyfill';

// Schedule-X reads Temporal globally. Share its constructors with our adapter,
// using the browser's implementation when present. Leave Intl and Date intact:
// the course data layer has its own synchronous formatter cache.
export const Temporal = globalThis.Temporal || Polyfill;
if (!globalThis.Temporal) globalThis.Temporal = Temporal;
