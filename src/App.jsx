
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search, Home, Library, Heart, Play, Pause, SkipBack, SkipForward,
  Volume2, Volume1, VolumeX, Repeat, Repeat1, Shuffle, Plus, ListMusic,
  Loader2, Music2, X, ChevronLeft, ChevronDown, Radio, MoreHorizontal, Check,
  Settings, Trash2, Palette, Clock, Sun, Moon, Monitor, Upload, FolderInput,
  Share2, Copy, ExternalLink, ArrowRight, Sparkles
} from "lucide-react";

/* ============================================================================
   STORAGE + THEME
============================================================================ */
const STORAGE_KEYS = {
  liked: "wavelen_liked_v2",
  playlists: "wavelen_playlists_v2",
  searchHistory: "wavelen_search_history_v2",
  themeMode: "wavelen_theme_mode_v2",
  accent: "wavelen_accent_v2",
  volume: "wavelen_volume_v2",
  localMusic: "wavelen_local_music_v2",
};

const DB_NAME = "wavelen_local_music_db";
const DB_STORE = "tracks";
const DB_VERSION = 1;

const ACCENTS = {
  lime: { name: "Lime", accent: "#C4F135", accent2: "#7B61FF" },
  purple: { name: "Purple", accent: "#B48CFF", accent2: "#FF6B6B" },
  coral: { name: "Coral", accent: "#FF6B6B", accent2: "#3EC6FF" },
  ocean: { name: "Ocean", accent: "#3EC6FF", accent2: "#C4F135" },
  gold: { name: "Gold", accent: "#FF9F43", accent2: "#E356A7" },
  rose: { name: "Rose", accent: "#E356A7", accent2: "#4ED9A8" },
};

