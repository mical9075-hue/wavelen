import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Search, Home, Library, Heart, Play, Pause, SkipBack, SkipForward,
  Volume2, Volume1, VolumeX, Repeat, Repeat1, Shuffle, Plus, ListMusic,
  Loader2, Music2, X, ChevronLeft, ChevronDown, Radio, MoreHorizontal, Check,
  Settings, Trash2, Palette, Clock, FolderPlus, Sun, Moon, Monitor, ArrowLeft
} from "lucide-react";


/* ------------------------------------------------------------------
  LOCAL STORAGE PERSISTENCE
------------------------------------------------------------------- */
const STORAGE_KEYS = {
  liked: "wavelen_liked",
  playlists: "wavelen_playlists",
  searchHistory: "wavelen_search_history",
  themeColor: "wavelen_theme_color",
  themeMode: "wavelen_theme_mode", // 'dark' | 'light' | 'system'
  volume: "wavelen_volume",
};


function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}


function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Storage save failed:", e);
  }
}


const THEMES = {
  lime: { name: "Lime", accent: "#C4F135", accent2: "#7B61FF" },
  purple: { name: "Purple", accent: "#B48CFF", accent2: "#FF6B6B" },
  coral: { name: "Coral", accent: "#FF6B6B", accent2: "#3EC6FF" },
  ocean: { name: "Ocean", accent: "#3EC6FF", accent2: "#C4F135" },
  gold: { name: "Gold", accent: "#FF9F43", accent2: "#E356A7" },
  rose: { name: "Rose", accent: "#E356A7", accent2: "#4ED9A8" },
};


/* ------------------------------------------------------------------
  YOUTUBE CONFIG
------------------------------------------------------------------- */
const YT_API_KEY = "AIzaSyDRjilmeoNKlF8IJOw57B-2wEH9O7SWYZY";
const YT_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const YT_TRENDING_URL = "https://www.googleapis.com/youtube/v3/videos";


