import { NextResponse } from "next/server";
import { getFundamentals } from "@/lib/fundamentals";
import { getYahooCrumb } from "@/lib/yahoo-auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") ?? "RELIANCE").toUpperCase();
  const exchange = (searchParams.get("exchange") ?? "NSE") as "NSE" | "BSE";

  const crumb = await getYahooCrumb();
  const f = await getFundamentals(symbol, exchange);

  return NextResponse.json({
    symbol,
    exchange,
    crumb: crumb ? { hasCookie: !!crumb.cookie, crumbLen: crumb.crumb.length } : null,
    fundamentals: f,
  });
}
