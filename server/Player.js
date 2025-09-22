const CONSTANTS = require('../shared/constants');

class Player {
  constructor(id, socket, username) {
    this.id = id;
    this.socket = socket;
    this.username = username;
    this.team = null;
    this.x = 0;
    this.y = 0;
    this.state = CONSTANTS.PLAYER_STATES.IN_BASE;
    this.baseExitTime = null;
    this.score = 0;
    this.tags = 0;
    this.rescues = 0;
    this.speedMultiplier = 1;
    this.lastUpdate = Date.now();
    this.activePowerups = new Map(); // To track active powerups and their timeouts
  }

  setTeam(team) {
    this.team = team;
    this.resetToBase();
  }

  resetToBase() {
    if (this.team === CONSTANTS.TEAMS.RED) {
      this.x = CONSTANTS.MAP.RED_BASE.x;
      this.y = CONSTANTS.MAP.RED_BASE.y;
    } else {
      this.x = CONSTANTS.MAP.BLUE_BASE.x;
      this.y = CONSTANTS.MAP.BLUE_BASE.y;
    }
    this.state = CONSTANTS.PLAYER_STATES.IN_BASE;
    this.baseExitTime = null;
    this.clearAllPowerups();
  }

  updatePosition(x, y) {
    this.x = x;
    this.y = y;
    this.checkBaseExit();
  }

  checkBaseExit() {
    const isInOwnBase = this.isInBase(this.team);
    if ((this.state === CONSTANTS.PLAYER_STATES.IN_BASE || this.state === CONSTANTS.PLAYER_STATES.SHIELDED) && !isInOwnBase) {
      this.state = CONSTANTS.PLAYER_STATES.ACTIVE;
      this.baseExitTime = Date.now();
    } else if (this.state === CONSTANTS.PLAYER_STATES.ACTIVE && isInOwnBase) {
      this.state = CONSTANTS.PLAYER_STATES.IN_BASE;
      this.baseExitTime = null;
    }
  }

  isInBase(team) {
    const basePos = team === CONSTANTS.TEAMS.RED ? CONSTANTS.MAP.RED_BASE : CONSTANTS.MAP.BLUE_BASE;
    return Math.hypot(this.x - basePos.x, this.y - basePos.y) <= CONSTANTS.GAME_CONFIG.BASE_SIZE / 2;
  }

  canTag(otherPlayer) {
    if (this.team === otherPlayer.team || this.state !== CONSTANTS.PLAYER_STATES.ACTIVE || otherPlayer.state !== CONSTANTS.PLAYER_STATES.ACTIVE) {
      return false;
    }
    // "Later leaver tags earlier leaver" rule
    return this.baseExitTime > otherPlayer.baseExitTime;
  }

  freeze() {
    this.state = CONSTANTS.PLAYER_STATES.FROZEN;
    this.clearAllPowerups();
  }

  rescue() {
    // If rescued, become active again, but baseExitTime is not reset
    this.state = CONSTANTS.PLAYER_STATES.ACTIVE;
  }
  
  addPowerup(powerup) {
    this.clearPowerup(powerup.id); // Clear existing timeout if any

    const timeout = setTimeout(() => {
      this.removePowerup(powerup.id);
    }, powerup.duration);

    this.activePowerups.set(powerup.id, timeout);

    // Apply immediate effects
    if (powerup.id === CONSTANTS.POWERUPS.SPEED_BOOST.id) {
      this.speedMultiplier = powerup.speedMultiplier;
    } else if (powerup.id === CONSTANTS.POWERUPS.SHIELD.id) {
      this.state = CONSTANTS.PLAYER_STATES.SHIELDED;
    }
  }

  removePowerup(powerupId) {
    this.clearPowerup(powerupId);
    // Revert effects
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
      id: this.id, username: this.username, team: this.team,
      x: this.x, y: this.y, state: this.state, score: this.score,
      tags: this.tags, rescues: this.rescues,
      // Send active powerup keys to the client
      activePowerups: Array.from(this.activePowerups.keys())
    };
  }
}

module.exports = Player;
