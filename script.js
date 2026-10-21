"use strict";

// ==========================================
// SOUNDWAVE - YouTube Music Engine & Dynamic UI
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
let player = null;
let progressInterval = null;

// ==========================================
// FEATURED SONGS
// ==========================================

const defaultFeaturedSongs = [
    { videoId: "5qap5aO4i9A", title: "Lofi Hip Hop Radio", artist: "Lofi Girl", category: "lofi", thumbnail: "https://i.ytimg.com/vi/5qap5aO4i9A/hqdefault.jpg" },
    { videoId: "jfKfPfyJRdk", title: "Lofi Hip Hop - Chill Beats", artist: "Lofi Girl", category: "lofi", thumbnail: "https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg" },
    { videoId: "60ItHLz5WEA", title: "Montero (Call Me By Your Name)", artist: "Lil Nas X", category: "pop", thumbnail: "https://i.ytimg.com/vi/60ItHLz5WEA/hqdefault.jpg" },
    { videoId: "2Vv-BfVoq4g", title: "Shape of You", artist: "Ed Sheeran", category: "pop", thumbnail: "https://i.ytimg.com/vi/2Vv-BfVoq4g/hqdefault.jpg" },
    { videoId: "5NV6Rdv1a3I", title: "Levitating", artist: "Dua Lipa", category: "pop", thumbnail: "https://i.ytimg.com/vi/5NV6Rdv1a3I/hqdefault.jpg" },
    { videoId: "kJQP7kiw5Fk", title: "Despacito", artist: "Luis Fonsi ft. Daddy Yankee", category: "latin", thumbnail: "https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg" },
    { videoId: "fJ9rUzIMcZQ", title: "Bohemian Rhapsody", artist: "Queen", category: "rock", thumbnail: "https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg" },
    { videoId: "OPf0YbXqDm0", title: "Uptown Funk", artist: "Mark Ronson ft. Bruno Mars", category: "funk", thumbnail: "https://i.ytimg.com/vi/OPf0YbXqDm0/hqdefault.jpg" }
];

// ==========================================
// PERSONALIZATION, TIME, & LOCATION (DYNAMIC DASHBOARD)
// ==========================================

async function initUserParameters() {
    try {
        const response = await fetch("/api/me", { headers: { Accept: "application/json" } });
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.user) {
                updateDynamicGreeting(data.user.fullName);
                updateAuthNavbar(data.user);
            }
        }
    } catch (e) {
        console.log("User not logged in or offline mode.");
    }

    // Geolocation & Time parameters
    const hour = new Date().getHours();
    let timeContext = "Enjoy your day";
    if (hour < 12) timeContext = "Good morning";
    else if (hour < 17) timeContext = "Good afternoon";
    else timeContext = "Good evening";

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (position) => {
            const lat = position.coords.latitude.toFixed(1);
            const lon = position.coords.longitude.toFixed(1);
            const locationText = `Location: Lat ${lat}, Lon ${lon} (${timeContext})`;
            
            if (resultsCaption) {
                resultsCaption.textContent = locationText;
            }

            // Save preferences to Aiven MySQL
            try {
                await fetch("/api/preferences", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ location: `Lat ${lat}, Lon ${lon}`, genre: "Mix" })
                });
            } catch (err) {}
        }, () => {
            if (resultsCaption) resultsCaption.textContent = `${timeContext}, Music Lover!`;
        });
    }
}

function updateDynamicGreeting(userName) {
    const headerTitle = document.querySelector(".topbar h1");
    if (headerTitle) {
        headerTitle.innerHTML = `Welcome back, <span class="gradient-text">${userName}</span>.`;
    }
}

function updateAuthNavbar(user) {
    const authNav = document.querySelector(".auth-links");
    if (authNav) {
        authNav.innerHTML = `
            <span style="color: #fff; font-size: 14px; margin-right: 10px;">👤 ${user.fullName}</span>
            <button id="logout-btn" style="background: #ff4d4d; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer;">Logout</button>
        `;
        document.getElementById("logout-btn").addEventListener("click", async () => {
            await fetch("/api/logout", { method: "POST" });
            window.location.reload();
        });
    }
}

