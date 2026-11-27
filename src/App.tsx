import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import {
  Play, Search, Shuffle, Sparkles, FolderLock, TvMinimalPlay, LogIn,
  Sun, Moon, Lock, Unlock, ChevronDown, User, LogOut,
  Scissors, Ruler, Zap, Palette, Heart, X,
  Flame, Music, Gamepad2, Cpu, Newspaper, Mic,
  ListMusic, Trash2, Plus, RotateCw,
} from "lucide-react";

import { VideoCard } from "./components/VideoCard";
import { Player } from "./components/Player";
import { SkeletonCard } from "./components/SkeletonCard";
import { BottomNav } from "./components/BottomNav";
import { ChannelView } from "./components/ChannelView";
import { PlaylistModal } from "./components/PlaylistModal";
import { useWatchHistory } from "./hooks/useWatchHistory";
import { useDrivePlaylists } from "./hooks/useDrivePlaylists";
import type { VideoItem, SourceFilter, SortOrder, AppTheme } from "./types";

// ── Categories & Queries ─────────────────────────────────────────────────────
const PRIVATE_CATEGORIES = [
  "All",
  "Short",
  "Undercut",
  "Sideshave & Fade",
  "Bixie & Pixie",
  "Mom Makeover",
  "Colors",
  "Long",
] as const;
const NORMAL_CATEGORIES = ["All", "Trending", "Music", "Gaming", "Tech", "News", "Podcasts"] as const;

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  All: Sparkles,
  // Private
  Short: Scissors,
  Long: Ruler,
  Undercut: Zap,
  "Sideshave & Fade": Flame,
  "Bixie & Pixie": Scissors,
  "Mom Makeover": Heart,
  Colors: Palette,
  // Normal
  Trending: Flame,
  Music: Music,
  Gaming: Gamepad2,
  Tech: Cpu,
  News: Newspaper,
  Podcasts: Mic,
};

// Broad YouTube search queries across all channels worldwide (prioritizing Indian creators & transformations)
const PRIVATE_CATEGORY_QUERIES: Record<string, string> = {
  All: "Indian women haircut transformation makeover | girls sideshave undercut | Indian fade haircut | bixie blonde pixie bob salon",
  Short: "women bixie haircut | blonde pixie bob haircut transformation | mom pixie makeover | Indian salon short hair",
  Undercut: "girls sideshave undercut | undercut with hair color | Indian girls nape buzz shave undercut | women undercut transformation",
  "Sideshave & Fade": "girls sideshave undercut | Indian women fade haircut | Indian girls skin fade taper fade | side shave makeover salon",
  "Bixie & Pixie": "women bixie cut transformation | Indian women pixie cut | blonde pixie haircut makeover | bixie bob salon",
  "Mom Makeover": "mom pixie cut transformation | Indian mom haircut makeover | mom undercut makeover salon",
  Colors: "undercut with hair color | women blonde pixie haircut | blonde bob haircut transformation | balayage makeover salon",
  Long: "Indian girls long to short haircut makeover | extreme long hair transformation salon | layers bob",
};

// Confirmed Culture Cafe Studio Haircut Transformations
const CULTURE_CAFE_HAIRCUT_VIDS = [
  "jol6Vp8wlz8", // ✨UNDERCUT PIXIE ✨ - Full Video | Short Haircut For Women | Virtue Studio | Culture Cafe Studio
  "RaObgu0xoZA", // ✨ Short to Shorter Haircut ✨ | PIXIE CUT and Styling | Culture Cafe Studio
  "Ta4_RFmVQro", // Showing off after a new haircut and styling | Culture Cafe Studio
];

