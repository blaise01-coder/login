"use strict";

// ==========================================
// SOUNDWAVE - YouTube Full Audio & Artwork Engine (Spotify Style)
// ==========================================

const $ = (selector) => document.querySelector(selector);

const searchForm = $("#search-form");
const searchInput = $("#search");
const searchStatus = $("#search-status");
const searchSubmit = $("#search-submit");
const musicGrid = $("#music-grid");
const resultsHeading = $("#results-heading");
const resultsCaption = $("#results-caption");
const musicEmpty = $("#music-empty");

const songList = $("#song-list");
const songCount = $("#song-count");
const noResults = $("#no-results");

const currentCover = $("#current-cover");
const currentTitle = $("#current-title");
const currentArtist = $("#current-artist");
const playButton = $("#play-btn");
const previousButton = $("#prev-btn");
const nextButton = $("#next-btn");
const favoriteButton = $("#favorite-btn");

const progress = $("#progress");
const currentTimeEl = $("#current-time");
const durationEl = $("#duration");
const volume = $("#volume");

const FAVORITES_KEY = "soundwave-favorites";
const SEARCH_API_URL = "/api/youtube/search";

let searchResults = [];
let currentSong = null;
let currentIndex = -1;
let favorites = loadFavorites();
let searchRequestNumber = 0;
let player = null;
let progressInterval = null;

