import React, { useMemo, useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { Play, Search, Shuffle, X, Sparkles, FolderLock, TvMinimalPlay, LogIn } from "lucide-react";

interface VideoItem {
  id: string;
  source: "drive" | "youtube";
  title: string;
  category: string;
  thumbnail: string;
  duration?: string;
  channel: string;
}

const CATEGORIES = ["All", "Short", "Long", "Undercut", "Colors"];
const DEFAULT_YT_QUERIES = [
  "women short haircut transformation salon",
  "girls undercut haircut long to short makeover",
  "hair color transformation salon bob haircut",
];

function formatDuration(ms?: string): string | undefined {
  if (!ms) return undefined;
  const totalSec = Math.floor(Number(ms) / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function inferCategory(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("undercut") || t.includes("nape") || t.includes("buzz") || t.includes("shave")) return "Undercut";
  if (t.includes("color") || t.includes("dye") || t.includes("blonde") || t.includes("pink") || t.includes("balayage"))
    return "Colors";
  if (t.includes("short") || t.includes("pixie") || t.includes("bob")) return "Short";
  if (t.includes("long")) return "Long";
  return "All";
}

export default function App() {
  const [token, setToken] = useState<string>("");
  const [authError, setAuthError] = useState<string>("");
  const [driveVideos, setDriveVideos] = useState<VideoItem[]>([]);
  const [ytHome, setYtHome] = useState<VideoItem[]>([]);
  const [ytSearch, setYtSearch] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [source, setSource] = useState<"blended" | "drive" | "youtube">("blended");
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);

  const login = useGoogleLogin({
    scope: "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email",
    onSuccess: async (tokenResponse) => {
      const accessToken = tokenResponse.access_token;

      // Verify allowed emails (comma-separated list)
      const allowedEmails = import.meta.env.VITE_ALLOWED_EMAILS;
      if (allowedEmails) {
        const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const user = await userRes.json();
        const allowed = allowedEmails.split(",").map((e: string) => e.trim().toLowerCase());
        if (!allowed.includes(user.email?.toLowerCase())) {
          setAuthError("Access denied: Unauthorized Google account.");
          return;
        }
      }

      // Send token to Service Worker for <video> streaming
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({ type: "SET_TOKEN", token: accessToken });
      }
      navigator.serviceWorker?.ready.then((reg) => {
        reg.active?.postMessage({ type: "SET_TOKEN", token: accessToken });
      });

      setAuthError("");
      setToken(accessToken);
      loadAllVideos(accessToken);
    },
    onError: () => setAuthError("Google Sign-In failed. Please try again."),
  });

  async function loadAllVideos(accessToken: string) {
    setLoading(true);
    await Promise.all([fetchDriveVault(accessToken), fetchYouTubeFeed()]);
    setLoading(false);
  }

  async function fetchDriveVault(accessToken: string) {
    // 1. Find ALL folders named "videos" (Account A + Account B shared folder)
    const folderQuery = encodeURIComponent(
      "name = 'videos' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    );
    const foldersRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${folderQuery}&fields=files(id,name,owners(displayName))&includeItemsFromAllDrives=true&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const foldersData = await foldersRes.json();
    const folders = foldersData.files || [];

    const allVideos: VideoItem[] = [];
    const seen = new Set<string>();

    for (const folder of folders) {
      const ownerName = folder.owners?.[0]?.displayName || "Drive Vault";
      let pageToken = "";

      do {
        const q = encodeURIComponent(`'${folder.id}' in parents and mimeType contains 'video/' and trashed = false`);
        const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=nextPageToken,files(id,name,thumbnailLink,videoMediaMetadata)&orderBy=createdTime desc&pageSize=100&includeItemsFromAllDrives=true&supportsAllDrives=true${
          pageToken ? `&pageToken=${pageToken}` : ""
        }`;

        const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        const data = await res.json();

        for (const file of data.files || []) {
          if (seen.has(file.id)) continue;
          seen.add(file.id);

          const cleanTitle = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ");
          allVideos.push({
            id: file.id,
            source: "drive",
            title: cleanTitle,
            category: inferCategory(cleanTitle),
            channel: ownerName,
            thumbnail: file.thumbnailLink ? file.thumbnailLink.replace(/=s\d+$/, "=s640") : "",
            duration: formatDuration(file.videoMediaMetadata?.durationMillis),
          });
        }
        pageToken = data.nextPageToken || "";
      } while (pageToken);
    }

    setDriveVideos(allVideos);
  }

  async function fetchYouTubeFeed(searchQuery?: string) {
    const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
    if (!apiKey) return;

    const queries = searchQuery ? [`${searchQuery} haircut`] : DEFAULT_YT_QUERIES;
    const results: VideoItem[] = [];
    const seen = new Set<string>();

    for (const q of queries) {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=${
        searchQuery ? 12 : 8
      }&q=${encodeURIComponent(q)}&key=${apiKey}`;

      const res = await fetch(url);
      const data = await res.json();

      for (const item of data.items || []) {
        const vid = item.id?.videoId;
        if (!vid || seen.has(vid)) continue;
        seen.add(vid);

        results.push({
          id: vid,
          source: "youtube",
          title: item.snippet.title,
          channel: item.snippet.channelTitle,
          category: inferCategory(item.snippet.title),
          thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || "",
        });
      }
    }

    if (searchQuery) {
      setYtSearch(results);
    } else {
      setYtHome(results);
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!search.trim()) {
      setYtSearch([]);
      return;
    }
    fetchYouTubeFeed(search.trim());
  }

  const displayedVideos = useMemo(() => {
    const q = search.trim().toLowerCase();
    const dFiltered = driveVideos.filter((v) => {
      const catOk = category === "All" || v.category === category;
      const qOk = !q || v.title.toLowerCase().includes(q) || v.category.toLowerCase().includes(q);
      return catOk && qOk;
    });

    const ytPool = q ? ytSearch : ytHome;
    const yFiltered = ytPool.filter((v) => (q ? true : category === "All" || v.category === category));

    if (source === "drive") return dFiltered;
    if (source === "youtube") return yFiltered;

    const blended: VideoItem[] = [];
    const max = Math.max(dFiltered.length, yFiltered.length);
    for (let i = 0; i < max; i++) {
      if (i < dFiltered.length) blended.push(dFiltered[i]);
      if (i < yFiltered.length) blended.push(yFiltered[i]);
    }
    return blended;
  }, [driveVideos, ytHome, ytSearch, source, category, search]);

  function playRandom() {
    if (!displayedVideos.length) return;
    const pick = displayedVideos[Math.floor(Math.random() * displayedVideos.length)];
    setActiveVideo(pick);
  }

  // Sign-In Screen
  if (!token) {
    return (
      <div className='min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center p-6'>
        <div className='w-full max-w-xs bg-[#181818] border border-zinc-800 rounded-2xl p-6 text-center shadow-2xl'>
          <div className='flex items-center justify-center gap-2 mb-3'>
            <div className='w-9 h-6 bg-[#ff0000] rounded-md flex items-center justify-center'>
              <Play className='w-3.5 h-3.5 fill-white text-white ml-0.5' />
            </div>
            <span className='text-xl font-bold tracking-tight'>YouTube</span>
          </div>
          <p className='text-xs text-zinc-400 mb-6'>Sign in with your Google account to load your Vault &amp; stream</p>
          {authError && <p className='text-xs text-red-400 mb-4'>{authError}</p>}
          <button
            onClick={() => login()}
            className='w-full bg-[#ff0000] hover:bg-red-600 text-white py-2.5 rounded-full font-medium text-sm flex items-center justify-center gap-2 transition cursor-pointer'>
            <LogIn className='w-4 h-4' /> Continue with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-[#0f0f0f] text-white pb-16'>
      {/* Sticky YouTube Header */}
      <header className='sticky top-0 z-40 bg-[#0f0f0f]/95 backdrop-blur-md border-b border-zinc-800/80 px-4 py-2.5'>
        <div className='max-w-7xl mx-auto flex items-center gap-3'>
          {/* YouTube Logo */}
          <div
            onClick={() => {
              setActiveVideo(null);
              setSource("blended");
              setCategory("All");
              setSearch("");
              setYtSearch([]);
            }}
            className='flex items-center gap-1.5 cursor-pointer shrink-0'>
            <div className='w-8 h-5.5 bg-[#ff0000] rounded-md flex items-center justify-center'>
              <Play className='w-3 h-3 fill-white text-white ml-0.5' />
            </div>
            <span className='font-bold text-lg tracking-tighter'>YouTube</span>
          </div>

          {/* Search Pill */}
          <form onSubmit={handleSearchSubmit} className='flex-1 max-w-xl mx-auto relative'>
            <input
              type='text'
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (!e.target.value) setYtSearch([]);
              }}
              placeholder='Search'
              className='w-full bg-[#121212] border border-zinc-800 rounded-full py-1.5 pl-4 pr-10 text-sm outline-none focus:border-blue-500'
            />
            <button type='submit' className='absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white'>
              <Search className='w-4 h-4' />
            </button>
          </form>

          {/* Shuffle Button */}
          <button
            onClick={playRandom}
            className='p-2 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 shrink-0'
            title='Play Random'>
            <Shuffle className='w-4 h-4' />
          </button>
        </div>

        {/* Filter Chips Bar */}
        <div className='max-w-7xl mx-auto mt-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar'>
          <button
            onClick={() => setSource("blended")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0 transition ${
              source === "blended" ? "bg-white text-black" : "bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700"
            }`}>
            <Sparkles className='w-3.5 h-3.5' /> All
          </button>
          <button
            onClick={() => setSource("drive")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0 transition ${
              source === "drive" ? "bg-white text-black" : "bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700"
            }`}>
            <FolderLock className='w-3.5 h-3.5' /> Vault ({driveVideos.length})
          </button>
          <button
            onClick={() => setSource("youtube")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0 transition ${
              source === "youtube" ? "bg-white text-black" : "bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700"
            }`}>
            <TvMinimalPlay className='w-3.5 h-3.5 text-[#ff0000]' /> YouTube
          </button>

          <div className='h-4 w-[1px] bg-zinc-800 mx-1 shrink-0' />

          {CATEGORIES.filter((c) => c !== "All").map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(category === cat ? "All" : cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition ${
                category === cat ? "bg-white text-black" : "bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700"
              }`}>
              {cat}
            </button>
          ))}
        </div>
      </header>

      {/* Pinned Mobile/Desktop Watch Player */}
      {activeVideo && (
        <section className='sticky top-[96px] z-30 bg-black border-b border-zinc-800 shadow-2xl'>
          <div className='max-w-5xl mx-auto'>
            <div className='relative aspect-video w-full bg-black'>
              {activeVideo.source === "drive" ? (
                <video
                  key={activeVideo.id}
                  src={`/drive-stream/${activeVideo.id}`}
                  controls
                  autoPlay
                  playsInline
                  className='w-full h-full object-contain'
                />
              ) : (
                <iframe
                  key={activeVideo.id}
                  src={`https://www.youtube-nocookie.com/embed/${activeVideo.id}?autoplay=1&playsinline=1&rel=0`}
                  allow='autoplay; fullscreen; encrypted-media'
                  allowFullScreen
                  className='w-full h-full border-0'
                />
              )}
            </div>
            <div className='px-4 py-3 bg-[#0f0f0f] flex items-start justify-between gap-3'>
              <div>
                <h2 className='text-sm sm:text-base font-semibold line-clamp-2'>{activeVideo.title}</h2>
                <p className='text-xs text-zinc-400 mt-1'>
                  {activeVideo.channel} • {activeVideo.category}
                </p>
              </div>
              <button
                onClick={() => setActiveVideo(null)}
                className='p-1.5 rounded-full bg-zinc-800 text-zinc-300 hover:text-white shrink-0'>
                <X className='w-4 h-4' />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Video Feed Grid */}
      <main className='max-w-7xl mx-auto px-4 pt-4'>
        {loading ? (
          <div className='text-center py-20 text-sm text-zinc-400'>Loading videos...</div>
        ) : (
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-6'>
            {displayedVideos.map((video) => (
              <div
                key={`${video.source}-${video.id}`}
                onClick={() => setActiveVideo(video)}
                className='group cursor-pointer flex flex-col'>
                <div className='relative aspect-video w-full rounded-xl overflow-hidden bg-zinc-900'>
                  {video.thumbnail ? (
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      loading='lazy'
                      className='w-full h-full object-cover group-hover:scale-105 transition duration-200'
                    />
                  ) : (
                    <video
                      src={`/drive-stream/${video.id}#t=1.5`}
                      preload='metadata'
                      muted
                      playsInline
                      className='w-full h-full object-cover'
                    />
                  )}

                  {video.duration && (
                    <span className='absolute bottom-1.5 right-1.5 bg-black/85 text-white text-[11px] font-medium px-1.5 py-0.5 rounded'>
                      {video.duration}
                    </span>
                  )}
                </div>

                <div className='mt-2.5 flex gap-3'>
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      video.source === "drive" ? "bg-zinc-800 text-white" : "bg-[#ff0000]/15 text-[#ff0000]"
                    }`}>
                    {video.channel.slice(0, 2).toUpperCase()}
                  </div>
                  <div className='min-w-0 flex-1'>
                    <h3 className='text-sm font-medium text-zinc-100 line-clamp-2 leading-snug'>{video.title}</h3>
                    <p className='text-xs text-zinc-400 mt-0.5 truncate'>
                      {video.channel} • {video.category}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
