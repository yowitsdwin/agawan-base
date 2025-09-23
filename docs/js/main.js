// Global variables
window.game = null;
window.networkManager = null;
window.uiManager = null;

// Phaser game configuration
const gameConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: 'gameCanvas',
  backgroundColor: '#2d3436',
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 } }
  },
  scene: GameScene,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

// Main function to initialize the game client
document.addEventListener('DOMContentLoaded', () => {
  console.log('Agawan Base - Client Loaded');
  uiManager = new UIManager();
  networkManager = new NetworkManager();

  // --- Primary Event Listener for UI Updates ---
  // This listener handles all real-time state changes for the UI
  networkManager.on('roomStateUpdate', (roomState) => {
    // --- THIS IS THE FIX ---
    // Use the correct variable name: GAME_CONSTANTS
    if (roomState.gameState === GAME_CONSTANTS.GAME_STATES.LOBBY) {
      uiManager.showScreen('lobbyScreen');
      uiManager.updateLobby(roomState);
    } else if (roomState.gameState === GAME_CONSTANTS.GAME_STATES.PLAYING) {
      uiManager.updateGameUI(roomState);
    }
  });
  
  // This listener starts the Phaser game scene
  networkManager.on('gameStarted', (roomState) => {
    if (!window.game) {
      window.game = new Phaser.Game(gameConfig);
    }
    uiManager.showScreen('gameScreen');
  });

  // This listener handles server error messages
  networkManager.on('serverError', (data) => {
    alert(`Server error: ${data.message}`);
  });
});

// Graceful disconnect on page unload
window.addEventListener('beforeunload', () => {
  if (window.networkManager && window.networkManager.socket) {
    window.networkManager.socket.disconnect();
  }
});

