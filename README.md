# rag-video-chatbot

take-home challenge submission. the task was to build a RAG chatbot that compares two social media videos. ended up being more interesting than I expected, mostly because of how locked down Instagram's API is.

---

## what it does

paste two video URLs. it fetches the transcripts and real metadata — views, likes, comments, subscriber count — chunks the transcripts, embeds them into ChromaDB, and then you can chat with the data.

useful questions it can answer:
- why did one video outperform the other
- what was the hook in the first 5 seconds
- who's the creator and how many followers do they have
- what should the lower-performing video do differently

everything is grounded in the actual transcript content, with source citations showing which video and chunk each answer came from.

---

## stack and why

**Next.js 14** for everything — didn't want a separate FastAPI service. route handlers handle all the backend logic. less moving parts.

**LangChain.js** for the RAG chain. handles prompt templating, message history, streaming.

**Groq + Llama 3.3 70B** as the LLM. I tried GPT-4o first but the streaming speed difference is just too noticeable. Groq runs at around 800 tokens/sec, GPT-4o is maybe 50. for a chat interface that difference matters a lot. quality on transcript Q&A tasks is close enough.

**ChromaDB** as the vector store. running it locally via Docker. Pinecone free tier only gives you one index and the latency is inconsistent. ChromaDB local is faster for this scale and the setup is one command.

**Cohere embed-multilingual-v3.0** for embeddings. two reasons I picked this over OpenAI — it handles Hindi/English mixed content better which matters for Indian creator content, and the free tier is 1000 calls/min which is actually usable. OpenAI embeddings are pay-per-token from day one.

**YouTube Data API v3** for real stats. YouTube removed public like counts in 2021 so you can't just scrape the page anymore. needed authenticated API calls to get accurate numbers.

---

## setup

things you need:
- Node.js 18+
- Docker
- Groq API key (free at console.groq.com)
- YouTube Data API v3 key (free at console.cloud.google.com)
- Cohere API key (free at cohere.com)

```bash
git clone <repo>
cd rag-video-chatbot
npm install --legacy-peer-deps
cp .env.example .env.local
```

fill in `.env.local` — there's a `.env.example` with all the keys you need.

start ChromaDB:
```bash
docker run -p 8000:8000 chromadb/chroma
```

then:
```bash
npm run dev
```

open localhost:3000, paste two URLs, hit analyze.

---

## how the RAG pipeline works

ingest:
1. fetch transcript via YouTube captions API
2. fetch real metadata via YouTube Data API v3
3. split transcript into 500-token chunks with 50-token overlap
4. embed each chunk with Cohere (search_document input type)
5. store in ChromaDB tagged with video_id A or B

chat:
1. embed the question with Cohere (search_query input type — different from document embedding, matters for retrieval quality)
2. cosine similarity search → top 6 chunks
3. build context with metadata summary + retrieved chunks
4. stream through Groq
5. append source citations

full message history goes with every request so follow-up questions work.

---

## some decisions worth explaining

**500 token chunk size**

tested a few values. 200 was too small — single sentences without context, retrieval got noisy. 800 had the opposite problem, too much unrelated content per chunk which diluted relevance scores. 500 with 50 token overlap hits the right balance for transcript content specifically. the overlap means sentences at chunk boundaries don't get cut off.

**why Cohere over HuggingFace BGE**

originally had HuggingFace inference API in here. kept getting blocked on certain networks during testing — turns out some corporate/ISP setups block the HF inference endpoint. switched to Cohere which is more reliable and honestly better for multilingual content anyway.

**ChromaDB data persistence**

by default the Docker container loses data when stopped. if you want persistence across restarts:
```bash
docker run -p 8000:8000 -v ./chroma_data:/chroma/chroma chromadb/chroma
```

---

## the Instagram problem

the task asked for Instagram Reels. spent real time on this. here's what actually happened:

tried the oembed endpoint — gives you title and author name, nothing else. no stats, no transcript.

tried page scraping — Instagram blocks it fast. occasionally og:image comes through but nothing useful for RAG.

tried yt-dlp — works maybe half the time. Instagram has gotten aggressive about blocking it and it's unpredictable enough that I wouldn't ship it in production.

for production Instagram support the real options are:
- Apify scraper (~$0.001/reel, reliable)
- official Meta Graph API (requires Meta business approval, takes weeks)
- yt-dlp + Whisper when it works (~30s per reel for transcription)

the RAG pipeline itself doesn't change for Instagram — same chunking, same embeddings, same everything. it's purely a data sourcing problem. for the demo I used YouTube for both videos so the full pipeline runs end to end without hitting Instagram's walls.

---

## scaling to 1000 creators/day

| thing | now | at scale |
|---|---|---|
| vector DB | ChromaDB local | Qdrant Cloud (~$25/mo) |
| embeddings | Cohere free | Cohere paid (~$0.10/1M tokens) |
| LLM | Groq free tier | Groq paid (~$5-10/day) |
| Instagram | oembed fallback | Apify (~$1/1000 reels) |
| transcripts | youtube-transcript lib | same, it's reliable |

rough total at 1k/day: somewhere between $200-400/month. manageable for a B2B product.

what actually breaks first at scale isn't the infra — it's Instagram. no clean cheap solution without official API access.

---

## things that are rough around the edges

instagram transcript is a placeholder. the real fix is yt-dlp + Whisper but that needs a more robust retry/fallback setup than I had time for.

like counts occasionally come back as 0 for older videos. YouTube API sometimes omits likeCount — falls back to 0, nothing I can do about it on my end.

no rate limiting on the API endpoints. fine for local use, would need that before any public deployment.

---

## what I'd do differently with more time

actually implement yt-dlp + Whisper for Instagram — it's the right solution, just needs more error handling and retry logic than I built here.

async ingestion with progress updates. right now it blocks until both videos are fully processed which takes a while for longer videos.

better engagement rate calculation. likes + comments / views is the spec but watch time and shares tell a more complete story.

multi-video support. comparing more than two at once would be genuinely useful.