const GENRES = [
  { name: "Punjabi", query: "Punjabi hit songs 2026", color: "#7B61FF", image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80" },
  { name: "Bollywood", query: "Bollywood hit songs 2026", color: "#C4F135", image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80" },
  { name: "Hip Hop", query: "hip hop hit songs 2026", color: "#FF6B6B", image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80" },
  { name: "Romantic", query: "romantic hindi songs 2026", color: "#3EC6FF", image: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=400&q=80" },
  { name: "Party", query: "party songs Punjabi Bollywood 2026", color: "#FF9F43", image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&q=80" },
  { name: "Lo-fi", query: "lofi chill songs", color: "#E356A7", image: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&q=80" },
  { name: "English Pop", query: "english pop hit songs 2026", color: "#4ED9A8", image: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=400&q=80" },
  { name: "Old Classics", query: "old bollywood classic songs", color: "#B48CFF", image: "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=400&q=80" },
];


function formatTime(sec) {
  if (!sec && sec !== 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}


function decodeEntities(str) {
  if (!str) return str;
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}


function trackFromYTItem(item) {
  const vid = typeof item.id === 'string' ? item.id : item.id.videoId;
  const sn = item.snippet;
  return {
    id: vid,
    name: decodeEntities(sn.title.replace(/\(Official.*?\)|\[Official.*?\]/gi, "").trim()),
    artist_name: decodeEntities(sn.channelTitle),
    image: sn.thumbnails?.high?.url || sn.thumbnails?.medium?.url || sn.thumbnails?.default?.url,
    isLocal: false
  };
}


async function ytSearch(query, maxResults = 25) {
  const url = `${YT_SEARCH_URL}?part=snippet&type=video&videoCategoryId=10&maxResults=${maxResults}&q=${encodeURIComponent(query)}&key=${YT_API_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) return { error: data.error.message, results: [] };
    return { error: null, results: (data.items || []).map(trackFromYTItem) };
  } catch (err) {
    return { error: "Network error", results: [] };
  }
}


async function fetchRealtimeTrending() {
  const url = `${YT_TRENDING_URL}?part=snippet&chart=mostPopular&videoCategoryId=10&maxResults=16&key=${YT_API_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) return { error: data.error.message, results: [] };
    return { error: null, results: (data.items || []).map(trackFromYTItem) };
  } catch (err) {
    return { error: "Network error", results: [] };
  }
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
  const [isSearchFocused, setIsSearchFocused] = useState(false);


  const [trending, setTrending] = useState([]);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [trendingError, setTrendingError] = useState(null);


  const [localTracks, setLocalTracks] = useState([]);
  const [playlists, setPlaylists] = useState(() => loadFromStorage(STORAGE_KEYS.playlists, []));
  const [activePlaylist, setActivePlaylist] = useState(null);
  const [likedTracks, setLikedTracks] = useState(() => loadFromStorage(STORAGE_KEYS.liked, []));
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [searchHistory, setSearchHistory] = useState(() => loadFromStorage(STORAGE_KEYS.searchHistory, []));
  
  const [themeKey, setThemeKey] = useState(() => loadFromStorage(STORAGE_KEYS.themeColor, "lime"));
  const [themeMode, setThemeMode] = useState(() => loadFromStorage(STORAGE_KEYS.themeMode, "dark"));
  const [showSettings, setShowSettings] = useState(false);


  // Player state
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
  const [menuTrack, setMenuTrack] = useState(null); // track for 3-dots action popup


  const ytPlayerRef = useRef(null);
  const localAudioRef = useRef(new Audio());
  const progressIntervalRef = useRef(null);
  const searchContainerRef = useRef(null);


  const currentTrack = queue[currentIndex] || null;


  /* ---------- Theme Handling ---------- */
  useEffect(() => {
    const root = document.documentElement;
    const t = THEMES[themeKey] || THEMES.lime;
    root.style.setProperty("--accent", t.accent);
    root.style.setProperty("--accent-2", t.accent2);


    const applyMode = (mode) => {
      if (mode === "light") {
        root.classList.add("light-theme");
      } else if (mode === "dark") {
        root.classList.remove("light-theme");
      } else {
        const isSystemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        if (isSystemDark) root.classList.remove("light-theme");
        else root.classList.add("light-theme");
      }
    };
    applyMode(themeMode);
    saveToStorage(STORAGE_KEYS.themeColor, themeKey);
    saveToStorage(STORAGE_KEYS.themeMode, themeMode);
  }, [themeKey, themeMode]);


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
  }, []);


  const onPlayerStateChange = (e) => {
    if (e.data === 0) handleTrackEndRef.current?.();
    if (e.data === 1) { setIsPlaying(true); setBuffering(false); }
    if (e.data === 2) setIsPlaying(false);
    if (e.data === 3) setBuffering(true);
  };
  const onStateRef = useRef(onPlayerStateChange);
  useEffect(() => { onStateRef.current = onPlayerStateChange; });


  /* ---------- Real-time Trending Fetch ---------- */
  useEffect(() => {
    setLoadingTrending(true);
    fetchRealtimeTrending().then(({ error, results }) => {
      if (error || !results.length) {
        ytSearch("Trending Punjabi Hindi Hit Songs 2026", 16).then((res) => {
          setTrending(res.results);
          setLoadingTrending(false);
        });
      } else {
        setTrending(results);
        setLoadingTrending(false);
      }
    });
  }, []);


  /* ---------- Outside click search history ---------- */
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  /* ---------- Search debounce ---------- */
  useEffect(() => {
    if (!query.trim()) { setSearchResults([]); setSearchError(null); return; }
    setSearching(true);
    const t = setTimeout(() => {
      ytSearch(query, 25).then(({ error, results }) => {
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
    }, 450);
    return () => clearTimeout(t);
  }, [query]);


  /* ---------- Persistence ---------- */
  useEffect(() => { saveToStorage(STORAGE_KEYS.liked, likedTracks); }, [likedTracks]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.playlists, playlists); }, [playlists]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.searchHistory, searchHistory); }, [searchHistory]);
  useEffect(() => { saveToStorage(STORAGE_KEYS.volume, volume); }, [volume]);


  /* ---------- Play Engine Handling ---------- */
  useEffect(() => {
    if (!currentTrack) return;


    if (currentTrack.isLocal) {
      if (ytPlayerRef.current?.pauseVideo) ytPlayerRef.current.pauseVideo();
      const audio = localAudioRef.current;
      audio.src = currentTrack.audioUrl;
      audio.volume = volume / 100;
      audio.play().then(() => setIsPlaying(true)).catch(e => console.error(e));
      audio.onloadedmetadata = () => setDuration(audio.duration);
      audio.onended = () => handleTrackEndRef.current?.();
    } else {
      localAudioRef.current.pause();
      if (!playerReady || !ytPlayerRef.current) return;
      setBuffering(true);
      setProgress(0);
      setDuration(0);
      ytPlayerRef.current.loadVideoById(currentTrack.id);
      ytPlayerRef.current.setVolume(volume);
      const durCheck = setInterval(() => {
        try {
          const d = ytPlayerRef.current.getDuration();
          if (d > 0) { setDuration(d); clearInterval(durCheck); }
        } catch (e) {}
      }, 300);
      return () => clearInterval(durCheck);
    }
  }, [currentIndex, queue, playerReady]);


  /* Progress tracker */
  useEffect(() => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = setInterval(() => {
      if (currentTrack?.isLocal) {
        setProgress(localAudioRef.current.currentTime || 0);
      } else if (ytPlayerRef.current && isPlaying && ytPlayerRef.current.getCurrentTime) {
        try { setProgress(ytPlayerRef.current.getCurrentTime()); } catch (e) {}
      }
    }, 500);
    return () => clearInterval(progressIntervalRef.current);
  }, [isPlaying, currentTrack]);


  /* Volume update */
  useEffect(() => {
    if (currentTrack?.isLocal) {
      localAudioRef.current.volume = volume / 100;
    } else if (ytPlayerRef.current && ytPlayerRef.current.setVolume) {
      try { ytPlayerRef.current.setVolume(volume); } catch (e) {}
    }
  }, [volume, currentTrack]);


  const playTrackList = useCallback((list, index) => {
    setQueue(list);
    setCurrentIndex(index);
    setIsPlaying(true);
  }, []);


  const togglePlay = () => {
    if (!currentTrack) return;
    if (currentTrack.isLocal) {
      if (isPlaying) { localAudioRef.current.pause(); setIsPlaying(false); }
      else { localAudioRef.current.play(); setIsPlaying(true); }
    } else if (ytPlayerRef.current) {
      if (isPlaying) ytPlayerRef.current.pauseVideo();
      else ytPlayerRef.current.playVideo();
    }
  };


  const handleNext = useCallback(() => {
    if (!queue.length) return;
    let next = shuffle ? Math.floor(Math.random() * queue.length) : (currentIndex + 1) % queue.length;
    setCurrentIndex(next);
    setIsPlaying(true);
  }, [queue, currentIndex, shuffle]);


  const handleTrackEnd = useCallback(() => {
    if (repeat === "one") {
      if (currentTrack?.isLocal) {
        localAudioRef.current.currentTime = 0;
        localAudioRef.current.play();
      } else {
        ytPlayerRef.current?.seekTo(0);
        ytPlayerRef.current?.playVideo();
      }
      return;
    }
    if (repeat === "off" && !shuffle && currentIndex === queue.length - 1) {
      setIsPlaying(false);
      return;
    }
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


  const seek = (e) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const targetTime = pct * duration;
    if (currentTrack?.isLocal) {
      localAudioRef.current.currentTime = targetTime;
    } else if (ytPlayerRef.current) {
      ytPlayerRef.current.seekTo(targetTime, true);
    }
    setProgress(targetTime);
  };


  const toggleLike = (track) => {
    setLikedTracks(prev => {
      const exists = prev.find(t => t.id === track.id);
      if (exists) return prev.filter(t => t.id !== track.id);
      return [track, ...prev];
    });
  };
  const isLiked = (track) => likedTracks.some(t => t.id === track?.id);


  const handleLocalFilesUpload = (e) => {
    const files = Array.from(e.target.files);
    const audioFiles = files.filter(f => f.type.startsWith("audio/"));
    const imported = audioFiles.map((file, idx) => ({
      id: `local-${Date.now()}-${idx}`,
      name: file.name.replace(/\.[^/.]+$/, ""),
      artist_name: "Local Storage",
      image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&q=80",
      audioUrl: URL.createObjectURL(file),
      isLocal: true
    }));
    setLocalTracks(prev => [...imported, ...prev]);
  };


  const navigateTo = useCallback((nextView) => {
    setView(prev => {
      if (prev === nextView) return prev;
      setViewHistory(h => [...h, nextView]);
      return nextView;
    });
  }, []);


  const goBack = useCallback(() => {
    setViewHistory(h => {
      if (h.length <= 1) return h;
      const nh = h.slice(0, -1);
      setView(nh[nh.length - 1]);
      return nh;
    });
  }, []);


  const openGenre = useCallback((genre) => {
    setActiveGenre(genre);
    setSearching(true);
    navigateTo("genre");
    ytSearch(genre.query, 25).then(({ error, results }) => {
      setSearchError(error);
      setSearchResults(results);
      setSearching(false);
    });
  }, [navigateTo]);


  return (
    <div className="app-shell">
      <style>{STYLES}</style>
      <div id="yt-player-hidden" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} />
      <div className="ambient-glow" />


      <div className="layout">
        <Sidebar view={view} navigateTo={navigateTo} playlists={playlists} activePlaylist={activePlaylist}
          setActivePlaylist={setActivePlaylist} likedCount={likedTracks.length}
          onCreatePlaylist={() => setShowCreatePlaylist(true)} onOpenSettings={() => setShowSettings(true)} />


        <main className="main-pane">
          <TopBar query={query} setQuery={setQuery} navigateTo={navigateTo} goBack={goBack} canGoBack={viewHistory.length > 1}
            onOpenSettings={() => setShowSettings(false)} searchContainerRef={searchContainerRef}
            isFocused={isSearchFocused} setIsFocused={setIsSearchFocused}
            searchHistory={searchHistory} onSelectHistory={(q) => { setQuery(q); navigateTo("search"); setIsSearchFocused(false); }}
            onClearHistory={() => setSearchHistory([])} />


          <div className="content-scroll">
            {view === "home" && (
              <HomeView trending={trending} loading={loadingTrending} error={trendingError} playlists={playlists}
                onPlay={playTrackList} onOpenPlaylist={(pl) => { setActivePlaylist(pl); navigateTo("playlist"); }}
                currentTrack={currentTrack} isPlaying={isPlaying} toggleLike={toggleLike} isLiked={isLiked}
                onOpenMenu={setMenuTrack} />
            )}
            {view === "search" && (
              <SearchView query={query} results={searchResults} searching={searching} error={searchError}
                onPlay={playTrackList} currentTrack={currentTrack} isPlaying={isPlaying}
                toggleLike={toggleLike} isLiked={isLiked} onOpenGenre={openGenre} onOpenMenu={setMenuTrack} />
            )}
            {view === "genre" && (
              <GenreResultsView genre={activeGenre} results={searchResults} searching={searching} error={searchError}
                onPlay={playTrackList} currentTrack={currentTrack} isPlaying={isPlaying}
                toggleLike={toggleLike} isLiked={isLiked} onOpenMenu={setMenuTrack} />
            )}
            {view === "library" && (
              <LibraryView liked={likedTracks} playlists={playlists} localTracks={localTracks} onPlay={playTrackList}
                currentTrack={currentTrack} isPlaying={isPlaying} toggleLike={toggleLike} isLiked={isLiked}
                onOpenPlaylist={(pl) => { setActivePlaylist(pl); navigateTo("playlist"); }}
                onOpenMenu={setMenuTrack} onCreatePlaylist={() => setShowCreatePlaylist(true)}
                onFileUpload={handleLocalFilesUpload} />
            )}
            {view === "playlist" && activePlaylist && (
              <PlaylistView playlist={playlists.find(p => p.id === activePlaylist.id) || activePlaylist} onPlay={playTrackList}
                currentTrack={currentTrack} isPlaying={isPlaying} toggleLike={toggleLike} isLiked={isLiked}
                onOpenMenu={setMenuTrack} onDeletePlaylist={(id) => { setPlaylists(p => p.filter(x => x.id !== id)); goBack(); }} />
            )}
            {view === "liked-songs" && (
              <LikedSongsView liked={likedTracks} onPlay={playTrackList} currentTrack={currentTrack}
                isPlaying={isPlaying} toggleLike={toggleLike} isLiked={isLiked} onOpenMenu={setMenuTrack} />
            )}
          </div>
        </main>
      </div>


      <MiniPlayer
        track={currentTrack} isPlaying={isPlaying} togglePlay={togglePlay} onNext={handleNext} onPrev={handlePrev}
        progress={progress} duration={duration} seek={seek} volume={volume} setVolume={setVolume}
        shuffle={shuffle} setShuffle={setShuffle} repeat={repeat} cycleRepeat={() => setRepeat(r => r === "off" ? "all" : r === "all" ? "one" : "off")}
        toggleLike={toggleLike} isLiked={isLiked} buffering={buffering} onExpand={() => setExpandedPlayer(true)}
      />


      <BottomNav view={view} navigateTo={navigateTo} hasTrack={!!currentTrack} />


      {expandedPlayer && currentTrack && (
        <FullPlayerSheet
          track={currentTrack} isPlaying={isPlaying} togglePlay={togglePlay} onNext={handleNext} onPrev={handlePrev}
          progress={progress} duration={duration} seek={seek} volume={volume} setVolume={setVolume}
          shuffle={shuffle} setShuffle={setShuffle} repeat={repeat} cycleRepeat={() => setRepeat(r => r === "off" ? "all" : r === "all" ? "one" : "off")}
          toggleLike={toggleLike} isLiked={isLiked} buffering={buffering}
          onClose={() => setExpandedPlayer(false)} onShowQueue={() => setShowQueue(true)} onOpenMenu={setMenuTrack}
        />
      )}


      {showQueue && <QueueSheet queue={queue} currentIndex={currentIndex} onPlayFromQueue={(i) => { setCurrentIndex(i); setIsPlaying(true); }} onClose={() => setShowQueue(false)} />}
      {showCreatePlaylist && <CreatePlaylistModal onCreate={(name) => { setPlaylists(prev => [...prev, { id: `pl-${Date.now()}`, name, tracks: [] }]); setShowCreatePlaylist(false); }} onClose={() => setShowCreatePlaylist(false)} />}
      
      {/* Dynamic 3-Dots Popup Menu */}
      {menuTrack && (
        <TrackMenuModal
          track={menuTrack} playlists={playlists} isLiked={isLiked(menuTrack)}
          onToggleLike={() => toggleLike(menuTrack)}
          onAddToQueue={() => setQueue(q => [...q, menuTrack])}
          onAddToPlaylist={(plId) => {
            setPlaylists(prev => prev.map(pl => pl.id === plId ? { ...pl, tracks: [...pl.tracks, menuTrack] } : pl));
            setMenuTrack(null);
          }}
          onRemoveFromPlaylist={(plId) => {
            setPlaylists(prev => prev.map(pl => pl.id === plId ? { ...pl, tracks: pl.tracks.filter(t => t.id !== menuTrack.id) } : pl));
            setMenuTrack(null);
          }}
          onClose={() => setMenuTrack(null)}
        />
      )}


      {showSettings && (
        <SettingsModal
          themeKey={themeKey} setThemeKey={setThemeKey}
          themeMode={themeMode} setThemeMode={setThemeMode}
          onOpenLiked={() => { setView("liked-songs"); setShowSettings(false); }}
          onFileUpload={handleLocalFilesUpload}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}


/* ============================================================================
   SIDEBAR & NAVIGATION
============================================================================ */
function Sidebar({ view, navigateTo, playlists, activePlaylist, setActivePlaylist, likedCount, onCreatePlaylist, onOpenSettings }) {
  return (
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Music2 size={20} /></div><span>Wavelen</span></div>
      <nav className="nav-group">
        <button className={`nav-item ${view === "home" ? "active" : ""}`} onClick={() => navigateTo("home")}><Home size={19} /><span>Home</span></button>
        <button className={`nav-item ${view === "search" ? "active" : ""}`} onClick={() => navigateTo("search")}><Search size={19} /><span>Search</span></button>
        <button className={`nav-item ${view === "library" ? "active" : ""}`} onClick={() => navigateTo("library")}><Library size={19} /><span>Your Library</span></button>
      </nav>
      <div className="sidebar-divider" />
      <div className="playlist-block">
        <button className="nav-item" onClick={onCreatePlaylist}><div className="mini-icon"><Plus size={15} /></div><span>Create Playlist</span></button>
        <button className={`nav-item ${view === "liked-songs" ? "active" : ""}`} onClick={() => navigateTo("liked-songs")}>
          <div className="mini-icon liked"><Heart size={13} fill="currentColor" /></div><span>Liked Songs</span>
          {likedCount > 0 && <span className="count-pill">{likedCount}</span>}
        </button>
      </div>
      <div className="sidebar-divider" />
      <div className="playlist-list">
        {playlists.map(pl => (
          <button key={pl.id} className={`playlist-row ${activePlaylist?.id === pl.id && view === "playlist" ? "active" : ""}`}
            onClick={() => { setActivePlaylist(pl); navigateTo("playlist"); }}>
            <div className="playlist-row-placeholder"><Music2 size={16} /></div>
            <div className="playlist-row-text"><span className="pl-name">{pl.name}</span><span className="pl-sub">{pl.tracks.length} songs</span></div>
          </button>
        ))}
      </div>
      <div className="sidebar-divider" />
      <button className="nav-item" onClick={onOpenSettings}><Settings size={19} /><span>Settings</span></button>
    </aside>
  );
}


function BottomNav({ view, navigateTo, hasTrack }) {
  return (
    <nav className={`bottom-nav ${hasTrack ? "with-player" : ""}`}>
      {[
        { key: "home", label: "Home", icon: Home },
        { key: "search", label: "Search", icon: Search },
        { key: "library", label: "Library", icon: Library },
      ].map(({ key, label, icon: Icon }) => (
        <button key={key} className={`bottom-nav-item ${view === key ? "active" : ""}`} onClick={() => navigateTo(key)}>
          <Icon size={20} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}


/* ============================================================================
   TOP BAR WITH AUTO-HIDE SEARCH HISTORY DROPDOWN
============================================================================ */
function TopBar({ query, setQuery, navigateTo, goBack, canGoBack, onOpenSettings, searchContainerRef, isFocused, setIsFocused, searchHistory, onSelectHistory, onClearHistory }) {
  return (
    <div className="topbar">
      <div className="topbar-nav">
        <button className="round-btn" onClick={goBack} disabled={!canGoBack}><ChevronLeft size={18} /></button>
      </div>
      
      <div className="search-container" ref={searchContainerRef}>
        <div className="search-box">
          <Search size={17} className="search-icon" />
          <input placeholder="What do you want to play?" value={query}
            onFocus={() => { setIsFocused(true); navigateTo("search"); }}
            onChange={(e) => setQuery(e.target.value)} />
          {query && <button className="clear-btn" onClick={() => setQuery("")}><X size={14} /></button>}
        </div>


        {/* Search Dropdown Panel */}
        {isFocused && searchHistory.length > 0 && (
          <div className="search-history-dropdown">
            <div className="dropdown-header">
              <span>Recent Searches</span>
              <button onClick={onClearHistory}><Trash2 size={12} /> Clear</button>
            </div>
            {searchHistory.map((q, idx) => (
              <div key={idx} className="dropdown-item" onClick={() => onSelectHistory(q)}>
                <Clock size={14} />
                <span>{q}</span>
              </div>
            ))}
          </div>
        )}
      </div>


      <button className="settings-btn mobile-only" onClick={onOpenSettings}><Settings size={18} /></button>
    </div>
  );
}


/* ============================================================================
   TRACK ROW WITH 3-DOTS POPUP
============================================================================ */
function TrackRow({ track, index, list, onPlay, isActive, isPlaying, toggleLike, isLiked, onOpenMenu }) {
  return (
    <div className={`track-row ${isActive ? "active" : ""}`} onClick={() => onPlay(list, index)}>
      <div className="track-row-index">
        {isActive && isPlaying ? (
          <div className="playing-bars"><span /><span /><span /></div>
        ) : isActive ? <Pause size={14} /> : (
          <><span className="idx-number">{index + 1}</span><Play size={14} className="idx-play" /></>
        )}
      </div>
      <img src={track.image} alt="" className="track-row-art" />
      <div className="track-row-meta">
        <span className="track-row-title">{track.name}</span>
        <span className="track-row-artist">{track.artist_name}</span>
      </div>
      <button className={`heart-btn ${isLiked(track) ? "liked" : ""}`} onClick={(e) => { e.stopPropagation(); toggleLike(track); }}>
        <Heart size={16} fill={isLiked(track) ? "currentColor" : "none"} />
      </button>
      <button className="more-btn" onClick={(e) => { e.stopPropagation(); onOpenMenu(track); }}>
        <MoreHorizontal size={17} />
      </button>
    </div>
  );
}


/* ============================================================================
   VIEWS
============================================================================ */
function HomeView({ trending, loading, error, playlists, onPlay, onOpenPlaylist, currentTrack, isPlaying, toggleLike, isLiked, onOpenMenu }) {
  return (
    <div className="view-pad">
      <h1 className="page-title">Good day</h1>


      {playlists.length > 0 && (
        <div className="quick-grid">
          {playlists.slice(0, 6).map(pl => (
            <button key={pl.id} className="quick-card" onClick={() => onOpenPlaylist(pl)}>
              <div className="quick-card-placeholder"><Music2 size={18} /></div>
              <span>{pl.name}</span>
              <div className="quick-play"><Play size={16} fill="#000" /></div>
            </button>
          ))}
        </div>
      )}


      <div className="section-header"><h2>Trending now (Realtime)</h2></div>


      {loading ? (
        <div className="loading-row"><Loader2 className="spin" size={22} /> Loading realtime hits…</div>
      ) : (
        <div className="card-grid">
          {trending.map((t, i) => (
            <div key={t.id + i} className="track-card" onClick={() => onPlay(trending, i)}>
              <div className="track-card-art-wrap">
                <img src={t.image} alt="" />
                <div className="track-card-play"><Play size={18} fill="#000" /></div>
              </div>
              <span className="track-card-title">{t.name}</span>
              <span className="track-card-artist">{t.artist_name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function SearchView({ query, results, searching, error, onPlay, currentTrack, isPlaying, toggleLike, isLiked, onOpenGenre, onOpenMenu }) {
  if (!query.trim()) {
    return (
      <div className="view-pad">
        <h1 className="page-title">Browse all</h1>
        <div className="genre-grid">
          {GENRES.map((g) => (
            <button key={g.name} className="genre-card" style={{ backgroundImage: `linear-gradient(130deg, ${g.color}aa, rgba(0,0,0,0.8)), url(${g.image})` }} onClick={() => onOpenGenre(g)}>
              <span>{g.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="view-pad">
      <h1 className="page-title">Results for "{query}"</h1>
      {searching ? (
        <div className="loading-row"><Loader2 className="spin" size={22} /> Searching…</div>
      ) : (
        <div className="track-list">
          {results.map((t, i) => (
            <TrackRow key={t.id + i} track={t} index={i} list={results} onPlay={onPlay}
              isActive={currentTrack?.id === t.id} isPlaying={isPlaying} toggleLike={toggleLike} isLiked={isLiked}
              onOpenMenu={onOpenMenu} />
          ))}
        </div>
      )}
    </div>
  );
}


function GenreResultsView({ genre, results, searching, onPlay, currentTrack, isPlaying, toggleLike, isLiked, onOpenMenu }) {
  return (
    <div className="view-pad">
      <h1 className="page-title">{genre?.name}</h1>
      {searching ? <div className="loading-row"><Loader2 className="spin" size={22} /> Loading tracks…</div> : (
        <div className="track-list">
          {results.map((t, i) => (
            <TrackRow key={t.id + i} track={t} index={i} list={results} onPlay={onPlay}
              isActive={currentTrack?.id === t.id} isPlaying={isPlaying} toggleLike={toggleLike} isLiked={isLiked} onOpenMenu={onOpenMenu} />
          ))}
        </div>
      )}
    </div>
  );
}


function LibraryView({ liked, playlists, localTracks, onPlay, currentTrack, isPlaying, toggleLike, isLiked, onOpenPlaylist, onOpenMenu, onCreatePlaylist, onFileUpload }) {
  return (
    <div className="view-pad">
      <h1 className="page-title">Your Library</h1>


      <div className="section-header">
        <h2>Local Storage Audio</h2>
        <label className="text-btn upload-btn">
          <FolderPlus size={15} /> Add Audio Files
          <input type="file" multiple accept="audio/*" onChange={onFileUpload} style={{ display: "none" }} />
        </label>
      </div>


      {localTracks.length === 0 ? (
        <div className="empty-state"><Music2 size={32} /><p>No local audio files imported</p></div>
      ) : (
        <div className="track-list" style={{ marginBottom: 30 }}>
          {localTracks.map((t, i) => (
            <TrackRow key={t.id} track={t} index={i} list={localTracks} onPlay={onPlay}
              isActive={currentTrack?.id === t.id} isPlaying={isPlaying} toggleLike={toggleLike} isLiked={isLiked} onOpenMenu={onOpenMenu} />
          ))}
        </div>
      )}


      <div className="section-header">
        <h2>Playlists</h2>
        <button className="text-btn" onClick={onCreatePlaylist}><Plus size={15} /> New</button>
      </div>
      <div className="quick-grid">
        {playlists.map(pl => (
          <button key={pl.id} className="quick-card" onClick={() => onOpenPlaylist(pl)}>
            <div className="quick-card-placeholder"><Music2 size={18} /></div>
            <span>{pl.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}


function LikedSongsView({ liked, onPlay, currentTrack, isPlaying, toggleLike, isLiked, onOpenMenu }) {
  return (
    <div className="view-pad">
      <h1 className="page-title">Liked Songs</h1>
      {liked.length === 0 ? <div className="empty-state"><Heart size={36} /><p>No liked songs yet.</p></div> : (
        <div className="track-list">
          {liked.map((t, i) => (
            <TrackRow key={t.id} track={t} index={i} list={liked} onPlay={onPlay}
              isActive={currentTrack?.id === t.id} isPlaying={isPlaying} toggleLike={toggleLike} isLiked={isLiked} onOpenMenu={onOpenMenu} />
          ))}
        </div>
      )}
    </div>
  );
}


function PlaylistView({ playlist, onPlay, currentTrack, isPlaying, toggleLike, isLiked, onOpenMenu, onDeletePlaylist }) {
  return (
    <div className="view-pad">
      <div className="playlist-hero">
        <div className="playlist-hero-placeholder"><Music2 size={40} /></div>
        <div className="playlist-hero-text">
          <span className="eyebrow">Playlist</span>
          <h1>{playlist.name}</h1>
          <span className="pl-hero-sub">{playlist.tracks.length} songs</span>
        </div>
      </div>
      <div className="playlist-actions">
        {playlist.tracks.length > 0 && <button className="play-fab" onClick={() => onPlay(playlist.tracks, 0)}><Play size={20} fill="#000" /></button>}
        <button className="text-btn danger" onClick={() => onDeletePlaylist(playlist.id)}><Trash2 size={14} /> Delete</button>
      </div>
      <div className="track-list">
        {playlist.tracks.map((t, i) => (
          <TrackRow key={t.id + i} track={t} index={i} list={playlist.tracks} onPlay={onPlay}
            isActive={currentTrack?.id === t.id} isPlaying={isPlaying} toggleLike={toggleLike} isLiked={isLiked} onOpenMenu={onOpenMenu} />
        ))}
      </div>
    </div>
  );
}


/* ============================================================================
   PLAYERS (MINI & DOWN-SLIDE FULL SHEET)
============================================================================ */
function MiniPlayer({ track, isPlaying, togglePlay, onNext, onPrev, progress, duration, seek, volume, setVolume, shuffle, setShuffle, repeat, cycleRepeat, toggleLike, isLiked, buffering, onExpand }) {
  const pct = duration ? (progress / duration) * 100 : 0;
  if (!track) return <div className="mini-player empty"><span className="np-empty">Select a song to play</span></div>;


  return (
    <div className="mini-player">
      <div className="mini-progress mobile-only" onClick={seek}><div className="mini-progress-fill" style={{ width: `${pct}%` }} /></div>
      <div className="mini-player-row">
        <div className="np-left" onClick={onExpand}>
          <img src={track.image} alt="" className="np-art" />
          <div className="np-meta"><span className="np-title">{track.name}</span><span className="np-artist">{track.artist_name}</span></div>
        </div>
        <div className="mini-controls mobile-only">
          <button className="play-btn" onClick={(e) => { e.stopPropagation(); togglePlay(); }}>
            {isPlaying ? <Pause size={18} fill="#000" /> : <Play size={18} fill="#000" />}
          </button>
        </div>
        <div className="np-center desktop-only">
          <div className="np-controls">
            <button className={`ctrl-btn ${shuffle ? "on" : ""}`} onClick={() => setShuffle(s => !s)}><Shuffle size={16} /></button>
            <button className="ctrl-btn" onClick={onPrev}><SkipBack size={18} fill="currentColor" /></button>
            <button className="play-btn" onClick={togglePlay}>{isPlaying ? <Pause size={17} fill="#000" /> : <Play size={17} fill="#000" /></button>
            <button className="ctrl-btn" onClick={onNext}><SkipForward size={18} fill="currentColor" /></button>
            <button className={`ctrl-btn ${repeat !== "off" ? "on" : ""}`} onClick={cycleRepeat}><Repeat size={16} /></button>
          </div>
          <div className="np-progress">
            <span className="np-time">{formatTime(progress)}</span>
            <div className="progress-track" onClick={seek}><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
            <span className="np-time">{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}


function FullPlayerSheet({ track, isPlaying, togglePlay, onNext, onPrev, progress, duration, seek, volume, setVolume, shuffle, setShuffle, repeat, cycleRepeat, toggleLike, isLiked, buffering, onClose, onShowQueue, onOpenMenu }) {
  const pct = duration ? (progress / duration) * 100 : 0;
  const [startY, setStartY] = useState(0);


  const handleTouchStart = (e) => setStartY(e.touches[0].clientY);
  const handleTouchEnd = (e) => {
    if (e.changedTouches[0].clientY - startY > 80) onClose();
  };


  return (
    <div className="full-player" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="full-player-handle" onClick={onClose} />
      <div className="full-player-top">
        <button className="round-btn" onClick={onClose}><ChevronDown size={22} /></button>
        <span className="full-player-label">Now Playing</span>
        <button className="round-btn" onClick={() => onOpenMenu(track)}><MoreHorizontal size={20} /></button>
      </div>
      <div className="full-player-art-wrap"><img src={track.image} alt="" className="full-player-art" /></div>
      <div className="full-player-meta">
        <div><div className="full-player-title">{track.name}</div><div className="full-player-artist">{track.artist_name}</div></div>
        <button className={`heart-btn ${isLiked(track) ? "liked" : ""}`} onClick={() => toggleLike(track)}><Heart size={22} fill={isLiked(track) ? "currentColor" : "none"} /></button>
      </div>
      <div className="full-player-progress">
        <div className="progress-track" onClick={seek}><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
        <div className="full-player-times"><span>{formatTime(progress)}</span><span>{formatTime(duration)}</span></div>
      </div>
      <div className="full-player-controls">
        <button className={`ctrl-btn ${shuffle ? "on" : ""}`} onClick={() => setShuffle(s => !s)}><Shuffle size={20} /></button>
        <button className="ctrl-btn" onClick={onPrev}><SkipBack size={26} fill="currentColor" /></button>
        <button className="play-btn big" onClick={togglePlay}>{isPlaying ? <Pause size={28} fill="#000" /> : <Play size={28} fill="#000" /></button>
        <button className="ctrl-btn" onClick={onNext}><SkipForward size={26} fill="currentColor" /></button>
        <button className={`ctrl-btn ${repeat !== "off" ? "on" : ""}`} onClick={cycleRepeat}><Repeat size={20} /></button>
      </div>
    </div>
  );
}


/* ============================================================================
   MODALS (POPUP MENU, QUEUE, SETTINGS, PLAYLIST)
============================================================================ */
function TrackMenuModal({ track, playlists, isLiked, onToggleLike, onAddToQueue, onAddToPlaylist, onRemoveFromPlaylist, onClose }) {
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header"><h3>Song Options</h3><button className="round-btn" onClick={onClose}><X size={18} /></button></div>
        <div className="sheet-body">
          <button className="menu-option" onClick={() => { onToggleLike(); onClose(); }}>
            <Heart size={18} fill={isLiked ? "currentColor" : "none"} />
            <span>{isLiked ? "Remove from Liked Songs" : "Save to Liked Songs"}</span>
          </button>
          <button className="menu-option" onClick={() => { onAddToQueue(); onClose(); }}>
            <ListMusic size={18} />
            <span>Play Next in Queue</span>
          </button>
          
          <div className="menu-divider" />
          <div className="menu-subtitle">Add / Remove Playlist</div>
          {playlists.map(pl => {
            const inPl = pl.tracks.some(t => t.id === track.id);
            return (
              <button key={pl.id} className="menu-option" onClick={() => inPl ? onRemoveFromPlaylist(pl.id) : onAddToPlaylist(pl.id)}>
                <Music2 size={16} />
                <span style={{ flex: 1 }}>{pl.name}</span>
                {inPl ? <span className="pill-badge remove">Remove</span> : <span className="pill-badge add">Add</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}


function SettingsModal({ themeKey, setThemeKey, themeMode, setThemeMode, onOpenLiked, onFileUpload, onClose }) {
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header"><h3>Settings</h3><button className="round-btn" onClick={onClose}><X size={18} /></button></div>
        <div className="sheet-body" style={{ padding: "0 20px 24px" }}>
          
          <div className="settings-section">
            <div className="settings-label"><Sun size={15} /> App Theme Mode</div>
            <div className="theme-mode-grid">
              {[
                { key: "dark", label: "Dark", icon: Moon },
                { key: "light", label: "Light", icon: Sun },
                { key: "system", label: "System Default", icon: Monitor }
              ].map(item => (
                <button key={item.key} className={`mode-btn ${themeMode === item.key ? "active" : ""}`} onClick={() => setThemeMode(item.key)}>
                  <item.icon size={16} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>


          <div className="settings-section">
            <div className="settings-label"><Palette size={15} /> Accent Color</div>
            <div className="theme-grid">
              {Object.entries(THEMES).map(([key, t]) => (
                <button key={key} className={`theme-swatch ${themeKey === key ? "active" : ""}`} onClick={() => setThemeKey(key)}>
                  <span className="theme-dot" style={{ background: t.accent }} />
                  <span>{t.name}</span>
                </button>
              ))}
            </div>
          </div>


          <div className="settings-section">
            <button className="menu-option" onClick={onOpenLiked}><Heart size={18} /><span>Liked Songs Section</span></button>
            <label className="menu-option" style={{ cursor: "pointer" }}>
              <FolderPlus size={18} />
              <span>Import Local Audio Files</span>
              <input type="file" multiple accept="audio/*" onChange={(e) => { onFileUpload(e); onClose(); }} style={{ display: "none" }} />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}


function QueueSheet({ queue, currentIndex, onPlayFromQueue, onClose }) {
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header"><h3>Queue</h3><button className="round-btn" onClick={onClose}><X size={18} /></button></div>
        <div className="sheet-body">
          {queue.map((t, i) => (
            <div key={t.id + i} className={`track-row ${i === currentIndex ? "active" : ""}`} onClick={() => onPlayFromQueue(i)}>
              <span className="idx-number">{i + 1}</span>
              <img src={t.image} alt="" className="track-row-art" />
              <div className="track-row-meta"><span className="track-row-title">{t.name}</span><span className="track-row-artist">{t.artist_name}</span></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


function CreatePlaylistModal({ onCreate, onClose }) {
  const [name, setName] = useState("");
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet small" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header"><h3>Create Playlist</h3><button className="round-btn" onClick={onClose}><X size={18} /></button></div>
        <div className="sheet-body" style={{ padding: "0 20px 20px" }}>
          <input className="modal-input" placeholder="Playlist Name" value={name} onChange={e => setName(e.target.value)} />
          <button className="primary-btn" disabled={!name.trim()} onClick={() => onCreate(name.trim())}>Create</button>
        </div>
      </div>
    </div>
  );
}


/* ============================================================================
   UPDATED MODERN CSS STYLES
============================================================================ */
const STYLES = `
:root {
  --bg: #090B0E; --surface: rgba(20, 24, 30, 0.75); --surface-hi: rgba(30, 36, 45, 0.85);
  --border: rgba(255, 255, 255, 0.08); --text: #F5F7FA; --text-dim: #9EA8B6;
  --accent: #C4F135; --accent-2: #7B61FF; --radius: 14px;
}
.light-theme {
  --bg: #F4F6F9; --surface: rgba(255, 255, 255, 0.85); --surface-hi: rgba(235, 240, 245, 0.95);
  --border: rgba(0, 0, 0, 0.08); --text: #12161A; --text-dim: #64748B;
}


* { box-sizing: border-box; }
body, html { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
.app-shell { background: var(--bg); color: var(--text); height: 100dvh; display: flex; flex-direction: column; overflow: hidden; position: relative; }
.ambient-glow { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(circle at 10% 10%, var(--accent)15, transparent 50%); }


.layout { flex: 1; display: flex; overflow: hidden; gap: 10px; padding: 10px; z-index: 1; }
.sidebar { width: 250px; background: var(--surface); backdrop-filter: blur(20px); border-radius: var(--radius); border: 1px solid var(--border); padding: 18px 12px; display: flex; flex-direction: column; }
.brand { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 18px; margin-bottom: 20px; padding-left: 6px; }
.brand-mark { width: 28px; height: 28px; border-radius: 8px; background: var(--accent); color: #000; display: flex; align-items: center; justify-content: center; }


.nav-item { display: flex; align-items: center; gap: 12px; background: none; border: none; color: var(--text-dim); font-size: 14px; font-weight: 600; padding: 10px 12px; border-radius: 8px; cursor: pointer; width: 100%; transition: 0.2s; }
.nav-item:hover, .nav-item.active { color: var(--text); background: var(--surface-hi); }
.sidebar-divider { height: 1px; background: var(--border); margin: 10px 0; }
.playlist-list { flex: 1; overflow-y: auto; }
.playlist-row { display: flex; align-items: center; gap: 10px; background: none; border: none; padding: 8px; width: 100%; border-radius: 6px; cursor: pointer; text-align: left; }
.playlist-row-placeholder { width: 34px; height: 34px; border-radius: 6px; background: var(--surface-hi); color: var(--text-dim); display: flex; align-items: center; justify-content: center; }
.pl-name { font-size: 13px; font-weight: 600; color: var(--text); display: block; }
.pl-sub { font-size: 11px; color: var(--text-dim); }


.main-pane { flex: 1; background: var(--surface); backdrop-filter: blur(20px); border-radius: var(--radius); border: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
.topbar { display: flex; align-items: center; gap: 12px; padding: 12px 20px; border-bottom: 1px solid var(--border); z-index: 10; }
.round-btn { width: 32px; height: 32px; border-radius: 50%; background: var(--surface-hi); border: 1px solid var(--border); color: var(--text); display: flex; align-items: center; justify-content: center; cursor: pointer; }


/* Search history auto-hide container */
.search-container { position: relative; flex: 1; max-width: 400px; }
.search-box { display: flex; align-items: center; gap: 8px; background: var(--surface-hi); border: 1px solid var(--border); border-radius: 20px; padding: 6px 14px; }
.search-box input { background: none; border: none; outline: none; color: var(--text); font-size: 13.5px; width: 100%; }
.search-history-dropdown { position: absolute; top: 110%; left: 0; right: 0; background: var(--surface); backdrop-filter: blur(25px); border: 1px solid var(--border); border-radius: 12px; padding: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); z-index: 50; }
.dropdown-header { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-dim); padding: 4px 8px; margin-bottom: 4px; }
.dropdown-header button { background: none; border: none; color: var(--text-dim); cursor: pointer; }
.dropdown-item { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 6px; font-size: 13px; cursor: pointer; }
.dropdown-item:hover { background: var(--surface-hi); }


.content-scroll { flex: 1; overflow-y: auto; padding: 20px; }
.page-title { font-size: 24px; font-weight: 800; margin-bottom: 16px; }


.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 14px; }
.track-card { background: var(--surface-hi); border-radius: 10px; padding: 10px; cursor: pointer; border: 1px solid var(--border); transition: transform 0.2s; }
.track-card:hover { transform: translateY(-3px); }
.track-card-art-wrap { position: relative; margin-bottom: 8px; }
.track-card-art-wrap img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 8px; }
.track-card-play { position: absolute; bottom: 6px; right: 6px; width: 32px; height: 32px; border-radius: 50%; background: var(--accent); display: flex; align-items: center; justify-content: center; }
.track-card-title { font-size: 13px; font-weight: 700; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.track-card-artist { font-size: 11.5px; color: var(--text-dim); display: block; }


.track-list { display: flex; flex-direction: column; gap: 2px; }
.track-row { display: grid; grid-template-columns: 24px 40px 1fr 30px 24px; align-items: center; gap: 10px; padding: 8px; border-radius: 8px; cursor: pointer; }
.track-row:hover { background: var(--surface-hi); }
.track-row-art { width: 38px; height: 38px; border-radius: 6px; object-fit: cover; }
.track-row-title { font-size: 13.5px; font-weight: 600; display: block; }
.track-row-artist { font-size: 11.5px; color: var(--text-dim); }


.genre-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px; }
.genre-card { height: 90px; border-radius: 10px; background-size: cover; background-position: center; border: none; padding: 12px; font-weight: 800; color: #fff; font-size: 15px; cursor: pointer; text-align: left; }


.mini-player { background: var(--surface); backdrop-filter: blur(20px); border-top: 1px solid var(--border); flex-shrink: 0; }
.mini-player-row { display: grid; grid-template-columns: 1fr 2fr 1fr; align-items: center; padding: 0 16px; height: 64px; }
.np-left { display: flex; align-items: center; gap: 10px; cursor: pointer; }
.np-art { width: 42px; height: 42px; border-radius: 6px; object-fit: cover; }
.np-title { font-size: 13px; font-weight: 700; display: block; }
.np-artist { font-size: 11px; color: var(--text-dim); }
.np-controls { display: flex; align-items: center; justify-content: center; gap: 16px; }
.play-btn { width: 32px; height: 32px; border-radius: 50%; background: #fff; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; }


.full-player { position: fixed; inset: 0; background: var(--bg); z-index: 100; display: flex; flex-direction: column; padding: 20px; transition: transform 0.3s ease; }
.full-player-handle { width: 40px; height: 4px; background: var(--border); border-radius: 2px; margin: 0 auto 10px; cursor: pointer; }
.full-player-art-wrap { flex: 1; display: flex; align-items: center; justify-content: center; }
.full-player-art { width: 80%; max-width: 300px; aspect-ratio: 1; border-radius: 16px; object-fit: cover; }


.sheet-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 120; display: flex; align-items: flex-end; }
.sheet { background: var(--surface); backdrop-filter: blur(30px); border: 1px solid var(--border); width: 100%; border-radius: 20px 20px 0 0; padding: 16px; max-height: 80vh; overflow-y: auto; }
.menu-option { display: flex; align-items: center; gap: 12px; width: 100%; background: none; border: none; color: var(--text); padding: 12px 8px; font-size: 14px; cursor: pointer; border-radius: 8px; text-align: left; }
.menu-option:hover { background: var(--surface-hi); }
.pill-badge { font-size: 10px; padding: 3px 8px; border-radius: 10px; font-weight: 700; }
.pill-badge.add { background: var(--accent); color: #000; }
.pill-badge.remove { background: #FF6B6B; color: #fff; }


.theme-mode-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 8px; }
.mode-btn { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px; background: var(--surface-hi); border: 1px solid var(--border); color: var(--text); border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; }
.mode-btn.active { border-color: var(--accent); color: var(--accent); }


@media (max-width: 768px) {
  .sidebar { display: none; }
  .mobile-only { display: block; }
  .desktop-only { display: none; }
  .bottom-nav { display: flex; justify-content: space-around; background: var(--surface); backdrop-filter: blur(20px); border-top: 1px solid var(--border); padding: 8px 0; }
  .bottom-nav-item { display: flex; flex-direction: column; align-items: center; background: none; border: none; color: var(--text-dim); font-size: 10px; gap: 4px; }
  .bottom-nav-item.active { color: var(--text); }
}
`;

