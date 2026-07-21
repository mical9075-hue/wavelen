import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Search, Home, Library, Heart, Play, Pause, SkipBack, SkipForward,
  Volume2, Volume1, VolumeX, Repeat, Repeat1, Shuffle, Plus, ListMusic,
  Loader2, Music2, X, ChevronLeft, ChevronDown, Radio, MoreHorizontal, Check,
  Settings, Trash2, Palette, Clock, RefreshCw, Sun, Moon, Monitor,
  FolderUp, HardDrive, ListPlus, ListX, Flame, Sparkles, Mic2, Heart as HeartIcon,
  PartyPopper, CloudMoon, Globe2, Disc3
} from "lucide-react";

/* ------------------------------------------------------------------
  YOUTUBE CONFIG
------------------------------------------------------------------- */
const YT_API_KEY = "AIzaSyDRjilmeoNKlF8IJOw57B-2wEH9O7SWYZY";
const YT_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";

const TRENDING_QUERY_POOL = [
  "Sidhu Moosewala hit songs", "AP Dhillon songs", "Arijit Singh hit songs",
  "Bollywood top songs 2026", "Punjabi hit songs 2026", "Diljit Dosanjh songs",
  "Karan Aujla songs", "trending Punjabi songs this week", "new Bollywood releases 2026",
  "Shubh songs", "top hindi songs 2026",
];

const GENRES = [
  { name: "Punjabi", query: "Punjabi hit songs", color: "#7B61FF", icon: Flame },
  { name: "Bollywood", query: "Bollywood hit songs", color: "#C4F135", icon: Sparkles },
  { name: "Hip Hop", query: "hip hop hit songs", color: "#FF6B6B", icon: Mic2 },
  { name: "Romantic", query: "romantic hindi songs", color: "#3EC6FF", icon: HeartIcon },
  { name: "Party", query: "party songs Punjabi Bollywood", color: "#FF9F43", icon: PartyPopper },
  { name: "Lo-fi", query: "lofi chill songs", color: "#E356A7", icon: CloudMoon },
  { name: "English Pop", query: "english pop hit songs 2026", color: "#4ED9A8", icon: Globe2 },
  { name: "Old Classics", query: "old bollywood classic songs", color: "#B48CFF", icon: Disc3 },
];

const ARTISTS = [
  { name: "Sidhu Moose Wala", query: "Sidhu Moose Wala songs" },
  { name: "AP Dhillon", query: "AP Dhillon songs" },
  { name: "Diljit Dosanjh", query: "Diljit Dosanjh songs" },
  { name: "Karan Aujla", query: "Karan Aujla songs" },
  { name: "Shubh", query: "Shubh songs" },
  { name: "Cheema Y", query: "Cheema Y songs" },
  { name: "Ammy Virk", query: "Ammy Virk songs" },
  { name: "Arijit Singh", query: "Arijit Singh songs" },
  { name: "Badshah", query: "Badshah songs" },
  { name: "Atif Aslam", query: "Atif Aslam songs" },
  { name: "Asim Azhar", query: "Asim Azhar songs" },
  { name: "Young Stunners", query: "Young Stunners songs" },
  { name: "Snoop Dogg", query: "Snoop Dogg songs" },
  { name: "Dr. Dre", query: "Dr Dre songs" },
  { name: "Eminem", query: "Eminem songs" },
];

/* ------------------------------------------------------------------
  THEME SYSTEM
------------------------------------------------------------------- */
const ACCENTS = {
  lime: { name: "Lime", accent: "#C4F135", accent2: "#7B61FF" },
  purple: { name: "Purple", accent: "#B48CFF", accent2: "#FF6B6B" },
  coral: { name: "Coral", accent: "#FF6B6B", accent2: "#3EC6FF" },
  ocean: { name: "Ocean", accent: "#3EC6FF", accent2: "#C4F135" },
  gold: { name: "Gold", accent: "#FF9F43", accent2: "#E356A7" },
  rose: { name: "Rose", accent: "#E356A7", accent2: "#4ED9A8" },
};

const PALETTES = {
  dark: { bg: "#0B0E10", surface: "#141819", surfaceHi: "#1C2123", surfaceHi2: "#262f2c", border: "#24292b", text: "#F2F4F1", textDim: "#9BA3A0", overlay: "rgba(0,0,0,.5)" },
  light: { bg: "#F4F5F3", surface: "#FFFFFF", surfaceHi: "#EFF1EE", surfaceHi2: "#E4E7E2", border: "#DBDED9", text: "#14171A", textDim: "#666E68", overlay: "rgba(0,0,0,.06)" },
};

function resolveMode(mode) {
  if (mode === "system") {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

/* ------------------------------------------------------------------
  LOCAL STORAGE PERSISTENCE
------------------------------------------------------------------- */
const STORAGE_KEYS = {
  liked: "wavelen_liked", playlists: "wavelen_playlists", searchHistory: "wavelen_search_history",
  accent: "wavelen_accent", mode: "wavelen_mode", volume: "wavelen_volume",
};
function loadFromStorage(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; }
}
function saveToStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}

/* ---------------------------- helpers ---------------------------- */
function formatTime(sec) {
  if (!sec && sec !== 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
function decodeEntities(str) {
  if (!str) return str;
  return str.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}
function trackFromYTItem(item) {
  const vid = item.id.videoId;
  const sn = item.snippet;
  return {
    id: vid,
    name: decodeEntities(sn.title.replace(/\(Official.*?\)|\[Official.*?\]/gi, "").trim()),
    artist_name: decodeEntities(sn.channelTitle),
    image: sn.thumbnails?.high?.url || sn.thumbnails?.medium?.url || sn.thumbnails?.default?.url,
    isLocal: false,
  };
}
async function ytSearch(query, maxResults = 25) {
  const url = `${YT_SEARCH_URL}?part=snippet&type=video&videoCategoryId=10&maxResults=${maxResults}&q=${encodeURIComponent(query)}&key=${YT_API_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) { console.error("YouTube API error:", data.error.message); return { error: data.error.message, results: [] }; }
    return { error: null, results: (data.items || []).map(trackFromYTItem) };
  } catch (err) {
    console.error("ytSearch failed:", err);
    return { error: "Network error", results: [] };
  }
}

/* ------------------------------------------------------------------
  QUOTA-SAVING CACHE
  Search costs 100 units per call; caching identical requests locally
  means repeat visits/searches don't re-charge the quota.
------------------------------------------------------------------- */
function cacheGet(key) {
  try {
    const raw = localStorage.getItem("ytcache_" + key);
    if (!raw) return null;
    const { data, expires } = JSON.parse(raw);
    if (Date.now() > expires) { localStorage.removeItem("ytcache_" + key); return null; }
    return data;
  } catch (e) { return null; }
}
function cacheSet(key, data, ttlMs) {
  try { localStorage.setItem("ytcache_" + key, JSON.stringify({ data, expires: Date.now() + ttlMs })); } catch (e) {}
}
async function ytSearchCached(query, maxResults, ttlMs) {
  const key = `search_${query.toLowerCase()}_${maxResults}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  const result = await ytSearch(query, maxResults);
  if (!result.error && result.results.length > 0) cacheSet(key, result, ttlMs);
  return result;
}

/* ------------------------------------------------------------------
  TRENDING CHART — videos.list costs only 1 quota unit vs 100 for
  search.list, and returns YouTube's actual real-time trending music.
------------------------------------------------------------------- */
function trackFromVideosItem(item) {
  const sn = item.snippet;
  return {
    id: item.id,
    name: decodeEntities(sn.title.replace(/\(Official.*?\)|\[Official.*?\]/gi, "").trim()),
    artist_name: decodeEntities(sn.channelTitle),
    image: sn.thumbnails?.high?.url || sn.thumbnails?.medium?.url || sn.thumbnails?.default?.url,
    isLocal: false,
  };
}
async function ytTrendingChart(regionCode = "PK", maxResults = 20) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular&videoCategoryId=10&regionCode=${regionCode}&maxResults=${maxResults}&key=${YT_API_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) return { error: data.error.message, results: [] };
    return { error: null, results: (data.items || []).map(trackFromVideosItem) };
  } catch (err) {
    return { error: "Network error", results: [] };
  }
}

