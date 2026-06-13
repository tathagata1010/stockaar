// Parse NSE/BSE quarterly shareholding-pattern XBRL filings.
//
// The basic NSE corporate-share-holdings-master endpoint only gives the
// top-level Promoter/Public/EmployeeTrust split. The FII/DII/MF/Retail
// breakdown lives in the linked XBRL file (link in the `xbrl` field of each
// master-endpoint row). Filings are immutable once published, so we cache
// each parsed quarter forever (30d for safety against schema drift).

import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import { redis } from "./redis";
import { fetchScreenerShareholding } from "./screener-shp";
import { getNseCookie, NSE_UA, parseNseDate } from "./shareholding";

export type ShareholdingBreakdown = {
  asOnDate: string; // ISO date like "2026-03-31"
  promoter: number;
  fii: number;
  dii: number;
  mf: number;
  insurance: number;
  banksFi: number;
  retail: number;
  bodies: number;
  others: number;
};

export type ShareholdingTimeline = {
  quarters: ShareholdingBreakdown[]; // oldest → newest
  latest: ShareholdingBreakdown | null;
  latestXbrlUrl: string | null;
};

const TIMELINE_TTL_SECONDS = 60 * 60 * 24;
const TIMELINE_EMPTY_TTL_SECONDS = 60 * 10;
const QUARTER_TTL_SECONDS = 60 * 60 * 24 * 30;
const QUARTER_CONCURRENCY = 4;
const DEFAULT_QUARTERS = 8;

function timelineKey(symbol: string, quarters: number) {
  return `shp-timeline:NSE:${symbol}:q${quarters}:v4`;
}
function quarterKey(xbrlUrl: string) {
  const hash = createHash("sha1").update(xbrlUrl).digest("hex").slice(0, 16);
  return `shp-quarter:${hash}:v2`;
}

// Strip "in-bse-shp:" / "in-nse-shp:" namespace and trailing "Member".
function memberName(raw: string): string {
  const stripped = raw.replace(/^[^:]+:/, "");
  return stripped.endsWith("Member") ? stripped.slice(0, -"Member".length) : stripped;
}

// Some context IDs are like "MutualFundsOrUTI_ContextI" — convert to the
// matching Member name we'd see in the explicitMember dimension.
function contextIdToMember(id: string): string {
  return id.replace(/_Context[DI]?$/, "");
}

type ContextMap = Map<string, string>; // contextId → category member name

function buildContextMap(contexts: unknown): ContextMap {
  const map: ContextMap = new Map();
  const arr = Array.isArray(contexts) ? contexts : contexts ? [contexts] : [];
  for (const c of arr) {
    if (!c || typeof c !== "object") continue;
    const id = (c as Record<string, unknown>)["@_id"];
    if (typeof id !== "string") continue;

    let categoryRaw: string | null = null;
    const scenario = (c as Record<string, unknown>)["xbrli:scenario"] ?? (c as Record<string, unknown>).scenario;
    if (scenario && typeof scenario === "object") {
      const em = (scenario as Record<string, unknown>)["xbrldi:explicitMember"] ?? (scenario as Record<string, unknown>).explicitMember;
      const emArr = Array.isArray(em) ? em : em ? [em] : [];
      for (const e of emArr) {
        if (!e || typeof e !== "object") continue;
        const dim = (e as Record<string, unknown>)["@_dimension"];
        if (typeof dim === "string" && dim.endsWith("CategoryOfShareholdersAxis")) {
          const text = (e as Record<string, unknown>)["#text"];
          if (typeof text === "string") {
            categoryRaw = text;
            break;
          }
        }
      }
    }
    map.set(id, categoryRaw ? memberName(categoryRaw) : memberName(contextIdToMember(id)));
  }
  return map;
}

