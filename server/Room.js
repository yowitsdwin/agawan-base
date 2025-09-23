const CONSTANTS = require('../shared/constants');
const GameLogic = require('./GameLogic');

class Room {
  constructor(id) {
    this.id = id;
    this.players = new Map();
    this.gameState = CONSTANTS.GAME_STATES.LOBBY; // Start in the lobby
    this.teamScores = { red: 0, blue: 0 };
    this.gameStartTime = null;
    this.gameLogic = new GameLogic(this);
    this.powerups = new Map();
    this.gameLoopInterval = null;

    this.startGameLoop(); // The "heartbeat" of the room
  }

  // The main loop that runs 10x per second to keep everything in sync
  startGameLoop() {
    if (this.gameLoopInterval) clearInterval(this.gameLoopInterval);
    this.gameLoopInterval = setInterval(() => {
      // If in the lobby, check if all players are ready to start
      if (this.gameState === CONSTANTS.GAME_STATES.LOBBY) {
        if (this.players.size >= CONSTANTS.GAME_CONFIG.MIN_PLAYERS_TO_START && Array.from(this.players.values()).every(p => p.isReady)) {
          this.startGame();
        }
      }
      
      // If the game is playing, update all game logic and timers
      if (this.gameState === CONSTANTS.GAME_STATES.PLAYING) {
        this.gameLogic.update(); // This will check timers, collisions, scoring, etc.
        this.broadcast('roomStateUpdate', this.getRoomState()); 
      }
    }, 100); // Sync 10 times per second for smooth updates
  }

  addPlayer(player) {
    if (this.players.size >= CONSTANTS.GAME_CONFIG.MAX_PLAYERS_PER_TEAM * 2) {
      player.socket.emit('serverError', { message: 'This room is full.' });
      return;
    }
    
    this.players.set(player.id, player);
    const redCount = this.getTeamCount(CONSTANTS.TEAMS.RED);
    const blueCount = this.getTeamCount(CONSTANTS.TEAMS.BLUE);
    player.setTeam(redCount <= blueCount ? CONSTANTS.TEAMS.RED : CONSTANTS.TEAMS.BLUE);
    
    // Send the latest state to everyone
    this.broadcast('roomStateUpdate', this.getRoomState());
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
    if (this.gameState === CONSTANTS.GAME_STATES.PLAYING && this.players.size < CONSTANTS.GAME_CONFIG.MIN_PLAYERS_TO_START) {
      this.gameLogic.endGame(null, "Not enough players.");
    }
    this.broadcast('roomStateUpdate', this.getRoomState());
  }
  
  // Transition the room from Lobby to Playing
  startGame() {
    this.gameState = CONSTANTS.GAME_STATES.PLAYING;
    this.gameStartTime = Date.now();
    this.teamScores = { red: 0, blue: 0 };
    this.players.forEach(p => p.resetToBase());
    this.broadcast('gameStarted', this.getRoomState());
  }

  changeTeam(playerId) {
    const player = this.players.get(playerId);
    if (player && this.gameState === CONSTANTS.GAME_STATES.LOBBY) {
      player.unready();
      const newTeam = player.team === CONSTANTS.TEAMS.RED ? CONSTANTS.TEAMS.BLUE : CONSTANTS.TEAMS.RED;
      const newTeamCount = this.getTeamCount(newTeam);
      if (newTeamCount < CONSTANTS.GAME_CONFIG.MAX_PLAYERS_PER_TEAM) {
        player.team = newTeam;
      }
      this.broadcast('roomStateUpdate', this.getRoomState());
    }
  }

  setPlayerReady(playerId) {
    const player = this.players.get(playerId);
    if (player && this.gameState === CONSTANTS.GAME_STATES.LOBBY) {
      player.isReady = !player.isReady;
      this.broadcast('roomStateUpdate', this.getRoomState());
    }
  }

  getTeamCount(team) {
    return Array.from(this.players.values()).filter(p => p.team === team).length;
  }

  updatePowerups() {
    if (this.powerups.size < 3 && Math.random() < 0.01) {
      const powerupTypes = Object.values(CONSTANTS.POWERUPS);
      const type = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
      const powerup = {
        id: Date.now() + Math.random(),
        type: type.id,
        x: 150 + Math.random() * (CONSTANTS.MAP.WIDTH - 300),
        y: 100 + Math.random() * (CONSTANTS.MAP.HEIGHT - 200)
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
      gameState: this.gameState,
      teamScores: this.teamScores,
      players: Array.from(this.players.values()).map(p => p.getState()),
      powerups: Array.from(this.powerups.values()),
      timeRemaining: this.getTimeRemaining()
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
    if (this.gameLoopInterval) clearInterval(this.gameLoopInterval);
    this.players.forEach(p => p.clearAllPowerups());
    console.log(`Room ${this.id} has been cleaned up.`);
  }
}

module.exports = Room;

