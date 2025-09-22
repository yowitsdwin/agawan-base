const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const Player = require('./Player');
const setupSocketEvents = require('./events/socketEvents');

const app = express();
const server = http.createServer(app);

// ===== Allowed origins for CORS =====
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? ["https://yowitsdwin.github.io/agawan-base/"]  // GitHub Pages URL
  : ["http://localhost:3000", "http://127.0.0.1:5500"]; // local dev

// ===== Socket.IO setup =====
const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// ===== Express CORS middleware =====
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json());

// ===== Serve frontend static files =====
// If using GitHub Pages, frontend will be hosted separately, 
// so this mainly helps for local dev
app.use(express.static(path.join(__dirname, '../client')));

// Serve shared constants (required by frontend JS)
app.get('/shared/constants.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, '../shared/constants.js'));
});

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Fallback to index.html for SPA routing (only needed locally)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// ===== Game state =====
const rooms = new Map();

// ===== Setup socket events =====
setupSocketEvents(io, rooms, Player);

// ===== Start server =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 Agawan Base Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// ===== Graceful shutdown =====
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
