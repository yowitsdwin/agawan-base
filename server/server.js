// --- Module Imports ---
const express = require('express');

const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const Player = require('./Player');
const setupSocketEvents = require('./events/socketEvents');

// --- Server and App Initialization ---
const app = express();
const server = http.createServer(app);

// --- CORS Configuration ---
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? ["https://yowitsdwin.github.io"]
  : ["http://localhost:3000", "http://127.0.0.1:5500", "http://localhost:5500"];

const io = new Server(server, {
  // --- THIS IS THE FIX ---
  // Force the server to only use the WebSocket protocol.
  // This is the most reliable method for platforms like Render.
  transports: ['websocket'],
  
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// --- Express Middleware & Routes ---
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

app.get('/shared/constants.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, '../shared/constants.js'));
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

if (process.env.NODE_ENV !== 'production') {
    app.use(express.static(path.join(__dirname, '../client')));
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../client/index.html'));
    });
}

// --- Game State & Event Handling ---
const rooms = new Map();
setupSocketEvents(io, rooms, Player);

// --- Server Startup ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 Agawan Base Server running on port ${PORT}`);
  console.log(`   - Environment: ${process.env.NODE_ENV || 'development'}`);
});

// --- Graceful Shutdown ---
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

