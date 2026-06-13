import { NextResponse } from "next/server";
import { getQuote } from "@/lib/upstox";

export const dynamic = "force-dynamic";

export async function GET(req: Request, props: { params: Promise<{ symbol: string }> }) {
  const params = await props.params;
  const symbol = params.symbol.toUpperCase();
  const url = new URL(req.url);
  const exchange = (url.searchParams.get("exchange") === "BSE" ? "BSE" : "NSE") as "NSE" | "BSE";

  const quote = await getQuote(symbol, exchange);
  if (!quote) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(
    { data: quote },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
      },
    },
  );
}
