import axios from "axios";
import * as cheerio from "cheerio";
import { fetchTranscript } from "youtube-transcript";

export interface VideoMetadata {
  videoId: string;
  url: string;
  platform: "youtube" | "instagram";
  title: string;
  creator: string;
  followerCount: string;
  views: number;
  likes: number;
  comments: number;
  hashtags: string[];
  uploadDate: string;
  duration: string;
  engagementRate: number;
  transcript: string;
  thumbnailUrl: string;
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

async function getYouTubeTranscript(videoId: string): Promise<string> {
  try {
    const transcript = await fetchTranscript(videoId);
    const lines = transcript
      .map((segment) => segment.text.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (lines.length > 0) return lines.join(" ");
    return "[Transcript not available for this video]";
  } catch (err) {
    console.error("transcript fetch failed, falling back to page scrape:", err);
    try {
      const listUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const res = await axios.get(listUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      const captionMatch = res.data.match(/"captionTracks":\[(.*?)\]/);
      if (!captionMatch) return "[Transcript not available for this video]";
      const trackData = JSON.parse(`[${captionMatch[1]}]`);
      const englishTrack =
        trackData.find((t: { languageCode: string }) => t.languageCode === "en") ||
        trackData[0];
      if (!englishTrack?.baseUrl) return "[No caption track found]";
      const transcriptRes = await axios.get(englishTrack.baseUrl);
      const $ = cheerio.load(transcriptRes.data, { xmlMode: true });
      const lines: string[] = [];
      $("text").each((_, el) => {
        const text = $(el).text().replace(/&#39;/g, "'").replace(/&amp;/g, "&").trim();
        if (text) lines.push(text);
      });
      return lines.join(" ") || "[Transcript not available for this video]";
    } catch (fallbackErr) {
      console.error("fallback transcript fetch failed:", fallbackErr);
      return "[Could not fetch transcript]";
    }
  }
}

async function getYouTubeMetadata(videoId: string): Promise<Partial<VideoMetadata>> {
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    const html = res.data;

    let title = "";
    let creator = "";
    let views = 0;
    let likes = 0;
    let comments = 0;
    let uploadDate = "";
    let duration = "";
    let followerCount = "N/A";
    let thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
    if (titleMatch) title = titleMatch[1];

    const channelMatch = html.match(/"ownerChannelName":"([^"]+)"/);
    if (channelMatch) creator = channelMatch[1];

    const viewMatch = html.match(/"viewCount":"(\d+)"/);
    if (viewMatch) views = parseInt(viewMatch[1]);

    const likeMatch = html.match(/"label":"([\d,]+) likes"/);
    if (likeMatch) likes = parseInt(likeMatch[1].replace(/,/g, ""));

    const dateMatch = html.match(/"uploadDate":"([^"]+)"/);
    if (dateMatch) uploadDate = dateMatch[1];

    const durationMatch = html.match(/"approxDurationMs":"(\d+)"/);
    if (durationMatch) {
      const ms = parseInt(durationMatch[1]);
      const secs = Math.floor(ms / 1000);
      duration = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
    }

    const hashtagMatches = html.matchAll(/"#([a-zA-Z0-9_]+)"/g);
    const hashtags = Array.from(new Set([...hashtagMatches].map((m) => `#${m[1]}`))).slice(0, 10);

    // YouTube Data API - real likes, comments, subscriber count
    // scraping alone cant get these reliably since youtube hid like counts in 2021
    if (process.env.YOUTUBE_API_KEY) {
      try {
        const [statsRes, channelRes] = await Promise.all([
          axios.get(`https://www.googleapis.com/youtube/v3/videos`, {
            params: {
              part: "statistics,snippet",
              id: videoId,
              key: process.env.YOUTUBE_API_KEY,
            },
          }),
          // get channel id first to fetch subscriber count
          axios.get(`https://www.googleapis.com/youtube/v3/videos`, {
            params: {
              part: "snippet",
              id: videoId,
              key: process.env.YOUTUBE_API_KEY,
            },
          }),
        ]);

        const item = statsRes.data.items?.[0];
        if (item) {
          views = parseInt(item.statistics.viewCount || "0");
          likes = parseInt(item.statistics.likeCount || "0");
          comments = parseInt(item.statistics.commentCount || "0");
          title = item.snippet.title || title;
          creator = item.snippet.channelTitle || creator;
          uploadDate = item.snippet.publishedAt || uploadDate;

          // fetch subscriber count using channel id
          const channelId = item.snippet.channelId;
          if (channelId) {
            try {
              const chRes = await axios.get(
                `https://www.googleapis.com/youtube/v3/channels`,
                {
                  params: {
                    part: "statistics",
                    id: channelId,
                    key: process.env.YOUTUBE_API_KEY,
                  },
                }
              );
              const subs = chRes.data.items?.[0]?.statistics?.subscriberCount;
              if (subs) {
                const n = parseInt(subs);
                followerCount =
                  n >= 1_000_000
                    ? (n / 1_000_000).toFixed(1) + "M"
                    : n >= 1_000
                    ? (n / 1_000).toFixed(1) + "K"
                    : n.toString();
              }
            } catch {
              // subscriber count is optional, not critical
            }
          }
        }
        console.log(`YouTube API: views=${views} likes=${likes} comments=${comments}`);
      } catch (apiErr) {
        console.log("YouTube Data API failed, using scraped data:", apiErr);
      }
    }

    return {
      title,
      creator,
      views,
      likes,
      comments,
      uploadDate,
      duration,
      hashtags,
      thumbnailUrl,
      followerCount,
    };
  } catch (err) {
    console.error("metadata fetch failed:", err);
    return {};
  }
}

function extractInstagramId(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:reel|p)\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

async function getInstagramData(url: string): Promise<Partial<VideoMetadata>> {
  try {
    const oembedUrls = [
      `https://www.instagram.com/oembed/?url=${encodeURIComponent(url)}&omitscript=true`,
      `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(url)}`,
    ];

    let data: any = null;
    for (const oembedUrl of oembedUrls) {
      try {
        const res = await axios.get(oembedUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)",
            Accept: "application/json, text/plain, */*",
          },
          timeout: 8000,
        });
        data = res.data;
        break;
      } catch (err: any) {
        console.warn(`instagram oembed failed for ${oembedUrl}: ${err?.message || err}`);
      }
    }

    if (!data) throw new Error("Instagram oEmbed unavailable");

    return {
      title: data.title || "Instagram Reel",
      creator: data.author_name || "Unknown",
      thumbnailUrl: data.thumbnail_url || data.thumbnail_url_with_play_button || "",
      views: 0,
      likes: 0,
      comments: 0,
      followerCount: "N/A",
      uploadDate: "N/A",
      duration: "N/A",
      hashtags: (data.title?.match(/#[a-zA-Z0-9_]+/g) || []) as string[],
    };
  } catch (outerErr: any) {
    console.log("Instagram oembed failed, trying page metadata fallback", outerErr?.message || outerErr);
    try {
      const res = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
        timeout: 8000,
      });
      const $ = cheerio.load(res.data);
      const getMeta = (property: string) =>
        $(`meta[property="${property}"]`).attr("content") ||
        $(`meta[name="${property}"]`).attr("content") ||
        "";
      const title = getMeta("og:title") || "Instagram Reel";
      const description = getMeta("og:description");
      const thumbnailUrl = getMeta("og:image") || getMeta("twitter:image") || "";
      const creator =
        title.split("on Instagram:")[0].trim() ||
        title.split("•")[0].trim() ||
        "Instagram Creator";
      return {
        title,
        creator,
        thumbnailUrl,
        views: 0,
        likes: 0,
        comments: 0,
        followerCount: "N/A",
        uploadDate: "N/A",
        duration: "N/A",
        hashtags: (description.match(/#[a-zA-Z0-9_]+/g) || []) as string[],
      };
    } catch (pageErr: any) {
      console.log("Instagram page fallback failed:", pageErr?.message || pageErr);
      return {
        title: "Instagram Reel",
        creator: "Instagram Creator",
        views: 0,
        likes: 0,
        comments: 0,
        followerCount: "N/A",
        uploadDate: "N/A",
        duration: "N/A",
        hashtags: [],
        thumbnailUrl: "https://via.placeholder.com/1080x1920/111111/cfcfcf?text=Instagram+Reel",
      };
    }
  }
}

