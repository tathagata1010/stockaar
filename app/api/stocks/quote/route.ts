import { NextResponse } from "next/server";
import { getQuote } from "@/lib/upstox";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") ?? "").toUpperCase();
  const exchange = (searchParams.get("exchange") ?? "NSE") as "NSE" | "BSE";
  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });
  const quote = await getQuote(symbol, exchange);
  if (!quote) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  return NextResponse.json({ data: quote });
}
