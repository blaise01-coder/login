
/* =========================================================
   SOUNDWAVE — PERSONALIZED MUSIC DASHBOARD
   Existing HTML + style2.css + Render backend integration
   ========================================================= */

"use strict";

/* -------------------- CONFIGURATION -------------------- */

const API = {
  search: "/api/youtube/search",
  trending: "/api/youtube/trending"
};

const STORAGE = {
  favorites: "soundwave-favorites",
  preferences: "soundwave-preferences",
  locationConsent: "soundwave-location-consent"
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) =>
  Array.from(root.querySelectorAll(selector));

/* -------------------- SAFE STORAGE -------------------- */

function loadStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch (error) {
    console.warn(`SoundWave: Could not read ${key}.`, error);
    return fallback;
  }
}

function saveStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`SoundWave: Could not save ${key}.`, error);
    return false;
  }
}

function getInitialPreferences() {
  const stored = loadStorage(STORAGE.preferences, {});

  return {
    favoriteGenres: Array.isArray(stored.favoriteGenres)
      ? stored.favoriteGenres
      : [],
    favoriteArtists: Array.isArray(stored.favoriteArtists)
      ? stored.favoriteArtists
      : [],
    displayName:
      typeof stored.displayName === "string"
        ? stored.displayName
        : "",
    locationEnabled: stored.locationEnabled === true,
    locationLabel:
      typeof stored.locationLabel === "string"
        ? stored.locationLabel
        : ""
  };
}

/* -------------------- APPLICATION STATE -------------------- */

const state = {
  searchResults: [],
  featuredSongs: [],
  favorites: loadStorage(STORAGE.favorites, []),
  preferences: getInitialPreferences(),

  currentSong: null,
  currentIndex: -1,

  player: null,
  playerReady: false,
  playerLoading: false,
  isPlaying: false,

  location: null,
  searchRequestId: 0,
  activePlaylist: [],

  autocompleteRequestId: 0,
  progressTimer: null
};

if (!Array.isArray(state.favorites)) {
  state.favorites = [];
}

state.favorites = state.favorites
  .filter((song) => song && typeof song === "object")
  .map(normalizeSong)
  .filter((song) => getVideoId(song));

/* -------------------- HTML ELEMENTS -------------------- */

const elements = {
  searchForm: $("#search-form"),
  searchInput: $("#search"),
  searchStatus: $("#search-status"),
  searchSubmit: $("#search-submit"),

  musicGrid: $("#music-grid"),
  musicEmpty: $("#music-empty"),
  resultsHeading: $("#results-heading"),
  resultsCaption: $("#results-caption"),

  songList: $("#song-list"),
  songCount: $("#song-count"),
  noResults: $("#no-results"),

  currentCover: $("#current-cover"),
  currentTitle: $("#current-title"),
  currentArtist: $("#current-artist"),

  playButton: $("#play-btn"),
  previousButton: $("#prev-btn"),
  nextButton: $("#next-btn"),
  favoriteButton: $("#favorite-btn"),

  progress: $("#progress"),
  currentTime: $("#current-time"),
  duration: $("#duration"),
  volume: $("#volume")
};

/* -------------------- GENERAL HELPERS -------------------- */

function setText(target, value) {
  const node = typeof target === "string" ? $(target) : target;

  if (node) {
    node.textContent = value == null ? "" : String(value);
  }
}

function setSearchStatus(message) {
  setText(elements.searchStatus, message);
}

