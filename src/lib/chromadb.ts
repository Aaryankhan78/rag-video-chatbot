import { CloudClient, Collection } from "chromadb";

let client: CloudClient | null = null;
let collection: Collection | null = null;

const COLLECTION_NAME =
  process.env.CHROMA_COLLECTION || "video_chunks";

function getChromaClient(): CloudClient {
  if (client) return client;

  client = new CloudClient({
    apiKey: process.env.CHROMA_API_KEY,
    tenant: process.env.CHROMA_TENANT,
    database: process.env.CHROMA_DATABASE,
  });

  return client;
}

export async function getChromaCollection(): Promise<Collection> {
  if (collection) return collection;

  const chromaClient = getChromaClient();

  collection = await chromaClient.getOrCreateCollection({
    name: COLLECTION_NAME,
    metadata: { "hnsw:space": "cosine" },
  });

  return collection;
}

export async function resetCollection(): Promise<void> {
  const chromaClient = getChromaClient();

  try {
    await chromaClient.deleteCollection({
      name: COLLECTION_NAME,
    });
  } catch {
    // Collection may not exist yet
  }

  collection = null;

  console.log("ChromaDB collection reset");
}