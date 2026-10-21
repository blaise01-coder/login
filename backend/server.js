
"use strict";

const express = require("express");
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
const session = require("express-session");
const path = require("path");
const dotenv = require("dotenv");
const ytSearch = require("yt-search");

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const websiteFolder = path.join(__dirname, "..");
const isProduction = process.env.NODE_ENV === "production";

// --------------------------------------------------
// 1. SECURITY AND GENERAL CONFIGURATION
// --------------------------------------------------

if (isProduction) {
  app.set("trust proxy", 1);
}

const sessionSecret =
  process.env.SESSION_SECRET ||
  (isProduction ? "" : "soundwave-local-development-secret");

if (!sessionSecret) {
  throw new Error("SESSION_SECRET must be configured in production.");
}

if (
  isProduction &&
  (!process.env.DB_HOST ||
    !process.env.DB_USER ||
    !process.env.DB_PASSWORD ||
    !process.env.DB_NAME)
) {
  throw new Error(
    "Configure DB_HOST, DB_USER, DB_PASSWORD and DB_NAME."
  );
}

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use(
  session({
    name: "soundwave.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: 2 * 60 * 60 * 1000
    }
  })
);

// --------------------------------------------------
// 2. AIVEN / MYSQL DATABASE CONNECTION
// --------------------------------------------------

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "soundwave_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

if (isProduction || process.env.DB_SSL === "true") {
  dbConfig.ssl = {
    rejectUnauthorized: true,
    ...(process.env.DB_SSL_CA
      ? {
          ca: process.env.DB_SSL_CA.replace(/\\n/g, "\n")
        }
      : {})
  };
}

const db = mysql.createPool(dbConfig);

// --------------------------------------------------
// 3. CREATE REQUIRED TABLES
// --------------------------------------------------

async function initializeDatabase() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      full_name VARCHAR(120) NOT NULL,
      email VARCHAR(190) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id INT UNSIGNED NOT NULL,
      preferences JSON NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id),
      CONSTRAINT fk_soundwave_preferences_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);

  console.log("SoundWave database tables are ready.");
}

// --------------------------------------------------
// 4. SERVE YOUR EXISTING WEBSITE FILES
// --------------------------------------------------

app.use(express.static(websiteFolder));

app.get("/", (req, res) => {
  res.sendFile(path.join(websiteFolder, "index.html"));
});

// --------------------------------------------------
// 5. HELPER FUNCTIONS
// --------------------------------------------------

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      message: "Please log in to continue."
    });
  }

  next();
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

// --------------------------------------------------
// 6. TEST DATABASE CONNECTION
// --------------------------------------------------

app.get("/api/db-test", async (req, res) => {
  try {
    await db.query("SELECT 1");

    res.json({
      success: true,
      message: "SoundWave database connected successfully."
    });
  } catch (error) {
    console.error("Database test error:", error.message);

    res.status(503).json({
      success: false,
      message: "Database connection failed. Check your database settings."
    });
  }
});

// --------------------------------------------------
// 7. REGISTER NEW USERS
// Supports /api/register and /register
// --------------------------------------------------

async function registerUser(req, res) {
  try {
    const fullName = cleanText(
      req.body.fullName || req.body.full_name || req.body.name
    );

    const email = normalizeEmail(req.body.email);

    const password =
      typeof req.body.password === "string"
        ? req.body.password
        : "";

    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please complete all required fields."
      });
    }

    if (fullName.length > 120) {
      return res.status(400).json({
        success: false,
        message: "Your name is too long."
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address."
      });
    }

    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({
        success: false,
        message: "Password must contain 8–72 characters."
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [result] = await db.execute(
      `INSERT INTO users (full_name, email, password_hash)
       VALUES (?, ?, ?)`,
      [fullName, email, passwordHash]
    );

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      user: {
        id: result.insertId,
        fullName,
        email
      },
      redirect: "/login.html"
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists."
      });
    }

    console.error("Registration error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Registration failed. Please try again."
    });
  }
}

app.post("/api/register", registerUser);
app.post("/register", registerUser);

// --------------------------------------------------
// 8. LOG IN
// Successful login redirects to dashboard.html
// --------------------------------------------------

