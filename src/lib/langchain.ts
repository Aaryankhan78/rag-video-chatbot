import { ChatGroq } from "@langchain/groq";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { getChromaCollection } from "./chromadb";
import { embedQuery, embedTexts } from "./embeddings";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `You are an expert social media analytics assistant helping content creators understand their video performance.

You have access to transcripts, metadata, and engagement data for two videos (Video A and Video B).
When answering questions:
- Always cite which video (A or B) your information comes from
- Be specific about engagement numbers when you have them
- Give actionable, concrete advice when asked for improvements
- Keep responses focused and practical

Context from the videos will be provided to you. Use it to give accurate, grounded answers.`;

export async function* streamRAGResponse(
  question: string,
  history: ChatMessage[],
  videoMetadata: Record<string, unknown>[]
): AsyncGenerator<string> {
  const collection = await getChromaCollection();

  const queryEmbedding = await embedQuery(question);

  const results = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: 6,
    include: ["documents", "metadatas", "distances"] as any,
  });

  const chunks = results.documents[0] || [];
  const metas = results.metadatas[0] || [];
  const distances = results.distances?.[0] || [];

  const contextParts = chunks.map((chunk, i) => {
    const meta = metas[i] as Record<string, unknown>;
    const videoId = meta?.videoId || "?";
    const chunkIdx = meta?.chunkIndex || i;
    return `[Video ${videoId}, Chunk ${chunkIdx}]: ${chunk}`;
  });

  const context = contextParts.join("\n\n");

  const metaSummary = videoMetadata
    .map((v) => {
      const m = v as Record<string, unknown>;
      return `Video ${m.videoId}: "${m.title}" by ${m.creator} | Views: ${(m.views as number)?.toLocaleString()} | Likes: ${(m.likes as number)?.toLocaleString()} | Comments: ${(m.comments as number)?.toLocaleString()} | Engagement Rate: ${m.engagementRate}% | Duration: ${m.duration} | Uploaded: ${m.uploadDate} | Followers: ${m.followerCount} | Hashtags: ${(m.hashtags as string[])?.join(", ")}`;
    })
    .join("\n");

  const fullContext = `VIDEO METADATA:\n${metaSummary}\n\nTRANSCRIPT CHUNKS:\n${context}`;

  const messages = [
    new SystemMessage(SYSTEM_PROMPT),
    new SystemMessage(`Here is the relevant context:\n\n${fullContext}`),
    ...history.map((msg) =>
      msg.role === "user"
        ? new HumanMessage(msg.content)
        : new AIMessage(msg.content)
    ),
    new HumanMessage(question),
  ];

  const llm = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY!,
    model: "llama-3.3-70b-versatile",
    temperature: 0.3,
    streaming: true,
  });

  const stream = await llm.stream(messages);
  for await (const chunk of stream) {
    const text = chunk.content as string;
    if (text) yield text;
  }

  const sources = chunks.map((chunk, i) => ({
    videoId: (metas[i] as Record<string, unknown>)?.videoId as string,
    chunkIndex: (metas[i] as Record<string, unknown>)?.chunkIndex as number,
    text: (chunk || "").substring(0, 150) + "...",
    relevanceScore: parseFloat((1 - (distances[i] || 0)).toFixed(3)),
  }));

  yield `\n\n__SOURCES__${JSON.stringify(sources)}`;
}

export async function ingestVideoChunks(
  transcript: string,
  videoId: "A" | "B",
  metadata: Record<string, unknown>
): Promise<number> {
  const collection = await getChromaCollection();

  const chunkSize = 500;
  const overlap = 50;
  const words = transcript.split(/\s+/);
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(" ");
    if (chunk.trim().length > 20) chunks.push(chunk);
  }

  if (chunks.length === 0) {
    console.log(`No chunks for video ${videoId} - transcript might be empty`);
    return 0;
  }

  // embed all chunks at once - more efficient than one by one
  const embeddings = await embedTexts(chunks);

  const ids = chunks.map((_, i) => `video_${videoId}_chunk_${i}_${Date.now()}`);
  const metadatas = chunks.map((_, i) => ({
    videoId,
    chunkIndex: i,
    totalChunks: chunks.length,
    ...metadata,
  }));

  await collection.add({
    ids,
    embeddings,
    documents: chunks,
    metadatas: metadatas as Record<string, string | number | boolean>[],
  });

  console.log(`Ingested ${chunks.length} chunks for Video ${videoId}`);
  return chunks.length;
}