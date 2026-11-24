import { useCallback, useState } from "react";

const KEY = "yt_favourites";

function load(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]")); }
  catch { return new Set(); }
}

export function useFavourites() {
  const [favs, setFavs] = useState<Set<string>>(load);

  const toggle = useCallback((id: string) => {
    setFavs(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem(KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const isFav = useCallback((id: string): boolean => favs.has(id), [favs]);

  return { toggle, isFav };
}
