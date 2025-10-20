// client/js/UIManager.js
// Enhanced UI management with improved mobile experience

class UIManager {
  constructor() {
    this.elements = this.initializeElements();
    this.currentLobbyId = null;
    this.isHost = false;
    this.isMobile = this.isMobileDevice();
    this.touchStartTime = 0;
    this.setupEventListeners();
    this.setupMobileOptimizations();
  }

  isMobileDevice() {
    return window.matchMedia('(pointer: coarse) and (hover: none)').matches;
  }

  setupMobileOptimizations() {
    if (this.isMobile) {
      // Prevent double-tap zoom
      document.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) {
          e.preventDefault();
        }
      }, { passive: false });

      let lastTouchEnd = 0;
      document.addEventListener('touchend', (e) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
          e.preventDefault();
        }
        lastTouchEnd = now;
      }, false);

      // Prevent pull-to-refresh
      document.body.addEventListener('touchmove', (e) => {
        if (e.touches.length > 1) {
          e.preventDefault();
        }
      }, { passive: false });

      // Add haptic feedback support
      this.setupHapticFeedback();
    }
  }

  setupHapticFeedback() {
    // Light haptic feedback for button interactions
    this.haptic = {
      light: () => {
        if (navigator.vibrate) {
          navigator.vibrate(10);
        }
      },
      medium: () => {
        if (navigator.vibrate) {
          navigator.vibrate(20);
        }
      },
      success: () => {
        if (navigator.vibrate) {
          navigator.vibrate([10, 50, 10]);
        }
      }
    };
  }

  requestFullScreen() {
    const element = document.documentElement;
    if (element.requestFullscreen) {
      element.requestFullscreen().catch(err => console.error(err));
    } else if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen().catch(err => console.error(err));
    } else if (element.mozRequestFullScreen) {
      element.mozRequestFullScreen().catch(err => console.error(err));
    } else if (element.msRequestFullscreen) {
      element.msRequestFullscreen().catch(err => console.error(err));
    }
  }

  initializeElements() {
    return {
      // Screens
      loadingScreen: document.getElementById('loadingScreen'),
      mainMenuScreen: document.getElementById('mainMenuScreen'),
      joinLobbyScreen: document.getElementById('joinLobbyScreen'),
      hostSettingsScreen: document.getElementById('hostSettingsScreen'),
      lobbyScreen: document.getElementById('lobbyScreen'),
      gameScreen: document.getElementById('gameScreen'),
      gameOverScreen: document.getElementById('gameOverScreen'),
      // Loading
      loadingStatus: document.getElementById('loadingStatus'),
      // Main Menu
      usernameInput: document.getElementById('usernameInput'),
      hostGameBtn: document.getElementById('hostGameBtn'),
      joinGameBtn: document.getElementById('joinGameBtn'),
      // Join Lobby
      lobbyCodeInput: document.getElementById('lobbyCodeInput'),
      confirmJoinBtn: document.getElementById('confirmJoinBtn'),
      backToMenuBtn: document.getElementById('backToMenuBtn'),
      // Host Settings
      mapSelect: document.getElementById('mapSelect'),
      winningScoreSelect: document.getElementById('winningScoreSelect'),
      gameModeSelect: document.getElementById('gameModeSelect'),
      createLobbyBtn: document.getElementById('createLobbyBtn'),
      backToMenuFromHostBtn: document.getElementById('backToMenuFromHostBtn'),
      // Lobby
      lobbyCodeDisplay: document.getElementById('lobbyCodeDisplay'),
      copyLobbyCodeBtn: document.getElementById('copyLobbyCodeBtn'),
      currentMap: document.getElementById('currentMap'),
      currentScore: document.getElementById('currentScore'),
      currentMode: document.getElementById('currentMode'),
      editSettingsBtn: document.getElementById('editSettingsBtn'),
      lobbyRedTeam: document.getElementById('lobbyRedTeam').querySelector('ul'),
      lobbyBlueTeam: document.getElementById('lobbyBlueTeam').querySelector('ul'),
      changeTeamBtn: document.getElementById('changeTeamBtn'),
      readyBtn: document.getElementById('readyBtn'),
      leaveLobbyBtn: document.getElementById('leaveLobbyBtn'),
      waitingMessage: document.getElementById('waitingMessage'),
      // Game UI
      redScore: document.getElementById('redScore'),
      blueScore: document.getElementById('blueScore'),
      timer: document.getElementById('timer'),
      leaderboard: document.getElementById('leaderboard'),
      leaderboardContent: document.getElementById('leaderboardContent'),
      toggleLeaderboardBtn: document.getElementById('toggleLeaderboardBtn'),
      // Chat
      chatToggleBtn: document.getElementById('chatToggleBtn'),
      chatContainer: document.getElementById('chatContainer'),
      chatMessages: document.getElementById('chatMessages'),
      messageInput: document.getElementById('messageInput'),
      sendMessageBtn: document.getElementById('sendMessageBtn'),
      chatType: document.getElementById('chatType'),
      // Game Over
      gameOverTitle: document.getElementById('gameOverTitle'),
      gameOverStats: document.getElementById('gameOverStats'),
      playAgainBtn: document.getElementById('playAgainBtn'),
      mainMenuBtn: document.getElementById('mainMenuBtn')
    };
  }

  setupEventListeners() {
    const inputsToManage = [
      this.elements.usernameInput,
      this.elements.lobbyCodeInput,
      this.elements.messageInput
    ];

    inputsToManage.forEach(input => {
      if (input) {
        input.addEventListener('focus', () => {
          if (window.game && window.game.scene.isActive('GameScene')) {
            window.game.scene.getScene('GameScene').pauseKeyboard();
          }
          // Scroll input into view on mobile
          if (this.isMobile) {
            setTimeout(() => input.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
          }
        });
        input.addEventListener('blur', () => {
          if (window.game && window.game.scene.isActive('GameScene')) {
            window.game.scene.getScene('GameScene').resumeKeyboard();
          }
        });
      }
    });

    // Main Menu with improved button handling
    this.addButtonListener(this.elements.hostGameBtn, () => {
      const username = this.getUsername();
      if (username) {
        // Fullscreen request removed, will be handled by main.js
        this.showScreen('hostSettingsScreen');
      }
    });
    this.addButtonListener(this.elements.joinGameBtn, () => {
      const username = this.getUsername();
      if (username) {
        // Fullscreen request removed, will be handled by main.js
        this.showScreen('joinLobbyScreen');
      }
    });

    // Join Lobby
    this.addButtonListener(this.elements.confirmJoinBtn, () => this.handleJoinLobby());
    this.addButtonListener(this.elements.backToMenuBtn, () => {
      this.showScreen('mainMenuScreen');
    });

    this.elements.lobbyCodeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.elements.lobbyCodeInput.blur();
        this.handleJoinLobby();
      }
    });

    // Host Settings
    this.addButtonListener(this.elements.createLobbyBtn, () => this.handleCreateLobby());
    this.addButtonListener(this.elements.backToMenuFromHostBtn, () => {
      this.showScreen('mainMenuScreen');
    });

    // Lobby
    this.addButtonListener(this.elements.copyLobbyCodeBtn, () => this.copyLobbyCode());
    this.addButtonListener(this.elements.editSettingsBtn, () => this.showEditSettings());

    this.addButtonListener(this.elements.changeTeamBtn, async () => {
      this.elements.changeTeamBtn.disabled = true;
      try {
        await window.networkManager.changeTeam();
        if (this.isMobile) this.haptic.light();
      } catch (error) {
        console.error('Failed to change team:', error);
      } finally {
        setTimeout(() => {
          this.elements.changeTeamBtn.disabled = false;
        }, 500);
      }
    });

    this.addButtonListener(this.elements.readyBtn, async () => {
      this.elements.readyBtn.disabled = true;
      try {
        await window.networkManager.playerReady();
        if (this.isMobile) this.haptic.medium();
      } catch (error) {
        console.error('Failed to toggle ready:', error);
      } finally {
        setTimeout(() => {
          this.elements.readyBtn.disabled = false;
        }, 500);
      }
    });

    this.addButtonListener(this.elements.leaveLobbyBtn, () => {
      if (confirm('Are you sure you want to leave the lobby?')) {
        window.networkManager.disconnect();
        window.location.reload();
      }
    });

    // Game UI
    this.addButtonListener(this.elements.toggleLeaderboardBtn, () => {
      this.elements.leaderboard.classList.toggle('hidden');
      if (this.isMobile) this.haptic.light();
    });

    this.addButtonListener(this.elements.chatToggleBtn, () => this.toggleChat());
    this.addButtonListener(this.elements.sendMessageBtn, () => this.sendMessage());

    this.elements.messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.elements.messageInput.blur();
        this.sendMessage();
      }
    });

    // Game Over
    this.addButtonListener(this.elements.playAgainBtn, () => {
      this.showScreen('lobbyScreen');
      if (this.isMobile) this.haptic.success();
    });
    this.addButtonListener(this.elements.mainMenuBtn, () => {
      window.networkManager.disconnect();
      window.location.reload();
    });
  }

  // **FIXED** Enhanced button listener with visual/haptic feedback and correct touch handling
  addButtonListener(button, callback) {
    if (!button) return;

    const handleInteraction = (e) => {
      // preventDefault is crucial on touch events
      e.preventDefault(); 
      
      // Visual feedback
      button.style.transform = 'scale(0.95)';
      setTimeout(() => {
        button.style.transform = '';
      }, 150);

      // Haptic feedback on mobile
      if (this.isMobile) {
        this.haptic.light();
      }
      
      // Execute callback
      callback();
    };

    if (this.isMobile) {
      // On mobile, use touchend for an immediate response
      // and to allow us to prevent the ghost 'click' event.
      button.addEventListener('touchend', handleInteraction, { passive: false });
    } else {
      // On desktop, just use the standard click event
      button.addEventListener('click', handleInteraction);
    }
  }

  // ==================== SCREEN MANAGEMENT ====================

  showScreen(screenName) {
    const screens = [
      'loadingScreen', 'mainMenuScreen', 'joinLobbyScreen',
      'hostSettingsScreen', 'lobbyScreen', 'gameScreen', 'gameOverScreen'
    ];

    // Smooth transition
    screens.forEach(screen => {
      if (this.elements[screen]) {
        this.elements[screen].style.opacity = '0';
        setTimeout(() => {
          this.elements[screen].classList.add('hidden');
        }, 300);
      }
    });

    // Show new screen
    setTimeout(() => {
      if (this.elements[screenName]) {
        this.elements[screenName].classList.remove('hidden');
        setTimeout(() => {
          this.elements[screenName].style.opacity = '1';
        }, 50);
      }
    }, 300);
  }

  async checkServerAndShowMenu() {
    this.elements.loadingStatus.textContent = 'Checking server availability...';

    try {
      const status = await window.networkManager.checkServerAvailability();

      if (status.available) {
        this.elements.loadingStatus.textContent = 'Server ready! Connecting...';
        await window.networkManager.connect();
        this.showScreen('mainMenuScreen');
      } else {
        throw new Error('Server unavailable');
      }
    } catch (error) {
      this.showError(
        'Unable to connect to the game server. Please try again later.',
        'Connection Error',
        () => window.location.reload()
      );
    }
  }

  // ==================== USERNAME HANDLING ====================

  getUsername() {
    const username = this.elements.usernameInput.value.trim();

    if (username.length < GAME_CONSTANTS.VALIDATION.USERNAME_MIN_LENGTH) {
      this.showActionFeedback('Please enter a username (at least 2 characters)', 'warning');
      return null;
    }

    return username;
  }

  // ==================== LOBBY HANDLING ====================

  async handleCreateLobby() {
    const username = this.getUsername();
    if (!username) return;

    const settings = {
      map: this.elements.mapSelect.value,
      winningScore: parseInt(this.elements.winningScoreSelect.value),
      gameMode: this.elements.gameModeSelect.value
    };

    this.elements.createLobbyBtn.disabled = true;
    this.elements.createLobbyBtn.textContent = 'Creating...';

    try {
      const result = await window.networkManager.createLobby(username, settings);
      this.currentLobbyId = result.lobbyId;
      this.isHost = true;
      this.showScreen('lobbyScreen');
      this.updateLobbyDisplay(result.lobbyId, result.roomState.settings);
      if (this.isMobile) this.haptic.success();
    } catch (error) {
      this.showError(error.message, 'Failed to Create Lobby');
    } finally {
      this.elements.createLobbyBtn.disabled = false;
      this.elements.createLobbyBtn.textContent = 'Create Lobby';
    }
  }

  async handleJoinLobby() {
    const username = this.getUsername();
    if (!username) return;

    const lobbyCode = this.elements.lobbyCodeInput.value.trim().toUpperCase();

    if (lobbyCode.length !== GAME_CONSTANTS.LOBBY.ID_LENGTH) {
      this.showActionFeedback('Please enter a valid 6-character lobby code', 'warning');
      return;
    }

    this.elements.confirmJoinBtn.disabled = true;
    this.elements.confirmJoinBtn.textContent = 'Joining...';

    try {
      const result = await window.networkManager.joinLobby(username, lobbyCode);
      this.currentLobbyId = result.lobbyId;
      this.isHost = false;
      this.showScreen('lobbyScreen');
      this.updateLobbyDisplay(result.lobbyId, result.roomState.settings);
      if (this.isMobile) this.haptic.success();
    } catch (error) {
      this.showError(error.message, 'Failed to Join Lobby');
    } finally {
      this.elements.confirmJoinBtn.disabled = false;
      this.elements.confirmJoinBtn.textContent = 'Join';
    }
  }

  updateLobbyDisplay(lobbyId, settings) {
    this.elements.lobbyCodeDisplay.textContent = lobbyId;
    this.updateLobbySettings(settings);

    if (this.isHost) {
      this.elements.editSettingsBtn.classList.remove('hidden');
    } else {
      this.elements.editSettingsBtn.classList.add('hidden');
    }
  }

  updateLobbySettings(settings) {
    const mapNames = {
      classic: 'Classic Field',
      forest: 'Forest Arena',
      desert: 'Desert Wasteland'
    };

    const modeNames = {
      day: 'Day',
      night: 'Night'
    };

    this.elements.currentMap.textContent = mapNames[settings.map] || settings.map;
    this.elements.currentScore.textContent = settings.winningScore;
    this.elements.currentMode.textContent = modeNames[settings.gameMode] || settings.gameMode;
  }

  copyLobbyCode() {
    const code = this.elements.lobbyCodeDisplay.textContent;
    navigator.clipboard.writeText(code).then(() => {
      this.showActionFeedback('Lobby code copied!', 'success');
      if (this.isMobile) this.haptic.success();
    }).catch(() => {
      this.showActionFeedback('Failed to copy code', 'error');
    });
  }

  updateLobby(roomState) {
    const { players, settings } = roomState;

    this.elements.lobbyRedTeam.innerHTML = '';
    this.elements.lobbyBlueTeam.innerHTML = '';

    players.forEach(player => {
      const li = document.createElement('li');
      li.textContent = player.username;

      if (player.isReady) {
        li.classList.add('ready');
      }

      const listElement = player.team === 'red' ?
        this.elements.lobbyRedTeam : this.elements.lobbyBlueTeam;
      listElement.appendChild(li);
    });

    const localPlayer = players.find(p => p.id === window.networkManager.socket.id);
    if (localPlayer) {
      if (localPlayer.isReady) {
        this.elements.readyBtn.classList.add('ready-active');
        this.elements.readyBtn.textContent = 'Unready';
      } else {
        this.elements.readyBtn.classList.remove('ready-active');
        this.elements.readyBtn.textContent = 'Ready';
      }
      this.isHost = (localPlayer.id === settings.hostId);
      if (this.isHost) {
        this.elements.editSettingsBtn.classList.remove('hidden');
      }
    }
    this.updateLobbySettings(settings);
  }

  // ==================== GAME UI ====================

  updateGameUI(roomState) {
    this.updateScores(roomState.teamScores);
    this.updateTimer(roomState.timeRemaining);
    this.updateLeaderboard(roomState.leaderboard);
  }

  updateScores(teamScores) {
    this.elements.redScore.textContent = teamScores.red || 0;
    this.elements.blueScore.textContent = teamScores.blue || 0;
  }

  updateTimer(timeRemaining) {
    const minutes = Math.floor(timeRemaining / 60000);
    const seconds = Math.floor((timeRemaining % 60000) / 1000).toString().padStart(2, '0');
    this.elements.timer.textContent = `${minutes}:${seconds}`;
  }

  updateLeaderboard(leaderboard) {
    this.elements.leaderboardContent.innerHTML = '';

    leaderboard.forEach((player, index) => {
      const entry = document.createElement('div');
      entry.className = 'leaderboard-entry';

      if (player.id === window.networkManager.socket.id) {
        entry.classList.add('local-player');
      }
      const rank = index + 1;
      const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
      entry.innerHTML = `
        <span class="player-rank">${rankEmoji}</span>
        <span class="player-name ${player.team}-team">${this.escapeHtml(player.username)}</span>
        <span class="player-score">${player.score}</span>
      `;
      this.elements.leaderboardContent.appendChild(entry);
    });
  }

  // ==================== CHAT ====================

  toggleChat() {
    this.elements.chatContainer.classList.toggle('hidden');
    if (!this.elements.chatContainer.classList.contains('hidden')) {
      if (!this.isMobile) {
        this.elements.messageInput.focus();
      }
    }
    if (this.isMobile) this.haptic.light();
  }

  addChatMessage(messageData) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${messageData.type}`;

    const timestamp = new Date(messageData.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
    const typePrefix = messageData.type === 'team' ? '[TEAM] ' : '';
    messageDiv.innerHTML = `
      <span class="timestamp">[${timestamp}]</span>
      ${typePrefix}
      <span class="username ${messageData.team}">${this.escapeHtml(messageData.username)}:</span>
      <span class="message">${this.escapeHtml(messageData.message)}</span>
    `;
    this.elements.chatMessages.appendChild(messageDiv);
    this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    while (this.elements.chatMessages.children.length > 50) {
      this.elements.chatMessages.children[0].remove();
    }
  }

  sendMessage() {
    const message = this.elements.messageInput.value.trim();
    const type = this.elements.chatType.value;

    if (message && window.networkManager) {
      window.networkManager.sendChatMessage(message, type);
      this.elements.messageInput.value = '';
      if (this.isMobile) {
        this.elements.messageInput.blur();
        this.haptic.light();
      }
    }
  }

  // ==================== GAME OVER ====================

  showGameOver(gameOverData) {
    const { winner, reason, finalScores, playerStats } = gameOverData;

    if (winner) {
      this.elements.gameOverTitle.textContent = `${winner.toUpperCase()} TEAM WINS!`;
      this.elements.gameOverTitle.className = winner === 'red' ? 'red-team' : 'blue-team';
    } else {
      this.elements.gameOverTitle.textContent = 'GAME TIED!';
      this.elements.gameOverTitle.className = '';
    }
    let statsHtml = `
      <p class="game-over-reason">${this.escapeHtml(reason)}</p>
      <div class="final-score">
        Final Score: 
        <span class="red-team">${finalScores.red}</span> - 
        <span class="blue-team">${finalScores.blue}</span>
      </div>
      <h3>Player Statistics</h3>
    `;

    playerStats.sort((a, b) => b.score - a.score).forEach(player => {
      statsHtml += `
        <div class="stat-row">
          <span class="${player.team}-team">${this.escapeHtml(player.username)}</span>
          <span>Score: ${player.score} | Tags: ${player.tags} | Rescues: ${player.rescues}</span>
        </div>
      `;
    });

    this.elements.gameOverStats.innerHTML = statsHtml;
    this.showScreen('gameOverScreen');

    if (this.isMobile) this.haptic.success();
  }

  // ==================== UTILITY METHODS ====================

  showActionFeedback(message, type = 'info', duration = 2000) {
    const feedback = document.createElement('div');
    feedback.className = `action-feedback ${type}`;
    feedback.textContent = message;
    document.body.appendChild(feedback);

    setTimeout(() => {
      if (feedback.parentNode) {
        feedback.parentNode.removeChild(feedback);
      }
    }, duration);
  }

  showError(message, title = 'Error', onClose = null) {
    const errorOverlay = document.createElement('div');
    errorOverlay.className = 'error-overlay';
    errorOverlay.innerHTML = `
      <div class="error-dialog">
        <h2>${this.escapeHtml(title)}</h2>
        <p>${this.escapeHtml(message)}</p>
        <button class="primary-btn" id="errorCloseBtn">OK</button>
      </div>
    `;

    document.body.appendChild(errorOverlay);

    const closeBtn = errorOverlay.querySelector('#errorCloseBtn');
    this.addButtonListener(closeBtn, () => {
      document.body.removeChild(errorOverlay);
      if (onClose) onClose();
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showEditSettings() {
    if (!this.isHost) return;
    this.showActionFeedback('Settings can be changed in lobby creation', 'info');
  }
}