// Featured and default songs list (35+ tracks in English)
const defaultFeaturedSongs = [
    { videoId: "5qap5aO4i9A", title: "Lofi Hip Hop Radio", artist: "Lofi Girl", category: "lofi", thumbnail: "https://i.ytimg.com/vi/5qap5aO4i9A/hqdefault.jpg" },
    { videoId: "jfKfPfyJRdk", title: "Lofi Hip Hop - Chill Beats", artist: "Lofi Girl", category: "lofi", thumbnail: "https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg" },
    { videoId: "60ItHLz5WEA", title: "Montero (Call Me By Your Name)", artist: "Lil Nas X", category: "pop", thumbnail: "https://i.ytimg.com/vi/60ItHLz5WEA/hqdefault.jpg" },
    { videoId: "2Vv-BfVoq4g", title: "Shape of You", artist: "Ed Sheeran", category: "pop", thumbnail: "https://i.ytimg.com/vi/2Vv-BfVoq4g/hqdefault.jpg" },
    { videoId: "5NV6Rdv1a3I", title: "Levitating", artist: "Dua Lipa", category: "pop", thumbnail: "https://i.ytimg.com/vi/5NV6Rdv1a3I/hqdefault.jpg" },
    { videoId: "kJQP7kiw5Fk", title: "Despacito", artist: "Luis Fonsi ft. Daddy Yankee", category: "latin", thumbnail: "https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg" },
    { videoId: "fJ9rUzIMcZQ", title: "Bad Guy", artist: "Billie Eilish", category: "pop", thumbnail: "https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg" },
    { videoId: "OPf0YbXqDm0", title: "Uptown Funk", artist: "Mark Ronson ft. Bruno Mars", category: "funk", thumbnail: "https://i.ytimg.com/vi/OPf0YbXqDm0/hqdefault.jpg" },
    { videoId: "YQHsXMglC9A", title: "Hello", artist: "Adele", category: "ballad", thumbnail: "https://i.ytimg.com/vi/YQHsXMglC9A/hqdefault.jpg" },
    { videoId: "hTWKbfoikeg", title: "Girls Like You", artist: "Maroon 5 ft. Cardi B", category: "pop", thumbnail: "https://i.ytimg.com/vi/hTWKbfoikeg/hqdefault.jpg" },
    { videoId: "RgKAFK5djSk", title: "See You Again", artist: "Wiz Khalifa ft. Charlie Puth", category: "hiphop", thumbnail: "https://i.ytimg.com/vi/RgKAFK5djSk/hqdefault.jpg" },
    { videoId: "CevxZvSJLk8", title: "Roar", artist: "Katy Perry", category: "pop", thumbnail: "https://i.ytimg.com/vi/CevxZvSJLk8/hqdefault.jpg" },
    { videoId: "09R8_2nJtjg", title: "Sugar", artist: "Maroon 5", category: "pop", thumbnail: "https://i.ytimg.com/vi/09R8_2nJtjg/hqdefault.jpg" },
    { videoId: "JGwWNGJdvx8", title: "Shape of My Heart", artist: "Sting", category: "classic", thumbnail: "https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg" },
    { videoId: "3JZ_D3ELwOQ", title: "Blank Space", artist: "Taylor Swift", category: "pop", thumbnail: "https://i.ytimg.com/vi/3JZ_D3ELwOQ/hqdefault.jpg" },
    { videoId: "fLexgOxsZu0", title: "Hips Don't Lie", artist: "Shakira ft. Wyclef Jean", category: "latin", thumbnail: "https://i.ytimg.com/vi/fLexgOxsZu0/hqdefault.jpg" },
    { videoId: "uelHwf8o7_U", title: "Counting Stars", artist: "OneRepublic", category: "rock", thumbnail: "https://i.ytimg.com/vi/uelHwf8o7_U/hqdefault.jpg" },
    { videoId: "m7Bc3pLyij0", title: "Demons", artist: "Imagine Dragons", category: "rock", thumbnail: "https://i.ytimg.com/vi/m7Bc3pLyij0/hqdefault.jpg" },
    { videoId: "ktvTqknDobU", title: "Radioactive", artist: "Imagine Dragons", category: "rock", thumbnail: "https://i.ytimg.com/vi/ktvTqknDobU/hqdefault.jpg" },
    { videoId: "rbtoAluzI-E", title: "Payphone", artist: "Maroon 5 ft. Wiz Khalifa", category: "pop", thumbnail: "https://i.ytimg.com/vi/rbtoAluzI-E/hqdefault.jpg" },
    { videoId: "DHrQUWZgnG8", title: "Burn", artist: "Ellie Goulding", category: "pop", thumbnail: "https://i.ytimg.com/vi/DHrQUWZgnG8/hqdefault.jpg" },
    { videoId: "KkTzTj4xCCS", title: "Stitches", artist: "Shawn Mendes", category: "pop", thumbnail: "https://i.ytimg.com/vi/KkTzTj4xCCS/hqdefault.jpg" },
    { videoId: "ZnWzHmsF7qY", title: "Treat You Better", artist: "Shawn Mendes", category: "pop", thumbnail: "https://i.ytimg.com/vi/ZnWzHmsF7qY/hqdefault.jpg" },
    { videoId: "lp-EO5I60KA", title: "Ed Sheeran - Perfect", artist: "Ed Sheeran", category: "ballad", thumbnail: "https://i.ytimg.com/vi/lp-EO5I60KA/hqdefault.jpg" },
    { videoId: "2Vv-BfVoq4g", title: "Thinking Out Loud", artist: "Ed Sheeran", category: "ballad", thumbnail: "https://i.ytimg.com/vi/2Vv-BfVoq4g/hqdefault.jpg" },
    { videoId: "nfWlot6h_JM", title: "Shake It Off", artist: "Taylor Swift", category: "pop", thumbnail: "https://i.ytimg.com/vi/nfWlot6h_JM/hqdefault.jpg" },
    { videoId: "QcIy9NiNbmo", title: "Someone Like You", artist: "Adele", category: "ballad", thumbnail: "https://i.ytimg.com/vi/QcIy9NiNbmo/hqdefault.jpg" },
    { videoId: "XFkzRNyygfk", title: "Watermelon Sugar", artist: "Harry Styles", category: "pop", thumbnail: "https://i.ytimg.com/vi/XFkzRNyygfk/hqdefault.jpg" },
    { videoId: "Pkh8Utuejgs", title: "One Love", artist: "Bob Marley", category: "reggae", thumbnail: "https://i.ytimg.com/vi/Pkh8Utuejgs/hqdefault.jpg" },
    { videoId: "y6Sxv-sUYtM", title: "Happy", artist: "Pharrell Williams", category: "pop", thumbnail: "https://i.ytimg.com/vi/y6Sxv-sUYtM/hqdefault.jpg" },
    { videoId: "hT_nvWreIhg", title: "Counting Sheep", artist: "Safia", category: "indie", thumbnail: "https://i.ytimg.com/vi/hT_nvWreIhg/hqdefault.jpg" },
    { videoId: "fWNaR-rxAic", title: "Locked Out of Heaven", artist: "Bruno Mars", category: "pop", thumbnail: "https://i.ytimg.com/vi/fWNaR-rxAic/hqdefault.jpg" },
    { videoId: "bBC-nXj3Ng4", title: "Just the Way You Are", artist: "Bruno Mars", category: "pop", thumbnail: "https://i.ytimg.com/vi/bBC-nXj3Ng4/hqdefault.jpg" },
    { videoId: "e-ORhEE9VVg", title: "The Lazy Song", artist: "Bruno Mars", category: "pop", thumbnail: "https://i.ytimg.com/vi/e-ORhEE9VVg/hqdefault.jpg" },
    { videoId: "3JWTaaS7LdU", title: "Sign of the Times", artist: "Harry Styles", category: "pop", thumbnail: "https://i.ytimg.com/vi/3JWTaaS7LdU/hqdefault.jpg" }
];

