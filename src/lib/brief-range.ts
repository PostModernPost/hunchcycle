// Turning ?from=2026-10-15&to=2026-10-22 into a time range, in Pacific time like the rest of the app.
const PT = "-07:00";

export function parseRange(fromParam: string | undefined, toParam: string | undefined, fallback: { from: Date; to: Date }, now = new Date()) {
  const day = /^\d{4}-\d{2}-\d{2}$/;
  const from = fromParam && day.test(fromParam) ? new Date(`${fromParam}T00:00:00${PT}`) : fallback.from;
  // the end day counts in full, but never past now
  const end = toParam && day.test(toParam) ? new Date(`${toParam}T23:59:59.999${PT}`) : fallback.to;
  return { from, to: end > now ? now : end };
}
