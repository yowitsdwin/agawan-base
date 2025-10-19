// server/Room.js
// Enhanced room with lobby settings, chat, and leaderboard support

const CONSTANTS = require('../shared/constants');
const GameLogic = require('./GameLogic');

class Room {
  constructor(id, settings = {}) {
    this.id = id;
    this.settings = {
      hostId: settings.hostId,
      hostUsername: settings.hostUsername,
      map: settings.map || 'classic',
      winningScore: settings.winningScore || CONSTANTS.GAME_CONFIG.DEFAULT_WINNING_SCORE,
      gameMode: settings.gameMode || CONSTANTS.GAME_MODES.DAY,
      createdAt: settings.createdAt || Date.now()
    };
    
    this.players = new Map();
    this.gameState = CONSTANTS.GAME_STATES.LOBBY;
    this.teamScores = { red: 0, blue: 0 };
    this.gameStartTime = null;
    this.gameLogic = new GameLogic(this);
    this.powerups = new Map();
    this.gameLoopInterval = null;
    this.chatHistory = [];

    this.startGameLoop();
  }

  startGameLoop() {
    if (this.gameLoopInterval) clearInterval(this.gameLoopInterval);
    
    this.gameLoopInterval = setInterval(() => {
      if (this.gameState === CONSTANTS.GAME_STATES.LOBBY) {
        this.checkReadyToStart();
      } else if (this.gameState === CONSTANTS.GAME_STATES.PLAYING) {
        this.gameLogic.update();
        this.broadcast('roomStateUpdate', this.getRoomState());
      }
    }, 100);
  }

  checkReadyToStart() {
    const playerCount = this.players.size;
    const allReady = playerCount >= CONSTANTS.GAME_CONFIG.MIN_PLAYERS_TO_START &&
                     Array.from(this.players.values()).every(p => p.isReady);
    
    if (allReady) {
      this.startGame();
    }
  }

  addPlayer(player) {
    if (this.players.size >= CONSTANTS.GAME_CONFIG.MAX_PLAYERS_PER_TEAM * 2) {
      player.socket.emit('serverError', { 
        message: 'This lobby is full.',
        code: 'LOBBY_FULL'
      });
      return false;
    }

    if (this.gameState !== CONSTANTS.GAME_STATES.LOBBY) {
      player.socket.emit('serverError', { 
        message: 'Game already in progress.',
        code: 'GAME_IN_PROGRESS'
      });
      return false;
    }
    
    this.players.set(player.id, player);
    const redCount = this.getTeamCount(CONSTANTS.TEAMS.RED);
    const blueCount = this.getTeamCount(CONSTANTS.TEAMS.BLUE);
    player.setTeam(redCount <= blueCount ? CONSTANTS.TEAMS.RED : CONSTANTS.TEAMS.BLUE);
    
    // Send chat history to new player
    this.chatHistory.forEach(msg => {
      player.socket.emit('chatMessage', msg);
    });
    
    this.broadcast('roomStateUpdate', this.getRoomState());
    this.broadcast('playerJoined', { 
      username: player.username, 
      playerCount: this.players.size 
    });
    
    console.log(`[Room ${this.id}] Player ${player.username} joined`);
    return true;
  }

  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (!player) return;

    const wasHost = playerId === this.settings.hostId;
    this.players.delete(playerId);
    
    // Transfer host if necessary
    if (wasHost && this.players.size > 0) {
      const newHost = Array.from(this.players.values())[0];
      this.settings.hostId = newHost.id;
      this.settings.hostUsername = newHost.username;
      this.broadcast('hostChanged', { 
        newHostId: newHost.id, 
        newHostUsername: newHost.username 
      });
    }

    if (this.gameState === CONSTANTS.GAME_STATES.PLAYING && 
        this.players.size < CONSTANTS.GAME_CONFIG.MIN_PLAYERS_TO_START) {
      this.gameLogic.endGame(null, "Not enough players.");
    }

