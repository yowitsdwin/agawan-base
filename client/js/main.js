// client/js/main.js
// Main application entry point with initialization

window.game = null;
window.networkManager = null;
window.uiManager = null;

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
      debug: false // Set to true for debugging physics
    }
  },
  scene: GameScene,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🎮 Agawan Base - Enhanced Edition');
  console.log('Initializing game client...');

  // Initialize managers
  window.uiManager = new UIManager();
  window.networkManager = new NetworkManager();

  // Check server availability and connect
  await window.uiManager.checkServerAndShowMenu();

  // Setup network event listeners
  setupNetworkEvents();

  console.log('✅ Client initialization complete');
});

function setupNetworkEvents() {
  // Lobby events
  window.networkManager.on('lobbySettingsChanged', (settings) => {
    window.uiManager.updateLobbySettings(settings);
  });

  window.networkManager.on('hostChanged', (data) => {
    window.uiManager.showActionFeedback(
      `${data.newHostUsername} is now the host`
    );
  });

  window.networkManager.on('playerJoined', (data) => {
    window.uiManager.showActionFeedback(
      `${data.username} joined the lobby`
    );
  });

  window.networkManager.on('playerLeft', (data) => {
    window.uiManager.showActionFeedback(
      `${data.username} left the lobby`
    );
  });

  // Room state updates
  window.networkManager.on('roomStateUpdate', (roomState) => {
    if (roomState.gameState === GAME_CONSTANTS.GAME_STATES.LOBBY) {
      window.uiManager.updateLobby(roomState);
    } else if (roomState.gameState === GAME_CONSTANTS.GAME_STATES.PLAYING) {
      window.uiManager.updateGameUI(roomState);
    }
  });
  
  // Game start
  window.networkManager.on('gameStarted', (roomState) => {
    if (!window.game) {
      window.game = new Phaser.Game(gameConfig);
    }
    window.uiManager.showScreen('gameScreen');
  });

  // Chat messages
  window.networkManager.on('chatMessage', (messageData) => {
    window.uiManager.addChatMessage(messageData);
  });

  // Error handling
  window.networkManager.on('serverError', (data) => {
    console.error('[Server Error]:', data);
    
    const errorMessages = {
      LOBBY_FULL: 'This lobby is full. Please try another lobby.',
      LOBBY_NOT_FOUND: 'Lobby not found. Please check the code and try again.',
      GAME_IN_PROGRESS: 'This game is already in progress.',
      NOT_HOST: 'Only the host can change these settings.',
      INVALID_LOBBY_CODE: 'Please enter a valid 6-character lobby code.'
    };

    const message = errorMessages[data.code] || data.message || 'An error occurred';
    window.uiManager.showActionFeedback(message, 3000);
  });

  // Connection lost handling
  window.networkManager.on('disconnect', () => {
    console.warn('[Network] Connection lost');
    window.uiManager.showError(
      'Lost connection to the server. The page will reload.',
      'Connection Lost',
      () => window.location.reload()
    );
  });
}

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    console.log('[Visibility] Page hidden');
  } else {
    console.log('[Visibility] Page visible');
    // Could implement reconnection logic here if needed
  }
});

// Graceful disconnect on page unload
window.addEventListener('beforeunload', () => {
  if (window.networkManager && window.networkManager.socket) {
    window.networkManager.disconnect();
  }
});

// Handle window resize for responsive gameplay
window.addEventListener('resize', () => {
  if (window.game) {
    window.game.scale.resize(window.innerWidth, window.innerHeight);
  }
});

// Prevent accidental page refresh during gameplay
window.addEventListener('beforeunload', (e) => {
  if (window.game && window.networkManager && 
      window.networkManager.currentLobbyId) {
    e.preventDefault();
    e.returnValue = 'Are you sure you want to leave? Your game progress will be lost.';
    return e.returnValue;
  }
});

// Global error handler
window.addEventListener('error', (event) => {
  console.error('[Global Error]:', event.error);
  
  // Don't crash the entire app on non-critical errors
  if (event.error && event.error.message && 
      !event.error.message.includes('ResizeObserver')) {
    // Log error but continue
    console.error('Non-critical error caught:', event.error);
  }
});

// Add CSS for error overlay dynamically
const errorStyles = document.createElement('style');
errorStyles.textContent = `
  .error-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  }

  .error-dialog {
    background: rgba(40, 40, 40, 0.95);
    padding: 40px;
    border-radius: 16px;
    text-align: center;
    max-width: 500px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
    border: 1px solid rgba(255, 77, 87, 0.5);
  }

  .error-dialog h2 {
    color: #ff4757;
    margin-top: 0;
  }

  .error-dialog p {
    color: #ccc;
    margin: 20px 0;
  }
`;
document.head.appendChild(errorStyles);

console.log('📱 Controls: WASD/Arrow Keys to move, SPACE to rescue');
console.log('💬 Chat: Click chat button to open/close');
console.log('🏆 Leaderboard: Click trophy button to view');