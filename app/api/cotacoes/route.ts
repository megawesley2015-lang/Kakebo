import { getCotacoes } from "@/lib/brapi";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tickers = (searchParams.get("tickers") || "").split(",").filter(Boolean);
  const results = await getCotacoes(tickers);
  return NextResponse.json(results);
}