async function loginUser(req, res) {
  try {
    const email = normalizeEmail(req.body.email);

    const password =
      typeof req.body.password === "string"
        ? req.body.password
        : "";

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Enter your email and password."
      });
    }

    const [users] = await db.execute(
      `SELECT id, full_name, email, password_hash
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
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
        message: "Invalid email or password."
      });
    }

    // Regenerate session after successful authentication.
    req.session.regenerate((sessionError) => {
      if (sessionError) {
        console.error("Session error:", sessionError.message);

        return res.status(500).json({
          success: false,
          message: "Could not start your session."
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
            message: "Could not save your session."
          });
        }

        return res.json({
          success: true,
          message: "Login successful.",
          user: req.session.user,
          redirect: "/dashboard.html"
        });
      });
    });
  } catch (error) {
    console.error("Login error:", error.message);

    res.status(500).json({
      success: false,
      message: "Login failed. Please try again."
    });
  }
}

app.post("/api/login", loginUser);
app.post("/login", loginUser);

// --------------------------------------------------
// 9. CHECK THE CURRENT USER
// --------------------------------------------------

app.get("/api/me", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      authenticated: false,
      message: "You are not logged in."
    });
  }

  res.json({
    success: true,
    authenticated: true,
    user: req.session.user
  });
});

// --------------------------------------------------
// 10. LOG OUT
// --------------------------------------------------

app.post("/api/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error("Logout error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Could not log out."
      });
    }

    res.clearCookie("soundwave.sid", {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction
    });

    res.json({
      success: true,
      message: "Logged out successfully.",
      redirect: "/index.html"
    });
  });
});

// --------------------------------------------------
// 11. SAVE USER PERSONALIZATION PREFERENCES
// Location must only be provided after user consent.
// --------------------------------------------------

app.get("/api/preferences", requireLogin, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT preferences
       FROM user_preferences
       WHERE user_id = ?
       LIMIT 1`,
      [req.session.user.id]
    );

    if (rows.length === 0) {
      return res.json({
        success: true,
        preferences: {}
      });
    }

    let preferences = rows[0].preferences;

    if (typeof preferences === "string") {
      preferences = JSON.parse(preferences);
    }

    res.json({
      success: true,
      preferences
    });
  } catch (error) {
    console.error("Get preferences error:", error.message);

    res.status(500).json({
      success: false,
      message: "Could not load your preferences."
    });
  }
});

app.put("/api/preferences", requireLogin, async (req, res) => {
  try {
    const preferences = req.body.preferences;

    if (
      !preferences ||
      typeof preferences !== "object" ||
      Array.isArray(preferences)
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid preferences object is required."
      });
    }

    // Limit the stored preferences payload.
    const serialized = JSON.stringify(preferences);

    if (serialized.length > 10000) {
      return res.status(413).json({
        success: false,
        message: "Your preferences are too large."
      });
    }

    await db.execute(
      `INSERT INTO user_preferences (user_id, preferences)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE preferences = VALUES(preferences)`,
      [req.session.user.id, serialized]
    );

    res.json({
      success: true,
      message: "Preferences saved successfully.",
      preferences
    });
  } catch (error) {
    console.error("Save preferences error:", error.message);

    res.status(500).json({
      success: false,
      message: "Could not save your preferences."
    });
  }
});

// --------------------------------------------------
// 12. SEARCH YOUTUBE MUSIC
// --------------------------------------------------

app.get("/api/youtube/search", async (req, res) => {
  try {
    const query = cleanText(req.query.q);

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Enter a song, artist, or music keyword."
      });
    }

    if (query.length > 150) {
      return res.status(400).json({
        success: false,
        message: "Your search query is too long."
      });
    }

    const results = await ytSearch(`${query} music`);

    const videos = (results.videos || []).slice(0, 12).map((video) => ({
      videoId: video.videoId,
      title: video.title || "Unknown title",
      artist: video.author?.name || "Unknown artist",
      thumbnail:
        video.thumbnail ||
        `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`,
      url: video.url || `https://www.youtube.com/watch?v=${video.videoId}`,
      duration: video.timestamp || "",
      views: video.views || 0
    }));

    res.json({
      success: true,
      query,
      results: videos
    });
  } catch (error) {
    console.error("YouTube search error:", error.message);

    res.status(502).json({
      success: false,
      message: "Music search is temporarily unavailable."
    });
  }
});

// --------------------------------------------------
// 13. TRENDING MUSIC DISCOVERY
// These are search results, not verified global charts.
// --------------------------------------------------

app.get("/api/youtube/trending", async (req, res) => {
  try {
    const query = cleanText(req.query.q) || "trending music 2026";

    const results = await ytSearch(query);

    const videos = (results.videos || []).slice(0, 12).map((video) => ({
      videoId: video.videoId,
      title: video.title || "Unknown title",
      artist: video.author?.name || "Unknown artist",
      thumbnail:
        video.thumbnail ||
        `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`,
      url: video.url || `https://www.youtube.com/watch?v=${video.videoId}`,
      duration: video.timestamp || "",
      views: video.views || 0
    }));

    res.json({
      success: true,
      query,
      results: videos
    });
  } catch (error) {
    console.error("Trending music error:", error.message);

    res.status(502).json({
      success: false,
      message: "Trending music is temporarily unavailable."
    });
  }
});

// --------------------------------------------------
// 14. HANDLE UNKNOWN API ROUTES
// --------------------------------------------------

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found."
  });
});

// --------------------------------------------------
// 15. START THE SERVER
// --------------------------------------------------

async function startServer() {
  try {
    await initializeDatabase();

    // Verify that the database is reachable before starting.
    await db.query("SELECT 1");

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`SoundWave server running on port ${PORT}`);

      if (!isProduction) {
        console.log(`Website: http://localhost:${PORT}`);
        console.log(`Dashboard: http://localhost:${PORT}/dashboard.html`);
        console.log(`Database test: http://localhost:${PORT}/api/db-test`);
      }
    });
  } catch (error) {
    console.error("Could not start SoundWave:", error.message);
    process.exit(1);
  }
}

startServer();

