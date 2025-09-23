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
    this.connectionPromise = null; // Track connection state
  }

  connect() {
    // Prevent multiple connection attempts
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // This logic automatically switches between your live URL and a local one for testing.
    const serverUrl = window.location.hostname.includes("github.io")
      ? LIVE_BACKEND_URL
      : `http://${window.location.hostname}:3000`;

    // Add logging before attempting to connect
    console.log(`[Socket DEBUG] Attempting to connect to server at: ${serverUrl}`);

    this.connectionPromise = new Promise((resolve, reject) => {
      // --- CRITICAL FIX ---
      // Tell the client to connect using only the WebSocket protocol,
      // matching the server's configuration in the Canvas.
      this.socket = io(serverUrl, {
        withCredentials: true,
        transports: ['websocket'],
        // Add timeout and retry settings for better reliability
        timeout: 10000,
        forceNew: true
      });

      this.socket.on('connect', () => {
        // Log successful connection
        console.log(`[Socket DEBUG] Successfully connected to server. Socket ID: ${this.socket.id}`);
        this.isConnected = true;
        resolve();
      });

      this.socket.on('disconnect', (reason) => {
        // Log disconnection details
        console.warn(`[Socket DEBUG] Disconnected from server. Reason: ${reason}`);
        this.isConnected = false;
        this.connectionPromise = null; // Reset so we can reconnect
        if (window.uiManager) {
          alert('You have been disconnected from the server.');
          window.location.reload();
        }
      });

      this.socket.on('connect_error', (error) => {
        // Log the specific connection error
        console.error(`[Socket DEBUG] Connection failed. Error:`, error.message);
        this.connectionPromise = null; // Reset on error
        reject(error);
      });

      this.setupEventHandlers();
    });

    return this.connectionPromise;
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

  // Register a callback for a specific event.
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
      // Try to reconnect if not connected
      if (!this.isConnected && !this.connectionPromise) {
        console.log('Attempting to reconnect...');
        this.connect().catch(err => {
          console.error('Reconnection failed:', err);
        });
      }
    }
  }

  // Async versions that wait for connection
  async joinGame(username) { 
    await this.ensureConnected();
    this.emit('joinGame', { username }); 
  }
  
  async changeTeam() { 
    await this.ensureConnected();
    this.emit('changeTeam'); 
  }
  
  async playerReady() { 
    await this.ensureConnected();
    this.emit('playerReady'); 
  }

  // Synchronous versions for real-time events (these should be fine to fail silently if not connected)
  updatePosition(x, y) { this.emit('updatePosition', { x, y }); }
  sendChatMessage(message, type) { this.emit('chatMessage', { message, type }); }
  rescuePlayer(targetId) { this.emit('rescuePlayer', { targetId }); }
  collectPowerup(powerupId) { this.emit('collectPowerup', { powerupId }); }

  // Helper method to ensure connection before emitting critical events
  async ensureConnected() {
    if (!this.isConnected) {
      if (this.connectionPromise) {
        await this.connectionPromise;
      } else {
        await this.connect();
      }
    }
  }
}