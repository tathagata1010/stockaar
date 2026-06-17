"use client";

import { useEffect } from "react";

const LS_KEY = "sb:lastGuidanceNudge";
const CLIENT_THROTTLE_MS = 5 * 60_000; // 5 min — matches server-side Redis lock

// Mounts once on /guidance. Pings /api/guidance/nudge so visiting the page
// kicks off a fresh ingest (server-side Redis throttle dedupes across users).
// Fire-and-forget — never blocks render or shows UI.
export function LiveGuidancePing() {
  useEffect(() => {
    const last = Number(localStorage.getItem(LS_KEY) ?? "0");
    if (Date.now() - last < CLIENT_THROTTLE_MS) return;
    localStorage.setItem(LS_KEY, String(Date.now()));
    fetch("/api/guidance/nudge", { method: "POST", cache: "no-store" }).catch(() => {});
  }, []);
  return null;
}