// Load YouTube Iframe API Dynamically
if (!window.YT) {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

window.onYouTubeIframeAPIReady = function() {
    initYouTubePlayer();
};

function initYouTubePlayer() {
    if (player) return;
    
    player = new YT.Player("youtube-player", {
        height: "1",
        width: "1",
        playerVars: {
            'playsinline': 1,
            'controls': 0,
            'autoplay': 1
        },
        events: {
            'onReady': () => {
                console.log("YouTube Player Engine is ready!");
                if (volume && player && typeof player.setVolume === "function") {
                    player.setVolume(volume.value * 100);
                }
            },
            'onStateChange': onPlayerStateChange
        }
    });
}

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        setButtonPlaying(true);
        if (currentSong) setStatus(`Now playing: ${currentSong.title}`);
        startProgressTracking();
    } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
        setButtonPlaying(false);
        stopProgressTracking();
        if (event.data === YT.PlayerState.ENDED) {
            playAdjacentSong(1);
        }
    }
}

// ==========================================
// HELPERS & STATUS
// ==========================================

function setStatus(message, isError = false) {
    if (!searchStatus) return;
    searchStatus.textContent = message;
    searchStatus.style.color = isError ? "#ff4d4d" : "";
}

function songKey(song) {
    if (!song || typeof song !== "object") return "";
    return song.videoId ? `youtube-${song.videoId}` : song.key || "";
}

function cleanSongTitle(title) {
    if (!title) return "Unknown song";
    return title
        .replace(/[\(\[\s-]*(official video\vert{}official music video\vert{}lyrics video\vert{}audio\vert{}visualizer\vert{}ft\.?\vert{}feat\.?\vert{}live)[^\)\]]*[\)\]]*/gi, "")
        .replace(/[-|].*$/, "")
        .trim();
}

function normalizeSong(song) {
    if (!song) return null;
    const videoId = String(song.videoId || "").trim();
    const rawTitle = song.title || "Unknown song";

    return {
        key: videoId ? `youtube-${videoId}` : `song-${Math.random()}`,
        videoId: videoId,
        title: cleanSongTitle(rawTitle),
        artist: song.artist || "Unknown artist",
        category: song.category || "general",
        thumbnail: song.thumbnail || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : "https://placehold.co/400x400/25213a/ffffff?text=SoundWave")
    };
}

function isFavorite(song) {
    const key = songKey(song);
    return Boolean(key && favorites.some((item) => songKey(item) === key));
}

function setButtonPlaying(isPlaying) {
    if (!playButton) return;
    playButton.textContent = isPlaying ? "Ⅱ" : "▶";
}

function setHidden(element, shouldHide) {
    if (!element) return;
    element.classList.toggle("hidden", shouldHide);
}

