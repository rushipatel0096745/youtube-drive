import React, { useEffect, useRef } from "react";
import { X, PictureInPicture2 } from "lucide-react";
import type { VideoItem } from "../types";

interface Props {
  video: VideoItem;
  resumeTime: number;
  accentColor: string;
  onClose: () => void;
  onProgress: (id: string, current: number, duration: number) => void;
  onRandom: () => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
}

export function Player({ video, resumeTime, onClose, onProgress, onRandom, searchRef }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Apply resume time once metadata loads
  useEffect(() => {
    const v = videoRef.current;
    if (!v || resumeTime <= 0) return;
    const apply = () => { v.currentTime = resumeTime; };
    v.addEventListener("loadedmetadata", apply, { once: true });
    return () => v.removeEventListener("loadedmetadata", apply);
  }, [video.id, resumeTime]);

  // Save watch progress on timeupdate (throttled by browser ~4x/sec)
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
          if (video.source === "drive" && v) v.paused ? v.play() : v.pause();
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
    } catch { /* unsupported or permission denied */ }
  };

  const pipAvailable = typeof document !== "undefined" && "pictureInPictureEnabled" in document;

  return (
    <section className="sticky top-24 z-30 border-b shadow-2xl" style={{ backgroundColor: "black", borderColor: "var(--c-border)" }}>
      <div className="max-w-5xl mx-auto">
        {/* Video area */}
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

        {/* Info bar */}
        <div
          className="px-4 py-3 flex items-start justify-between gap-3"
          style={{ backgroundColor: "var(--c-surface)" }}
        >
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-semibold line-clamp-2" style={{ color: "var(--c-text)" }}>
              {video.title}
            </h2>
            <p className="text-xs mt-1" style={{ color: "var(--c-muted)" }}>
              {video.channel} · {video.category}
              {video.duration && ` · ${video.duration}`}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* PiP — Drive only */}
            {video.source === "drive" && pipAvailable && (
              <button
                onClick={enterPiP}
                className="p-1.5 rounded-full transition"
                style={{ backgroundColor: "var(--c-card)", color: "var(--c-muted)" }}
                title="Picture-in-Picture"
              >
                <PictureInPicture2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-full transition"
              style={{ backgroundColor: "var(--c-card)", color: "var(--c-muted)" }}
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Keyboard hint */}
        <div className="hidden sm:flex px-4 pb-2 gap-4 text-[11px]" style={{ color: "var(--c-muted)" }}>
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
