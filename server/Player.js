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
    this.powerups = new Set();
    this.lastUpdate = Date.now();
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
    this.powerups.clear();
  }

  updatePosition(x, y) {
    this.x = x;
    this.y = y;
    this.lastUpdate = Date.now();
    
    // Check if player is leaving base
    this.checkBaseExit();
  }

  checkBaseExit() {
    const isInOwnBase = this.isInBase(this.team);
    
    if (this.state === CONSTANTS.PLAYER_STATES.IN_BASE && !isInOwnBase) {
      this.state = CONSTANTS.PLAYER_STATES.ACTIVE;
      this.baseExitTime = Date.now();
    } else if (this.state === CONSTANTS.PLAYER_STATES.ACTIVE && isInOwnBase) {
      this.state = CONSTANTS.PLAYER_STATES.IN_BASE;
      this.baseExitTime = null;
    }
  }

  isInBase(team) {
    const basePos = team === CONSTANTS.TEAMS.RED ? 
      CONSTANTS.MAP.RED_BASE : CONSTANTS.MAP.BLUE_BASE;
    
    const distance = Math.sqrt(
      Math.pow(this.x - basePos.x, 2) + 
      Math.pow(this.y - basePos.y, 2)
    );
    
    return distance <= CONSTANTS.GAME_CONFIG.BASE_SIZE / 2;
  }

  canTag(otherPlayer) {
    // Can only tag if both players are active and from different teams
    if (this.team === otherPlayer.team) return false;
    if (this.state !== CONSTANTS.PLAYER_STATES.ACTIVE) return false;
    if (otherPlayer.state !== CONSTANTS.PLAYER_STATES.ACTIVE) return false;
    
    // Later leaver can tag earlier leaver
    return this.baseExitTime > otherPlayer.baseExitTime;
  }

  freeze() {
    this.state = CONSTANTS.PLAYER_STATES.FROZEN;
  }

  rescue() {
    this.state = CONSTANTS.PLAYER_STATES.ACTIVE;
  }

  addPowerup(powerup) {
    this.powerups.add(powerup);
  }

  removePowerup(powerup) {
    this.powerups.delete(powerup);
  }

  getState() {
    return {
      id: this.id,
      username: this.username,
      team: this.team,
      x: this.x,
      y: this.y,
      state: this.state,
      score: this.score,
      tags: this.tags,
      rescues: this.rescues,
      powerups: Array.from(this.powerups)
    };
  }
}

module.exports = Player;