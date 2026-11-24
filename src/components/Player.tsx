import React, { useEffect, useRef } from "react";
import { X, PictureInPicture2, Heart, ListPlus } from "lucide-react";
import type { VideoItem } from "../types";

interface Props {
  video: VideoItem;
  resumeTime: number;
  accentColor: string;
  isFav: boolean;
  onToggleFav: (video: VideoItem) => void;
  onOpenPlaylistModal?: (v: VideoItem) => void;
  onOpenChannel?: (v: VideoItem) => void;
  onClose: () => void;
  onProgress: (id: string, current: number, duration: number) => void;
  onRandom: () => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
}

export function Player({
  video,
  resumeTime,
  accentColor,
  isFav,
  onToggleFav,
  onOpenPlaylistModal,
  onOpenChannel,
  onClose,
  onProgress,
  onRandom,
  searchRef,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Apply resume time once metadata loads
  useEffect(() => {
    const v = videoRef.current;
    if (!v || resumeTime <= 0) return;
    const apply = () => {
      v.currentTime = resumeTime;
    };
    v.addEventListener("loadedmetadata", apply, { once: true });
    return () => v.removeEventListener("loadedmetadata", apply);
  }, [video.id, resumeTime]);

  // Save watch progress on timeupdate
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const handler = () => {
      if (v.duration) onProgress(video.id, v.currentTime, v.duration);
    };
    v.addEventListener("timeupdate", handler);
    return () => v.removeEventListener("timeupdate", handler);
  }, [video.id, onProgress]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      const v = videoRef.current;
      switch (e.key) {
        case " ":
          e.preventDefault();
          if (video.source === "drive" && v) (v.paused ? v.play() : v.pause());
          break;
        case "f":
        case "F":
          if (video.source === "drive" && v) v.requestFullscreen?.();
          break;
        case "Escape":
          onClose();
          break;
        case "r":
        case "R":
          onRandom();
          break;
        case "/":
          e.preventDefault();
          searchRef.current?.focus();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [video, onClose, onRandom, searchRef]);

  const enterPiP = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch {
      /* unsupported or permission denied */
    }
  };

  const pipAvailable = typeof document !== "undefined" && "pictureInPictureEnabled" in document;

  return (
    <section
      className="sticky top-24 z-30 border-b shadow-2xl"
      style={{ backgroundColor: "black", borderColor: "var(--c-border)" }}
    >
      <div className="max-w-5xl mx-auto">
        {/* Video stream area */}
        <div className="relative aspect-video w-full bg-black">
          {video.source === "drive" ? (
            <video
              key={video.id}
              ref={videoRef}
              src={`/drive-stream/${video.id}`}
              controls
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
          ) : (
            <iframe
              key={video.id}
              src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&playsinline=1&rel=0`}
              allow="autoplay; fullscreen; encrypted-media"
              allowFullScreen
              className="w-full h-full border-0"
            />
          )}
        </div>

        {/* Info bar & controls */}
        <div
          className="px-4 py-3 flex items-start justify-between gap-3"
          style={{ backgroundColor: "var(--c-surface)" }}
        >
          <div className="min-w-0 flex-1">
            <h2
              className="text-sm sm:text-base font-semibold line-clamp-2"
              style={{ color: "var(--c-text)" }}
            >
              {video.title}
            </h2>

            {/* Clickable Channel Icon & Info */}
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => onOpenChannel?.(video)}
                className="flex items-center gap-2 group hover:opacity-90 transition text-left cursor-pointer"
                title={`Visit ${video.channel}'s channel`}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition group-hover:ring-2"
                  style={{
                    backgroundColor: video.source === "drive" ? "var(--c-card)" : `${accentColor}25`,
                    color: video.source === "drive" ? "var(--c-text)" : accentColor,
                  }}
                >
                  {video.channel.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <span
                    className="text-xs font-semibold group-hover:underline truncate block"
                    style={{ color: "var(--c-text)" }}
                  >
                    {video.channel}
                  </span>
                  <span className="text-[11px] block" style={{ color: "var(--c-muted)" }}>
                    {video.category} {video.duration && `· ${video.duration}`}
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
            {/* Favorite / Save Button */}
            <button
              onClick={() => onToggleFav(video)}
              className="p-2 rounded-full transition cursor-pointer flex items-center justify-center"
              style={{
                backgroundColor: isFav ? `${accentColor}20` : "var(--c-card)",
              }}
              title={isFav ? "Remove from Saved" : "Save to Favorites"}
            >
              <Heart
                className="w-4 h-4 transition-colors"
                style={{
                  color: isFav ? accentColor : "var(--c-muted)",
                  fill: isFav ? accentColor : "transparent",
                }}
              />
            </button>

            {/* Add to Playlist Button */}
            {onOpenPlaylistModal && (
              <button
                onClick={() => onOpenPlaylistModal(video)}
                className="p-2 rounded-full transition cursor-pointer flex items-center justify-center"
                style={{ backgroundColor: "var(--c-card)", color: "var(--c-muted)" }}
                title="Add to Playlist"
              >
                <ListPlus className="w-4 h-4" />
              </button>
            )}

            {/* Picture-in-Picture (Drive only) */}
            {video.source === "drive" && pipAvailable && (
              <button
                onClick={enterPiP}
                className="p-2 rounded-full transition cursor-pointer"
                style={{ backgroundColor: "var(--c-card)", color: "var(--c-muted)" }}
                title="Picture-in-Picture"
              >
                <PictureInPicture2 className="w-4 h-4" />
              </button>
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-full transition cursor-pointer"
              style={{ backgroundColor: "var(--c-card)", color: "var(--c-muted)" }}
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Keyboard hint */}
        <div
          className="hidden sm:flex px-4 pb-2 gap-4 text-[11px]"
          style={{ color: "var(--c-muted)" }}
        >
          <span>Space play/pause</span>
          <span>F fullscreen</span>
          <span>R random</span>
          <span>/ search</span>
          <span>Esc close</span>
        </div>
      </div>
    </section>
  );
}
