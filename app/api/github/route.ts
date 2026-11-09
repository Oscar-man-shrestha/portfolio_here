// /api/github: the live GitHub data an open page polls every minute (lib/live): the contribution calendar and the
// merged or lined-up pull requests. Cached for a minute at the edge, so however many visitors are reading, GitHub is
// asked about once a minute.
import { NextResponse } from "next/server";
import { readLive } from "@/lib/github";

export async function GET() {
  try {
    return NextResponse.json(await readLive(), { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch {
    // the page keeps showing what it has
    return NextResponse.json({ error: "GitHub unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
