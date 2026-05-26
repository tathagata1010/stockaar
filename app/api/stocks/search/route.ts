import { NextResponse } from "next/server";
import { searchSymbols } from "@/lib/nse-symbols";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  return NextResponse.json({ data: searchSymbols(q, 8) });
}
