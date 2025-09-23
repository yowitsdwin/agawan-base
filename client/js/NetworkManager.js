// ================================================================
// SERVER URL CONFIGURATION
// To point the game to a new server, change this URL.
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
    const serverUrl = window.location.hostname.includes("github.io")
      ? LIVE_BACKEND_URL
      : `http://${window.location.hostname}:3000`;

    return new Promise((resolve, reject) => {
      this.socket = io(serverUrl, { withCredentials: true });

      this.socket.on('connect', () => {
        console.log('Connected to server:', serverUrl);
        this.isConnected = true;
        resolve();
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from server');
        this.isConnected = false;
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

    // This is the main event for continuous state synchronization
    this.socket.on('roomStateUpdate', (data) => {
      this.trigger('roomStateUpdate', data);
    });
  }

  // Register a callback for a specific event
  on(event, callback) {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    this.callbacks.get(event).push(callback);
  }

  // Trigger all registered callbacks for an event
  trigger(event, data) {
    if (this.callbacks.has(event)) {
      this.callbacks.get(event).forEach(callback => callback(data));
    }
  }

  // Emit an event to the server
  emit(event, data) {
    if (this.socket && this.isConnected) {
      this.socket.emit(event, data);
    } else {
      console.error(`Socket not connected. Cannot emit event '${event}'`);
    }
  }

  // --- Player Actions ---

  joinGame(username) {
    this.emit('joinGame', { username });
  }

  updatePosition(x, y) {
    this.emit('updatePosition', { x, y });
  }

  sendChatMessage(message, type) {
    this.emit('chatMessage', { message, type });
  }

  rescuePlayer(targetId) {
    this.emit('rescuePlayer', { targetId });
  }

  collectPowerup(powerupId) {
    this.emit('collectPowerup', { powerupId });
  }

  // --- New Lobby Actions ---

  changeTeam() {
    this.emit('changeTeam');
  }

  playerReady() {
    this.emit('playerReady');
  }
}

