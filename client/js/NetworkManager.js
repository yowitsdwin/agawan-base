// client/js/NetworkManager.js
// Enhanced network manager with lobby system support

const LIVE_BACKEND_URL = "https://agawan-base-server.onrender.com";

class NetworkManager {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.callbacks = new Map();
    this.connectionPromise = null;
    this.currentLobbyId = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  async checkServerAvailability() {
    const serverUrl = window.location.hostname.includes("github.io")
      ? LIVE_BACKEND_URL
      : `http://${window.location.hostname}:3000`;

    try {
      const response = await fetch(`${serverUrl}/api/server-status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        return { available: true, stats: data.stats };
      }
      return { available: false };
    } catch (error) {
      console.error('[Server Check] Failed:', error);
      return { available: false };
    }
  }

  connect() {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    const serverUrl = window.location.hostname.includes("github.io")
      ? LIVE_BACKEND_URL
      : `http://${window.location.hostname}:3000`;

    console.log(`[Socket] Connecting to: ${serverUrl}`);

    this.connectionPromise = new Promise((resolve, reject) => {
      this.socket = io(serverUrl, {
        withCredentials: true,
        transports: ['websocket'],
        timeout: 10000,
        forceNew: true
      });

      this.socket.on('connect', () => {
        console.log(`[Socket] Connected. ID: ${this.socket.id}`);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        resolve();
      });

      this.socket.on('disconnect', (reason) => {
        console.warn(`[Socket] Disconnected. Reason: ${reason}`);
        this.isConnected = false;
        this.connectionPromise = null;
        
        // The server has disconnected us. Show the error and stop the game.
        this.handleDisconnect(reason);
      });

      this.socket.on('connect_error', (error) => {
        console.error(`[Socket] Connection failed:`, error.message);
        this.connectionPromise = null;
        this.reconnectAttempts++;
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          reject(new Error('Failed to connect after multiple attempts'));
        } else {
          reject(error);
        }
      });

      this.setupEventHandlers();
    });

    return this.connectionPromise;
  }

  setupEventHandlers() {
    const events = [
      'lobbyCreated', 'lobbyJoined', 'lobbySettingsChanged',
      'hostChanged', 'playerJoined', 'playerLeft',
      'gameStarted', 'gameOver', 'playerTagged', 'playerRescued',
      'scoreUpdate', 'powerupSpawned', 'powerupCollected',
      'playerStateChanged', 'chatMessage', 'serverError',
      'roomStateUpdate'
    ];
    
    events.forEach(event => {
      this.socket.on(event, (data) => {
        this.trigger(event, data);
      });
    });
  }

  on(event, callback) {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    this.callbacks.get(event).push(callback);
  }

  trigger(event, data) {
    if (this.callbacks.has(event)) {
      this.callbacks.get(event).forEach(callback => callback(data));
    }
  }

  emit(event, data) {
    if (this.socket && this.isConnected) {
      this.socket.emit(event, data);
    } else {
      console.error(`[Socket] Not connected. Cannot emit '${event}'`);
    }
  }

  async ensureConnected() {
    if (!this.isConnected) {
      if (this.connectionPromise) {
        await this.connectionPromise;
      } else {
        await this.connect();
      }
    }
  }

  // ==================== LOBBY METHODS ====================

  async createLobby(username, settings) {
    await this.ensureConnected();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Create lobby timeout'));
      }, 5000);

      this.socket.once('lobbyCreated', (data) => {
        clearTimeout(timeout);
        this.currentLobbyId = data.lobbyId;
        resolve(data);
      });

      this.socket.once('serverError', (error) => {
        clearTimeout(timeout);
        reject(new Error(error.message));
      });

      this.emit('createLobby', { username, settings });
    });
  }

  async joinLobby(username, lobbyId) {
    await this.ensureConnected();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Join lobby timeout'));
      }, 5000);

      this.socket.once('lobbyJoined', (data) => {
        clearTimeout(timeout);
        this.currentLobbyId = data.lobbyId;
        resolve(data);
      });

      this.socket.once('serverError', (error) => {
        clearTimeout(timeout);
        reject(new Error(error.message));
      });

      this.emit('joinLobby', { username, lobbyId });
    });
  }

  updateLobbySettings(settings) {
    this.emit('updateLobbySettings', { settings });
  }

  async changeTeam() {
    await this.ensureConnected();
    this.emit('changeTeam');
  }

  async playerReady() {
    await this.ensureConnected();
    this.emit('playerReady');
  }

  // ==================== GAME METHODS ====================

  updatePosition(x, y) {
    this.emit('updatePosition', { x, y });
  }

  sendChatMessage(message, type) {
    this.emit('chatMessage', { message, type });
  }

  rescuePlayer(targetId) {
    this.emit('rescuePlayer', { targetId });
  }

  collectPowerup(powerupId, powerupType) {
    this.emit('collectPowerup', { powerupId, powerupType });
  }

  // ==================== UTILITY METHODS ====================

  handleDisconnect(reason) {
    // Pause the game to stop the console spam and player movement
    if (window.game && window.game.scene.isActive('GameScene')) {
      window.game.scene.pause('GameScene');
    }

    if (window.uiManager) {
      // Provide a more user-friendly message
      const message = `Lost connection to the server. Reason: ${reason}. The page will reload.`;
      window.uiManager.showError(
        message,
        'Connection Lost',
        () => window.location.reload()
      );
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.isConnected = false;
      this.connectionPromise = null;
      this.currentLobbyId = null;
    }
  }

  getLobbyId() {
    return this.currentLobbyId;
  }
}