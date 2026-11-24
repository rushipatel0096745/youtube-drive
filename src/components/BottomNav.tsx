// React import not needed in React 17+ JSX transform
import { Home, FolderLock, TvMinimalPlay, Heart, ListMusic, User } from "lucide-react";
import type { SourceFilter } from "../types";

interface Props {
  source: SourceFilter;
  setSource: (s: SourceFilter) => void;
  onSearchFocus: () => void;
  onProfile: () => void;
  accentColor: string;
}

export function BottomNav({
  source,
  setSource,
  onProfile,
  accentColor,
}: Omit<Props, "onSearchFocus"> & { onSearchFocus?: () => void }) {
  const tabs = [
    { id: "blended" as const, icon: Home, label: "Home" },
    { id: "drive" as const, icon: FolderLock, label: "Vault" },
    { id: "youtube" as const, icon: TvMinimalPlay, label: "YouTube" },
    { id: "playlist" as const, icon: ListMusic, label: "Playlists" },
    { id: "favourites" as const, icon: Heart, label: "Saved" },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t"
      style={{ backgroundColor: "var(--c-surface)", borderColor: "var(--c-border)" }}
    >
      <div className="flex items-center justify-around px-1 pt-1.5 pb-safe">
        {tabs.map(({ id, icon: Icon, label }) => {
          const active = source === id;
          const isSaved = id === "favourites";
          return (
            <button
              key={id}
              onClick={() => setSource(id)}
              className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-colors min-w-0"
              style={{ color: active ? accentColor : "var(--c-muted)" }}
            >
              <Icon
                className="w-4 h-4 sm:w-5 sm:h-5"
                style={{ fill: active && isSaved ? accentColor : "transparent" }}
              />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}

        <button
          onClick={onProfile}
          className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-colors"
          style={{ color: "var(--c-muted)" }}
        >
          <User className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-[10px] font-medium">Profile</span>
        </button>
      </div>
    </nav>
  );
}
