// server/LobbyManager.js
// Handles lobby creation, joining, and lifecycle management

const CONSTANTS = require('../shared/constants');

class LobbyManager {
  constructor() {
    this.lobbies = new Map();
    this.cleanupInterval = null;
    this.startCleanupTask();
  }

  // Generate unique lobby ID
  generateLobbyId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id;
    let attempts = 0;
    
    do {
      id = '';
      for (let i = 0; i < CONSTANTS.LOBBY.ID_LENGTH; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      attempts++;
    } while (this.lobbies.has(id) && attempts < 100);
    
    if (attempts >= 100) {
      throw new Error('Failed to generate unique lobby ID');
    }
    
    return id;
  }

  // Create new lobby
  createLobby(hostId, hostUsername, settings) {
    if (this.lobbies.size >= CONSTANTS.LOBBY.MAX_LOBBIES) {
      throw new Error('Maximum number of lobbies reached');
    }

    const lobbyId = this.generateLobbyId();
    const Room = require('./Room');
    
    const lobby = new Room(lobbyId, {
      hostId,
      hostUsername,
      map: settings.map || 'classic',
      winningScore: settings.winningScore || CONSTANTS.GAME_CONFIG.DEFAULT_WINNING_SCORE,
      gameMode: settings.gameMode || CONSTANTS.GAME_MODES.DAY,
      createdAt: Date.now()
    });

    this.lobbies.set(lobbyId, lobby);
    console.log(`[LobbyManager] Created lobby ${lobbyId} by ${hostUsername}`);
    
    return { lobbyId, lobby };
  }

  // Get lobby by ID
  getLobby(lobbyId) {
    return this.lobbies.get(lobbyId.toUpperCase());
  }

  // Check if lobby exists
  lobbyExists(lobbyId) {
    return this.lobbies.has(lobbyId.toUpperCase());
  }

  // Delete lobby
  deleteLobby(lobbyId) {
    const lobby = this.lobbies.get(lobbyId);
    if (lobby) {
      lobby.cleanup();
      this.lobbies.delete(lobbyId);
      console.log(`[LobbyManager] Deleted lobby ${lobbyId}`);
    }
  }

  // Get lobby list (for potential lobby browser feature)
  getPublicLobbies() {
    const publicLobbies = [];
    this.lobbies.forEach((lobby, id) => {
      if (lobby.gameState === CONSTANTS.GAME_STATES.LOBBY) {
        publicLobbies.push({
          id,
          playerCount: lobby.players.size,
          maxPlayers: CONSTANTS.GAME_CONFIG.MAX_PLAYERS_PER_TEAM * 2,
          map: lobby.settings.map,
          gameMode: lobby.settings.gameMode,
          hostUsername: lobby.settings.hostUsername
        });
      }
    });
    return publicLobbies;
  }

  // Cleanup inactive lobbies
  startCleanupTask() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      this.lobbies.forEach((lobby, id) => {
        // Remove empty lobbies
        if (lobby.players.size === 0) {
          this.deleteLobby(id);
          return;
        }
        
        // Remove lobbies that have been inactive for too long
        const inactiveDuration = now - lobby.settings.createdAt;
        if (inactiveDuration > CONSTANTS.LOBBY.LOBBY_TIMEOUT) {
          console.log(`[LobbyManager] Cleaning up inactive lobby ${id}`);
          this.deleteLobby(id);
        }
      });
    }, 60000); // Run every minute
  }

  // Cleanup all lobbies (for graceful shutdown)
  cleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.lobbies.forEach((lobby, id) => {
      this.deleteLobby(id);
    });
    console.log('[LobbyManager] All lobbies cleaned up');
  }

  // Get statistics
  getStats() {
    return {
      totalLobbies: this.lobbies.size,
      playingGames: Array.from(this.lobbies.values()).filter(
        l => l.gameState === CONSTANTS.GAME_STATES.PLAYING
      ).length,
      totalPlayers: Array.from(this.lobbies.values()).reduce(
        (sum, lobby) => sum + lobby.players.size, 0
      )
    };
  }
}

module.exports = LobbyManager;