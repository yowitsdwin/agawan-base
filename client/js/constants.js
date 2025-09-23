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
    SHIELDED: 'shielded' // For the shield powerup
  },

  GAME_STATES: {
    LOBBY: 'lobby', // New state for the pre-game lobby
    PLAYING: 'playing',
    ENDED: 'ended'
  },

  GAME_CONFIG: {
    MIN_PLAYERS_TO_START: 2,
    MAX_PLAYERS_PER_TEAM: 3, // For 3v3 gameplay
    WINNING_SCORE: 3,        // Win by reaching 3 points
    GAME_DURATION: 300000,   // 5 minutes in milliseconds
    PLAYER_SPEED: 220,
    PLAYER_SIZE: 32,
    BASE_SIZE: 150,
    FROZEN_DURATION: 5000    // 5 seconds freeze time
  },

  MAP: {
    WIDTH: 1600,
    HEIGHT: 800,
    RED_BASE: { x: 100, y: 400 },
    BLUE_BASE: { x: 1500, y: 400 }
  },

  POWERUPS: {
    // Structured powerup objects with properties
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

// Export for both Node.js (server) and browser (client)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GAME_CONSTANTS;
} else {
  window.GAME_CONSTANTS = GAME_CONSTANTS;
}