function formatTime(seconds) {
    if (isNaN(seconds) || seconds <= 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

// ==========================================
// PROGRESS & VOLUME TRACKING
// ==========================================

function startProgressTracking() {
    stopProgressTracking();
    progressInterval = setInterval(() => {
        if (player && typeof player.getCurrentTime === "function" && typeof player.getDuration === "function") {
            const current = player.getCurrentTime() || 0;
            const total = player.getDuration() || 0;

            if (currentTimeEl) currentTimeEl.textContent = formatTime(current);
            if (durationEl) durationEl.textContent = formatTime(total);

            if (progress && total > 0) {
                progress.value = (current / total) * 100;
            }
        }
    }, 500);
}

function stopProgressTracking() {
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
}

if (progress) {
    progress.addEventListener("input", () => {
        if (player && typeof player.seekTo === "function" && typeof player.getDuration === "function") {
            const total = player.getDuration() || 0;
            const seekToTime = (progress.value / 100) * total;
            player.seekTo(seekToTime, true);
        }
    });
}

if (volume) {
    volume.addEventListener("input", () => {
        if (player && typeof player.setVolume === "function") {
            const volValue = volume.value * 100;
            player.setVolume(volValue);
        }
    });
}

// ==========================================
// LOCAL STORAGE (FAVORITES)
// ==========================================

function loadFavorites() {
    try {
        const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
        return Array.isArray(saved) ? saved : [];
    } catch (e) {
        return [];
    }
}

function saveFavorites() {
    try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
        return true;
    } catch (e) {
        return false;
    }
}

function toggleFavorite(song) {
    if (!song || !songKey(song)) return;
    const key = songKey(song);
    const wasFavorite = isFavorite(song);

    favorites = wasFavorite
        ? favorites.filter((item) => songKey(item) !== key)
        : [...favorites, song];

    saveFavorites();
    renderLibrary();
    renderResults(searchResults);
    updateFavoriteButton();
    setStatus(wasFavorite ? "Removed from favorites." : "Added to favorites!");
}

function updateFavoriteButton() {
    if (!favoriteButton) return;
    const saved = Boolean(currentSong && isFavorite(currentSong));
    favoriteButton.textContent = saved ? "♥" : "♡";
    favoriteButton.classList.toggle("is-favorite", saved);
}

// ==========================================
// SEARCH SONGS & LIVE AUTOCOMPLETE
// ==========================================

async function searchSongs(query) {
    const cleanQuery = String(query || "").trim();
    if (!cleanQuery) {
        setStatus("Please enter a song name or artist.", true);
        searchInput?.focus();
        return;
    }

    const requestNumber = ++searchRequestNumber;
    setStatus(`⏳ Searching for "${cleanQuery}"... Please wait.`);

    if (searchSubmit) {
        searchSubmit.disabled = true;
        searchSubmit.textContent = "Searching...";
    }

    if (resultsHeading) resultsHeading.textContent = `Results for "${cleanQuery}"`;
    if (resultsCaption) resultsCaption.textContent = "⏳ Searching...";
    if (musicGrid) musicGrid.replaceChildren();
    setHidden(musicEmpty, true);

    try {
        const response = await fetch(`${SEARCH_API_URL}?q=${encodeURIComponent(cleanQuery)}`, {
            headers: { "Accept": "application/json" }
        });

        if (!response.ok) throw new Error("Search failed");
        const data = await response.json();
        if (requestNumber !== searchRequestNumber) return;

        const fetchedSongs = (data.results || []).map(normalizeSong).filter(Boolean);
        
        searchResults = [...fetchedSongs, ...defaultFeaturedSongs];

        if (resultsHeading) resultsHeading.textContent = `Results for "${cleanQuery}" & related tracks`;
        if (resultsCaption) resultsCaption.textContent = `${searchResults.length} songs found`;

        renderResults(searchResults);
        setStatus(searchResults.length ? "Songs found! Click Play to listen." : "No songs found.");
    } catch (error) {
        console.error("Search error:", error);
        if (requestNumber !== searchRequestNumber) return;
        searchResults = defaultFeaturedSongs;
        renderResults(searchResults);
        setStatus("Could not connect to online search, showing default tracks instead.", true);
    } finally {
        if (requestNumber === searchRequestNumber && searchSubmit) {
            searchSubmit.disabled = false;
            searchSubmit.textContent = "Search";
        }
    }
}

// Live Autocomplete matching keywords (e.g., "me" filters all relevant songs instantly)
if (searchInput) {
    searchInput.addEventListener("input", (e) => {
        const val = e.target.value.toLowerCase().trim();
        const combinedPool = [...defaultFeaturedSongs, ...searchResults];

        if (val.length > 0) {
            const filtered = combinedPool.filter(song => 
                song.title.toLowerCase().includes(val) || song.artist.toLowerCase().includes(val)
            );
            const uniqueResults = Array.from(new Set(filtered.map(s => s.videoId)))
                .map(id => filtered.find(s => s.videoId === id));
            
            searchResults = uniqueResults.length > 0 ? uniqueResults : defaultFeaturedSongs;
            renderResults(searchResults);

            if (resultsHeading) resultsHeading.textContent = `Results matching "${val}"`;
            if (resultsCaption) resultsCaption.textContent = `${searchResults.length} songs found`;
        } else {
            searchResults = defaultFeaturedSongs;
            renderResults(searchResults);
            if (resultsHeading) resultsHeading.textContent = "Featured Songs";
            if (resultsCaption) resultsCaption.textContent = "Choose a song to play or search for your favorite tracks";
        }
    });
}

// ==========================================
// RENDER CARDS & ARTWORKS (Spotify Layout Style)
// ==========================================

function createArtwork(song) {
    const image = document.createElement("img");
    image.src = song.thumbnail;
    image.alt = `${song.title} artwork`;
    image.loading = "lazy";
    image.onerror = () => {
        image.onerror = null;
        image.src = "https://placehold.co/400x400/25213a/ffffff?text=SoundWave";
    };
    return image;
}

function renderResults(songs) {
    if (!musicGrid) return;
    musicGrid.replaceChildren();

    musicGrid.style.display = "grid";
    musicGrid.style.gridTemplateColumns = "repeat(auto-fill, minmax(160px, 1fr))";
    musicGrid.style.gap = "18px";
    musicGrid.style.justifyContent = "start";

    if (!songs.length) {
        setHidden(musicEmpty, false);
        return;
    }
    setHidden(musicEmpty, true);

    songs.forEach((song) => {
        const card = document.createElement("article");
        
        const isCurrentPlaying = currentSong && songKey(currentSong) === songKey(song);
        card.className = `music-card ${isCurrentPlaying ? "is-playing" : ""}`;
        
        card.style.background = "#181528";
        card.style.borderRadius = "12px";
        card.style.padding = "12px";
        card.style.transition = "transform 0.2s ease, background 0.2s ease";
        card.style.cursor = "pointer";

        card.addEventListener("mouseenter", () => card.style.background = "#231f3d");
        card.addEventListener("mouseleave", () => card.style.background = "#181528");

        const cover = document.createElement("div");
        cover.className = "music-card-cover";
        cover.style.width = "100%";
        cover.style.aspectRatio = "1 / 1";
        cover.style.borderRadius = "8px";
        cover.style.overflow = "hidden";
        cover.style.marginBottom = "10px";
        cover.appendChild(createArtwork(song));

        const info = document.createElement("div");
        info.className = "music-card-info";

        const title = document.createElement("h3");
        title.textContent = song.title;
        title.style.fontSize = "14px";
        title.style.fontWeight = "700";
        title.style.color = "#ffffff";
        title.style.whiteSpace = "nowrap";
        title.style.overflow = "hidden";
        title.style.textOverflow = "ellipsis";
        title.style.marginBottom = "4px";

        const artist = document.createElement("p");
        artist.textContent = song.artist;
        artist.style.fontSize = "12px";
        artist.style.color = "#a29fb4";
        artist.style.whiteSpace = "nowrap";
        artist.style.overflow = "hidden";
        artist.style.textOverflow = "ellipsis";

        info.append(title, artist);

        const actions = document.createElement("div");
        actions.className = "music-card-actions";
        actions.style.display = "flex";
        actions.style.gap = "6px";
        actions.style.marginTop = "8px";

        const play = document.createElement("button");
        play.className = "play-song-btn";
        play.textContent = isCurrentPlaying ? "⏸" : "▶";
        play.style.flex = "1";
        play.style.padding = "6px";
        play.style.background = "#6c4df6";
        play.style.color = "#fff";
        play.style.border = "none";
        play.style.borderRadius = "6px";
        play.style.cursor = "pointer";
        play.addEventListener("click", (e) => {
            e.stopPropagation();
            playSong(song);
        });

        const save = document.createElement("button");
        save.className = "card-favorite-btn";
        save.textContent = isFavorite(song) ? "♥" : "♡";
        save.style.padding = "6px 10px";
        save.style.background = "transparent";
        save.style.color = isFavorite(song) ? "#ff4d4d" : "#a29fb4";
        save.style.border = "1px solid #363252";
        save.style.borderRadius = "6px";
        save.style.cursor = "pointer";
        save.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleFavorite(song);
        });

        actions.append(play, save);
        card.append(cover, info, actions);
        card.addEventListener("click", () => playSong(song));
        
        musicGrid.appendChild(card);
    });
}

