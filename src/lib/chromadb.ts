import { ChromaClient, Collection } from "chromadb";

// module-level client to avoid reconnecting on every request
// learned this the hard way - was getting connection pool exhaustion under load
let client: ChromaClient | null = null;
let collection: Collection | null = null;

const COLLECTION_NAME = process.env.CHROMA_COLLECTION || "video_chunks";
const DEFAULT_CHROMA_URL = "http://127.0.0.1:8000";

function getChromaUrl(): string {
  const configuredUrl = process.env.CHROMA_URL || DEFAULT_CHROMA_URL;
  // localhost can cause issues on some setups - 127.0.0.1 is more reliable
  if (configuredUrl.startsWith("http://localhost:")) {
    return configuredUrl.replace("http://localhost:", "http://127.0.0.1:");
  }
  return configuredUrl;
}

export async function getChromaCollection(): Promise<Collection> {
  if (collection) return collection;

  client = new ChromaClient({
    path: getChromaUrl(),
  });

  // getOrCreate so we don't blow up on server restart
  collection = await client.getOrCreateCollection({
    name: COLLECTION_NAME,
    metadata: { "hnsw:space": "cosine" },
  });

  return collection;
}

export async function resetCollection(): Promise<void> {
  if (!client) {
    client = new ChromaClient({
      path: getChromaUrl(),
    });
  }
  try {
    await client.deleteCollection({ name: COLLECTION_NAME });
  } catch {
    // collection might not exist yet on first run, that's fine
  }
  collection = null;
  console.log("ChromaDB collection reset");
}