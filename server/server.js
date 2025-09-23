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
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? ["https://yowitsdwin.github.io"]
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
app.get('/shared/constants.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, '../shared/constants.js'));
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// --- THIS BLOCK IS CORRECTED ---
// For local development, this serves the client's index.html file from the /client folder.
if (process.env.NODE_ENV !== 'production') {
    app.use(express.static(path.join(__dirname, '../client'))); // <-- Corrected to /client
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../client/index.html')); // <-- Corrected to /client
    });
}

// --- Game State Management ---
const rooms = new Map();

// --- Socket.IO Event Handling ---
setupSocketEvents(io, rooms, Player);

// --- Server Startup ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 Agawan Base Server running on port ${PORT}`);
  console.log(`   - Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   - Allowing connections from: ${allowedOrigins.join(', ')}`);
});

// --- Graceful Shutdown Handling ---
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