function setHidden(element, hidden) {
  if (element) element.hidden = hidden;
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;

  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function formatClock(date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function escapeText(value) {
  return String(value ?? "");
}

/* -------------------- TIME PERSONALIZATION -------------------- */

function getTimePeriod(date = new Date()) {
  const hour = date.getHours();

  if (hour >= 5 && hour < 12) {
    return {
      key: "morning",
      greeting: "Good morning",
      mix: "Morning Mix",
      description: "Start your day with music you enjoy."
    };
  }

  if (hour >= 12 && hour < 17) {
    return {
      key: "afternoon",
      greeting: "Good afternoon",
      mix: "Afternoon Mix",
      description: "Find the right soundtrack for your afternoon."
    };
  }

  if (hour >= 17 && hour < 21) {
    return {
      key: "evening",
      greeting: "Good evening",
      mix: "Evening Mix",
      description: "Relax and enjoy your evening music."
    };
  }

  return {
    key: "night",
    greeting: "Welcome back",
    mix: "Night Mix",
    description: "Choose a soundtrack for your night."
  };
}

function updateTimeDashboard() {
  const now = new Date();
  const period = getTimePeriod(now);
  const name = state.preferences.displayName.trim();

  setText(
    "[data-greeting]",
    name ? `${period.greeting}, ${name}` : period.greeting
  );

  setText("[data-time-mix-title]", period.mix);
  setText("[data-time-description]", period.description);
  setText("[data-time-period]", period.key);
  setText("[data-current-time]", formatClock(now));
  setText("[data-current-date]", formatDate(now));

  $$("[data-time-mix]").forEach((node) => {
    node.textContent = period.mix;
  });
}

/* -------------------- NORMALIZE MUSIC DATA -------------------- */

function getVideoId(song) {
  if (!song || typeof song !== "object") return "";

  const raw =
    song.videoId ??
    song.video_id ??
    song.id?.videoId ??
    song.id?.video_id ??
    song.video?.id ??
    "";

  // Avoid treating arbitrary objects as YouTube IDs.
  if (typeof raw !== "string") return "";

  const id = raw.trim();

  // YouTube video IDs are 11 characters.
  return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : "";
}

function normalizeSong(item) {
  if (!item || typeof item !== "object") return {};

  const nestedId =
    item.id && typeof item.id === "object"
      ? item.id.videoId || item.id.video_id
      : "";

  const rawId =
    item.videoId ||
    item.video_id ||
    nestedId ||
    (typeof item.id === "string" ? item.id : "");

  const videoId =
    typeof rawId === "string" &&
    /^[a-zA-Z0-9_-]{11}$/.test(rawId)
      ? rawId
      : "";

  const thumbnails = item.thumbnails || item.snippet?.thumbnails || {};

  const thumbnail =
    item.thumbnail ||
    item.thumbnailUrl ||
    item.thumbnail_url ||
    thumbnails.high?.url ||
    thumbnails.medium?.url ||
    thumbnails.default?.url ||
    item.snippet?.thumbnails?.high?.url ||
    item.snippet?.thumbnails?.medium?.url ||
    (videoId
      ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      : "");

  return {
    ...item,
    videoId,
    title: String(
      item.title || item.snippet?.title || "Unknown song"
    ),
    artist: String(
      item.artist ||
      item.channelTitle ||
      item.channel ||
      item.author?.name ||
      item.snippet?.channelTitle ||
      "Unknown artist"
    ),
    thumbnail
  };
}

function getSongKey(song) {
  const videoId = getVideoId(song);

  if (videoId) return videoId;

  return `${song?.title || ""}-${song?.artist || ""}`.toLowerCase();
}

/* -------------------- YOUTUBE PLAYER -------------------- */

function ensureYouTubeContainer() {
  let container = $("#youtube-player");

  if (!container) {
    container = document.createElement("div");
    container.id = "youtube-player";
    container.setAttribute("aria-hidden", "true");

    Object.assign(container.style, {
      position: "fixed",
      width: "1px",
      height: "1px",
      overflow: "hidden",
      opacity: "0",
      pointerEvents: "none",
      left: "-10000px",
      top: "0"
    });

    document.body.appendChild(container);
  }

  return container;
}

function initializeYouTubeAPI() {
  ensureYouTubeContainer();

  if (window.YT?.Player) {
    createYouTubePlayer();
    return;
  }

  // Prevent adding the YouTube API script more than once.
  if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      setSearchStatus(
        "The YouTube player could not load. Check your connection and try again."
      );
    };

    document.head.appendChild(script);
  }

  // Preserve another callback if the page already registered one.
  const previousCallback = window.onYouTubeIframeAPIReady;

  window.onYouTubeIframeAPIReady = function () {
    if (typeof previousCallback === "function") {
      try {
        previousCallback();
      } catch (error) {
        console.warn("Previous YouTube callback failed.", error);
      }
    }

    createYouTubePlayer();
  };
}

