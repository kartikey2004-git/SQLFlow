import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { ASSIGNMENTS_TAG } from "@/services/assignment.service";

// Called by the seed job after assignments change; drops the cached /assignments page.
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || request.headers.get("x-revalidate-secret") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  revalidateTag(ASSIGNMENTS_TAG, { expire: 0 });
  return NextResponse.json({ ok: true });
}
