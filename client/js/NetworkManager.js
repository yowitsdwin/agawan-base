// ================================================================
// SERVER URL CONFIGURATION
// This is the only place you need to change the server address.
// ================================================================
const LIVE_BACKEND_URL = "https://agawan-base-server.onrender.com";
// ================================================================

class NetworkManager {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.callbacks = new Map();
  }

  connect() {
    // This logic automatically switches between your live URL and a local one for testing.
    const serverUrl = window.location.hostname.includes("github.io")
      ? LIVE_BACKEND_URL
      : `http://${window.location.hostname}:3000`;

    return new Promise((resolve, reject) => {
      // --- CRITICAL FIX ---
      // Tell the client to connect using only the WebSocket protocol.
      // This solves connection issues on platforms like Render.
      this.socket = io(serverUrl, {
        withCredentials: true,
        transports: ['websocket'] 
      });

      this.socket.on('connect', () => {
        console.log('Successfully connected to server via WebSocket:', serverUrl);
        this.isConnected = true;
        resolve();
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from server');
        if (window.uiManager) {
          alert('You have been disconnected from the server.');
          window.location.reload();
        }
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        reject(error);
      });

      this.setupEventHandlers();
    });
  }

  // Sets up listeners for all events coming from the server.
  setupEventHandlers() {
    const events = [
      'gameStarted', 'gameOver', 'playerTagged', 'playerRescued',
      'scoreUpdate', 'powerupSpawned', 'powerupCollected',
      'playerStateChanged', 'chatMessage', 'serverError'
    ];
    
    events.forEach(event => {
      this.socket.on(event, (data) => {
        this.trigger(event, data);
      });
    });

    // This is the main event for continuous state synchronization.
    this.socket.on('roomStateUpdate', (data) => {
      this.trigger('roomStateUpdate', data);
    });
  }

  // Register a callback for a specific event (e.g., UIManager listens for 'roomStateUpdate').
  on(event, callback) {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    this.callbacks.get(event).push(callback);
  }

  // Trigger all registered callbacks for an event.
  trigger(event, data) {
    if (this.callbacks.has(event)) {
      this.callbacks.get(event).forEach(callback => callback(data));
    }
  }

  // --- Methods to Send Events TO the Server ---

  emit(event, data) {
    if (this.socket && this.isConnected) {
      this.socket.emit(event, data);
    } else {
      console.error(`Socket not connected. Cannot emit event '${event}'`);
    }
  }

  joinGame(username) { this.emit('joinGame', { username }); }
  changeTeam() { this.emit('changeTeam'); }
  playerReady() { this.emit('playerReady'); }
  updatePosition(x, y) { this.emit('updatePosition', { x, y }); }
  sendChatMessage(message, type) { this.emit('chatMessage', { message, type }); }
  rescuePlayer(targetId) { this.emit('rescuePlayer', { targetId }); }
  collectPowerup(powerupId) { this.emit('collectPowerup', { powerupId }); }
}

