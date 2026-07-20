import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Search, Home, Library, Heart, Play, Pause, SkipBack, SkipForward,
  Volume2, Volume1, VolumeX, Repeat, Shuffle, Plus, ListMusic,
  Loader2, Music2, X, ChevronLeft, Radio, MoreHorizontal
} from "lucide-react";

/* ------------------------------------------------------------------
  YOUTUBE CONFIG — API key is set. App streams real songs via YouTube.
------------------------------------------------------------------- */
const YT_API_KEY = "AIzaSyDRjilmeoNKlF8IJOw57B-2wEH9O7SWYZY";
const YT_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";

const DEFAULT_QUERIES = [
  "Sidhu Moosewala hit songs",
  "AP Dhillon songs",
  "Arijit Singh hit songs",
  "Bollywood top songs 2026",
  "Punjabi hit songs 2026",
];

const GENRES = [
  { name: "Punjabi", query: "Punjabi hit songs", color: "#7B61FF" },
  { name: "Bollywood", query: "Bollywood hit songs", color: "#C4F135" },
  { name: "Hip Hop", query: "hip hop hit songs", color: "#FF6B6B" },
  { name: "Romantic", query: "romantic hindi songs", color: "#3EC6FF" },
  { name: "Party", query: "party songs Punjabi Bollywood", color: "#FF9F43" },
  { name: "Lo-fi", query: "lofi chill songs", color: "#E356A7" },
  { name: "English Pop", query: "english pop hit songs 2026", color: "#4ED9A8" },
  { name: "Old Classics", query: "old bollywood classic songs", color: "#B48CFF" },
];

