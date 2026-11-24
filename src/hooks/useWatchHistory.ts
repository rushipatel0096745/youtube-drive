import { useCallback, useState } from "react";

interface HistoryEntry {
  progress: number;  // 0–1
  duration: number;  // seconds
  watchedAt: number; // ms timestamp
}

type History = Record<string, HistoryEntry>;
const KEY = "yt_watch_history";

function load(): History {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); }
  catch { return {}; }
}

export function useWatchHistory() {
  const [history, setHistory] = useState<History>(load);

  const saveProgress = useCallback((id: string, currentTime: number, duration: number) => {
    if (!duration) return;
    const progress = currentTime / duration;
    setHistory(prev => {
      const next = { ...prev, [id]: { progress, duration, watchedAt: Date.now() } };
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const getProgress = useCallback(
    (id: string): number => history[id]?.progress ?? 0,
    [history]
  );

  const getResumeTime = useCallback(
    (id: string): number => {
      const e = history[id];
      if (!e || e.progress > 0.95) return 0; // restart if nearly finished
      return e.progress * e.duration;
    },
    [history]
  );

  return { saveProgress, getProgress, getResumeTime };
}
