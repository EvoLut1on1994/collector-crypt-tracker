import { NextResponse } from "next/server";

import { getPortfolio } from "@/lib/portfolio";
import { AppError } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.trim();

  if (!address) {
    return NextResponse.json(
      { message: "请先输入 Solana 地址。", code: "ADDRESS_REQUIRED" },
      { status: 400 },
    );
  }

  try {
    const portfolio = await getPortfolio(address);
    return NextResponse.json(portfolio);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        {
          message: error.message,
          code: error.code,
        },
        { status: error.status },
      );
    }

    const fallbackMessage =
      error instanceof Error && process.env.NODE_ENV !== "production"
        ? `查询失败：${error.message}`
        : "查询失败，请稍后再试。";

    return NextResponse.json(
      {
        message: fallbackMessage,
        code: "UNKNOWN_ERROR",
      },
      { status: 500 },
    );
  }
}