// ==========================================
// PLAYBACK ENGINE (YOUTUBE IFRAME)
// ==========================================

function playSong(song) {
    if (!song) return;
    currentSong = song;

    const index = searchResults.findIndex((item) => songKey(item) === songKey(song));
    if (index > -1) {
        searchResults.splice(index, 1);
        searchResults.unshift(song);
    } else {
        searchResults.unshift(song);
    }
    currentIndex = 0;

    if (currentCover) currentCover.src = song.thumbnail;
    if (currentTitle) currentTitle.textContent = song.title;
    if (currentArtist) currentArtist.textContent = song.artist;

    updateFavoriteButton();
    renderResults(searchResults);

    if (player && song.videoId && typeof player.loadVideoById === "function") {
        player.loadVideoById(song.videoId);
        setStatus(`Now playing: ${song.title}`);
        if (volume && typeof player.setVolume === "function") {
            player.setVolume(volume.value * 100);
        }
    } else {
        initYouTubePlayer();
        setStatus("Starting playback, please wait...", false);
        setTimeout(() => {
            if (player && typeof player.loadVideoById === "function") {
                player.loadVideoById(song.videoId);
                setStatus(`Now playing: ${song.title}`);
                if (volume) player.setVolume(volume.value * 100);
            } else {
                setStatus("Click Play to try again.", true);
            }
        }, 1200);
    }
}