const GENRES = [
  { name: "Punjabi", query: "Punjabi hit songs", tint: "#7B61FF", cover: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=800&q=80" },
  { name: "Bollywood", query: "Bollywood hit songs", tint: "#C4F135", cover: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=800&q=80" },
  { name: "Hip Hop", query: "hip hop hit songs", tint: "#FF6B6B", cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=800&q=80" },
  { name: "Romantic", query: "romantic hindi songs", tint: "#3EC6FF", cover: "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&q=80" },
  { name: "Party", query: "party songs Punjabi Bollywood", tint: "#FF9F43", cover: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80" },
  { name: "Lo-fi", query: "lofi chill songs", tint: "#E356A7", cover: "https://images.unsplash.com/photo-1487180144351-b8472da7d491?auto=format&fit=crop&w=800&q=80" },
  { name: "English Pop", query: "english pop hit songs", tint: "#4ED9A8", cover: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80" },
  { name: "Old Classics", query: "old bollywood classic songs", tint: "#B48CFF", cover: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=800&q=80" },
];

const TRENDING_POOL = [
  "Punjabi songs this week",
  "Bollywood new songs this week",
  "trending punjabi music video",
  "new hindi songs this month",
  "Sidhu Moosewala new release",
  "AP Dhillon new song",
  "Arijit Singh new song",
  "Punjabi rap trending",
  "top charts India this week",
  "viral punjabi song",
  "new bollywood music video",
  "trending hindi music video",
];

const TRENDING_REFRESH_MS = 4 * 60 * 1000;
const YT_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const YT_API_KEY = "AIzaSyDRjilmeoNKlF8IJOw57B-2wEH9O7SWYZY";

function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function saveToStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function decodeEntities(str = "") {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function formatTime(sec) {
  if (!sec && sec !== 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function timeAgo(ts) {
  if (!ts) return "";
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function isLocalTrack(track) {
  return track?.sourceType === "local";
}

function isYoutubeTrack(track) {
  return !isLocalTrack(track);
}

function getTrendingQueryForNow() {
  const now = new Date();
  const bucket = now.getHours() + now.getDate() * 24;
  const base = TRENDING_POOL[bucket % TRENDING_POOL.length];
  const monthYear = now.toLocaleString("en-US", { month: "long", year: "numeric" });
  return `${base} ${monthYear}`;
}

function normalizeYoutubeTrack(item) {
  const vid = item?.id?.videoId;
  const sn = item?.snippet || {};
  return {
    id: vid,
    sourceType: "youtube",
    name: decodeEntities((sn.title || "").replace(/\(Official.*?\)|\[Official.*?\]/gi, "").trim()),
    artist_name: decodeEntities(sn.channelTitle || "YouTube"),
    image: sn.thumbnails?.high?.url || sn.thumbnails?.medium?.url || sn.thumbnails?.default?.url || "",
    videoId: vid,
    url: `https://www.youtube.com/watch?v=${vid}`,
    createdAt: Date.now(),
  };
}

async function ytSearch(query, maxResults = 20, order = "relevance") {
  const url = `${YT_SEARCH_URL}?part=snippet&type=video&videoCategoryId=10&maxResults=${maxResults}&q=${encodeURIComponent(query)}&order=${order}&key=${YT_API_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) return { error: data.error.message, results: [] };
    return { error: null, results: (data.items || []).map(normalizeYoutubeTrack).filter(t => t.id) };
  } catch {
    return { error: "Network error", results: [] };
  }
}

/* ============================================================================
   IndexedDB helpers for local music
============================================================================ */
function openLocalDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function getAllLocalRecords() {
  const db = await openLocalDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const store = tx.objectStore(DB_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}
async function putLocalRecords(records) {
  const db = await openLocalDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    const store = tx.objectStore(DB_STORE);
    for (const record of records) store.put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
async function deleteLocalRecord(id) {
  const db = await openLocalDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/* ============================================================================
   MAIN APP
============================================================================ */
export default function App() {
  const [view, setView] = useState("home");
  const [viewHistory, setViewHistory] = useState(["home"]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [activeGenre, setActiveGenre] = useState(null);
  const [showSearchHistory, setShowSearchHistory] = useState(false);

  const [popular, setPopular] = useState([]);
  const [loadingPopular, setLoadingPopular] = useState(true);
  const [popularError, setPopularError] = useState(null);
  const [trendingUpdatedAt, setTrendingUpdatedAt] = useState(null);
  const [refreshingTrending, setRefreshingTrending] = useState(false);
  const [genrePreviewMap, setGenrePreviewMap] = useState({});

  const [playlists, setPlaylists] = useState(() => loadFromStorage(STORAGE_KEYS.playlists, []));
  const [activePlaylist, setActivePlaylist] = useState(null);
  const [likedTracks, setLikedTracks] = useState(() => loadFromStorage(STORAGE_KEYS.liked, []));
  const [searchHistory, setSearchHistory] = useState(() => loadFromStorage(STORAGE_KEYS.searchHistory, []));
  const [themeMode, setThemeMode] = useState(() => loadFromStorage(STORAGE_KEYS.themeMode, "system"));
  const [accentKey, setAccentKey] = useState(() => loadFromStorage(STORAGE_KEYS.accent, "lime"));
  const [showSettings, setShowSettings] = useState(false);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(null);
  const [trackMenu, setTrackMenu] = useState(null);
  const [showLikedModal, setShowLikedModal] = useState(false);

  const [localLibrary, setLocalLibrary] = useState(() => loadFromStorage(STORAGE_KEYS.localMusic, []));
  const [localLoading, setLocalLoading] = useState(true);
  const [localImporting, setLocalImporting] = useState(false);

  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => loadFromStorage(STORAGE_KEYS.volume, 72));
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState("off");
  const [playerReady, setPlayerReady] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [expandedPlayer, setExpandedPlayer] = useState(false);
  const [showQueue, setShowQueue] = useState(false);

  const ytPlayerRef = useRef(null);
  const audioRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const searchBoxRef = useRef(null);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const localUrlMapRef = useRef(new Map());
  const currentTrack = queue[currentIndex] || null;

  const accent = ACCENTS[accentKey] || ACCENTS.lime;

  /* -------------------------- theme application -------------------------- */
  const resolvedTheme = useMemo(() => {
    if (themeMode === "light" || themeMode === "dark") return themeMode;
    if (typeof window === "undefined") return "dark";
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
  }, [themeMode]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.style.setProperty("--accent", accent.accent);
    root.style.setProperty("--accent-2", accent.accent2);
    root.style.setProperty("--accent-rgb", hexToRgb(accent.accent));
    document.body.style.background = "var(--bg)";
  }, [resolvedTheme, accent]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.themeMode, themeMode);
  }, [themeMode]);
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.accent, accentKey);
  }, [accentKey]);
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.volume, volume);
  }, [volume]);
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.playlists, playlists.filter(p => !p.system));
  }, [playlists]);
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.liked, likedTracks);
  }, [likedTracks]);
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.searchHistory, searchHistory);
  }, [searchHistory]);
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.localMusic, localLibrary.map(({ blob, ...meta }) => meta));
  }, [localLibrary]);

  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
    const num = parseInt(full, 16);
    return `${(num >> 16) & 255} ${(num >> 8) & 255} ${num & 255}`;
  }

  /* -------------------------- YT iframe loader -------------------------- */
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      initPlayer();
      return;
    }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);
    window.onYouTubeIframeAPIReady = initPlayer;

    function initPlayer() {
      ytPlayerRef.current = new window.YT.Player("yt-player-hidden", {
        height: "0",
        width: "0",
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
        },
        events: {
          onReady: () => setPlayerReady(true),
          onStateChange: (e) => onStateRef.current(e),
        },
      });
    }

    return () => {
      try { window.onYouTubeIframeAPIReady = null; } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPlayerStateChange = useCallback((e) => {
    if (e.data === 0) handleTrackEndRef.current?.();
    if (e.data === 1) { setIsPlaying(true); setBuffering(false); }
    if (e.data === 2) setIsPlaying(false);
    if (e.data === 3) setBuffering(true);
  }, []);
  const onStateRef = useRef(onPlayerStateChange);
  useEffect(() => { onStateRef.current = onPlayerStateChange; }, [onPlayerStateChange]);

  /* ---------------------------- local library ---------------------------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const records = await getAllLocalRecords();
        if (cancelled) return;
        const mapped = records.map((rec) => ({
          ...rec,
          sourceType: "local",
          name: rec.name || rec.fileName?.replace(/\.[^.]+$/, "") || "Local audio",
          artist_name: rec.artist_name || "On this device",
          image: rec.image || "",
        }));
        setLocalLibrary(mapped);
        setLocalLoading(false);
      } catch {
        setLocalLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      for (const url of localUrlMapRef.current.values()) URL.revokeObjectURL(url);
      localUrlMapRef.current.clear();
    };
  }, []);

  function getLocalObjectUrl(track) {
    if (!track) return "";
    const key = track.id;
    if (localUrlMapRef.current.has(key)) return localUrlMapRef.current.get(key);
    if (!track.blob) return "";
    const url = URL.createObjectURL(track.blob);
    localUrlMapRef.current.set(key, url);
    return url;
  }

  /* ---------------------------- initial fetch ---------------------------- */
  const refreshTrending = useCallback(async (background = false) => {
    if (background) setRefreshingTrending(true);
    else setLoadingPopular(true);

    const liveQuery = getTrendingQueryForNow();
    const { error, results } = await ytSearch(liveQuery, 14, "date");
    if (error) {
      setPopularError(error);
      setPopular([]);
    } else {
      setPopular(results);
      setPopularError(null);
      setTrendingUpdatedAt(Date.now());
    }
    setLoadingPopular(false);
    setRefreshingTrending(false);
  }, []);

  useEffect(() => {
    refreshTrending(false);

    const interval = setInterval(() => refreshTrending(true), TRENDING_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshTrending(true);
    };
    document.addEventListener("visibilitychange", onVisible);

    Promise.all([
      ytSearch("Sidhu Moosewala all songs", 8),
      ytSearch("Arijit Singh romantic songs", 8),
      ytSearch("Punjabi party songs", 8),
    ]).then(([a, b, c]) => {
      const sys = [
        { id: "sys-sidhu", name: "Sidhu Moosewala Mix", image: a.results[0]?.image, tracks: a.results, system: true },
        { id: "sys-arijit", name: "Arijit Singh Romantic", image: b.results[0]?.image, tracks: b.results, system: true },
        { id: "sys-party", name: "Punjabi Party", image: c.results[0]?.image, tracks: c.results, system: true },
      ].filter(pl => pl.tracks.length);
      setPlaylists(prev => [...sys, ...prev.filter(p => !p.system)]);
    });

    // genre previews
    Promise.all(GENRES.map(async (g) => {
      const r = await ytSearch(g.query, 1);
      return [g.name, r.results[0]?.image || g.cover];
    })).then((pairs) => {
      const map = {};
      for (const [name, img] of pairs) map[name] = img;
      setGenrePreviewMap(map);
    });

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshTrending]);

  /* -------------------------- search + history --------------------------- */
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      setSearchError(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const { error, results } = await ytSearch(query.trim(), 20, "relevance");
      setSearchError(error);
      setSearchResults(results);
      setSearching(false);
      if (!error && results.length) {
        setSearchHistory(prev => {
          const cleaned = prev.filter(q => q.toLowerCase() !== query.trim().toLowerCase());
          return [query.trim(), ...cleaned].slice(0, 12);
        });
      }
    }, 380);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const hide = (e) => {
      if (!searchBoxRef.current?.contains(e.target)) setShowSearchHistory(false);
    };
    document.addEventListener("mousedown", hide);
    document.addEventListener("touchstart", hide);
    return () => {
      document.removeEventListener("mousedown", hide);
      document.removeEventListener("touchstart", hide);
    };
  }, []);

  /* -------------------------- playback bindings -------------------------- */
  const handleTrackEnd = useCallback(() => {
    if (!queue.length) return;
    if (repeat === "one") {
      if (isLocalTrack(currentTrack)) {
        const el = audioRef.current;
        if (el) {
          el.currentTime = 0;
          el.play().catch(() => {});
        }
      } else {
        ytPlayerRef.current?.seekTo(0, true);
        ytPlayerRef.current?.playVideo();
      }
      return;
    }

    if (repeat === "off" && !shuffle && currentIndex === queue.length - 1) {
      setIsPlaying(false);
      return;
    }
    handleNext();
  }, [queue, repeat, shuffle, currentIndex]); // handleNext declared below but stable via ref
  const handleTrackEndRef = useRef(handleTrackEnd);
  useEffect(() => { handleTrackEndRef.current = handleTrackEnd; }, [handleTrackEnd]);

  const applyPlaybackToCurrent = useCallback(async () => {
    if (!currentTrack) return;

    setBuffering(true);
    setProgress(0);
    setDuration(0);

    if (isLocalTrack(currentTrack)) {
      const el = audioRef.current;
      if (!el) return;
      const url = getLocalObjectUrl(currentTrack);
      if (!url) return;
      if (el.src !== url) el.src = url;
      el.volume = volume / 100;
      try {
        if (isPlaying) await el.play();
        else el.pause();
      } catch {}
      return;
    }

    if (!ytPlayerRef.current) return;
    try {
      ytPlayerRef.current.loadVideoById(currentTrack.videoId || currentTrack.id);
      ytPlayerRef.current.setVolume(volume);
      if (isPlaying) {
        setTimeout(() => {
          try { ytPlayerRef.current?.playVideo(); } catch {}
        }, 50);
      }
    } catch {}
  }, [currentTrack, volume, isPlaying]);

  useEffect(() => {
    applyPlaybackToCurrent();
  }, [applyPlaybackToCurrent]);

  useEffect(() => {
    if (isLocalTrack(currentTrack) && audioRef.current) {
      audioRef.current.volume = volume / 100;
    } else if (ytPlayerRef.current?.setVolume) {
      try { ytPlayerRef.current.setVolume(volume); } catch {}
    }
  }, [volume, currentTrack]);

  useEffect(() => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = setInterval(() => {
      try {
        if (isLocalTrack(currentTrack) && audioRef.current) {
          setProgress(audioRef.current.currentTime || 0);
          setDuration(audioRef.current.duration || 0);
        } else if (ytPlayerRef.current && isPlaying && ytPlayerRef.current.getCurrentTime) {
          setProgress(ytPlayerRef.current.getCurrentTime() || 0);
          setDuration(ytPlayerRef.current.getDuration() || 0);
        }
      } catch {}
    }, 400);
    return () => clearInterval(progressIntervalRef.current);
  }, [currentTrack, isPlaying]);

  /* ------------------------------ actions -------------------------------- */
  const navigateTo = useCallback((nextView) => {
    setView(prev => {
      if (prev === nextView) return prev;
      setViewHistory(h => [...h, nextView]);
      return nextView;
    });
    setShowSearchHistory(false);
  }, []);

  const goBack = useCallback(() => {
    setShowSearchHistory(false);
    setViewHistory(h => {
      if (h.length <= 1) return h;
      const next = h.slice(0, -1);
      setView(next[next.length - 1]);
      return next;
    });
  }, []);

  const canGoBack = viewHistory.length > 1;

  const openGenre = useCallback((genre) => {
    setActiveGenre(genre);
    setSearching(true);
    setQuery(genre.query);
    navigateTo("genre");
    ytSearch(genre.query, 18, "relevance").then(({ error, results }) => {
      setSearchError(error);
      setSearchResults(results);
      setSearching(false);
    });
  }, [navigateTo]);

  const playTrackList = useCallback((list, index) => {
    setQueue(list);
    setCurrentIndex(index);
    setIsPlaying(true);
  }, []);

  const handleNext = useCallback(() => {
    if (!queue.length) return;
    const next = shuffle ? Math.floor(Math.random() * queue.length) : (currentIndex + 1) % queue.length;
    setCurrentIndex(next);
    setIsPlaying(true);
  }, [queue, currentIndex, shuffle]);

  const handlePrev = useCallback(() => {
    if (!queue.length) return;
    if (progress > 3) {
      if (isLocalTrack(currentTrack)) {
        if (audioRef.current) audioRef.current.currentTime = 0;
      } else {
        ytPlayerRef.current?.seekTo(0, true);
      }
      setProgress(0);
      return;
    }
    const prev = (currentIndex - 1 + queue.length) % queue.length;
    setCurrentIndex(prev);
    setIsPlaying(true);
  }, [queue, currentIndex, progress, currentTrack]);

  const togglePlay = useCallback(() => {
    if (!currentTrack) return;
    if (isLocalTrack(currentTrack)) {
      const el = audioRef.current;
      if (!el) return;
      if (isPlaying) el.pause();
      else el.play().catch(() => {});
      return;
    }
    if (!ytPlayerRef.current) return;
    try {
      if (isPlaying) ytPlayerRef.current.pauseVideo();
      else ytPlayerRef.current.playVideo();
    } catch {}
  }, [currentTrack, isPlaying]);

  const seek = useCallback((e) => {
    if (!duration || !currentTrack) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const target = pct * duration;
    if (isLocalTrack(currentTrack) && audioRef.current) {
      audioRef.current.currentTime = target;
      setProgress(target);
    } else {
      ytPlayerRef.current?.seekTo(target, true);
      setProgress(target);
    }
  }, [duration, currentTrack]);

  const cycleRepeat = useCallback(() => {
    setRepeat(r => (r === "off" ? "all" : r === "all" ? "one" : "off"));
  }, []);

  const toggleLike = useCallback((track) => {
    if (!track) return;
    setLikedTracks(prev => {
      const exists = prev.some(t => t.id === track.id);
      return exists ? prev.filter(t => t.id !== track.id) : [{ ...track }, ...prev];
    });
  }, []);

  const isLiked = useCallback((track) => likedTracks.some(t => t.id === track?.id), [likedTracks]);

  const createPlaylist = useCallback((name) => {
    setPlaylists(prev => [{ id: uid("pl"), name, image: null, tracks: [], system: false }, ...prev]);
    setShowCreatePlaylist(false);
  }, []);

  const addToPlaylist = useCallback((playlistId, track) => {
    setPlaylists(prev => prev.map(pl => {
      if (pl.id !== playlistId) return pl;
      if (pl.tracks.some(t => t.id === track.id)) return pl;
      const tracks = [...pl.tracks, track];
      return { ...pl, tracks, image: pl.image || track.image || null };
    }));
    setShowAddToPlaylist(null);
  }, []);

  const removeFromPlaylist = useCallback((playlistId, trackId) => {
    setPlaylists(prev => prev.map(pl => {
      if (pl.id !== playlistId) return pl;
      const tracks = pl.tracks.filter(t => t.id !== trackId);
      return { ...pl, tracks, image: tracks[0]?.image || null };
    }));
  }, []);

  const deletePlaylist = useCallback((playlistId) => {
    setPlaylists(prev => prev.filter(pl => pl.id !== playlistId));
  }, []);

  const removeFromLocalLibrary = useCallback(async (trackId) => {
    setLocalLibrary(prev => prev.filter(t => t.id !== trackId));
    try { await deleteLocalRecord(trackId); } catch {}
    const url = localUrlMapRef.current.get(trackId);
    if (url) {
      URL.revokeObjectURL(url);
      localUrlMapRef.current.delete(trackId);
    }
    setTrackMenu(null);
  }, []);

  const addToQueue = useCallback((track) => {
    if (!track) return;
    setQueue(prev => prev.some(t => t.id === track.id) ? prev : [...prev, track]);
  }, []);

  const playNext = useCallback((track) => {
    if (!track) return;
    setQueue(prev => {
      const without = prev.filter(t => t.id !== track.id);
      const next = [...without];
      next.splice(Math.min(currentIndex + 1, next.length), 0, track);
      return next;
    });
  }, [currentIndex]);

  const copyTrackInfo = useCallback(async (track) => {
    if (!track) return;
    const text = `${track.name} — ${track.artist_name}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
    setTrackMenu(null);
  }, []);

  const shareTrack = useCallback(async (track) => {
    if (!track) return;
    const text = `${track.name} — ${track.artist_name}`;
    const url = isLocalTrack(track) ? "" : track.url || `https://www.youtube.com/watch?v=${track.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: track.name, text, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url ? `${text}\n${url}` : text);
      }
    } catch {}
    setTrackMenu(null);
  }, []);

  const openInPlaylist = useCallback((playlist) => {
    setActivePlaylist(playlist);
    navigateTo("playlist");
  }, [navigateTo]);

  const openAddToPlaylist = useCallback((track) => {
    setShowAddToPlaylist(track);
    setTrackMenu(null);
  }, []);

  const importLocalFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList || []).filter(f => f.type.startsWith("audio/"));
    if (!files.length) return;
    setLocalImporting(true);
    try {
      const records = files.map((file) => ({
        id: uid("local"),
        sourceType: "local",
        name: file.name.replace(/\.[^.]+$/, ""),
        artist_name: "On this device",
        fileName: file.name,
        mimeType: file.type,
        addedAt: Date.now(),
        blob: file,
        image: "",
      }));
      await putLocalRecords(records);
      setLocalLibrary(prev => [...records, ...prev]);
      setShowSettings(true);
    } catch {
      // no-op
    } finally {
      setLocalImporting(false);
    }
  }, []);

  const scanFolder = useCallback(() => {
    if (folderInputRef.current) folderInputRef.current.click();
  }, []);
  const importFiles = useCallback(() => {
    if (fileInputRef.current) fileInputRef.current.click();
  }, []);

  const localTracksForLibrary = useMemo(() => localLibrary.map(t => ({
    ...t,
    image: t.image || "",
    sourceType: "local",
  })), [localLibrary]);

  const systemLikedCount = likedTracks.length;

  /* ------------------------------ playback end hooks ------------------------------ */
  useEffect(() => {
    if (isLocalTrack(currentTrack) && audioRef.current) {
      const el = audioRef.current;
      const onPlay = () => { setIsPlaying(true); setBuffering(false); };
      const onPause = () => setIsPlaying(false);
      const onWaiting = () => setBuffering(true);
      const onLoaded = () => {
        setDuration(el.duration || 0);
        setBuffering(false);
      };
      const onTime = () => {
        setProgress(el.currentTime || 0);
        setDuration(el.duration || 0);
      };
      const onEnded = () => handleTrackEndRef.current?.();
      el.addEventListener("play", onPlay);
      el.addEventListener("pause", onPause);
      el.addEventListener("waiting", onWaiting);
      el.addEventListener("loadedmetadata", onLoaded);
      el.addEventListener("timeupdate", onTime);
      el.addEventListener("ended", onEnded);
      return () => {
        el.removeEventListener("play", onPlay);
        el.removeEventListener("pause", onPause);
        el.removeEventListener("waiting", onWaiting);
        el.removeEventListener("loadedmetadata", onLoaded);
        el.removeEventListener("timeupdate", onTime);
        el.removeEventListener("ended", onEnded);
      };
    }
  }, [currentTrack]);

  /* ============================================================================
     RENDER
  ============================================================================ */
  return (
    <div className="app-shell">
      <style>{STYLES}</style>
      <div id="yt-player-hidden" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} />
      <audio ref={audioRef} preload="metadata" style={{ display: "none" }} />

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => { importLocalFiles(e.target.files); e.target.value = ""; }}
      />
      <input
        ref={folderInputRef}
        type="file"
        accept="audio/*"
        multiple
        webkitdirectory=""
        directory=""
        style={{ display: "none" }}
        onChange={(e) => { importLocalFiles(e.target.files); e.target.value = ""; }}
      />

      <div className="ambient-glow" />
      <div className="layout">
        <Sidebar
          view={view}
          navigateTo={navigateTo}
          playlists={playlists}
          activePlaylist={activePlaylist}
          setActivePlaylist={setActivePlaylist}
          likedCount={systemLikedCount}
          onCreatePlaylist={() => setShowCreatePlaylist(true)}
          onOpenSettings={() => setShowSettings(true)}
          localCount={localTracksForLibrary.length}
        />

        <main className="main-pane">
          <TopBar
            query={query}
            setQuery={setQuery}
            searchBoxRef={searchBoxRef}
            goBack={goBack}
            canGoBack={canGoBack}
            onOpenSettings={() => setShowSettings(true)}
            showSearchHistory={showSearchHistory}
            setShowSearchHistory={setShowSearchHistory}
            searchHistory={searchHistory}
            onSelectHistory={(q) => { setQuery(q); navigateTo("search"); setShowSearchHistory(false); }}
            onClearQuery={() => setQuery("")}
          />

          <div className="content-scroll">
            {view === "home" && (
              <HomeView
                popular={popular}
                loading={loadingPopular}
                error={popularError}
                playlists={playlists}
                onPlay={playTrackList}
                onOpenPlaylist={openInPlaylist}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                toggleLike={toggleLike}
                isLiked={isLiked}
                onOpenMenu={(payload) => setTrackMenu(payload)}
                trendingUpdatedAt={trendingUpdatedAt}
                refreshingTrending={refreshingTrending}
                onRefreshTrending={() => refreshTrending(true)}
                genrePreviewMap={genrePreviewMap}
                genres={GENRES}
                onOpenGenre={openGenre}
                localTracks={localTracksForLibrary}
              />
            )}

            {view === "search" && (
              <SearchView
                query={query}
                results={searchResults}
                searching={searching}
                error={searchError}
                onPlay={playTrackList}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                toggleLike={toggleLike}
                isLiked={isLiked}
                onOpenGenre={openGenre}
                onOpenMenu={(payload) => setTrackMenu(payload)}
                genrePreviewMap={genrePreviewMap}
                genres={GENRES}
                localTracks={localTracksForLibrary}
              />
            )}

            {view === "genre" && (
              <GenreResultsView
                genre={activeGenre}
                results={searchResults}
                searching={searching}
                error={searchError}
                onPlay={playTrackList}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                toggleLike={toggleLike}
                isLiked={isLiked}
                onOpenMenu={(payload) => setTrackMenu(payload)}
              />
            )}

            {view === "library" && (
              <LibraryView
                liked={likedTracks}
                playlists={playlists}
                localTracks={localTracksForLibrary}
                onPlay={playTrackList}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                toggleLike={toggleLike}
                isLiked={isLiked}
                onOpenPlaylist={openInPlaylist}
                onOpenMenu={(payload) => setTrackMenu(payload)}
                onCreatePlaylist={() => setShowCreatePlaylist(true)}
                onOpenLiked={() => setShowLikedModal(true)}
              />
            )}

            {view === "playlist" && activePlaylist && (
              <PlaylistView
                playlist={playlists.find(p => p.id === activePlaylist.id) || activePlaylist}
                onBack={goBack}
                onPlay={playTrackList}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                toggleLike={toggleLike}
                isLiked={isLiked}
                onOpenMenu={(payload) => setTrackMenu(payload)}
                onRemoveFromPlaylist={removeFromPlaylist}
                onDeletePlaylist={(id) => { deletePlaylist(id); goBack(); }}
                onTrackMenu={(payload) => setTrackMenu(payload)}
              />
            )}
          </div>
        </main>
      </div>

      <MiniPlayer
        track={currentTrack}
        isPlaying={isPlaying}
        togglePlay={togglePlay}
        onNext={handleNext}
        onPrev={handlePrev}
        progress={progress}
        duration={duration}
        seek={seek}
        volume={volume}
        setVolume={setVolume}
        shuffle={shuffle}
        setShuffle={setShuffle}
        repeat={repeat}
        cycleRepeat={cycleRepeat}
        toggleLike={toggleLike}
        isLiked={isLiked}
        buffering={buffering}
        accent={accent}
        onExpand={() => currentTrack && setExpandedPlayer(true)}
        onQueue={() => setShowQueue(true)}
        onTrackMenu={(payload) => setTrackMenu(payload)}
      />

      <BottomNav view={view} navigateTo={navigateTo} hasTrack={!!currentTrack} />

      {expandedPlayer && currentTrack && (
        <FullPlayerSheet
          track={currentTrack}
          isPlaying={isPlaying}
          togglePlay={togglePlay}
          onNext={handleNext}
          onPrev={handlePrev}
          progress={progress}
          duration={duration}
          seek={seek}
          volume={volume}
          setVolume={setVolume}
          shuffle={shuffle}
          setShuffle={setShuffle}
          repeat={repeat}
          cycleRepeat={cycleRepeat}
          toggleLike={toggleLike}
          isLiked={isLiked}
          buffering={buffering}
          accent={accent}
          onClose={() => setExpandedPlayer(false)}
          onShowQueue={() => setShowQueue(true)}
          onAddToPlaylist={() => setShowAddToPlaylist(currentTrack)}
        />
      )}

      {showQueue && (
        <QueueSheet
          queue={queue}
          currentIndex={currentIndex}
          onPlayFromQueue={(i) => { setCurrentIndex(i); setIsPlaying(true); }}
          onClose={() => setShowQueue(false)}
        />
      )}

      {showCreatePlaylist && (
        <CreatePlaylistModal onCreate={createPlaylist} onClose={() => setShowCreatePlaylist(false)} />
      )}

      {showAddToPlaylist && (
        <AddToPlaylistModal
          track={showAddToPlaylist}
          playlists={playlists.filter(p => !p.system)}
          onAdd={addToPlaylist}
          onClose={() => setShowAddToPlaylist(null)}
          onCreateNew={() => { setShowAddToPlaylist(null); setShowCreatePlaylist(true); }}
        />
      )}

      {trackMenu && (
        <TrackMenuSheet
          payload={trackMenu}
          isLiked={isLiked(trackMenu.track)}
          onClose={() => setTrackMenu(null)}
          onPlayNow={() => {
            if (trackMenu.list) {
              playTrackList(trackMenu.list, trackMenu.index);
            } else {
              setQueue([trackMenu.track]);
              setCurrentIndex(0);
              setIsPlaying(true);
            }
            setTrackMenu(null);
          }}
          onPlayNext={() => { playNext(trackMenu.track); setTrackMenu(null); }}
          onAddToQueue={() => { addToQueue(trackMenu.track); setTrackMenu(null); }}
          onToggleLike={() => { toggleLike(trackMenu.track); setTrackMenu(null); }}
          onAddToPlaylist={() => openAddToPlaylist(trackMenu.track)}
          onShare={() => shareTrack(trackMenu.track)}
          onCopy={() => copyTrackInfo(trackMenu.track)}
          onRemoveFromPlaylist={() => {
            if (trackMenu.playlistId) removeFromPlaylist(trackMenu.playlistId, trackMenu.track.id);
            setTrackMenu(null);
          }}
          onRemoveLocal={() => removeFromLocalLibrary(trackMenu.track.id)}
        />
      )}

      {showSettings && (
        <SettingsModal
          themeMode={themeMode}
          setThemeMode={setThemeMode}
          accentKey={accentKey}
          setAccentKey={setAccentKey}
          searchHistory={searchHistory}
          onClearHistory={() => setSearchHistory([])}
          likedTracks={likedTracks}
          onOpenLiked={() => { setShowSettings(false); setView("library"); setShowLikedModal(true); }}
          localTracks={localTracksForLibrary}
          onImportFiles={importFiles}
          onScanFolder={scanFolder}
          localImporting={localImporting}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showLikedModal && (
        <LikedSongsSheet
          liked={likedTracks}
          onClose={() => setShowLikedModal(false)}
          onPlay={playTrackList}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          toggleLike={toggleLike}
          isLiked={isLiked}
          onOpenMenu={(payload) => setTrackMenu(payload)}
        />
      )}
    </div>
  );
}

/* ============================================================================
   SHELL / NAV
============================================================================ */
function Sidebar({ view, navigateTo, playlists, activePlaylist, setActivePlaylist, likedCount, onCreatePlaylist, onOpenSettings, localCount }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><Sparkles size={19} /></div>
        <div>
          <div className="brand-title">Wavelen</div>
          <div className="brand-sub">Modern music hub</div>
        </div>
      </div>

      <nav className="nav-group">
        <button className={`nav-item ${view === "home" ? "active" : ""}`} onClick={() => navigateTo("home")}><Home size={19} /><span>Home</span></button>
        <button className={`nav-item ${view === "search" ? "active" : ""}`} onClick={() => navigateTo("search")}><Search size={19} /><span>Search</span></button>
        <button className={`nav-item ${view === "library" ? "active" : ""}`} onClick={() => navigateTo("library")}><Library size={19} /><span>Your Library</span></button>
      </nav>

      <div className="sidebar-divider" />

      <div className="playlist-block">
        <button className="nav-item" onClick={onCreatePlaylist}>
          <div className="mini-icon"><Plus size={15} /></div><span>Create Playlist</span>
        </button>
        <button className={`nav-item ${view === "library" ? "active" : ""}`} onClick={() => navigateTo("library")}>
          <div className="mini-icon liked"><Heart size={13} fill="currentColor" /></div><span>Liked Songs</span>
          {likedCount > 0 && <span className="count-pill">{likedCount}</span>}
        </button>
        <button className={`nav-item ${view === "library" ? "active" : ""}`} onClick={() => navigateTo("library")}>
          <div className="mini-icon"><Music2 size={14} /></div><span>Local Music</span>
          {localCount > 0 && <span className="count-pill">{localCount}</span>}
        </button>
      </div>

      <div className="sidebar-divider" />

      <div className="playlist-list">
        {playlists.map(pl => (
          <button
            key={pl.id}
            className={`playlist-row ${activePlaylist?.id === pl.id && view === "playlist" ? "active" : ""}`}
            onClick={() => { setActivePlaylist(pl); navigateTo("playlist"); }}
          >
            {pl.image ? <img src={pl.image} alt="" /> : <div className="playlist-row-placeholder"><Music2 size={16} /></div>}
            <div className="playlist-row-text">
              <span className="pl-name">{pl.name}</span>
              <span className="pl-sub">Playlist · {pl.tracks.length} songs</span>
            </div>
          </button>
        ))}
      </div>

      <div className="sidebar-divider" />
      <button className="nav-item" onClick={onOpenSettings}><Settings size={19} /><span>Settings</span></button>
    </aside>
  );
}

function BottomNav({ view, navigateTo, hasTrack }) {
  const items = [
    { key: "home", label: "Home", icon: Home },
    { key: "search", label: "Search", icon: Search },
    { key: "library", label: "Library", icon: Library },
  ];
  return (
    <nav className={`bottom-nav ${hasTrack ? "with-player" : ""}`}>
      {items.map(({ key, label, icon: Icon }) => (
        <button key={key} className={`bottom-nav-item ${view === key ? "active" : ""}`} onClick={() => navigateTo(key)}>
          <Icon size={22} fill={view === key ? "currentColor" : "none"} strokeWidth={view === key ? 0 : 2} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function TopBar({ query, setQuery, searchBoxRef, goBack, canGoBack, onOpenSettings, showSearchHistory, setShowSearchHistory, searchHistory, onSelectHistory, onClearQuery }) {
  return (
    <div className="topbar">
      <div className="topbar-nav">
        <button className="round-btn" onClick={goBack} disabled={!canGoBack}><ChevronLeft size={18} /></button>
      </div>

      <div className="search-wrap" ref={searchBoxRef}>
        <div className="search-box">
          <Search size={17} className="search-icon" />
          <input
            placeholder="What do you want to play?"
            value={query}
            onFocus={() => setShowSearchHistory(true)}
            onChange={(e) => { setQuery(e.target.value); setShowSearchHistory(true); }}
          />
          {query ? <button className="clear-btn" onClick={onClearQuery}><X size={15} /></button> : null}
        </div>

        {showSearchHistory && searchHistory.length > 0 && (
          <div className="search-history-popover">
            <div className="popover-title">
              <Clock size={14} /> Recent searches
            </div>
            {searchHistory.slice(0, 8).map((item) => (
              <button key={item} className="history-item" onClick={() => onSelectHistory(item)}>
                <Search size={14} /> <span>{item}</span>
                <ArrowRight size={14} />
              </button>
            ))}
          </div>
        )}
      </div>

      <button className="settings-btn mobile-only" onClick={onOpenSettings} aria-label="Settings">
        <Settings size={18} />
      </button>
    </div>
  );
}

/* ============================================================================
   CONTENT COMPONENTS
============================================================================ */
function TrackRow({ track, index, list, onPlay, isActive, isPlaying, toggleLike, isLiked, onOpenMenu }) {
  return (
    <div className={`track-row ${isActive ? "active" : ""}`} onClick={() => onPlay(list, index)}>
      <div className="track-row-index">
        {isActive && isPlaying ? (
          <div className="playing-bars"><span /><span /><span /></div>
        ) : isActive ? <Pause size={14} /> : (<><span className="idx-number">{index + 1}</span><Play size={14} className="idx-play" /></>)}
      </div>

      <TrackThumb track={track} small />
      <div className="track-row-meta">
        <span className="track-row-title">{track.name}</span>
        <span className="track-row-artist">{track.artist_name}</span>
      </div>

      <button className={`heart-btn ${isLiked(track) ? "liked" : ""}`} onClick={(e) => { e.stopPropagation(); toggleLike(track); }}>
        <Heart size={16} fill={isLiked(track) ? "currentColor" : "none"} />
      </button>
      <button className="more-btn" onClick={(e) => { e.stopPropagation(); onOpenMenu(track, { list, index }); }}>
        <MoreHorizontal size={17} />
      </button>
    </div>
  );
}

function TrackThumb({ track, small = false }) {
  if (track?.image) {
    return <img src={track.image} alt="" className={small ? "track-row-art" : "cover-art"} />;
  }
  return (
    <div className={small ? "track-row-art placeholder" : "cover-art placeholder"}>
      <Music2 size={small ? 18 : 28} />
    </div>
  );
}

function HomeView({ popular, loading, error, playlists, onPlay, onOpenPlaylist, currentTrack, isPlaying, toggleLike, isLiked, onOpenMenu, trendingUpdatedAt, refreshingTrending, onRefreshTrending, genrePreviewMap, genres, onOpenGenre, localTracks }) {
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  useTicker(15000);

  return (
    <div className="view-pad">
      <div className="hero">
        <div>
          <div className="eyebrow">Your vibe, your mix</div>
          <h1 className="page-title">{greeting}</h1>
        </div>
        <div className="hero-chip">Live music discovery</div>
      </div>

      {currentTrack && (
        <button className="resume-card" onClick={() => onPlay([currentTrack], 0)}>
          <div className="resume-copy">
            <span className="resume-label">Continue listening</span>
            <span className="resume-title">{currentTrack.name}</span>
            <span className="resume-sub">{currentTrack.artist_name}</span>
          </div>
          <div className="resume-action"><Play size={18} fill="#0B0E10" /></div>
        </button>
      )}

      {playlists.length > 0 && (
        <>
          <SectionHeader title="Quick picks" />
          <div className="quick-grid">
            {playlists.slice(0, 6).map(pl => (
              <button key={pl.id} className="quick-card" onClick={() => onOpenPlaylist(pl)}>
                {pl.image ? <img src={pl.image} alt="" /> : <div className="quick-card-placeholder"><Music2 size={18} /></div>}
                <span>{pl.name}</span>
                <div className="quick-play"><Play size={16} fill="#000" /></div>
              </button>
            ))}
          </div>
        </>
      )}

      <SectionHeader
        title="Trending now"
        right={(
          <div className="section-meta">
            {trendingUpdatedAt && <span className="trending-updated">Updated {timeAgo(trendingUpdatedAt)}</span>}
            <button className={`refresh-btn ${refreshingTrending ? "spinning" : ""}`} onClick={onRefreshTrending} disabled={refreshingTrending}>
              <Loader2 size={16} />
            </button>
          </div>
        )}
      />

      {loading ? (
        <div className="loading-row"><Loader2 className="spin" size={22} /> Loading songs…</div>
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <div className="horizontal-shelf">
          {popular.slice(0, 12).map((t, i) => (
            <button key={t.id} className="hero-card" onClick={() => onPlay(popular, i)}>
              <TrackThumb track={t} />
              <div className="hero-card-copy">
                <span className="hero-card-title">{t.name}</span>
                <span className="hero-card-artist">{t.artist_name}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <SectionHeader title="Browse categories" />
      <div className="genre-grid">
        {genres.map((g) => (
          <button key={g.name} className="genre-card" onClick={() => onOpenGenre(g)}>
            <div className="genre-bg" style={{ backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.1), rgba(0,0,0,.72)), url(${genrePreviewMap[g.name] || g.cover})` }} />
            <div className="genre-tint" style={{ background: g.tint }} />
            <div className="genre-label">{g.name}</div>
          </button>
        ))}
      </div>

      <SectionHeader title="Made for you" />
      <div className="track-list">
        {popular.slice(0, 10).map((t, i) => (
          <TrackRow
            key={t.id}
            track={t}
            index={i}
            list={popular}
            onPlay={onPlay}
            isActive={currentTrack?.id === t.id}
            isPlaying={isPlaying}
            toggleLike={toggleLike}
            isLiked={isLiked}
            onOpenMenu={(track, ctx) => onOpenMenu({ track, list: popular, index: i })}
          />
        ))}
      </div>

      {localTracks.length > 0 && (
        <>
          <SectionHeader title="Local music" />
          <div className="local-strip">
            {localTracks.slice(0, 8).map((t) => (
              <div key={t.id} className="local-pill">
                <Music2 size={15} />
                <span>{t.name}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SearchView({ query, results, searching, error, onPlay, currentTrack, isPlaying, toggleLike, isLiked, onOpenGenre, onOpenMenu, genrePreviewMap, genres, localTracks }) {
  if (!query.trim()) {
    return (
      <div className="view-pad">
        <div className="hero">
          <div>
            <div className="eyebrow">Find something new</div>
            <h1 className="page-title">Browse all</h1>
          </div>
        </div>
        <div className="genre-grid">
          {genres.map((g) => (
            <button key={g.name} className="genre-card" onClick={() => onOpenGenre(g)}>
              <div className="genre-bg" style={{ backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.06), rgba(0,0,0,.74)), url(${genrePreviewMap[g.name] || g.cover})` }} />
              <div className="genre-tint" style={{ background: g.tint }} />
              <div className="genre-label">{g.name}</div>
            </button>
          ))}
        </div>

        {localTracks.length > 0 && (
          <>
            <SectionHeader title="On this device" />
            <div className="track-list">
              {localTracks.slice(0, 8).map((t, i) => (
                <TrackRow
                  key={t.id}
                  track={t}
                  index={i}
                  list={localTracks}
                  onPlay={onPlay}
                  isActive={currentTrack?.id === t.id}
                  isPlaying={isPlaying}
                  toggleLike={toggleLike}
                  isLiked={isLiked}
                  onOpenMenu={(track, ctx) => onOpenMenu({ track, list: localTracks, index: i })}
                />
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="view-pad">
      <div className="search-header">
        <div>
          <div className="eyebrow">Searching for</div>
          <h1 className="page-title">"{query}"</h1>
        </div>
      </div>
      {searching ? (
        <div className="loading-row"><Loader2 className="spin" size={22} /> Searching…</div>
      ) : error ? (
        <ErrorState message={error} />
      ) : results.length === 0 ? (
        <div className="empty-state">
          <Radio size={38} />
          <p>No songs found for "{query}"</p>
          <span>Try a different search term.</span>
        </div>
      ) : (
        <div className="track-list">
          {results.map((t, i) => (
            <TrackRow
              key={t.id}
              track={t}
              index={i}
              list={results}
              onPlay={onPlay}
              isActive={currentTrack?.id === t.id}
              isPlaying={isPlaying}
              toggleLike={toggleLike}
              isLiked={isLiked}
              onOpenMenu={(track, ctx) => onOpenMenu({ track, list: results, index: i })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GenreResultsView({ genre, results, searching, error, onPlay, currentTrack, isPlaying, toggleLike, isLiked, onOpenMenu }) {
  return (
    <div className="view-pad">
      <div className="hero">
        <div>
          <div className="eyebrow">Category</div>
          <h1 className="page-title">{genre?.name || "Genre"}</h1>
        </div>
      </div>
      {searching ? (
        <div className="loading-row"><Loader2 className="spin" size={22} /> Loading…</div>
      ) : error ? (
        <ErrorState message={error} />
      ) : results.length === 0 ? (
        <div className="empty-state">
          <Radio size={38} />
          <p>No songs found</p>
          <span>Try another category.</span>
        </div>
      ) : (
        <div className="track-list">
          {results.map((t, i) => (
            <TrackRow
              key={t.id}
              track={t}
              index={i}
              list={results}
              onPlay={onPlay}
              isActive={currentTrack?.id === t.id}
              isPlaying={isPlaying}
              toggleLike={toggleLike}
              isLiked={isLiked}
              onOpenMenu={(track, ctx) => onOpenMenu({ track, list: results, index: i })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LibraryView({ liked, playlists, localTracks, onPlay, currentTrack, isPlaying, toggleLike, isLiked, onOpenPlaylist, onOpenMenu, onCreatePlaylist, onOpenLiked }) {
  return (
    <div className="view-pad">
      <div className="hero">
        <div>
          <div className="eyebrow">Your collection</div>
          <h1 className="page-title">Library</h1>
        </div>
      </div>

      <div className="section-header">
        <h2>Playlists</h2>
        <button className="text-btn" onClick={onCreatePlaylist}><Plus size={15} /> New</button>
      </div>
      <div className="quick-grid">
        {playlists.map(pl => (
          <button key={pl.id} className="quick-card" onClick={() => onOpenPlaylist(pl)}>
            {pl.image ? <img src={pl.image} alt="" /> : <div className="quick-card-placeholder"><Music2 size={18} /></div>}
            <span>{pl.name}</span>
            <div className="quick-play"><Play size={16} fill="#000" /></div>
          </button>
        ))}
      </div>

      <div className="library-banner" onClick={onOpenLiked}>
        <div className="library-banner-copy">
          <div className="eyebrow">Liked songs</div>
          <div className="library-banner-title">{liked.length} saved tracks</div>
          <div className="library-banner-sub">Managed directly from settings too.</div>
        </div>
        <div className="library-banner-icon"><Heart size={20} fill="currentColor" /></div>
      </div>

      <SectionHeader title="Liked songs" />
      {liked.length === 0 ? (
        <div className="empty-state">
          <Heart size={38} />
          <p>Songs you like will appear here</p>
          <span>Tap the heart icon on any track to save it.</span>
        </div>
      ) : (
        <div className="track-list">
          {liked.map((t, i) => (
            <TrackRow
              key={t.id}
              track={t}
              index={i}
              list={liked}
              onPlay={onPlay}
              isActive={currentTrack?.id === t.id}
              isPlaying={isPlaying}
              toggleLike={toggleLike}
              isLiked={isLiked}
              onOpenMenu={(track, ctx) => onOpenMenu({ track, list: liked, index: i })}
            />
          ))}
        </div>
      )}

      {localTracks.length > 0 && (
        <>
          <SectionHeader title="Local music" />
          <div className="track-list">
            {localTracks.map((t, i) => (
              <TrackRow
                key={t.id}
                track={t}
                index={i}
                list={localTracks}
                onPlay={onPlay}
                isActive={currentTrack?.id === t.id}
                isPlaying={isPlaying}
                toggleLike={toggleLike}
                isLiked={isLiked}
                onOpenMenu={(track, ctx) => onOpenMenu({ track, list: localTracks, index: i })}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PlaylistView({ playlist, onBack, onPlay, currentTrack, isPlaying, toggleLike, isLiked, onAddToPlaylist, onRemoveFromPlaylist, onDeletePlaylist, onTrackMenu }) {
  return (
    <div className="view-pad">
      <div className="playlist-hero">
        <button className="back-inline" onClick={onBack}><ChevronLeft size={18} /> Back</button>
        <div className="playlist-hero-main">
          {playlist.image ? <img src={playlist.image} alt="" /> : <div className="playlist-hero-placeholder"><Music2 size={36} /></div>}
          <div className="playlist-hero-text">
            <span className="eyebrow">Playlist</span>
            <h1>{playlist.name}</h1>
            <span className="pl-hero-sub">{playlist.tracks.length} songs</span>
          </div>
        </div>

        <div className="playlist-actions">
          {playlist.tracks.length > 0 && (
            <button className="play-fab" onClick={() => onPlay(playlist.tracks, 0)}><Play size={20} fill="#000" /></button>
          )}
          {!playlist.system && (
            <button className="text-btn danger" onClick={() => onDeletePlaylist(playlist.id)}>
              <Trash2 size={14} /> Delete playlist
            </button>
          )}
        </div>
      </div>

      {playlist.tracks.length === 0 ? (
        <div className="empty-state">
          <Music2 size={38} />
          <p>This playlist is empty</p>
          <span>Tap the ⋯ on any song to add it here.</span>
        </div>
      ) : (
        <div className="track-list">
          {playlist.tracks.map((t, i) => (
            <TrackRow
              key={t.id}
              track={t}
              index={i}
              list={playlist.tracks}
              onPlay={onPlay}
              isActive={currentTrack?.id === t.id}
              isPlaying={isPlaying}
              toggleLike={toggleLike}
              isLiked={isLiked}
              onOpenMenu={(track, ctx) => onTrackMenu({ track, list: playlist.tracks, index: i, playlistId: playlist.id, playlistTrack: true })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LikedSongsSheet({ liked, onClose, onPlay, currentTrack, isPlaying, toggleLike, isLiked, onOpenMenu }) {
  return (
    <Sheet title="Liked songs" onClose={onClose}>
      {liked.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 18 }}>
          <Heart size={38} />
          <p>No liked songs yet</p>
          <span>Use the heart icon on any track to save it.</span>
        </div>
      ) : (
        <div className="track-list">
          {liked.map((t, i) => (
            <TrackRow
              key={t.id}
              track={t}
              index={i}
              list={liked}
              onPlay={onPlay}
              isActive={currentTrack?.id === t.id}
              isPlaying={isPlaying}
              toggleLike={toggleLike}
              isLiked={isLiked}
              onOpenMenu={(track, ctx) => onOpenMenu({ track, list: liked, index: i })}
            />
          ))}
        </div>
      )}
    </Sheet>
  );
}

function SectionHeader({ title, right }) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
      {right || null}
    </div>
  );
}

function ErrorState({ message }) {
  const isQuota = message && /quota/i.test(message);
  return (
    <div className="empty-state">
      <Radio size={38} />
      <p>{isQuota ? "Daily search limit reached" : "Couldn't load songs"}</p>
      <span>{isQuota ? "Try again later or refresh the page." : message || "Unknown error"}</span>
    </div>
  );
}

function useTicker(ms) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

/* ============================================================================
   PLAYER SHEETS
============================================================================ */
function MiniPlayer({ track, isPlaying, togglePlay, onNext, onPrev, progress, duration, seek, volume, setVolume, shuffle, setShuffle, repeat, cycleRepeat, toggleLike, isLiked, buffering, accent, onExpand, onQueue, onTrackMenu }) {
  const pct = duration ? (progress / duration) * 100 : 0;
  const VolIcon = volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;
  const RepeatIcon = repeat === "one" ? Repeat1 : Repeat;

  if (!track) {
    return <div className="mini-player empty"><span className="np-empty">Pick a song to start listening</span></div>;
  }

  return (
    <div className="mini-player">
      <div className="mini-progress mobile-only" onClick={seek}>
        <div className="mini-progress-fill" style={{ width: `${pct}%`, background: accent.accent }} />
      </div>

      <div className="mini-player-row">
        <button className="np-left" onClick={onExpand}>
          <TrackThumb track={track} small />
          <div className="np-meta">
            <span className="np-title">{track.name}</span>
            <span className="np-artist">{track.artist_name}</span>
          </div>
        </button>

        <div className="mini-controls mobile-only">
          <button className={`heart-btn ${isLiked(track) ? "liked" : ""}`} onClick={(e) => { e.stopPropagation(); toggleLike(track); }}>
            <Heart size={19} fill={isLiked(track) ? "currentColor" : "none"} />
          </button>
          <button className="more-btn" onClick={(e) => { e.stopPropagation(); onTrackMenu({ track, list: [track], index: 0 }); }}>
            <MoreHorizontal size={18} />
          </button>
          <button className="play-btn" onClick={(e) => { e.stopPropagation(); togglePlay(); }}>
            {buffering ? <Loader2 size={16} className="spin" /> : isPlaying ? <Pause size={18} fill="#000" /> : <Play size={18} fill="#000" style={{ marginLeft: 2 }} />}
          </button>
        </div>

        <div className="np-center desktop-only">
          <div className="np-controls">
            <button className={`ctrl-btn ${shuffle ? "on" : ""}`} onClick={() => setShuffle(s => !s)}><Shuffle size={16} /></button>
            <button className="ctrl-btn" onClick={onPrev}><SkipBack size={18} fill="currentColor" /></button>
            <button className="play-btn" onClick={togglePlay}>
              {buffering ? <Loader2 size={16} className="spin" /> : isPlaying ? <Pause size={17} fill="#000" /> : <Play size={17} fill="#000" style={{ marginLeft: 2 }} />}
            </button>
            <button className="ctrl-btn" onClick={onNext}><SkipForward size={18} fill="currentColor" /></button>
            <button className={`ctrl-btn ${repeat !== "off" ? "on" : ""}`} onClick={cycleRepeat}><RepeatIcon size={16} /></button>
          </div>
          <div className="np-progress">
            <span className="np-time">{formatTime(progress)}</span>
            <div className="progress-track" onClick={seek}>
              <div className="progress-fill" style={{ width: `${pct}%`, background: accent.accent }} />
              <div className="progress-knob" style={{ left: `${pct}%`, background: accent.accent }} />
            </div>
            <span className="np-time">{formatTime(duration)}</span>
          </div>
        </div>

        <div className="np-right desktop-only">
          <button className={`heart-btn ${isLiked(track) ? "liked" : ""}`} onClick={() => toggleLike(track)}>
            <Heart size={16} fill={isLiked(track) ? "currentColor" : "none"} />
          </button>
          <button className="text-icon-btn" onClick={onQueue}><ListMusic size={17} /><span>Queue</span></button>
          <div className="volume-control">
            <VolIcon size={17} />
            <div className="volume-track" onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const p = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
              setVolume(Math.round(p * 100));
            }}>
              <div className="volume-fill" style={{ width: `${volume}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FullPlayerSheet({ track, isPlaying, togglePlay, onNext, onPrev, progress, duration, seek, volume, setVolume, shuffle, setShuffle, repeat, cycleRepeat, toggleLike, isLiked, buffering, accent, onClose, onShowQueue, onAddToPlaylist }) {
  const pct = duration ? (progress / duration) * 100 : 0;
  const RepeatIcon = repeat === "one" ? Repeat1 : Repeat;
  const VolIcon = volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;
  const [drag, setDrag] = useState(0);
  const startRef = useRef(0);
  const activeRef = useRef(false);

  const endDrag = () => {
    activeRef.current = false;
    if (drag > 110) onClose();
    else setDrag(0);
  };

  return (
    <div className="full-player" style={{ transform: `translateY(${drag}px)`, background: `linear-gradient(180deg, ${accent.accent}22 0%, var(--bg) 56%)` }}
      onPointerDown={(e) => { activeRef.current = true; startRef.current = e.clientY; }}
      onPointerMove={(e) => {
        if (!activeRef.current) return;
        const dy = Math.max(0, e.clientY - startRef.current);
        setDrag(dy);
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="full-player-top">
        <button className="round-btn" onClick={onClose}><ChevronDown size={22} /></button>
        <span className="full-player-label">Now Playing</span>
        <button className="round-btn" onClick={() => onAddToPlaylist(track)}><MoreHorizontal size={20} /></button>
      </div>

      <div className="full-player-art-wrap">
        <div className="full-player-glow" style={{ boxShadow: `0 0 80px ${accent.accent}44` }} />
        <TrackThumb track={track} />
      </div>

      <div className="full-player-meta">
        <div className="full-player-titles">
          <span className="full-player-title">{track.name}</span>
          <span className="full-player-artist">{track.artist_name}</span>
        </div>
        <button className={`heart-btn big ${isLiked(track) ? "liked" : ""}`} onClick={() => toggleLike(track)}>
          <Heart size={24} fill={isLiked(track) ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="full-player-progress">
        <div className="progress-track" onClick={seek}>
          <div className="progress-fill" style={{ width: `${pct}%`, background: accent.accent }} />
          <div className="progress-knob" style={{ left: `${pct}%`, background: accent.accent }} />
        </div>
        <div className="full-player-times">
          <span>{formatTime(progress)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="full-player-controls">
        <button className={`ctrl-btn big ${shuffle ? "on" : ""}`} onClick={() => setShuffle(s => !s)}><Shuffle size={22} /></button>
        <button className="ctrl-btn big" onClick={onPrev}><SkipBack size={30} fill="currentColor" /></button>
        <button className="play-btn big" onClick={togglePlay}>
          {buffering ? <Loader2 size={26} className="spin" /> : isPlaying ? <Pause size={28} fill="#000" /> : <Play size={28} fill="#000" style={{ marginLeft: 3 }} />}
        </button>
        <button className="ctrl-btn big" onClick={onNext}><SkipForward size={30} fill="currentColor" /></button>
        <button className={`ctrl-btn big ${repeat !== "off" ? "on" : ""}`} onClick={cycleRepeat}><RepeatIcon size={22} /></button>
      </div>

      <div className="full-player-bottom-row">
        <div className="volume-control full">
          <VolIcon size={18} />
          <div className="volume-track" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const p = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
            setVolume(Math.round(p * 100));
          }}>
            <div className="volume-fill" style={{ width: `${volume}%` }} />
          </div>
        </div>
        <button className="text-icon-btn" onClick={onShowQueue}><ListMusic size={19} /><span>Queue</span></button>
      </div>
    </div>
  );
}

function QueueSheet({ queue, currentIndex, onPlayFromQueue, onClose }) {
  return (
    <Sheet title="Queue" onClose={onClose}>
      {queue.map((t, i) => (
        <div key={t.id + i} className={`track-row ${i === currentIndex ? "active" : ""}`} onClick={() => onPlayFromQueue(i)}>
          <div className="track-row-index">
            {i === currentIndex ? <div className="playing-bars"><span /><span /><span /></div> : <span className="idx-number">{i + 1}</span>}
          </div>
          <TrackThumb track={t} small />
          <div className="track-row-meta"><span className="track-row-title">{t.name}</span><span className="track-row-artist">{t.artist_name}</span></div>
        </div>
      ))}
    </Sheet>
  );
}

function CreatePlaylistModal({ onCreate, onClose }) {
  const [name, setName] = useState("");
  return (
    <Sheet title="Create playlist" onClose={onClose}>
      <div className="sheet-body-pad">
        <input
          className="modal-input"
          placeholder="Playlist name"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) onCreate(name.trim()); }}
        />
        <button className="primary-btn" disabled={!name.trim()} onClick={() => name.trim() && onCreate(name.trim())}>Create</button>
      </div>
    </Sheet>
  );
}

function AddToPlaylistModal({ track, playlists, onAdd, onClose, onCreateNew }) {
  return (
    <Sheet title="Add to playlist" onClose={onClose}>
      <div className="sheet-body">
        <button className="add-pl-row" onClick={onCreateNew}>
          <div className="mini-icon"><Plus size={16} /></div>
          <span>New playlist</span>
        </button>
        {playlists.length === 0 ? (
          <div className="empty-state" style={{ padding: "30px 20px" }}>
            <p>No playlists yet</p><span>Create one to add songs.</span>
          </div>
        ) : playlists.map(pl => {
          const already = pl.tracks.some(t => t.id === track.id);
          return (
            <button key={pl.id} className="add-pl-row" onClick={() => !already && onAdd(pl.id, track)}>
              {pl.image ? <img src={pl.image} alt="" className="add-pl-img" /> : <div className="mini-icon"><Music2 size={16} /></div>}
              <span style={{ flex: 1 }}>{pl.name}</span>
              {already && <Check size={16} color="var(--accent)" />}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

function TrackMenuSheet({ payload, isLiked, onClose, onPlayNow, onPlayNext, onAddToQueue, onToggleLike, onAddToPlaylist, onShare, onCopy, onRemoveFromPlaylist, onRemoveLocal }) {
  const { track, playlistId, playlistTrack } = payload || {};
  if (!track) return null;

  return (
    <Sheet title={track.name} subtitle={track.artist_name} onClose={onClose}>
      <div className="sheet-body">
        <MenuAction icon={<Play size={16} />} label="Play now" onClick={onPlayNow} />
        <MenuAction icon={<ArrowRight size={16} />} label="Play next" onClick={onPlayNext} />
        <MenuAction icon={<ListMusic size={16} />} label="Add to queue" onClick={onAddToQueue} />
        <MenuAction icon={<Heart size={16} fill={isLiked ? "currentColor" : "none"} />} label={isLiked ? "Remove like" : "Like song"} onClick={onToggleLike} />
        <MenuAction icon={<Plus size={16} />} label="Add to playlist" onClick={onAddToPlaylist} />
        {playlistId && playlistTrack && <MenuAction icon={<X size={16} />} label="Remove from this playlist" onClick={onRemoveFromPlaylist} danger />}
        {isLocalTrack(track) && <MenuAction icon={<Trash2 size={16} />} label="Remove from device library" onClick={onRemoveLocal} danger />}
        <MenuAction icon={<Share2 size={16} />} label="Share" onClick={onShare} />
        <MenuAction icon={<Copy size={16} />} label="Copy title" onClick={onCopy} />
        {!isLocalTrack(track) && (
          <MenuAction icon={<ExternalLink size={16} />} label="Open source" onClick={() => window.open(track.url || `https://www.youtube.com/watch?v=${track.id}`, "_blank")} />
        )}
      </div>
    </Sheet>
  );
}

function SettingsModal({ themeMode, setThemeMode, accentKey, setAccentKey, searchHistory, onClearHistory, likedTracks, onOpenLiked, localTracks, onImportFiles, onScanFolder, localImporting, onClose }) {
  return (
    <Sheet title="Settings" subtitle="Appearance, storage and library" onClose={onClose}>
      <div className="sheet-body">
        <SettingsSection title="Appearance" icon={<Palette size={15} />}>
          <div className="segmented">
            <ThemeButton active={themeMode === "system"} label="System" icon={<Monitor size={15} />} onClick={() => setThemeMode("system")} />
            <ThemeButton active={themeMode === "light"} label="Light" icon={<Sun size={15} />} onClick={() => setThemeMode("light")} />
            <ThemeButton active={themeMode === "dark"} label="Dark" icon={<Moon size={15} />} onClick={() => setThemeMode("dark")} />
          </div>
        </SettingsSection>

        <SettingsSection title="Accent color" icon={<Sparkles size={15} />}>
          <div className="theme-grid">
            {Object.entries(ACCENTS).map(([key, t]) => (
              <button key={key} className={`theme-swatch ${accentKey === key ? "active" : ""}`} onClick={() => setAccentKey(key)}>
                <span className="theme-dot" style={{ background: t.accent }} />
                <span>{t.name}</span>
                {accentKey === key && <Check size={14} />}
              </button>
            ))}
          </div>
        </SettingsSection>

        <SettingsSection title="Liked songs" icon={<Heart size={15} fill="currentColor" />}>
          <div className="settings-card">
            <div>
              <div className="settings-card-title">{likedTracks.length} saved songs</div>
              <div className="settings-hint">Your liked music is available in Library and here.</div>
            </div>
            <button className="settings-link-btn" onClick={onOpenLiked}>Open</button>
          </div>
        </SettingsSection>

        <SettingsSection title="Local music" icon={<Music2 size={15} />}>
          <div className="settings-actions-grid">
            <button className="action-card" onClick={onImportFiles} disabled={localImporting}>
              <Upload size={17} />
              <span>{localImporting ? "Importing…" : "Import audio files"}</span>
            </button>
            <button className="action-card" onClick={onScanFolder} disabled={localImporting}>
              <FolderInput size={17} />
              <span>Scan folder</span>
            </button>
          </div>
          <div className="settings-card">
            <div>
              <div className="settings-card-title">{localTracks.length} local tracks</div>
              <div className="settings-hint">Stored in your device browser storage and playable offline in the app.</div>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="Search history" icon={<Clock size={15} />}>
          {searchHistory.length === 0 ? (
            <p className="settings-hint">Your recent searches will appear here.</p>
          ) : (
            <div className="history-list settings-history">
              {searchHistory.map((q, i) => (
                <button key={`${q}_${i}`} className="history-item" onClick={noop}>
                  <Clock size={14} /> <span>{q}</span>
                </button>
              ))}
            </div>
          )}
          {searchHistory.length > 0 && (
            <button className="text-btn danger" onClick={onClearHistory}><Trash2 size={13} /> Clear history</button>
          )}
        </SettingsSection>

        <SettingsSection title="About" icon={<Monitor size={15} />}>
          <p className="settings-hint">
            Wavelen is built as a single-file React music player with live trending refresh, local music support, custom themes and playlist tools.
          </p>
        </SettingsSection>
      </div>
    </Sheet>
  );
}

function Sheet({ title, subtitle, children, onClose }) {
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div>
            <h3>{title}</h3>
            {subtitle ? <div className="sheet-subtitle">{subtitle}</div> : null}
          </div>
          <button className="round-btn" onClick={onClose}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SettingsSection({ title, icon, children }) {
  return (
    <section className="settings-section">
      <div className="settings-label"><span className="settings-icon">{icon}</span>{title}</div>
      {children}
    </section>
  );
}

function ThemeButton({ active, label, icon, onClick }) {
  return (
    <button className={`theme-swatch theme-pill ${active ? "active" : ""}`} onClick={onClick}>
      <span className="theme-dot">{icon}</span>
      <span>{label}</span>
      {active && <Check size={14} />}
    </button>
  );
}

function MenuAction({ icon, label, onClick, danger = false }) {
  return (
    <button className={`menu-action ${danger ? "danger" : ""}`} onClick={onClick}>
      <span className="menu-action-icon">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

/* ============================================================================
   STYLES
============================================================================ */
const STYLES = `
:root {
  --bg: #090b0f;
  --surface: rgba(18, 21, 25, 0.86);
  --surface-2: rgba(24, 28, 33, 0.9);
  --surface-3: rgba(34, 40, 46, 0.94);
  --border: rgba(255, 255, 255, 0.08);
  --text: #F5F7F4;
  --text-dim: rgba(245, 247, 244, 0.62);
  --accent: #C4F135;
  --accent-2: #7B61FF;
  --shadow-soft: 0 10px 30px rgba(0,0,0,.28);
  --shadow-lift: 0 20px 50px rgba(0,0,0,.42);
  --radius: 20px;
  --radius-lg: 26px;
}
html[data-theme="light"] {
  --bg: #f6f7fb;
  --surface: rgba(255,255,255,0.84);
  --surface-2: rgba(255,255,255,0.92);
  --surface-3: rgba(240,242,248,0.96);
  --border: rgba(10, 14, 20, 0.08);
  --text: #101318;
  --text-dim: rgba(16, 19, 24, 0.58);
  --shadow-soft: 0 10px 30px rgba(10,14,20,.08);
  --shadow-lift: 0 20px 50px rgba(10,14,20,.12);
}
* { box-sizing: border-box; }
html, body, #root { width: 100%; height: 100%; margin: 0; }
body {
  background: var(--bg);
  color: var(--text);
  overflow: hidden;
}
button, input { font: inherit; }
button { -webkit-tap-highlight-color: transparent; }
img { display: block; }
.app-shell {
  position: relative;
  width: 100%;
  height: 100dvh;
  overflow: hidden;
  color: var(--text);
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 16%, transparent), transparent 40%),
    radial-gradient(circle at 80% 0%, color-mix(in srgb, var(--accent-2) 12%, transparent), transparent 30%),
    var(--bg);
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
}
.ambient-glow {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 18% 4%, rgba(123,97,255,.14), transparent 36%),
    radial-gradient(circle at 80% 0%, rgba(196,241,53,.10), transparent 28%);
}
.layout {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 12px;
  height: 100%;
  padding: 12px 12px 0;
  min-width: 0;
}

/* Sidebar */
.sidebar {
  width: 280px;
  flex-shrink: 0;
  background: linear-gradient(180deg, var(--surface) 0%, color-mix(in srgb, var(--surface) 70%, black) 100%);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 18px 14px;
  box-shadow: var(--shadow-soft);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  backdrop-filter: blur(18px);
}
.brand {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 4px 8px 18px;
}
.brand-mark {
  width: 40px;
  height: 40px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #0B0E10;
  box-shadow: 0 8px 22px rgba(0,0,0,.18);
}
.brand-title {
  font-size: 18px;
  font-weight: 900;
  letter-spacing: -0.03em;
}
.brand-sub {
  font-size: 12px;
  color: var(--text-dim);
  margin-top: 2px;
}
.nav-group, .playlist-block { display: flex; flex-direction: column; gap: 4px; }
.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 11px 12px;
  border: 0;
  border-radius: 14px;
  background: transparent;
  color: var(--text-dim);
  cursor: pointer;
  text-align: left;
  font-size: 14px;
  font-weight: 700;
  transition: transform .16s ease, background .16s ease, color .16s ease;
}
.nav-item:hover, .nav-item.active {
  background: color-mix(in srgb, var(--surface-2) 78%, transparent);
  color: var(--text);
}
.nav-item:hover { transform: translateY(-1px); }
.mini-icon {
  width: 24px; height: 24px; border-radius: 8px;
  display: grid; place-items: center;
  background: color-mix(in srgb, var(--surface-2) 95%, black);
  color: var(--text-dim);
}
.mini-icon.liked { background: linear-gradient(135deg, var(--accent-2), #4558e7); color: white; }
.count-pill {
  margin-left: auto;
  font-size: 11px;
  background: color-mix(in srgb, var(--surface-3) 86%, transparent);
  padding: 4px 9px;
  border-radius: 999px;
  color: var(--text-dim);
}
.sidebar-divider {
  height: 1px;
  background: var(--border);
  margin: 14px 4px;
}
.playlist-list {
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 0;
}
.playlist-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border: 0;
  padding: 8px;
  border-radius: 14px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.playlist-row:hover, .playlist-row.active {
  background: color-mix(in srgb, var(--surface-2) 80%, transparent);
}
.playlist-row img, .playlist-row-placeholder, .track-row-art, .cover-art {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  object-fit: cover;
  background: color-mix(in srgb, var(--surface-3) 70%, transparent);
  flex-shrink: 0;
}
.playlist-row-placeholder, .track-row-art.placeholder, .cover-art.placeholder {
  display: grid;
  place-items: center;
  color: var(--text-dim);
}
.playlist-row-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.pl-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13.5px;
  font-weight: 700;
}
.pl-sub {
  color: var(--text-dim);
  font-size: 11.5px;
}

/* Main */
.main-pane {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: linear-gradient(180deg, var(--surface) 0%, color-mix(in srgb, var(--surface) 80%, black) 100%);
  overflow: hidden;
  box-shadow: var(--shadow-soft);
  backdrop-filter: blur(18px);
}
.topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 22px;
  flex-shrink: 0;
  position: relative;
}
.topbar-nav { flex-shrink: 0; }
.round-btn, .settings-btn {
  width: 38px; height: 38px;
  border: 1px solid var(--border);
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--surface-2) 82%, transparent);
  color: var(--text);
  cursor: pointer;
  transition: transform .16s ease, background .16s ease, border-color .16s ease;
}
.round-btn:hover, .settings-btn:hover { transform: scale(1.04); border-color: color-mix(in srgb, var(--accent) 36%, var(--border)); }
.round-btn:disabled { opacity: .35; cursor: default; transform: none; }

.search-wrap { flex: 1; min-width: 0; position: relative; max-width: 560px; }
.search-box {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 11px 16px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-2) 80%, transparent);
  border: 1px solid var(--border);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.01);
}
.search-box:focus-within {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--accent) 10%, transparent);
}
.search-icon { color: var(--text-dim); flex-shrink: 0; }
.search-box input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--text);
  font-size: 14px;
}
.search-box input::placeholder { color: var(--text-dim); }
.clear-btn {
  width: 22px; height: 22px;
  border: 0;
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-3) 80%, transparent);
  color: var(--text);
  display: grid;
  place-items: center;
}
.search-history-popover {
  position: absolute;
  top: calc(100% + 10px);
  left: 0;
  right: 0;
  z-index: 12;
  background: color-mix(in srgb, var(--surface-2) 92%, black);
  border: 1px solid var(--border);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: var(--shadow-lift);
  backdrop-filter: blur(18px);
}
.popover-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px 10px;
  color: var(--text-dim);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .02em;
  text-transform: uppercase;
}
.history-item {
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  cursor: pointer;
  border-top: 1px solid var(--border);
  text-align: left;
}
.history-item:hover { background: color-mix(in srgb, var(--surface-3) 72%, transparent); }
.history-item span {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.content-scroll {
  flex: 1;
  overflow: auto;
  min-width: 0;
}
.view-pad {
  padding: 10px 28px 42px;
}
.page-title {
  margin: 0;
  font-size: 28px;
  letter-spacing: -0.04em;
  line-height: 1.06;
}
.hero {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 18px;
  margin-bottom: 18px;
}
.eyebrow {
  color: var(--text-dim);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .12em;
  text-transform: uppercase;
  margin-bottom: 8px;
}
.hero-chip, .resume-action, .hero-card, .genre-card, .quick-card, .action-card, .settings-link-btn, .play-fab {
  transition: transform .18s ease, box-shadow .18s ease, background .18s ease, border-color .18s ease;
}
.hero-chip {
  align-self: center;
  padding: 10px 14px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--text);
  border: 1px solid color-mix(in srgb, var(--accent) 20%, var(--border));
  font-size: 12px;
  font-weight: 800;
}
.resume-card {
  width: 100%;
  border: 1px solid var(--border);
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 15%, transparent), color-mix(in srgb, var(--accent-2) 12%, transparent));
  border-radius: 24px;
  padding: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  color: var(--text);
  cursor: pointer;
  margin-bottom: 18px;
  box-shadow: var(--shadow-soft);
}
.resume-card:hover { transform: translateY(-2px); }
.resume-copy { display: flex; flex-direction: column; min-width: 0; }
.resume-label { color: var(--text-dim); font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
.resume-title { font-size: 18px; font-weight: 900; margin-top: 6px; }
.resume-sub { color: var(--text-dim); font-size: 13px; margin-top: 2px; }
.resume-action {
  width: 46px; height: 46px; border-radius: 999px;
  background: var(--accent);
  display: grid; place-items: center;
  box-shadow: 0 8px 20px color-mix(in srgb, var(--accent) 18%, transparent);
  color: #0B0E10;
  flex-shrink: 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 28px 0 14px;
}
.section-header h2 {
  margin: 0;
  font-size: 19px;
  font-weight: 900;
  letter-spacing: -.03em;
}
.section-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}
.trending-updated {
  color: var(--text-dim);
  font-size: 12px;
}
.refresh-btn {
  width: 34px; height: 34px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface-2) 80%, transparent);
  color: var(--text);
  display: grid;
  place-items: center;
  cursor: pointer;
}
.refresh-btn.spinning .spin { animation: spin 1s linear infinite; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.quick-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 12px;
}
.quick-card {
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface-2) 88%, transparent);
  border-radius: 18px;
  overflow: hidden;
  height: 62px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding-right: 10px;
  cursor: pointer;
}
.quick-card img, .quick-card-placeholder {
  width: 62px; height: 62px; object-fit: cover; flex-shrink: 0;
  border-radius: 0;
}
.quick-card-placeholder {
  display: grid;
  place-items: center;
  color: var(--text-dim);
  background: color-mix(in srgb, var(--surface-3) 92%, transparent);
}
.quick-card span {
  flex: 1;
  min-width: 0;
  font-weight: 800;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.quick-play {
  width: 32px; height: 32px;
  border-radius: 999px;
  background: var(--accent);
  color: #0B0E10;
  display: grid;
  place-items: center;
  transform: translateX(4px);
  opacity: 0;
}
.quick-card:hover .quick-play { opacity: 1; transform: translateX(0); }

.horizontal-shelf {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(180px, 240px);
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 8px;
}
.hero-card {
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface-2) 90%, transparent);
  border-radius: 22px;
  overflow: hidden;
  text-align: left;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  cursor: pointer;
}
.hero-card:hover { transform: translateY(-2px); }
.cover-art {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 18px;
}
.hero-card-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.hero-card-title {
  font-weight: 900;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hero-card-artist {
  color: var(--text-dim);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.genre-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.genre-card {
  position: relative;
  overflow: hidden;
  min-height: 132px;
  border-radius: 24px;
  border: 1px solid var(--border);
  cursor: pointer;
  text-align: left;
  box-shadow: var(--shadow-soft);
  background: color-mix(in srgb, var(--surface-2) 86%, transparent);
}
.genre-bg, .genre-tint {
  position: absolute; inset: 0;
}
.genre-bg {
  background-size: cover;
  background-position: center;
  transform: scale(1.02);
}
.genre-tint {
  opacity: .18;
  mix-blend-mode: screen;
}
.genre-label {
  position: absolute;
  left: 16px; bottom: 16px; right: 16px;
  font-size: 20px;
  font-weight: 900;
  letter-spacing: -.03em;
  text-shadow: 0 10px 30px rgba(0,0,0,.65);
}
.loading-row, .empty-state {
  min-height: 180px;
  border: 1px dashed var(--border);
  border-radius: 24px;
  background: color-mix(in srgb, var(--surface-2) 78%, transparent);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-dim);
  gap: 10px;
  text-align: center;
  padding: 24px;
}
.empty-state p { color: var(--text); margin: 0; font-weight: 800; font-size: 15px; }
.empty-state span { font-size: 13px; max-width: 34ch; }

.track-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.track-row {
  display: grid;
  grid-template-columns: 32px 44px 1fr auto auto;
  align-items: center;
  gap: 12px;
  border: 1px solid transparent;
  background: color-mix(in srgb, var(--surface-2) 82%, transparent);
  padding: 10px 12px;
  border-radius: 18px;
  cursor: pointer;
}
.track-row:hover, .track-row.active {
  background: color-mix(in srgb, var(--surface-3) 84%, transparent);
  border-color: color-mix(in srgb, var(--accent) 14%, var(--border));
}
.track-row-index {
  width: 32px;
  display: grid;
  place-items: center;
  color: var(--text-dim);
  font-size: 12px;
  font-weight: 800;
}
.idx-play { opacity: 0; }
.track-row:hover .idx-play { opacity: 1; }
.playing-bars { display: flex; align-items: end; gap: 2px; height: 14px; }
.playing-bars span {
  width: 2px;
  height: 100%;
  border-radius: 999px;
  background: var(--accent);
  animation: bounce 1s ease-in-out infinite;
}
.playing-bars span:nth-child(2) { animation-delay: .14s; height: 60%; }
.playing-bars span:nth-child(3) { animation-delay: .28s; height: 80%; }
@keyframes bounce { 0%, 100% { transform: scaleY(.5); } 50% { transform: scaleY(1); } }

.track-row-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.track-row-title {
  font-size: 14px;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.track-row-artist {
  font-size: 12px;
  color: var(--text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.track-row-art {
  width: 44px;
  height: 44px;
  border-radius: 14px;
}
.track-row-art.placeholder {
  display: grid;
  place-items: center;
  color: var(--text-dim);
}
.heart-btn, .more-btn, .play-btn, .ctrl-btn {
  border: 0;
  background: transparent;
  color: var(--text-dim);
  cursor: pointer;
}
.heart-btn:hover, .more-btn:hover, .ctrl-btn:hover { color: var(--text); }
.heart-btn.liked, .ctrl-btn.on { color: var(--accent); }
.heart-btn.big { width: 48px; height: 48px; border-radius: 999px; background: color-mix(in srgb, var(--surface-2) 90%, transparent); }
.more-btn {
  width: 34px; height: 34px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--surface-2) 85%, transparent);
  margin-left: 4px;
}
.play-btn {
  width: 38px; height: 38px;
  border-radius: 999px;
  background: #fff;
  color: #0B0E10;
  display: grid;
  place-items: center;
  box-shadow: 0 8px 18px rgba(0,0,0,.18);
}
.play-btn.big { width: 66px; height: 66px; }

.local-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.local-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-2) 84%, transparent);
  color: var(--text);
  font-size: 13px;
}
.library-banner {
  margin-top: 18px;
  padding: 18px;
  border-radius: 24px;
  border: 1px solid var(--border);
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 14%, transparent), color-mix(in srgb, var(--accent-2) 12%, transparent));
  display: flex;
  justify-content: space-between;
  gap: 16px;
  cursor: pointer;
}
.library-banner-title {
  font-size: 18px;
  font-weight: 900;
  margin-top: 4px;
}
.library-banner-sub {
  color: var(--text-dim);
  font-size: 13px;
  margin-top: 4px;
}
.library-banner-icon {
  width: 48px; height: 48px; border-radius: 999px;
  background: var(--accent);
  color: #0B0E10;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.back-inline {
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface-2) 80%, transparent);
  color: var(--text);
  padding: 8px 12px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 800;
  cursor: pointer;
}
.playlist-hero {
  margin-bottom: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.playlist-hero-main {
  display: flex;
  gap: 16px;
  align-items: end;
}
.playlist-hero-main img, .playlist-hero-placeholder {
  width: 132px;
  height: 132px;
  border-radius: 24px;
  object-fit: cover;
  box-shadow: var(--shadow-soft);
}
.playlist-hero-placeholder {
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--surface-2) 86%, transparent);
  border: 1px solid var(--border);
  color: var(--text-dim);
}
.playlist-hero-text h1 { margin: 0; font-size: 28px; letter-spacing: -.04em; }
.pl-hero-sub { color: var(--text-dim); font-size: 13px; }
.playlist-actions {
  padding: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.play-fab {
  width: 56px; height: 56px;
  border-radius: 999px;
  border: 0;
  background: var(--accent);
  display: grid;
  place-items: center;
  color: #0B0E10;
  box-shadow: 0 12px 24px color-mix(in srgb, var(--accent) 22%, transparent);
  cursor: pointer;
}
.play-fab:hover { transform: scale(1.04); }
.danger { color: #ff6b6b !important; }

.mini-player {
  position: relative;
  z-index: 10;
  border-top: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface-2) 88%, transparent);
  backdrop-filter: blur(18px);
}
.mini-player.empty {
  height: 56px;
  display: grid;
  place-items: center;
}
.np-empty { color: var(--text-dim); font-size: 13px; }
.mini-progress {
  height: 2px;
  background: var(--border);
}
.mini-progress-fill {
  height: 100%;
}
.mini-player-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
  height: 78px;
  padding: 0 18px;
}
.np-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  text-align: left;
}
.np-meta { min-width: 0; display: flex; flex-direction: column; }
.np-title, .np-artist, .full-player-title, .full-player-artist {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.np-title { font-size: 14px; font-weight: 900; }
.np-artist { font-size: 12px; color: var(--text-dim); }
.np-center { display: flex; flex-direction: column; gap: 6px; align-items: center; }
.np-controls { display: flex; align-items: center; gap: 16px; }
.ctrl-btn { color: var(--text-dim); display: grid; place-items: center; }
.ctrl-btn.big { color: var(--text); width: 56px; height: 56px; border-radius: 999px; background: color-mix(in srgb, var(--surface-2) 90%, transparent); }
.np-progress { display: flex; align-items: center; gap: 8px; width: 100%; max-width: 520px; }
.np-time { width: 34px; font-size: 11px; text-align: center; color: var(--text-dim); }
.progress-track {
  flex: 1;
  height: 4px;
  background: var(--border);
  border-radius: 999px;
  position: relative;
  cursor: pointer;
}
.progress-fill {
  height: 100%;
  border-radius: 999px;
}
.progress-knob {
  position: absolute;
  top: 50%;
  width: 11px;
  height: 11px;
  border-radius: 999px;
  transform: translate(-50%, -50%);
  opacity: 0;
}
.progress-track:hover .progress-knob { opacity: 1; }
.np-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}
.volume-control {
  display: flex;
  align-items: center;
  gap: 8px;
}
.volume-track {
  width: 96px;
  height: 4px;
  border-radius: 999px;
  background: var(--border);
  cursor: pointer;
  overflow: hidden;
}
.volume-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--text);
}
.text-icon-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 9px 14px;
  background: color-mix(in srgb, var(--surface-2) 86%, transparent);
  color: var(--text);
  cursor: pointer;
  font-weight: 800;
}

/* Sheets */
.sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 30;
  background: rgba(0,0,0,.56);
  display: flex;
  align-items: flex-end;
}
.sheet {
  width: 100%;
  max-height: 82vh;
  background: color-mix(in srgb, var(--surface-2) 92%, black);
  border: 1px solid var(--border);
  border-radius: 26px 26px 0 0;
  overflow: hidden;
  backdrop-filter: blur(18px);
  box-shadow: var(--shadow-lift);
}
.sheet-handle {
  width: 40px;
  height: 4px;
  border-radius: 999px;
  background: var(--border);
  margin: 10px auto 0;
}
.sheet-header {
  padding: 14px 18px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.sheet-header h3 {
  margin: 0;
  font-size: 18px;
  letter-spacing: -.03em;
}
.sheet-subtitle {
  margin-top: 4px;
  color: var(--text-dim);
  font-size: 12px;
}
.sheet-body {
  padding: 0 12px 18px;
  overflow: auto;
}
.sheet-body-pad {
  padding: 0 18px 18px;
}
.modal-input {
  width: 100%;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface-3) 82%, transparent);
  color: var(--text);
  border-radius: 16px;
  padding: 13px 14px;
  outline: none;
  margin-bottom: 14px;
}
.modal-input:focus { border-color: color-mix(in srgb, var(--accent) 42%, var(--border)); }
.primary-btn {
  width: 100%;
  border: 0;
  background: var(--accent);
  color: #0B0E10;
  padding: 13px 16px;
  border-radius: 999px;
  font-weight: 900;
  cursor: pointer;
}
.primary-btn:disabled { opacity: .45; cursor: default; }

.add-pl-row, .menu-action {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  border: 0;
  background: transparent;
  color: var(--text);
  text-align: left;
  padding: 12px 12px;
  border-radius: 16px;
  cursor: pointer;
}
.add-pl-row:hover, .menu-action:hover { background: color-mix(in srgb, var(--surface-3) 82%, transparent); }
.add-pl-img {
  width: 38px; height: 38px; border-radius: 12px; object-fit: cover;
}
.menu-action.danger { color: #ff6b6b; }
.menu-action-icon {
  width: 24px; display: grid; place-items: center; color: inherit;
}

/* Settings */
.settings-section {
  padding: 18px 0;
  border-bottom: 1px solid var(--border);
}
.settings-section:last-child { border-bottom: none; }
.settings-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: .02em;
  margin-bottom: 12px;
}
.settings-icon { color: var(--text-dim); display: grid; place-items: center; }
.theme-grid, .settings-actions-grid, .segmented {
  display: grid;
  gap: 8px;
}
.theme-grid { grid-template-columns: repeat(2, 1fr); }
.segmented { grid-template-columns: repeat(3, 1fr); }
.theme-swatch, .action-card, .settings-card, .settings-link-btn, .theme-pill {
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface-3) 82%, transparent);
  border-radius: 18px;
  color: var(--text);
}
.theme-swatch {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 12px;
  cursor: pointer;
  font-weight: 800;
}
.theme-swatch.active { border-color: color-mix(in srgb, var(--accent) 50%, var(--border)); }
.theme-dot {
  width: 16px;
  height: 16px;
  border-radius: 999px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
}
.theme-pill .theme-dot { background: color-mix(in srgb, var(--surface-2) 86%, transparent); color: var(--text); }
.action-card {
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-weight: 800;
}
.action-card:disabled { opacity: .55; cursor: default; }
.settings-card {
  padding: 14px;
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: center;
}
.settings-card-title { font-weight: 900; }
.settings-hint {
  color: var(--text-dim);
  font-size: 12.5px;
  line-height: 1.55;
}
.settings-link-btn {
  border-radius: 999px;
  padding: 10px 14px;
  font-weight: 900;
  cursor: pointer;
}
.settings-link-btn:hover { transform: translateY(-1px); }
.settings-history .history-item { border-radius: 14px; }
.theme-pill { justify-content: space-between; }

.bottom-nav {
  display: none;
}
.mobile-only { display: none; }

/* Full player */
.full-player {
  position: fixed;
  inset: 0;
  z-index: 25;
  padding: 16px 18px 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
  touch-action: pan-y;
}
.full-player-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.full-player-label {
  color: var(--text-dim);
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: .14em;
}
.full-player-art-wrap {
  flex: 1;
  display: grid;
  place-items: center;
  position: relative;
  min-height: 300px;
}
.full-player-glow {
  position: absolute;
  width: 72%;
  height: 72%;
  border-radius: 50%;
  filter: blur(32px);
  opacity: .9;
}
.full-player-art-wrap img, .full-player-art-wrap .cover-art {
  width: min(78vw, 360px);
  aspect-ratio: 1;
  border-radius: 28px;
  box-shadow: var(--shadow-lift);
}
.full-player-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.full-player-titles {
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.full-player-title { font-size: 22px; font-weight: 900; letter-spacing: -.03em; }
.full-player-artist { color: var(--text-dim); font-size: 13px; margin-top: 4px; }
.full-player-progress { margin-top: 2px; }
.full-player-times {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  color: var(--text-dim);
  font-size: 11px;
}
.full-player-controls {
  display: grid;
  grid-template-columns: repeat(5, auto);
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.full-player-bottom-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.volume-control.full { flex: 1; }

@media (max-width: 960px) {
  .sidebar { display: none; }
  .layout { padding: 0; gap: 0; }
  .main-pane { border-radius: 0; }
  .view-pad { padding: 10px 14px 28px; }
  .topbar { padding: 12px 14px; }
  .hero { align-items: start; flex-direction: column; }
  .genre-grid { grid-template-columns: 1fr 1fr; }
  .quick-grid { grid-template-columns: 1fr 1fr; }
  .track-row { grid-template-columns: 28px 40px 1fr auto auto; gap: 10px; }
  .track-row-art { width: 40px; height: 40px; }
  .bottom-nav {
    display: flex;
    height: 58px;
    border-top: 1px solid var(--border);
    background: color-mix(in srgb, var(--surface-2) 90%, transparent);
    backdrop-filter: blur(18px);
  }
  .bottom-nav-item {
    flex: 1;
    border: 0;
    background: transparent;
    color: var(--text-dim);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    font-size: 10px;
    font-weight: 800;
  }
  .bottom-nav-item.active { color: var(--text); }
  .mini-player-row {
    grid-template-columns: 1fr auto;
    height: 66px;
    padding: 0 12px;
  }
  .desktop-only { display: none !important; }
  .mobile-only { display: grid !important; }
  .mini-controls.mobile-only {
    display: grid !important;
    grid-auto-flow: column;
    gap: 10px;
    align-items: center;
  }
  .settings-btn.mobile-only { display: grid !important; }
}
`;

function noop() {}
