import { NextRequest } from "next/server";
import { streamRAGResponse, ChatMessage } from "@/lib/langchain";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { question, history, videoMetadata } = await req.json();

    if (!question?.trim()) {
      return new Response("Question is required", { status: 400 });
    }

    // streaming response using ReadableStream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const ragStream = streamRAGResponse(
            question,
            (history as ChatMessage[]) || [],
            videoMetadata || []
          );

          for await (const chunk of ragStream) {
            controller.enqueue(encoder.encode(chunk));
          }
        } catch (err) {
          console.error("stream error:", err);
          controller.enqueue(
            encoder.encode("\n\n[Error generating response. Check API key and ChromaDB connection.]")
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("chat route error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
