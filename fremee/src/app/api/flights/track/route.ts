export const dynamic = "force-static";
import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ error: "not available in mobile build" }, { status: 404 });
}
