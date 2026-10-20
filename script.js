"use strict";

// ==========================================
// SOUNDWAVE - YouTube Music Engine
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
let autocompleteRequestNumber = 0;
let autocompleteTimer = null;
let player = null;
let progressInterval = null;
let activeSuggestionIndex = -1;

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
    { videoId: "OPf0YbXqDm0", title: "Uptown Funk", artist: "Mark Ronson ft. Bruno Mars", category: "funk", thumbnail: "https://i.ytimg.com/vi/OPf0YbXqDm0/hqdefault.jpg" },
    { videoId: "YQHsXMglC9A", title: "Hello", artist: "Adele", category: "ballad", thumbnail: "https://i.ytimg.com/vi/YQHsXMglC9A/hqdefault.jpg" },
    { videoId: "hTWKbfoikeg", title: "Smells Like Teen Spirit", artist: "Nirvana", category: "rock", thumbnail: "https://i.ytimg.com/vi/hTWKbfoikeg/hqdefault.jpg" },
    { videoId: "RgKAFK5djSk", title: "See You Again", artist: "Wiz Khalifa ft. Charlie Puth", category: "hiphop", thumbnail: "https://i.ytimg.com/vi/RgKAFK5djSk/hqdefault.jpg" },
    { videoId: "CevxZvSJLk8", title: "Roar", artist: "Katy Perry", category: "pop", thumbnail: "https://i.ytimg.com/vi/CevxZvSJLk8/hqdefault.jpg" },
    { videoId: "09R8_2nJtjg", title: "Sugar", artist: "Maroon 5", category: "pop", thumbnail: "https://i.ytimg.com/vi/09R8_2nJtjg/hqdefault.jpg" },
    { videoId: "JGwWNGJdvx8", title: "Shape of You", artist: "Ed Sheeran", category: "pop", thumbnail: "https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg" },
    { videoId: "3JZ_D3ELwOQ", title: "Blank Space", artist: "Taylor Swift", category: "pop", thumbnail: "https://i.ytimg.com/vi/3JZ_D3ELwOQ/hqdefault.jpg" },
    { videoId: "fLexgOxsZu0", title: "Hips Don't Lie", artist: "Shakira ft. Wyclef Jean", category: "latin", thumbnail: "https://i.ytimg.com/vi/fLexgOxsZu0/hqdefault.jpg" },
    { videoId: "uelHwf8o7_U", title: "Counting Stars", artist: "OneRepublic", category: "rock", thumbnail: "https://i.ytimg.com/vi/uelHwf8o7_U/hqdefault.jpg" },
    { videoId: "m7Bc3pLyij0", title: "Demons", artist: "Imagine Dragons", category: "rock", thumbnail: "https://i.ytimg.com/vi/m7Bc3pLyij0/hqdefault.jpg" },
    { videoId: "ktvTqknDobU", title: "Radioactive", artist: "Imagine Dragons", category: "rock", thumbnail: "https://i.ytimg.com/vi/ktvTqknDobU/hqdefault.jpg" },
    { videoId: "rbtoAluzI-E", title: "Payphone", artist: "Maroon 5 ft. Wiz Khalifa", category: "pop", thumbnail: "https://i.ytimg.com/vi/rbtoAluzI-E/hqdefault.jpg" },
    { videoId: "DHrQUWZgnG8", title: "Burn", artist: "Ellie Goulding", category: "pop", thumbnail: "https://i.ytimg.com/vi/DHrQUWZgnG8/hqdefault.jpg" },
    { videoId: "KkTzTj4xCCS", title: "Stitches", artist: "Shawn Mendes", category: "pop", thumbnail: "https://i.ytimg.com/vi/KkTzTj4xCCS/hqdefault.jpg" },
    { videoId: "ZnWzHmsF7qY", title: "Treat You Better", artist: "Shawn Mendes", category: "pop", thumbnail: "https://i.ytimg.com/vi/ZnWzHmsF7qY/hqdefault.jpg" },
    { videoId: "lp-EO5I60KA", title: "Perfect", artist: "Ed Sheeran", category: "ballad", thumbnail: "https://i.ytimg.com/vi/lp-EO5I60KA/hqdefault.jpg" },
    { videoId: "nfWlot6h_JM", title: "Shake It Off", artist: "Taylor Swift", category: "pop", thumbnail: "https://i.ytimg.com/vi/nfWlot6h_JM/hqdefault.jpg" },
    { videoId: "QcIy9NiNbmo", title: "Someone Like You", artist: "Adele", category: "ballad", thumbnail: "https://i.ytimg.com/vi/QcIy9NiNbmo/hqdefault.jpg" },
    { videoId: "XFkzRNyygfk", title: "Watermelon Sugar", artist: "Harry Styles", category: "pop", thumbnail: "https://i.ytimg.com/vi/XFkzRNyygfk/hqdefault.jpg" },
    { videoId: "Pkh8Utuejgs", title: "One Love", artist: "Bob Marley", category: "reggae", thumbnail: "https://i.ytimg.com/vi/Pkh8Utuejgs/hqdefault.jpg" },
    { videoId: "y6Sxv-sUYtM", title: "Happy", artist: "Pharrell Williams", category: "pop", thumbnail: "https://i.ytimg.com/vi/y6Sxv-sUYtM/hqdefault.jpg" },
    { videoId: "hT_nvWreIhg", title: "Counting Sheep", artist: "SAFIA", category: "indie", thumbnail: "https://i.ytimg.com/vi/hT_nvWreIhg/hqdefault.jpg" },
    { videoId: "fWNaR-rxAic", title: "Locked Out of Heaven", artist: "Bruno Mars", category: "pop", thumbnail: "https://i.ytimg.com/vi/fWNaR-rxAic/hqdefault.jpg" },
    { videoId: "bBC-nXj3Ng4", title: "Just the Way You Are", artist: "Bruno Mars", category: "pop", thumbnail: "https://i.ytimg.com/vi/bBC-nXj3Ng4/hqdefault.jpg" },
    { videoId: "e-ORhEE9VVg", title: "The Lazy Song", artist: "Bruno Mars", category: "pop", thumbnail: "https://i.ytimg.com/vi/e-ORhEE9VVg/hqdefault.jpg" },
    { videoId: "3JWTaaS7LdU", title: "Sign of the Times", artist: "Harry Styles", category: "pop", thumbnail: "https://i.ytimg.com/vi/3JWTaaS7LdU/hqdefault.jpg" }
];

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
        playerVars: {
            playsinline: 1,
            controls: 0,
            autoplay: 1
        },
        events: {
            onReady: () => {
                console.log("SoundWave YouTube player is ready.");

                if (volume && player) {
                    player.setVolume(Number(volume.value) * 100);
                }
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

        if (currentSong) {
            setStatus(`Now playing: ${currentSong.title}`);
        }

        startProgressTracking();
    } else if (
        event.data === YT.PlayerState.PAUSED ||
        event.data === YT.PlayerState.ENDED
    ) {
        setButtonPlaying(false);
        stopProgressTracking();

        if (event.data === YT.PlayerState.ENDED) {
            playAdjacentSong(1);
        }
    }
}