// Collect ShareholdingAsAPercentageOfTotalNumberOfShares facts → { member: pct }.
// SEBI's taxonomy is inconsistent across vintages: some filings store values as
// decimals (0–1) and others as percentages (0–100). We detect by sampling the
// max raw value — anything > 1.5 can only be a percentage already.
function collectPctByMember(root: Record<string, unknown>, contextMap: ContextMap): Map<string, number> {
  type Raw = { member: string; raw: number };
  const raws: Raw[] = [];
  for (const [key, value] of Object.entries(root)) {
    if (!/ShareholdingAsAPercentageOfTotalNumberOfShares$/.test(key)) continue;
    const arr = Array.isArray(value) ? value : [value];
    for (const f of arr) {
      if (!f || typeof f !== "object") continue;
      const ctx = (f as Record<string, unknown>)["@_contextRef"];
      const text = (f as Record<string, unknown>)["#text"];
      if (typeof ctx !== "string") continue;
      const member = contextMap.get(ctx);
      if (!member) continue;
      const raw = typeof text === "number" ? text : typeof text === "string" ? parseFloat(text) : NaN;
      if (!Number.isFinite(raw)) continue;
      raws.push({ member, raw });
    }
  }
  const maxRaw = raws.reduce((m, r) => Math.max(m, r.raw), 0);
  const scale = maxRaw > 1.5 ? 1 : 100;
  const out = new Map<string, number>();
  for (const { member, raw } of raws) {
    const pct = raw * scale;
    const prev = out.get(member);
    if (prev == null || pct > prev) out.set(member, pct);
  }
  return out;
}

function findAsOnDate(root: Record<string, unknown>): string {
  const contexts = root["xbrli:context"] ?? (root as Record<string, unknown>).context;
  const arr = Array.isArray(contexts) ? contexts : contexts ? [contexts] : [];
  for (const c of arr) {
    if (!c || typeof c !== "object") continue;
    const id = (c as Record<string, unknown>)["@_id"];
    if (id !== "MainI" && id !== "MainD") continue;
    const period = (c as Record<string, unknown>)["xbrli:period"] ?? (c as Record<string, unknown>).period;
    if (!period || typeof period !== "object") continue;
    const instant = (period as Record<string, unknown>)["xbrli:instant"] ?? (period as Record<string, unknown>).instant;
    const endDate = (period as Record<string, unknown>)["xbrli:endDate"] ?? (period as Record<string, unknown>).endDate;
    if (typeof instant === "string") return instant;
    if (typeof endDate === "string") return endDate;
  }
  return "";
}

function aggregate(byMember: Map<string, number>): Omit<ShareholdingBreakdown, "asOnDate"> {
  const g = (name: string) => byMember.get(name) ?? 0;
  const sum = (...names: string[]) => names.reduce((a, n) => a + g(n), 0);

  // SEBI taxonomy publishes parent aggregates inside the XBRL — use them directly
  // instead of summing leaf rows (more robust to schema additions over time).
  const promoter = g("ShareholdingOfPromoterAndPromoterGroup");
  const fii = g("InstitutionsForeign");
  const dii = g("InstitutionsDomestic");
  const mf = g("MutualFundsOrUTI");
  const insurance = g("InsuranceCompanies");
  const banksFi = g("Banks") + g("OtherFinancialInstitutions") + g("NBFCsRegisteredWithRBI");
  const retail = sum(
    "ResidentIndividualShareholdersHoldingNominalShareCapitalUpToRsTwoLakh",
    "ResidentIndividualShareholdersHoldingNominalShareCapitalInExcessOfRsTwoLakh",
    "IndividualsOrHinduUndividedFamily",
    "NonResidentIndians",
  );
  const bodies = g("BodiesCorporate");

  // Whatever's left over after the named buckets — usually Employee Trust,
  // Custodian/DR shares, IEPF, Director/KMP holdings, rounding.
  const knownSum = promoter + fii + dii + retail + bodies;
  const others = Math.max(0, 100 - knownSum);

  return { promoter, fii, dii, mf, insurance, banksFi, retail, bodies, others };
}

export function parseShpXbrl(xml: string): ShareholdingBreakdown | null {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      removeNSPrefix: false,
      parseTagValue: false,
      parseAttributeValue: false,
    });
    const json = parser.parse(xml) as Record<string, unknown>;
    const root = (json["xbrli:xbrl"] ?? json.xbrl ?? json) as Record<string, unknown>;
    const contexts = root["xbrli:context"] ?? root.context;
    const contextMap = buildContextMap(contexts);
    if (contextMap.size === 0) return null;
    const byMember = collectPctByMember(root, contextMap);
    if (byMember.size === 0) return null;
    const asOnDate = findAsOnDate(root);
    if (!asOnDate) return null;
    const agg = aggregate(byMember);
    if (agg.promoter === 0 && agg.fii === 0 && agg.dii === 0 && agg.retail === 0) {
      return null;
    }
    return { asOnDate, ...agg };
  } catch (e) {
    console.warn("[xbrl-shp] parse error", e);
    return null;
  }
}

