// shared/constants.js
// Centralized game configuration with all new features

const GAME_CONSTANTS = {
  TEAMS: {
    RED: 'red',
    BLUE: 'blue'
  },

  PLAYER_STATES: {
    IN_BASE: 'in_base',
    ACTIVE: 'active',
    FROZEN: 'frozen',
    SHIELDED: 'shielded'
  },

  GAME_STATES: {
    LOBBY: 'lobby',
    PLAYING: 'playing',
    ENDED: 'ended'
  },

  GAME_MODES: {
    DAY: 'day',
    NIGHT: 'night'
  },

  MAPS: {
    CLASSIC: {
      id: 'classic',
      name: 'Classic Field',
      width: 1600,
      height: 800,
      redBase: { x: 100, y: 400 },
      blueBase: { x: 1500, y: 400 },
      backgroundColor: 0x2d3436,
      obstacles: []
    },
    FOREST: {
      id: 'forest',
      name: 'Forest Arena',
      width: 1600,
      height: 800,
      redBase: { x: 100, y: 400 },
      blueBase: { x: 1500, y: 400 },
      backgroundColor: 0x1e3d20,
      obstacles: [
        { x: 400, y: 200, width: 100, height: 100 },
        { x: 800, y: 400, width: 80, height: 80 },
        { x: 1200, y: 600, width: 100, height: 100 }
      ]
    },
    DESERT: {
      id: 'desert',
      name: 'Desert Wasteland',
      width: 1600,
      height: 800,
      redBase: { x: 100, y: 400 },
      blueBase: { x: 1500, y: 400 },
      backgroundColor: 0xe8b957,
      obstacles: [
        { x: 500, y: 300, width: 120, height: 60 },
        { x: 1100, y: 500, width: 120, height: 60 }
      ]
    }
  },

  GAME_CONFIG: {
    MIN_PLAYERS_TO_START: 2,
    MAX_PLAYERS_PER_TEAM: 3,
    DEFAULT_WINNING_SCORE: 3,
    WINNING_SCORE_OPTIONS: [3, 5, 7, 10],
    GAME_DURATION: 300000,
    PLAYER_SPEED: 220,
    PLAYER_SIZE: 32,
    BASE_SIZE: 150,
    FROZEN_DURATION: 5000,
    FLASHLIGHT_DISTANCE: 300,
    FLASHLIGHT_ANGLE: 60,
    NIGHT_VISION_RADIUS: 100
  },

  POWERUPS: {
    SPEED_BOOST: {
      id: 'speed_boost',
      duration: 5000,
      speedMultiplier: 1.5
    },
    SHIELD: {
      id: 'shield',
      duration: 8000
    },
    REVEAL: {
      id: 'reveal',
      duration: 10000
    }
  },

  LOBBY: {
    ID_LENGTH: 6,
    MAX_LOBBIES: 100,
    LOBBY_TIMEOUT: 3600000 // 1 hour
  },

  VALIDATION: {
    USERNAME_MIN_LENGTH: 2,
    USERNAME_MAX_LENGTH: 20,
    MESSAGE_MAX_LENGTH: 100
  }
};

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GAME_CONSTANTS;
} else {
  window.GAME_CONSTANTS = GAME_CONSTANTS;
}