// 1-Unit Upload Playlists for Private Mode (Curated Indian creators, AI stories & top salons)
const PRIVATE_CATEGORY_PLAYLISTS: Record<string, string[]> = {
  All: [
    "UUyxIgscUAeonLzrnMIcVV0A", // Desi Makeovers (Indian Salon Makeovers)
    "UUgRIzrQLT9FUjl9QT1Jq9aA", // Haarminnaar (Indian Haircut Transformations)
    "PLW77CFOjU1MEpngokZElo00dXvtZ-1Ml5", // The Happy Radio (Nom Nom Hedonist - Official Makeover & Pixie Series)
    "UU8HyecFpFcW5NfJTJjrftWw", // Girls Haircut (Indian Girls Headshave & Bob)
    "UUCFFT7bZr09Tqo65vu5zPiQ", // Indian Girls Haircut
    "UUDIqXqP9PL9fNH7CfbGeFsQ", // Haircut story (AI Indian Stories)
    "UUyyAQ8440d8C-0UF-pD0v8w", // Haircut Stories by A I
    "UUjUwgtakBBYR-BacjTWx4gQ", // Haircut Stories (Hindi/Indian)
    "UUhE9k2S9cb9eDS_v7pkl5hg", // Indian haircut stories
    "UU8sxj-zvIHShgqVkDLxLMwQ", // Heer Haircut & Stories
    "UUG9thQ9Ce-VSL8gHFSy1M_w", // Hair Salon Secrets
    "UUKEdz3VD4dou5xEnR7Aq0rg", // Indian Haircut
    "UUUUOUXV5xmEqGWGf9eUyjdQ", // Sam Villa Haircuts
    "UUmi9wFeEZCV9gMDO-Sw_F-w", // TheSalonGuy Makeovers
    "UUoc_XJPj6YLMQDWtPDQcDtA", // Brad Mondo
    "UUjzof44RG883SW61XlkP-Pg", // Guy Tang
  ],
  Short: [
    "PLW77CFOjU1MEpngokZElo00dXvtZ-1Ml5", // The Happy Radio (Pixie & Short Series)
    "UUCFFT7bZr09Tqo65vu5zPiQ", // Indian Girls Haircut (Bob & Pixie)
    "UUyxIgscUAeonLzrnMIcVV0A", // Desi Makeovers
    "UUgRIzrQLT9FUjl9QT1Jq9aA", // Haarminnaar
    "UU8HyecFpFcW5NfJTJjrftWw", // Girls Haircut
    "UUDIqXqP9PL9fNH7CfbGeFsQ", // Haircut story (AI Stories)
    "UUG9thQ9Ce-VSL8gHFSy1M_w", // Hair Salon Secrets
    "UUmi9wFeEZCV9gMDO-Sw_F-w", // TheSalonGuy
    "UUUUOUXV5xmEqGWGf9eUyjdQ", // Sam Villa
  ],
  Long: [
    "PLW77CFOjU1MEpngokZElo00dXvtZ-1Ml5", // The Happy Radio (Extreme Long to Extreme Short)
    "UU8HyecFpFcW5NfJTJjrftWw", // Girls Haircut
    "UUgRIzrQLT9FUjl9QT1Jq9aA", // Haarminnaar (Long to Short)
    "UUyxIgscUAeonLzrnMIcVV0A", // Desi Makeovers
    "UUCFFT7bZr09Tqo65vu5zPiQ", // Indian Girls Haircut
    "UUyyAQ8440d8C-0UF-pD0v8w", // Haircut Stories by A I
    "UUG9thQ9Ce-VSL8gHFSy1M_w", // Hair Salon Secrets
    "UUUUOUXV5xmEqGWGf9eUyjdQ", // Sam Villa
    "UUoc_XJPj6YLMQDWtPDQcDtA", // Brad Mondo
  ],
  Undercut: [
    "UUyxIgscUAeonLzrnMIcVV0A", // Desi Makeovers (Nape Shaves & Undercuts)
    "UUgRIzrQLT9FUjl9QT1Jq9aA", // Haarminnaar (Nape buzz & undercut bob)
    "UU8HyecFpFcW5NfJTJjrftWw", // Girls Haircut (Buzzed nape & Undercuts)
    "PLW77CFOjU1MEpngokZElo00dXvtZ-1Ml5", // The Happy Radio (Hair Tattoo & Undercut)
    "UUG9thQ9Ce-VSL8gHFSy1M_w", // Hair Salon Secrets
    "UUDIqXqP9PL9fNH7CfbGeFsQ", // Haircut story
    "UUmi9wFeEZCV9gMDO-Sw_F-w", // TheSalonGuy
    "UUUUOUXV5xmEqGWGf9eUyjdQ", // Sam Villa
  ],
  "Sideshave & Fade": [
    "UUyxIgscUAeonLzrnMIcVV0A", // Desi Makeovers (Sideshaves, Fades & Undercuts)
    "UUgRIzrQLT9FUjl9QT1Jq9aA", // Haarminnaar (Buzzed nape & skin fades)
    "UU8HyecFpFcW5NfJTJjrftWw", // Girls Haircut (Buzzed sides & undercut)
    "PLW77CFOjU1MEpngokZElo00dXvtZ-1Ml5", // The Happy Radio (Hair Tattoo & Fade Series)
    "UUG9thQ9Ce-VSL8gHFSy1M_w", // Hair Salon Secrets
    "UUUUOUXV5xmEqGWGf9eUyjdQ", // Sam Villa
  ],
  "Bixie & Pixie": [
    "PLW77CFOjU1MEpngokZElo00dXvtZ-1Ml5", // The Happy Radio (Pixie & Bixie Series)
    "UUCFFT7bZr09Tqo65vu5zPiQ", // Indian Girls Haircut (Bob & Pixie)
    "UUyxIgscUAeonLzrnMIcVV0A", // Desi Makeovers
    "UUgRIzrQLT9FUjl9QT1Jq9aA", // Haarminnaar
    "UUmi9wFeEZCV9gMDO-Sw_F-w", // TheSalonGuy
    "UUUUOUXV5xmEqGWGf9eUyjdQ", // Sam Villa
  ],
  "Mom Makeover": [
    "UUyxIgscUAeonLzrnMIcVV0A", // Desi Makeovers (Salon Makeovers)
    "UUgRIzrQLT9FUjl9QT1Jq9aA", // Haarminnaar
    "PLW77CFOjU1MEpngokZElo00dXvtZ-1Ml5", // The Happy Radio
    "UU8HyecFpFcW5NfJTJjrftWw", // Girls Haircut
    "UUmi9wFeEZCV9gMDO-Sw_F-w", // TheSalonGuy
  ],
  Colors: [
    "UUjzof44RG883SW61XlkP-Pg", // Guy Tang Hair Colors
    "PLW77CFOjU1MEpngokZElo00dXvtZ-1Ml5", // The Happy Radio (Pink Highlights & Global Colors)
    "UUG9thQ9Ce-VSL8gHFSy1M_w", // Hair Salon Secrets
    "UUyxIgscUAeonLzrnMIcVV0A", // Desi Makeovers (Color Makeovers)
    "UUoc_XJPj6YLMQDWtPDQcDtA", // Brad Mondo
    "UUgRIzrQLT9FUjl9QT1Jq9aA", // Haarminnaar
    "UUUUOUXV5xmEqGWGf9eUyjdQ", // Sam Villa
  ],
};

// Official YouTube Video Category IDs for Normal Mode (Cost: 1 unit)
const NORMAL_CATEGORY_IDS: Record<string, string> = {
  Music: "10",
  Gaming: "20",
  News: "25",
  Tech: "28",
  Podcasts: "24",
};

const PAGE_SIZE = 24;
const TOKEN_KEY = "yt_token";
const FEED_CACHE_TTL_MS = 30 * 60 * 1000;

// Auto-clear feed cache on browser page reload (F5 / Cmd+R)
try {
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (nav?.type === "reload") {
    Object.keys(sessionStorage).forEach((k) => {
      if (k.startsWith("feed_cache_") || k.startsWith("cache_")) {
        sessionStorage.removeItem(k);
      }
    });
  }
} catch {}

function clearAllFeedCache() {
  try {
    Object.keys(sessionStorage).forEach((k) => {
      if (k.startsWith("feed_cache_") || k.startsWith("cache_")) {
        sessionStorage.removeItem(k);
      }
    });
  } catch {}
}

