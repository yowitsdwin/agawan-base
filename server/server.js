const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const Player = require('./Player');
const setupSocketEvents = require('./events/socketEvents');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

// Serve shared constants to client
app.get('/shared/constants.js', (req, res) => {
  res.sendFile(path.join(__dirname, '../shared/constants.js'));
});

// Game state
const rooms = new Map();

// Setup socket events
setupSocketEvents(io, rooms, Player);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    rooms: rooms.size,
    timestamp: new Date().toISOString() 
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🎮 Agawan Base Server running on port ${PORT}`);
  console.log(`📱 Open http://localhost:${PORT} to play!`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  rooms.forEach(room => room.cleanup());
  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
});