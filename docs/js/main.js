// client/js/main.js
// Main application entry point with AudioContext fix

window.game = null;
window.networkManager = null;
window.uiManager = null;

const gameConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: 'gameCanvas',
  backgroundColor: '#2d3436',
  audio: {
    disableWebAudio: false, // Enable Web Audio
    noAudio: false
  },
  physics: {
    default: 'arcade',
    arcade: { 
      gravity: { y: 0 },
      debug: false
    }
  },
  scene: GameScene,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  // CRITICAL: Fix AudioContext must be resumed after user interaction
  callbacks: {
    preBoot: function (game) {
      // Prevent AudioContext warning by handling it properly
      game.sound.unlock();
    }
  }
};

// Resume AudioContext on first user interaction
function resumeAudioContext() {
  if (window.game && window.game.sound && window.game.sound.context) {
    const audioContext = window.game.sound.context;
    if (audioContext.state === 'suspended') {
      audioContext.resume().then(() => {
        console.log('[Audio] AudioContext resumed successfully');
      }).catch(err => {
        console.warn('[Audio] Failed to resume AudioContext:', err);
      });
    }
  }
}

// Add event listeners for user interaction to resume audio
const userInteractionEvents = ['click', 'touchstart', 'keydown'];
userInteractionEvents.forEach(event => {
  document.addEventListener(event, resumeAudioContext, { once: true });
});

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

  if (!window.game) {
    console.log('[Main] Creating Phaser game instance...');
    window.game = new Phaser.Game(gameConfig);
    
    // Ensure audio context is handled
    window.game.events.once('ready', () => {
      console.log('[Phaser] Game ready');
      resumeAudioContext();
    });
  }

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
      
      // If we are on the game over screen, switch to the lobby screen
      if (!window.uiManager.elements.gameOverScreen.classList.contains('hidden')) {
        window.uiManager.showScreen('lobbyScreen');
      }

      window.uiManager.updateLobby(roomState);
    } else if (roomState.gameState === GAME_CONSTANTS.GAME_STATES.PLAYING) {
      // Only update UI, GameScene will handle its own updates
      window.uiManager.updateGameUI(roomState);
    }
  });

  window.networkManager.on('gameStarted', (roomState) => {
    console.log('[Main] gameStarted event caught.');
    
    // Resume audio context when game starts
    resumeAudioContext();
    
    // Trigger fullscreen on game start for mobile
    if (window.uiManager && window.uiManager.isMobile) {
      window.uiManager.requestFullScreen();
    }

    // Store the roomState for the scene to pick up
    window.pendingGameStart = roomState;

    // Switch UI to game screen
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
    window.uiManager.showActionFeedback(message, 'error', 3000);
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
  if (event.error && event.error.message) {
    const ignoredErrors = [
      'ResizeObserver',
      'AudioContext',
      'was not allowed to start'
    ];
    
    if (ignoredErrors.some(err => event.error.message.includes(err))) {
      console.warn('[Non-critical error]:', event.error.message);
      event.preventDefault();
      return;
    }
  }
});

// Suppress AudioContext warnings
const originalWarn = console.warn;
console.warn = function(...args) {
  const message = args.join(' ');
  if (message.includes('AudioContext') || message.includes('was not allowed to start')) {
    // Suppress AudioContext warnings - we handle them properly
    return;
  }
  originalWarn.apply(console, args);
};

console.log('📱 Controls: WASD/Arrow Keys to move, SPACE to rescue');
console.log('💬 Chat: Click chat button to open/close');
console.log('🏆 Leaderboard: Click trophy button to view');