function createYouTubePlayer() {
  if (state.player || !window.YT?.Player) return;

  ensureYouTubeContainer();

  state.playerLoading = true;

  try {
    state.player = new window.YT.Player("youtube-player", {
      width: "1",
      height: "1",
      playerVars: {
        autoplay: 0,
        controls: 0,
        rel: 0,
        playsinline: 1
      },
      events: {
        onReady: handlePlayerReady,
        onStateChange: handlePlayerState,
        onError: handlePlayerError
      }
    });
  } catch (error) {
    state.playerLoading = false;
    state.player = null;
    console.error("SoundWave player initialization failed:", error);
  }
}

function handlePlayerReady() {
  state.playerReady = true;
  state.playerLoading = false;

  applyPlayerVolume();
  updatePlayButton();

  // Play a song only after the user chooses one.
  if (state.currentSong) {
    const videoId = getVideoId(state.currentSong);

    if (videoId) {
      state.player.cueVideoById(videoId);
    }
  }
}

function handlePlayerError(event) {
  state.isPlaying = false;
  updatePlayButton();

  console.warn("YouTube playback error:", event.data);

  setSearchStatus(
    "This video is unavailable for playback. Try another song."
  );
}

function handlePlayerState(event) {
  if (!window.YT) return;

  const playerState = event.data;

  if (playerState === window.YT.PlayerState.PLAYING) {
    state.isPlaying = true;
    updatePlayButton();
    startProgressUpdates();
  } else if (
    playerState === window.YT.PlayerState.PAUSED ||
    playerState === window.YT.PlayerState.CUED
  ) {
    state.isPlaying = false;
    updatePlayButton();
    stopProgressUpdates();
  } else if (playerState === window.YT.PlayerState.ENDED) {
    state.isPlaying = false;
    updatePlayButton();
    stopProgressUpdates();
    playAdjacentSong(1);
  }
}

function applyPlayerVolume() {
  if (!state.playerReady || !state.player || !elements.volume) return;

  let volume = Number(elements.volume.value);

  if (!Number.isFinite(volume)) volume = 0.7;

  // Support both range formats: 0–1 and 0–100.
  if (volume > 1) {
    volume = volume / 100;
  }

  volume = Math.max(0, Math.min(1, volume));

  state.player.setVolume(Math.round(volume * 100));
}

function playSong(song, playlist = state.searchResults) {
  const normalized = normalizeSong(song);
  const videoId = getVideoId(normalized);

  if (!videoId) {
    setSearchStatus("This song does not have a valid YouTube video ID.");
    return;
  }

  const list = Array.isArray(playlist) ? playlist : [];
  const normalizedList = list
    .map(normalizeSong)
    .filter((item) => getVideoId(item));

  const exists = normalizedList.some(
    (item) => getVideoId(item) === videoId
  );

  state.activePlaylist = exists ? normalizedList : [normalized];
  state.currentIndex = state.activePlaylist.findIndex(
    (item) => getVideoId(item) === videoId
  );

  state.currentSong = normalized;
  state.isPlaying = false;

  renderCurrentSong(normalized);
  updatePlayButton();

  if (state.playerReady && state.player) {
    try {
      state.player.loadVideoById(videoId);
      applyPlayerVolume();
    } catch (error) {
      console.error("Could not play song:", error);
      setSearchStatus("Could not start this song. Please try again.");
    }
  } else {
    setSearchStatus("Loading the music player. Please try again shortly.");
  }

  document.dispatchEvent(
    new CustomEvent("soundwave:song-played", {
      detail: { song: normalized }
    })
  );
}

function togglePlayback() {
  if (!state.playerReady || !state.player) {
    setSearchStatus("The music player is still loading.");
    return;
  }

  try {
    const currentState = state.player.getPlayerState();

    if (currentState === window.YT.PlayerState.PLAYING) {
      state.player.pauseVideo();
      return;
    }

    if (state.currentSong) {
      state.player.playVideo();
      return;
    }

    const firstSong =
      state.searchResults[0] ||
      state.featuredSongs[0] ||
      state.favorites[0];

    if (firstSong) {
      playSong(firstSong, state.searchResults.length
        ? state.searchResults
        : [firstSong]);
    } else {
      setSearchStatus("Search for a song to start listening.");
    }
  } catch (error) {
    console.error("Playback control failed:", error);
    setSearchStatus("Could not control playback. Try again.");
  }
}

function playAdjacentSong(direction) {
  const playlist = state.activePlaylist;

  if (!playlist.length) {
    setSearchStatus("Search for songs before using previous or next.");
    return;
  }

  let index = state.currentIndex;

  if (index < 0) index = 0;

  index = (index + direction + playlist.length) % playlist.length;

  playSong(playlist[index], playlist);
}

