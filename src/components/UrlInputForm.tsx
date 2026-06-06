"use client";

import { useState } from "react";

interface UrlInputFormProps {
  onSubmit: (urlA: string, urlB: string) => Promise<void>;
  loading: boolean;
}

export default function UrlInputForm({ onSubmit, loading }: UrlInputFormProps) {
  const [urlA, setUrlA] = useState("");
  const [urlB, setUrlB] = useState("");

  const handleSubmit = async () => {
    if (!urlA.trim() || !urlB.trim() || loading) return;
    await onSubmit(urlA.trim(), urlB.trim());
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-mono text-[#555] uppercase tracking-wider px-1">
            Video A · YouTube
          </label>
          <input
            type="url"
            value={urlA}
            onChange={(e) => setUrlA(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            disabled={loading}
            className="bg-[#111] border border-[#1e1e1e] rounded-xl px-4 py-3 text-[13px] text-[#ddd] placeholder-[#2a2a2a] outline-none focus:border-[#333] transition-colors font-mono disabled:opacity-50"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-mono text-[#555] uppercase tracking-wider px-1">
            Video B · Instagram
          </label>
          <input
            type="url"
            value={urlB}
            onChange={(e) => setUrlB(e.target.value)}
            placeholder="https://instagram.com/reel/..."
            disabled={loading}
            className="bg-[#111] border border-[#1e1e1e] rounded-xl px-4 py-3 text-[13px] text-[#ddd] placeholder-[#2a2a2a] outline-none focus:border-[#333] transition-colors font-mono disabled:opacity-50"
          />
        </div>
      </div>
      <div className="mt-3 flex justify-center">
        <button
          onClick={handleSubmit}
          disabled={!urlA.trim() || !urlB.trim() || loading}
          className="px-8 py-3 rounded-xl bg-[#e8ff47] text-black font-display font-600 text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#d4e83a] transition-colors flex items-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              Fetching & Embedding...
            </>
          ) : (
            "Analyze Videos →"
          )}
        </button>
      </div>
    </div>
  );
}
