import { NextResponse } from "next/server";
import { getShareholdingTimeline } from "@/lib/xbrl-shp";
import { fetchScreenerShareholding } from "@/lib/screener-shp";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, props: { params: Promise<{ symbol: string }> }) {
  const params = await props.params;
  const symbol = params.symbol.toUpperCase();

  const [screener, combined] = await Promise.all([
    fetchScreenerShareholding(symbol).catch((e) => ({ error: String(e) })),
    getShareholdingTimeline(symbol).catch((e) => ({ error: String(e) })),
  ]);

  return NextResponse.json({ symbol, screener, combined }, {
    headers: { "Cache-Control": "no-store" },
  });
}