/* ------------------------------------------------------------------
  LOCAL FILE PERSISTENCE (IndexedDB)
  Actual audio blobs are stored here so imported songs survive app
  restarts — required for this to behave like a real app once wrapped
  in Capacitor as an APK. localStorage can't hold binary file data,
  which is why IndexedDB is used instead.
------------------------------------------------------------------- */
const IDB_NAME = "wavelen_db";
const IDB_STORE = "local_tracks";

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbSaveLocalTrack(meta, blob) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put({ ...meta, blob });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
async function idbGetAllLocalTracks() {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
async function idbDeleteLocalTrack(id) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
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

  const [popular, setPopular] = useState([]);
  const [loadingPopular, setLoadingPopular] = useState(true);
  const [popularError, setPopularError] = useState(null);
  const [trendingUpdatedAt, setTrendingUpdatedAt] = useState(null);

  const [playlists, setPlaylists] = useState(() => loadFromStorage(STORAGE_KEYS.playlists, []));
  const [activePlaylist, setActivePlaylist] = useState(null);
  const [likedTracks, setLikedTracks] = useState(() => loadFromStorage(STORAGE_KEYS.liked, []));
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [searchHistory, setSearchHistory] = useState(() => loadFromStorage(STORAGE_KEYS.searchHistory, []));
  const [accentKey, setAccentKey] = useState(() => loadFromStorage(STORAGE_KEYS.accent, "lime"));
  const [themeMode, setThemeMode] = useState(() => loadFromStorage(STORAGE_KEYS.mode, "dark"));
  const [showSettings, setShowSettings] = useState(false);
  const [localTracks, setLocalTracks] = useState([]);
  const [loadingLocalTracks, setLoadingLocalTracks] = useState(true);

  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => loadFromStorage(STORAGE_KEYS.volume, 70));
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState("off");
  const [playerReady, setPlayerReady] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [expandedPlayer, setExpandedPlayer] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(null);
  const [trackMenu, setTrackMenu] = useState(null); // { track, contextPlaylistId }

  const ytPlayerRef = useRef(null);
  const localAudioRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const fileInputRef = useRef(null);
  const currentTrack = queue[currentIndex] || null;

  /* ---------- YouTube IFrame API ---------- */
  useEffect(() => {
    if (window.YT && window.YT.Player) { initPlayer(); return; }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);
    window.onYouTubeIframeAPIReady = initPlayer;
    function initPlayer() {
      ytPlayerRef.current = new window.YT.Player("yt-player-hidden", {
        height: "0", width: "0",
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, modestbranding: 1, playsinline: 1 },
        events: { onReady: () => setPlayerReady(true), onStateChange: (e) => onStateRef.current(e) },
      });
    }
    // eslint-disable-next-line
  }, []);

  const onPlayerStateChange = (e) => {
    if (currentTrack?.isLocal) return;
    if (e.data === 0) handleTrackEndRef.current?.();
    if (e.data === 1) { setIsPlaying(true); setBuffering(false); }
    if (e.data === 2) setIsPlaying(false);
    if (e.data === 3) setBuffering(true);
  };
  const onStateRef = useRef(onPlayerStateChange);
  useEffect(() => { onStateRef.current = onPlayerStateChange; });

  /* ---------- local <audio> element events ---------- */
  useEffect(() => {
    const audio = localAudioRef.current;
    if (!audio) return;
    const onPlay = () => { setIsPlaying(true); setBuffering(false); };
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setBuffering(true);
    const onCanPlay = () => setBuffering(false);
    const onLoaded = () => setDuration(audio.duration || 0);
    const onEnded = () => handleTrackEndRef.current?.();
    const onTime = () => setProgress(audio.currentTime);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("timeupdate", onTime);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("timeupdate", onTime);
    };
  }, []);

  /* ---------- fetch trending — uses videos.list chart (1 quota unit vs 100 for search) ---------- */
  const fetchTrending = useCallback(() => {
    setLoadingPopular(true);
    setPopularError(null);
    ytTrendingChart("PK", 20).then(({ error, results }) => {
      if (!error && results.length > 0) {
        setPopular(results);
        setLoadingPopular(false);
        setTrendingUpdatedAt(Date.now());
        return;
      }
      // fallback: cached search-based trending if the chart endpoint is unavailable
      const q = TRENDING_QUERY_POOL[Math.floor(Math.random() * TRENDING_QUERY_POOL.length)];
      ytSearchCached(q, 20, 30 * 60 * 1000).then(({ error: e2, results: r2 }) => {
        if (e2) setPopularError(e2);
        setPopular(r2);
        setLoadingPopular(false);
        setTrendingUpdatedAt(Date.now());
      });
    });
  }, []);

  /* ---------- load persisted local files from IndexedDB on startup ---------- */
  useEffect(() => {
    idbGetAllLocalTracks().then(records => {
      const tracks = records.map(r => ({
        id: r.id, name: r.name, artist_name: r.artist_name, image: null,
        audio: URL.createObjectURL(r.blob), isLocal: true,
      }));
      setLocalTracks(tracks);
      setLoadingLocalTracks(false);
    }).catch(() => setLoadingLocalTracks(false));
  }, []);

  /* ---------- initial content load ---------- */
  useEffect(() => {
    fetchTrending();
    const dayTTL = 24 * 60 * 60 * 1000;
    Promise.all([
      ytSearchCached("Sidhu Moosewala all songs", 12, dayTTL),
      ytSearchCached("Arijit Singh romantic songs", 12, dayTTL),
      ytSearchCached("Punjabi party songs", 12, dayTTL),
    ]).then(([a, b, c]) => {
      const built = [
        { id: "pl-sidhu", name: "Sidhu Moosewala Mix", image: a.results[0]?.image, tracks: a.results, system: true },
        { id: "pl-arijit", name: "Arijit Singh Romantic", image: b.results[0]?.image, tracks: b.results, system: true },
        { id: "pl-party", name: "Punjabi Party", image: c.results[0]?.image, tracks: c.results, system: true },
      ].filter(p => p.tracks.length > 0);
      setPlaylists(prev => [...built, ...prev.filter(p => !p.system)]);
    });
    // eslint-disable-next-line
  }, []);

  /* ---------- search debounce (cached 2h — retyping the same thing costs nothing) ---------- */
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) { setSearchResults([]); setSearchError(null); return; }
    setSearching(true);
    const t = setTimeout(() => {
      ytSearchCached(query.trim(), 25, 2 * 60 * 60 * 1000).then(({ error, results }) => {
        setSearchError(error);
        setSearchResults(results);
        setSearching(false);
        if (!error && results.length > 0) {
          setSearchHistory(prev => {
            const cleaned = prev.filter(q => q.toLowerCase() !== query.trim().toLowerCase());
            return [query.trim(), ...cleaned].slice(0, 10);
          });
        }
      });
    }, 550);
    return () => clearTimeout(t);
  }, [query]);

  /* ---------- persistence ---------- */
  useEffect(() => { saveToStorage(STORAGE_KEYS.liked, likedTracks); }, [likedTracks]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.playlists, playlists.filter(p => !p.system)); }, [playlists]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.searchHistory, searchHistory); }, [searchHistory]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.accent, accentKey); }, [accentKey]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.mode, themeMode); }, [themeMode]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.volume, volume); }, [volume]);

  /* ---------- apply theme (mode + accent) as CSS variables ---------- */
  useEffect(() => {
    const applyTheme = () => {
      const resolved = resolveMode(themeMode);
      const pal = PALETTES[resolved];
      const acc = ACCENTS[accentKey] || ACCENTS.lime;
      const root = document.documentElement.style;
      root.setProperty("--bg", pal.bg);
      root.setProperty("--surface", pal.surface);
      root.setProperty("--surface-hi", pal.surfaceHi);
      root.setProperty("--surface-hi-2", pal.surfaceHi2);
      root.setProperty("--border", pal.border);
      root.setProperty("--text", pal.text);
      root.setProperty("--text-dim", pal.textDim);
      root.setProperty("--overlay", pal.overlay);
      root.setProperty("--accent", acc.accent);
      root.setProperty("--accent-2", acc.accent2);
      root.setProperty("--accent-contrast", "#0B0E10");
    };
    applyTheme();
    if (themeMode === "system" && window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = () => applyTheme();
      mq.addEventListener?.("change", listener);
      return () => mq.removeEventListener?.("change", listener);
    }
  }, [themeMode, accentKey]);

  /* ---------- play current track (branches YT vs local) ---------- */
  useEffect(() => {
    if (!currentTrack) return;
    setProgress(0); setDuration(0); setBuffering(true);

    if (currentTrack.isLocal) {
      try { ytPlayerRef.current?.pauseVideo?.(); } catch (e) {}
      const audio = localAudioRef.current;
      if (audio) {
        audio.src = currentTrack.audio;
        audio.volume = volume / 100;
        audio.play().catch(() => {});
      }
    } else {
      if (!playerReady || !ytPlayerRef.current) return;
      try { localAudioRef.current?.pause(); } catch (e) {}
      ytPlayerRef.current.loadVideoById(currentTrack.id);
      ytPlayerRef.current.setVolume(volume);
      const durCheck = setInterval(() => {
        try { const d = ytPlayerRef.current.getDuration(); if (d > 0) { setDuration(d); clearInterval(durCheck); } } catch (e) {}
      }, 300);
      return () => clearInterval(durCheck);
    }
    // eslint-disable-next-line
  }, [currentIndex, queue, playerReady]);

  /* ---------- progress polling for YT (local uses its own timeupdate event) ---------- */
  useEffect(() => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = setInterval(() => {
      if (currentTrack?.isLocal) return;
      if (ytPlayerRef.current && isPlaying && ytPlayerRef.current.getCurrentTime) {
        try { setProgress(ytPlayerRef.current.getCurrentTime()); } catch (e) {}
      }
    }, 500);
    return () => clearInterval(progressIntervalRef.current);
  }, [isPlaying, currentTrack]);

  useEffect(() => {
    if (localAudioRef.current) localAudioRef.current.volume = volume / 100;
    if (ytPlayerRef.current?.setVolume) { try { ytPlayerRef.current.setVolume(volume); } catch (e) {} }
  }, [volume]);

  const playTrackList = useCallback((list, index) => {
    setQueue(list);
    setCurrentIndex(index);
    setIsPlaying(true);
  }, []);

  const togglePlay = () => {
    if (!currentTrack) return;
    if (currentTrack.isLocal) {
      const audio = localAudioRef.current;
      if (!audio) return;
      if (isPlaying) audio.pause(); else audio.play().catch(() => {});
    } else {
      if (!ytPlayerRef.current) return;
      if (isPlaying) ytPlayerRef.current.pauseVideo(); else ytPlayerRef.current.playVideo();
    }
  };

  const handleNext = useCallback(() => {
    if (!queue.length) return;
    let next;
    if (shuffle) next = Math.floor(Math.random() * queue.length);
    else next = (currentIndex + 1) % queue.length;
    setCurrentIndex(next);
    setIsPlaying(true);
  }, [queue, currentIndex, shuffle]);

  const handleTrackEnd = useCallback(() => {
    if (repeat === "one") {
      if (currentTrack?.isLocal) { localAudioRef.current.currentTime = 0; localAudioRef.current.play(); }
      else { ytPlayerRef.current?.seekTo(0); ytPlayerRef.current?.playVideo(); }
      return;
    }
    if (repeat === "off" && !shuffle && currentIndex === queue.length - 1) { setIsPlaying(false); return; }
    handleNext();
  }, [repeat, shuffle, currentIndex, queue.length, handleNext, currentTrack]);
  const handleTrackEndRef = useRef(handleTrackEnd);
  useEffect(() => { handleTrackEndRef.current = handleTrackEnd; }, [handleTrackEnd]);

  const handlePrev = () => {
    if (!queue.length) return;
    if (progress > 3) {
      if (currentTrack?.isLocal) localAudioRef.current.currentTime = 0;
      else ytPlayerRef.current?.seekTo(0);
      setProgress(0);
      return;
    }
    const prev = (currentIndex - 1 + queue.length) % queue.length;
    setCurrentIndex(prev);
    setIsPlaying(true);
  };

  const playFromQueue = (index) => { setCurrentIndex(index); setIsPlaying(true); };

  const seek = (e) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const t = pct * duration;
    if (currentTrack?.isLocal) { localAudioRef.current.currentTime = t; }
    else { ytPlayerRef.current?.seekTo(t, true); }
    setProgress(t);
  };

  const cycleRepeat = () => setRepeat(r => r === "off" ? "all" : r === "all" ? "one" : "off");

  const toggleLike = (track) => {
    setLikedTracks(prev => {
      const exists = prev.find(t => t.id === track.id);
      if (exists) return prev.filter(t => t.id !== track.id);
      return [track, ...prev];
    });
  };
  const isLiked = (track) => likedTracks.some(t => t.id === track?.id);

  const addToQueue = (track) => {
    setQueue(prev => {
      if (prev.length === 0) { setCurrentIndex(0); setIsPlaying(true); return [track]; }
      return [...prev, track];
    });
  };

  const createPlaylist = (name) => {
    const newPl = { id: `pl-${Date.now()}`, name, image: null, tracks: [], system: false };
    setPlaylists(prev => [...prev, newPl]);
    setShowCreatePlaylist(false);
  };
  const addToPlaylist = (playlistId, track) => {
    setPlaylists(prev => prev.map(pl => {
      if (pl.id !== playlistId) return pl;
      if (pl.tracks.some(t => t.id === track.id)) return pl;
      const newTracks = [...pl.tracks, track];
      return { ...pl, tracks: newTracks, image: pl.image || track.image };
    }));
    setShowAddToPlaylist(null);
  };
  const removeFromPlaylist = (playlistId, trackId) => {
    setPlaylists(prev => prev.map(pl => {
      if (pl.id !== playlistId) return pl;
      const newTracks = pl.tracks.filter(t => t.id !== trackId);
      return { ...pl, tracks: newTracks, image: newTracks[0]?.image || null };
    }));
  };
  const deletePlaylist = (playlistId) => setPlaylists(prev => prev.filter(pl => pl.id !== playlistId));

  const navigateTo = useCallback((nextView) => {
    setView(prev => { if (prev === nextView) return prev; setViewHistory(h => [...h, nextView]); return nextView; });
  }, []);
  const goBack = useCallback(() => {
    setViewHistory(h => { if (h.length <= 1) return h; const nh = h.slice(0, -1); setView(nh[nh.length - 1]); return nh; });
  }, []);
  const canGoBack = viewHistory.length > 1;

  const openGenre = useCallback((genre) => {
    setActiveGenre(genre);
    setSearching(true);
    navigateTo("genre");
    ytSearchCached(genre.query, 25, 24 * 60 * 60 * 1000).then(({ error, results }) => {
      setSearchError(error); setSearchResults(results); setSearching(false);
    });
  }, [navigateTo]);

  /* ---------- local file import ---------- */
  const handleFilesSelected = (e) => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith("audio/"));
    if (!files.length) return;
    files.forEach((f, i) => {
      const meta = { id: `local-${Date.now()}-${i}`, name: f.name.replace(/\.[^/.]+$/, ""), artist_name: "On this device" };
      idbSaveLocalTrack(meta, f).then(() => {
        setLocalTracks(prev => [...prev, { ...meta, image: null, audio: URL.createObjectURL(f), isLocal: true }]);
      });
    });
    e.target.value = "";
  };

  const removeLocalTrack = (id) => {
    idbDeleteLocalTrack(id).then(() => {
      setLocalTracks(prev => prev.filter(t => t.id !== id));
    });
  };

  const accentGradient = ACCENTS[accentKey]?.accent || "#C4F135";

  return (
    <div className="app-shell">
      <style>{STYLES}</style>
      <div id="yt-player-hidden" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} />
      <audio ref={localAudioRef} style={{ display: "none" }} />
      <input ref={fileInputRef} type="file" accept="audio/*" multiple style={{ display: "none" }} onChange={handleFilesSelected} />
      <div className="ambient-glow" style={{ background: `radial-gradient(circle at 20% 0%, ${accentGradient}22, transparent 60%)` }} />

      <div className="layout">
        <Sidebar view={view} navigateTo={navigateTo} playlists={playlists} activePlaylist={activePlaylist}
          setActivePlaylist={setActivePlaylist} likedCount={likedTracks.length}
          onCreatePlaylist={() => setShowCreatePlaylist(true)} onOpenSettings={() => setShowSettings(true)} />

        <main className="main-pane">
          <TopBar query={query} setQuery={setQuery} navigateTo={navigateTo} goBack={goBack} canGoBack={canGoBack}
            onOpenSettings={() => setShowSettings(true)} searchHistory={searchHistory}
            onSelectHistory={(q) => { setQuery(q); navigateTo("search"); }} view={view} />

          <div className="content-scroll">
            {view === "home" && (
              <HomeView popular={popular} loading={loadingPopular} error={popularError} playlists={playlists}
                onPlay={playTrackList} onOpenPlaylist={(pl) => { setActivePlaylist(pl); navigateTo("playlist"); }}
                currentTrack={currentTrack} isPlaying={isPlaying} toggleLike={toggleLike} isLiked={isLiked}
                onOpenMenu={(t) => setTrackMenu({ track: t })} onRefresh={fetchTrending}
                updatedAt={trendingUpdatedAt} onOpenArtist={(artist) => openGenre({ name: artist.name, query: artist.query })} />
            )}
            {view === "search" && (
              <SearchView query={query} results={searchResults} searching={searching} error={searchError}
                onPlay={playTrackList} currentTrack={currentTrack} isPlaying={isPlaying}
                toggleLike={toggleLike} isLiked={isLiked} onOpenGenre={openGenre}
                onOpenMenu={(t) => setTrackMenu({ track: t })} />
            )}
            {view === "genre" && (
              <GenreResultsView genre={activeGenre} results={searchResults} searching={searching} error={searchError}
                onPlay={playTrackList} currentTrack={currentTrack} isPlaying={isPlaying}
                toggleLike={toggleLike} isLiked={isLiked} onOpenMenu={(t) => setTrackMenu({ track: t })} />
            )}
            {view === "library" && (
              <LibraryView liked={likedTracks} playlists={playlists} localTracks={localTracks} onPlay={playTrackList}
                currentTrack={currentTrack} isPlaying={isPlaying} toggleLike={toggleLike} isLiked={isLiked}
                onOpenPlaylist={(pl) => { setActivePlaylist(pl); navigateTo("playlist"); }}
                onOpenMenu={(t) => setTrackMenu({ track: t })} onCreatePlaylist={() => setShowCreatePlaylist(true)}
                onImportFiles={() => fileInputRef.current?.click()} />
            )}
            {view === "playlist" && activePlaylist && (
              <PlaylistView playlist={playlists.find(p => p.id === activePlaylist.id) || activePlaylist} onBack={goBack} onPlay={playTrackList}
                currentTrack={currentTrack} isPlaying={isPlaying} toggleLike={toggleLike} isLiked={isLiked}
                onOpenMenu={(t, pl) => setTrackMenu({ track: t, contextPlaylistId: pl.system ? null : pl.id })}
                onDeletePlaylist={(id) => { deletePlaylist(id); goBack(); }} />
            )}
          </div>
        </main>
      </div>

      <MiniPlayer track={currentTrack} isPlaying={isPlaying} togglePlay={togglePlay} onNext={handleNext} onPrev={handlePrev}
        progress={progress} duration={duration} seek={seek} volume={volume} setVolume={setVolume}
        shuffle={shuffle} setShuffle={setShuffle} repeat={repeat} cycleRepeat={cycleRepeat}
        toggleLike={toggleLike} isLiked={isLiked} buffering={buffering} accentGradient={accentGradient}
        onExpand={() => setExpandedPlayer(true)} />

      <BottomNav view={view} navigateTo={navigateTo} hasTrack={!!currentTrack} />

      {expandedPlayer && currentTrack && (
        <FullPlayerSheet track={currentTrack} isPlaying={isPlaying} togglePlay={togglePlay} onNext={handleNext} onPrev={handlePrev}
          progress={progress} duration={duration} seek={seek} volume={volume} setVolume={setVolume}
          shuffle={shuffle} setShuffle={setShuffle} repeat={repeat} cycleRepeat={cycleRepeat}
          toggleLike={toggleLike} isLiked={isLiked} buffering={buffering} accentGradient={accentGradient}
          onClose={() => setExpandedPlayer(false)} onShowQueue={() => setShowQueue(true)}
          onOpenMenu={(t) => setTrackMenu({ track: t })} />
      )}

      {showQueue && <QueueSheet queue={queue} currentIndex={currentIndex} onPlayFromQueue={playFromQueue} onClose={() => setShowQueue(false)} />}
      {showCreatePlaylist && <CreatePlaylistModal onCreate={createPlaylist} onClose={() => setShowCreatePlaylist(false)} />}
      {showAddToPlaylist && (
        <AddToPlaylistModal track={showAddToPlaylist} playlists={playlists.filter(p => !p.system)}
          onAdd={addToPlaylist} onClose={() => setShowAddToPlaylist(null)}
          onCreateNew={() => { setShowAddToPlaylist(null); setShowCreatePlaylist(true); }} />
      )}
      {trackMenu && (
        <TrackOptionsSheet track={trackMenu.track} isLiked={isLiked(trackMenu.track)} toggleLike={() => toggleLike(trackMenu.track)}
          onAddToQueue={() => { addToQueue(trackMenu.track); setTrackMenu(null); }}
          onAddToPlaylist={() => { setShowAddToPlaylist(trackMenu.track); setTrackMenu(null); }}
          contextPlaylistId={trackMenu.contextPlaylistId}
          onRemoveFromPlaylist={() => { removeFromPlaylist(trackMenu.contextPlaylistId, trackMenu.track.id); setTrackMenu(null); }}
          onRemoveLocal={() => { removeLocalTrack(trackMenu.track.id); setTrackMenu(null); }}
          onClose={() => setTrackMenu(null)} />
      )}
      {showSettings && (
        <SettingsModal accentKey={accentKey} setAccentKey={setAccentKey} themeMode={themeMode} setThemeMode={setThemeMode}
          searchHistory={searchHistory} onClearHistory={() => setSearchHistory([])}
          onSelectHistory={(q) => { setQuery(q); navigateTo("search"); setShowSettings(false); }}
          likedCount={likedTracks.length} onOpenLiked={() => { navigateTo("library"); setShowSettings(false); }}
          localCount={localTracks.length} onImportFiles={() => fileInputRef.current?.click()}
          onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}

/* ============================================================================
   SIDEBAR (desktop)
============================================================================ */
function Sidebar({ view, navigateTo, playlists, activePlaylist, setActivePlaylist, likedCount, onCreatePlaylist, onOpenSettings }) {
  return (
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Music2 size={22} /></div><span>Wavelen</span></div>
      <nav className="nav-group">
        <button className={`nav-item ${view === "home" ? "active" : ""}`} onClick={() => navigateTo("home")}><Home size={19} /><span>Home</span></button>
        <button className={`nav-item ${view === "search" ? "active" : ""}`} onClick={() => navigateTo("search")}><Search size={19} /><span>Search</span></button>
        <button className={`nav-item ${view === "library" ? "active" : ""}`} onClick={() => navigateTo("library")}><Library size={19} /><span>Your Library</span></button>
      </nav>
      <div className="sidebar-divider" />
      <div className="playlist-block">
        <button className="nav-item" onClick={onCreatePlaylist}><div className="mini-icon"><Plus size={15} /></div><span>Create Playlist</span></button>
        <button className={`nav-item ${view === "library" ? "active" : ""}`} onClick={() => navigateTo("library")}>
          <div className="mini-icon liked"><Heart size={13} fill="currentColor" /></div><span>Liked Songs</span>
          {likedCount > 0 && <span className="count-pill">{likedCount}</span>}
        </button>
      </div>
      <div className="sidebar-divider" />
      <div className="playlist-list">
        {playlists.map(pl => (
          <button key={pl.id} className={`playlist-row ${activePlaylist?.id === pl.id && view === "playlist" ? "active" : ""}`}
            onClick={() => { setActivePlaylist(pl); navigateTo("playlist"); }}>
            {pl.image ? <img src={pl.image} alt="" /> : <div className="playlist-row-placeholder"><Music2 size={16} /></div>}
            <div className="playlist-row-text"><span className="pl-name">{pl.name}</span><span className="pl-sub">Playlist · {pl.tracks.length} songs</span></div>
          </button>
        ))}
      </div>
      <div className="sidebar-divider" />
      <button className="nav-item" onClick={onOpenSettings}><Settings size={19} /><span>Settings</span></button>
    </aside>
  );
}

/* ============================================================================
   BOTTOM NAV (mobile)
============================================================================ */
function BottomNav({ view, navigateTo, hasTrack }) {
  const items = [{ key: "home", label: "Home", icon: Home }, { key: "search", label: "Search", icon: Search }, { key: "library", label: "Library", icon: Library }];
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

/* ============================================================================
   TOP BAR (with search history dropdown)
============================================================================ */
function TopBar({ query, setQuery, navigateTo, goBack, canGoBack, onOpenSettings, searchHistory, onSelectHistory, view }) {
  const [showHistory, setShowHistory] = useState(false);
  const blurTimeout = useRef(null);

  useEffect(() => { if (view !== "search") setShowHistory(false); }, [view]);

  const handleFocus = () => {
    if (!query.trim() && searchHistory.length > 0) setShowHistory(true);
    if (query) navigateTo("search");
  };
  const handleBlur = () => { blurTimeout.current = setTimeout(() => setShowHistory(false), 150); };
  const handleChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    navigateTo("search");
    setShowHistory(!v.trim() && searchHistory.length > 0);
  };
  const pickHistory = (q) => { clearTimeout(blurTimeout.current); setShowHistory(false); onSelectHistory(q); };

  return (
    <div className="topbar">
      <div className="topbar-nav">
        <button className="round-btn" onClick={() => { setShowHistory(false); goBack(); }} disabled={!canGoBack}><ChevronLeft size={18} /></button>
      </div>
      <div className="search-box-wrap">
        <div className="search-box">
          <Search size={17} className="search-icon" />
          <input placeholder="What do you want to play?" value={query} onChange={handleChange} onFocus={handleFocus} onBlur={handleBlur} />
          {query && <button className="clear-btn" onClick={() => setQuery("")}><X size={15} /></button>}
        </div>
        {showHistory && (
          <div className="history-dropdown">
            <div className="history-dropdown-title">Recent searches</div>
            {searchHistory.map((q, i) => (
              <button key={i} className="history-item" onMouseDown={(e) => e.preventDefault()} onClick={() => pickHistory(q)}>
                <Clock size={14} /> <span>{q}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <button className="settings-btn mobile-only" onClick={onOpenSettings} aria-label="Settings"><Settings size={18} /></button>
    </div>
  );
}

/* ============================================================================
   TRACK ROW
============================================================================ */
function TrackRow({ track, index, list, onPlay, isActive, isPlaying, isLiked, toggleLike, onOpenMenu }) {
  return (
    <div className={`track-row ${isActive ? "active" : ""}`} onClick={() => onPlay(list, index)}>
      <div className="track-row-index">
        {isActive && isPlaying ? (
          <div className="playing-bars"><span /><span /><span /></div>
        ) : isActive ? <Pause size={14} /> : (
          <><span className="idx-number">{index + 1}</span><Play size={14} className="idx-play" /></>
        )}
      </div>
      {track.image ? <img src={track.image} alt="" className="track-row-art" /> : <div className="track-row-art local-icon"><Music2 size={16} /></div>}
      <div className="track-row-meta">
        <span className="track-row-title">{track.name}</span>
        <span className="track-row-artist">{track.artist_name}</span>
      </div>
      <button className={`heart-btn ${isLiked(track) ? "liked" : ""}`} onClick={(e) => { e.stopPropagation(); toggleLike(track); }}>
        <Heart size={16} fill={isLiked(track) ? "currentColor" : "none"} />
      </button>
      <button className="more-btn" onClick={(e) => { e.stopPropagation(); onOpenMenu(track); }}><MoreHorizontal size={18} /></button>
    </div>
  );
}

/* ============================================================================
   HOME VIEW
============================================================================ */
function HomeView({ popular, loading, error, playlists, onPlay, onOpenPlaylist, currentTrack, isPlaying, toggleLike, isLiked, onOpenMenu, onRefresh, updatedAt, onOpenArtist }) {
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, []);
  const updatedLabel = useMemo(() => {
    if (!updatedAt) return "";
    const mins = Math.floor((Date.now() - updatedAt) / 60000);
    if (mins < 1) return "Updated just now";
    if (mins === 1) return "Updated 1 min ago";
    return `Updated ${mins} min ago`;
  }, [updatedAt]);

  return (
    <div className="view-pad">
      <h1 className="page-title">{greeting}</h1>

      {playlists.length > 0 && (
        <div className="quick-grid">
          {playlists.map(pl => (
            <button key={pl.id} className="quick-card" onClick={() => onOpenPlaylist(pl)}>
              {pl.image ? <img src={pl.image} alt="" /> : <div className="quick-card-placeholder"><Music2 size={18} /></div>}
              <span>{pl.name}</span>
              <div className="quick-play"><Play size={16} fill="var(--accent-contrast)" /></div>
            </button>
          ))}
        </div>
      )}

      <div className="section-header"><h2>Popular Artists</h2></div>
      <ArtistsRow onOpenArtist={onOpenArtist} />

      <div className="section-header">
        <h2>Trending now</h2>
        <div className="trending-refresh-wrap">
          {updatedLabel && <span className="settings-hint">{updatedLabel}</span>}
          <button className="icon-btn" onClick={onRefresh} title="Refresh trending"><RefreshCw size={15} /></button>
        </div>
      </div>

      {loading ? (
        <div className="loading-row"><Loader2 className="spin" size={22} /> Loading songs…</div>
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <div className="card-grid">
          {popular.slice(0, 12).map((t, i) => (
            <div key={t.id} className="track-card" onClick={() => onPlay(popular, i)}>
              <div className="track-card-art-wrap">
                <img src={t.image} alt="" />
                <div className="track-card-play"><Play size={18} fill="var(--accent-contrast)" /></div>
              </div>
              <span className="track-card-title">{t.name}</span>
              <span className="track-card-artist">{t.artist_name}</span>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="section-header"><h2>Made for you</h2></div>
          <div className="track-list">
            {popular.slice(0, 10).map((t, i) => (
              <TrackRow key={t.id} track={t} index={i} list={popular} onPlay={onPlay}
                isActive={currentTrack?.id === t.id} isPlaying={isPlaying} isLiked={isLiked} toggleLike={toggleLike} onOpenMenu={onOpenMenu} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================================================
   SEARCH VIEW (genre cards with lazy-loaded background images)
============================================================================ */
/* ============================================================================
   ARTISTS ROW (Home page — lazy-loaded thumbnails, cached 7 days to save quota)
============================================================================ */
function ArtistsRow({ onOpenArtist }) {
  const [images, setImages] = useState({});

  useEffect(() => {
    ARTISTS.forEach(a => {
      const cacheKey = `artist_img_${a.name.toLowerCase()}`;
      const cached = cacheGet(cacheKey);
      if (cached) { setImages(prev => ({ ...prev, [a.name]: cached })); return; }
      ytSearchCached(`${a.query} official`, 1, 7 * 24 * 60 * 60 * 1000).then(({ results }) => {
        if (results[0]?.image) {
          cacheSet(cacheKey, results[0].image, 7 * 24 * 60 * 60 * 1000);
          setImages(prev => ({ ...prev, [a.name]: results[0].image }));
        }
      });
    });
  }, []);

  return (
    <div className="artists-scroll">
      {ARTISTS.map(a => (
        <button key={a.name} className="artist-card" onClick={() => onOpenArtist(a)}>
          {images[a.name] ? <img src={images[a.name]} alt="" /> : <div className="artist-card-placeholder"><Music2 size={20} /></div>}
          <span>{a.name}</span>
        </button>
      ))}
    </div>
  );
}

function SearchView({ query, results, searching, error, onPlay, currentTrack, isPlaying, toggleLike, isLiked, onOpenGenre, onOpenMenu }) {
  if (!query.trim()) {
    return (
      <div className="view-pad">
        <h1 className="page-title">Browse all</h1>
        <div className="genre-grid">
          {GENRES.map((g) => {
            const Icon = g.icon;
            return (
              <button key={g.name} className="genre-card" style={{ background: `linear-gradient(135deg, ${g.color}, ${g.color}cc)` }} onClick={() => onOpenGenre(g)}>
                <span className="genre-card-label">{g.name}</span>
                <Icon size={46} className="genre-card-icon" strokeWidth={1.6} />
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  return (
    <div className="view-pad">
      <h1 className="page-title">Results for "{query}"</h1>
      {searching ? (
        <div className="loading-row"><Loader2 className="spin" size={22} /> Searching…</div>
      ) : error ? (
        <ErrorState message={error} />
      ) : results.length === 0 ? (
        <div className="empty-state"><Radio size={38} /><p>No songs found for "{query}"</p><span>Try a different search term.</span></div>
      ) : (
        <div className="track-list">
          {results.map((t, i) => (
            <TrackRow key={t.id} track={t} index={i} list={results} onPlay={onPlay}
              isActive={currentTrack?.id === t.id} isPlaying={isPlaying} isLiked={isLiked} toggleLike={toggleLike} onOpenMenu={onOpenMenu} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   GENRE RESULTS VIEW
============================================================================ */
function GenreResultsView({ genre, results, searching, error, onPlay, currentTrack, isPlaying, toggleLike, isLiked, onOpenMenu }) {
  return (
    <div className="view-pad">
      <h1 className="page-title">{genre?.name}</h1>
      {searching ? (
        <div className="loading-row"><Loader2 className="spin" size={22} /> Loading {genre?.name} songs…</div>
      ) : error ? (
        <ErrorState message={error} />
      ) : results.length === 0 ? (
        <div className="empty-state"><Radio size={38} /><p>No songs found</p><span>Try a different genre.</span></div>
      ) : (
        <div className="track-list">
          {results.map((t, i) => (
            <TrackRow key={t.id} track={t} index={i} list={results} onPlay={onPlay}
              isActive={currentTrack?.id === t.id} isPlaying={isPlaying} isLiked={isLiked} toggleLike={toggleLike} onOpenMenu={onOpenMenu} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   LIBRARY VIEW
============================================================================ */
function LibraryView({ liked, playlists, localTracks, onPlay, currentTrack, isPlaying, toggleLike, isLiked, onOpenPlaylist, onOpenMenu, onCreatePlaylist, onImportFiles }) {
  return (
    <div className="view-pad">
      <h1 className="page-title">Your Library</h1>

      <div className="section-header"><h2>Playlists</h2><button className="text-btn" onClick={onCreatePlaylist}><Plus size={15} /> New</button></div>
      <div className="quick-grid" style={{ marginBottom: 30 }}>
        {playlists.map(pl => (
          <button key={pl.id} className="quick-card" onClick={() => onOpenPlaylist(pl)}>
            {pl.image ? <img src={pl.image} alt="" /> : <div className="quick-card-placeholder"><Music2 size={18} /></div>}
            <span>{pl.name}</span>
            <div className="quick-play"><Play size={16} fill="var(--accent-contrast)" /></div>
          </button>
        ))}
      </div>

      <div className="section-header"><h2>On this device</h2><button className="text-btn" onClick={onImportFiles}><FolderUp size={15} /> Import</button></div>
      {localTracks.length === 0 ? (
        <div className="empty-state small"><HardDrive size={30} /><p>No local songs added</p><span>Tap Import to add audio files from your device.</span></div>
      ) : (
        <div className="track-list" style={{ marginBottom: 20 }}>
          {localTracks.map((t, i) => (
            <TrackRow key={t.id} track={t} index={i} list={localTracks} onPlay={onPlay}
              isActive={currentTrack?.id === t.id} isPlaying={isPlaying} isLiked={isLiked} toggleLike={toggleLike} onOpenMenu={onOpenMenu} />
          ))}
        </div>
      )}

      <div className="section-header"><h2>Liked Songs</h2></div>
      {liked.length === 0 ? (
        <div className="empty-state"><Heart size={38} /><p>Songs you like will appear here</p><span>Tap ⋯ on any song and hit the heart to save it.</span></div>
      ) : (
        <div className="track-list">
          {liked.map((t, i) => (
            <TrackRow key={t.id} track={t} index={i} list={liked} onPlay={onPlay}
              isActive={currentTrack?.id === t.id} isPlaying={isPlaying} isLiked={isLiked} toggleLike={toggleLike} onOpenMenu={onOpenMenu} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   PLAYLIST VIEW
============================================================================ */
function PlaylistView({ playlist, onBack, onPlay, currentTrack, isPlaying, toggleLike, isLiked, onOpenMenu, onDeletePlaylist }) {
  return (
    <div className="view-pad">
      <div className="playlist-hero">
        {playlist.image ? <img src={playlist.image} alt="" /> : <div className="playlist-hero-placeholder"><Music2 size={40} /></div>}
        <div className="playlist-hero-text">
          <span className="eyebrow">Playlist</span>
          <h1>{playlist.name}</h1>
          <span className="pl-hero-sub">{playlist.tracks.length} songs</span>
        </div>
      </div>
      <div className="playlist-actions">
        {playlist.tracks.length > 0 && <button className="play-fab" onClick={() => onPlay(playlist.tracks, 0)}><Play size={20} fill="var(--accent-contrast)" /></button>}
        {!playlist.system && <button className="text-btn danger" onClick={() => onDeletePlaylist(playlist.id)}><Trash2 size={14} /> Delete playlist</button>}
      </div>
      {playlist.tracks.length === 0 ? (
        <div className="empty-state"><Music2 size={38} /><p>This playlist is empty</p><span>Tap ⋯ on any song to add it here.</span></div>
      ) : (
        <div className="track-list">
          {playlist.tracks.map((t, i) => (
            <TrackRow key={t.id} track={t} index={i} list={playlist.tracks} onPlay={onPlay}
              isActive={currentTrack?.id === t.id} isPlaying={isPlaying} isLiked={isLiked} toggleLike={toggleLike}
              onOpenMenu={(track) => onOpenMenu(track, playlist)} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   ERROR STATE
============================================================================ */
function ErrorState({ message }) {
  const isQuota = message && /quota/i.test(message);
  return (
    <div className="empty-state">
      <Radio size={38} />
      <p>{isQuota ? "Daily search limit reached" : "Couldn't load songs"}</p>
      <span>{isQuota ? "YouTube's free API limit resets in a few hours. Try again later." : message}</span>
    </div>
  );
}

/* ============================================================================
   MINI PLAYER
============================================================================ */
function MiniPlayer({ track, isPlaying, togglePlay, onNext, onPrev, progress, duration, seek, volume, setVolume,
  shuffle, setShuffle, repeat, cycleRepeat, toggleLike, isLiked, buffering, accentGradient, onExpand }) {
  const pct = duration ? (progress / duration) * 100 : 0;
  const VolIcon = volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;
  const RepeatIcon = repeat === "one" ? Repeat1 : Repeat;

  if (!track) return <div className="mini-player empty"><span className="np-empty">Pick a song to start listening</span></div>;

  return (
    <div className="mini-player">
      <div className="mini-progress mobile-only" onClick={seek}><div className="mini-progress-fill" style={{ width: `${pct}%`, background: accentGradient }} /></div>
      <div className="mini-player-row">
        <div className="np-left" onClick={onExpand}>
          {track.image ? <img src={track.image} alt="" className="np-art" /> : <div className="np-art local-icon"><Music2 size={18} /></div>}
          <div className="np-meta"><span className="np-title">{track.name}</span><span className="np-artist">{track.artist_name}</span></div>
        </div>
        <div className="mini-controls mobile-only">
          <button className={`heart-btn ${isLiked(track) ? "liked" : ""}`} onClick={(e) => { e.stopPropagation(); toggleLike(track); }}>
            <Heart size={19} fill={isLiked(track) ? "currentColor" : "none"} />
          </button>
          <button className="play-btn" onClick={(e) => { e.stopPropagation(); togglePlay(); }}>
            {buffering ? <Loader2 size={16} className="spin" /> : isPlaying ? <Pause size={18} fill="var(--accent-contrast)" /> : <Play size={18} fill="var(--accent-contrast)" style={{ marginLeft: 2 }} />}
          </button>
        </div>
        <div className="np-center desktop-only">
          <div className="np-controls">
            <button className={`ctrl-btn ${shuffle ? "on" : ""}`} onClick={() => setShuffle(s => !s)}><Shuffle size={16} /></button>
            <button className="ctrl-btn" onClick={onPrev}><SkipBack size={18} fill="currentColor" /></button>
            <button className="play-btn" onClick={togglePlay}>
              {buffering ? <Loader2 size={16} className="spin" /> : isPlaying ? <Pause size={17} fill="var(--accent-contrast)" /> : <Play size={17} fill="var(--accent-contrast)" style={{ marginLeft: 2 }} />}
            </button>
            <button className="ctrl-btn" onClick={onNext}><SkipForward size={18} fill="currentColor" /></button>
            <button className={`ctrl-btn ${repeat !== "off" ? "on" : ""}`} onClick={cycleRepeat}><RepeatIcon size={16} /></button>
          </div>
          <div className="np-progress">
            <span className="np-time">{formatTime(progress)}</span>
            <div className="progress-track" onClick={seek}>
              <div className="progress-fill" style={{ width: `${pct}%`, background: accentGradient }} />
              <div className="progress-knob" style={{ left: `${pct}%`, background: accentGradient }} />
            </div>
            <span className="np-time">{formatTime(duration)}</span>
          </div>
        </div>
        <div className="np-right desktop-only">
          <button className={`heart-btn ${isLiked(track) ? "liked" : ""}`} onClick={() => toggleLike(track)}><Heart size={16} fill={isLiked(track) ? "currentColor" : "none"} /></button>
          <div className="volume-control">
            <VolIcon size={17} />
            <div className="volume-track" onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); const p = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)); setVolume(Math.round(p * 100)); }}>
              <div className="volume-fill" style={{ width: `${volume}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   FULL PLAYER SHEET (swipe-down to close)
============================================================================ */
function FullPlayerSheet({ track, isPlaying, togglePlay, onNext, onPrev, progress, duration, seek, volume, setVolume,
  shuffle, setShuffle, repeat, cycleRepeat, toggleLike, isLiked, buffering, accentGradient, onClose, onShowQueue, onOpenMenu }) {
  const pct = duration ? (progress / duration) * 100 : 0;
  const RepeatIcon = repeat === "one" ? Repeat1 : Repeat;
  const VolIcon = volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;

  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const startTime = useRef(0);

  const onTouchStart = (e) => {
    if (e.target.closest("button, .progress-track, .volume-track")) return;
    startY.current = e.touches[0].clientY;
    startTime.current = Date.now();
    setDragging(true);
  };
  const onTouchMove = (e) => {
    if (!dragging) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) setDragY(delta);
  };
  const onTouchEnd = () => {
    setDragging(false);
    const elapsed = Date.now() - startTime.current;
    const velocity = dragY / Math.max(elapsed, 1);
    if (dragY > 60 || velocity > 0.5) onClose(); else setDragY(0);
  };

  return (
    <div className="full-player" style={{ background: `linear-gradient(180deg, ${accentGradient}33 0%, var(--bg) 55%)`, transform: `translateY(${dragY}px)`, transition: dragging ? "none" : "transform .25s ease" }}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div className="full-player-drag-zone">
        <div className="sheet-handle" />
        <div className="full-player-top">
          <button className="round-btn" onClick={onClose}><ChevronDown size={22} /></button>
          <span className="full-player-label">Now Playing</span>
          <button className="round-btn" onClick={() => onOpenMenu(track)}><MoreHorizontal size={20} /></button>
        </div>
      </div>

      <div className="full-player-art-wrap">
        {track.image ? <img src={track.image} alt="" className="full-player-art" /> : <div className="full-player-art local-icon"><Music2 size={64} /></div>}
      </div>

      <div className="full-player-meta">
        <div className="full-player-titles">
          <span className="full-player-title">{track.name}</span>
          <span className="full-player-artist">{track.artist_name}</span>
        </div>
        <button className={`heart-btn big ${isLiked(track) ? "liked" : ""}`} onClick={() => toggleLike(track)}><Heart size={24} fill={isLiked(track) ? "currentColor" : "none"} /></button>
      </div>

      <div className="full-player-progress">
        <div className="progress-track" onClick={seek}>
          <div className="progress-fill" style={{ width: `${pct}%`, background: accentGradient }} />
          <div className="progress-knob" style={{ left: `${pct}%`, background: accentGradient }} />
        </div>
        <div className="full-player-times"><span>{formatTime(progress)}</span><span>{formatTime(duration)}</span></div>
      </div>

      <div className="full-player-controls">
        <button className={`ctrl-btn big ${shuffle ? "on" : ""}`} onClick={() => setShuffle(s => !s)}><Shuffle size={22} /></button>
        <button className="ctrl-btn big" onClick={onPrev}><SkipBack size={30} fill="currentColor" /></button>
        <button className="play-btn big" onClick={togglePlay}>
          {buffering ? <Loader2 size={26} className="spin" /> : isPlaying ? <Pause size={28} fill="var(--accent-contrast)" /> : <Play size={28} fill="var(--accent-contrast)" style={{ marginLeft: 3 }} />}
        </button>
        <button className="ctrl-btn big" onClick={onNext}><SkipForward size={30} fill="currentColor" /></button>
        <button className={`ctrl-btn big ${repeat !== "off" ? "on" : ""}`} onClick={cycleRepeat}><RepeatIcon size={22} /></button>
      </div>

      <div className="full-player-bottom-row">
        <div className="volume-control full">
          <VolIcon size={18} />
          <div className="volume-track" onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); const p = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)); setVolume(Math.round(p * 100)); }}>
            <div className="volume-fill" style={{ width: `${volume}%` }} />
          </div>
        </div>
        <button className="text-icon-btn" onClick={onShowQueue}><ListMusic size={19} /><span>Queue</span></button>
      </div>
    </div>
  );
}

/* ============================================================================
   QUEUE SHEET
============================================================================ */
function QueueSheet({ queue, currentIndex, onPlayFromQueue, onClose }) {
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header"><h3>Queue</h3><button className="round-btn" onClick={onClose}><X size={18} /></button></div>
        <div className="sheet-body">
          {queue.map((t, i) => (
            <div key={t.id + i} className={`track-row ${i === currentIndex ? "active" : ""}`} onClick={() => onPlayFromQueue(i)}>
              <div className="track-row-index">{i === currentIndex ? <div className="playing-bars"><span /><span /><span /></div> : <span className="idx-number">{i + 1}</span>}</div>
              {t.image ? <img src={t.image} alt="" className="track-row-art" /> : <div className="track-row-art local-icon"><Music2 size={16} /></div>}
              <div className="track-row-meta"><span className="track-row-title">{t.name}</span><span className="track-row-artist">{t.artist_name}</span></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   TRACK OPTIONS SHEET (3-dot menu)
============================================================================ */
function TrackOptionsSheet({ track, isLiked, toggleLike, onAddToQueue, onAddToPlaylist, contextPlaylistId, onRemoveFromPlaylist, onRemoveLocal, onClose }) {
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet small" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="track-menu-header">
          {track.image ? <img src={track.image} alt="" /> : <div className="track-row-art local-icon" style={{ width: 46, height: 46 }}><Music2 size={18} /></div>}
          <div className="track-row-meta"><span className="track-row-title">{track.name}</span><span className="track-row-artist">{track.artist_name}</span></div>
        </div>
        <div className="sheet-body" style={{ paddingTop: 4 }}>
          <button className="add-pl-row" onClick={toggleLike}>
            <div className="mini-icon"><Heart size={16} fill={isLiked ? "currentColor" : "none"} color={isLiked ? "var(--accent-2)" : "currentColor"} /></div>
            <span>{isLiked ? "Remove from Liked Songs" : "Add to Liked Songs"}</span>
          </button>
          <button className="add-pl-row" onClick={onAddToQueue}>
            <div className="mini-icon"><ListPlus size={16} /></div>
            <span>Play in queue</span>
          </button>
          <button className="add-pl-row" onClick={onAddToPlaylist}>
            <div className="mini-icon"><Plus size={16} /></div>
            <span>Add to playlist</span>
          </button>
          {contextPlaylistId && (
            <button className="add-pl-row danger" onClick={onRemoveFromPlaylist}>
              <div className="mini-icon"><ListX size={16} /></div>
              <span>Remove from this playlist</span>
            </button>
          )}
          {track.isLocal && (
            <button className="add-pl-row danger" onClick={onRemoveLocal}>
              <div className="mini-icon"><Trash2 size={16} /></div>
              <span>Remove from device</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   CREATE PLAYLIST MODAL
============================================================================ */
function CreatePlaylistModal({ onCreate, onClose }) {
  const [name, setName] = useState("");
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet small" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header"><h3>Create playlist</h3><button className="round-btn" onClick={onClose}><X size={18} /></button></div>
        <div className="sheet-body" style={{ padding: "0 20px 20px" }}>
          <input className="modal-input" placeholder="Playlist name" value={name} autoFocus
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) onCreate(name.trim()); }} />
          <button className="primary-btn" disabled={!name.trim()} onClick={() => name.trim() && onCreate(name.trim())}>Create</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   ADD TO PLAYLIST MODAL
============================================================================ */
function AddToPlaylistModal({ track, playlists, onAdd, onClose, onCreateNew }) {
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header"><h3>Add to playlist</h3><button className="round-btn" onClick={onClose}><X size={18} /></button></div>
        <div className="sheet-body">
          <button className="add-pl-row" onClick={onCreateNew}><div className="mini-icon"><Plus size={16} /></div><span>New playlist</span></button>
          {playlists.length === 0 ? (
            <div className="empty-state" style={{ padding: "30px 20px" }}><p>No playlists yet</p><span>Create one to add songs.</span></div>
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
      </div>
    </div>
  );
}

/* ============================================================================
   SETTINGS MODAL
============================================================================ */
function SettingsModal({ accentKey, setAccentKey, themeMode, setThemeMode, searchHistory, onClearHistory, onSelectHistory,
  likedCount, onOpenLiked, localCount, onImportFiles, onClose }) {
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header"><h3>Settings</h3><button className="round-btn" onClick={onClose}><X size={18} /></button></div>
        <div className="sheet-body" style={{ padding: "0 20px 24px" }}>

          <div className="settings-section">
            <div className="settings-label"><Sun size={15} /> Appearance</div>
            <div className="mode-grid">
              <button className={`mode-swatch ${themeMode === "light" ? "active" : ""}`} onClick={() => setThemeMode("light")}><Sun size={17} /><span>Light</span></button>
              <button className={`mode-swatch ${themeMode === "dark" ? "active" : ""}`} onClick={() => setThemeMode("dark")}><Moon size={17} /><span>Dark</span></button>
              <button className={`mode-swatch ${themeMode === "system" ? "active" : ""}`} onClick={() => setThemeMode("system")}><Monitor size={17} /><span>System</span></button>
            </div>
          </div>

          <div className="settings-section">
            <div className="settings-label"><Palette size={15} /> Accent color</div>
            <div className="theme-grid">
              {Object.entries(ACCENTS).map(([key, t]) => (
                <button key={key} className={`theme-swatch ${accentKey === key ? "active" : ""}`} onClick={() => setAccentKey(key)}>
                  <span className="theme-dot" style={{ background: t.accent }} /><span>{t.name}</span>
                  {accentKey === key && <Check size={14} />}
                </button>
              ))}
            </div>
          </div>

          <div className="settings-section">
            <button className="add-pl-row" onClick={onOpenLiked}>
              <div className="mini-icon liked-mini"><Heart size={16} fill="currentColor" /></div>
              <span style={{ flex: 1 }}>Liked Songs</span>
              <span className="count-pill">{likedCount}</span>
            </button>
            <button className="add-pl-row" onClick={onImportFiles}>
              <div className="mini-icon"><HardDrive size={16} /></div>
              <span style={{ flex: 1 }}>Songs on this device</span>
              <span className="count-pill">{localCount}</span>
            </button>
          </div>

          <div className="settings-section">
            <div className="settings-label-row">
              <div className="settings-label"><Clock size={15} /> Search history</div>
              {searchHistory.length > 0 && <button className="text-btn danger" onClick={onClearHistory}><Trash2 size={13} /> Clear</button>}
            </div>
            {searchHistory.length === 0 ? <p className="settings-hint">Your recent searches will appear here.</p> : (
              <div className="history-list">
                {searchHistory.map((q, i) => (
                  <button key={i} className="history-item" onClick={() => onSelectHistory(q)}><Clock size={14} /> <span>{q}</span></button>
                ))}
              </div>
            )}
          </div>

          <div className="settings-section">
            <p className="settings-hint">Your liked songs, playlists, and preferences are saved on this device automatically. Songs imported from your device are available for this session only.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   STYLES
============================================================================ */
const STYLES = `
:root {
  --radius: 10px;
}
* { box-sizing: border-box; }
html, body { overflow-x: hidden; max-width: 100%; }
.app-shell {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg); color: var(--text); height: 100dvh; width: 100%; max-width: 100vw;
  display: flex; flex-direction: column; overflow: hidden; position: relative;
  transition: background .2s ease, color .2s ease;
}
.ambient-glow { position: absolute; inset: 0; pointer-events: none; z-index: 0; transition: background 1.2s ease; }
.layout { flex: 1; display: flex; overflow: hidden; z-index: 1; padding: 8px 8px 0 8px; gap: 8px; min-width: 0; min-height: 0; }

.sidebar { width: 260px; flex-shrink: 0; background: var(--surface); border-radius: var(--radius); padding: 20px 14px; display: flex; flex-direction: column; overflow-y: auto; }
.brand { display: flex; align-items: center; gap: 10px; padding: 0 10px 22px; font-weight: 800; font-size: 19px; letter-spacing: -0.02em; }
.brand-mark { width: 30px; height: 30px; border-radius: 8px; background: var(--accent); color: var(--accent-contrast); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.nav-group { display: flex; flex-direction: column; gap: 2px; }
.nav-item { display: flex; align-items: center; gap: 14px; background: none; border: none; color: var(--text-dim); font-size: 14.5px; font-weight: 700; padding: 9px 10px; border-radius: 6px; cursor: pointer; text-align: left; width: 100%; transition: color .15s, background .15s; }
.nav-item:hover { color: var(--text); background: var(--surface-hi); }
.nav-item.active { color: var(--text); }
.mini-icon { width: 22px; height: 22px; border-radius: 4px; background: var(--surface-hi); display: flex; align-items: center; justify-content: center; color: var(--text-dim); flex-shrink: 0; }
.mini-icon.liked, .mini-icon.liked-mini { background: linear-gradient(135deg, var(--accent-2), var(--accent)); color: #fff; }
.count-pill { margin-left: auto; font-size: 11px; background: var(--surface-hi); padding: 2px 7px; border-radius: 10px; color: var(--text-dim); }
.sidebar-divider { height: 1px; background: var(--border); margin: 12px 4px; flex-shrink: 0; }
.playlist-block { display: flex; flex-direction: column; gap: 2px; }
.playlist-list { display: flex; flex-direction: column; gap: 2px; overflow-y: auto; }
.playlist-row { display: flex; align-items: center; gap: 10px; background: none; border: none; padding: 6px 8px; border-radius: 6px; cursor: pointer; text-align: left; width: 100%; transition: background .15s; }
.playlist-row:hover, .playlist-row.active { background: var(--surface-hi); }
.playlist-row img, .playlist-row-placeholder { width: 40px; height: 40px; border-radius: 5px; object-fit: cover; flex-shrink: 0; background: var(--surface-hi); display: flex; align-items: center; justify-content: center; color: var(--text-dim); }
.playlist-row-text { display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
.pl-name { font-size: 13.5px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pl-sub { font-size: 11.5px; color: var(--text-dim); }

.main-pane { flex: 1; background: var(--surface); border-radius: var(--radius); overflow: hidden; display: flex; flex-direction: column; min-width: 0; }
.topbar { display: flex; align-items: center; gap: 14px; padding: 14px 24px; flex-shrink: 0; position: relative; z-index: 6; }
.topbar-nav { display: flex; gap: 8px; flex-shrink: 0; }
.round-btn { width: 32px; height: 32px; border-radius: 50%; background: var(--overlay); border: none; color: var(--text); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
.round-btn:hover:not(:disabled) { filter: brightness(1.3); }
.round-btn:disabled { opacity: .35; cursor: default; }
.settings-btn { width: 36px; height: 36px; border-radius: 50%; background: var(--surface-hi); border: 1px solid var(--border); color: var(--text-dim); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: color .15s, border-color .15s; }
.settings-btn:hover { color: var(--text); border-color: var(--accent); }
.icon-btn { width: 28px; height: 28px; border-radius: 50%; background: var(--surface-hi); border: none; color: var(--text-dim); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
.icon-btn:hover { color: var(--text); }
.search-box-wrap { flex: 1; max-width: 420px; position: relative; min-width: 0; }
.search-box { display: flex; align-items: center; gap: 10px; background: var(--surface-hi); border-radius: 22px; padding: 9px 16px; min-width: 0; }
.search-icon { color: var(--text-dim); flex-shrink: 0; }
.search-box input { flex: 1; background: none; border: none; outline: none; color: var(--text); font-size: 14px; min-width: 0; width: 100%; }
.search-box input::placeholder { color: var(--text-dim); }
.clear-btn { background: var(--border); border: none; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; color: var(--text); cursor: pointer; flex-shrink: 0; }
.history-dropdown { position: absolute; top: calc(100% + 6px); left: 0; right: 0; background: var(--surface-hi); border: 1px solid var(--border); border-radius: 12px; padding: 8px; box-shadow: 0 14px 34px rgba(0,0,0,.35); z-index: 10; max-height: 280px; overflow-y: auto; }
.history-dropdown-title { font-size: 11px; font-weight: 700; color: var(--text-dim); text-transform: uppercase; letter-spacing: .04em; padding: 6px 8px; }

.content-scroll { flex: 1; overflow-y: auto; overflow-x: hidden; min-height: 0; }
.view-pad { padding: 8px 28px 40px; max-width: 100%; }
.page-title { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; margin: 10px 0 20px; }

.quick-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-bottom: 34px; }
.artists-scroll { display: flex; gap: 16px; overflow-x: auto; padding: 4px 2px 10px; margin-bottom: 10px; scrollbar-width: none; }
.artists-scroll::-webkit-scrollbar { display: none; }
.artist-card { display: flex; flex-direction: column; align-items: center; gap: 8px; background: none; border: none; cursor: pointer; flex-shrink: 0; width: 92px; }
.artist-card img, .artist-card-placeholder { width: 84px; height: 84px; border-radius: 50%; object-fit: cover; background: var(--surface-hi); display: flex; align-items: center; justify-content: center; color: var(--text-dim); transition: transform .15s; }
.artist-card:hover img, .artist-card:hover .artist-card-placeholder { transform: scale(1.05); }
.artist-card span { font-size: 12px; font-weight: 700; color: var(--text); text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 92px; }
.quick-card { display: flex; align-items: center; gap: 12px; background: var(--surface-hi); border: none; border-radius: 6px; overflow: hidden; cursor: pointer; position: relative; height: 60px; text-align: left; min-width: 0; }
.quick-card:hover { background: var(--surface-hi-2); }
.quick-card img, .quick-card-placeholder { width: 60px; height: 60px; object-fit: cover; flex-shrink: 0; background: var(--border); display: flex; align-items: center; justify-content: center; color: var(--text-dim); }
.quick-card span { font-weight: 700; font-size: 13px; color: var(--text); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.quick-play { width: 32px; height: 32px; border-radius: 50%; background: var(--accent); display: flex; align-items: center; justify-content: center; margin-right: 12px; opacity: 0; transform: translateY(6px); transition: all .2s; box-shadow: 0 6px 14px rgba(0,0,0,.25); flex-shrink: 0; }
.quick-card:hover .quick-play { opacity: 1; transform: translateY(0); }

.section-header { display: flex; align-items: center; justify-content: space-between; margin: 30px 0 14px; gap: 10px; }
.section-header h2 { font-size: 19px; font-weight: 800; letter-spacing: -0.01em; }
.text-btn { display: flex; align-items: center; gap: 4px; background: none; border: none; color: var(--text-dim); font-size: 12.5px; font-weight: 700; cursor: pointer; }
.text-btn:hover { color: var(--text); }
.text-btn.danger { color: #FF6B6B; opacity: .85; }
.text-btn.danger:hover { opacity: 1; }
.trending-refresh-wrap { display: flex; align-items: center; gap: 8px; }

.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 14px; }
.track-card { background: var(--surface-hi); border-radius: 8px; padding: 10px; cursor: pointer; transition: background .18s; min-width: 0; }
.track-card:hover { background: var(--surface-hi-2); }
.track-card-art-wrap { position: relative; margin-bottom: 8px; }
.track-card-art-wrap img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px; display: block; background: var(--border); }
.track-card-play { position: absolute; bottom: 6px; right: 6px; width: 36px; height: 36px; border-radius: 50%; background: var(--accent); display: flex; align-items: center; justify-content: center; opacity: 0; transform: translateY(6px); transition: all .2s; box-shadow: 0 8px 18px rgba(0,0,0,.35); }
.track-card:hover .track-card-play { opacity: 1; transform: translateY(0); }
.track-card-title { display: block; font-size: 13px; font-weight: 700; margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.track-card-artist { display: block; font-size: 12px; color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.loading-row { display: flex; align-items: center; gap: 10px; color: var(--text-dim); padding: 30px 0; font-size: 14px; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.track-list { display: flex; flex-direction: column; min-width: 0; }
.track-row { display: grid; grid-template-columns: 26px 40px 1fr 30px 26px; align-items: center; gap: 8px; padding: 8px 8px; border-radius: 6px; cursor: pointer; transition: background .1s; min-width: 0; }
.track-row:hover { background: var(--surface-hi); }
.track-row.active .track-row-title { color: var(--accent); }
.track-row-index { display: flex; align-items: center; justify-content: center; color: var(--text-dim); font-size: 13px; position: relative; }
.idx-play { display: none; }
.track-row:hover .idx-number { display: none; }
.track-row:hover .idx-play { display: block; color: var(--text); }
.playing-bars { display: flex; align-items: flex-end; gap: 2px; height: 14px; }
.playing-bars span { width: 3px; background: var(--accent); animation: bar 1s ease-in-out infinite; border-radius: 1px; }
.playing-bars span:nth-child(1) { height: 40%; animation-delay: 0s; }
.playing-bars span:nth-child(2) { height: 100%; animation-delay: .2s; }
.playing-bars span:nth-child(3) { height: 65%; animation-delay: .4s; }
@keyframes bar { 0%, 100% { height: 30%; } 50% { height: 100%; } }
.track-row-art { width: 40px; height: 40px; border-radius: 4px; object-fit: cover; background: var(--border); flex-shrink: 0; }
.track-row-art.local-icon, .np-art.local-icon, .full-player-art.local-icon { display: flex; align-items: center; justify-content: center; color: var(--text-dim); }
.track-row-meta { display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
.track-row-title { font-size: 13.5px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.track-row-artist { font-size: 12px; color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mini-heart { color: var(--accent-2); flex-shrink: 0; }
.heart-btn, .more-btn { background: none; border: none; color: var(--text-dim); cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.heart-btn:hover, .more-btn:hover { color: var(--text); }
.heart-btn.liked { color: var(--accent-2); }
.heart-btn.big { color: var(--text-dim); }

.genre-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 14px; }
.genre-card { position: relative; height: 90px; border: none; border-radius: 8px; padding: 14px; cursor: pointer; text-align: left; font-family: inherit; overflow: hidden; transition: transform .15s, filter .15s; }
.genre-card:hover { transform: translateY(-2px); filter: brightness(1.06); }
.genre-card-icon { position: absolute; right: -6px; bottom: -8px; color: rgba(0,0,0,.22); }
.genre-card-label { position: relative; z-index: 1; font-weight: 800; font-size: 16px; color: #0B0E10; display: block; }

.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 50px 20px; color: var(--text-dim); text-align: center; }
.empty-state.small { padding: 26px 20px; }
.empty-state p { color: var(--text); font-weight: 700; font-size: 15px; margin: 6px 0 0; }
.empty-state span { font-size: 13px; }

.playlist-hero { display: flex; align-items: flex-end; gap: 18px; padding: 16px 0 10px; flex-wrap: wrap; }
.playlist-hero img, .playlist-hero-placeholder { width: 140px; height: 140px; object-fit: cover; border-radius: 8px; box-shadow: 0 16px 40px rgba(0,0,0,.35); background: var(--surface-hi); display: flex; align-items: center; justify-content: center; color: var(--text-dim); flex-shrink: 0; }
.playlist-hero-text { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.eyebrow { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-dim); }
.playlist-hero-text h1 { font-size: 28px; font-weight: 900; letter-spacing: -0.03em; margin: 0; word-break: break-word; }
.pl-hero-sub { font-size: 13px; color: var(--text-dim); }
.playlist-actions { padding: 18px 0; display: flex; align-items: center; gap: 18px; }
.play-fab { width: 52px; height: 52px; border-radius: 50%; background: var(--accent); border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 8px 20px rgba(0,0,0,.2); transition: transform .15s; }
.play-fab:hover { transform: scale(1.06); }

.mini-player { flex-shrink: 0; background: var(--surface); z-index: 5; }
.mini-player.empty { display: flex; align-items: center; justify-content: center; height: 56px; margin: 8px; border-radius: var(--radius); }
.np-empty { color: var(--text-dim); font-size: 13px; }
.mini-player-row { display: grid; grid-template-columns: 1fr 2fr 1fr; align-items: center; padding: 0 16px; gap: 12px; height: 72px; }
.np-left { display: flex; align-items: center; gap: 12px; min-width: 0; cursor: pointer; }
.np-art { width: 48px; height: 48px; border-radius: 6px; object-fit: cover; flex-shrink: 0; background: var(--border); }
.np-meta { display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
.np-title { font-size: 13.5px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.np-artist { font-size: 12px; color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.np-center { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; width: 100%; }
.np-controls { display: flex; align-items: center; gap: 18px; }
.ctrl-btn { background: none; border: none; color: var(--text-dim); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: color .15s; flex-shrink: 0; }
.ctrl-btn:hover { color: var(--text); }
.ctrl-btn.on { color: var(--accent); }
.play-btn { width: 34px; height: 34px; border-radius: 50%; background: var(--accent); border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform .12s; flex-shrink: 0; }
.play-btn:hover { transform: scale(1.06); }
.np-progress { display: flex; align-items: center; gap: 8px; width: 100%; max-width: 480px; }
.np-time { font-size: 11px; color: var(--text-dim); width: 34px; text-align: center; flex-shrink: 0; }
.progress-track { flex: 1; height: 4px; background: var(--border); border-radius: 2px; position: relative; cursor: pointer; }
.progress-fill { height: 100%; border-radius: 2px; }
.progress-knob { position: absolute; top: 50%; width: 11px; height: 11px; border-radius: 50%; transform: translate(-50%, -50%); opacity: 0; transition: opacity .15s; }
.progress-track:hover .progress-knob { opacity: 1; }
.np-right { display: flex; align-items: center; justify-content: flex-end; gap: 14px; }
.volume-control { display: flex; align-items: center; gap: 8px; color: var(--text-dim); }
.volume-track { width: 90px; height: 4px; background: var(--border); border-radius: 2px; cursor: pointer; }
.volume-fill { height: 100%; background: var(--text); border-radius: 2px; }
.volume-control:hover .volume-fill { background: var(--accent); }
.mini-controls { display: flex; align-items: center; gap: 14px; flex-shrink: 0; }
.mini-progress { height: 2px; background: var(--border); cursor: pointer; }
.mini-progress-fill { height: 100%; }

.bottom-nav { display: none; }
.mobile-only { display: none; }

.full-player { position: fixed; inset: 0; z-index: 20; display: flex; flex-direction: column; padding: 0 20px 24px; overflow-y: auto; touch-action: none; }
.full-player-drag-zone { flex-shrink: 0; padding-top: 6px; }
.full-player-top { display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; padding: 10px 0 0; }
.full-player-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--text-dim); }
.full-player-art-wrap { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0; padding: 20px 0; }
.full-player-art { width: 100%; max-width: 340px; aspect-ratio: 1; object-fit: cover; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,.35); background: var(--surface-hi); }
.full-player-meta { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 20px; }
.full-player-titles { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.full-player-title { font-size: 20px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.full-player-artist { font-size: 14px; color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.full-player-progress { margin-bottom: 18px; }
.full-player-times { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-dim); margin-top: 6px; }
.full-player-controls { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
.ctrl-btn.big { color: var(--text); }
.ctrl-btn.big.on { color: var(--accent); }
.play-btn.big { width: 64px; height: 64px; }
.full-player-bottom-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.volume-control.full { flex: 1; }
.volume-control.full .volume-track { flex: 1; }
.text-icon-btn { display: flex; align-items: center; gap: 6px; background: var(--surface-hi); border: none; color: var(--text); font-size: 12.5px; font-weight: 700; padding: 8px 14px; border-radius: 20px; cursor: pointer; flex-shrink: 0; }

.sheet-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.55); z-index: 30; display: flex; align-items: flex-end; }
.sheet { background: var(--surface); width: 100%; max-height: 75vh; border-radius: 16px 16px 0 0; display: flex; flex-direction: column; overflow: hidden; }
.sheet.small { max-height: none; }
.sheet-handle { width: 36px; height: 4px; background: var(--border); border-radius: 2px; margin: 10px auto 0; flex-shrink: 0; }
.sheet-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; flex-shrink: 0; }
.sheet-header h3 { font-size: 17px; font-weight: 800; }
.sheet-body { overflow-y: auto; padding: 0 10px 20px; }
.track-menu-header { display: flex; align-items: center; gap: 12px; padding: 12px 20px 8px; }
.track-menu-header img { width: 46px; height: 46px; border-radius: 6px; object-fit: cover; flex-shrink: 0; }
.modal-input { width: 100%; background: var(--surface-hi); border: 1px solid var(--border); border-radius: 8px; padding: 12px 14px; color: var(--text); font-size: 14px; margin-bottom: 14px; outline: none; }
.modal-input:focus { border-color: var(--accent); }
.primary-btn { width: 100%; background: var(--accent); color: var(--accent-contrast); border: none; border-radius: 24px; padding: 13px; font-weight: 800; font-size: 14px; cursor: pointer; }
.primary-btn:disabled { opacity: .4; cursor: default; }
.add-pl-row { display: flex; align-items: center; gap: 12px; width: 100%; background: none; border: none; padding: 11px 10px; border-radius: 8px; cursor: pointer; text-align: left; color: var(--text); }
.add-pl-row:hover { background: var(--surface-hi); }
.add-pl-row.danger { color: #FF6B6B; }
.add-pl-img { width: 36px; height: 36px; border-radius: 5px; object-fit: cover; flex-shrink: 0; }

.settings-section { padding: 18px 0; border-bottom: 1px solid var(--border); }
.settings-section:last-child { border-bottom: none; }
.settings-label { display: flex; align-items: center; gap: 7px; font-size: 13.5px; font-weight: 700; color: var(--text); margin-bottom: 12px; }
.settings-label-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.settings-label-row .settings-label { margin-bottom: 0; }
.settings-hint { font-size: 12.5px; color: var(--text-dim); line-height: 1.5; }
.mode-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.mode-swatch { display: flex; flex-direction: column; align-items: center; gap: 6px; background: var(--surface-hi); border: 1.5px solid transparent; border-radius: 10px; padding: 12px 8px; cursor: pointer; color: var(--text-dim); font-size: 12px; font-weight: 700; }
.mode-swatch.active { border-color: var(--accent); color: var(--text); }
.theme-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.theme-swatch { display: flex; align-items: center; gap: 8px; background: var(--surface-hi); border: 1.5px solid transparent; border-radius: 8px; padding: 10px 12px; cursor: pointer; color: var(--text); font-size: 13px; font-weight: 600; }
.theme-swatch.active { border-color: var(--accent); }
.theme-swatch span:nth-child(2) { flex: 1; text-align: left; }
.theme-dot { width: 16px; height: 16px; border-radius: 50%; flex-shrink: 0; }
.history-list { display: flex; flex-direction: column; gap: 2px; }
.history-item { display: flex; align-items: center; gap: 10px; background: none; border: none; color: var(--text-dim); font-size: 13px; padding: 9px 8px; cursor: pointer; text-align: left; border-radius: 6px; width: 100%; }
.history-item:hover { background: var(--surface-hi); color: var(--text); }

@media (max-width: 900px) {
  .sidebar { display: none; }
  .layout { padding: 0; }
  .main-pane { border-radius: 0; }
  .view-pad { padding: 8px 14px 20px; }
  .topbar { padding: 12px 14px; gap: 10px; }

  .desktop-only { display: none !important; }
  .mobile-only { display: block; }
  .settings-btn.mobile-only { display: flex; }

  .mini-player { position: relative; margin: 0; border-radius: 0; border-top: 1px solid var(--border); }
  .mini-player.empty { margin: 0; border-radius: 0; }
  .mini-player-row { grid-template-columns: 1fr auto; height: 62px; padding: 0 10px; gap: 8px; }
  .np-art { width: 42px; height: 42px; }

  .bottom-nav { display: flex; flex-shrink: 0; height: 56px; background: var(--surface); border-top: 1px solid var(--border); z-index: 4; }
  .bottom-nav-item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; background: none; border: none; color: var(--text-dim); font-size: 10.5px; font-weight: 600; cursor: pointer; }
  .bottom-nav-item.active { color: var(--text); }

  .quick-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
  .quick-card { height: 52px; }
  .quick-card img, .quick-card-placeholder { width: 52px; height: 52px; }
  .card-grid { grid-template-columns: repeat(2, 1fr); }
  .genre-grid { grid-template-columns: 1fr 1fr; }
}
`;
