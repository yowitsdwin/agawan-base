// --- Module Imports ---
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const Player = require('./Player');
const setupSocketEvents = require('./events/socketEvents');

// --- Server and App Initialization ---
const app = express();
const server = http.createServer(app);

// --- CORS (Cross-Origin Resource Sharing) Configuration ---
// This is a CRITICAL security feature. It tells your server to only accept
// connections from approved websites.
const allowedOrigins = process.env.NODE_ENV === 'production'
  // When your game is live, only allow connections from your GitHub Pages URL.
  // Make sure this matches your actual GitHub Pages URL.
  ? ["https://yowitsdwin.github.io"]
  // When you are testing locally, allow connections from local development servers.
  : ["http://localhost:3000", "http://127.0.0.1:5500", "http://localhost:5500"];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// --- Express Middleware ---
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

// --- Static File Serving ---
// This route allows the client to fetch the shared constants file.
app.get('/shared/constants.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, '../shared/constants.js'));
});

// Health check endpoint for deployment services like Render to verify the server is running.
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// For local development, this serves the client's index.html file.
// In production, this part is not used as the frontend is on GitHub Pages.
if (process.env.NODE_ENV !== 'production') {
    app.use(express.static(path.join(__dirname, '../docs')));
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../docs/index.html'));
    });
}

// --- Game State Management ---
// A global map to hold all active game rooms. For this game, we only have one.
const rooms = new Map();

// --- Socket.IO Event Handling ---
// This function initializes all the real-time event listeners for the game.
setupSocketEvents(io, rooms, Player);

// --- Server Startup ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 Agawan Base Server running on port ${PORT}`);
  console.log(`   - Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   - Allowing connections from: ${allowedOrigins.join(', ')}`);
});

// --- Graceful Shutdown Handling ---
// Ensures that when the server is stopped (e.g., during a redeploy),
// it cleans up resources properly.
const gracefulShutdown = () => {
  console.log('🛑 Shutting down gracefully...');
  rooms.forEach(room => room.cleanup());
  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

