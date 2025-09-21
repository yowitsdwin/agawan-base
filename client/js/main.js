// Global variables
window.game = null;
window.networkManager = null;
window.uiManager = null;

// Game configuration
const gameConfig = {
  type: Phaser.AUTO,
  width: GAME_CONSTANTS.MAP.WIDTH,
  height: GAME_CONSTANTS.MAP.HEIGHT,
  parent: 'gameCanvas',
  backgroundColor: '#2d3436',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scene: GameScene,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_CONSTANTS.MAP.WIDTH,
    height: GAME_CONSTANTS.MAP.HEIGHT
  }
};

// Initialize game when called from UI
window.initializeGame = function() {
  if (!window.game) {
    window.game = new Phaser.Game(gameConfig);
  }
};

// Initialize UI on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎮 Agawan Base - Game Loaded');
  
  // Show mobile controls on touch devices
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                   (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
  
  if (isMobile) {
    document.body.classList.add('mobile-device');
  }
  
  // Focus username input
  const usernameInput = document.getElementById('usernameInput');
  if (usernameInput) {
    usernameInput.focus();
  }
});

// Handle window resize
window.addEventListener('resize', () => {
  if (window.game) {
    window.game.scale.refresh();
  }
});

// Handle page unload
window.addEventListener('beforeunload', () => {
  if (window.networkManager && window.networkManager.socket) {
    window.networkManager.socket.disconnect();
  }
});