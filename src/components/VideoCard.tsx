import { useEffect, useRef, useState } from "react";
import { Heart } from "lucide-react";
import type { VideoItem } from "../types";

interface Props {
  video: VideoItem;
  progress: number; // 0–1
  isFav: boolean;
  onPlay: (v: VideoItem) => void;
  onToggleFav: (id: string) => void;
  accentColor: string;
}

export function VideoCard({ video, progress, isFav, onPlay, onToggleFav, accentColor }: Props) {
  const [hovered, setHovered] = useState(false);
  const previewRef = useRef<HTMLVideoElement>(null);
  const isDrive = video.source === "drive";

  // Drive hover preview — only load video src on hover
  useEffect(() => {
    const v = previewRef.current;
    if (!v || !isDrive) return;
    if (hovered) {
      v.src = `/drive-stream/${video.id}`;
      v.play().catch(() => {});
    } else {
      v.pause();
      v.removeAttribute("src");
      v.load();
    }
  }, [hovered, video.id, isDrive]);

  return (
    <div
      className="group cursor-pointer flex flex-col"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onPlay(video)}
    >
      {/* Thumbnail container */}
      <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-zinc-900 video-card-thumb">

        {/* Static thumbnail */}
        {video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt={video.title}
            loading="lazy"
            className={`w-full h-full object-cover transition duration-300 ${
              hovered && isDrive ? "opacity-0" : "group-hover:scale-105"
            }`}
          />
        ) : (
          <div className="w-full h-full" style={{ backgroundColor: "var(--c-card)" }} />
        )}

        {/* Drive hover video preview */}
        {isDrive && (
          <video
            ref={previewRef}
            muted
            playsInline
            loop
            preload="none"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              hovered ? "opacity-100" : "opacity-0"
            }`}
          />
        )}

        {/* Watch progress bar */}
        {progress > 0.02 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
            <div
              className="h-full transition-all"
              style={{ width: `${Math.min(progress * 100, 100)}%`, backgroundColor: accentColor }}
            />
          </div>
        )}

        {/* Duration badge */}
        {video.duration && (
          <span className="absolute bottom-1.5 right-1.5 bg-black/85 text-white text-[11px] font-medium px-1.5 py-0.5 rounded">
            {video.duration}
          </span>
        )}

        {/* Favourite button */}
        <button
          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity z-10"
          onClick={(e) => { e.stopPropagation(); onToggleFav(video.id); }}
          title={isFav ? "Remove from saved" : "Save"}
        >
          <Heart
            className="w-3.5 h-3.5 transition-colors"
            style={{ color: isFav ? accentColor : "white", fill: isFav ? accentColor : "transparent" }}
          />
        </button>
      </div>

      {/* Meta row */}
      <div className="mt-2.5 flex gap-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{
            backgroundColor: isDrive ? "var(--c-card)" : `${accentColor}22`,
            color: isDrive ? "var(--c-text)" : accentColor,
          }}
        >
          {video.channel.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className="text-sm font-medium line-clamp-2 leading-snug"
            style={{ color: "var(--c-text)" }}
          >
            {video.title}
          </h3>
          <p className="text-xs mt-0.5 truncate" style={{ color: "var(--c-muted)" }}>
            {video.channel} · {video.category}
          </p>
        </div>
      </div>
    </div>
  );
}