    this.broadcast('roomStateUpdate', this.getRoomState());
    this.broadcast('playerLeft', { 
      username: player.username, 
      playerCount: this.players.size 
    });
  }

  updateLobbySettings(settings) {
    if (this.gameState !== CONSTANTS.GAME_STATES.LOBBY) {
      return { success: false, message: 'Cannot change settings during game' };
    }

    if (settings.map && CONSTANTS.MAPS[settings.map.toUpperCase()]) {
      this.settings.map = settings.map;
    }

    if (settings.winningScore && 
        CONSTANTS.GAME_CONFIG.WINNING_SCORE_OPTIONS.includes(settings.winningScore)) {
      this.settings.winningScore = settings.winningScore;
    }

    if (settings.gameMode && 
        Object.values(CONSTANTS.GAME_MODES).includes(settings.gameMode)) {
      this.settings.gameMode = settings.gameMode;
    }

    this.broadcast('lobbySettingsChanged', this.settings);
    this.broadcast('roomStateUpdate', this.getRoomState());
    
    return { success: true };
  }

  startGame() {
    this.gameState = CONSTANTS.GAME_STATES.PLAYING;
    this.gameStartTime = Date.now();
    this.teamScores = { red: 0, blue: 0 };
    this.players.forEach(p => {
      p.resetToBase();
      p.score = 0;
      p.tags = 0;
      p.rescues = 0;
    });
    
    this.broadcast('gameStarted', this.getRoomState());
    console.log(`[Room ${this.id}] Game started`);
  }

  changeTeam(playerId) {
    const player = this.players.get(playerId);
    if (player && this.gameState === CONSTANTS.GAME_STATES.LOBBY) {
      player.unready();
      const newTeam = player.team === CONSTANTS.TEAMS.RED ? 
                      CONSTANTS.TEAMS.BLUE : CONSTANTS.TEAMS.RED;
      const newTeamCount = this.getTeamCount(newTeam);
      
      if (newTeamCount < CONSTANTS.GAME_CONFIG.MAX_PLAYERS_PER_TEAM) {
        player.team = newTeam;
        this.broadcast('roomStateUpdate', this.getRoomState());
      }
    }
  }

  setPlayerReady(playerId) {
    const player = this.players.get(playerId);
    if (player && this.gameState === CONSTANTS.GAME_STATES.LOBBY) {
      player.isReady = !player.isReady;
      this.broadcast('roomStateUpdate', this.getRoomState());
    }
  }

  addChatMessage(playerId, message, type) {
    const player = this.players.get(playerId);
    if (!player) return;

    const sanitizedMessage = message.substring(0, CONSTANTS.VALIDATION.MESSAGE_MAX_LENGTH).trim();
    if (!sanitizedMessage) return;

    const chatMessage = {
      username: player.username,
      team: player.team,
      message: sanitizedMessage,
      type: type || 'global',
      timestamp: Date.now()
    };

    // Store in history (limit to last 100 messages)
    this.chatHistory.push(chatMessage);
    if (this.chatHistory.length > 100) {
      this.chatHistory.shift();
    }

    // Broadcast to appropriate players
    if (type === 'team') {
      this.players.forEach(p => {
        if (p.team === player.team) {
          p.socket.emit('chatMessage', chatMessage);
        }
      });
    } else {
      this.broadcast('chatMessage', chatMessage);
    }
  }

  getTeamCount(team) {
    return Array.from(this.players.values()).filter(p => p.team === team).length;
  }

  getLeaderboard() {
    return Array.from(this.players.values())
      .map(p => ({
        id: p.id,
        username: p.username,
        team: p.team,
        score: p.score,
        tags: p.tags,
        rescues: p.rescues,
        isLocal: false // Will be set on client
      }))
      .sort((a, b) => b.score - a.score);
  }

  updatePowerups() {
    if (this.powerups.size < 3 && Math.random() < 0.01) {
      const powerupTypes = Object.values(CONSTANTS.POWERUPS);
      const type = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
      const mapConfig = CONSTANTS.MAPS[this.settings.map.toUpperCase()];
      
      const powerup = {
        id: Date.now() + Math.random(),
        type: type.id,
        x: 150 + Math.random() * (mapConfig.width - 300),
        y: 100 + Math.random() * (mapConfig.height - 200)
      };
      
      this.powerups.set(powerup.id, powerup);
      this.broadcast('powerupSpawned', powerup);
    }
  }

  broadcast(event, data) {
    this.players.forEach(player => {
      player.socket.emit(event, data);
    });
  }

  getRoomState() {
    return {
      id: this.id,
      settings: this.settings,
      gameState: this.gameState,
      teamScores: this.teamScores,
      players: Array.from(this.players.values()).map(p => p.getState()),
      powerups: Array.from(this.powerups.values()),
      timeRemaining: this.getTimeRemaining(),
      leaderboard: this.getLeaderboard()
    };
  }

  getTimeRemaining() {
    if (!this.gameStartTime || this.gameState !== CONSTANTS.GAME_STATES.PLAYING) {
      return CONSTANTS.GAME_CONFIG.GAME_DURATION;
    }
    const elapsed = Date.now() - this.gameStartTime;
    return Math.max(0, CONSTANTS.GAME_CONFIG.GAME_DURATION - elapsed);
  }

  cleanup() {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
    }
    this.players.forEach(p => p.clearAllPowerups());
    this.players.clear();
    this.powerups.clear();
    console.log(`[Room ${this.id}] Cleaned up`);
  }
}

module.exports = Room;