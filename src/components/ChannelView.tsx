import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Film, Flame, Smartphone, CheckCircle2, Users, Video } from "lucide-react";
import { VideoCard } from "./VideoCard";
import { SkeletonCard } from "./SkeletonCard";
import type { VideoItem } from "../types";

export type ChannelTab = "all" | "popular" | "shorts";

interface ChannelInfo {
  channel: string;
  channelId?: string;
  source: "drive" | "youtube";
}

interface ChannelMeta {
  avatarUrl?: string;
  subscriberCount?: string;
  videoCount?: string;
  description?: string;
  customUrl?: string;
  uploadsPlaylistId?: string;
}

interface Props {
  channel: ChannelInfo;
  accentColor: string;
  driveVideos: VideoItem[];
  onBack: () => void;
  onPlay: (v: VideoItem) => void;
  onToggleFav: (v: VideoItem) => void;
  onOpenPlaylistModal?: (v: VideoItem) => void;
  isFav: (id: string) => boolean;
  getProgress: (id: string) => number;
}

// ── Session Storage Caching Helper (30 minute TTL) ───────────────────────────
const CACHE_TTL_MS = 30 * 60 * 1000;

function getCachedChannelData(key: string): { items: VideoItem[]; nextToken: string | null } | null {
  try {
    const raw = sessionStorage.getItem(`cache_${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > CACHE_TTL_MS) {
      sessionStorage.removeItem(`cache_${key}`);
      return null;
    }
    return { items: parsed.items, nextToken: parsed.nextToken };
  } catch {
    return null;
  }
}

function setCachedChannelData(key: string, items: VideoItem[], nextToken: string | null) {
  try {
    sessionStorage.setItem(
      `cache_${key}`,
      JSON.stringify({ items, nextToken, ts: Date.now() })
    );
  } catch {}
}

function parseISODuration(iso?: string): { label: string; sec: number } | undefined {
  if (!iso) return undefined;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return undefined;
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);
  const totalSec = hours * 3600 + minutes * 60 + seconds;
  const label =
    hours > 0
      ? `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      : `${minutes}:${seconds.toString().padStart(2, "0")}`;
  return { label, sec: totalSec };
}

function formatCount(numStr?: string): string {
  if (!numStr) return "";
  const num = parseInt(numStr, 10);
  if (isNaN(num)) return numStr;
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return num.toString();
}

export function ChannelView({
  channel,
  accentColor,
  driveVideos,
  onBack,
  onPlay,
  onToggleFav,
  onOpenPlaylistModal,
  isFav,
  getProgress,
}: Props) {
  const [activeTab, setActiveTab] = useState<ChannelTab>("all");
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [channelMeta, setChannelMeta] = useState<ChannelMeta | null>(null);
  const [resolvedChannelId, setResolvedChannelId] = useState<string | undefined>(channel.channelId);

  const nextPageTokenRef = useRef<string | null>(null);
  nextPageTokenRef.current = nextPageToken;

  const loadingRef = useRef(false);
  loadingRef.current = loading;

  const loadingMoreRef = useRef(false);
  loadingMoreRef.current = loadingMore;

  const sentinelRef = useRef<HTMLDivElement>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());

  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;

  // ── 1. Resolve Channel ID & Details (1 Unit) ───────────────────────────────
  useEffect(() => {
    if (channel.source !== "youtube" || !apiKey) return;

    let isCancelled = false;

    async function loadChannelDetails() {
      try {
        let chId = channel.channelId;

        // If channelId is missing, resolve by quick channel search
        if (!chId) {
          const searchRes = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(
              channel.channel
            )}&maxResults=1&key=${apiKey}`
          );
          const searchData = await searchRes.json();
          const firstCh = searchData.items?.[0];
          if (firstCh?.id?.channelId) {
            chId = firstCh.id.channelId;
            if (!isCancelled) setResolvedChannelId(chId);
          }
        }

        if (!chId) return;

        // Fetch channel metadata and uploads playlist ID (Cost: 1 Unit)
        const chRes = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails,statistics&id=${chId}&key=${apiKey}`
        );
        const chData = await chRes.json();
        const chItem = chData.items?.[0];
        if (chItem && !isCancelled) {
          const uploadsPl =
            chItem.contentDetails?.relatedPlaylists?.uploads ||
            (chId.startsWith("UC") ? "UU" + chId.slice(2) : chId);

          setChannelMeta({
            avatarUrl:
              chItem.snippet?.thumbnails?.medium?.url ||
              chItem.snippet?.thumbnails?.default?.url,
            subscriberCount: chItem.statistics?.subscriberCount
              ? formatCount(chItem.statistics.subscriberCount)
              : undefined,
            videoCount: chItem.statistics?.videoCount
              ? formatCount(chItem.statistics.videoCount)
              : undefined,
            description: chItem.snippet?.description,
            customUrl: chItem.snippet?.customUrl,
            uploadsPlaylistId: uploadsPl,
          });
        }
      } catch (err) {
        console.error("Failed to load channel info:", err);
      }
    }

    loadChannelDetails();
    return () => {
      isCancelled = true;
    };
  }, [channel, apiKey]);

  // ── 2. Fetch Channel Videos (1 Unit via playlistItems.list) ────────────────
  const fetchChannelVideos = useCallback(
    async (tab: ChannelTab, isNext = false) => {
      // If it's a Drive channel: filter in-memory Drive videos
      if (channel.source === "drive") {
        setLoading(true);
        const matched = driveVideos.filter(
          (v) => v.channel.toLowerCase() === channel.channel.toLowerCase()
        );
        let sorted = [...matched];
        if (tab === "popular") {
          sorted.sort((a, b) => (b.durationSec ?? 0) - (a.durationSec ?? 0));
        } else if (tab === "shorts") {
          sorted = sorted.filter(
            (v) =>
              (v.durationSec !== undefined && v.durationSec <= 60) ||
              v.title.toLowerCase().includes("short") ||
              v.title.toLowerCase().includes("#shorts")
          );
        }
        setVideos(sorted);
        setNextPageToken(null);
        setLoading(false);
        return;
      }

      // If YouTube channel
      if (!apiKey) return;

      const targetChannelId = resolvedChannelId || channel.channelId;
      const uploadsPlaylist =
        channelMeta?.uploadsPlaylistId ||
        (targetChannelId?.startsWith("UC") ? "UU" + targetChannelId.slice(2) : undefined);

      const cacheKey = `ch_${targetChannelId || channel.channel}_${tab}_${isNext ? nextPageTokenRef.current : "init"}`;

      // Check client-side cache first (Cost: 0 Units)
      if (!isNext) {
        const cached = getCachedChannelData(cacheKey);
        if (cached && cached.items.length > 0) {
          seenIdsRef.current = new Set(cached.items.map((i) => i.id));
          setVideos(cached.items);
          setNextPageToken(cached.nextToken);
          nextPageTokenRef.current = cached.nextToken;
          setLoading(false);
          return;
        }
      }

      if (isNext) {
        if (!nextPageTokenRef.current || loadingMoreRef.current || loadingRef.current) return;
        setLoadingMore(true);
      } else {
        seenIdsRef.current.clear();
        setNextPageToken(null);
        nextPageTokenRef.current = null;
        setLoading(true);
      }

      try {
        const pageTokenParam =
          isNext && nextPageTokenRef.current ? `&pageToken=${nextPageTokenRef.current}` : "";

        let items: any[] = [];
        let nextTok: string | null = null;

        // 1-UNIT ENDPOINT: playlistItems.list on channel uploads playlist
        if (uploadsPlaylist) {
          const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylist}&maxResults=50${pageTokenParam}&key=${apiKey}`;
          const res = await fetch(url);
          const data = await res.json();
          items = data.items || [];
          nextTok = data.nextPageToken || null;
        } else if (targetChannelId) {
          // Fallback search only if upload playlist could not be resolved
          const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&channelId=${targetChannelId}&order=date&maxResults=50${pageTokenParam}&key=${apiKey}`;
          const res = await fetch(url);
          const data = await res.json();
          items = data.items || [];
          nextTok = data.nextPageToken || null;
        }

        setNextPageToken(nextTok);
        nextPageTokenRef.current = nextTok;

        // Collect new video IDs for batch duration lookup (Cost: 1 Unit for up to 50 videos)
        const candidateIds: string[] = [];
        for (const item of items) {
          const vid =
            item.snippet?.resourceId?.videoId ||
            (typeof item.id === "string" ? item.id : item.id?.videoId);
          if (vid && !seenIdsRef.current.has(vid)) {
            candidateIds.push(vid);
          }
        }

        const durationMap = new Map<string, { label: string; sec: number }>();
        if (candidateIds.length > 0) {
          try {
            const detailsRes = await fetch(
              `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${candidateIds.join(
                ","
              )}&key=${apiKey}`
            );
            const detailsData = await detailsRes.json();
            for (const d of detailsData.items || []) {
              const dur = parseISODuration(d.contentDetails?.duration);
              if (dur) durationMap.set(d.id, dur);
            }
          } catch (durErr) {
            console.warn("Failed to batch fetch video durations:", durErr);
          }
        }

        const newItems: VideoItem[] = [];
        for (const item of items) {
          const vid =
            item.snippet?.resourceId?.videoId ||
            (typeof item.id === "string" ? item.id : item.id?.videoId);
          if (!vid || seenIdsRef.current.has(vid)) continue;
          seenIdsRef.current.add(vid);

          const dur = durationMap.get(vid);

          // Tab-specific filtering
          if (tab === "shorts") {
            const isShort =
              (dur?.sec !== undefined && dur.sec <= 60) ||
              item.snippet?.title?.toLowerCase().includes("#short") ||
              item.snippet?.title?.toLowerCase().includes("short");
            if (!isShort) continue;
          }

          newItems.push({
            id: vid,
            source: "youtube",
            title: item.snippet.title,
            channel: item.snippet.channelTitle || channel.channel,
            channelId: item.snippet.channelId || targetChannelId,
            category: "All",
            thumbnail:
              item.snippet.thumbnails?.high?.url ||
              item.snippet.thumbnails?.medium?.url ||
              "",
            duration: dur?.label,
            durationSec: dur?.sec,
          });
        }

        // Popular sort in-memory
        if (tab === "popular") {
          newItems.sort((a, b) => (b.durationSec ?? 0) - (a.durationSec ?? 0));
        }

        if (isNext) {
          setVideos((prev) => {
            const merged = [...prev, ...newItems];
            setCachedChannelData(cacheKey, merged, nextTok);
            return merged;
          });
        } else {
          setVideos(newItems);
          setCachedChannelData(cacheKey, newItems, nextTok);
        }
      } catch (err) {
        console.error("Failed to load channel videos:", err);
      } finally {
        if (isNext) setLoadingMore(false);
        else setLoading(false);
      }
    },
    [channel, resolvedChannelId, channelMeta, driveVideos, apiKey]
  );

  useEffect(() => {
    fetchChannelVideos(activeTab, false);
  }, [fetchChannelVideos, activeTab]);

  // ── 3. Infinite Scroll Observer ────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (
          entry.isIntersecting &&
          nextPageTokenRef.current &&
          !loadingMoreRef.current &&
          !loadingRef.current
        ) {
          fetchChannelVideos(activeTab, true);
        }
      },
      { rootMargin: "350px", threshold: 0.05 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchChannelVideos, activeTab, loading, nextPageToken]);

  const channelInitials = channel.channel.slice(0, 2).toUpperCase();

  return (
    <div className="w-full pb-16">
      {/* ── Channel Header Banner ── */}
      <div
        className="w-full border-b"
        style={{
          backgroundColor: "var(--c-surface)",
          borderColor: "var(--c-border)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Back button */}
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-semibold px-3.5 py-1.5 rounded-full mb-6 transition cursor-pointer hover:opacity-80 shadow-sm"
            style={{
              backgroundColor: "var(--c-card)",
              color: "var(--c-text)",
              border: "1px solid var(--c-border)",
            }}
          >
            <ArrowLeft className="w-4 h-4" /> Back to Feed
          </button>

          {/* Channel Identity Hero */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {channelMeta?.avatarUrl ? (
              <img
                src={channelMeta.avatarUrl}
                alt={channel.channel}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover shrink-0 shadow-lg border-2"
                style={{ borderColor: accentColor }}
              />
            ) : (
              <div
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center text-2xl font-bold shrink-0 shadow-lg"
                style={{
                  backgroundColor:
                    channel.source === "drive" ? "var(--c-card)" : `${accentColor}25`,
                  color: channel.source === "drive" ? "var(--c-text)" : accentColor,
                  border: `2px solid ${accentColor}40`,
                }}
              >
                {channelInitials}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1
                  className="text-xl sm:text-2xl font-bold truncate tracking-tight"
                  style={{ color: "var(--c-text)" }}
                >
                  {channel.channel}
                </h1>
                <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: accentColor }} />
              </div>

              {channelMeta?.customUrl && (
                <p className="text-xs font-medium mt-0.5" style={{ color: accentColor }}>
                  {channelMeta.customUrl}
                </p>
              )}

              <div
                className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm mt-1.5"
                style={{ color: "var(--c-muted)" }}
              >
                <span>{channel.source === "drive" ? "📁 Google Drive Vault" : "📺 YouTube Creator"}</span>
                {channelMeta?.subscriberCount && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {channelMeta.subscriberCount} subscribers
                    </span>
                  </>
                )}
                {channelMeta?.videoCount && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Video className="w-3.5 h-3.5" />
                      {channelMeta.videoCount} videos
                    </span>
                  </>
                )}
                <span>•</span>
                <span>{videos.length} videos loaded</span>
              </div>

              {channelMeta?.description && (
                <p
                  className="text-xs line-clamp-2 mt-2 max-w-2xl leading-relaxed"
                  style={{ color: "var(--c-muted)" }}
                >
                  {channelMeta.description}
                </p>
              )}

              <div className="mt-3 flex items-center gap-2">
                <span
                  className="px-2.5 py-0.5 rounded-full text-[11px] font-medium"
                  style={{
                    backgroundColor: `${accentColor}18`,
                    color: accentColor,
                  }}
                >
                  {channel.source === "drive" ? "Private Vault" : "Uploads Feed (1-Unit)"}
                </span>
              </div>
            </div>
          </div>

          {/* ── Channel Navigation Tabs ── */}
          <div
            className="flex items-center gap-2 mt-6 border-t pt-4"
            style={{ borderColor: "var(--c-border)" }}
          >
            {/* All Videos */}
            <button
              onClick={() => setActiveTab("all")}
              className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
              style={
                activeTab === "all"
                  ? { backgroundColor: accentColor, color: "white" }
                  : { backgroundColor: "var(--c-card)", color: "var(--c-muted)" }
              }
            >
              <Film className="w-3.5 h-3.5" /> All Videos
            </button>

            {/* Popular */}
            <button
              onClick={() => setActiveTab("popular")}
              className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
              style={
                activeTab === "popular"
                  ? { backgroundColor: accentColor, color: "white" }
                  : { backgroundColor: "var(--c-card)", color: "var(--c-muted)" }
              }
            >
              <Flame className="w-3.5 h-3.5" /> Popular
            </button>

            {/* Shorts */}
            <button
              onClick={() => setActiveTab("shorts")}
              className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
              style={
                activeTab === "shorts"
                  ? { backgroundColor: accentColor, color: "white" }
                  : { backgroundColor: "var(--c-card)", color: "var(--c-muted)" }
              }
            >
              <Smartphone className="w-3.5 h-3.5" /> Shorts
            </button>
          </div>
        </div>
      </div>

      {/* ── Channel Video Feed ── */}
      <div className="max-w-7xl mx-auto px-4 pt-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-6">
              {videos.map((video) => (
                <VideoCard
                  key={`${video.source}-${video.id}`}
                  video={video}
                  progress={getProgress(video.id)}
                  isFav={isFav(video.id)}
                  onPlay={onPlay}
                  onToggleFav={onToggleFav}
                  onOpenPlaylistModal={onOpenPlaylistModal}
                  accentColor={accentColor}
                />
              ))}
            </div>

            {/* ── Infinite Scroll Sentinel & Manual Fallback Button ── */}
            {nextPageToken && channel.source !== "drive" && (
              <div
                ref={sentinelRef}
                className="py-10 flex flex-col items-center justify-center gap-3"
              >
                {loadingMore ? (
                  <div
                    className="flex items-center gap-2.5 text-xs font-medium"
                    style={{ color: "var(--c-muted)" }}
                  >
                    <div
                      className="w-5 h-5 rounded-full border-2 animate-spin"
                      style={{
                        borderColor: `${accentColor}40`,
                        borderTopColor: accentColor,
                      }}
                    />
                    <span>Loading more channel videos...</span>
                  </div>
                ) : (
                  <button
                    onClick={() => fetchChannelVideos(activeTab, true)}
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer hover:opacity-90 flex items-center gap-2 shadow-sm"
                    style={{
                      backgroundColor: "var(--c-card)",
                      color: "var(--c-text)",
                      border: "1px solid var(--c-border)",
                    }}
                  >
                    Load More Videos
                  </button>
                )}
              </div>
            )}

            {videos.length === 0 && !loading && (
              <div
                className="py-20 text-center text-sm"
                style={{ color: "var(--c-muted)" }}
              >
                {activeTab === "shorts"
                  ? "No shorts found for this channel."
                  : activeTab === "popular"
                  ? "No popular videos found for this channel."
                  : "No videos found for this channel."}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
