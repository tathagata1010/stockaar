import { NextResponse } from "next/server";
import { fetchYahooHistory, type HistoryRange } from "@/lib/history";

export const dynamic = "force-dynamic";

export async function GET(request: Request, props: { params: Promise<{ symbol: string }> }) {
  const params = await props.params;
  const { searchParams } = new URL(request.url);
  const range = (searchParams.get("range") ?? "1mo") as HistoryRange;
  const exchange = (searchParams.get("exchange") ?? "NSE") as "NSE" | "BSE";

  const result = await fetchYahooHistory(params.symbol, exchange, range);
  if (!result) return NextResponse.json({ error: "No data" }, { status: 502 });
  return NextResponse.json({ data: result });
}