// ==========================================
// YOUTUBE IFRAME API
// ==========================================

if (!window.YT) {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];

    if (firstScriptTag && firstScriptTag.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
}

window.onYouTubeIframeAPIReady = function () {
    initYouTubePlayer();
};

function initYouTubePlayer() {
    if (player || !document.getElementById("youtube-player")) return;
    if (!window.YT || !window.YT.Player) return;

    player = new YT.Player("youtube-player", {
        height: "1",
        width: "1",
        playerVars: { playsinline: 1, controls: 0, autoplay: 1 },
        events: {
            onReady: () => {
                if (volume && player) player.setVolume(Number(volume.value) * 100);
            },
            onStateChange: onPlayerStateChange,
            onError: () => {
                setStatus("This video cannot be played. Try another song.", true);
                setButtonPlaying(false);
            }
        }
    });
}

function onPlayerStateChange(event) {
    if (!window.YT) return;

    if (event.data === YT.PlayerState.PLAYING) {
        setButtonPlaying(true);
        if (currentSong) setStatus(`Now playing: ${currentSong.title}`);
        startProgressTracking();
    } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
        setButtonPlaying(false);
        stopProgressTracking();
        if (event.data === YT.PlayerState.ENDED) playAdjacentSong(1);
    }
}

// ==========================================
// HELPERS & PLAYBACK
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

function normalizeSong(song) {
    if (!song) return null;
    const videoId = String(song.videoId || "").trim();
    return {
        key: videoId ? `youtube-${videoId}` : `song-${Math.random()}`,
        videoId,
        title: song.title || "Unknown song",
        artist: song.artist || "Unknown artist",
        thumbnail: song.thumbnail || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : "")
    };
}

function uniqueSongs(songs) {
    const seen = new Set();
    return songs.filter((song) => {
        const key = songKey(song);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
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
    if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

function playSong(song) {
    if (!song || !song.videoId) return;
    currentSong = song;
    currentIndex = searchResults.findIndex((item) => songKey(item) === songKey(song));

    if (currentCover) currentCover.src = song.thumbnail;
    if (currentTitle) currentTitle.textContent = song.title;
    if (currentArtist) currentArtist.textContent = song.artist;

    updateFavoriteButton();

    if (player && typeof player.loadVideoById === "function") {
        player.loadVideoById(song.videoId);
    } else {
        initYouTubePlayer();
        setTimeout(() => {
            if (player && typeof player.loadVideoById === "function") {
                player.loadVideoById(song.videoId);
            }
        }, 1000);
    }
    renderResults(searchResults);
    renderLibrary();
}

function playAdjacentSong(direction) {
    if (!searchResults.length) return;
    if (currentIndex === -1) currentIndex = 0;
    currentIndex = (currentIndex + direction + searchResults.length) % searchResults.length;
    playSong(searchResults[currentIndex]);
}

if (playButton) {
    playButton.addEventListener("click", () => {
        if (!player) return;
        if (player.getPlayerState() === YT.PlayerState.PLAYING) {
            player.pauseVideo();
        } else {
            player.playVideo();
        }
    });
}

if (nextButton) nextButton.addEventListener("click", () => playAdjacentSong(1));
if (previousButton) previousButton.addEventListener("click", () => playAdjacentSong(-1));

if (favoriteButton) {
    favoriteButton.addEventListener("click", () => {
        if (currentSong) toggleFavorite(currentSong);
    });
}

function updateFavoriteButton() {
    if (!favoriteButton) return;
    const saved = Boolean(currentSong && isFavorite(currentSong));
    favoriteButton.textContent = saved ? "♥" : "♡";
}

// ==========================================
// LIBRARY & FAVORITES
// ==========================================

function loadFavorites() {
    try {
        return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    } catch (e) {
        return [];
    }
}

function saveFavorites() {
    try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    } catch (e) {}
}

function toggleFavorite(song) {
    const key = songKey(song);
    const wasFavorite = isFavorite(song);
    favorites = wasFavorite ? favorites.filter(item => songKey(item) !== key) : [...favorites, song];
    saveFavorites();
    updateFavoriteButton();
    renderLibrary();
    setStatus(wasFavorite ? "Removed from favorites." : "Added to favorites!");
}

function renderLibrary() {
    if (!songList) return;
    songList.replaceChildren();

    if (songCount) songCount.textContent = favorites.length;

    if (!favorites.length) {
        setHidden(noResults, false);
        return;
    }
    setHidden(noResults, true);

    favorites.forEach((song) => {
        const item = document.createElement("div");
        item.className = "library-song-item";
        Object.assign(item.style, { display: "flex", alignItems: "center", gap: "10px", padding: "8px", cursor: "pointer", borderBottom: "1px solid #231f3d" });

        const title = document.createElement("span");
        title.textContent = `${song.title} - ${song.artist}`;
        title.style.color = "#fff";
        title.style.fontSize = "13px";

        item.appendChild(title);
        item.addEventListener("click", () => playSong(song));
        songList.appendChild(item);
    });
}

// ==========================================
// SEARCH SONGS
// ==========================================

async function searchSongs(query) {
    const cleanQuery = String(query || "").trim();
    if (!cleanQuery) return;

    setStatus(`Searching for "${cleanQuery}"...`);

    try {
        const response = await fetch(`${SEARCH_API_URL}?q=${encodeURIComponent(cleanQuery)}`, {
            headers: { Accept: "application/json" }
        });
        const data = await response.json();

        searchResults = uniqueSongs((data.results || []).map(normalizeSong).filter(Boolean));
        renderResults(searchResults);
        setStatus(searchResults.length ? "Songs found!" : "No songs found.");
    } catch (error) {
        console.error("Search error:", error);
        setStatus("Online search failed.", true);
    }
}

if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
        e.preventDefault();
        if (searchInput) searchSongs(searchInput.value);
    });
}

