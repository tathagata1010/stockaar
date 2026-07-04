// Shared SEBI compliance strip. Unions the aggressive patterns already used
// across alerts/brief.ts, doctor/diagnose.ts, stock-story.ts. New features
// (research agent, future briefs) import from here; existing call sites keep
// their local regex until we can retest each surface end-to-end.

export const SEBI_BANNED_RE =
  /\b(buy|sell|recommend|recommendation)\b|target\s*₹|₹\s*\d+\s*target/i;

export function sebiStrip(s: string, placeholder = "[review]"): string {
  return s.replace(SEBI_BANNED_RE, placeholder);
}
