// server/server.js
// Main server with lobby management and enhanced features

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const Player = require('./Player');
const LobbyManager = require('./LobbyManager');
const setupSocketEvents = require('./events/socketEvents');

const app = express();
const server = http.createServer(app);

const allowedOrigins = process.env.NODE_ENV === 'production'
  ? ["https://yowitsdwin.github.io", "https://agawan-base.web.app", "https://agawan-base.firebaseapp.com"]
  : ["http://localhost:3000", "http://127.0.0.1:5500", "http://localhost:5500", "http://192.168.1.21:3000", "http://192.168.100.43:3000"];

console.log("=================================");
console.log("🎮 AGAWAN BASE SERVER");
console.log("=================================");
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log("Allowed Origins:", allowedOrigins);
console.log("=================================");

const io = new Server(server, {
  transports: ['websocket'],
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.error(`[CORS] Blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

// Routes
app.get('/shared/constants.js', (req, res) => {
  res.setHeader('Content-type', 'application/javascript');
  res.sendFile(path.join(__dirname, '../shared/constants.js'));
});

app.get('/health', (req, res) => {
  const stats = lobbyManager.getStats();
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    ...stats
  });
});

app.get('/api/server-status', (req, res) => {
  res.json({ 
    available: true,
    version: '2.0.0',
    stats: lobbyManager.getStats()
  });
});

if (process.env.NODE_ENV !== 'production') {
  app.use(express.static(path.join(__dirname, '../client')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
  });
}

// Initialize lobby manager
const lobbyManager = new LobbyManager();

// Setup socket event handlers
setupSocketEvents(io, lobbyManager, Player);

// Server startup
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎮 Server running on port ${PORT}`);
  console.log(`📊 Ready to handle multiple lobbies\n`);
});

// Graceful shutdown
const gracefulShutdown = () => {
  console.log('\n🛑 Shutting down gracefully...');
  lobbyManager.cleanup();
  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('⚠️  Forcing shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Log server stats every 5 minutes
setInterval(() => {
  const stats = lobbyManager.getStats();
  console.log(`[Stats] Lobbies: ${stats.totalLobbies} | Playing: ${stats.playingGames} | Players: ${stats.totalPlayers}`);
}, 300000);
