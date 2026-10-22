import { NextResponse } from "next/server";

export function GET() {
  return new NextResponse(null, {
    status: 307,
    headers: { Location: "/marvel-vs-capcom-2/index.html" },
  });
}
