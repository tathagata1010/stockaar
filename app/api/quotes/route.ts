import { NextResponse } from "next/server";
import { getQuotes } from "@/lib/upstox";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("symbols") ?? "";
  // format: "NSE:RELIANCE,NSE:TCS,BSE:SBIN"
  const items = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((tok) => {
      const [ex, sym] = tok.includes(":") ? tok.split(":") : ["NSE", tok];
      const exchange = ex === "BSE" ? "BSE" : "NSE";
      return { symbol: sym.toUpperCase(), exchange: exchange as "NSE" | "BSE" };
    })
    .slice(0, 50);

  if (items.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const quotes = await getQuotes(items);
  return NextResponse.json(
    { data: quotes },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
      },
    },
  );
}