async function fetchQuarterBreakdown(xbrlUrl: string): Promise<ShareholdingBreakdown | null> {
  const cKey = quarterKey(xbrlUrl);
  const cached = await redis.get<ShareholdingBreakdown>(cKey).catch(() => null);
  if (cached) return cached;

  try {
    const res = await fetch(xbrlUrl, {
      headers: { "User-Agent": NSE_UA, Accept: "application/xml, text/xml, */*" },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      console.warn("[xbrl-shp] HTTP " + res.status + " for " + xbrlUrl);
      return null;
    }
    const xml = await res.text();
    const parsed = parseShpXbrl(xml);
    if (parsed) {
      redis.set(cKey, parsed, { ex: QUARTER_TTL_SECONDS }).catch(() => {});
    }
    return parsed;
  } catch (e) {
    console.warn("[xbrl-shp] fetch error for " + xbrlUrl, e);
    return null;
  }
}

// NSE returns "31-MAR-2026" style dates — sortable epoch for ordering.
async function listFilings(symbol: string): Promise<{ xbrlUrl: string; asOnDate: string }[]> {
  const cookie = await getNseCookie();
  if (!cookie) return [];
  const url = `https://www.nseindia.com/api/corporate-share-holdings-master?index=equities&symbol=${encodeURIComponent(symbol)}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": NSE_UA,
        Accept: "application/json, text/plain, */*",
        Cookie: cookie,
        Referer: `https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(symbol)}`,
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const rows = (Array.isArray(data) ? data : data?.data) as Record<string, unknown>[] | undefined;
    if (!Array.isArray(rows)) return [];
    return rows
      .filter((r) => typeof r.xbrl === "string" && typeof r.date === "string")
      .map((r) => ({ xbrlUrl: r.xbrl as string, asOnDate: r.date as string }))
      .sort((a, b) => parseNseDate(b.asOnDate) - parseNseDate(a.asOnDate));
  } catch {
    return [];
  }
}

export async function getShareholdingTimeline(
  symbol: string,
  quarters = DEFAULT_QUARTERS,
): Promise<ShareholdingTimeline> {
  const tKey = timelineKey(symbol, quarters);
  const cached = await redis.get<ShareholdingTimeline>(tKey).catch(() => null);
  if (cached) return cached;

  // Primary: screener.in HTML scrape. Works from Vercel/AWS data-center IPs
  // (NSE blocks those, so the XBRL pipeline below is a local-dev/best-effort
  // fallback). Screener gives Promoter/FII/DII/Public/Others — enough for the
  // pie + timeline tiles the UI renders.
  try {
    const screener = await fetchScreenerShareholding(symbol);
    if (screener.quarters.length > 0) {
      const trimmed: ShareholdingTimeline = {
        ...screener,
        quarters: screener.quarters.slice(-quarters),
      };
      redis.set(tKey, trimmed, { ex: TIMELINE_TTL_SECONDS }).catch(() => {});
      return trimmed;
    }
  } catch (e) {
    console.warn("[shp] screener error, falling back to NSE XBRL", e);
  }

  const filings = (await listFilings(symbol)).slice(0, quarters);
  if (filings.length === 0) {
    const empty: ShareholdingTimeline = { quarters: [], latest: null, latestXbrlUrl: null };
    redis.set(tKey, empty, { ex: TIMELINE_EMPTY_TTL_SECONDS }).catch(() => {});
    return empty;
  }

  const results: (ShareholdingBreakdown | null)[] = new Array(filings.length);
  for (let i = 0; i < filings.length; i += QUARTER_CONCURRENCY) {
    const batch = filings.slice(i, i + QUARTER_CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map((f) => fetchQuarterBreakdown(f.xbrlUrl)),
    );
    settled.forEach((r, j) => {
      results[i + j] = r.status === "fulfilled" ? r.value : null;
    });
  }

  // Oldest → newest for the timeline chart.
  const parsed = results.filter((b): b is ShareholdingBreakdown => b != null);
  parsed.sort((a, b) => Date.parse(a.asOnDate) - Date.parse(b.asOnDate));
  const timeline: ShareholdingTimeline = {
    quarters: parsed,
    latest: parsed.length ? parsed[parsed.length - 1] : null,
    latestXbrlUrl: filings[0].xbrlUrl,
  };
  const ttl = parsed.length > 0 ? TIMELINE_TTL_SECONDS : TIMELINE_EMPTY_TTL_SECONDS;
  redis.set(tKey, timeline, { ex: ttl }).catch(() => {});
  return timeline;
}
