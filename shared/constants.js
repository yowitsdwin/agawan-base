// Shared constants between client and server
const GAME_CONSTANTS = {
  TEAMS: {
    RED: 'red',
    BLUE: 'blue'
  },
  
  PLAYER_STATES: {
    IN_BASE: 'in_base',
    ACTIVE: 'active',
    FROZEN: 'frozen'
  },
  
  GAME_STATES: {
    WAITING: 'waiting',
    PLAYING: 'playing',
    ENDED: 'ended'
  },
  
  GAME_CONFIG: {
    MAX_PLAYERS_PER_TEAM: 3,
    WINNING_SCORE: 3,
    GAME_DURATION: 300000, // 5 minutes in milliseconds
    PLAYER_SPEED: 200,
    PLAYER_SIZE: 32,
    BASE_SIZE: 150
  },
  
  MAP: {
    WIDTH: 1200,
    HEIGHT: 600,
    RED_BASE: { x: 75, y: 300 },
    BLUE_BASE: { x: 1125, y: 300 }
  },
  
  POWERUPS: {
    SPEED_BOOST: 'speed_boost',
    SHIELD: 'shield',
    REVEAL: 'reveal'
  }
};

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GAME_CONSTANTS;
} else {
  window.GAME_CONSTANTS = GAME_CONSTANTS;
}