import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import {
  Play, Search, Shuffle, Sparkles, FolderLock, TvMinimalPlay, LogIn,
  Sun, Moon, Lock, Unlock, ChevronDown, User, LogOut,
  Scissors, Ruler, Zap, Palette, Heart,
  Flame, Music, Gamepad2, Cpu, Newspaper, Mic,
} from "lucide-react";

import { VideoCard } from "./components/VideoCard";
import { Player } from "./components/Player";
import { SkeletonCard } from "./components/SkeletonCard";
import { BottomNav } from "./components/BottomNav";
import { useWatchHistory } from "./hooks/useWatchHistory";
import { useFavourites } from "./hooks/useFavourites";
import type { VideoItem, SourceFilter, SortOrder, AppTheme } from "./types";

// ── Categories & Queries ─────────────────────────────────────────────────────
const PRIVATE_CATEGORIES = ["All", "Short", "Long", "Undercut", "Colors"] as const;
const NORMAL_CATEGORIES = ["All", "Trending", "Music", "Gaming", "Tech", "News", "Podcasts"] as const;

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  All: Sparkles,
  // Private
  Short: Scissors,
  Long: Ruler,
  Undercut: Zap,
  Colors: Palette,
  // Normal
  Trending: Flame,
  Music: Music,
  Gaming: Gamepad2,
  Tech: Cpu,
  News: Newspaper,
  Podcasts: Mic,
};

const PRIVATE_CATEGORY_QUERIES: Record<string, string> = {
  All: "women haircut transformation salon makeover bob undercut",
  Short: "women short haircut pixie bob transformation salon makeover",
  Long: "girls long hair haircut makeover transformation layers salon",
  Undercut: "women undercut haircut nape buzz shave makeover salon",
  Colors: "hair color transformation balayage blonde salon dye makeover",
};

const NORMAL_CATEGORY_QUERIES: Record<string, string> = {
  All: "trending popular viral videos",
  Trending: "trending videos popular today",
  Music: "top trending official music videos songs",
  Gaming: "popular gaming gameplay walkthrough",
  Tech: "latest technology gadgets reviews",
  News: "top news headlines world today",
  Podcasts: "popular podcast interviews full episodes",
};

const PAGE_SIZE = 20;
const TOKEN_KEY = "yt_token";

