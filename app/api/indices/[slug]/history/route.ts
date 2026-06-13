import { NextResponse } from "next/server";
import { findIndexBySlug } from "@/lib/market";

const RANGE_MAP: Record<string, { range: string; interval: string }> = {
  "1d":  { range: "1d",  interval: "5m"  },
  "5d":  { range: "5d",  interval: "15m" },
  "1mo": { range: "1mo", interval: "1d"  },
  "3mo": { range: "3mo", interval: "1d"  },
  "6mo": { range: "6mo", interval: "1d"  },
  "1y":  { range: "1y",  interval: "1d"  },
  "5y":  { range: "5y",  interval: "1wk" },
};

export const revalidate = 60;

export async function GET(request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const idx = findIndexBySlug(params.slug);
  if (!idx) return NextResponse.json({ error: "Unknown index" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const rangeKey = searchParams.get("range") ?? "1mo";
  const cfg = RANGE_MAP[rangeKey] ?? RANGE_MAP["1mo"];

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(idx.yahooSymbol)}?interval=${cfg.interval}&range=${cfg.range}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; StocksbrewBot/1.0)",
        Accept: "application/json",
      },
      next: { revalidate: 60 },
    });
    if (!res.ok) return NextResponse.json({ error: `Yahoo ${res.status}` }, { status: 502 });
    const data = await res.json();
    const r = data.chart?.result?.[0];
    if (!r) return NextResponse.json({ error: "No data" }, { status: 404 });

    const ts: number[] = r.timestamp ?? [];
    const close: (number | null)[] = r.indicators?.quote?.[0]?.close ?? [];
    const meta = r.meta;

    const points = ts
      .map((t, i) => ({ t: t * 1000, p: close[i] }))
      .filter((p): p is { t: number; p: number } => typeof p.p === "number");

    return NextResponse.json({
      data: {
        range: rangeKey,
        points,
        previousClose: meta?.chartPreviousClose ?? meta?.previousClose ?? null,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
