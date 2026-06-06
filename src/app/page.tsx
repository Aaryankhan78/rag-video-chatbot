"use client";

import { useState } from "react";
import VideoCard from "@/components/VideoCard";
import ChatPanel from "@/components/ChatPanel";
import UrlInputForm from "@/components/UrlInputForm";
import { VideoMetadata } from "@/lib/transcript";

type AppState = "idle" | "loading" | "ready" | "error";

export default function Home() {
  const [state, setState] = useState<AppState>("idle");
  const [videoA, setVideoA] = useState<VideoMetadata | null>(null);
  const [videoB, setVideoB] = useState<VideoMetadata | null>(null);
  const [error, setError] = useState<string>("");
  const [loadingStep, setLoadingStep] = useState<string>("");

  const handleAnalyze = async (urlA: string, urlB: string) => {
    setState("loading");
    setError("");
    setLoadingStep("Fetching transcripts & metadata...");

    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urlA, urlB }),
      });

      setLoadingStep("Embedding chunks into ChromaDB...");

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to process videos");
      }

      setVideoA(data.videoA);
      setVideoB(data.videoB);
      setState("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setState("error");
    }
  };

  const reset = () => {
    setState("idle");
    setVideoA(null);
    setVideoB(null);
    setError("");
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* header */}
      <header className="border-b border-[#141414] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-[#e8ff47] flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="2.5" fill="black" />
              <path d="M7 1v2M7 11v2M1 7h2M11 7h2" stroke="black" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h1 className="font-display font-700 text-sm text-[#f0f0f0]">
              VideoRAG
            </h1>
            <p className="text-[10px] text-[#444] font-mono">
              LangChain · ChromaDB · Groq
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#1a1a1a] bg-[#111]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-pulse2" />
            <span className="text-[10px] font-mono text-[#555]">
              {state === "ready" ? "vectors loaded" : "waiting for urls"}
            </span>
          </div>
          {state !== "idle" && (
            <button
              onClick={reset}
              className="text-[11px] font-mono text-[#444] hover:text-[#666] transition-colors px-2"
            >
              reset
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col px-4 py-6 gap-6 max-w-[1400px] mx-auto w-full">
        {/* URL input - always visible when not ready */}
        {state !== "ready" && (
          <div className="animate-fade-in">
            <div className="text-center mb-8">
              <h2 className="font-display font-800 text-3xl text-[#f0f0f0] mb-2">
                Compare Videos with{" "}
                <span className="text-[#e8ff47]">RAG</span>
              </h2>
              <p className="text-[#555] text-sm font-body max-w-lg mx-auto">
                Paste a YouTube and Instagram URL. We'll fetch transcripts,
                embed them into a vector DB, and let you chat with the data.
              </p>
            </div>

            <UrlInputForm
              onSubmit={handleAnalyze}
              loading={state === "loading"}
            />

            {state === "loading" && (
              <div className="text-center mt-6 animate-fade-in">
                <p className="text-[12px] font-mono text-[#555]">{loadingStep}</p>
                <div className="flex justify-center gap-1 mt-3">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-1 h-4 rounded-full bg-[#e8ff47] animate-pulse2"
                      style={{ animationDelay: `${i * 0.12}s` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {state === "error" && (
              <div className="mt-4 text-center">
                <p className="text-red-400 text-sm font-mono">{error}</p>
                <p className="text-[#444] text-xs mt-1">
                  Make sure ChromaDB is running: docker run -p 8000:8000 chromadb/chroma
                </p>
              </div>
            )}

            {/* how it works - shown on idle */}
            {state === "idle" && (
              <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
                {[
                  { n: "01", label: "Fetch", desc: "Transcripts + metadata from both URLs" },
                  { n: "02", label: "Chunk", desc: "500-token chunks with 50-token overlap" },
                  { n: "03", label: "Embed", desc: "BGE-small embeddings → ChromaDB" },
                  { n: "04", label: "Chat", desc: "RAG answers with source citations" },
                ].map((step) => (
                  <div key={step.n} className="p-4 rounded-xl border border-[#141414] bg-[#0d0d0d]">
                    <div className="font-mono text-[10px] text-[#e8ff47] mb-2">{step.n}</div>
                    <div className="font-display font-600 text-sm text-[#ddd] mb-1">{step.label}</div>
                    <div className="text-[11px] text-[#444] leading-relaxed">{step.desc}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* main content - video cards + chat */}
        {state === "ready" && videoA && videoB && (
          <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-140px)] animate-fade-in">
            {/* video cards */}
            <div className="flex flex-row lg:flex-col gap-3 lg:w-[380px] lg:overflow-y-auto lg:flex-shrink-0">
              <div className="flex-1 lg:flex-none">
                <VideoCard video={videoA} label="A" />
              </div>
              <div className="flex-1 lg:flex-none">
                <VideoCard video={videoB} label="B" />
              </div>

              {/* quick comparison */}
              <div className="hidden lg:block p-4 rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d]">
                <p className="text-[10px] font-mono text-[#444] uppercase tracking-wider mb-3">
                  Quick Compare
                </p>
                <div className="space-y-2">
                  <CompareRow
                    label="Engagement"
                    a={`${videoA.engagementRate}%`}
                    b={`${videoB.engagementRate}%`}
                    higherIsBetter
                    aVal={videoA.engagementRate}
                    bVal={videoB.engagementRate}
                  />
                  <CompareRow
                    label="Views"
                    a={videoA.views.toLocaleString()}
                    b={videoB.views.toLocaleString()}
                    higherIsBetter
                    aVal={videoA.views}
                    bVal={videoB.views}
                  />
                </div>
              </div>
            </div>

            {/* chat panel */}
            <div className="flex-1 min-h-[400px]">
              <ChatPanel
                videoMetadata={[videoA, videoB]}
                disabled={false}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function CompareRow({
  label,
  a,
  b,
  aVal,
  bVal,
  higherIsBetter,
}: {
  label: string;
  a: string;
  b: string;
  aVal: number;
  bVal: number;
  higherIsBetter: boolean;
}) {
  const aWins = higherIsBetter ? aVal >= bVal : aVal <= bVal;

  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[#444] font-mono w-20">{label}</span>
      <span className={`font-mono ${aWins ? "text-[#e8ff47]" : "text-[#555]"}`}>
        A: {a}
      </span>
      <span className={`font-mono ${!aWins ? "text-[#e8ff47]" : "text-[#555]"}`}>
        B: {b}
      </span>
    </div>
  );
}
