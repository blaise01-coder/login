const express = require("express");
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
const session = require("express-session");
const path = require("path");
const dotenv = require("dotenv");
const ytSearch = require("yt-search");

// Load environment variables from backend/.env
dotenv.config({
    path: path.join(__dirname, ".env")
});

const app = express();
const PORT = process.env.PORT || 3000;
const websiteFolder = path.join(__dirname, "..");

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Login session
app.use(
    session({
        secret:
            process.env.SESSION_SECRET ||
            "soundwave-local-development-secret",
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: false,
            maxAge: 2 * 60 * 60 * 1000
        }
    })
);

// MySQL connection
const db = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "soundwave_db",
    waitForConnections: true,
    connectionLimit: 10
});

// Serve existing website files
app.use(express.static(websiteFolder));

app.get("/", (req, res) => {
    res.sendFile(path.join(websiteFolder, "index.html"));
});

// Test database connection
app.get("/api/db-test", async (req, res) => {
    try {
        await db.query("SELECT 1");

        return res.json({
            success: true,
            message: "Database connected successfully!"
        });
    } catch (error) {
        console.error("Database test error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Database connection failed."
        });
    }
});

// REGISTER
app.post("/api/register", async (req, res) => {
    try {
        const { fullName, email, password } = req.body || {};

        if (
            typeof fullName !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string" ||
            !fullName.trim() ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Please fill in all required fields."
            });
        }

        const cleanName = fullName.trim();
        const cleanEmail = email.trim().toLowerCase();

        if (cleanName.length > 100 || cleanEmail.length > 255) {
            return res.status(400).json({
                success: false,
                message: "Name or email is too long."
            });
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailPattern.test(cleanEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 8 characters."
            });
        }

        const [existing] = await db.execute(
            "SELECT id FROM users WHERE email = ? LIMIT 1",
            [cleanEmail]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: "This email already exists. Please log in."
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        await db.execute(
            "INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)",
            [cleanName, cleanEmail, passwordHash]
        );

        return res.status(201).json({
            success: true,
            message: "Account created successfully!",
            redirect: "/login.html"
        });
    } catch (error) {
        console.error("Registration error:", error.message);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "This email already exists. Please log in."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Registration failed. Please try again."
        });
    }
});

// LOGIN
app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body || {};

        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Please enter your email and password."
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        const [users] = await db.execute(
            "SELECT id, full_name, email, password_hash FROM users WHERE email = ? LIMIT 1",
            [cleanEmail]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Incorrect email or password."
            });
        }

        const user = users[0];

        const passwordMatches = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                success: false,
                message: "Incorrect email or password."
            });
        }

        req.session.regenerate((error) => {
            if (error) {
                console.error("Session error:", error.message);

                return res.status(500).json({
                    success: false,
                    message: "Could not start your login session."
                });
            }

            req.session.user = {
                id: user.id,
                fullName: user.full_name,
                email: user.email
            };

            req.session.save((saveError) => {
                if (saveError) {
                    console.error("Session save error:", saveError.message);

                    return res.status(500).json({
                        success: false,
                        message: "Could not save your login session."
                    });
                }

                return res.json({
                    success: true,
                    message: "Login successful!",
                    user: req.session.user,
                    redirect: "/index.html"
                });
            });
        });
    } catch (error) {
        console.error("Login error:", error.message);

        return res.status(500).json({
            success: false,
            message: "A server error occurred during login."
        });
    }
});

// Get current logged-in user
app.get("/api/me", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({
            success: false,
            message: "Please log in first."
        });
    }

    return res.json({
        success: true,
        user: req.session.user
    });
});

// LOGOUT
app.post("/api/logout", (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            console.error("Logout error:", error.message);

            return res.status(500).json({
                success: false,
                message: "Could not log out."
            });
        }

        res.clearCookie("connect.sid");

        return res.json({
            success: true,
            message: "Logged out successfully."
        });
    });
});

// ==========================================
// YOUTUBE MUSIC SEARCH API (Metadata & Artwork)
// ==========================================

app.get("/api/youtube/search", async (req, res) => {
    try {
        const query = typeof req.query.q === "string" ? req.query.q.trim() : "";

        if (!query) {
            return res.status(400).json({
                success: false,
                message: "Please enter a song or artist name."
            });
        }

        const searchResult = await ytSearch(query + " music");
        const videos = (searchResult.videos || []).slice(0, 12);

        const results = videos.map((item) => ({
            videoId: item.videoId,
            title: item.title,
            artist: item.author.name,
            thumbnail: item.thumbnail || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`,
            url: item.url
        }));

        return res.json({
            success: true,
            query,
            results
        });
    } catch (error) {
        console.error("YouTube search error:", error.message);

        return res.status(500).json({
            success: false,
            message: "An error occurred while searching YouTube."
        });
    }
});

// Unknown API endpoint
app.use("/api", (req, res) => {
    return res.status(404).json({
        success: false,
        message: "API endpoint not found."
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`SoundWave server running at http://localhost:${PORT}`);
});