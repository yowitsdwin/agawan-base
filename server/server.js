const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const Player = require('./Player');
const setupSocketEvents = require('./events/socketEvents');

const app = express();
const server = http.createServer(app);

const allowedOrigins = process.env.NODE_ENV === 'production'
  ? ["https://yowitsdwin.github.io"] // Production frontend URL
  : ["http://localhost:3000", "http://127.0.0.1:5500", "http://localhost:5500"]; // Local dev URLs

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json());

// Serve shared constants file to the client
app.get('/shared/constants.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, '../shared/constants.js'));
});

// Health check endpoint for deployment services
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// For local development, serve client files
if (process.env.NODE_ENV !== 'production') {
    app.use(express.static(path.join(__dirname, '../client')));
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../client/index.html'));
    });
}

const rooms = new Map();

setupSocketEvents(io, rooms, Player);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 Agawan Base Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

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