function renderResults(songs) {
    if (!musicGrid) return;
    musicGrid.replaceChildren();

    if (!songs.length) {
        setHidden(musicEmpty, false);
        return;
    }
    setHidden(musicEmpty, true);

    songs.forEach((song) => {
        const card = document.createElement("article");
        const isCurrentPlaying = currentSong && songKey(currentSong) === songKey(song);
        card.className = `music-card ${isCurrentPlaying ? "is-playing" : ""}`;

        Object.assign(card.style, {
            background: "#181528",
            borderRadius: "12px",
            padding: "12px",
            cursor: "pointer"
        });

        const cover = document.createElement("div");
        cover.style.width = "100%";
        cover.style.aspectRatio = "1 / 1";
        cover.style.borderRadius = "8px";
        cover.style.overflow = "hidden";
        cover.style.marginBottom = "10px";

        const img = document.createElement("img");
        img.src = song.thumbnail;
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.objectFit = "cover";
        cover.appendChild(img);

        const title = document.createElement("h3");
        title.textContent = song.title;
        Object.assign(title.style, { fontSize: "14px", color: "#ffffff", marginBottom: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" });

        const artist = document.createElement("p");
        artist.textContent = song.artist;
        Object.assign(artist.style, { fontSize: "12px", color: "#a29fb4", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" });

        card.append(cover, title, artist);
        card.addEventListener("click", () => playSong(song));
        musicGrid.appendChild(card);
    });
}

// Progress and volume tracking
function startProgressTracking() {
    stopProgressTracking();
    progressInterval = setInterval(() => {
        if (player && typeof player.getCurrentTime === "function") {
            const current = player.getCurrentTime() || 0;
            const total = player.getDuration() || 0;
            if (currentTimeEl) currentTimeEl.textContent = formatTime(current);
            if (durationEl) durationEl.textContent = formatTime(total);
            if (progress && total > 0) progress.value = (current / total) * 100;
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
            player.seekTo((Number(progress.value) / 100) * total, true);
        }
    });
}

if (volume) {
    volume.addEventListener("input", () => {
        if (player && typeof player.setVolume === "function") {
            player.setVolume(Number(volume.value) * 100);
        }
    });
}

// Initialize on load
document.addEventListener("DOMContentLoaded", () => {
    searchResults = defaultFeaturedSongs.slice();
    renderResults(searchResults);
    renderLibrary();
    initUserParameters();
});