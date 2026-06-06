// using Cohere embed-multilingual-v3.0 for semantic embeddings
// tried HuggingFace inference API but it was getting blocked on certain networks
// Cohere free tier gives 1000 calls/min which is more than enough
// embed-multilingual handles Hindi/English mixed transcripts well - important for Indian creator content

import { CohereClient } from "cohere-ai";

let cohereClient: CohereClient | null = null;

function getClient(): CohereClient {
  if (!cohereClient) {
    cohereClient = new CohereClient({
      token: process.env.COHERE_API_KEY!,
    });
  }
  return cohereClient;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const client = getClient();

  // cohere has a 96 input limit per request
  // batching to handle large transcript sets
  const batchSize = 96;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    const response = await client.embed({
      texts: batch,
      model: "embed-multilingual-v3.0",
      inputType: "search_document",
    });

    const embeddings = response.embeddings;
    if (Array.isArray(embeddings)) {
      results.push(...(embeddings as number[][]));
    }
  }

  return results;
}

export async function embedQuery(text: string): Promise<number[]> {
  const client = getClient();

  // queries use search_query input type - different from documents
  // this is important for retrieval quality, cohere optimizes differently
  const response = await client.embed({
    texts: [text],
    model: "embed-multilingual-v3.0",
    inputType: "search_query",
  });

  const embeddings = response.embeddings;
  if (Array.isArray(embeddings) && embeddings.length > 0) {
    return embeddings[0] as number[];
  }

  throw new Error("Cohere embed returned empty response");
}