function togglePlayback() {
    if (!currentSong) {
        if (searchResults.length) playSong(searchResults[0]);
        else setStatus("Please select a song first.");
        return;
    }

    if (player && typeof player.getPlayerState === "function") {
        const state = player.getPlayerState();
        if (state === YT.PlayerState.PLAYING) {
            player.pauseVideo();
        } else {
            player.playVideo();
        }
    }
}

function playAdjacentSong(direction) {
    if (!searchResults.length) return;
    let index = currentIndex < 0 ? (direction > 0 ? 0 : searchResults.length - 1) : (currentIndex + direction + searchResults.length) % searchResults.length;
    playSong(searchResults[index]);
}

// ==========================================
// EVENT LISTENERS & CONTROLS
// ==========================================

if (playButton) playButton.addEventListener("click", togglePlayback);
if (previousButton) previousButton.addEventListener("click", () => playAdjacentSong(-1));
if (nextButton) nextButton.addEventListener("click", () => playAdjacentSong(1));
if (favoriteButton) favoriteButton.addEventListener("click", () => currentSong && toggleFavorite(currentSong));

if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
        e.preventDefault();
        searchSongs(searchInput?.value || "");
    });
}

// ==========================================
// LIBRARY
// ==========================================

function renderLibrary() {
    if (!songList) return;
    songList.replaceChildren();
    if (songCount) songCount.textContent = String(favorites.length);
    setHidden(noResults, favorites.length > 0);

    favorites.forEach((song) => {
        const row = document.createElement("div");
        row.className = "song-row library-song";

        const img = createArtwork(song);
        img.className = "library-song-cover";
        img.style.width = "40px";
        img.style.height = "40px";
        img.style.borderRadius = "6px";

        const details = document.createElement("div");
        details.className = "library-song-info";
        const title = document.createElement("strong");
        title.textContent = song.title;
        const artist = document.createElement("p");
        artist.textContent = song.artist;
        details.append(title, artist);

        const actions = document.createElement("div");
        actions.className = "library-song-actions";

        const play = document.createElement("button");
        play.className = "play-song-btn";
        play.textContent = "▶";
        play.addEventListener("click", () => playSong(song));

        const remove = document.createElement("button");
        remove.className = "card-favorite-btn";
        remove.textContent = "♥";
        remove.addEventListener("click", () => toggleFavorite(song));

        actions.append(play, remove);
        row.append(img, details, actions);
        songList.appendChild(row);
    });
}

// Initialize Dashboard with default songs on page load
window.addEventListener("DOMContentLoaded", () => {
    renderLibrary();
    updateFavoriteButton();
    if (searchResults.length === 0 && musicGrid) {
        searchResults = defaultFeaturedSongs;
        renderResults(searchResults);
        if (resultsHeading) resultsHeading.textContent = "Featured Songs";
        if (resultsCaption) resultsCaption.textContent = "Choose a song to play or search for your favorite tracks";
    }
});