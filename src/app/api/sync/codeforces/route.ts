import { NextRequest, NextResponse } from "next/server";
import {
  isCodeforcesSuccessResponse,
  processCodeforcesSubmissions,
} from "@/lib/codeforces";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const handle = searchParams.get("handle")?.trim();

  if (!handle) {
    return NextResponse.json(
      { error: "Handle parameter is required" },
      { status: 400 },
    );
  }

  try {
    // 1. Fetch user info
    const infoRes = await fetch(
      `https://codeforces.com/api/user.info?handles=${encodeURIComponent(handle)}`,
      { next: { revalidate: 60 } },
    );

    if (!infoRes.ok) {
      return NextResponse.json(
        { error: `Codeforces API returned status ${infoRes.status}` },
        { status: 502 },
      );
    }

    const infoData = await infoRes.json();
    if (infoData.status !== "OK" || !infoData.result?.length) {
      return NextResponse.json(
        { error: `Codeforces handle '${handle}' not found` },
        { status: 404 },
      );
    }

    const user = infoData.result[0];
    const rating = user.rating || 0;
    const rank = user.rank ? `${user.rank} (${rating})` : null;

    // 2. Fetch user status / submissions with pagination & deduplication
    const BATCH_SIZE = 2500;
    const MAX_PAGES = 4; // Up to 10,000 submissions
    let from = 1;
    let hasMore = true;
    let pageCount = 0;

    const counts = { easy: 0, medium: 0, hard: 0 };
    const solvedSet = new Set<string>();
    const recentSubs: Array<{
      title: string;
      difficulty: string;
      timestamp: number;
      url: string;
    }> = [];

    while (hasMore && pageCount < MAX_PAGES) {
      pageCount++;
      if (pageCount > 1) {
        // Courteous pacing between pages to respect Codeforces rate limits
        await new Promise((r) => setTimeout(r, 250));
      }

      const statusRes = await fetch(
        `https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=${from}&count=${BATCH_SIZE}`,
        { next: { revalidate: 60 } },
      );

      if (!statusRes.ok) {
        return NextResponse.json(
          { error: `Codeforces submissions endpoint returned status ${statusRes.status}` },
          { status: 502 },
        );
      }

      const statusData = await statusRes.json();
      if (!isCodeforcesSuccessResponse(statusData)) {
        return NextResponse.json(
          { error: (statusData && typeof statusData === "object" && "comment" in statusData && typeof statusData.comment === "string") ? statusData.comment : "Codeforces submissions query failed" },
          { status: 502 },
        );
      }

      const submissions = statusData.result;
      if (submissions.length === 0) {
        hasMore = false;
        break;
      }

      processCodeforcesSubmissions(submissions, solvedSet, recentSubs, counts);

      if (submissions.length < BATCH_SIZE) {
        hasMore = false;
      } else {
        from += BATCH_SIZE;
      }
    }

    const totalSolved = solvedSet.size;
    const easyCount = counts.easy;
    const medCount = counts.medium;
    const hardCount = counts.hard;

    return NextResponse.json({
      platform: "Codeforces",
      handle,
      rating,
      total_solved: totalSolved,
      easy_solved: easyCount,
      medium_solved: medCount,
      hard_solved: hardCount,
      rank,
      recent_submissions: recentSubs,
      message: `Synced Codeforces handle ${handle}. Total distinct problems: ${totalSolved}`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json(
      { error: `Failed to connect to Codeforces: ${errorMsg}` },
      { status: 500 },
    );
  }
}

