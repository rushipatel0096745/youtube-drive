import { useCallback, useRef, useState } from "react";
import type { VideoItem, PlaylistsMap } from "../types";

const LOCAL_PLAYLISTS_KEY = "yt_vault_playlists";
const LOCAL_FAVS_KEY = "yt_vault_favorites";
const LOCAL_DETAILS_KEY = "yt_vault_video_details";
const FILE_ID_KEY = "yt_vault_playlists_file_id";
const FOLDER_ID_KEY = "yt_vault_folder_id";

interface DriveStorageSchema {
  favorites: string[];
  playlists: PlaylistsMap;
  videoDetails: Record<string, VideoItem>;
}

function loadLocalPlaylists(): PlaylistsMap {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_PLAYLISTS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function loadLocalFavorites(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_FAVS_KEY) ?? "[]");
    return new Set(Array.isArray(raw) ? raw : []);
  } catch {
    return new Set();
  }
}

function loadLocalVideoDetails(): Record<string, VideoItem> {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_DETAILS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function useDrivePlaylists() {
  const [playlists, setPlaylists] = useState<PlaylistsMap>(loadLocalPlaylists);
  const [favorites, setFavorites] = useState<Set<string>>(loadLocalFavorites);
  const [videoDetails, setVideoDetails] = useState<Record<string, VideoItem>>(loadLocalVideoDetails);
  const [isSyncing, setIsSyncing] = useState(false);

  // Keep live references to prevent closure stale states
  const playlistsRef = useRef<PlaylistsMap>(playlists);
  playlistsRef.current = playlists;

  const favoritesRef = useRef<Set<string>>(favorites);
  favoritesRef.current = favorites;

  const videoDetailsRef = useRef<Record<string, VideoItem>>(videoDetails);
  videoDetailsRef.current = videoDetails;

  const fileIdRef = useRef<string | null>(localStorage.getItem(FILE_ID_KEY));
  const folderIdRef = useRef<string>(localStorage.getItem(FOLDER_ID_KEY) || "");

  const resolvingPromiseRef = useRef<Promise<string | null> | null>(null);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSyncInProgressRef = useRef(false);
  const pendingSyncRef = useRef<boolean>(false);
  const latestTokenRef = useRef<string>("");

  const setFolderId = useCallback((id: string) => {
    if (!id) return;
    folderIdRef.current = id;
    localStorage.setItem(FOLDER_ID_KEY, id);
  }, []);

  // Guarantee single file ID resolution across all drives / folders
  const resolveFileId = useCallback(
    async (token: string): Promise<string | null> => {
      if (fileIdRef.current) return fileIdRef.current;
      if (resolvingPromiseRef.current) return resolvingPromiseRef.current;

      const resolver = async () => {
        try {
          const q = encodeURIComponent("name = 'playlists.json' and trashed = false");
          const searchRes = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,parents)&includeItemsFromAllDrives=true&supportsAllDrives=true`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const searchData = await searchRes.json();
          const files = searchData.files || [];

          if (files.length > 0) {
            const primaryId = files[0].id;
            fileIdRef.current = primaryId;
            localStorage.setItem(FILE_ID_KEY, primaryId);

            if (files.length > 1) {
              for (let i = 1; i < files.length; i++) {
                fetch(`https://www.googleapis.com/drive/v3/files/${files[i].id}`, {
                  method: "DELETE",
                  headers: { Authorization: `Bearer ${token}` },
                }).catch(() => {});
              }
            }
            return primaryId;
          }
        } catch (err) {
          console.error("Error resolving playlists.json file ID:", err);
        } finally {
          resolvingPromiseRef.current = null;
        }
        return null;
      };

      resolvingPromiseRef.current = resolver();
      return resolvingPromiseRef.current;
    },
    []
  );

  // Core execution of Drive write
  const executeSync = useCallback(async () => {
    const token = latestTokenRef.current;
    if (!token) return;

    if (isSyncInProgressRef.current) {
      pendingSyncRef.current = true;
      return;
    }

    isSyncInProgressRef.current = true;
    setIsSyncing(true);

    try {
      const payload: DriveStorageSchema = {
        favorites: Array.from(favoritesRef.current),
        playlists: playlistsRef.current,
        videoDetails: videoDetailsRef.current,
      };
      const content = JSON.stringify(payload, null, 2);

      let currentFileId = await resolveFileId(token);

      if (currentFileId) {
        await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${currentFileId}?uploadType=media`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: content,
          }
        );
      } else {
        const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "playlists.json",
            parents: folderIdRef.current ? [folderIdRef.current] : undefined,
            mimeType: "application/json",
          }),
        });
        const createData = await createRes.json();
        if (createData.id) {
          currentFileId = createData.id;
          fileIdRef.current = createData.id;
          localStorage.setItem(FILE_ID_KEY, createData.id);

          await fetch(
            `https://www.googleapis.com/upload/drive/v3/files/${currentFileId}?uploadType=media`,
            {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: content,
            }
          );
        }
      }
    } catch (err) {
      console.error("Failed to sync playlists to Drive:", err);
    } finally {
      isSyncInProgressRef.current = false;
      setIsSyncing(false);

      if (pendingSyncRef.current) {
        pendingSyncRef.current = false;
        executeSync();
      }
    }
  }, [resolveFileId]);

  // Debounced queue trigger for sync
  const scheduleSync = useCallback(
    (token: string, folderId?: string) => {
      if (token) latestTokenRef.current = token;
      if (folderId) setFolderId(folderId);

      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      syncTimeoutRef.current = setTimeout(() => {
        executeSync();
      }, 300);
    },
    [executeSync, setFolderId]
  );

  // Load from Drive with non-destructive MERGE
  const loadFromDrive = useCallback(
    async (token: string, folderId?: string) => {
      if (!token) return;
      latestTokenRef.current = token;
      if (folderId) setFolderId(folderId);

      try {
        const fileId = await resolveFileId(token);
        if (fileId) {
          const contentRes = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const driveData = await contentRes.json();

          if (driveData && typeof driveData === "object") {
            const drivePlaylists: PlaylistsMap = driveData.playlists || (driveData.favorites ? {} : driveData);
            const driveFavs: string[] = driveData.favorites || [];
            const driveDetails: Record<string, VideoItem> = driveData.videoDetails || {};

            // Merging preserves locally created playlists so they are never wiped
            setPlaylists((prevLocal) => {
              const merged: PlaylistsMap = { ...drivePlaylists };
              for (const [name, ids] of Object.entries(prevLocal)) {
                if (merged[name]) {
                  merged[name] = Array.from(new Set([...merged[name], ...ids]));
                } else {
                  merged[name] = ids;
                }
              }
              localStorage.setItem(LOCAL_PLAYLISTS_KEY, JSON.stringify(merged));
              playlistsRef.current = merged;
              return merged;
            });

            setFavorites((prevFavs) => {
              const merged = new Set([...prevFavs, ...driveFavs]);
              localStorage.setItem(LOCAL_FAVS_KEY, JSON.stringify(Array.from(merged)));
              favoritesRef.current = merged;
              return merged;
            });

            setVideoDetails((prevDetails) => {
              const merged = { ...driveDetails, ...prevDetails };
              localStorage.setItem(LOCAL_DETAILS_KEY, JSON.stringify(merged));
              videoDetailsRef.current = merged;
              return merged;
            });

            // Write back merged state to Drive once
            scheduleSync(token, folderId);
          }
        }
      } catch (err) {
        console.error("Failed to load playlists from Drive:", err);
      }
    },
    [resolveFileId, setFolderId, scheduleSync]
  );

  // Create Playlist (supports optional initial video for atomic addition)
  const createPlaylist = useCallback(
    (name: string, initialVideo?: VideoItem | null, token?: string, folderId?: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      setPlaylists((prev) => {
        const currentIds = prev[trimmed] || [];
        const nextIds = initialVideo && !currentIds.includes(initialVideo.id)
          ? [...currentIds, initialVideo.id]
          : currentIds;

        const nextPlaylists = { ...prev, [trimmed]: nextIds };
        localStorage.setItem(LOCAL_PLAYLISTS_KEY, JSON.stringify(nextPlaylists));
        playlistsRef.current = nextPlaylists;
        return nextPlaylists;
      });

      if (initialVideo) {
        setVideoDetails((prev) => {
          const next = { ...prev, [initialVideo.id]: initialVideo };
          localStorage.setItem(LOCAL_DETAILS_KEY, JSON.stringify(next));
          videoDetailsRef.current = next;
          return next;
        });
      }

      if (token) {
        scheduleSync(token, folderId);
      }
    },
    [scheduleSync]
  );

  // Toggle Video in a named Playlist
  const toggleVideo = useCallback(
    (playlistName: string, video: VideoItem, token: string, folderId?: string) => {
      setPlaylists((prevPlaylists) => {
        const currentList = prevPlaylists[playlistName] || [];
        const exists = currentList.includes(video.id);
        const nextList = exists
          ? currentList.filter((id) => id !== video.id)
          : [...currentList, video.id];

        const nextPlaylists = { ...prevPlaylists, [playlistName]: nextList };
        localStorage.setItem(LOCAL_PLAYLISTS_KEY, JSON.stringify(nextPlaylists));
        playlistsRef.current = nextPlaylists;
        return nextPlaylists;
      });

      setVideoDetails((prevDetails) => {
        const nextDetails = { ...prevDetails, [video.id]: video };
        localStorage.setItem(LOCAL_DETAILS_KEY, JSON.stringify(nextDetails));
        videoDetailsRef.current = nextDetails;
        return nextDetails;
      });

      if (token) {
        scheduleSync(token, folderId);
      }
    },
    [scheduleSync]
  );

  // Toggle Favorite
  const toggleFav = useCallback(
    (video: VideoItem, token: string, folderId?: string) => {
      setFavorites((prevFavs) => {
        const nextFavs = new Set(prevFavs);
        if (nextFavs.has(video.id)) {
          nextFavs.delete(video.id);
        } else {
          nextFavs.add(video.id);
        }

        localStorage.setItem(LOCAL_FAVS_KEY, JSON.stringify(Array.from(nextFavs)));
        favoritesRef.current = nextFavs;
        return nextFavs;
      });

      setVideoDetails((prevDetails) => {
        const nextDetails = { ...prevDetails, [video.id]: video };
        localStorage.setItem(LOCAL_DETAILS_KEY, JSON.stringify(nextDetails));
        videoDetailsRef.current = nextDetails;
        return nextDetails;
      });

      if (token) {
        scheduleSync(token, folderId);
      }
    },
    [scheduleSync]
  );

  const isFav = useCallback((id: string): boolean => favorites.has(id), [favorites]);

  // Delete Playlist
  const deletePlaylist = useCallback(
    (name: string, token: string, folderId?: string) => {
      setPlaylists((prev) => {
        const nextPlaylists = { ...prev };
        delete nextPlaylists[name];
        localStorage.setItem(LOCAL_PLAYLISTS_KEY, JSON.stringify(nextPlaylists));
        playlistsRef.current = nextPlaylists;
        return nextPlaylists;
      });

      if (token) {
        scheduleSync(token, folderId);
      }
    },
    [scheduleSync]
  );

  // Resolver for Playlist Videos
  const getPlaylistVideos = useCallback(
    (playlistName: string, knownPool: VideoItem[]): VideoItem[] => {
      const ids = playlists[playlistName] || [];
      if (ids.length === 0) return [];

      const poolMap = new Map<string, VideoItem>();
      for (const v of knownPool) {
        poolMap.set(v.id, v);
      }

      const result: VideoItem[] = [];
      const seen = new Set<string>();

      for (const id of ids) {
        if (seen.has(id)) continue;
        seen.add(id);

        const found = poolMap.get(id) || videoDetails[id];
        if (found) {
          result.push(found);
        }
      }
      return result;
    },
    [playlists, videoDetails]
  );

  // Resolver for Favorites
  const getFavoriteVideos = useCallback(
    (knownPool: VideoItem[]): VideoItem[] => {
      if (favorites.size === 0) return [];

      const poolMap = new Map<string, VideoItem>();
      for (const v of knownPool) {
        poolMap.set(v.id, v);
      }

      const result: VideoItem[] = [];
      const seen = new Set<string>();

      for (const id of favorites) {
        if (seen.has(id)) continue;
        seen.add(id);

        const found = poolMap.get(id) || videoDetails[id];
        if (found) {
          result.push(found);
        }
      }
      return result;
    },
    [favorites, videoDetails]
  );

  return {
    playlists,
    favorites,
    isSyncing,
    setFolderId,
    loadFromDrive,
    toggleVideo,
    toggleFav,
    isFav,
    createPlaylist,
    deletePlaylist,
    getPlaylistVideos,
    getFavoriteVideos,
  };
}