/* ---------------------------- helpers ---------------------------- */
function formatTime(sec) {
  if (!sec && sec !== 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function trackFromYTItem(item) {
  const vid = item.id.videoId;
  const sn = item.snippet;
  return {
    id: vid,
    name: sn.title.replace(/\(Official.*?\)|\[Official.*?\]/gi, "").trim(),
    artist_name: sn.channelTitle,
    image: sn.thumbnails?.high?.url || sn.thumbnails?.medium?.url || sn.thumbnails?.default?.url,
  };
}

async function ytSearch(query, maxResults = 25) {
  const url = `${YT_SEARCH_URL}?part=snippet&type=video&videoCategoryId=10&maxResults=${maxResults}&q=${encodeURIComponent(query)}&key=${YT_API_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) {
      console.error("YouTube API error:", data.error.message);
      return { error: data.error.message, results: [] };
    }
    return { error: null, results: (data.items || []).map(trackFromYTItem) };
  } catch (err) {
    console.error("ytSearch failed:", err);
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

  const [popular, setPopular] = useState([]);
  const [loadingPopular, setLoadingPopular] = useState(true);
  const [popularError, setPopularError] = useState(null);

  const [playlists, setPlaylists] = useState([]); // {id, name, image, tracks:[]}
  const [activePlaylist, setActivePlaylist] = useState(null);
  const [likedTracks, setLikedTracks] = useState([]);

  // Player state
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(70);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [buffering, setBuffering] = useState(false);

  const ytPlayerRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const currentTrack = queue[currentIndex] || null;

  /* ---------- load YouTube IFrame API ---------- */
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
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => setPlayerReady(true),
          onStateChange: onPlayerStateChange,
        },
      });
    }
    // eslint-disable-next-line
  }, []);

  const onPlayerStateChange = (e) => {
    // 0 = ended, 1 = playing, 2 = paused, 3 = buffering
    if (e.data === 0) handleNextRef.current?.();
    if (e.data === 1) { setIsPlaying(true); setBuffering(false); }
    if (e.data === 2) setIsPlaying(false);
    if (e.data === 3) setBuffering(true);
  };

  /* ---------- initial content load ---------- */
  useEffect(() => {
    setLoadingPopular(true);
    const randomQuery = DEFAULT_QUERIES[Math.floor(Math.random() * DEFAULT_QUERIES.length)];
    ytSearch(randomQuery, 20).then(({ error, results }) => {
      if (error) setPopularError(error);
      setPopular(results);
      setLoadingPopular(false);
    });

    // build a couple of starter playlists from curated queries
    Promise.all([
      ytSearch("Sidhu Moosewala all songs", 12),
      ytSearch("Arijit Singh romantic songs", 12),
      ytSearch("Punjabi party songs", 12),
    ]).then(([a, b, c]) => {
      const built = [
        { id: "pl-1", name: "Sidhu Moosewala Mix", image: a.results[0]?.image, tracks: a.results },
        { id: "pl-2", name: "Arijit Singh Romantic", image: b.results[0]?.image, tracks: b.results },
        { id: "pl-3", name: "Punjabi Party", image: c.results[0]?.image, tracks: c.results },
      ].filter(p => p.tracks.length > 0);
      setPlaylists(built);
    });
  }, []);

  /* ---------- search debounce ---------- */
  useEffect(() => {
    if (!query.trim()) { setSearchResults([]); setSearchError(null); return; }
    setSearching(true);
    const t = setTimeout(() => {
      ytSearch(query, 25).then(({ error, results }) => {
        setSearchError(error);
        setSearchResults(results);
        setSearching(false);
      });
    }, 450);
    return () => clearTimeout(t);
  }, [query]);

  /* ---------- play current track when index/queue changes ---------- */
  useEffect(() => {
    if (!playerReady || !currentTrack || !ytPlayerRef.current) return;
    setBuffering(true);
    setProgress(0);
    setDuration(0);
    ytPlayerRef.current.loadVideoById(currentTrack.id);
    ytPlayerRef.current.setVolume(volume);
    // duration polling
    const durCheck = setInterval(() => {
      try {
        const d = ytPlayerRef.current.getDuration();
        if (d > 0) { setDuration(d); clearInterval(durCheck); }
      } catch (e) {}
    }, 300);
    return () => clearInterval(durCheck);
    // eslint-disable-next-line
  }, [currentIndex, queue, playerReady]);

  /* ---------- progress polling ---------- */
  useEffect(() => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = setInterval(() => {
      if (ytPlayerRef.current && isPlaying && ytPlayerRef.current.getCurrentTime) {
        try { setProgress(ytPlayerRef.current.getCurrentTime()); } catch (e) {}
      }
    }, 500);
    return () => clearInterval(progressIntervalRef.current);
  }, [isPlaying]);

  useEffect(() => {
    if (ytPlayerRef.current && ytPlayerRef.current.setVolume) {
      try { ytPlayerRef.current.setVolume(volume); } catch (e) {}
    }
  }, [volume]);

  const playTrackList = useCallback((list, index) => {
    setQueue(list);
    setCurrentIndex(index);
    setIsPlaying(true);
  }, []);

  const togglePlay = () => {
    if (!currentTrack || !ytPlayerRef.current) return;
    if (isPlaying) ytPlayerRef.current.pauseVideo();
    else ytPlayerRef.current.playVideo();
  };

  const handleNext = useCallback(() => {
    if (!queue.length) return;
    let next;
    if (shuffle) next = Math.floor(Math.random() * queue.length);
    else next = (currentIndex + 1) % queue.length;
    setCurrentIndex(next);
    setIsPlaying(true);
  }, [queue, currentIndex, shuffle]);

  const handleNextRef = useRef(handleNext);
  useEffect(() => { handleNextRef.current = handleNext; }, [handleNext]);

  const handlePrev = () => {
    if (!queue.length || !ytPlayerRef.current) return;
    if (progress > 3) { ytPlayerRef.current.seekTo(0); setProgress(0); return; }
    const prev = (currentIndex - 1 + queue.length) % queue.length;
    setCurrentIndex(prev);
    setIsPlaying(true);
  };

  const seek = (e) => {
    if (!ytPlayerRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    ytPlayerRef.current.seekTo(pct * duration, true);
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
  const canGoBack = viewHistory.length > 1;

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

  const accentGradient = useMemo(() => {
    const seed = currentTrack?.id ? String(currentTrack.id).length : 1;
    const hues = ["#7B61FF", "#C4F135", "#FF6B6B", "#3EC6FF"];
    return hues[seed % hues.length];
  }, [currentTrack]);

  return (
    <div className="app-shell">
      <style>{STYLES}</style>
      <div id="yt-player-hidden" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} />

      <div className="ambient-glow" style={{ background: `radial-gradient(circle at 20% 0%, ${accentGradient}22, transparent 60%)` }} />

      <div className="layout">
        <Sidebar view={view} navigateTo={navigateTo} playlists={playlists} activePlaylist={activePlaylist}
          setActivePlaylist={setActivePlaylist} likedCount={likedTracks.length} />

        <main className="main-pane">
          <TopBar query={query} setQuery={setQuery} navigateTo={navigateTo} goBack={goBack} canGoBack={canGoBack} />

          <div className="content-scroll">
            {view === "home" && (
              <HomeView popular={popular} loading={loadingPopular} error={popularError} playlists={playlists}
                onPlay={playTrackList} onOpenPlaylist={(pl) => { setActivePlaylist(pl); navigateTo("playlist"); }}
                currentTrack={currentTrack} isPlaying={isPlaying} toggleLike={toggleLike} isLiked={isLiked} />
            )}
            {view === "search" && (
              <SearchView query={query} results={searchResults} searching={searching} error={searchError}
                onPlay={playTrackList} currentTrack={currentTrack} isPlaying={isPlaying}
                toggleLike={toggleLike} isLiked={isLiked} onOpenGenre={openGenre} />
            )}
            {view === "genre" && (
              <GenreResultsView genre={activeGenre} results={searchResults} searching={searching} error={searchError}
                onPlay={playTrackList} currentTrack={currentTrack} isPlaying={isPlaying}
                toggleLike={toggleLike} isLiked={isLiked} />
            )}
            {view === "library" && (
              <LibraryView liked={likedTracks} playlists={playlists} onPlay={playTrackList}
                currentTrack={currentTrack} isPlaying={isPlaying} toggleLike={toggleLike} isLiked={isLiked}
                onOpenPlaylist={(pl) => { setActivePlaylist(pl); navigateTo("playlist"); }} />
            )}
            {view === "playlist" && activePlaylist && (
              <PlaylistView playlist={activePlaylist} onBack={goBack} onPlay={playTrackList}
                currentTrack={currentTrack} isPlaying={isPlaying} toggleLike={toggleLike} isLiked={isLiked} />
            )}
          </div>
        </main>
      </div>

      <NowPlayingBar
        track={currentTrack} isPlaying={isPlaying} togglePlay={togglePlay} onNext={handleNext} onPrev={handlePrev}
        progress={progress} duration={duration} seek={seek} volume={volume} setVolume={setVolume}
        shuffle={shuffle} setShuffle={setShuffle} repeat={repeat} setRepeat={setRepeat}
        toggleLike={toggleLike} isLiked={isLiked} buffering={buffering} accentGradient={accentGradient}
      />

      <BottomNav view={view} navigateTo={navigateTo} hasTrack={!!currentTrack} />
    </div>
  );
}

/* ============================================================================
   SIDEBAR (desktop)
============================================================================ */
function Sidebar({ view, navigateTo, playlists, activePlaylist, setActivePlaylist, likedCount }) {
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
            <img src={pl.image} alt="" />
            <div className="playlist-row-text"><span className="pl-name">{pl.name}</span><span className="pl-sub">Playlist · {pl.tracks.length} songs</span></div>
          </button>
        ))}
      </div>
    </aside>
  );
}

/* ============================================================================
   BOTTOM NAV (mobile) — Spotify-style
============================================================================ */
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

/* ============================================================================
   TOP BAR
============================================================================ */
function TopBar({ query, setQuery, navigateTo, goBack, canGoBack }) {
  return (
    <div className="topbar">
      <div className="topbar-nav">
        <button className="round-btn" onClick={goBack} disabled={!canGoBack}><ChevronLeft size={18} /></button>
      </div>
      <div className="search-box">
        <Search size={17} className="search-icon" />
        <input placeholder="What do you want to play?" value={query}
          onChange={(e) => { setQuery(e.target.value); navigateTo("search"); }}
          onFocus={() => query && navigateTo("search")} />
        {query && <button className="clear-btn" onClick={() => setQuery("")}><X size={15} /></button>}
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
    </div>
  );
}

/* ============================================================================
   HOME VIEW
============================================================================ */
function HomeView({ popular, loading, error, playlists, onPlay, onOpenPlaylist, currentTrack, isPlaying, toggleLike, isLiked }) {
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  return (
    <div className="view-pad">
      <h1 className="page-title">{greeting}</h1>

      {playlists.length > 0 && (
        <div className="quick-grid">
          {playlists.map(pl => (
            <button key={pl.id} className="quick-card" onClick={() => onOpenPlaylist(pl)}>
              <img src={pl.image} alt="" />
              <span>{pl.name}</span>
              <div className="quick-play"><Play size={16} fill="#000" /></div>
            </button>
          ))}
        </div>
      )}

      <div className="section-header"><h2>Trending now</h2></div>

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
                <div className="track-card-play"><Play size={18} fill="#000" /></div>
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
                isActive={currentTrack?.id === t.id} isPlaying={isPlaying} toggleLike={toggleLike} isLiked={isLiked} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================================================
   SEARCH VIEW
============================================================================ */
function SearchView({ query, results, searching, error, onPlay, currentTrack, isPlaying, toggleLike, isLiked, onOpenGenre }) {
  if (!query.trim()) {
    return (
      <div className="view-pad">
        <h1 className="page-title">Browse all</h1>
        <div className="genre-grid">
          {GENRES.map((g) => (
            <button key={g.name} className="genre-card" style={{ background: g.color }} onClick={() => onOpenGenre(g)}>
              {g.name}
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
      ) : error ? (
        <ErrorState message={error} />
      ) : results.length === 0 ? (
        <div className="empty-state"><Radio size={38} /><p>No songs found for "{query}"</p><span>Try a different search term.</span></div>
      ) : (
        <div className="track-list">
          {results.map((t, i) => (
            <TrackRow key={t.id} track={t} index={i} list={results} onPlay={onPlay}
              isActive={currentTrack?.id === t.id} isPlaying={isPlaying} toggleLike={toggleLike} isLiked={isLiked} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   GENRE RESULTS VIEW
============================================================================ */
function GenreResultsView({ genre, results, searching, error, onPlay, currentTrack, isPlaying, toggleLike, isLiked }) {
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
              isActive={currentTrack?.id === t.id} isPlaying={isPlaying} toggleLike={toggleLike} isLiked={isLiked} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   LIBRARY VIEW
============================================================================ */
function LibraryView({ liked, playlists, onPlay, currentTrack, isPlaying, toggleLike, isLiked, onOpenPlaylist }) {
  return (
    <div className="view-pad">
      <h1 className="page-title">Your Library</h1>

      {playlists.length > 0 && (
        <>
          <div className="section-header"><h2>Playlists</h2></div>
          <div className="quick-grid" style={{ marginBottom: 30 }}>
            {playlists.map(pl => (
              <button key={pl.id} className="quick-card" onClick={() => onOpenPlaylist(pl)}>
                <img src={pl.image} alt="" />
                <span>{pl.name}</span>
                <div className="quick-play"><Play size={16} fill="#000" /></div>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="section-header"><h2>Liked Songs</h2></div>
      {liked.length === 0 ? (
        <div className="empty-state"><Heart size={38} /><p>Songs you like will appear here</p><span>Tap the heart icon on any track to save it.</span></div>
      ) : (
        <div className="track-list">
          {liked.map((t, i) => (
            <TrackRow key={t.id} track={t} index={i} list={liked} onPlay={onPlay}
              isActive={currentTrack?.id === t.id} isPlaying={isPlaying} toggleLike={toggleLike} isLiked={isLiked} />
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
        <button className="play-fab" onClick={() => onPlay(playlist.tracks, 0)}><Play size={20} fill="#000" /></button>
      </div>
      <div className="track-list">
        {playlist.tracks.map((t, i) => (
          <TrackRow key={t.id} track={t} index={i} list={playlist.tracks} onPlay={onPlay}
            isActive={currentTrack?.id === t.id} isPlaying={isPlaying} toggleLike={toggleLike} isLiked={isLiked} />
        ))}
      </div>
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
   NOW PLAYING BAR
============================================================================ */
function NowPlayingBar({ track, isPlaying, togglePlay, onNext, onPrev, progress, duration, seek, volume, setVolume,
  shuffle, setShuffle, repeat, setRepeat, toggleLike, isLiked, buffering, accentGradient }) {
  const pct = duration ? (progress / duration) * 100 : 0;
  const VolIcon = volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;

  if (!track) {
    return (
      <div className="now-playing-bar empty-bar">
        <span className="np-empty">Pick a song to start listening</span>
      </div>
    );
  }

  return (
    <div className="now-playing-bar">
      <div className="np-left">
        <img src={track.image} alt="" className="np-art" />
        <div className="np-meta">
          <span className="np-title">{track.name}</span>
          <span className="np-artist">{track.artist_name}</span>
        </div>
        <button className={`heart-btn desktop-only ${isLiked(track) ? "liked" : ""}`} onClick={() => toggleLike(track)}>
          <Heart size={16} fill={isLiked(track) ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="np-center">
        <div className="np-controls">
          <button className={`ctrl-btn desktop-only ${shuffle ? "on" : ""}`} onClick={() => setShuffle(s => !s)}><Shuffle size={16} /></button>
          <button className="ctrl-btn" onClick={onPrev}><SkipBack size={18} fill="currentColor" /></button>
          <button className="play-btn" onClick={togglePlay}>
            {buffering ? <Loader2 size={16} className="spin" /> : isPlaying ? <Pause size={17} fill="#000" /> : <Play size={17} fill="#000" style={{ marginLeft: 2 }} />}
          </button>
          <button className="ctrl-btn" onClick={onNext}><SkipForward size={18} fill="currentColor" /></button>
          <button className={`ctrl-btn desktop-only ${repeat ? "on" : ""}`} onClick={() => setRepeat(r => !r)}><Repeat size={16} /></button>
        </div>
        <div className="np-progress desktop-only">
          <span className="np-time">{formatTime(progress)}</span>
          <div className="progress-track" onClick={seek}>
            <div className="progress-fill" style={{ width: `${pct}%`, background: accentGradient }} />
            <div className="progress-knob" style={{ left: `${pct}%`, background: accentGradient }} />
          </div>
          <span className="np-time">{formatTime(duration)}</span>
        </div>
        <div className="progress-track mobile-only" onClick={seek}>
          <div className="progress-fill" style={{ width: `${pct}%`, background: accentGradient }} />
        </div>
      </div>

      <div className="np-right desktop-only">
        <div className="volume-control">
          <VolIcon size={17} />
          <div className="volume-track" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
            setVolume(Math.round(pct * 100));
          }}>
            <div className="volume-fill" style={{ width: `${volume}%` }} />
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
  background: var(--bg); color: var(--text); height: 100vh; width: 100%;
  display: flex; flex-direction: column; overflow: hidden; position: relative;
}
.ambient-glow { position: absolute; inset: 0; pointer-events: none; z-index: 0; transition: background 1.2s ease; }
.layout { flex: 1; display: flex; overflow: hidden; z-index: 1; padding: 8px 8px 0 8px; gap: 8px; }

/* Sidebar (desktop only) */
.sidebar { width: 260px; flex-shrink: 0; background: var(--surface); border-radius: var(--radius); padding: 20px 14px; display: flex; flex-direction: column; overflow-y: auto; }
.brand { display: flex; align-items: center; gap: 10px; padding: 0 10px 22px; font-weight: 800; font-size: 19px; letter-spacing: -0.02em; }
.brand-mark { width: 30px; height: 30px; border-radius: 8px; background: var(--accent); color: #0B0E10; display: flex; align-items: center; justify-content: center; }
.nav-group { display: flex; flex-direction: column; gap: 2px; }
.nav-item { display: flex; align-items: center; gap: 14px; background: none; border: none; color: var(--text-dim); font-size: 14.5px; font-weight: 700; padding: 9px 10px; border-radius: 6px; cursor: pointer; text-align: left; width: 100%; transition: color .15s, background .15s; }
.nav-item:hover { color: var(--text); background: var(--surface-hi); }
.nav-item.active { color: var(--text); }
.mini-icon { width: 22px; height: 22px; border-radius: 4px; background: var(--surface-hi); display: flex; align-items: center; justify-content: center; color: var(--text-dim); }
.mini-icon.liked { background: linear-gradient(135deg, var(--accent-2), #4353c9); color: #fff; }
.count-pill { margin-left: auto; font-size: 11px; background: var(--surface-hi); padding: 2px 7px; border-radius: 10px; color: var(--text-dim); }
.sidebar-divider { height: 1px; background: var(--border); margin: 12px 4px; }
.playlist-block { display: flex; flex-direction: column; gap: 2px; }
.playlist-list { display: flex; flex-direction: column; gap: 2px; overflow-y: auto; }
.playlist-row { display: flex; align-items: center; gap: 10px; background: none; border: none; padding: 6px 8px; border-radius: 6px; cursor: pointer; text-align: left; width: 100%; transition: background .15s; }
.playlist-row:hover, .playlist-row.active { background: var(--surface-hi); }
.playlist-row img { width: 40px; height: 40px; border-radius: 5px; object-fit: cover; flex-shrink: 0; background: var(--surface-hi); }
.playlist-row-text { display: flex; flex-direction: column; overflow: hidden; }
.pl-name { font-size: 13.5px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pl-sub { font-size: 11.5px; color: var(--text-dim); }

/* Main pane */
.main-pane { flex: 1; background: var(--surface); border-radius: var(--radius); overflow: hidden; display: flex; flex-direction: column; }
.topbar { display: flex; align-items: center; gap: 14px; padding: 14px 24px; }
.topbar-nav { display: flex; gap: 8px; }
.round-btn { width: 32px; height: 32px; border-radius: 50%; background: rgba(0,0,0,.5); border: none; color: var(--text); display: flex; align-items: center; justify-content: center; cursor: pointer; }
.round-btn:hover:not(:disabled) { background: rgba(0,0,0,.7); }
.round-btn:disabled { opacity: .35; cursor: default; }
.search-box { flex: 1; max-width: 420px; display: flex; align-items: center; gap: 10px; background: var(--surface-hi); border-radius: 22px; padding: 9px 16px; }
.search-icon { color: var(--text-dim); flex-shrink: 0; }
.search-box input { flex: 1; background: none; border: none; outline: none; color: var(--text); font-size: 14px; min-width: 0; }
.search-box input::placeholder { color: var(--text-dim); }
.clear-btn { background: var(--border); border: none; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; color: var(--text); cursor: pointer; flex-shrink: 0; }
.topbar-spacer { flex: 1; }

.content-scroll { flex: 1; overflow-y: auto; }
.view-pad { padding: 8px 28px 120px; }
.page-title { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; margin: 10px 0 20px; }

.quick-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; margin-bottom: 34px; }
.quick-card { display: flex; align-items: center; gap: 14px; background: var(--surface-hi); border: none; border-radius: 6px; overflow: hidden; cursor: pointer; position: relative; height: 64px; text-align: left; }
.quick-card:hover { background: #26302c; }
.quick-card img { width: 64px; height: 64px; object-fit: cover; flex-shrink: 0; background: var(--border); }
.quick-card span { font-weight: 700; font-size: 14px; color: var(--text); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.quick-play { width: 34px; height: 34px; border-radius: 50%; background: var(--accent); display: flex; align-items: center; justify-content: center; margin-right: 14px; opacity: 0; transform: translateY(6px); transition: all .2s; box-shadow: 0 6px 14px rgba(0,0,0,.4); flex-shrink: 0; }
.quick-card:hover .quick-play { opacity: 1; transform: translateY(0); }

.section-header { display: flex; align-items: baseline; justify-content: space-between; margin: 30px 0 14px; }
.section-header h2 { font-size: 19px; font-weight: 800; letter-spacing: -0.01em; }

.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(155px, 1fr)); gap: 16px; }
.track-card { background: var(--surface-hi); border-radius: 8px; padding: 12px; cursor: pointer; transition: background .18s; }
.track-card:hover { background: #262f2c; }
.track-card-art-wrap { position: relative; margin-bottom: 10px; }
.track-card-art-wrap img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px; display: block; background: var(--border); }
.track-card-play { position: absolute; bottom: 6px; right: 6px; width: 38px; height: 38px; border-radius: 50%; background: var(--accent); display: flex; align-items: center; justify-content: center; opacity: 0; transform: translateY(6px); transition: all .2s; box-shadow: 0 8px 18px rgba(0,0,0,.5); }
.track-card:hover .track-card-play { opacity: 1; transform: translateY(0); }
.track-card-title { display: block; font-size: 14px; font-weight: 700; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.track-card-artist { display: block; font-size: 12.5px; color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.loading-row { display: flex; align-items: center; gap: 10px; color: var(--text-dim); padding: 30px 0; font-size: 14px; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.track-list { display: flex; flex-direction: column; }
.track-row { display: grid; grid-template-columns: 32px 42px 1fr 32px; align-items: center; gap: 14px; padding: 8px 10px; border-radius: 6px; cursor: pointer; transition: background .1s; }
.track-row:hover { background: var(--surface-hi); }
.track-row.active .track-row-title { color: var(--accent); }
.track-row-index { display: flex; align-items: center; justify-content: center; color: var(--text-dim); font-size: 13.5px; position: relative; }
.idx-play { display: none; }
.track-row:hover .idx-number { display: none; }
.track-row:hover .idx-play { display: block; color: var(--text); }
.playing-bars { display: flex; align-items: flex-end; gap: 2px; height: 14px; }
.playing-bars span { width: 3px; background: var(--accent); animation: bar 1s ease-in-out infinite; border-radius: 1px; }
.playing-bars span:nth-child(1) { height: 40%; animation-delay: 0s; }
.playing-bars span:nth-child(2) { height: 100%; animation-delay: .2s; }
.playing-bars span:nth-child(3) { height: 65%; animation-delay: .4s; }
@keyframes bar { 0%, 100% { height: 30%; } 50% { height: 100%; } }
.track-row-art { width: 42px; height: 42px; border-radius: 4px; object-fit: cover; background: var(--border); }
.track-row-meta { display: flex; flex-direction: column; overflow: hidden; }
.track-row-title { font-size: 14px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.track-row-artist { font-size: 12.5px; color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.heart-btn { background: none; border: none; color: var(--text-dim); cursor: pointer; display: flex; align-items: center; justify-content: center; }
.heart-btn:hover { color: var(--text); }
.heart-btn.liked { color: var(--accent-2); }

.genre-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; }
.genre-card { height: 100px; border: none; border-radius: 8px; padding: 16px; font-weight: 800; font-size: 17px; color: #0B0E10; cursor: pointer; text-align: left; font-family: inherit; transition: transform .15s, filter .15s; }
.genre-card:hover { transform: translateY(-2px); filter: brightness(1.08); }

.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 60px 20px; color: var(--text-dim); text-align: center; }
.empty-state p { color: var(--text); font-weight: 700; font-size: 15px; margin: 6px 0 0; }
.empty-state span { font-size: 13px; }

.playlist-hero { display: flex; align-items: flex-end; gap: 20px; padding: 20px 0 10px; flex-wrap: wrap; }
.playlist-hero img { width: 180px; height: 180px; object-fit: cover; border-radius: 8px; box-shadow: 0 16px 40px rgba(0,0,0,.5); background: var(--border); }
.playlist-hero-text { display: flex; flex-direction: column; gap: 6px; }
.eyebrow { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-dim); }
.playlist-hero-text h1 { font-size: 36px; font-weight: 900; letter-spacing: -0.03em; margin: 0; }
.pl-hero-sub { font-size: 13px; color: var(--text-dim); }
.playlist-actions { padding: 20px 0; }
.play-fab { width: 56px; height: 56px; border-radius: 50%; background: var(--accent); border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 8px 20px rgba(196,241,53,.3); transition: transform .15s; }
.play-fab:hover { transform: scale(1.06); }

/* Now Playing Bar */
.now-playing-bar { height: 72px; flex-shrink: 0; background: var(--surface); margin: 8px; border-radius: var(--radius); display: grid; grid-template-columns: 1fr 2fr 1fr; align-items: center; padding: 0 16px; z-index: 3; gap: 12px; }
.now-playing-bar.empty-bar { display: flex; align-items: center; justify-content: center; height: 56px; }
.np-empty { color: var(--text-dim); font-size: 13px; }
.np-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.np-art { width: 48px; height: 48px; border-radius: 6px; object-fit: cover; flex-shrink: 0; background: var(--border); }
.np-meta { display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
.np-title { font-size: 13.5px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.np-artist { font-size: 12px; color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.np-center { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; width: 100%; }
.np-controls { display: flex; align-items: center; gap: 18px; }
.ctrl-btn { background: none; border: none; color: var(--text-dim); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: color .15s; }
.ctrl-btn:hover { color: var(--text); }
.ctrl-btn.on { color: var(--accent); }
.play-btn { width: 34px; height: 34px; border-radius: 50%; background: #fff; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform .12s; flex-shrink: 0; }
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

/* Bottom nav — mobile, Spotify-style */
.bottom-nav { display: none; }
.mobile-only { display: none; }

@media (max-width: 900px) {
  .sidebar { display: none; }
  .layout { padding: 0; }
  .main-pane { border-radius: 0; }
  .view-pad { padding: 8px 16px 130px; }

  .now-playing-bar { grid-template-columns: 1fr auto; margin: 0; border-radius: 0; position: fixed; left: 0; right: 0; bottom: 56px; height: 60px; padding: 0 10px; background: #1c2123ee; backdrop-filter: blur(10px); border-top: 1px solid var(--border); }
  .np-center { display: none; }
  .desktop-only { display: none !important; }
  .mobile-only { display: block; position: absolute; left: 0; right: 0; bottom: 0; height: 2px; border-radius: 0; }
  .np-art { width: 40px; height: 40px; }
  .np-left { flex: 1; }
  .now-playing-bar .ctrl-btn, .now-playing-bar .play-btn { flex-shrink: 0; }
  .now-playing-bar > .np-left { display: flex; }
  .now-playing-bar::after { content: ""; }

  .bottom-nav { display: flex; position: fixed; left: 0; right: 0; bottom: 0; height: 56px; background: var(--surface); border-top: 1px solid var(--border); z-index: 4; }
  .bottom-nav-item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; background: none; border: none; color: var(--text-dim); font-size: 10.5px; font-weight: 600; cursor: pointer; }
  .bottom-nav-item.active { color: var(--text); }

  .quick-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
  .quick-card { height: 56px; }
  .card-grid { grid-template-columns: repeat(2, 1fr); }
}
`;
