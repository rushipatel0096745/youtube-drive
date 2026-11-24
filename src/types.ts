export interface VideoItem {
  id: string;
  source: "drive" | "youtube";
  title: string;
  category: string;
  thumbnail: string;
  duration?: string;      // formatted "5:30"
  durationSec?: number;   // raw seconds for sort
  channel: string;
}

export type SourceFilter = "blended" | "drive" | "youtube" | "favourites";
export type SortOrder = "default" | "az" | "duration";
export type AppTheme = "dark" | "light";