function renderCurrentSong(song) {
  setText(elements.currentTitle, song.title || "Unknown song");
  setText(
    elements.currentArtist,
    song.artist || song.channel || "Unknown artist"
  );

  if (elements.currentCover) {
    elements.currentCover.src =
      song.thumbnail ||
      `https://i.ytimg.com/vi/${getVideoId(song)}/hqdefault.jpg`;

    elements.currentCover.alt = `${song.title || "Current song"} artwork`;
  }

  setText(elements.currentTime, "0:00");
  setText(elements.duration, "0:00");

  if (elements.progress) {
    elements.progress.value = "0";
  }

  updateFavoriteButton();
}

function updatePlayButton() {
  if (!elements.playButton) return;

  elements.playButton.textContent = state.isPlaying ? "Ⅱ" : "▶";
  elements.playButton.setAttribute(
    "aria-label",
    state.isPlaying ? "Pause music" : "Play music"
  );
}

function startProgressUpdates() {
  stopProgressUpdates();

  const update = () => {
    if (!state.playerReady || !state.player || !state.currentSong) return;

    try {
      const current = state.player.getCurrentTime() || 0;
      const total = state.player.getDuration() || 0;

      setText(elements.currentTime, formatDuration(current));
      setText(elements.duration, formatDuration(total));

      if (elements.progress && total > 0) {
        elements.progress.max = String(total);
        elements.progress.value = String(current);
      }
    } catch (error) {
      console.warn("Could not update playback progress.", error);
    }
  };

  update();
  state.progressTimer = window.setInterval(update, 1000);
}

function stopProgressUpdates() {
  if (state.progressTimer !== null) {
    window.clearInterval(state.progressTimer);
    state.progressTimer = null;
  }
}

/* -------------------- SEARCH API -------------------- */

