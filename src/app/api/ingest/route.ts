import { NextRequest, NextResponse } from "next/server";
import { fetchVideoData } from "@/lib/transcript";
import { ingestVideoChunks } from "@/lib/langchain";
import { resetCollection } from "@/lib/chromadb";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { urlA, urlB } = await req.json();

    if (!urlA || !urlB) {
      return NextResponse.json(
        { error: "Both urlA and urlB are required" },
        { status: 400 }
      );
    }

    // clear old data so we're not mixing chunks from previous sessions
    await resetCollection();

    // fetch both videos in parallel - saves a few seconds
    const [videoA, videoB] = await Promise.all([
      fetchVideoData(urlA, "A"),
      fetchVideoData(urlB, "B"),
    ]);

    // ingest transcripts into vector DB
    const [chunksA, chunksB] = await Promise.all([
      ingestVideoChunks(videoA.transcript, "A", {
        title: videoA.title,
        creator: videoA.creator,
        views: videoA.views,
        likes: videoA.likes,
        comments: videoA.comments,
        engagementRate: videoA.engagementRate,
        platform: videoA.platform,
      }),
      ingestVideoChunks(videoB.transcript, "B", {
        title: videoB.title,
        creator: videoB.creator,
        views: videoB.views,
        likes: videoB.likes,
        comments: videoB.comments,
        engagementRate: videoB.engagementRate,
        platform: videoB.platform,
      }),
    ]);

    return NextResponse.json({
      success: true,
      videoA: { ...videoA, transcript: videoA.transcript.substring(0, 300) + "..." },
      videoB: { ...videoB, transcript: videoB.transcript.substring(0, 300) + "..." },
      chunksIngested: { A: chunksA, B: chunksB },
    });
  } catch (err) {
    console.error("ingest error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ingest failed" },
      { status: 500 }
    );
  }
}
