// server/Player.js
// Fixed to work with dynamic map configurations

const CONSTANTS = require('../shared/constants');

class Player {
  constructor(id, socket, username) {
    this.id = id;
    this.socket = socket;
    this.username = username;
    this.team = null;
    this.x = 0;
    this.y = 0;
    this.direction = 'front';
    this.state = CONSTANTS.PLAYER_STATES.IN_BASE;
    this.baseExitTime = null;
    this.score = 0;
    this.tags = 0;
    this.rescues = 0;
    this.speedMultiplier = 1;
    this.lastUpdate = Date.now();
    this.activePowerups = new Map();
    this.isReady = false;
    this.frozenUntil = 0;
    this.room = null; // Reference to the room this player is in
  }

  setRoom(room) {
    this.room = room;
  }

  setTeam(team) {
    this.team = team;
    this.resetToBase();
  }

  resetToBase() {
    if (!this.room) {
      console.error('[Player] Cannot reset to base: room not set');
      return;
    }

    // Get map configuration from room
    const mapKey = this.room.settings.map.toUpperCase();
    const mapConfig = CONSTANTS.MAPS[mapKey] || CONSTANTS.MAPS.CLASSIC;

    if (this.team === CONSTANTS.TEAMS.RED) {
      this.x = mapConfig.redBase.x;
      this.y = mapConfig.redBase.y;
    } else {
      this.x = mapConfig.blueBase.x;
      this.y = mapConfig.blueBase.y;
    }
    
    this.state = CONSTANTS.PLAYER_STATES.IN_BASE;
    this.baseExitTime = null;
    this.direction = 'front';
    this.clearAllPowerups();
  }

  updatePosition(x, y, direction) {
    this.x = x;
    this.y = y;
    this.direction = direction || this.direction;
    this.checkBaseExit();
  }

  checkBaseExit() {
    const isInOwnBase = this.isInBase(this.team);
    
    if ((this.state === CONSTANTS.PLAYER_STATES.IN_BASE || 
         this.state === CONSTANTS.PLAYER_STATES.SHIELDED) && !isInOwnBase) {
      this.state = CONSTANTS.PLAYER_STATES.ACTIVE;
      this.baseExitTime = Date.now();
    } else if (this.state === CONSTANTS.PLAYER_STATES.ACTIVE && isInOwnBase) {
      this.state = CONSTANTS.PLAYER_STATES.IN_BASE;
      this.baseExitTime = null;
    }
  }

  isInBase(team) {
    if (!this.room) return false;

    const mapKey = this.room.settings.map.toUpperCase();
    const mapConfig = CONSTANTS.MAPS[mapKey] || CONSTANTS.MAPS.CLASSIC;
    
    const basePos = team === CONSTANTS.TEAMS.RED ? 
                    mapConfig.redBase : mapConfig.blueBase;
    
    return Math.hypot(this.x - basePos.x, this.y - basePos.y) <= 
           CONSTANTS.GAME_CONFIG.BASE_SIZE / 2;
  }

  canTag(otherPlayer) {
    if (this.team === otherPlayer.team || 
        this.state !== CONSTANTS.PLAYER_STATES.ACTIVE || 
        otherPlayer.state !== CONSTANTS.PLAYER_STATES.ACTIVE) {
      return false;
    }
    return this.baseExitTime > otherPlayer.baseExitTime;
  }

  freeze() {
    this.state = CONSTANTS.PLAYER_STATES.FROZEN;
    this.frozenUntil = Date.now() + CONSTANTS.GAME_CONFIG.FROZEN_DURATION;
    this.clearAllPowerups();
  }

  rescue() {
    this.state = CONSTANTS.PLAYER_STATES.ACTIVE;
    this.frozenUntil = 0;
  }
  
  unready() {
    this.isReady = false;
  }

  addPowerup(powerup) {
    this.clearPowerup(powerup.id);

    const timeout = setTimeout(() => {
      this.removePowerup(powerup.id);
    }, powerup.duration);

    this.activePowerups.set(powerup.id, timeout);

    if (powerup.id === CONSTANTS.POWERUPS.SPEED_BOOST.id) {
      this.speedMultiplier = powerup.speedMultiplier;
    } else if (powerup.id === CONSTANTS.POWERUPS.SHIELD.id) {
      this.state = CONSTANTS.PLAYER_STATES.SHIELDED;
    }
  }

  removePowerup(powerupId) {
    this.clearPowerup(powerupId);
    
    if (powerupId === CONSTANTS.POWERUPS.SPEED_BOOST.id) {
      this.speedMultiplier = 1;
    } else if (powerupId === CONSTANTS.POWERUPS.SHIELD.id) {
      if (this.state === CONSTANTS.PLAYER_STATES.SHIELDED) {
        this.state = CONSTANTS.PLAYER_STATES.ACTIVE;
      }
    }
  }

  clearPowerup(powerupId) {
    if (this.activePowerups.has(powerupId)) {
      clearTimeout(this.activePowerups.get(powerupId));
      this.activePowerups.delete(powerupId);
    }
  }

  clearAllPowerups() {
    for (const powerupId of this.activePowerups.keys()) {
      this.removePowerup(powerupId);
    }
  }

  getState() {
    return {
      id: this.id,
      username: this.username,
      team: this.team,
      x: this.x,
      y: this.y,
      direction: this.direction,
      state: this.state,
      score: this.score,
      tags: this.tags,
      rescues: this.rescues,
      speedMultiplier: this.speedMultiplier,
      activePowerups: Array.from(this.activePowerups.keys()),
      isReady: this.isReady,
      frozenUntil: this.frozenUntil
    };
  }
}

module.exports = Player;