"use client";

import { useState, useRef, useEffect } from "react";
import { VideoMetadata } from "@/lib/transcript";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{
    videoId: string;
    chunkIndex: number;
    text: string;
    relevanceScore: number;
  }>;
}

const SUGGESTED_QUESTIONS = [
  "Why did Video A get more engagement than Video B?",
  "Compare the hooks in the first 5 seconds",
  "What's the engagement rate of each video?",
  "Suggest improvements for the lower-performing video",
  "Who are the creators and what's their follower count?",
];

interface ChatPanelProps {
  videoMetadata: VideoMetadata[];
  disabled?: boolean;
}

export default function ChatPanel({ videoMetadata, disabled }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (question?: string) => {
    const q = (question || input).trim();
    if (!q || isStreaming || disabled) return;

    const userMsg: Message = { role: "user", content: q };
    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setInput("");
    setIsStreaming(true);

    // placeholder for streaming response
    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages([...updatedHistory, assistantMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          history: messages, // send full history for memory
          videoMetadata,
        }),
      });

      if (!res.ok) throw new Error("Chat request failed");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullText = "";
      let sources: Message["sources"] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;

        // parse sources marker out of stream
        const sourceMarker = "__SOURCES__";
        if (fullText.includes(sourceMarker)) {
          const [textPart, sourcePart] = fullText.split(sourceMarker);
          fullText = textPart;
          try {
            sources = JSON.parse(sourcePart);
          } catch {
            // sources parse failed, not critical
          }
        }

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: fullText.replace(sourceMarker, "").split("__SOURCES__")[0],
            sources,
          };
          return updated;
        });
      }
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Something went wrong. Check the console and make sure ChromaDB is running.",
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d] rounded-2xl border border-[#1e1e1e] overflow-hidden">
      {/* header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
        <div>
          <h2 className="font-display font-700 text-[15px] text-[#f0f0f0]">
            RAG Chat
          </h2>
          <p className="text-[11px] text-[#555] font-mono mt-0.5">
            {messages.length > 0
              ? `${messages.length} messages · memory active`
              : "Ask anything about the videos"}
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="text-[11px] text-[#444] hover:text-[#666] font-mono transition-colors"
          >
            clear
          </button>
        )}
      </div>

      {/* messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-3 pt-2">
            <p className="text-[#444] text-xs font-mono text-center pb-2">
              suggested questions
            </p>
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                disabled={disabled}
                className="w-full text-left px-4 py-3 rounded-xl border border-[#1a1a1a] bg-[#111] hover:border-[#2a2a2a] hover:bg-[#141414] text-[13px] text-[#888] hover:text-[#bbb] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-slide-up`}
          >
            <div
              className={`max-w-[85%] ${
                msg.role === "user"
                  ? "bg-[#e8ff47] text-black rounded-2xl rounded-br-md px-4 py-2.5"
                  : "bg-[#161616] text-[#ddd] rounded-2xl rounded-bl-md px-4 py-3 border border-[#1e1e1e]"
              }`}
            >
              {msg.role === "user" ? (
                <p className="text-sm font-500 font-display">{msg.content}</p>
              ) : (
                <div className="space-y-2">
                  <p
                    className={`text-[13px] leading-relaxed whitespace-pre-wrap ${
                      isStreaming && i === messages.length - 1 && !msg.content
                        ? "streaming-cursor"
                        : isStreaming && i === messages.length - 1
                        ? "streaming-cursor"
                        : ""
                    }`}
                  >
                    {msg.content || (isStreaming ? "" : "...")}
                  </p>

                  {/* sources */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="pt-2 border-t border-[#222] space-y-1.5">
                      <p className="text-[10px] text-[#444] font-mono uppercase tracking-wider">
                        sources
                      </p>
                      {msg.sources.slice(0, 3).map((src, si) => (
                        <div
                          key={si}
                          className="px-2.5 py-1.5 rounded-lg bg-[#0f0f0f] border border-[#1a1a1a]"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-mono text-[#e8ff47]">
                              Video {src.videoId} · Chunk {src.chunkIndex}
                            </span>
                            <span className="text-[10px] font-mono text-[#444]">
                              {(src.relevanceScore * 100).toFixed(0)}% match
                            </span>
                          </div>
                          <p className="text-[11px] text-[#555] line-clamp-2">
                            {src.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {isStreaming && messages[messages.length - 1]?.role === "assistant" && !messages[messages.length - 1]?.content && (
          <div className="flex justify-start">
            <div className="bg-[#161616] border border-[#1e1e1e] rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-[#e8ff47] animate-pulse2"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* input */}
      <div className="p-4 border-t border-[#1a1a1a]">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? "Load videos first..." : "Ask about the videos..."}
            disabled={disabled || isStreaming}
            rows={1}
            className="flex-1 resize-none bg-[#111] border border-[#1e1e1e] rounded-xl px-4 py-3 text-[13px] text-[#ddd] placeholder-[#333] outline-none focus:border-[#2a2a2a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-body max-h-32 overflow-y-auto"
            style={{ lineHeight: "1.5" }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isStreaming || disabled}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#e8ff47] text-black flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#d4e83a] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 12V4M8 4L4 8M8 4L12 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-[#333] font-mono mt-2 text-center">
          enter to send · shift+enter for newline · memory across turns
        </p>
      </div>
    </div>
  );
}
