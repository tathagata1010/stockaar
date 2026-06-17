import { NextResponse } from "next/server";
import { fetchCorporateActions } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET(request: Request, props: { params: Promise<{ symbol: string }> }) {
  const params = await props.params;
  const { searchParams } = new URL(request.url);
  const exchange = (searchParams.get("exchange") ?? "NSE") as "NSE" | "BSE";
  const actions = await fetchCorporateActions(params.symbol, exchange);
  return NextResponse.json({ data: actions });
}
