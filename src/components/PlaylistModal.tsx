import React, { useState } from "react";
import { X, Check, Plus, ListMusic, Cloud } from "lucide-react";
import type { VideoItem, PlaylistsMap } from "../types";

interface Props {
  video: VideoItem;
  playlists: PlaylistsMap;
  accentColor: string;
  isSyncing: boolean;
  onClose: () => void;
  onToggleInPlaylist: (playlistName: string) => void;
  onCreatePlaylist: (name: string, video: VideoItem) => void;
}

export function PlaylistModal({
  video,
  playlists,
  accentColor,
  isSyncing,
  onClose,
  onToggleInPlaylist,
  onCreatePlaylist,
}: Props) {
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const playlistNames = Object.keys(playlists);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newPlaylistName.trim();
    if (!name) return;
    onCreatePlaylist(name, video);
    setNewPlaylistName("");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border shadow-2xl p-5 space-y-4"
        style={{
          backgroundColor: "var(--c-surface)",
          borderColor: "var(--c-border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div
              className="p-2 rounded-xl"
              style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
            >
              <ListMusic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: "var(--c-text)" }}>
                Save to playlist
              </h3>
              <p className="text-xs truncate max-w-[200px]" style={{ color: "var(--c-muted)" }}>
                {video.title}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full transition cursor-pointer hover:opacity-80"
            style={{ backgroundColor: "var(--c-card)", color: "var(--c-muted)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Existing Playlists Checklist */}
        <div className="space-y-1 max-h-56 overflow-y-auto no-scrollbar py-1">
          {playlistNames.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color: "var(--c-muted)" }}>
              No playlists yet. Create your first playlist below!
            </p>
          ) : (
            playlistNames.map((name) => {
              const list = Array.isArray(playlists[name]) ? playlists[name] : [];
              const isChecked = list.includes(video.id);
              return (
                <button
                  key={name}
                  onClick={() => onToggleInPlaylist(name)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition cursor-pointer text-left hover:opacity-90"
                  style={{
                    backgroundColor: isChecked ? `${accentColor}15` : "var(--c-card)",
                  }}
                >
                  <span
                    className="text-xs font-medium truncate"
                    style={{ color: "var(--c-text)" }}
                  >
                    {name}
                  </span>

                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center border transition"
                    style={{
                      borderColor: isChecked ? accentColor : "var(--c-border)",
                      backgroundColor: isChecked ? accentColor : "transparent",
                    }}
                  >
                    {isChecked && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Create New Playlist Form */}
        <form onSubmit={handleCreate} className="pt-2 border-t space-y-2" style={{ borderColor: "var(--c-border)" }}>
          <div className="flex gap-2">
            <input
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="New playlist name..."
              className="flex-1 rounded-xl px-3 py-2 text-xs outline-none transition"
              style={{
                backgroundColor: "var(--c-card)",
                border: "1px solid var(--c-border)",
                color: "var(--c-text)",
              }}
            />
            <button
              type="submit"
              disabled={!newPlaylistName.trim()}
              className="px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition cursor-pointer disabled:opacity-40"
              style={{
                backgroundColor: accentColor,
                color: "white",
              }}
            >
              <Plus className="w-3.5 h-3.5" /> Create
            </button>
          </div>
        </form>

        {/* Cloud Sync Status Footer */}
        <div
          className="flex items-center justify-between text-[11px] pt-1"
          style={{ color: "var(--c-muted)" }}
        >
          <div className="flex items-center gap-1.5">
            <Cloud
              className={`w-3.5 h-3.5 ${isSyncing ? "animate-pulse text-amber-400" : "text-emerald-400"}`}
            />
            <span>{isSyncing ? "Syncing to Google Drive..." : "Synced to Google Drive"}</span>
          </div>
          <span style={{ color: "var(--c-muted)" }}>{playlistNames.length} playlists</span>
        </div>
      </div>
    </div>
  );
}
