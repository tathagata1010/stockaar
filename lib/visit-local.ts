"use client";

// localStorage-backed daily-return tracking. IST-day aware.
// v1: client-only — no server persistence, no cross-device sync.
// v2 upgrade path: mirror to profiles.last_seen_at_ist + streak_days columns.

const KEY_LAST = "sb:lastVisitIST";
const KEY_STREAK = "sb:streak";
const KEY_LONGEST = "sb:longestStreak";
const KEY_SNAPSHOT = "sb:snapshot";
const KEY_LAST_TOAST = "sb:lastToastDay";

const IST_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function istDay(date = new Date()): string {
  return IST_DAY.format(date);
}

function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function write(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key, value); } catch {}
}

function readNum(key: string, fallback = 0): number {
  const v = read(key);
  if (v === null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export type StreakInfo = {
  streak: number;
  longest: number;
  isFirstToday: boolean;
  prevDay: string | null;
};

// Idempotent per IST day. Computes the new streak, persists it, returns the state.
export function bumpVisit(): StreakInfo {
  const today = istDay();
  const last = read(KEY_LAST);
  const cur = readNum(KEY_STREAK, 0);
  const longest = readNum(KEY_LONGEST, 0);

  if (last === today) {
    return { streak: cur, longest: Math.max(longest, cur), isFirstToday: false, prevDay: last };
  }

  let next = 1;
  if (last) {
    const yesterday = istDay(new Date(Date.now() - 24 * 60 * 60 * 1000));
    if (last === yesterday) next = cur + 1;
  }
  const nextLongest = Math.max(longest, next);
  write(KEY_LAST, today);
  write(KEY_STREAK, String(next));
  write(KEY_LONGEST, String(nextLongest));
  return { streak: next, longest: nextLongest, isFirstToday: true, prevDay: last };
}

export function getStreakSnapshot(): { streak: number; longest: number; lastDay: string | null } {
  return {
    streak: readNum(KEY_STREAK, 0),
    longest: readNum(KEY_LONGEST, 0),
    lastDay: read(KEY_LAST),
  };
}

export type Snapshot = Record<string, { price: number; ts: number }>;

export function getSnapshot(): Snapshot {
  const raw = read(KEY_SNAPSHOT);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Snapshot;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function markSnapshot(rows: { symbol: string; price: number }[]): void {
  if (typeof window === "undefined" || rows.length === 0) return;
  const existing = getSnapshot();
  const ts = Date.now();
  let touched = false;
  for (const r of rows) {
    if (!r.symbol || !Number.isFinite(r.price)) continue;
    existing[r.symbol] = { price: r.price, ts };
    touched = true;
  }
  if (touched) write(KEY_SNAPSHOT, JSON.stringify(existing));
}

// One-shot daily lock — guards multi-tab toast spam. Sets the flag before returning.
export function claimDailyToast(): boolean {
  if (typeof window === "undefined") return false;
  const today = istDay();
  const last = read(KEY_LAST_TOAST);
  if (last === today) return false;
  write(KEY_LAST_TOAST, today);
  return true;
}
