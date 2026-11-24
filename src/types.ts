export interface VideoItem {
  id: string;
  source: "drive" | "youtube";
  title: string;
  category: string;
  thumbnail: string;
  duration?: string;      // formatted "5:30"
  durationSec?: number;   // raw seconds for sort
  channel: string;
  channelId?: string;     // YouTube channel ID
}

export type SourceFilter = "blended" | "drive" | "youtube" | "favourites" | "playlist";
export type SortOrder = "default" | "az" | "duration";
export type AppTheme = "dark" | "light";

export type PlaylistsMap = Record<string, string[]>; // playlistName -> array of video IDs
