// client/js/NetworkManager.js
// FIXED: Enhanced network manager with better error handling and reliability

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
    this.pingInterval = null;
    console.log('[NetworkManager] Initialized');
  }

  async checkServerAvailability() {
    const serverUrl = window.location.hostname.includes("github.io")
      ? LIVE_BACKEND_URL
      : `http://${window.location.hostname}:3000`;

    console.log(`[Server Check] Checking: ${serverUrl}`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${serverUrl}/api/server-status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        console.log('[Server Check] Server available:', data);
        return { available: true, stats: data.stats };
      }
      
      console.warn('[Server Check] Server returned non-OK status:', response.status);
      return { available: false };
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('[Server Check] Request timeout');
      } else {
        console.error('[Server Check] Failed:', error.message);
      }
      return { available: false };
    }
  }

  connect() {
    if (this.connectionPromise) {
      console.log('[Socket] Connection already in progress');
      return this.connectionPromise;
    }

    const serverUrl = window.location.hostname.includes("github.io")
      ? LIVE_BACKEND_URL
      : `http://${window.location.hostname}:3000`;

    console.log(`[Socket] Connecting to: ${serverUrl}`);

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        this.socket = io(serverUrl, {
          withCredentials: true,
          transports: ['websocket'],
          timeout: 10000,
          forceNew: true,
          reconnection: false // We handle reconnection manually
        });

        // Connection timeout
        const connectionTimeout = setTimeout(() => {
          if (!this.isConnected) {
            console.error('[Socket] Connection timeout');
            this.socket?.disconnect();
            this.connectionPromise = null;
            reject(new Error('Connection timeout'));
          }
        }, 10000);

        this.socket.on('connect', () => {
          clearTimeout(connectionTimeout);
          console.log(`[Socket] Connected. ID: ${this.socket.id}`);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startPingMonitoring();
          resolve();
        });

        this.socket.on('disconnect', (reason) => {
          console.warn(`[Socket] Disconnected. Reason: ${reason}`);
          this.isConnected = false;
          this.connectionPromise = null;
          this.stopPingMonitoring();
          this.handleDisconnect(reason);
        });

        this.socket.on('connect_error', (error) => {
          clearTimeout(connectionTimeout);
          console.error(`[Socket] Connection error:`, error.message);
          this.connectionPromise = null;
          this.reconnectAttempts++;
          
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            reject(new Error('Failed to connect after multiple attempts'));
          } else {
            reject(error);
          }
        });

        this.socket.on('error', (error) => {
          console.error('[Socket] Socket error:', error);
        });

        this.setupEventHandlers();
      } catch (error) {
        console.error('[Socket] Connection setup failed:', error);
        this.connectionPromise = null;
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  startPingMonitoring() {
    // Monitor connection health
    this.pingInterval = setInterval(() => {
      if (this.socket && this.isConnected) {
        const start = Date.now();
        this.socket.emit('ping', () => {
          const latency = Date.now() - start;
          if (latency > 1000) {
            console.warn(`[Socket] High latency detected: ${latency}ms`);
          }
        });
      }
    }, 30000); // Check every 30 seconds
  }

  stopPingMonitoring() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  setupEventHandlers() {
    if (!this.socket) {
      console.error('[Socket] Cannot setup handlers - socket not initialized');
      return;
    }

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
        console.log(`[Network] Received: ${event}`);
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
      this.callbacks.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[Network] Error in ${event} callback:`, error);
        }
      });
    }
  }

  emit(event, data) {
    if (!this.socket) {
      console.error(`[Socket] Socket not initialized. Cannot emit '${event}'`);
      return false;
    }

    if (!this.isConnected) {
      console.error(`[Socket] Not connected. Cannot emit '${event}'`);
      return false;
    }

    try {
      this.socket.emit(event, data);
      console.log(`[Network] Emitted: ${event}`);
      return true;
    } catch (error) {
      console.error(`[Socket] Error emitting '${event}':`, error);
      return false;
    }
  }

  async ensureConnected() {
    if (!this.isConnected) {
      console.log('[Socket] Not connected, attempting to connect...');
      if (this.connectionPromise) {
        await this.connectionPromise;
      } else {
        await this.connect();
      }
    }
  }

  // ==================== LOBBY METHODS ====================

  async createLobby(username, settings) {
    try {
      await this.ensureConnected();
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.error('[Lobby] Create timeout');
          reject(new Error('Create lobby request timed out'));
        }, 5000);

        const onCreated = (data) => {
          clearTimeout(timeout);
          this.socket.off('serverError', onError);
          this.currentLobbyId = data.lobbyId;
          console.log(`[Lobby] Created successfully: ${data.lobbyId}`);
          resolve(data);
        };

        const onError = (error) => {
          clearTimeout(timeout);
          this.socket.off('lobbyCreated', onCreated);
          console.error('[Lobby] Create error:', error);
          reject(new Error(error.message || 'Failed to create lobby'));
        };

        this.socket.once('lobbyCreated', onCreated);
        this.socket.once('serverError', onError);

        this.emit('createLobby', { username, settings });
      });
    } catch (error) {
      console.error('[Lobby] Create failed:', error);
      throw error;
    }
  }

  async joinLobby(username, lobbyId) {
    try {
      await this.ensureConnected();
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.error('[Lobby] Join timeout');
          reject(new Error('Join lobby request timed out'));
        }, 5000);

        const onJoined = (data) => {
          clearTimeout(timeout);
          this.socket.off('serverError', onError);
          this.currentLobbyId = data.lobbyId;
          console.log(`[Lobby] Joined successfully: ${data.lobbyId}`);
          resolve(data);
        };

        const onError = (error) => {
          clearTimeout(timeout);
          this.socket.off('lobbyJoined', onJoined);
          console.error('[Lobby] Join error:', error);
          reject(new Error(error.message || 'Failed to join lobby'));
        };

        this.socket.once('lobbyJoined', onJoined);
        this.socket.once('serverError', onError);

        this.emit('joinLobby', { username, lobbyId });
      });
    } catch (error) {
      console.error('[Lobby] Join failed:', error);
      throw error;
    }
  }

  updateLobbySettings(settings) {
    console.log('[Lobby] Updating settings:', settings);
    return this.emit('updateLobbySettings', { settings });
  }

  async changeTeam() {
    await this.ensureConnected();
    console.log('[Lobby] Changing team');
    return this.emit('changeTeam');
  }

  async playerReady() {
    await this.ensureConnected();
    console.log('[Lobby] Toggling ready status');
    return this.emit('playerReady');
  }

  // ==================== GAME METHODS ====================

  updatePosition(x, y, direction) {
    // Don't log every position update to reduce console spam
    return this.emit('updatePosition', { x, y, direction });
  }

  sendChatMessage(message, type) {
    console.log(`[Chat] Sending ${type} message`);
    return this.emit('chatMessage', { message, type });
  }

  rescuePlayer(targetId) {
    console.log(`[Game] Attempting rescue: ${targetId}`);
    return this.emit('rescuePlayer', { targetId });
  }

  collectPowerup(powerupId, powerupType) {
    console.log(`[Game] Collecting powerup: ${powerupType}`);
    return this.emit('collectPowerup', { powerupId, powerupType });
  }

  // ==================== UTILITY METHODS ====================

  handleDisconnect(reason) {
    console.error(`[Socket] Handling disconnect: ${reason}`);
    
    // Pause the game
    if (window.game?.scene.isActive('GameScene')) {
      window.game.scene.pause('GameScene');
    }

    if (window.uiManager) {
      const friendlyReasons = {
        'transport close': 'Connection lost',
        'transport error': 'Network error',
        'ping timeout': 'Connection timeout',
        'io server disconnect': 'Server disconnected',
        'io client disconnect': 'Disconnected'
      };

      const friendlyReason = friendlyReasons[reason] || reason;
      
      window.uiManager.showError(
        `Lost connection to server: ${friendlyReason}. The page will reload to reconnect.`,
        'Connection Lost',
        () => window.location.reload()
      );
    }
  }

  disconnect() {
    console.log('[Socket] Disconnecting...');
    this.stopPingMonitoring();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.isConnected = false;
    this.connectionPromise = null;
    this.currentLobbyId = null;
    
    console.log('[Socket] Disconnected successfully');
  }

  getLobbyId() {
    return this.currentLobbyId;
  }

  // ==================== DEBUG METHODS ====================

  getConnectionStatus() {
    return {
      connected: this.isConnected,
      socketId: this.socket?.id,
      lobbyId: this.currentLobbyId,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  logStatus() {
    console.log('[NetworkManager] Status:', this.getConnectionStatus());
  }
}