import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Search, Home, Library, Heart, Play, Pause, SkipBack, SkipForward,
  Volume2, Volume1, VolumeX, Repeat, Shuffle, Plus, ListMusic,
  Loader2, Music2, X, ChevronLeft, ChevronRight, Radio
} from "lucide-react";

/* ------------------------------------------------------------------
  JAMENDO CONFIG
  Sign up free at https://devportal.jamendo.com/ -> Create an application
  -> copy the "Client ID" and paste it below.
  Until you do, the app runs on curated demo tracks so the UI is fully
  testable end-to-end.
------------------------------------------------------------------- */
const JAMENDO_CLIENT_ID = "01674fd1"; // <-- paste your Client ID here
const JAMENDO_BASE = "https://api.jamendo.com/v3.0";

/* ---------------------------- Demo fallback data (used only if no API key set) ---------------------------- */
const DEMO_TRACKS = [
  { id: "d1", name: "Amber Skyline", artist_name: "Nova Field", album_image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80", audio: "", duration: 210 },
  { id: "d2", name: "Late Train Home", artist_name: "Wilt & Bloom", album_image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&q=80", audio: "", duration: 185 },
  { id: "d3", name: "Glass Corridors", artist_name: "Halide", album_image: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&q=80", audio: "", duration: 240 },
  { id: "d4", name: "Static Bloom", artist_name: "Nova Field", album_image: "https://images.unsplash.com/photo-1487180144351-b8472da7d491?w=400&q=80", audio: "", duration: 198 },
  { id: "d5", name: "Kite String", artist_name: "Odella", album_image: "https://images.unsplash.com/photo-1458560871784-56d23406c091?w=400&q=80", audio: "", duration: 227 },
  { id: "d6", name: "Low Tide Radio", artist_name: "Wilt & Bloom", album_image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80", audio: "", duration: 172 },
];

const DEMO_PLAYLISTS = [
  { id: "p1", name: "Evening Drift", image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&q=80", tracks: DEMO_TRACKS.slice(0, 4) },
  { id: "p2", name: "Focus Static", image: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=300&q=80", tracks: DEMO_TRACKS.slice(2, 6) },
  { id: "p3", name: "Slow Mornings", image: "https://images.unsplash.com/photo-1487180144351-b8472da7d491?w=300&q=80", tracks: DEMO_TRACKS.slice(1, 5) },
];

const HAS_KEY = Boolean(JAMENDO_CLIENT_ID);

/* ---------------------------- helpers ---------------------------- */
function formatTime(sec) {
  if (!sec && sec !== 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

async function jamendoSearch(query) {
  if (!HAS_KEY) return DEMO_TRACKS.filter(t =>
    t.name.toLowerCase().includes(query.toLowerCase()) ||
    t.artist_name.toLowerCase().includes(query.toLowerCase())
  );
  const url = `${JAMENDO_BASE}/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=json&limit=30&namesearch=${encodeURIComponent(query)}&include=musicinfo&audioformat=mp32`;
  const res = await fetch(url);
  const data = await res.json();
  return data.results || [];
}

async function jamendoPopular() {
  if (!HAS_KEY) return DEMO_TRACKS;
  const url = `${JAMENDO_BASE}/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=json&limit=20&order=popularity_total&audioformat=mp32`;
  const res = await fetch(url);
  const data = await res.json();
  return data.results || [];
}

/* ============================================================================
   MAIN APP
============================================================================ */
export default function App() {
  const [view, setView] = useState("home"); // home | search | library | playlist
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [popular, setPopular] = useState(DEMO_TRACKS);
  const [loadingPopular, setLoadingPopular] = useState(false);
  const [activePlaylist, setActivePlaylist] = useState(null);
  const [likedTracks, setLikedTracks] = useState([]);
  const [playlists, setPlaylists] = useState(DEMO_PLAYLISTS);

  // Player state
  const [queue, setQueue] = useState(DEMO_TRACKS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const audioRef = useRef(null);
  const currentTrack = queue[currentIndex] || null;

  /* ---------- initial popular load ---------- */
  useEffect(() => {
    setLoadingPopular(true);
    jamendoPopular().then(t => {
      setPopular(t.length ? t : DEMO_TRACKS);
      setLoadingPopular(false);
    }).catch(() => { setPopular(DEMO_TRACKS); setLoadingPopular(false); });
  }, []);

  /* ---------- search debounce ---------- */
  useEffect(() => {
    if (!query.trim()) { setSearchResults([]); return; }
    setSearching(true);
    const t = setTimeout(() => {
      jamendoSearch(query).then(r => { setSearchResults(r); setSearching(false); })
        .catch(() => { setSearchResults([]); setSearching(false); });
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  /* ---------- audio element wiring ---------- */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setProgress(audio.currentTime);
    const onDur = () => setDuration(audio.duration || 0);
    const onEnd = () => handleNext();
    const onError = () => setLoadError(true);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onDur);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onDur);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("error", onError);
    };
    // eslint-disable-next-line
  }, [currentIndex, queue]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    setLoadError(false);
    if (currentTrack.audio) {
      audio.src = currentTrack.audio;
      if (isPlaying) audio.play().catch(() => {});
    } else {
      setLoadError(true);
    }
    // eslint-disable-next-line
  }, [currentIndex, queue]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack?.audio) return;
    if (isPlaying) audio.play().catch(() => {}); else audio.pause();
  }, [isPlaying]);

  const playTrackList = useCallback((list, index) => {
    setQueue(list);
    setCurrentIndex(index);
    setIsPlaying(true);
    setProgress(0);
  }, []);

  const togglePlay = () => {
    if (!currentTrack) return;
    setIsPlaying(p => !p);
  };

  const handleNext = () => {
    if (!queue.length) return;
    let next;
    if (shuffle) next = Math.floor(Math.random() * queue.length);
    else next = (currentIndex + 1) % queue.length;
    setCurrentIndex(next);
    setIsPlaying(true);
    setProgress(0);
  };

  const handlePrev = () => {
    if (!queue.length) return;
    if (progress > 3) { audioRef.current.currentTime = 0; setProgress(0); return; }
    const prev = (currentIndex - 1 + queue.length) % queue.length;
    setCurrentIndex(prev);
    setIsPlaying(true);
    setProgress(0);
  };

  const seek = (e) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * duration;
    setProgress(pct * duration);
  };

  const toggleLike = (track) => {
    setLikedTracks(prev => {
      const exists = prev.find(t => t.id === track.id);
      if (exists) return prev.filter(t => t.id !== track.id);
      return [track, ...prev];
    });
  };

  const isLiked = (track) => likedTracks.some(t => t.id === track?.id);

  const accentGradient = useMemo(() => {
    const seed = currentTrack?.id ? String(currentTrack.id).length : 1;
    const hues = ["#7B61FF", "#C4F135", "#FF6B6B", "#3EC6FF"];
    return hues[seed % hues.length];
  }, [currentTrack]);

  return (
    <div className="app-shell">
      <style>{STYLES}</style>
      <audio ref={audioRef} />

      {/* ambient glow tied to current track */}
      <div className="ambient-glow" style={{ background: `radial-gradient(circle at 20% 0%, ${accentGradient}22, transparent 60%)` }} />

      <div className="layout">
        <Sidebar
          view={view}
          setView={setView}
          playlists={playlists}
          activePlaylist={activePlaylist}
          setActivePlaylist={setActivePlaylist}
          likedCount={likedTracks.length}
        />

        <main className="main-pane">
          <TopBar query={query} setQuery={setQuery} setView={setView} />

          <div className="content-scroll">
            {view === "home" && (
              <HomeView
                popular={popular}
                loading={loadingPopular}
                playlists={playlists}
                onPlay={(list, i) => playTrackList(list, i)}
                onOpenPlaylist={(pl) => { setActivePlaylist(pl); setView("playlist"); }}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                toggleLike={toggleLike}
                isLiked={isLiked}
              />
            )}

            {view === "search" && (
              <SearchView
                query={query}
                results={searchResults}
                searching={searching}
                onPlay={(list, i) => playTrackList(list, i)}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                toggleLike={toggleLike}
                isLiked={isLiked}
              />
            )}

            {view === "library" && (
              <LibraryView
                liked={likedTracks}
                onPlay={(list, i) => playTrackList(list, i)}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                toggleLike={toggleLike}
                isLiked={isLiked}
              />
            )}

            {view === "playlist" && activePlaylist && (
              <PlaylistView
                playlist={activePlaylist}
                onBack={() => setView("home")}
                onPlay={(list, i) => playTrackList(list, i)}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                toggleLike={toggleLike}
                isLiked={isLiked}
              />
            )}
          </div>
        </main>
      </div>

      <NowPlayingBar
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
        setRepeat={setRepeat}
        toggleLike={toggleLike}
        isLiked={isLiked}
        loadError={loadError}
        accentGradient={accentGradient}
      />

      {!HAS_KEY && <ApiKeyBanner />}
    </div>
  );
}

/* ============================================================================
   SIDEBAR
============================================================================ */
function Sidebar({ view, setView, playlists, activePlaylist, setActivePlaylist, likedCount }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><Music2 size={22} /></div>
        <span>Wavelen</span>
      </div>

      <nav className="nav-group">
        <button className={`nav-item ${view === "home" ? "active" : ""}`} onClick={() => setView("home")}>
          <Home size={19} /> <span>Home</span>
        </button>
        <button className={`nav-item ${view === "search" ? "active" : ""}`} onClick={() => setView("search")}>
          <Search size={19} /> <span>Search</span>
        </button>
        <button className={`nav-item ${view === "library" ? "active" : ""}`} onClick={() => setView("library")}>
          <Library size={19} /> <span>Your Library</span>
        </button>
      </nav>

      <div className="sidebar-divider" />

      <div className="playlist-block">
        <button className="nav-item">
          <div className="mini-icon"><Plus size={15} /></div>
          <span>Create Playlist</span>
        </button>
        <button className={`nav-item ${view === "library" ? "active" : ""}`} onClick={() => setView("library")}>
          <div className="mini-icon liked"><Heart size={13} fill="currentColor" /></div>
          <span>Liked Songs</span>
          {likedCount > 0 && <span className="count-pill">{likedCount}</span>}
        </button>
      </div>

      <div className="sidebar-divider" />

      <div className="playlist-list">
        {playlists.map(pl => (
          <button
            key={pl.id}
            className={`playlist-row ${activePlaylist?.id === pl.id && view === "playlist" ? "active" : ""}`}
            onClick={() => { setActivePlaylist(pl); setView("playlist"); }}
          >
            <img src={pl.image} alt="" />
            <div className="playlist-row-text">
              <span className="pl-name">{pl.name}</span>
              <span className="pl-sub">Playlist · {pl.tracks.length} songs</span>
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}

/* ============================================================================
   TOP BAR
============================================================================ */
function TopBar({ query, setQuery, setView }) {
  return (
    <div className="topbar">
      <div className="topbar-nav">
        <button className="round-btn"><ChevronLeft size={18} /></button>
        <button className="round-btn"><ChevronRight size={18} /></button>
      </div>
      <div className="search-box">
        <Search size={17} className="search-icon" />
        <input
          placeholder="What do you want to play?"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setView("search"); }}
          onFocus={() => query && setView("search")}
        />
        {query && (
          <button className="clear-btn" onClick={() => setQuery("")}><X size={15} /></button>
        )}
      </div>
      <div className="topbar-spacer" />
    </div>
  );
}

/* ============================================================================
   TRACK ROW
============================================================================ */
function TrackRow({ track, index, list, onPlay, isActive, isPlaying, toggleLike, isLiked }) {
  return (
    <div className={`track-row ${isActive ? "active" : ""}`} onDoubleClick={() => onPlay(list, index)}>
      <div className="track-row-index" onClick={() => onPlay(list, index)}>
        {isActive && isPlaying ? (
          <div className="playing-bars"><span /><span /><span /></div>
        ) : isActive ? (
          <Pause size={14} />
        ) : (
          <>
            <span className="idx-number">{index + 1}</span>
            <Play size={14} className="idx-play" />
          </>
        )}
      </div>
      <img src={track.album_image || track.image} alt="" className="track-row-art" onClick={() => onPlay(list, index)} />
      <div className="track-row-meta" onClick={() => onPlay(list, index)}>
        <span className="track-row-title">{track.name}</span>
        <span className="track-row-artist">{track.artist_name}</span>
      </div>
      <button className={`heart-btn ${isLiked(track) ? "liked" : ""}`} onClick={() => toggleLike(track)}>
        <Heart size={16} fill={isLiked(track) ? "currentColor" : "none"} />
      </button>
      <span className="track-row-duration">{formatTime(track.duration)}</span>
    </div>
  );
}

/* ============================================================================
   HOME VIEW
============================================================================ */
function HomeView({ popular, loading, playlists, onPlay, onOpenPlaylist, currentTrack, isPlaying, toggleLike, isLiked }) {
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  return (
    <div className="view-pad">
      <h1 className="page-title">{greeting}</h1>

      <div className="quick-grid">
        {playlists.map(pl => (
          <button key={pl.id} className="quick-card" onClick={() => onOpenPlaylist(pl)}>
            <img src={pl.image} alt="" />
            <span>{pl.name}</span>
            <div className="quick-play"><Play size={16} fill="#000" /></div>
          </button>
        ))}
      </div>

      <div className="section-header">
        <h2>Popular right now</h2>
      </div>

      {loading ? (
        <div className="loading-row"><Loader2 className="spin" size={22} /> Loading tracks…</div>
      ) : (
        <div className="card-grid">
          {popular.slice(0, 12).map((t, i) => (
            <div key={t.id} className="track-card" onClick={() => onPlay(popular, i)}>
              <div className="track-card-art-wrap">
                <img src={t.album_image || t.image} alt="" />
                <div className="track-card-play"><Play size={18} fill="#000" /></div>
              </div>
              <span className="track-card-title">{t.name}</span>
              <span className="track-card-artist">{t.artist_name}</span>
            </div>
          ))}
        </div>
      )}

      <div className="section-header">
        <h2>Made for you</h2>
      </div>
      <div className="track-list">
        {popular.slice(0, 8).map((t, i) => (
          <TrackRow
            key={t.id} track={t} index={i} list={popular}
            onPlay={onPlay} isActive={currentTrack?.id === t.id} isPlaying={isPlaying}
            toggleLike={toggleLike} isLiked={isLiked}
          />
        ))}
      </div>
    </div>
  );
}

/* ============================================================================
   SEARCH VIEW
============================================================================ */
function SearchView({ query, results, searching, onPlay, currentTrack, isPlaying, toggleLike, isLiked }) {
  const genres = ["Lo-fi", "Ambient", "Acoustic", "Electronic", "Jazz", "Cinematic", "Indie", "Chill"];

  if (!query.trim()) {
    return (
      <div className="view-pad">
        <h1 className="page-title">Browse all</h1>
        <div className="genre-grid">
          {genres.map((g, i) => (
            <div key={g} className="genre-card" style={{ background: GENRE_COLORS[i % GENRE_COLORS.length] }}>
              {g}
            </div>
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
      ) : results.length === 0 ? (
        <div className="empty-state">
          <Radio size={38} />
          <p>No tracks found for "{query}"</p>
          <span>Try a different search term.</span>
        </div>
      ) : (
        <div className="track-list">
          {results.map((t, i) => (
            <TrackRow
              key={t.id} track={t} index={i} list={results}
              onPlay={onPlay} isActive={currentTrack?.id === t.id} isPlaying={isPlaying}
              toggleLike={toggleLike} isLiked={isLiked}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const GENRE_COLORS = ["#7B61FF", "#C4F135", "#FF6B6B", "#3EC6FF", "#FF9F43", "#E356A7", "#4ED9A8", "#B48CFF"];

/* ============================================================================
   LIBRARY VIEW
============================================================================ */
function LibraryView({ liked, onPlay, currentTrack, isPlaying, toggleLike, isLiked }) {
  return (
    <div className="view-pad">
      <h1 className="page-title">Your Library</h1>
      <div className="section-header"><h2>Liked Songs</h2></div>
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
              key={t.id} track={t} index={i} list={liked}
              onPlay={onPlay} isActive={currentTrack?.id === t.id} isPlaying={isPlaying}
              toggleLike={toggleLike} isLiked={isLiked}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   PLAYLIST VIEW
============================================================================ */
function PlaylistView({ playlist, onBack, onPlay, currentTrack, isPlaying, toggleLike, isLiked }) {
  return (
    <div className="view-pad">
      <div className="playlist-hero">
        <img src={playlist.image} alt="" />
        <div className="playlist-hero-text">
          <span className="eyebrow">Playlist</span>
          <h1>{playlist.name}</h1>
          <span className="pl-hero-sub">{playlist.tracks.length} songs</span>
        </div>
      </div>
      <div className="playlist-actions">
        <button className="play-fab" onClick={() => onPlay(playlist.tracks, 0)}>
          <Play size={20} fill="#000" />
        </button>
      </div>
      <div className="track-list">
        {playlist.tracks.map((t, i) => (
          <TrackRow
            key={t.id} track={t} index={i} list={playlist.tracks}
            onPlay={onPlay} isActive={currentTrack?.id === t.id} isPlaying={isPlaying}
            toggleLike={toggleLike} isLiked={isLiked}
          />
        ))}
      </div>
    </div>
  );
}

/* ============================================================================
   NOW PLAYING BAR
============================================================================ */
function NowPlayingBar({
  track, isPlaying, togglePlay, onNext, onPrev, progress, duration, seek,
  volume, setVolume, shuffle, setShuffle, repeat, setRepeat, toggleLike, isLiked,
  loadError, accentGradient
}) {
  const pct = duration ? (progress / duration) * 100 : 0;
  const VolIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className="now-playing-bar">
      <div className="np-left">
        {track ? (
          <>
            <img src={track.album_image || track.image} alt="" className="np-art" />
            <div className="np-meta">
              <span className="np-title">{track.name}</span>
              <span className="np-artist">{track.artist_name}</span>
            </div>
            <button className={`heart-btn ${isLiked(track) ? "liked" : ""}`} onClick={() => toggleLike(track)}>
              <Heart size={16} fill={isLiked(track) ? "currentColor" : "none"} />
            </button>
          </>
        ) : (
          <span className="np-empty">Nothing playing</span>
        )}
      </div>

      <div className="np-center">
        <div className="np-controls">
          <button className={`ctrl-btn ${shuffle ? "on" : ""}`} onClick={() => setShuffle(s => !s)}>
            <Shuffle size={16} />
          </button>
          <button className="ctrl-btn" onClick={onPrev}><SkipBack size={18} fill="currentColor" /></button>
          <button className="play-btn" onClick={togglePlay} disabled={!track}>
            {isPlaying ? <Pause size={17} fill="#000" /> : <Play size={17} fill="#000" style={{ marginLeft: 2 }} />}
          </button>
          <button className="ctrl-btn" onClick={onNext}><SkipForward size={18} fill="currentColor" /></button>
          <button className={`ctrl-btn ${repeat ? "on" : ""}`} onClick={() => setRepeat(r => !r)}>
            <Repeat size={16} />
          </button>
        </div>
        <div className="np-progress">
          <span className="np-time">{formatTime(progress)}</span>
          <div className="progress-track" onClick={seek}>
            <div className="progress-fill" style={{ width: `${pct}%`, background: accentGradient }} />
            <div className="progress-knob" style={{ left: `${pct}%`, background: accentGradient }} />
          </div>
          <span className="np-time">{loadError && track ? "preview only" : formatTime(duration)}</span>
        </div>
      </div>

      <div className="np-right">
        <button className="ctrl-btn"><ListMusic size={17} /></button>
        <div className="volume-control">
          <VolIcon size={17} />
          <div className="volume-track" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
            setVolume(pct);
          }}>
            <div className="volume-fill" style={{ width: `${volume * 100}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   API KEY BANNER
============================================================================ */
function ApiKeyBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="api-banner">
      <span>
        Running on demo tracks. Add your free <strong>Jamendo Client ID</strong> at the top of App.jsx to stream real music.
      </span>
      <button onClick={() => setDismissed(true)}><X size={15} /></button>
    </div>
  );
}

/* ============================================================================
   STYLES
============================================================================ */
const STYLES = `
:root {
  --bg: #0B0E10;
  --surface: #141819;
  --surface-hi: #1C2123;
  --border: #24292b;
  --text: #F2F4F1;
  --text-dim: #9BA3A0;
  --accent: #C4F135;
  --accent-2: #7B61FF;
  --radius: 10px;
}
* { box-sizing: border-box; }
.app-shell {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg);
  color: var(--text);
  height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}
.ambient-glow {
  position: absolute; inset: 0; pointer-events: none; z-index: 0;
  transition: background 1.2s ease;
}
.layout { flex: 1; display: flex; overflow: hidden; z-index: 1; padding: 8px 8px 0 8px; gap: 8px; }

/* Sidebar */
.sidebar {
  width: 260px; flex-shrink: 0; background: var(--surface);
  border-radius: var(--radius); padding: 20px 14px; display: flex; flex-direction: column;
  overflow-y: auto;
}
.brand { display: flex; align-items: center; gap: 10px; padding: 0 10px 22px; font-weight: 800; font-size: 19px; letter-spacing: -0.02em; }
.brand-mark { width: 30px; height: 30px; border-radius: 8px; background: var(--accent); color: #0B0E10; display: flex; align-items: center; justify-content: center; }
.nav-group { display: flex; flex-direction: column; gap: 2px; }
.nav-item {
  display: flex; align-items: center; gap: 14px; background: none; border: none; color: var(--text-dim);
  font-size: 14.5px; font-weight: 700; padding: 9px 10px; border-radius: 6px; cursor: pointer; text-align: left; width: 100%;
  transition: color .15s, background .15s;
}
.nav-item:hover { color: var(--text); background: var(--surface-hi); }
.nav-item.active { color: var(--text); }
.mini-icon { width: 22px; height: 22px; border-radius: 4px; background: var(--surface-hi); display: flex; align-items: center; justify-content: center; color: var(--text-dim); }
.mini-icon.liked { background: linear-gradient(135deg, var(--accent-2), #4353c9); color: #fff; }
.count-pill { margin-left: auto; font-size: 11px; background: var(--surface-hi); padding: 2px 7px; border-radius: 10px; color: var(--text-dim); }
.sidebar-divider { height: 1px; background: var(--border); margin: 12px 4px; }
.playlist-block { display: flex; flex-direction: column; gap: 2px; }
.playlist-list { display: flex; flex-direction: column; gap: 2px; overflow-y: auto; }
.playlist-row {
  display: flex; align-items: center; gap: 10px; background: none; border: none; padding: 6px 8px; border-radius: 6px;
  cursor: pointer; text-align: left; width: 100%; transition: background .15s;
}
.playlist-row:hover, .playlist-row.active { background: var(--surface-hi); }
.playlist-row img { width: 40px; height: 40px; border-radius: 5px; object-fit: cover; flex-shrink: 0; }
.playlist-row-text { display: flex; flex-direction: column; overflow: hidden; }
.pl-name { font-size: 13.5px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pl-sub { font-size: 11.5px; color: var(--text-dim); }

/* Main pane */
.main-pane { flex: 1; background: var(--surface); border-radius: var(--radius); overflow: hidden; display: flex; flex-direction: column; }
.topbar { display: flex; align-items: center; gap: 14px; padding: 14px 24px; }
.topbar-nav { display: flex; gap: 8px; }
.round-btn { width: 32px; height: 32px; border-radius: 50%; background: rgba(0,0,0,.5); border: none; color: var(--text); display: flex; align-items: center; justify-content: center; cursor: pointer; }
.round-btn:hover { background: rgba(0,0,0,.7); }
.search-box { flex: 1; max-width: 420px; display: flex; align-items: center; gap: 10px; background: var(--surface-hi); border-radius: 22px; padding: 9px 16px; }
.search-icon { color: var(--text-dim); flex-shrink: 0; }
.search-box input { flex: 1; background: none; border: none; outline: none; color: var(--text); font-size: 14px; }
.search-box input::placeholder { color: var(--text-dim); }
.clear-btn { background: var(--border); border: none; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; color: var(--text); cursor: pointer; flex-shrink: 0; }
.topbar-spacer { flex: 1; }

.content-scroll { flex: 1; overflow-y: auto; }
.view-pad { padding: 8px 28px 40px; }
.page-title { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; margin: 10px 0 20px; }

.quick-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; margin-bottom: 34px; }
.quick-card {
  display: flex; align-items: center; gap: 14px; background: var(--surface-hi); border: none; border-radius: 6px;
  overflow: hidden; cursor: pointer; position: relative; height: 64px; text-align: left;
}
.quick-card:hover { background: #26302c; }
.quick-card img { width: 64px; height: 64px; object-fit: cover; flex-shrink: 0; }
.quick-card span { font-weight: 700; font-size: 14px; color: var(--text); flex: 1; }
.quick-play {
  width: 34px; height: 34px; border-radius: 50%; background: var(--accent); display: flex; align-items: center; justify-content: center;
  margin-right: 14px; opacity: 0; transform: translateY(6px); transition: all .2s; box-shadow: 0 6px 14px rgba(0,0,0,.4);
}
.quick-card:hover .quick-play { opacity: 1; transform: translateY(0); }

.section-header { display: flex; align-items: baseline; justify-content: space-between; margin: 30px 0 14px; }
.section-header h2 { font-size: 19px; font-weight: 800; letter-spacing: -0.01em; }

.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(155px, 1fr)); gap: 16px; }
.track-card { background: var(--surface-hi); border-radius: 8px; padding: 12px; cursor: pointer; transition: background .18s; }
.track-card:hover { background: #262f2c; }
.track-card-art-wrap { position: relative; margin-bottom: 10px; }
.track-card-art-wrap img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px; display: block; }
.track-card-play {
  position: absolute; bottom: 6px; right: 6px; width: 38px; height: 38px; border-radius: 50%; background: var(--accent);
  display: flex; align-items: center; justify-content: center; opacity: 0; transform: translateY(6px);
  transition: all .2s; box-shadow: 0 8px 18px rgba(0,0,0,.5);
}
.track-card:hover .track-card-play { opacity: 1; transform: translateY(0); }
.track-card-title { display: block; font-size: 14px; font-weight: 700; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.track-card-artist { display: block; font-size: 12.5px; color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.loading-row { display: flex; align-items: center; gap: 10px; color: var(--text-dim); padding: 30px 0; font-size: 14px; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.track-list { display: flex; flex-direction: column; }
.track-row {
  display: grid; grid-template-columns: 32px 42px 1fr 32px 50px; align-items: center; gap: 14px;
  padding: 7px 10px; border-radius: 6px; cursor: default; transition: background .1s;
}
.track-row:hover { background: var(--surface-hi); }
.track-row.active .track-row-title { color: var(--accent); }
.track-row-index { display: flex; align-items: center; justify-content: center; color: var(--text-dim); font-size: 13.5px; cursor: pointer; position: relative; }
.idx-play { display: none; }
.track-row:hover .idx-number { display: none; }
.track-row:hover .idx-play { display: block; color: var(--text); }
.playing-bars { display: flex; align-items: flex-end; gap: 2px; height: 14px; }
.playing-bars span { width: 3px; background: var(--accent); animation: bar 1s ease-in-out infinite; border-radius: 1px; }
.playing-bars span:nth-child(1) { height: 40%; animation-delay: 0s; }
.playing-bars span:nth-child(2) { height: 100%; animation-delay: .2s; }
.playing-bars span:nth-child(3) { height: 65%; animation-delay: .4s; }
@keyframes bar { 0%, 100% { height: 30%; } 50% { height: 100%; } }
.track-row-art { width: 42px; height: 42px; border-radius: 4px; object-fit: cover; cursor: pointer; }
.track-row-meta { display: flex; flex-direction: column; overflow: hidden; cursor: pointer; }
.track-row-title { font-size: 14px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.track-row-artist { font-size: 12.5px; color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.track-row-duration { font-size: 13px; color: var(--text-dim); text-align: right; }
.heart-btn { background: none; border: none; color: var(--text-dim); cursor: pointer; display: flex; align-items: center; justify-content: center; }
.heart-btn:hover { color: var(--text); }
.heart-btn.liked { color: var(--accent-2); }

.genre-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; }
.genre-card { height: 100px; border-radius: 8px; padding: 16px; font-weight: 800; font-size: 17px; color: #0B0E10; cursor: pointer; }

.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 60px 0; color: var(--text-dim); text-align: center; }
.empty-state p { color: var(--text); font-weight: 700; font-size: 15px; margin: 6px 0 0; }
.empty-state span { font-size: 13px; }

.playlist-hero { display: flex; align-items: flex-end; gap: 20px; padding: 20px 0 10px; }
.playlist-hero img { width: 180px; height: 180px; object-fit: cover; border-radius: 8px; box-shadow: 0 16px 40px rgba(0,0,0,.5); }
.playlist-hero-text { display: flex; flex-direction: column; gap: 6px; }
.eyebrow { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-dim); }
.playlist-hero-text h1 { font-size: 42px; font-weight: 900; letter-spacing: -0.03em; margin: 0; }
.pl-hero-sub { font-size: 13px; color: var(--text-dim); }
.playlist-actions { padding: 20px 0; }
.play-fab { width: 56px; height: 56px; border-radius: 50%; background: var(--accent); border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 8px 20px rgba(196,241,53,.3); transition: transform .15s; }
.play-fab:hover { transform: scale(1.06); }

/* Now Playing Bar */
.now-playing-bar {
  height: 84px; flex-shrink: 0; background: var(--surface); margin: 8px; border-radius: var(--radius);
  display: grid; grid-template-columns: 1fr 2fr 1fr; align-items: center; padding: 0 16px; z-index: 2; gap: 12px;
}
.np-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.np-art { width: 56px; height: 56px; border-radius: 6px; object-fit: cover; }
.np-meta { display: flex; flex-direction: column; overflow: hidden; }
.np-title { font-size: 13.5px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.np-artist { font-size: 12px; color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.np-empty { color: var(--text-dim); font-size: 13px; }

.np-center { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.np-controls { display: flex; align-items: center; gap: 18px; }
.ctrl-btn { background: none; border: none; color: var(--text-dim); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: color .15s; }
.ctrl-btn:hover { color: var(--text); }
.ctrl-btn.on { color: var(--accent); }
.play-btn { width: 32px; height: 32px; border-radius: 50%; background: #fff; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform .12s; }
.play-btn:hover { transform: scale(1.06); }
.play-btn:disabled { opacity: .5; cursor: default; }
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

.api-banner {
  position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%); z-index: 10;
  background: var(--surface-hi); border: 1px solid var(--border); border-radius: 8px; padding: 10px 16px;
  display: flex; align-items: center; gap: 14px; font-size: 12.5px; color: var(--text-dim); max-width: 480px;
  box-shadow: 0 10px 30px rgba(0,0,0,.4);
}
.api-banner strong { color: var(--accent); }
.api-banner button { background: none; border: none; color: var(--text-dim); cursor: pointer; flex-shrink: 0; }

@media (max-width: 900px) {
  .sidebar { display: none; }
  .now-playing-bar { grid-template-columns: 1fr auto; }
  .np-center { display: none; }
}
`;
