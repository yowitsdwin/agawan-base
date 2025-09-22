// Global variables
window.game = null;
window.networkManager = null;
window.uiManager = null;

// Game configuration
const gameConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: 'gameCanvas',
  backgroundColor: '#2d3436',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
    }
  },
  scene: GameScene,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
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
  window.uiManager = new UIManager();
  
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                   (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
  
  if (isMobile) {
    document.body.classList.add('mobile-device');
  }
  
  const usernameInput = document.getElementById('usernameInput');
  if (usernameInput) {
    usernameInput.focus();
  }
});

// Handle page unload
window.addEventListener('beforeunload', () => {
  if (window.networkManager && window.networkManager.socket) {
    window.networkManager.socket.disconnect();
  }
});