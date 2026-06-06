"use client";

import { useEffect, useState } from "react";
import { VideoMetadata } from "@/lib/transcript";

interface VideoCardProps {
  video: VideoMetadata;
  label: "A" | "B";
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

export default function VideoCard({ video, label }: VideoCardProps) {
  const [thumbnailError, setThumbnailError] = useState(false);

  useEffect(() => {
    setThumbnailError(false);
  }, [video.thumbnailUrl]);

  const isWinner =
    label === "A"
      ? video.engagementRate > 0
      : false; // determined by parent

  const thumbnailSrc = video.thumbnailUrl || "";
  const shouldShowThumbnailPlaceholder = !thumbnailSrc || thumbnailError;

  return (
    <div className="relative flex flex-col gap-4 p-5 rounded-2xl border border-[#1e1e1e] bg-[#111] overflow-hidden group">
      {/* label badge */}
      <div className="absolute top-4 right-4 z-10">
        <span className="font-display text-xs font-700 px-2.5 py-1 rounded-full bg-[#e8ff47] text-black">
          VIDEO {label}
        </span>
      </div>

      {/* thumbnail */}
      {!shouldShowThumbnailPlaceholder ? (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-[#1a1a1a]">
          <img
            src={thumbnailSrc}
            alt={video.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              setThumbnailError(true);
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          {video.duration && video.duration !== "N/A" && (
            <span className="absolute bottom-2 right-2 font-mono text-xs bg-black/80 px-2 py-0.5 rounded-md text-white">
              {video.duration}
            </span>
          )}
        </div>
      ) : (
        <div className="w-full aspect-video rounded-xl bg-[#1a1a1a] border border-[#222] flex items-center justify-center px-4 text-center">
          <div className="flex flex-col items-center gap-2">
            <span className="text-2xl">📱</span>
            <span className="font-display text-sm font-600 text-[#cfcfcf]">
              Thumbnail unavailable
            </span>
          </div>
        </div>
      )}

      {/* title & creator */}
      <div>
        <h3 className="font-display font-600 text-[15px] leading-snug text-[#f0f0f0] line-clamp-2 mb-1">
          {video.title}
        </h3>
        <div className="flex items-center gap-2 text-[#666] text-xs">
          <span className="font-mono">@{video.creator}</span>
          {video.followerCount !== "N/A" && (
            <>
              <span>·</span>
              <span>{video.followerCount} followers</span>
            </>
          )}
        </div>
      </div>

      {/* stats grid */}
      <div className="grid grid-cols-3 gap-2">
        <StatBox label="Views" value={formatNumber(video.views)} />
        <StatBox label="Likes" value={formatNumber(video.likes)} />
        <StatBox label="Comments" value={formatNumber(video.comments)} />
      </div>

      {/* engagement rate - the star metric */}
      <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#0f0f0f] border border-[#1e1e1e]">
        <span className="text-xs text-[#666] font-mono uppercase tracking-wider">
          Engagement Rate
        </span>
        <span className="font-display text-xl font-700 text-[#e8ff47] stat-number">
          {video.engagementRate}%
        </span>
      </div>

      {/* hashtags */}
      {video.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {video.hashtags.slice(0, 6).map((tag) => (
            <span
              key={tag}
              className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#1a1a1a] text-[#555] border border-[#222]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* platform badge */}
      <div className="flex items-center gap-2 text-[#444] text-xs font-mono">
        <span className="capitalize">{video.platform}</span>
        {video.uploadDate !== "N/A" && (
          <>
            <span>·</span>
            <span>{video.uploadDate.split("T")[0]}</span>
          </>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-2 py-2.5 rounded-xl bg-[#0d0d0d] border border-[#1a1a1a]">
      <span className="font-display font-600 text-base stat-number text-[#f0f0f0]">
        {value}
      </span>
      <span className="text-[10px] text-[#555] font-mono uppercase tracking-wide">
        {label}
      </span>
    </div>
  );
}