// ── Helpers ──────────────────────────────────────────────────────────────────
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
  const [sort, setSort] = useState<SortOrder>("default");
  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);
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

  const nextPageTokenRef = useRef(nextPageToken);
  nextPageTokenRef.current = nextPageToken;

  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  const loadingMoreRef = useRef(loadingMore);
  loadingMoreRef.current = loadingMore;

  const seenIdsRef = useRef<Set<string>>(new Set());

  // Custom hooks
  const { saveProgress, getProgress, getResumeTime } = useWatchHistory();
  const { toggle: toggleFav, isFav } = useFavourites();

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
      const targetQuery = opts.query !== undefined ? opts.query : searchRefState.current;

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
          // Explicit search
          const q = targetPrivate ? `${targetQuery} haircut makeover` : targetQuery;
          url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=20&q=${encodeURIComponent(q)}${pageTokenParam}&key=${apiKey}`;
        } else if (targetPrivate) {
          // Private mode category query
          const q = PRIVATE_CATEGORY_QUERIES[targetCat] || PRIVATE_CATEGORY_QUERIES.All;
          url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=20&q=${encodeURIComponent(q)}${pageTokenParam}&key=${apiKey}`;
        } else {
          // Normal mode: trending suggestions or normal categories
          if (targetCat === "All" || targetCat === "Trending") {
            url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&chart=mostPopular&maxResults=20&regionCode=US${pageTokenParam}&key=${apiKey}`;
          } else {
            const q = NORMAL_CATEGORY_QUERIES[targetCat] || NORMAL_CATEGORY_QUERIES.All;
            url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=20&q=${encodeURIComponent(q)}${pageTokenParam}&key=${apiKey}`;
          }
        }

        const res = await fetch(url);
        const data = await res.json();

        if (data.error?.code === 403 || data.error?.errors?.[0]?.reason === "quotaExceeded") {
          setYtQuotaExceeded(true);
          return;
        }

        let items = data.items || [];
        let nextTok = data.nextPageToken || null;

        // Fallback for trending if videos endpoint returns empty in specific region
        if (!targetQuery && !targetPrivate && (targetCat === "All" || targetCat === "Trending") && items.length === 0 && !isNext) {
          const fallbackUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=20&q=${encodeURIComponent("trending popular viral videos")}&key=${apiKey}`;
          const fallbackRes = await fetch(fallbackUrl);
          const fallbackData = await fallbackRes.json();
          items = fallbackData.items || [];
          nextTok = fallbackData.nextPageToken || null;
        }

        nextPageTokenRef.current = nextTok;
        setNextPageToken(nextTok);

        const newVideos: VideoItem[] = [];
        for (const item of items) {
          const vid = typeof item.id === "string" ? item.id : item.id?.videoId;
          if (!vid || seenIdsRef.current.has(vid)) continue;
          seenIdsRef.current.add(vid);

          const dur = item.contentDetails?.duration
            ? parseISODuration(item.contentDetails.duration)
            : undefined;

          newVideos.push({
            id: vid,
            source: "youtube",
            title: item.snippet.title,
            channel: item.snippet.channelTitle,
            category: targetCat === "All" ? inferCategory(item.snippet.title) : targetCat,
            thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || "",
            duration: dur?.label,
            durationSec: dur?.sec,
          });
        }

        if (isNext) {
          setYtVideos((prev) => [...prev, ...newVideos]);
          setPage((p) => p + 1);
        } else {
          setYtVideos(newVideos);
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

  // ── Drive Vault Fetching ──────────────────────────────────────────────────
  const fetchDriveVault = useCallback(async (accessToken: string) => {
    const folderQuery = encodeURIComponent(
      "name = 'videos' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    );
    const foldersRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${folderQuery}&fields=files(id,name,owners(displayName))&includeItemsFromAllDrives=true&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (foldersRes.status === 401) {
      setToken("");
      sessionStorage.removeItem(TOKEN_KEY);
      setAuthError("Session expired. Please sign in again.");
      return;
    }

    const foldersData = await foldersRes.json();
    const folders = foldersData.files || [];
    const allVideos: VideoItem[] = [];
    const seen = new Set<string>();

    for (const folder of folders) {
      const ownerName = folder.owners?.[0]?.displayName || "Drive Vault";
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
  }, []);

  const loadAllVideos = useCallback(async (accessToken: string, isPrivate: boolean) => {
    setLoading(true);
    await Promise.all([
      fetchDriveVault(accessToken),
      fetchYouTubeFeed({ isPrivate, cat: "All", isNextPage: false }),
    ]);
    setLoading(false);
  }, [fetchDriveVault, fetchYouTubeFeed]);

  // ── Session restore on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (token) {
      loadAllVideos(token, privateMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Filtering, Sorting & Pagination Memo ──────────────────────────────────
  const allFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();

    const dFiltered = driveVideos.filter((v) => {
      const catOk = category === "All" || v.category === category;
      const qOk = !q || v.title.toLowerCase().includes(q) || v.category.toLowerCase().includes(q);
      return catOk && qOk;
    });

    const ytFiltered = ytVideos.filter((v) => {
      const catOk = category === "All" || v.category === category || !privateMode;
      const qOk = !q || v.title.toLowerCase().includes(q) || v.channel.toLowerCase().includes(q);
      return catOk && qOk;
    });

    let list: VideoItem[];

    if (source === "drive") {
      list = dFiltered;
    } else if (source === "youtube") {
      list = ytFiltered;
    } else if (source === "favourites") {
      const all = [...driveVideos, ...ytVideos];
      const seen = new Set<string>();
      list = all.filter((v) => {
        if (seen.has(v.id) || !isFav(v.id)) return false;
        seen.add(v.id);
        return true;
      });
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
  }, [driveVideos, ytVideos, source, category, search, sort, isFav, privateMode]);

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
            source !== "drive"
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
    scope: "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email",
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
    setPage(1);
    fetchYouTubeFeed({ isPrivate: next, cat: "All", query: "", isNextPage: false });
  };

  const handleCategoryClick = (cat: string) => {
    const newCat = category === cat ? "All" : cat;
    setCategory(newCat);
    setPage(1);
    fetchYouTubeFeed({ cat: newCat, isNextPage: false });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    setPage(1);
    fetchYouTubeFeed({ query: q, isNextPage: false });
  };

  const playRandom = useCallback(() => {
    if (!displayedVideos.length) return;
    setActiveVideo(displayedVideos[Math.floor(Math.random() * displayedVideos.length)]);
  }, [displayedVideos]);

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
    { id: "favourites" as SourceFilter, icon: Heart, label: "Saved" },
  ];

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
              setSource("blended");
              setCategory("All");
              setSearch("");
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
                setSearch(e.target.value);
                if (!e.target.value) {
                  fetchYouTubeFeed({ query: "", isNextPage: false });
                }
              }}
              placeholder="Search · press / to focus"
              className="w-full rounded-full py-1.5 pl-4 pr-10 text-sm outline-none transition-colors"
              style={{
                backgroundColor: "var(--c-card)",
                border: "1px solid var(--c-border)",
                color: "var(--c-text)",
              }}
            />
            <button
              type="submit"
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
              style={{ color: "var(--c-muted)" }}
            >
              <Search className="w-4 h-4" />
            </button>
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

          {/* Category chips with Infinite Scrolling on Click */}
          {categories.map((cat) => {
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
          })}

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
          onClose={() => setActiveVideo(null)}
          onProgress={saveProgress}
          onRandom={playRandom}
          searchRef={searchRef}
        />
      )}

      {/* ── Main Video Feed ── */}
      <main className="max-w-7xl mx-auto px-4 pt-4 relative z-10">
        {/* YouTube Quota Warning */}
        {ytQuotaExceeded && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm bg-amber-500/10 border border-amber-500/20 text-amber-400">
            ⚠️ YouTube API daily quota reached — Drive vault still works. Try again tomorrow.
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
                  onToggleFav={toggleFav}
                  accentColor={accent}
                />
              ))}
            </div>

            {/* Infinite Scroll Sentinel & Loading Indicator */}
            {(displayedVideos.length < allFiltered.length || (nextPageToken && source !== "drive")) && (
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
                  : "No videos found. Try a different filter or search."}
              </div>
            )}
          </>
        )}
      </main>

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