async function getInstagramTranscript(_url: string): Promise<string> {
  // TODO: yt-dlp + whisper integration for real audio transcription
  return "[Instagram transcript: audio transcription via Whisper would go here. yt-dlp + whisper integration needed for production]";
}

export async function fetchVideoData(
  url: string,
  videoId: "A" | "B"
): Promise<VideoMetadata> {
  const isYouTube = url.includes("youtube.com") || url.includes("youtu.be");
  const isInstagram = url.includes("instagram.com");

  let metadata: Partial<VideoMetadata> = {};
  let transcript = "";

  if (isYouTube) {
    const ytId = extractYouTubeId(url);
    if (!ytId) throw new Error(`Couldn't parse YouTube video ID from: ${url}`);
    [metadata, transcript] = await Promise.all([
      getYouTubeMetadata(ytId),
      getYouTubeTranscript(ytId),
    ]);
  } else if (isInstagram) {
    metadata = await getInstagramData(url);
    transcript = await getInstagramTranscript(url);
  } else {
    throw new Error("URL must be YouTube or Instagram");
  }

  const views = metadata.views || 0;
  const likes = metadata.likes || 0;
  const comments = metadata.comments || 0;
  const engagementRate =
    views > 0 ? parseFloat(((likes + comments) / views * 100).toFixed(2)) : 0;

  return {
    videoId,
    url,
    platform: isYouTube ? "youtube" : "instagram",
    title: metadata.title || "Unknown Title",
    creator: metadata.creator || "Unknown Creator",
    followerCount: metadata.followerCount || "N/A",
    views,
    likes,
    comments,
    hashtags: metadata.hashtags || [],
    uploadDate: metadata.uploadDate || "N/A",
    duration: metadata.duration || "N/A",
    engagementRate,
    transcript,
    thumbnailUrl:
      metadata.thumbnailUrl ||
      (isYouTube
        ? `https://img.youtube.com/vi/${extractYouTubeId(url)}/hqdefault.jpg`
        : "https://via.placeholder.com/1080x1920/111111/cfcfcf?text=Instagram+Reel"),
  };
}