import { NextResponse } from "next/server";

import { getAltResearchByCertificate } from "@/lib/alt-card";
import { AppError } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const certificateNumber = searchParams.get("certificateNumber")?.trim();

  if (!certificateNumber) {
    return NextResponse.json(
      {
        message: "请先提供证书编号。",
        code: "ALT_CERT_REQUIRED",
      },
      { status: 400 },
    );
  }

  try {
    const result = await getAltResearchByCertificate(certificateNumber);
    return NextResponse.json(result);
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

    return NextResponse.json(
      {
        message: "Alt 数据查询失败，请稍后重试。",
        code: "ALT_UNKNOWN_ERROR",
      },
      { status: 500 },
    );
  }
}
