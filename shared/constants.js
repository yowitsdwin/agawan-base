// Shared constants between client and server
const GAME_CONSTANTS = {
  TEAMS: {
    RED: 'red',
    BLUE: 'blue'
  },
  
  PLAYER_STATES: {
    IN_BASE: 'in_base',
    ACTIVE: 'active',
    FROZEN: 'frozen',
    SHIELDED: 'shielded' // New state for shield powerup
  },

  GAME_STATES: {
    WAITING: 'waiting',
    PLAYING: 'playing',
    ENDED: 'ended'
  },
  
  GAME_CONFIG: {
    MIN_PLAYERS_TO_START: 2,
    MAX_PLAYERS_PER_TEAM: 3, // Set to 3 for 3v3
    WINNING_SCORE: 3, // Set to 3 points
    GAME_DURATION: 300000, // 5 minutes in milliseconds
    PLAYER_SPEED: 220,
    PLAYER_SIZE: 32,
    BASE_SIZE: 150
  },
  
  MAP: {
    WIDTH: 1600,
    HEIGHT: 800,
    RED_BASE: { x: 100, y: 400 },
    BLUE_BASE: { x: 1500, y: 400 }
  },
  
  POWERUPS: {
    SPEED_BOOST: {
      id: 'speed_boost',
      duration: 5000, // 5 seconds
      speedMultiplier: 1.5 // 50% faster
    },
    SHIELD: {
      id: 'shield',
      duration: 8000 // 8 seconds
    },
    REVEAL: {
      id: 'reveal',
      duration: 10000 // 10 seconds, reveals enemies
    }
  }
};

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GAME_CONSTANTS;
} else {
  window.GAME_CONSTANTS = GAME_CONSTANTS;
}