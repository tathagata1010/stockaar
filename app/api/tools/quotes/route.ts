import { NextResponse } from "next/server";
import { getQuotes } from "@/lib/upstox";

export async function POST(request: Request) {
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  const symbols: string[] = Array.isArray(body?.symbols) ? body.symbols : [];
  if (symbols.length === 0) return NextResponse.json({ data: [] });
  if (symbols.length > 50) return NextResponse.json({ error: "too many symbols" }, { status: 400 });

  const items = symbols.map((s) => ({
    symbol: String(s).toUpperCase().trim(),
    exchange: "NSE" as const,
  }));
  const quotes = await getQuotes(items);
  return NextResponse.json({ data: quotes });
}