function getFeedCache(key: string): { items: VideoItem[]; nextToken: string | null } | null {
  try {
    const raw = sessionStorage.getItem(`feed_cache_${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > FEED_CACHE_TTL_MS) {
      sessionStorage.removeItem(`feed_cache_${key}`);
      return null;
    }
    return { items: parsed.items, nextToken: parsed.nextToken };
  } catch {
    return null;
  }
}

function setFeedCache(key: string, items: VideoItem[], nextToken: string | null) {
  try {
    sessionStorage.setItem(
      `feed_cache_${key}`,
      JSON.stringify({ items, nextToken, ts: Date.now() })
    );
  } catch {}
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function extractYouTubeId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) return null;
  const match =
    trimmed.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/
    ) || trimmed.match(/^([\w-]{11})$/);
  return match ? match[1] : null;
}

function parseISODuration(iso?: string): { label: string; sec: number } | undefined {
  if (!iso) return undefined;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return undefined;
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);
  const totalSec = hours * 3600 + minutes * 60 + seconds;
  const label = hours > 0
    ? `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    : `${minutes}:${seconds.toString().padStart(2, "0")}`;
  return { label, sec: totalSec };
}

function formatDuration(ms?: string): { label: string; sec: number } | undefined {
  if (!ms) return undefined;
  const totalSec = Math.floor(Number(ms) / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return { label: `${mins}:${secs.toString().padStart(2, "0")}`, sec: totalSec };
}

function inferCategory(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("undercut") || t.includes("nape") || t.includes("buzz") || t.includes("shave")) return "Undercut";
  if (t.includes("color") || t.includes("dye") || t.includes("blonde") || t.includes("pink") || t.includes("balayage")) return "Colors";
  if (t.includes("short") || t.includes("pixie") || t.includes("bob")) return "Short";
  if (t.includes("long")) return "Long";
  return "All";
}

// ── App Component ────────────────────────────────────────────────────────────
export default function App() {
  // Auth state
  const [token, setToken] = useState<string>(() => sessionStorage.getItem(TOKEN_KEY) ?? "");
  const [userEmail, setUserEmail] = useState<string>(() => localStorage.getItem("yt_email") ?? "");
  const [authError, setAuthError] = useState("");

  // Theme & Mode
  const [theme, setTheme] = useState<AppTheme>(
    () => (localStorage.getItem("yt_theme") as AppTheme) ?? "dark"
  );
  const [privateMode, setPrivateMode] = useState<boolean>(
    () => localStorage.getItem("yt_private") === "true"
  );

  // Videos & pagination state
  const [driveVideos, setDriveVideos] = useState<VideoItem[]>([]);
  const [ytVideos, setYtVideos] = useState<VideoItem[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [ytQuotaExceeded, setYtQuotaExceeded] = useState(false);

  // Filter & Navigation state
  const [source, setSource] = useState<SourceFilter>("blended");
  const [category, setCategory] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [sort, setSort] = useState<SortOrder>("default");
  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);
  const [activeChannel, setActiveChannel] = useState<{
    channel: string;
    channelId?: string;
    source: "drive" | "youtube";
  } | null>(null);

  // Playlists State
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [playlistTargetVideo, setPlaylistTargetVideo] = useState<VideoItem | null>(null);
  const vaultFolderIdRef = useRef<string>("");

  const [page, setPage] = useState(1);
  const [profileOpen, setProfileOpen] = useState(false);

  // Refs for stable async operations & UI
  const searchRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const privateModeRef = useRef(privateMode);
  privateModeRef.current = privateMode;

  const categoryRef = useRef(category);
  categoryRef.current = category;

  const searchRefState = useRef(search);
  searchRefState.current = search;

  const submittedQueryRef = useRef(submittedQuery);
  submittedQueryRef.current = submittedQuery;

  const nextPageTokenRef = useRef(nextPageToken);
  nextPageTokenRef.current = nextPageToken;

  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  const loadingMoreRef = useRef(loadingMore);
  loadingMoreRef.current = loadingMore;

  const seenIdsRef = useRef<Set<string>>(new Set());
  const refreshCountRef = useRef<number>(
    (() => {
      try {
        const c = parseInt(sessionStorage.getItem("yt_refresh_count") || "0", 10);
        const next = isNaN(c) ? 0 : c + 1;
        sessionStorage.setItem("yt_refresh_count", String(next));
        return next;
      } catch {
        return 0;
      }
    })()
  );

  // Custom hooks
  const { saveProgress, getProgress, getResumeTime } = useWatchHistory();
  const {
    playlists,
    favorites,
    isSyncing: isPlaylistSyncing,
    setFolderId,
    loadFromDrive: loadPlaylistsFromDrive,
    clearDriveCache,
    toggleVideo: toggleVideoInPlaylist,
    toggleFav,
    isFav,
    createPlaylist,
    deletePlaylist,
    getPlaylistVideos,
    getFavoriteVideos,
  } = useDrivePlaylists();

  // Accent color
  const accent = privateMode ? "#e91e8c" : theme === "light" ? "#dc2626" : "#ff0000";

  // Active category list
  const categories = privateMode ? PRIVATE_CATEGORIES : NORMAL_CATEGORIES;

  // ── Theme effects ─────────────────────────────────────────────────────────
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.theme = theme;
    if (privateMode) el.dataset.private = "true";
    else delete el.dataset.private;
  }, [theme, privateMode]);

  useEffect(() => { localStorage.setItem("yt_theme", theme); }, [theme]);
  useEffect(() => { localStorage.setItem("yt_private", String(privateMode)); }, [privateMode]);

  // ── Fetch YouTube Feed (with infinite scrolling & suggestions) ────────────
  const fetchYouTubeFeed = useCallback(
    async (opts: {
      query?: string;
      cat?: string;
      isPrivate?: boolean;
      isNextPage?: boolean;
    } = {}) => {
      const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
      if (!apiKey) return;

      const isNext = !!opts.isNextPage;
      const targetPrivate = opts.isPrivate !== undefined ? opts.isPrivate : privateModeRef.current;
      const targetCat = opts.cat !== undefined ? opts.cat : categoryRef.current;
      const targetQuery = opts.query !== undefined ? opts.query : submittedQueryRef.current;

      const cacheKey = `${targetPrivate ? "priv" : "norm"}_${targetCat}_${targetQuery || "none"}_${isNext && nextPageTokenRef.current ? nextPageTokenRef.current : "init"}`;

      // Check client-side cache first (Cost: 0 Units)
      if (!isNext) {
        const cached = getFeedCache(cacheKey);
        if (cached && cached.items.length > 0) {
          seenIdsRef.current = new Set(cached.items.map((v) => v.id));
          setYtVideos(cached.items);
          setNextPageToken(cached.nextToken);
          nextPageTokenRef.current = cached.nextToken;
          setLoading(false);
          return;
        }
      }

      if (isNext) {
        if (!nextPageTokenRef.current || loadingMoreRef.current || loadingRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
      } else {
        seenIdsRef.current.clear();
        nextPageTokenRef.current = null;
        setNextPageToken(null);
        loadingRef.current = true;
        setLoading(true);
      }

      try {
        let url: string;
        const pageTokenParam = isNext && nextPageTokenRef.current ? `&pageToken=${nextPageTokenRef.current}` : "";

        if (targetQuery) {
          // Explicit global search on YouTube (Cost: 100 units)
          url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=24&q=${encodeURIComponent(targetQuery)}${pageTokenParam}&key=${apiKey}`;
        } else if (targetPrivate) {
          // Broad YouTube search across ALL channels matching category queries
          const q = PRIVATE_CATEGORY_QUERIES[targetCat] || PRIVATE_CATEGORY_QUERIES.All;
          url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=24&q=${encodeURIComponent(q)}${pageTokenParam}&key=${apiKey}`;
        } else {
          // 1-UNIT ENDPOINT: Official YouTube Most Popular & Category Charts (Cost: 1 unit)
          const catId = NORMAL_CATEGORY_IDS[targetCat];
          if (catId) {
            url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&chart=mostPopular&videoCategoryId=${catId}&maxResults=24&regionCode=US${pageTokenParam}&key=${apiKey}`;
          } else {
            url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&chart=mostPopular&maxResults=24&regionCode=US${pageTokenParam}&key=${apiKey}`;
          }
        }

        const res = await fetch(url);
        const data = await res.json();

        if (data.error) {
          console.error("YouTube API Error:", data.error.message || data.error);
        }

        const isQuotaErr =
          data.error?.code === 403 ||
          data.error?.code === 429 ||
          data.error?.status === "RESOURCE_EXHAUSTED" ||
          data.error?.errors?.[0]?.reason === "quotaExceeded" ||
          data.error?.errors?.[0]?.reason === "rateLimitExceeded";

        let items = data.items || [];
        let nextTok = data.nextPageToken || null;

        if (isQuotaErr) {
          setYtQuotaExceeded(true);

          // Graceful fallback: Show a rich dynamic mix across predefined creators for category/home browsing
          if (!targetQuery && targetPrivate) {
            try {
              const plList = PRIVATE_CATEGORY_PLAYLISTS[targetCat] || PRIVATE_CATEGORY_PLAYLISTS.All;
              const isPage2 = isNext && (nextPageTokenRef.current === "fb_page_2" || nextPageTokenRef.current?.startsWith("fb_"));
              const pageMultiplier = isPage2 ? 1 : 0;

              // Rotate creators based on refresh count and page
              const rotateOffset = (((refreshCountRef.current || 0) * 3) + (pageMultiplier * 8)) % plList.length;
              const rotated = [
                ...plList.slice(rotateOffset),
                ...plList.slice(0, rotateOffset),
              ];
              const selectedPlaylists = rotated.slice(0, 8);

              // Fetch up to 10 videos per creator
              const playlistPromises = selectedPlaylists.map((plId) =>
                fetch(
                  `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${plId}&maxResults=10&key=${apiKey}`
                )
                  .then((r) => r.json())
                  .then((d) => d.items || [])
                  .catch(() => [])
              );

              // Rotate Culture Cafe Studio specific haircut transformations
              const ccOffset = ((refreshCountRef.current || 0) + pageMultiplier) % CULTURE_CAFE_HAIRCUT_VIDS.length;
              const rotatedCC = [
                ...CULTURE_CAFE_HAIRCUT_VIDS.slice(ccOffset),
                ...CULTURE_CAFE_HAIRCUT_VIDS.slice(0, ccOffset),
              ];

              const cultureCafePromise = fetch(
                `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${rotatedCC.join(",")}&key=${apiKey}`
              )
                .then((r) => r.json())
                .then((d) => d.items || [])
                .catch(() => []);

              const [allPlLists, ccItems] = await Promise.all([
                Promise.all(playlistPromises),
                cultureCafePromise,
              ]);

              // Interleave all creators together with offset per refresh
              const mixedItems: any[] = [];
              const itemOffset = (((refreshCountRef.current || 0) * 2) + (pageMultiplier * 4)) % 6;

              for (let i = 0; i < 4; i++) {
                if (ccItems[i]) mixedItems.push(ccItems[i]);
                for (const list of allPlLists) {
                  if (list.length > 0) {
                    const item = list[(i + itemOffset) % list.length];
                    if (item) mixedItems.push(item);
                  }
                }
              }

              if (mixedItems.length > 0) {
                items = mixedItems;
                nextTok = isPage2 ? null : "fb_page_2";
              }
            } catch (fbErr) {
              console.warn("Private mode multi-creator fallback error:", fbErr);
            }
          } else {
            return;
          }
        }

        nextPageTokenRef.current = nextTok;
        setNextPageToken(nextTok);

        // Collect IDs needing duration details
        const candidateIds: string[] = [];
        for (const item of items) {
          const vid =
            item.snippet?.resourceId?.videoId ||
            (typeof item.id === "string" ? item.id : item.id?.videoId);
          if (vid && !item.contentDetails?.duration && !seenIdsRef.current.has(vid)) {
            candidateIds.push(vid);
          }
        }

        const durationMap = new Map<string, { label: string; sec: number }>();
        if (candidateIds.length > 0) {
          try {
            const detailsRes = await fetch(
              `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${candidateIds.join(",")}&key=${apiKey}`
            );
            const detailsData = await detailsRes.json();
            for (const d of detailsData.items || []) {
              const dur = parseISODuration(d.contentDetails?.duration);
              if (dur) durationMap.set(d.id, dur);
            }
          } catch {}
        }

        const newVideos: VideoItem[] = [];
        for (const item of items) {
          const vid =
            item.snippet?.resourceId?.videoId ||
            (typeof item.id === "string" ? item.id : item.id?.videoId);
          if (!vid || seenIdsRef.current.has(vid)) continue;
          seenIdsRef.current.add(vid);

          const dur =
            item.contentDetails?.duration
              ? parseISODuration(item.contentDetails.duration)
              : durationMap.get(vid);

          newVideos.push({
            id: vid,
            source: "youtube",
            title: item.snippet.title,
            channel: item.snippet.channelTitle,
            channelId: item.snippet.channelId,
            category: targetQuery ? inferCategory(item.snippet.title) : (targetCat === "All" ? inferCategory(item.snippet.title) : targetCat),
            thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || "",
            duration: dur?.label,
            durationSec: dur?.sec,
          });
        }

        if (isNext) {
          setYtVideos((prev) => {
            const merged = [...prev, ...newVideos];
            setFeedCache(cacheKey, merged, nextTok);
            return merged;
          });
          setPage((p) => p + 1);
        } else {
          setYtVideos(newVideos);
          setFeedCache(cacheKey, newVideos, nextTok);
        }
      } catch (err) {
        console.error("Failed to fetch YouTube feed:", err);
      } finally {
        if (isNext) {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        } else {
          loadingRef.current = false;
          setLoading(false);
        }
      }
    },
    []
  );

  // ── Drive Vault Fetching (Files + links.txt parsing) ──────────────────────
  const fetchDriveVault = useCallback(
    async (accessToken: string) => {
      const folderQuery = encodeURIComponent(
        "name = 'videos' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
      );
      const foldersRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${folderQuery}&fields=files(id,name,owners(displayName))&includeItemsFromAllDrives=true&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!foldersRes.ok) {
        if (foldersRes.status === 401) {
          setToken("");
          sessionStorage.removeItem(TOKEN_KEY);
          setAuthError("Session expired. Please sign in again.");
        }
        return;
      }

      const foldersData = await foldersRes.json();
      const folders = foldersData.files || [];
      const allVideos: VideoItem[] = [];
      const seen = new Set<string>();

      // Load single playlists.json once for the primary vault folder
      if (folders.length > 0) {
        const primaryFolder = folders[0];
        vaultFolderIdRef.current = primaryFolder.id;
        setFolderId(primaryFolder.id);
        loadPlaylistsFromDrive(accessToken, primaryFolder.id);
      } else {
        loadPlaylistsFromDrive(accessToken);
      }

      for (const folder of folders) {
        const ownerName = folder.owners?.[0]?.displayName || "Drive Vault";

        // Scan & parse links.txt inside the videos folder
        try {
          const linksQuery = encodeURIComponent(
            `name = 'links.txt' and '${folder.id}' in parents and trashed = false`
          );
          const linksRes = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${linksQuery}&fields=files(id,name)`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          const linksData = await linksRes.json();
          for (const lFile of linksData.files || []) {
            const fileRes = await fetch(
              `https://www.googleapis.com/drive/v3/files/${lFile.id}?alt=media`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            const text = await fileRes.text();
            const lines = text.split(/\r?\n/);
            const ytIds: string[] = [];

            for (const line of lines) {
              const id = extractYouTubeId(line);
              if (id && !seen.has(id)) {
                seen.add(id);
                ytIds.push(id);
              }
            }

            // Batch fetch details from YouTube API (up to 50 per call)
            const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
            if (apiKey && ytIds.length > 0) {
              for (let i = 0; i < ytIds.length; i += 50) {
                const chunk = ytIds.slice(i, i + 50);
                const ytRes = await fetch(
                  `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${chunk.join(",")}&key=${apiKey}`
                );
                const ytData = await ytRes.json();
                for (const item of ytData.items || []) {
                  const dur = item.contentDetails?.duration
                    ? parseISODuration(item.contentDetails.duration)
                    : undefined;
                  allVideos.push({
                    id: item.id,
                    source: "drive", // Treated as Drive Vault video!
                    title: item.snippet.title,
                    channel: `${ownerName} (Link)`,
                    channelId: item.snippet.channelId,
                    category: inferCategory(item.snippet.title),
                    thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || "",
                    duration: dur?.label,
                    durationSec: dur?.sec,
                  });
                }
              }
            }
          }
        } catch (err) {
          console.error("Failed to load links.txt from Drive:", err);
        }

        // 3. Scan for actual video files (MP4, MKV, etc.)
        let pageToken = "";
        do {
          const q = encodeURIComponent(
            `'${folder.id}' in parents and mimeType contains 'video/' and trashed = false`
          );
          const url =
            `https://www.googleapis.com/drive/v3/files?q=${q}` +
            `&fields=nextPageToken,files(id,name,thumbnailLink,videoMediaMetadata)` +
            `&orderBy=createdTime desc&pageSize=100` +
            `&includeItemsFromAllDrives=true&supportsAllDrives=true` +
            (pageToken ? `&pageToken=${pageToken}` : "");

          const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
          if (res.status === 401) {
            setToken("");
            sessionStorage.removeItem(TOKEN_KEY);
            setAuthError("Session expired. Please sign in again.");
            return;
          }
          const data = await res.json();

          for (const file of data.files || []) {
            if (seen.has(file.id)) continue;
            seen.add(file.id);
            const cleanTitle = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ");
            const dur = formatDuration(file.videoMediaMetadata?.durationMillis);
            allVideos.push({
              id: file.id,
              source: "drive",
              title: cleanTitle,
              category: inferCategory(cleanTitle),
              channel: ownerName,
              thumbnail: file.thumbnailLink ? file.thumbnailLink.replace(/=s\d+$/, "=s640") : "",
              duration: dur?.label,
              durationSec: dur?.sec,
            });
          }
          pageToken = data.nextPageToken || "";
        } while (pageToken);
      }

      setDriveVideos(allVideos);
    },
    [loadPlaylistsFromDrive]
  );

  const loadAllVideos = useCallback(
    async (accessToken: string, isPrivate: boolean) => {
      setLoading(true);
      await Promise.all([
        fetchDriveVault(accessToken),
        fetchYouTubeFeed({ isPrivate, cat: "All", isNextPage: false }),
      ]);
      setLoading(false);
    },
    [fetchDriveVault, fetchYouTubeFeed]
  );

  // ── Session restore on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (token) {
      loadAllVideos(token, privateMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Filtering, Sorting & Pagination Memo ──────────────────────────────────
  const allFiltered = useMemo(() => {
    const isGlobalSearch = Boolean(submittedQuery && search.trim() === submittedQuery);
    const filterTerm = search.trim().toLowerCase();

    const dFiltered = driveVideos.filter((v) => {
      const catOk = category === "All" || v.category === category;
      const qOk = !filterTerm || v.title.toLowerCase().includes(filterTerm) || v.category.toLowerCase().includes(filterTerm);
      return catOk && qOk;
    });

    const ytFiltered = ytVideos.filter((v) => {
      if (isGlobalSearch) return true;
      const catOk = category === "All" || v.category === category || !privateMode;
      const qOk = !filterTerm || v.title.toLowerCase().includes(filterTerm) || v.channel.toLowerCase().includes(filterTerm);
      return catOk && qOk;
    });

    let list: VideoItem[];

    if (source === "drive") {
      list = dFiltered;
    } else if (source === "youtube") {
      list = ytFiltered;
    } else if (source === "favourites") {
      list = getFavoriteVideos([...driveVideos, ...ytVideos]);
    } else if (source === "playlist") {
      const playlistNames = Object.keys(playlists);
      const activePName = selectedPlaylist || playlistNames[0] || "";
      list = getPlaylistVideos(activePName, [...driveVideos, ...ytVideos]);
    } else {
      // Blended: interleave drive + youtube
      const blended: VideoItem[] = [];
      const max = Math.max(dFiltered.length, ytFiltered.length);
      for (let i = 0; i < max; i++) {
        if (i < dFiltered.length) blended.push(dFiltered[i]);
        if (i < ytFiltered.length) blended.push(ytFiltered[i]);
      }
      list = blended;
    }

    if (sort === "az") return [...list].sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "duration") return [...list].sort((a, b) => (b.durationSec ?? 0) - (a.durationSec ?? 0));
    return list;
  }, [driveVideos, ytVideos, source, category, search, submittedQuery, sort, isFav, privateMode, playlists, selectedPlaylist]);

  const displayedVideos = useMemo(
    () => allFiltered.slice(0, page * PAGE_SIZE),
    [allFiltered, page]
  );

  // ── Infinite scroll observer ──────────────────────────────────────────────
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (displayedVideos.length < allFiltered.length) {
            setPage((p) => p + 1);
          } else if (
            nextPageTokenRef.current &&
            !loadingMoreRef.current &&
            !loadingRef.current &&
            source !== "drive" &&
            source !== "playlist"
          ) {
            fetchYouTubeFeed({ isNextPage: true });
          }
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [displayedVideos.length, allFiltered.length, source, fetchYouTubeFeed]);

  // Close profile on outside click
  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [profileOpen]);

  // Keyboard shortcut for search & random
  useEffect(() => {
    if (activeVideo) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "r" || e.key === "R") playRandom();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeVideo]);

  // ── Auth Handlers ─────────────────────────────────────────────────────────
  const login = useGoogleLogin({
    scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email",
    onSuccess: async (tokenResponse) => {
      const accessToken = tokenResponse.access_token;

      const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const user = await userRes.json();

      const allowedEmails = import.meta.env.VITE_ALLOWED_EMAILS;
      if (allowedEmails) {
        const allowed = allowedEmails.split(",").map((e: string) => e.trim().toLowerCase());
        if (!allowed.includes(user.email?.toLowerCase())) {
          setAuthError("Access denied: Unauthorized Google account.");
          return;
        }
      }

      const prevEmail = localStorage.getItem("yt_email");
      if (user.email && prevEmail && prevEmail !== user.email) {
        clearDriveCache();
      }
      setUserEmail(user.email ?? "");
      localStorage.setItem("yt_email", user.email ?? "");

      navigator.serviceWorker?.controller?.postMessage({ type: "SET_TOKEN", token: accessToken });
      navigator.serviceWorker?.ready.then((reg) => {
        reg.active?.postMessage({ type: "SET_TOKEN", token: accessToken });
      });

      setAuthError("");
      setToken(accessToken);
      sessionStorage.setItem(TOKEN_KEY, accessToken);
      loadAllVideos(accessToken, privateMode);
    },
    onError: () => setAuthError("Google Sign-In failed. Please try again."),
  });

  function signOut() {
    clearDriveCache();
    setToken("");
    sessionStorage.removeItem(TOKEN_KEY);
    setDriveVideos([]);
    setYtVideos([]);
    setNextPageToken(null);
    nextPageTokenRef.current = null;
    seenIdsRef.current.clear();
    setActiveVideo(null);
    setProfileOpen(false);
  }

  // ── Mode & Filter switching ───────────────────────────────────────────────
  const handleTogglePrivateMode = () => {
    const next = !privateMode;
    setPrivateMode(next);
    setCategory("All");
    setSearch("");
    setSubmittedQuery("");
    setActiveChannel(null);
    setPage(1);
    fetchYouTubeFeed({ isPrivate: next, cat: "All", query: "", isNextPage: false });
  };

  const handleCategoryClick = (cat: string) => {
    const newCat = category === cat ? "All" : cat;
    setCategory(newCat);
    setSearch("");
    setSubmittedQuery("");
    setActiveChannel(null);
    setPage(1);
    fetchYouTubeFeed({ cat: newCat, query: "", isNextPage: false });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    setSubmittedQuery(q);
    setActiveChannel(null);
    setCategory("All");
    if (source === "drive" || source === "playlist" || source === "favourites") {
      setSource("blended");
    }
    setPage(1);
    fetchYouTubeFeed({ query: q, cat: "All", isNextPage: false });
  };

  const playRandom = useCallback(() => {
    if (!displayedVideos.length) return;
    setActiveVideo(displayedVideos[Math.floor(Math.random() * displayedVideos.length)]);
  }, [displayedVideos]);

  const handleRefreshFeed = useCallback(() => {
    refreshCountRef.current = (refreshCountRef.current || 0) + 1;
    try {
      sessionStorage.setItem("yt_refresh_count", String(refreshCountRef.current));
    } catch {}
    clearAllFeedCache();
    seenIdsRef.current.clear();
    setPage(1);
    fetchYouTubeFeed({ isNextPage: false });
  }, [fetchYouTubeFeed]);

  // ── Sign-in Screen ────────────────────────────────────────────────────────
  if (!token) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center p-6">
        <div className="w-full max-w-xs bg-[#181818] border border-zinc-800 rounded-2xl p-6 text-center shadow-2xl">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-9 h-6 bg-[#ff0000] rounded-md flex items-center justify-center">
              <Play className="w-3.5 h-3.5 fill-white text-white ml-0.5" />
            </div>
            <span className="text-xl font-bold tracking-tight">YouTube</span>
          </div>
          <p className="text-xs text-zinc-400 mb-6">
            Sign in with your Google account to load your Vault &amp; stream
          </p>
          {authError && <p className="text-xs text-red-400 mb-4">{authError}</p>}
          <button
            onClick={() => login()}
            className="w-full bg-[#ff0000] hover:bg-red-600 text-white py-2.5 rounded-full font-medium text-sm flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <LogIn className="w-4 h-4" /> Continue with Google
          </button>
        </div>
      </div>
    );
  }

  // ── Source Tabs ───────────────────────────────────────────────────────────
  const SOURCE_CHIPS = [
    { id: "blended" as SourceFilter, icon: Sparkles, label: "All" },
    { id: "drive" as SourceFilter, icon: FolderLock, label: `Vault (${driveVideos.length})` },
    { id: "youtube" as SourceFilter, icon: TvMinimalPlay, label: "YouTube" },
    { id: "playlist" as SourceFilter, icon: ListMusic, label: `Playlists (${Object.keys(playlists).length})` },
    { id: "favourites" as SourceFilter, icon: Heart, label: `Saved (${favorites.size})` },
  ];

  const playlistNames = Object.keys(playlists);
  const activePlaylistName = selectedPlaylist || playlistNames[0] || "";

  return (
    <div
      className="min-h-screen pb-28 md:pb-16 transition-colors duration-300 relative"
      style={{ backgroundColor: "var(--c-bg)", color: "var(--c-text)" }}
    >
      {/* Private mode ambient glow */}
      {privateMode && (
        <div
          className="pointer-events-none fixed inset-0 z-0"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(233,30,140,0.1) 0%, transparent 60%)" }}
        />
      )}

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-40 backdrop-blur-md border-b px-4 py-2.5 transition-colors duration-300 relative"
        style={{ backgroundColor: "var(--c-surface)", borderColor: "var(--c-border)" }}
      >
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          {/* Logo */}
          <div
            className="flex items-center gap-1.5 cursor-pointer shrink-0"
            onClick={() => {
              setActiveVideo(null);
              setActiveChannel(null);
              setSource("blended");
              setCategory("All");
              setSearch("");
              setSubmittedQuery("");
              setPage(1);
              fetchYouTubeFeed({ query: "", cat: "All", isNextPage: false });
            }}
          >
            <div
              className="w-8 h-6 rounded-md flex items-center justify-center transition-colors"
              style={{ backgroundColor: accent }}
            >
              <Play className="w-3 h-3 fill-white text-white ml-0.5" />
            </div>
            <span className="font-bold text-lg tracking-tighter" style={{ color: "var(--c-text)" }}>
              YouTube
            </span>
          </div>

          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-xl mx-auto relative">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => {
                const val = e.target.value;
                setSearch(val);
                if (!val.trim()) {
                  setSubmittedQuery("");
                  fetchYouTubeFeed({ query: "", cat: "All", isNextPage: false });
                }
              }}
              placeholder="Search · press / to focus"
              className="w-full rounded-full py-1.5 pl-4 pr-16 text-sm outline-none transition-colors"
              style={{
                backgroundColor: "var(--c-card)",
                border: "1px solid var(--c-border)",
                color: "var(--c-text)",
              }}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setSubmittedQuery("");
                    fetchYouTubeFeed({ query: "", cat: "All", isNextPage: false });
                  }}
                  className="p-1 rounded-full hover:opacity-80 transition cursor-pointer"
                  style={{ color: "var(--c-muted)" }}
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="submit"
                className="p-1 rounded-full hover:opacity-80 transition cursor-pointer"
                style={{ color: "var(--c-muted)" }}
                title="Search YouTube globally"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </form>

          {/* Right Action Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Theme toggle */}
            <button
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              className="p-2 rounded-full transition-colors hidden sm:flex"
              style={{ backgroundColor: "var(--c-card)", color: "var(--c-muted)" }}
              title={theme === "dark" ? "Light mode" : "Dark mode"}
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Refresh Feed */}
            <button
              onClick={handleRefreshFeed}
              className="p-2 rounded-full transition-colors cursor-pointer hover:opacity-80"
              style={{ backgroundColor: "var(--c-card)", color: "var(--c-muted)" }}
              title="Refresh feed"
            >
              <RotateCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            {/* Shuffle / Random */}
            <button
              onClick={playRandom}
              className="p-2 rounded-full transition-colors"
              style={{ backgroundColor: "var(--c-card)", color: "var(--c-muted)" }}
              title="Play random (R)"
            >
              <Shuffle className="w-4 h-4" />
            </button>

            {/* Profile Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen((o) => !o)}
                className="p-2 rounded-full transition-colors flex items-center gap-1"
                style={{ backgroundColor: "var(--c-card)", color: "var(--c-muted)" }}
              >
                <User className="w-4 h-4" />
                <ChevronDown className="w-3 h-3" />
              </button>

              {profileOpen && (
                <div
                  className="absolute right-0 mt-2 w-64 rounded-xl border shadow-2xl z-50 p-3 space-y-3"
                  style={{ backgroundColor: "var(--c-surface)", borderColor: "var(--c-border)" }}
                >
                  {userEmail && (
                    <p className="text-xs truncate px-1" style={{ color: "var(--c-muted)" }}>
                      {userEmail}
                    </p>
                  )}

                  <div className="h-px" style={{ backgroundColor: "var(--c-border)" }} />

                  {/* Private Mode Toggle */}
                  <button
                    onClick={handleTogglePrivateMode}
                    className="w-full flex items-center justify-between px-2 py-2 rounded-lg transition-colors cursor-pointer"
                    style={{ backgroundColor: privateMode ? `${accent}18` : "transparent" }}
                  >
                    <div className="flex items-center gap-2">
                      {privateMode ? (
                        <Lock className="w-4 h-4" style={{ color: accent }} />
                      ) : (
                        <Unlock className="w-4 h-4" style={{ color: "var(--c-muted)" }} />
                      )}
                      <div className="text-left">
                        <p className="text-sm font-medium" style={{ color: "var(--c-text)" }}>
                          Private Mode
                        </p>
                        <p className="text-[11px]" style={{ color: "var(--c-muted)" }}>
                          {privateMode ? "Salon & vault feed active" : "Normal YouTube feed"}
                        </p>
                      </div>
                    </div>
                    {/* Toggle Switch */}
                    <div
                      className="w-9 h-5 rounded-full relative transition-colors shrink-0"
                      style={{ backgroundColor: privateMode ? accent : "var(--c-card)" }}
                    >
                      <div
                        className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                        style={{ transform: privateMode ? "translateX(18px)" : "translateX(2px)" }}
                      />
                    </div>
                  </button>

                  {/* Theme toggle (mobile) */}
                  <button
                    onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
                    className="sm:hidden w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-colors"
                    style={{ color: "var(--c-text)" }}
                  >
                    {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    <span className="text-sm">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
                  </button>

                  <div className="h-px" style={{ backgroundColor: "var(--c-border)" }} />

                  {/* Sign Out */}
                  <button
                    onClick={signOut}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors hover:bg-red-500/10 text-red-400 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filter Chips Bar */}
        <div className="max-w-7xl mx-auto mt-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {/* Source chips */}
          {SOURCE_CHIPS.map(({ id, icon: Icon, label }) => {
            const active = source === id;
            return (
              <button
                key={id}
                onClick={() => setSource(id)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                style={
                  active
                    ? { backgroundColor: accent, color: "white" }
                    : { backgroundColor: "var(--c-card)", color: "var(--c-muted)" }
                }
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            );
          })}

          <div className="h-4 w-px shrink-0" style={{ backgroundColor: "var(--c-border)" }} />

          {/* If Playlists source is selected: show playlist pills */}
          {source === "playlist" ? (
            <>
              {playlistNames.map((pName) => {
                const isSelected = activePlaylistName === pName;
                return (
                  <button
                    key={pName}
                    onClick={() => setSelectedPlaylist(pName)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                    style={
                      isSelected
                        ? { backgroundColor: accent, color: "white" }
                        : { backgroundColor: "var(--c-card)", color: "var(--c-muted)" }
                    }
                  >
                    <span>{pName}</span>
                    <span className="text-[10px] opacity-75">
                      ({(Array.isArray(playlists[pName]) ? playlists[pName].length : 0)})
                    </span>
                  </button>
                );
              })}

              {activePlaylistName && (
                <button
                  onClick={() => {
                    if (confirm(`Delete playlist "${activePlaylistName}"?`)) {
                      deletePlaylist(activePlaylistName, token, vaultFolderIdRef.current);
                      setSelectedPlaylist(null);
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 shrink-0 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition cursor-pointer"
                  title="Delete active playlist"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          ) : (
            /* Regular Category chips with Infinite Scrolling */
            categories.map((cat) => {
              const Icon = CATEGORY_ICONS[cat];
              const active = category === cat;
              return (
                <button
                  key={cat}
                  onClick={() => handleCategoryClick(cat)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                  style={
                    active
                      ? { backgroundColor: accent, color: "white" }
                      : { backgroundColor: "var(--c-card)", color: "var(--c-muted)" }
                  }
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />} {cat}
                </button>
              );
            })
          )}

          <div className="h-4 w-px shrink-0" style={{ backgroundColor: "var(--c-border)" }} />

          {/* Sort chips */}
          {(["default", "az", "duration"] as SortOrder[]).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-colors cursor-pointer"
              style={
                sort === s
                  ? { backgroundColor: "var(--c-text)", color: "var(--c-bg)" }
                  : { backgroundColor: "var(--c-card)", color: "var(--c-muted)" }
              }
            >
              {{ default: "Default", az: "A–Z", duration: "Duration" }[s]}
            </button>
          ))}
        </div>
      </header>

      {/* ── Active Video Player ── */}
      {activeVideo && (
        <Player
          video={activeVideo}
          resumeTime={getResumeTime(activeVideo.id)}
          accentColor={accent}
          isFav={isFav(activeVideo.id)}
          onToggleFav={(v) => toggleFav(v, token, vaultFolderIdRef.current)}
          onOpenPlaylistModal={(v) => setPlaylistTargetVideo(v)}
          onOpenChannel={(v) =>
            setActiveChannel({
              channel: v.channel,
              channelId: v.channelId,
              source: v.source,
            })
          }
          onClose={() => setActiveVideo(null)}
          onProgress={saveProgress}
          onRandom={playRandom}
          searchRef={searchRef}
        />
      )}

      {/* ── Channel View OR Main Video Feed ── */}
      {activeChannel ? (
        <ChannelView
          channel={activeChannel}
          accentColor={accent}
          driveVideos={driveVideos}
          onBack={() => setActiveChannel(null)}
          onPlay={setActiveVideo}
          onToggleFav={(v) => toggleFav(v, token, vaultFolderIdRef.current)}
          onOpenPlaylistModal={(v) => setPlaylistTargetVideo(v)}
          isFav={isFav}
          getProgress={getProgress}
        />
      ) : (
        <main className="max-w-7xl mx-auto px-4 pt-4 relative z-10">
          {/* YouTube Quota Warning */}
          {ytQuotaExceeded && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm bg-amber-500/10 border border-amber-500/20 text-amber-400">
              ⚠️ YouTube API daily quota reached — Drive vault still works. Try again tomorrow.
            </div>
          )}

          {/* Playlist Header if source is Playlist */}
          {source === "playlist" && (
            <div className="mb-4 flex items-center justify-between pb-2 border-b" style={{ borderColor: "var(--c-border)" }}>
              <div>
                <h2 className="text-base font-bold" style={{ color: "var(--c-text)" }}>
                  {activePlaylistName ? `📁 ${activePlaylistName}` : "Playlists"}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--c-muted)" }}>
                  {displayedVideos.length} videos in this playlist · Synced to Google Drive
                </p>
              </div>

              <button
                onClick={() => {
                  const name = prompt("Enter new playlist name:");
                  if (name) createPlaylist(name, null, token, vaultFolderIdRef.current);
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                style={{ backgroundColor: `${accent}18`, color: accent }}
              >
                <Plus className="w-3.5 h-3.5" /> New Playlist
              </button>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-6">
                {displayedVideos.map((video) => (
                  <VideoCard
                    key={`${video.source}-${video.id}`}
                    video={video}
                    progress={getProgress(video.id)}
                    isFav={isFav(video.id)}
                    onPlay={setActiveVideo}
                    onToggleFav={(v) => toggleFav(v, token, vaultFolderIdRef.current)}
                    onOpenPlaylistModal={(v) => setPlaylistTargetVideo(v)}
                    onOpenChannel={(v) =>
                      setActiveChannel({
                        channel: v.channel,
                        channelId: v.channelId,
                        source: v.source,
                      })
                    }
                    accentColor={accent}
                  />
                ))}
              </div>

              {/* Infinite Scroll Sentinel & Loading Indicator */}
              {(displayedVideos.length < allFiltered.length ||
                (nextPageToken && source !== "drive" && source !== "playlist")) && (
                <div ref={sentinelRef} className="h-20 flex items-center justify-center">
                  {(loadingMore || displayedVideos.length < allFiltered.length) && (
                    <div
                      className="w-6 h-6 rounded-full border-2 animate-spin"
                      style={{ borderColor: `${accent}40`, borderTopColor: accent }}
                    />
                  )}
                </div>
              )}

              {/* Empty state */}
              {displayedVideos.length === 0 && !loading && (
                <div className="py-20 text-center text-sm" style={{ color: "var(--c-muted)" }}>
                  {source === "favourites"
                    ? "No saved videos yet — tap the ♥ on any video to save it."
                    : source === "playlist"
                    ? "This playlist has no videos yet. Tap the playlist icon on any video to add it!"
                    : "No videos found. Try a different filter or search."}
                </div>
              )}
            </>
          )}
        </main>
      )}

      {/* ── Playlist Manager Modal ── */}
      {playlistTargetVideo && (
        <PlaylistModal
          video={playlistTargetVideo}
          playlists={playlists}
          accentColor={accent}
          isSyncing={isPlaylistSyncing}
          onClose={() => setPlaylistTargetVideo(null)}
          onToggleInPlaylist={(name) => {
            if (playlistTargetVideo) {
              toggleVideoInPlaylist(name, playlistTargetVideo, token, vaultFolderIdRef.current);
            }
          }}
          onCreatePlaylist={(name, vid) =>
            createPlaylist(name, vid, token, vaultFolderIdRef.current)
          }
        />
      )}

      {/* ── Mobile Bottom Navigation ── */}
      <BottomNav
        source={source}
        setSource={setSource}
        onSearchFocus={() => searchRef.current?.focus()}
        onProfile={() => setProfileOpen((o) => !o)}
        accentColor={accent}
      />
    </div>
  );
}
