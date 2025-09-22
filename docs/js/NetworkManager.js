class NetworkManager {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.callbacks = new Map();
  }

  connect() {
    // Dynamic backend URL
    const serverUrl = window.location.hostname.includes("github.io")
      ? "https://agawan-base.onrender.com" // Render backend
      : "http://localhost:3000";           // Local backend

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
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        reject(error);
      });

      // Setup all game event handlers
      this.setupEventHandlers();
    });
  }

  setupEventHandlers() {
    const events = [
      'playerJoined',
      'playerLeft', 
      'playerMoved',
      'playerTagged',
      'playerRescued',
      'scoreUpdate',
      'gameStarted',
      'gameOver',
      'chatMessage',
      'powerupSpawned',
      'powerupCollected'
    ];
    
    events.forEach(event => {
      this.socket.on(event, (data) => {
        if (this.callbacks.has(event)) {
          this.callbacks.get(event).forEach(callback => callback(data));
        }
      });
    });
  }

  on(event, callback) {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    this.callbacks.get(event).push(callback);
  }

  emit(event, data) {
    if (this.socket && this.isConnected) {
      this.socket.emit(event, data);
    }
  }

  joinGame(username, roomId) {
    this.emit('joinGame', { username, roomId });
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
}