// ==========================================
// HELPERS
// ==========================================

function setStatus(message, isError = false) {
    if (!searchStatus) return;

    searchStatus.textContent = message;
    searchStatus.style.color = isError ? "#ff4d4d" : "";
}

function songKey(song) {
    if (!song || typeof song !== "object") return "";

    return song.videoId
        ? `youtube-${song.videoId}`
        : song.key || "";
}

// FIXED: Correct regex and preserve titles containing hyphens.
function cleanSongTitle(title) {
    if (!title) return "Unknown song";

    return String(title)
        .replace(
            /\s*[\[(]?\s*(?:official(?:\s+music)?\s+video|lyrics(?:\s+video)?|official audio|audio|visualizer)\s*[\])]?/gi,
            ""
        )
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeSong(song) {
    if (!song) return null;

    const videoId = String(song.videoId || "").trim();
    const rawTitle = song.title || "Unknown song";

    return {
        key: videoId ? `youtube-${videoId}` : `song-${Math.random()}`,
        videoId,
        title: cleanSongTitle(rawTitle),
        artist: song.artist || "Unknown artist",
        category: song.category || "general",
        thumbnail: song.thumbnail ||
            (videoId
                ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
                : "https://placehold.co/400x400/25213a/ffffff?text=SoundWave")
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

    return Boolean(
        key && favorites.some((item) => songKey(item) === key)
    );
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

// ==========================================
// AUTOCOMPLETE UI
// ==========================================

let autocompleteBox = null;

function createAutocompleteBox() {
    if (autocompleteBox || !searchInput) return;

    const anchor = searchInput.parentElement || searchForm;
    if (!anchor) return;

    // Keep the suggestions panel positioned relative to the search input.
    if (getComputedStyle(anchor).position === "static") {
        anchor.style.position = "relative";
    }

    autocompleteBox = document.createElement("div");
    autocompleteBox.id = "soundwave-autocomplete";

    Object.assign(autocompleteBox.style, {
        position: "absolute",
        top: "100%",
        left: "0",
        right: "0",
        zIndex: "9999",
        display: "none",
        maxHeight: "320px",
        overflowY: "auto",
        background: "#181528",
        border: "1px solid #363252",
        borderRadius: "10px",
        boxShadow: "0 12px 28px rgba(0,0,0,0.35)",
        marginTop: "6px"
    });

    anchor.appendChild(autocompleteBox);
}

function hideAutocomplete() {
    if (!autocompleteBox) return;

    autocompleteBox.style.display = "none";
    autocompleteBox.replaceChildren();
    activeSuggestionIndex = -1;
}

function showAutocomplete(songs, query) {
    createAutocompleteBox();

    if (!autocompleteBox) return;

    autocompleteBox.replaceChildren();
    activeSuggestionIndex = -1;

    const cleanQuery = String(query || "").trim();

    if (cleanQuery.length < 1 || !songs.length) {
        hideAutocomplete();
        return;
    }

    songs.slice(0, 8).forEach((song, index) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "autocomplete-item";

        Object.assign(item.style, {
            display: "flex",
            alignItems: "center",
            gap: "10px",
            width: "100%",
            padding: "10px",
            border: "none",
            borderBottom: "1px solid #302b49",
            background: "transparent",
            color: "#ffffff",
            textAlign: "left",
            cursor: "pointer"
        });

        const image = document.createElement("img");
        image.src = song.thumbnail;
        image.alt = "";
        image.width = 42;
        image.height = 42;

        Object.assign(image.style, {
            width: "42px",
            height: "42px",
            objectFit: "cover",
            borderRadius: "6px",
            flexShrink: "0"
        });

        image.onerror = () => {
            image.onerror = null;
            image.src =
                "https://placehold.co/80x80/25213a/ffffff?text=Music";
        };

        const textContainer = document.createElement("span");
        textContainer.style.minWidth = "0";
        textContainer.style.flex = "1";

        const title = document.createElement("strong");
        title.textContent = song.title;

        Object.assign(title.style, {
            display: "block",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: "13px"
        });

        const artist = document.createElement("span");
        artist.textContent = song.artist;

        Object.assign(artist.style, {
            display: "block",
            marginTop: "3px",
            color: "#a29fb4",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: "12px"
        });

        textContainer.append(title, artist);
        item.append(image, textContainer);

        item.addEventListener("mouseenter", () => {
            item.style.background = "#30264d";
        });

        item.addEventListener("mouseleave", () => {
            item.style.background = "transparent";
        });

        item.addEventListener("click", () => {
            searchInput.value = song.title;
            hideAutocomplete();

            // Ensure the chosen song is in the playback list.
            if (!searchResults.some((item) => songKey(item) === songKey(song))) {
                searchResults.unshift(song);
            }

            playSong(song);
        });

        autocompleteBox.appendChild(item);
    });

    autocompleteBox.style.display = "block";
}

function matchesAutocomplete(song, query) {
    const q = String(query || "").toLowerCase().trim();

    if (!q || !song) return false;

    const title = String(song.title || "").toLowerCase().trim();
    const artist = String(song.artist || "").toLowerCase().trim();

    // Show tracks whose titles or artist names start with the typed text.
    return title.startsWith(q) || artist.startsWith(q);
}

function updateLocalAutocomplete(query) {
    const q = String(query || "").trim();

    if (!q) {
        hideAutocomplete();
        return;
    }

    const pool = uniqueSongs([
        ...defaultFeaturedSongs,
        ...searchResults,
        ...favorites
    ]);

    // Show matches first; also allow matching a word within the title.
    const lowerQuery = q.toLowerCase();

    const startsWithMatches = pool.filter((song) =>
        matchesAutocomplete(song, q)
    );

    const containsMatches = pool.filter((song) => {
        const title = String(song.title || "").toLowerCase();
        const artist = String(song.artist || "").toLowerCase();

        return (
            (title.includes(lowerQuery) || artist.includes(lowerQuery)) &&
            !startsWithMatches.some(
                (match) => songKey(match) === songKey(song)
            )
        );
    });

    showAutocomplete(
        uniqueSongs([...startsWithMatches, ...containsMatches]),
        q
    );
}

async function fetchRemoteAutocomplete(query) {
    const q = String(query || "").trim();

    if (q.length < 2) return;

    const requestNumber = ++autocompleteRequestNumber;

    try {
        const response = await fetch(
            `${SEARCH_API_URL}?q=${encodeURIComponent(q)}`,
            { headers: { Accept: "application/json" } }
        );

        if (!response.ok) return;

        const data = await response.json();

        // Ignore results for an older query.
        if (requestNumber !== autocompleteRequestNumber) return;
        if (!searchInput || searchInput.value.trim() !== q) return;

        const remoteSongs = (data.results || [])
            .map(normalizeSong)
            .filter(Boolean);

        const pool = uniqueSongs([
            ...remoteSongs,
            ...defaultFeaturedSongs,
            ...searchResults,
            ...favorites
        ]);

        const lowerQuery = q.toLowerCase();

        const startsWithMatches = pool.filter((song) =>
            matchesAutocomplete(song, q)
        );

        const otherMatches = pool.filter((song) => {
            const title = String(song.title || "").toLowerCase();
            const artist = String(song.artist || "").toLowerCase();

            return (
                (title.includes(lowerQuery) || artist.includes(lowerQuery)) &&
                !startsWithMatches.some(
                    (match) => songKey(match) === songKey(song)
                )
            );
        });

        showAutocomplete(
            uniqueSongs([...startsWithMatches, ...otherMatches]),
            q
        );
    } catch (error) {
        // Local autocomplete remains available if the server is offline.
        console.warn("Remote autocomplete unavailable:", error.message);
    }
}

// ==========================================
// PROGRESS AND VOLUME
// ==========================================

function startProgressTracking() {
    stopProgressTracking();

    progressInterval = setInterval(() => {
        if (
            player &&
            typeof player.getCurrentTime === "function" &&
            typeof player.getDuration === "function"
        ) {
            const current = player.getCurrentTime() || 0;
            const total = player.getDuration() || 0;

            if (currentTimeEl) {
                currentTimeEl.textContent = formatTime(current);
            }

            if (durationEl) {
                durationEl.textContent = formatTime(total);
            }

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
        if (
            player &&
            typeof player.seekTo === "function" &&
            typeof player.getDuration === "function"
        ) {
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

// ==========================================
// FAVORITES - LOCAL STORAGE
// ==========================================

function loadFavorites() {
    try {
        const saved = JSON.parse(
            localStorage.getItem(FAVORITES_KEY) || "[]"
        );

        return Array.isArray(saved) ? saved : [];
    } catch (error) {
        return [];
    }
}

function saveFavorites() {
    try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
        return true;
    } catch (error) {
        console.error("Could not save favorites:", error);
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

    setStatus(
        wasFavorite ? "Removed from favorites." : "Added to favorites!"
    );
}

function updateFavoriteButton() {
    if (!favoriteButton) return;

    const saved = Boolean(currentSong && isFavorite(currentSong));

    favoriteButton.textContent = saved ? "♥" : "♡";
    favoriteButton.classList.toggle("is-favorite", saved);
}

// ==========================================
// SEARCH SONGS
// ==========================================

async function searchSongs(query) {
    const cleanQuery = String(query || "").trim();

    if (!cleanQuery) {
        setStatus("Please enter a song name or artist.", true);
        searchInput?.focus();
        return;
    }

    hideAutocomplete();

    const requestNumber = ++searchRequestNumber;

    setStatus(`Searching for "${cleanQuery}"...`);

    if (searchSubmit) {
        searchSubmit.disabled = true;
        searchSubmit.textContent = "Searching...";
    }

    if (resultsHeading) {
        resultsHeading.textContent = `Results for "${cleanQuery}"`;
    }

    if (resultsCaption) {
        resultsCaption.textContent = "Searching online...";
    }

    if (musicGrid) musicGrid.replaceChildren();
    setHidden(musicEmpty, true);

    try {
        const response = await fetch(
            `${SEARCH_API_URL}?q=${encodeURIComponent(cleanQuery)}`,
            { headers: { Accept: "application/json" } }
        );

        if (!response.ok) {
            throw new Error(`Search request failed: ${response.status}`);
        }

        const data = await response.json();

        if (requestNumber !== searchRequestNumber) return;

        const fetchedSongs = (data.results || [])
            .map(normalizeSong)
            .filter(Boolean);

        // Show online results first; do not add every unrelated featured song.
        searchResults = uniqueSongs(fetchedSongs);

        if (resultsHeading) {
            resultsHeading.textContent = `Results for "${cleanQuery}"`;
        }

        if (resultsCaption) {
            resultsCaption.textContent =
                `${searchResults.length} songs found`;
        }

        renderResults(searchResults);

        setStatus(
            searchResults.length
                ? "Songs found! Choose a song to play."
                : "No matching songs found."
        );
    } catch (error) {
        console.error("Search error:", error);

        if (requestNumber !== searchRequestNumber) return;

        // Fall back to matching featured songs when online search fails.
        const q = cleanQuery.toLowerCase();

        searchResults = uniqueSongs(
            defaultFeaturedSongs.filter((song) =>
                song.title.toLowerCase().includes(q) ||
                song.artist.toLowerCase().includes(q)
            )
        );

        renderResults(searchResults);

        setStatus(
            searchResults.length
                ? "Showing matching featured songs. Online search is unavailable."
                : "Could not connect to online search. Check your connection.",
            true
        );

        if (resultsCaption) {
            resultsCaption.textContent =
                `${searchResults.length} featured songs found`;
        }
    } finally {
        if (requestNumber === searchRequestNumber && searchSubmit) {
            searchSubmit.disabled = false;
            searchSubmit.textContent = "Search";
        }
    }
}

// ==========================================
// SEARCH INPUT + LIVE AUTOCOMPLETE
// ==========================================

if (searchInput) {
    createAutocompleteBox();

    searchInput.setAttribute("autocomplete", "off");
    searchInput.setAttribute("aria-autocomplete", "list");

    searchInput.addEventListener("input", (event) => {
        const value = event.target.value.trim();

        // Show local suggestions immediately while typing.
        updateLocalAutocomplete(value);

        if (autocompleteTimer) {
            clearTimeout(autocompleteTimer);
        }

        if (value.length >= 2) {
            autocompleteTimer = setTimeout(() => {
                fetchRemoteAutocomplete(value);
            }, 350);
        } else {
            autocompleteRequestNumber++;
        }

        // Keep the existing music grid filtered as the user types.
        if (value.length > 0) {
            const pool = uniqueSongs([
                ...defaultFeaturedSongs,
                ...searchResults,
                ...favorites
            ]);

            const q = value.toLowerCase();

            const filtered = pool.filter((song) =>
                song.title.toLowerCase().includes(q) ||
                song.artist.toLowerCase().includes(q)
            );

            searchResults = uniqueSongs(filtered);
            renderResults(searchResults);

            if (resultsHeading) {
                resultsHeading.textContent = `Results matching "${value}"`;
            }

            if (resultsCaption) {
                resultsCaption.textContent =
                    `${searchResults.length} songs found`;
            }
        } else {
            searchResults = defaultFeaturedSongs.slice();
            renderResults(searchResults);

            if (resultsHeading) {
                resultsHeading.textContent = "Featured Songs";
            }

            if (resultsCaption) {
                resultsCaption.textContent =
                    "Choose a song to play or search for your favorite tracks";
            }
        }
    });

    searchInput.addEventListener("keydown", (event) => {
        if (!autocompleteBox || autocompleteBox.style.display === "none") {
            if (event.key === "Escape") hideAutocomplete();
            return;
        }

        const items = Array.from(
            autocompleteBox.querySelectorAll(".autocomplete-item")
        );

        if (!items.length) return;

        if (event.key === "ArrowDown") {
            event.preventDefault();
            activeSuggestionIndex =
                (activeSuggestionIndex + 1) % items.length;
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            activeSuggestionIndex =
                (activeSuggestionIndex - 1 + items.length) % items.length;
        } else if (event.key === "Escape") {
            hideAutocomplete();
            return;
        } else if (event.key === "Enter" && activeSuggestionIndex >= 0) {
            event.preventDefault();
            items[activeSuggestionIndex].click();
            return;
        } else {
            return;
        }

        items.forEach((item, index) => {
            item.style.background =
                index === activeSuggestionIndex ? "#30264d" : "transparent";
        });
    });

    document.addEventListener("click", (event) => {
        if (
            autocompleteBox &&
            !autocompleteBox.contains(event.target) &&
            event.target !== searchInput
        ) {
            hideAutocomplete();
        }
    });

    searchInput.addEventListener("focus", () => {
        if (searchInput.value.trim()) {
            updateLocalAutocomplete(searchInput.value);
        }
    });
}

// ==========================================
// ARTWORK
// ==========================================

function createArtwork(song) {
    const image = document.createElement("img");

    image.src = song.thumbnail;
    image.alt = `${song.title} artwork`;
    image.loading = "lazy";

    image.onerror = () => {
        image.onerror = null;
        image.src =
            "https://placehold.co/400x400/25213a/ffffff?text=SoundWave";
    };

    return image;
}

// ==========================================
// RENDER SONG CARDS
// ==========================================

function renderResults(songs) {
    if (!musicGrid) return;

    musicGrid.replaceChildren();

    musicGrid.style.display = "grid";
    musicGrid.style.gridTemplateColumns =
        "repeat(auto-fill, minmax(160px, 1fr))";
    musicGrid.style.gap = "18px";
    musicGrid.style.justifyContent = "start";

    if (!songs.length) {
        setHidden(musicEmpty, false);
        return;
    }

    setHidden(musicEmpty, true);

    songs.forEach((song) => {
        const card = document.createElement("article");

        const isCurrentPlaying =
            currentSong && songKey(currentSong) === songKey(song);

        card.className =
            `music-card ${isCurrentPlaying ? "is-playing" : ""}`;

        Object.assign(card.style, {
            background: "#181528",
            borderRadius: "12px",
            padding: "12px",
            transition: "transform 0.2s ease, background 0.2s ease",
            cursor: "pointer"
        });

        card.addEventListener("mouseenter", () => {
            card.style.background = "#231f3d";
        });

        card.addEventListener("mouseleave", () => {
            card.style.background = "#181528";
        });

        const cover = document.createElement("div");
        cover.className = "music-card-cover";

        Object.assign(cover.style, {
            width: "100%",
            aspectRatio: "1 / 1",
            borderRadius: "8px",
            overflow: "hidden",
            marginBottom: "10px"
        });

        const artwork = createArtwork(song);
        artwork.style.width = "100%";
        artwork.style.height = "100%";
        artwork.style.objectFit = "cover";

        cover.appendChild(artwork);

        const info = document.createElement("div");
        info.className = "music-card-info";

        const title = document.createElement("h3");
        title.textContent = song.title;

        Object.assign(title.style, {
            fontSize: "14px",
            fontWeight: "700",
            color: "#ffffff",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            marginBottom: "4px"
        });

        const artist = document.createElement("p");
        artist.textContent = song.artist;

        Object.assign(artist.style, {
            fontSize: "12px",
            color: "#a29fb4",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
        });

        info.append(title, artist);

        const actions = document.createElement("div");
        actions.className = "music-card-actions";

        Object.assign(actions.style, {
            display: "flex",
            gap: "6px",
            marginTop: "8px"
        });

        const play = document.createElement("button");
        play.className = "play-song-btn";
        play.textContent = isCurrentPlaying ? "⏸" : "▶";

        Object.assign(play.style, {
            flex: "1",
            padding: "6px",
            background: "#6c4df6",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer"
        });

        play.addEventListener("click", (event) => {
            event.stopPropagation();
            playSong(song);
        });

        const save = document.createElement("button");
        save.className = "card-favorite-btn";
        save.textContent = isFavorite(song) ? "♥" : "♡";

        Object.assign(save.style, {
            padding: "6px 10px",
            background: "transparent",
            color: isFavorite(song) ? "#ff4d4d" : "#a29fb4",
            border: "1px solid #363252",
            borderRadius: "6px",
            cursor: "pointer"
        });

        save.addEventListener("click", (event) => {
            event.stopPropagation();
            toggleFavorite(song);
        });

        actions.append(play, save);
        card.append(cover, info, actions);

        card.addEventListener("click", () => playSong(song));

        musicGrid.appendChild(card);
    });
}

// ==========================================
// PLAYBACK ENGINE
// ==========================================

function playSong(song) {
    if (!song) return;

    currentSong = song;

    const index = searchResults.findIndex(
        (item) => songKey(item) === songKey(song)
    );

    if (index > -1) {
        searchResults.splice(index, 1);
    }

    searchResults.unshift(song);
    currentIndex = 0;

    if (currentCover) currentCover.src = song.thumbnail;
    if (currentTitle) currentTitle.textContent = song.title;
    if (currentArtist) currentArtist.textContent = song.artist;

    updateFavoriteButton();
    renderResults(searchResults);

    if (
        player &&
        song.videoId &&
        typeof player.loadVideoById === "function"
    ) {
        player.loadVideoById(song.videoId);

        if (volume) {
            player.setVolume(Number(volume.value) * 100);
        }

        setStatus(`Now playing: ${song.title}`);
    } else {
        initYouTubePlayer();
        setStatus("Starting playback, please wait...");

        setTimeout(() => {
            if (
                player &&
                song.videoId &&
                typeof player.loadVideoById === "function"
            ) {
                player.loadVideoById(song.videoId);

                if (volume) {
                    player.setVolume(Number(volume.value) * 100);
                }

                setStatus(`Now playing: ${song.title}`);
            } else {
                setStatus(
                    "The YouTube player is not ready. Please try again.",
                    true
                );
            }
        }, 1200);
    }
}

function togglePlayback() {
    if (!currentSong) {
        if (searchResults.length) {
            playSong(searchResults[0]);
        } else {
            setStatus("Please select a song first.");
        }

        return;
    }

    if (
        player &&
        typeof player.getPlayerState === "function" &&
        window.YT
    ) {
        const state = player.getPlayerState();

        if (state === YT.PlayerState.PLAYING) {
            player.pauseVideo();
        } else {
            player.playVideo();
        }
    } else {
        playSong(currentSong);
    }
}

function playAdjacentSong(direction) {
    if (!searchResults.length) return;

    const index =
        currentIndex < 0
            ? (direction > 0 ? 0 : searchResults.length - 1)
            : (
                currentIndex +
                direction +
                searchResults.length
            ) % searchResults.length;

    playSong(searchResults[index]);
}

// ==========================================
// EVENT LISTENERS
// ==========================================

if (playButton) {
    playButton.addEventListener("click", togglePlayback);
}

if (previousButton) {
    previousButton.addEventListener("click", () => {
        playAdjacentSong(-1);
    });
}

if (nextButton) {
    nextButton.addEventListener("click", () => {
        playAdjacentSong(1);
    });
}

if (favoriteButton) {
    favoriteButton.addEventListener("click", () => {
        if (currentSong) toggleFavorite(currentSong);
    });
}

if (searchForm) {
    searchForm.addEventListener("submit", (event) => {
        event.preventDefault();
        searchSongs(searchInput?.value || "");
    });
}

// ==========================================
// LIBRARY
// ==========================================

function renderLibrary() {
    if (!songList) return;

    songList.replaceChildren();

    if (songCount) {
        songCount.textContent = String(favorites.length);
    }

    setHidden(noResults, favorites.length > 0);

    favorites.forEach((song) => {
        const row = document.createElement("div");
        row.className = "song-row library-song";

        const image = createArtwork(song);
        image.className = "library-song-cover";

        Object.assign(image.style, {
            width: "40px",
            height: "40px",
            borderRadius: "6px",
            objectFit: "cover"
        });

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
        row.append(image, details, actions);
        songList.appendChild(row);
    });
}

// ==========================================
// INITIALIZE SOUNDWAVE
// ==========================================

window.addEventListener("DOMContentLoaded", () => {
    createAutocompleteBox();
    renderLibrary();
    updateFavoriteButton();

    if (searchResults.length === 0 && musicGrid) {
        searchResults = defaultFeaturedSongs.slice();

        renderResults(searchResults);

        if (resultsHeading) {
            resultsHeading.textContent = "Featured Songs";
        }

        if (resultsCaption) {
            resultsCaption.textContent =
                "Choose a song to play or search for your favorite tracks";
        }
    }

    initYouTubePlayer();
});