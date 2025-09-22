const CONSTANTS = require('../shared/constants');
const GameLogic = require('./GameLogic');

class Room {
  constructor(id) {
    this.id = id;
    this.players = new Map();
    this.gameState = CONSTANTS.GAME_STATES.WAITING;
    this.teamScores = { red: 0, blue: 0 };
    this.gameTimer = null;
    this.gameStartTime = null;
    this.gameLogic = new GameLogic(this);
    this.powerups = new Map();
    this.gameLoopInterval = null;
  }

  addPlayer(player) {
    this.players.set(player.id, player);
    const redCount = this.getTeamCount(CONSTANTS.TEAMS.RED);
    const blueCount = this.getTeamCount(CONSTANTS.TEAMS.BLUE);
    const assignedTeam = redCount <= blueCount ? CONSTANTS.TEAMS.RED : CONSTANTS.TEAMS.BLUE;
    player.setTeam(assignedTeam);
    
    // Notify all players (including the new one) about the current state
    this.broadcast('playerJoined', {
      player: player.getState(),
      roomState: this.getRoomState()
    });

    if (this.players.size >= CONSTANTS.GAME_CONFIG.MIN_PLAYERS_TO_START && this.gameState === CONSTANTS.GAME_STATES.WAITING) {
      this.startGame();
    }
  }

  removePlayer(playerId) {
    if (this.players.has(playerId)) {
      this.players.delete(playerId);
      this.broadcast('playerLeft', {
        playerId: playerId,
        roomState: this.getRoomState()
      });
    }
  }

  getTeamCount(team) {
    return Array.from(this.players.values()).filter(p => p.team === team).length;
  }

  startGame() {
    this.gameState = CONSTANTS.GAME_STATES.PLAYING;
    this.gameStartTime = Date.now();
    this.teamScores = { red: 0, blue: 0 };
    
    this.players.forEach(player => player.resetToBase());
    
    this.broadcast('gameStarted', {
      roomState: this.getRoomState()
    });
    
    this.gameTimer = setTimeout(() => {
      this.gameLogic.endGame();
    }, CONSTANTS.GAME_CONFIG.GAME_DURATION);
    
    this.startGameLoop();
  }

  startGameLoop() {
    if (this.gameLoopInterval) clearInterval(this.gameLoopInterval);
    this.gameLoopInterval = setInterval(() => {
      if (this.gameState === CONSTANTS.GAME_STATES.PLAYING) {
        this.gameLogic.checkCollisions();
        this.gameLogic.checkScoring();
        this.updatePowerups();
      }
    }, 1000 / 60); // 60 FPS
  }

  updatePowerups() {
    if (Math.random() < 0.005) { // 0.5% chance per frame
      this.spawnPowerup();
    }
  }

  spawnPowerup() {
    const powerupTypes = Object.values(CONSTANTS.POWERUPS);
    const type = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
    const powerup = {
      id: Date.now() + Math.random(),
      type: type,
      x: 100 + Math.random() * (CONSTANTS.MAP.WIDTH - 200),
      y: 50 + Math.random() * (CONSTANTS.MAP.HEIGHT - 100)
    };
    this.powerups.set(powerup.id, powerup);
    this.broadcast('powerupSpawned', powerup);
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
    if (this.gameTimer) clearTimeout(this.gameTimer);
    if (this.gameLoopInterval) clearInterval(this.gameLoopInterval);
  }
}

module.exports = Room;