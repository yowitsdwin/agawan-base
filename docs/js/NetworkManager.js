// client/js/NetworkManager.js
// PRODUCTION-READY: Optimized network manager with robust error handling

const LIVE_BACKEND_URL = "https://agawan-base-server.onrender.com";
const CONNECTION_TIMEOUT = 10000;
const PING_INTERVAL = 30000;
const POSITION_UPDATE_THROTTLE = 50; // ms

class NetworkManager {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.callbacks = new Map();
    this.connectionPromise = null;
    this.currentLobbyId = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
    this.pingInterval = null;
    this.lastPositionUpdate = 0;
    this.pendingMessages = [];
    this.serverUrl = this.getServerUrl();
    console.log('[NetworkManager] Initialized with server:', this.serverUrl);
  }

  getServerUrl() {
    // Detect environment
    const isGitHubPages = window.location.hostname.includes("github.io");
    const isLocalhost = window.location.hostname === "localhost" || 
                        window.location.hostname === "127.0.0.1";
    
    if (isGitHubPages) {
      console.log('[Network] Running on GitHub Pages, using live backend');
      return LIVE_BACKEND_URL;
    }
    
    if (isLocalhost) {
      console.log('[Network] Running locally');
      return `http://${window.location.hostname}:3000`;
    }
    
    // For other deployments (Vercel, Firebase, etc.)
    console.log('[Network] Production deployment detected, using live backend');
    return LIVE_BACKEND_URL;
  }

  async checkServerAvailability() {
    console.log(`[Server Check] Testing: ${this.serverUrl}`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.serverUrl}/api/server-status`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        signal: controller.signal,
        mode: 'cors'
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        console.log('[Server Check] ✓ Server available:', data);
        return { available: true, stats: data.stats };
      }
      
      console.warn('[Server Check] Server returned status:', response.status);
      return { available: false };
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('[Server Check] ✗ Request timeout (5s)');
      } else {
        console.error('[Server Check] ✗ Failed:', error.message);
      }
      return { available: false };
    }
  }

  connect() {
    if (this.connectionPromise) {
      console.log('[Socket] Connection already in progress');
      return this.connectionPromise;
    }

    console.log(`[Socket] Initiating connection to: ${this.serverUrl}`);

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        this.socket = io(this.serverUrl, {
          withCredentials: true,
          transports: ['websocket', 'polling'], // Fallback to polling if needed
          timeout: CONNECTION_TIMEOUT,
          forceNew: true,
          reconnection: false,
          upgrade: true,
          rememberUpgrade: true
        });

        const connectionTimeout = setTimeout(() => {
          if (!this.isConnected) {
            console.error('[Socket] ✗ Connection timeout');
            this.socket?.disconnect();
            this.connectionPromise = null;
            reject(new Error('Connection timeout - server may be sleeping'));
          }
        }, CONNECTION_TIMEOUT);

        this.socket.on('connect', () => {
          clearTimeout(connectionTimeout);
          console.log(`[Socket] ✓ Connected! ID: ${this.socket.id}`);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startPingMonitoring();
          this.processPendingMessages();
          resolve();
        });

        this.socket.on('disconnect', (reason) => {
          console.warn(`[Socket] Disconnected: ${reason}`);
          this.isConnected = false;
          this.connectionPromise = null;
          this.stopPingMonitoring();
          this.handleDisconnect(reason);
        });

        this.socket.on('connect_error', (error) => {
          clearTimeout(connectionTimeout);
          console.error(`[Socket] ✗ Connection error:`, error.message);
          this.connectionPromise = null;
          this.reconnectAttempts++;
          
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            reject(new Error('Failed to connect after multiple attempts. Server may be waking up - please try again in 30 seconds.'));
          } else {
            reject(error);
          }
        });

        this.socket.on('error', (error) => {
          console.error('[Socket] Socket error:', error);
        });

        this.setupEventHandlers();
      } catch (error) {
        console.error('[Socket] Setup failed:', error);
        this.connectionPromise = null;
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  startPingMonitoring() {
    this.pingInterval = setInterval(() => {
      if (this.socket && this.isConnected) {
        const start = Date.now();
        this.socket.emit('ping', () => {
          const latency = Date.now() - start;
          if (latency > 1000) {
            console.warn(`[Socket] High latency: ${latency}ms`);
          }
        });
      }
    }, PING_INTERVAL);
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
      console.error(`[Socket] Not initialized, queuing: ${event}`);
      this.pendingMessages.push({ event, data });
      return false;
    }

    if (!this.isConnected) {
      console.error(`[Socket] Not connected, queuing: ${event}`);
      this.pendingMessages.push({ event, data });
      return false;
    }

    try {
      this.socket.emit(event, data);
      return true;
    } catch (error) {
      console.error(`[Socket] Error emitting '${event}':`, error);
      return false;
    }
  }

  processPendingMessages() {
    if (this.pendingMessages.length > 0) {
      console.log(`[Socket] Processing ${this.pendingMessages.length} pending messages`);
      this.pendingMessages.forEach(({ event, data }) => {
        this.emit(event, data);
      });
      this.pendingMessages = [];
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
          console.log(`[Lobby] ✓ Created: ${data.lobbyId}`);
          resolve(data);
        };

        const onError = (error) => {
          clearTimeout(timeout);
          this.socket.off('lobbyCreated', onCreated);
          console.error('[Lobby] ✗ Create error:', error);
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
          console.log(`[Lobby] ✓ Joined: ${data.lobbyId}`);
          resolve(data);
        };

        const onError = (error) => {
          clearTimeout(timeout);
          this.socket.off('lobbyJoined', onJoined);
          console.error('[Lobby] ✗ Join error:', error);
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
    return this.emit('updateLobbySettings', { settings });
  }

  async changeTeam() {
    await this.ensureConnected();
    return this.emit('changeTeam');
  }

  async playerReady() {
    await this.ensureConnected();
    return this.emit('playerReady');
  }

  // ==================== GAME METHODS ====================

  updatePosition(x, y, direction) {
    // Throttle position updates to reduce network traffic
    const now = Date.now();
    if (now - this.lastPositionUpdate < POSITION_UPDATE_THROTTLE) {
      return false;
    }
    this.lastPositionUpdate = now;
    return this.emit('updatePosition', { x, y, direction });
  }

  sendChatMessage(message, type) {
    return this.emit('chatMessage', { message, type });
  }

  rescuePlayer(targetId) {
    return this.emit('rescuePlayer', { targetId });
  }

  collectPowerup(powerupId, powerupType) {
    return this.emit('collectPowerup', { powerupId, powerupType });
  }

  // ==================== UTILITY METHODS ====================

  handleDisconnect(reason) {
    console.error(`[Socket] Handling disconnect: ${reason}`);
    
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
        `Lost connection: ${friendlyReason}. Refreshing to reconnect...`,
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
    
    console.log('[Socket] Disconnected');
  }

  getLobbyId() {
    return this.currentLobbyId;
  }

  getConnectionStatus() {
    return {
      connected: this.isConnected,
      socketId: this.socket?.id,
      lobbyId: this.currentLobbyId,
      reconnectAttempts: this.reconnectAttempts,
      serverUrl: this.serverUrl
    };
  }

  logStatus() {
    console.log('[NetworkManager] Status:', this.getConnectionStatus());
  }
}