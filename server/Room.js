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
  }

  addPlayer(player) {
    this.players.set(player.id, player);
    
    // Auto-assign team
    const redCount = this.getTeamCount(CONSTANTS.TEAMS.RED);
    const blueCount = this.getTeamCount(CONSTANTS.TEAMS.BLUE);
    
    const assignedTeam = redCount <= blueCount ? 
      CONSTANTS.TEAMS.RED : CONSTANTS.TEAMS.BLUE;
    
    player.setTeam(assignedTeam);
    
    this.broadcast('playerJoined', {
      player: player.getState(),
      roomState: this.getRoomState()
    });

    // Start game if enough players
    if (this.players.size >= 2 && this.gameState === CONSTANTS.GAME_STATES.WAITING) {
      this.startGame();
    }
  }

  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (player) {
      this.players.delete(playerId);
      this.broadcast('playerLeft', {
        playerId: playerId,
        roomState: this.getRoomState()
      });
    }
  }

  getTeamCount(team) {
    return Array.from(this.players.values())
      .filter(p => p.team === team).length;
  }

  startGame() {
    this.gameState = CONSTANTS.GAME_STATES.PLAYING;
    this.gameStartTime = Date.now();
    this.teamScores = { red: 0, blue: 0 };
    
    // Reset all players
    this.players.forEach(player => player.resetToBase());
    
    this.broadcast('gameStarted', {
      roomState: this.getRoomState()
    });

    // Start game timer
    this.gameTimer = setTimeout(() => {
      this.gameLogic.endGame();
    }, CONSTANTS.GAME_CONFIG.GAME_DURATION);

    // Start game loop
    this.startGameLoop();
  }

  startGameLoop() {
    this.gameLoopInterval = setInterval(() => {
      if (this.gameState === CONSTANTS.GAME_STATES.PLAYING) {
        this.gameLogic.checkCollisions();
        this.gameLogic.checkScoring();
        this.updatePowerups();
      }
    }, 1000 / 60); // 60 FPS
  }

  updatePowerups() {
    // Spawn random powerups occasionally
    if (Math.random() < 0.001) { // 0.1% chance per frame
      this.spawnPowerup();
    }
  }

  spawnPowerup() {
    const powerupTypes = Object.values(CONSTANTS.POWERUPS);
    const powerupType = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
    
    const powerup = {
      id: Date.now(),
      type: powerupType,
      x: Math.random() * (CONSTANTS.MAP.WIDTH - 100) + 50,
      y: Math.random() * (CONSTANTS.MAP.HEIGHT - 100) + 50
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
    if (this.gameTimer) {
      clearTimeout(this.gameTimer);
    }
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
    }
  }
}

module.exports = Room;