async function fetchSongs(query) {
  const url = `${API.search}?q=${encodeURIComponent(query)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(`Music search failed (${response.status}).`);
  }

  const data = await response.json();

  const items = Array.isArray(data)
    ? data
    : data.results ||
      data.items ||
      data.songs ||
      data.videos ||
      [];

  if (!Array.isArray(items)) return [];

  return items
    .map(normalizeSong)
    .filter((song) => getVideoId(song));
}

async function searchSongs(query) {
  const cleanedQuery = String(query || "").trim();

  if (!cleanedQuery) {
    setSearchStatus("Type a song, artist, or genre to search.");
    return;
  }

  const requestId = ++state.searchRequestId;

  setSearchStatus("Searching for music…");
  setText(elements.resultsHeading, `Results for "${cleanedQuery}"`);
  setText(elements.resultsCaption, "Searching available music…");

  if (elements.searchSubmit) {
    elements.searchSubmit.disabled = true;
  }

  try {
    const songs = await fetchSongs(cleanedQuery);

    if (requestId !== state.searchRequestId) return;

    state.searchResults = songs;
    state.activePlaylist = songs.slice();
    state.currentIndex = -1;

    renderResults(songs);

    setSearchStatus(
      songs.length
        ? `${songs.length} songs found.`
        : "No songs found. Try another search."
    );

    setText(
      elements.resultsCaption,
      songs.length ? `${songs.length} results` : "No results"
    );
  } catch (error) {
    if (requestId !== state.searchRequestId) return;

    console.error("SoundWave search error:", error);

    setSearchStatus(
      "Could not reach the music service. Check your Render server and try again."
    );

    renderResults([]);
  } finally {
    if (requestId === state.searchRequestId && elements.searchSubmit) {
      elements.searchSubmit.disabled = false;
    }
  }
}

/* -------------------- SONG CARDS -------------------- */

function createSongCard(song, index, playlist) {
  const normalized = normalizeSong(song);
  const card = document.createElement("article");

  card.className = "music-card";
  card.dataset.index = String(index);

  const image = document.createElement("img");
  image.className = "music-card-cover";
  image.src = normalized.thumbnail || "";
  image.alt = `${normalized.title} artwork`;
  image.loading = "lazy";

  image.addEventListener("error", () => {
    image.style.visibility = "hidden";
  }, { once: true });

  const info = document.createElement("div");
  info.className = "music-card-info";

  const title = document.createElement("h3");
  title.textContent = normalized.title;

  const artist = document.createElement("p");
  artist.textContent = normalized.artist;

  info.append(title, artist);

  const actions = document.createElement("div");
  actions.className = "music-card-actions";

  const playButton = document.createElement("button");
  playButton.type = "button";
  playButton.className = "card-play-btn";
  playButton.textContent = "▶ Play";
  playButton.addEventListener("click", () => {
    playSong(normalized, playlist);
  });

  const favoriteButton = document.createElement("button");
  favoriteButton.type = "button";
  favoriteButton.className = "card-favorite-btn";
  favoriteButton.textContent = isFavorite(normalized)
    ? "♥ Saved"
    : "♡ Favorite";

  favoriteButton.setAttribute(
    "aria-pressed",
    String(isFavorite(normalized))
  );

  favoriteButton.addEventListener("click", () => {
    toggleFavorite(normalized);

    favoriteButton.textContent = isFavorite(normalized)
      ? "♥ Saved"
      : "♡ Favorite";

    favoriteButton.setAttribute(
      "aria-pressed",
      String(isFavorite(normalized))
    );
  });

  actions.append(playButton, favoriteButton);
  card.append(image, info, actions);

  return card;
}

function createSongRow(song, index, playlist) {
  const normalized = normalizeSong(song);
  const row = document.createElement("div");

  row.className = "song-row";

  const image = document.createElement("img");
  image.className = "song-row-cover";
  image.src = normalized.thumbnail || "";
  image.alt = "";
  image.loading = "lazy";

  const info = document.createElement("div");
  info.className = "song-row-info";

  const title = document.createElement("h4");
  title.textContent = normalized.title;

  const artist = document.createElement("p");
  artist.textContent = normalized.artist;

  info.append(title, artist);

  const playButton = document.createElement("button");
  playButton.type = "button";
  playButton.textContent = "▶";
  playButton.setAttribute("aria-label", `Play ${normalized.title}`);
  playButton.addEventListener("click", () => {
    playSong(normalized, playlist);
  });

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.textContent = "♥";
  removeButton.setAttribute(
    "aria-label",
    `Remove ${normalized.title} from favorites`
  );

  removeButton.addEventListener("click", () => {
    toggleFavorite(normalized);
  });

  row.append(image, info, playButton, removeButton);
  row.dataset.index = String(index);

  return row;
}

/* -------------------- SEARCH RESULTS -------------------- */

function renderResults(songs) {
  // Only update search results. Never clear the user's library here.
  if (elements.musicGrid) elements.musicGrid.replaceChildren();

  setHidden(elements.musicEmpty, songs.length > 0);

  if (!songs.length) {
    const empty = elements.musicEmpty;
    if (empty) empty.hidden = false;
    return;
  }

  if (elements.musicEmpty) elements.musicEmpty.hidden = true;

  songs.forEach((song, index) => {
    if (elements.musicGrid) {
      elements.musicGrid.appendChild(
        createSongCard(song, index, songs)
      );
    }
  });
}

/* -------------------- FAVORITES / MY LIBRARY -------------------- */

function isFavorite(song) {
  const key = getSongKey(song);

  return state.favorites.some(
    (item) => getSongKey(item) === key
  );
}

function toggleFavorite(song) {
  if (!song) return;

  const normalized = normalizeSong(song);
  const key = getSongKey(normalized);

  if (isFavorite(normalized)) {
    state.favorites = state.favorites.filter(
      (item) => getSongKey(item) !== key
    );
  } else {
    state.favorites.push(normalized);
  }

  saveStorage(STORAGE.favorites, state.favorites);

  renderLibrary();
  renderPersonalizedMix();
  updateFavoriteButton();
}

function updateFavoriteButton() {
  if (!elements.favoriteButton || !state.currentSong) return;

  const saved = isFavorite(state.currentSong);

  elements.favoriteButton.textContent = saved ? "♥" : "♡";
  elements.favoriteButton.setAttribute(
    "aria-label",
    saved ? "Remove from favorites" : "Add to favorites"
  );
  elements.favoriteButton.setAttribute("aria-pressed", String(saved));
}

function renderLibrary() {
  // Use the actual My Library container in the supplied HTML.
  const container =
    elements.songList ||
    $("[data-library-list]");

  if (!container) return;

  container.replaceChildren();

  const favorites = state.favorites;

  setText(
    elements.songCount || $("[data-library-count]"),
    String(favorites.length)
  );

  setHidden(elements.noResults, favorites.length > 0);

  if (!favorites.length) {
    if (elements.noResults) {
      elements.noResults.hidden = false;
    } else {
      const message = document.createElement("p");
      message.textContent =
        "Your library is empty. Press Favorite on a song to save it.";
      container.appendChild(message);
    }

    return;
  }

  if (elements.noResults) elements.noResults.hidden = true;

  favorites.forEach((song, index) => {
    container.appendChild(
      createSongRow(song, index, favorites)
    );
  });
}

/* -------------------- PERSONALIZED MIX -------------------- */

function scoreSong(song) {
  let score = 0;

  const genres = state.preferences.favoriteGenres.map((value) =>
    value.toLowerCase()
  );

  const artists = state.preferences.favoriteArtists.map((value) =>
    value.toLowerCase()
  );

  const songText = [
    song.title,
    song.artist,
    song.category,
    song.genre,
    song.description
  ].filter(Boolean).join(" ").toLowerCase();

  genres.forEach((genre) => {
    if (genre && songText.includes(genre)) score += 3;
  });

  artists.forEach((artist) => {
    if (artist && songText.includes(artist)) score += 5;
  });

  if (isFavorite(song)) score += 2;

  return score;
}

function renderPersonalizedMix() {
  const container = $("[data-personalized-mix]");

  if (!container) return;

  container.replaceChildren();

  const unique = new Map();

  [...state.favorites, ...state.featuredSongs].forEach((song) => {
    const key = getSongKey(song);

    if (getVideoId(song) && !unique.has(key)) {
      unique.set(key, song);
    }
  });

  const mix = [...unique.values()]
    .sort((a, b) => scoreSong(b) - scoreSong(a))
    .slice(0, 12);

  if (!mix.length) {
    const message = document.createElement("p");
    message.textContent =
      "Save songs or choose your favorite genres to start building your mix.";
    container.appendChild(message);
    return;
  }

  mix.forEach((song, index) => {
    container.appendChild(createSongCard(song, index, mix));
  });
}

/* -------------------- FEATURED / TRENDING -------------------- */

// These are clearly labelled featured tracks, not live chart rankings.
const defaultFeaturedSongs = [
  {
    videoId: "kJQP7kiw5Fk",
    title: "Despacito",
    artist: "Luis Fonsi",
    category: "Latin",
    thumbnail: "https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg"
  },
  {
    videoId: "JGwWNGJdvx8",
    title: "Shape of You",
    artist: "Ed Sheeran",
    category: "Pop",
    thumbnail: "https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg"
  },
  {
    videoId: "CevxZvSJLk8",
    title: "Roar",
    artist: "Katy Perry",
    category: "Pop",
    thumbnail: "https://i.ytimg.com/vi/CevxZvSJLk8/hqdefault.jpg"
  }
];

async function loadTrendingSongs() {
  const container = $("[data-trending-songs]");

  if (!container) return;

  try {
    const response = await fetch(API.trending, {
      headers: { Accept: "application/json" }
    });

    if (response.ok) {
      const data = await response.json();

      const items = Array.isArray(data)
        ? data
        : data.results || data.items || data.songs || data.videos || [];

      const songs = Array.isArray(items)
        ? items.map(normalizeSong).filter((song) => getVideoId(song))
        : [];

      if (songs.length) {
        state.featuredSongs = songs;
        renderSongCollection(container, songs, "trending");

        setText("[data-trending-caption]", "Music from your server");
        renderPersonalizedMix();
        return;
      }
    }
  } catch (error) {
    // The trending route may not exist yet.
    console.info("SoundWave: Trending API unavailable; using featured songs.");
  }

  state.featuredSongs = defaultFeaturedSongs.map(normalizeSong);

  renderSongCollection(container, state.featuredSongs, "featured");

  setText("[data-trending-caption]", "Featured songs");
  renderPersonalizedMix();
}

function renderSongCollection(container, songs, type) {
  if (!container) return;

  container.replaceChildren();

  songs.forEach((song, index) => {
    const card = createSongCard(song, index, songs);
    card.dataset.collection = type;
    container.appendChild(card);
  });
}

/* -------------------- USER PREFERENCES -------------------- */

function savePreferencesFromForm() {
  state.preferences.favoriteGenres = $$("[data-genre]:checked")
    .map((input) => input.value);

  const artistInput = $("[data-artist-preference]");

  if (artistInput) {
    state.preferences.favoriteArtists = artistInput.value
      .split(",")
      .map((artist) => artist.trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  const nameInput = $("[data-display-name]");

  if (nameInput) {
    state.preferences.displayName = nameInput.value
      .trim()
      .slice(0, 60);
  }

  saveStorage(STORAGE.preferences, state.preferences);

  updateTimeDashboard();
  renderPersonalizedMix();
}

function setupPreferences() {
  $$("[data-genre]").forEach((input) => {
    input.checked = state.preferences.favoriteGenres.includes(input.value);
  });

  const artistInput = $("[data-artist-preference]");

  if (artistInput) {
    artistInput.value = state.preferences.favoriteArtists.join(", ");
  }

  const nameInput = $("[data-display-name]");

  if (nameInput) {
    nameInput.value = state.preferences.displayName;
  }

  const saveButton = $("[data-save-preferences]");

  saveButton?.addEventListener("click", () => {
    savePreferencesFromForm();
    setText(
      "[data-preferences-status]",
      "Your preferences have been saved."
    );
  });

  updateTimeDashboard();
}

/* -------------------- OPTIONAL LOCATION -------------------- */

function setupLocation() {
  const consent = loadStorage(STORAGE.locationConsent, null);

  if (consent === "denied") {
    setText("[data-location-status]", "Location is turned off.");
  } else if (
    consent === "granted" &&
    state.preferences.locationEnabled
  ) {
    requestLocation(false);
  } else {
    setText(
      "[data-location-status]",
      "Location is optional. You decide whether to share it."
    );
  }

  $("[data-enable-location]")?.addEventListener("click", () => {
    requestLocation(true);
  });
}

function requestLocation(askFirst) {
  if (!navigator.geolocation) {
    setText(
      "[data-location-status]",
      "Location is not supported by this browser."
    );
    return;
  }

  if (askFirst) {
    const accepted = window.confirm(
      "Allow SoundWave to access your location? Location is optional."
    );

    if (!accepted) {
      saveStorage(STORAGE.locationConsent, "denied");

      state.preferences.locationEnabled = false;
      state.preferences.locationLabel = "";

      saveStorage(STORAGE.preferences, state.preferences);

      setText("[data-location-status]", "Location is turned off.");
      setText("[data-location-label]", "");
      return;
    }
  }

  setText("[data-location-status]", "Requesting location permission…");

  navigator.geolocation.getCurrentPosition(
    () => {
      // Coordinates are deliberately not retained or sent to the server.
      state.location = null;
      state.preferences.locationEnabled = true;
      state.preferences.locationLabel = "Location enabled";

      saveStorage(STORAGE.locationConsent, "granted");
      saveStorage(STORAGE.preferences, state.preferences);

      setText("[data-location-status]", "Location permission granted.");
      setText("[data-location-label]", "Location enabled");

      document.dispatchEvent(
        new CustomEvent("soundwave:location-enabled", {
          detail: { enabled: true }
        })
      );
    },
    (error) => {
      state.preferences.locationEnabled = false;
      saveStorage(STORAGE.preferences, state.preferences);

      const message =
        error.code === error.PERMISSION_DENIED
          ? "Location permission was denied."
          : "Could not access location. You can try again.";

      setText("[data-location-status]", message);
    },
    {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 300000
    }
  );
}

/* -------------------- SEARCH AUTOCOMPLETE -------------------- */

function setupAutocomplete() {
  const input = elements.searchInput;
  const form = elements.searchForm;

  if (!input || !form) return;

  const suggestions = document.createElement("div");

  suggestions.className = "soundwave-suggestions";
  suggestions.id = "soundwave-suggestions";
  suggestions.hidden = true;

  input.setAttribute("aria-controls", suggestions.id);
  form.appendChild(suggestions);

  let debounceId = null;

  input.addEventListener("input", () => {
    window.clearTimeout(debounceId);

    const query = input.value.trim();

    if (query.length < 2) {
      state.autocompleteRequestId++;
      suggestions.replaceChildren();
      suggestions.hidden = true;
      return;
    }

    debounceId = window.setTimeout(async () => {
      const requestId = ++state.autocompleteRequestId;

      try {
        const songs = await fetchSongs(query);

        if (requestId !== state.autocompleteRequestId) return;

        renderSuggestions(songs.slice(0, 5), suggestions);
      } catch {
        suggestions.hidden = true;
      }
    }, 400);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      suggestions.hidden = true;
    }
  });

  document.addEventListener("click", (event) => {
    if (!form.contains(event.target)) {
      suggestions.hidden = true;
    }
  });
}

function renderSuggestions(songs, container) {
  container.replaceChildren();

  if (!songs.length) {
    container.hidden = true;
    return;
  }

  songs.forEach((song) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "suggestion-item";
    button.textContent = `${song.title} — ${song.artist}`;

    button.addEventListener("click", () => {
      if (elements.searchInput) {
        elements.searchInput.value = song.title;
      }

      container.hidden = true;
      searchSongs(song.title);
    });

    container.appendChild(button);
  });

  container.hidden = false;
}

/* -------------------- NAVIGATION -------------------- */

function setupNavigation() {
  // Supports the existing data-target buttons in your supplied HTML.
  $$("[data-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.getElementById(button.dataset.target);

      if (target) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }

      $$(".nav-link").forEach((item) => {
        item.classList.toggle("active", item === button);
      });
    });
  });

  $("#explore-btn")?.addEventListener("click", () => {
    $("#featured-section")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });

  $("#hero-explore-btn")?.addEventListener("click", () => {
    $("#featured-section")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    elements.searchInput?.focus({ preventScroll: true });
  });

  // Also supports an alternate navigation system if present.
  $$("[data-soundwave-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.soundwaveView;

      $$("[data-view-panel]").forEach((panel) => {
        panel.hidden = panel.dataset.viewPanel !== view;
      });

      $$("[data-soundwave-view]").forEach((item) => {
        item.setAttribute(
          "aria-current",
          String(item === button)
        );
      });

      if (view === "library") renderLibrary();
      if (view === "home") renderPersonalizedMix();
    });
  });
}

/* -------------------- PLAYER CONTROLS -------------------- */

function setupPlayerControls() {
  elements.playButton?.addEventListener("click", togglePlayback);

  elements.previousButton?.addEventListener("click", () => {
    playAdjacentSong(-1);
  });

  elements.nextButton?.addEventListener("click", () => {
    playAdjacentSong(1);
  });

  elements.favoriteButton?.addEventListener("click", () => {
    if (state.currentSong) {
      toggleFavorite(state.currentSong);
    }
  });

  elements.progress?.addEventListener("change", () => {
    if (!state.playerReady || !state.player) return;

    const value = Number(elements.progress.value);

    if (Number.isFinite(value)) {
      state.player.seekTo(value, true);
    }
  });

  elements.volume?.addEventListener("input", applyPlayerVolume);

  elements.searchForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    searchSongs(elements.searchInput?.value || "");
  });

  $("#youtube-search-btn")?.addEventListener("click", () => {
    const query = elements.searchInput?.value.trim();

    if (!query) {
      setSearchStatus("Enter a song or artist to search on YouTube.");
      elements.searchInput?.focus();
      return;
    }

    window.open(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
      "_blank",
      "noopener,noreferrer"
    );
  });

  $("#spotify-search-btn")?.addEventListener("click", () => {
    const query = elements.searchInput?.value.trim();

    if (!query) {
      window.open(
        "https://open.spotify.com/",
        "_blank",
        "noopener,noreferrer"
      );
      return;
    }

    window.open(
      `https://open.spotify.com/search/${encodeURIComponent(query)}`,
      "_blank",
      "noopener,noreferrer"
    );
  });
}

/* -------------------- INITIALIZE -------------------- */

function initializeSoundWave() {
  if (document.documentElement.dataset.soundwaveInitialized === "true") {
    return;
  }

  document.documentElement.dataset.soundwaveInitialized = "true";

  updateTimeDashboard();
  setupPreferences();
  setupLocation();
  setupAutocomplete();
  setupNavigation();
  setupPlayerControls();
  initializeYouTubeAPI();

  renderLibrary();
  loadTrendingSongs();

  // Update the displayed time and greeting once per minute.
  window.setInterval(updateTimeDashboard, 60000);

  document.dispatchEvent(new Event("soundwave:ready"));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeSoundWave, {
    once: true
  });
} else {
  initializeSoundWave();
}
