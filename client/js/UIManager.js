// client/js/UIManager.js
// FIXED: Enhanced UI with proper error handling and score display

class UIManager {
  constructor() {
    this.elements = this.initializeElements();
    this.currentLobbyId = null;
    this.isHost = false;
    this.isMobile = this.isMobileDevice();
    this.touchStartTime = 0;
    this.setupEventListeners();
    this.setupMobileOptimizations();
    console.log('[UIManager] Initialized successfully');
  }

  isMobileDevice() {
    return window.matchMedia('(pointer: coarse) and (hover: none)').matches;
  }

  setupMobileOptimizations() {
    if (this.isMobile) {
      document.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) e.preventDefault();
      }, { passive: false });

      let lastTouchEnd = 0;
      document.addEventListener('touchend', (e) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) e.preventDefault();
        lastTouchEnd = now;
      }, false);

      document.body.addEventListener('touchmove', (e) => {
        if (e.touches.length > 1) e.preventDefault();
      }, { passive: false });

      this.setupHapticFeedback();
    }
  }

  setupHapticFeedback() {
    this.haptic = {
      light: () => navigator.vibrate && navigator.vibrate(10),
      medium: () => navigator.vibrate && navigator.vibrate(20),
      success: () => navigator.vibrate && navigator.vibrate([10, 50, 10])
    };
  }

  requestFullScreen() {
    const element = document.documentElement;
    if (element.requestFullscreen) {
      element.requestFullscreen().catch(err => console.error('[Fullscreen]', err));
    } else if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen().catch(err => console.error('[Fullscreen]', err));
    } else if (element.mozRequestFullScreen) {
      element.mozRequestFullScreen().catch(err => console.error('[Fullscreen]', err));
    } else if (element.msRequestFullscreen) {
      element.msRequestFullscreen().catch(err => console.error('[Fullscreen]', err));
    }
  }

  initializeElements() {
    const elements = {
      loadingScreen: document.getElementById('loadingScreen'),
      mainMenuScreen: document.getElementById('mainMenuScreen'),
      joinLobbyScreen: document.getElementById('joinLobbyScreen'),
      hostSettingsScreen: document.getElementById('hostSettingsScreen'),
      lobbyScreen: document.getElementById('lobbyScreen'),
      gameScreen: document.getElementById('gameScreen'),
      gameOverScreen: document.getElementById('gameOverScreen'),
      loadingStatus: document.getElementById('loadingStatus'),
      usernameInput: document.getElementById('usernameInput'),
      hostGameBtn: document.getElementById('hostGameBtn'),
      joinGameBtn: document.getElementById('joinGameBtn'),
      lobbyCodeInput: document.getElementById('lobbyCodeInput'),
      confirmJoinBtn: document.getElementById('confirmJoinBtn'),
      backToMenuBtn: document.getElementById('backToMenuBtn'),
      mapSelect: document.getElementById('mapSelect'),
      winningScoreSelect: document.getElementById('winningScoreSelect'),
      gameModeSelect: document.getElementById('gameModeSelect'),
      createLobbyBtn: document.getElementById('createLobbyBtn'),
      backToMenuFromHostBtn: document.getElementById('backToMenuFromHostBtn'),
      lobbyCodeDisplay: document.getElementById('lobbyCodeDisplay'),
      copyLobbyCodeBtn: document.getElementById('copyLobbyCodeBtn'),
      currentMap: document.getElementById('currentMap'),
      currentScore: document.getElementById('currentScore'),
      currentMode: document.getElementById('currentMode'),
      editSettingsBtn: document.getElementById('editSettingsBtn'),
      lobbyRedTeam: document.getElementById('lobbyRedTeam')?.querySelector('ul'),
      lobbyBlueTeam: document.getElementById('lobbyBlueTeam')?.querySelector('ul'),
      changeTeamBtn: document.getElementById('changeTeamBtn'),
      readyBtn: document.getElementById('readyBtn'),
      leaveLobbyBtn: document.getElementById('leaveLobbyBtn'),
      waitingMessage: document.getElementById('waitingMessage'),
      redScore: document.getElementById('redScore'),
      blueScore: document.getElementById('blueScore'),
      timer: document.getElementById('timer'),
      leaderboard: document.getElementById('leaderboard'),
      leaderboardContent: document.getElementById('leaderboardContent'),
      toggleLeaderboardBtn: document.getElementById('toggleLeaderboardBtn'),
      chatToggleBtn: document.getElementById('chatToggleBtn'),
      chatContainer: document.getElementById('chatContainer'),
      chatMessages: document.getElementById('chatMessages'),
      messageInput: document.getElementById('messageInput'),
      sendMessageBtn: document.getElementById('sendMessageBtn'),
      chatType: document.getElementById('chatType'),
      gameOverTitle: document.getElementById('gameOverTitle'),
      gameOverStats: document.getElementById('gameOverStats'),
      playAgainBtn: document.getElementById('playAgainBtn'),
      mainMenuBtn: document.getElementById('mainMenuBtn')
    };

    // Verify critical elements exist
    const critical = ['loadingScreen', 'mainMenuScreen', 'gameScreen'];
    critical.forEach(id => {
      if (!elements[id]) {
        console.error(`[UIManager] Critical element missing: ${id}`);
      }
    });

    return elements;
  }

  setupEventListeners() {
    const inputsToManage = [
      this.elements.usernameInput,
      this.elements.lobbyCodeInput,
      this.elements.messageInput
    ].filter(Boolean);

    inputsToManage.forEach(input => {
      input.addEventListener('focus', () => {
        if (window.game?.scene.isActive('GameScene')) {
          window.game.scene.getScene('GameScene').pauseKeyboard();
        }
        if (this.isMobile) {
          setTimeout(() => input.scrollIntoView({ 
            behavior: 'smooth', block: 'center' 
          }), 300);
        }
      });
      input.addEventListener('blur', () => {
        if (window.game?.scene.isActive('GameScene')) {
          window.game.scene.getScene('GameScene').resumeKeyboard();
        }
      });
    });

    // Main Menu
    this.addButtonListener(this.elements.hostGameBtn, () => {
      const username = this.getUsername();
      if (username) this.showScreen('hostSettingsScreen');
    });

    this.addButtonListener(this.elements.joinGameBtn, () => {
      const username = this.getUsername();
      if (username) this.showScreen('joinLobbyScreen');
    });

    // Join Lobby
    this.addButtonListener(this.elements.confirmJoinBtn, () => this.handleJoinLobby());
    this.addButtonListener(this.elements.backToMenuBtn, () => {
      this.showScreen('mainMenuScreen');
    });

    if (this.elements.lobbyCodeInput) {
      this.elements.lobbyCodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.elements.lobbyCodeInput.blur();
          this.handleJoinLobby();
        }
      });
    }

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
        console.error('[Change Team] Error:', error);
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
        console.error('[Ready] Error:', error);
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

    if (this.elements.messageInput) {
      this.elements.messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.elements.messageInput.blur();
          this.sendMessage();
        }
      });
    }

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

  addButtonListener(button, callback) {
    if (!button) return;

    const handleInteraction = (e) => {
      e.preventDefault();
      
      button.style.transform = 'scale(0.95)';
      setTimeout(() => button.style.transform = '', 150);

      if (this.isMobile) this.haptic.light();
      
      callback();
    };

    if (this.isMobile) {
      button.addEventListener('touchend', handleInteraction, { passive: false });
    } else {
      button.addEventListener('click', handleInteraction);
    }
  }

  showScreen(screenName) {
    const screens = [
      'loadingScreen', 'mainMenuScreen', 'joinLobbyScreen',
      'hostSettingsScreen', 'lobbyScreen', 'gameScreen', 'gameOverScreen'
    ];

    screens.forEach(screen => {
      if (this.elements[screen]) {
        this.elements[screen].style.opacity = '0';
        setTimeout(() => {
          this.elements[screen].classList.add('hidden');
        }, 300);
      }
    });

    setTimeout(() => {
      if (this.elements[screenName]) {
        this.elements[screenName].classList.remove('hidden');
        setTimeout(() => {
          this.elements[screenName].style.opacity = '1';
        }, 50);
      }
    }, 300);

    console.log(`[UIManager] Showing screen: ${screenName}`);
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
      console.error('[Server Check] Failed:', error);
      this.showError(
        'Unable to connect to the game server. Please try again later.',
        'Connection Error',
        () => window.location.reload()
      );
    }
  }

  getUsername() {
    const username = this.elements.usernameInput.value.trim();

    if (username.length < GAME_CONSTANTS.VALIDATION.USERNAME_MIN_LENGTH) {
      this.showActionFeedback(
        'Please enter a username (at least 2 characters)', 
        'warning'
      );
      return null;
    }

    return username;
  }

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
      console.log(`[Lobby] Created: ${result.lobbyId}`);
    } catch (error) {
      console.error('[Create Lobby] Error:', error);
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
      this.showActionFeedback(
        'Please enter a valid 6-character lobby code', 
        'warning'
      );
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
      console.log(`[Lobby] Joined: ${result.lobbyId}`);
    } catch (error) {
      console.error('[Join Lobby] Error:', error);
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

  updateGameUI(roomState) {
    this.updateScores(roomState.teamScores);
    this.updateTimer(roomState.timeRemaining);
    this.updateLeaderboard(roomState.leaderboard);
  }

  updateScores(teamScores) {
    if (!teamScores) {
      console.warn('[UIManager] No team scores provided');
      return;
    }
    this.elements.redScore.textContent = teamScores.red || 0;
    this.elements.blueScore.textContent = teamScores.blue || 0;
  }

  updateTimer(timeRemaining) {
    if (typeof timeRemaining !== 'number') return;
    
    const minutes = Math.floor(timeRemaining / 60000);
    const seconds = Math.floor((timeRemaining % 60000) / 1000).toString().padStart(2, '0');
    this.elements.timer.textContent = `${minutes}:${seconds}`;
  }

  updateLeaderboard(leaderboard) {
    if (!leaderboard || !Array.isArray(leaderboard)) return;

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
        <span class="player-score">${player.score || 0}</span>
      `;
      this.elements.leaderboardContent.appendChild(entry);
    });
  }

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
    if (!messageData) return;

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

  // FIXED: Improved game over display with proper null checks
  showGameOver(gameOverData) {
    if (!gameOverData) {
      console.error('[UIManager] No game over data provided');
      return;
    }

    console.log('[UIManager] Showing game over:', gameOverData);

    const { winner, reason, finalScores, playerStats } = gameOverData;

    // Update title
    if (winner) {
      this.elements.gameOverTitle.textContent = `${winner.toUpperCase()} TEAM WINS!`;
      this.elements.gameOverTitle.className = winner === 'red' ? 'red-team' : 'blue-team';
    } else {
      this.elements.gameOverTitle.textContent = 'GAME TIED!';
      this.elements.gameOverTitle.className = '';
    }

    // Build stats HTML
    let statsHtml = '';

    // Add reason
    if (reason) {
      statsHtml += `<p class="game-over-reason">${this.escapeHtml(reason)}</p>`;
    }

    // Add final scores
    if (finalScores) {
      statsHtml += `
        <div class="final-score">
          Final Score: 
          <span class="red-team">${finalScores.red || 0}</span> - 
          <span class="blue-team">${finalScores.blue || 0}</span>
        </div>
      `;
    }

    // Add player statistics
    if (playerStats && Array.isArray(playerStats) && playerStats.length > 0) {
      statsHtml += '<h3>Player Statistics</h3>';
      
      playerStats.sort((a, b) => (b.score || 0) - (a.score || 0)).forEach(player => {
        statsHtml += `
          <div class="stat-row">
            <span class="${player.team}-team">${this.escapeHtml(player.username)}</span>
            <span>Score: ${player.score || 0} | Tags: ${player.tags || 0} | Rescues: ${player.rescues || 0}</span>
          </div>
        `;
      });
    } else {
      statsHtml += '<p>No player statistics available</p>';
    }

    this.elements.gameOverStats.innerHTML = statsHtml;
    this.showScreen('gameOverScreen');

    if (this.isMobile) this.haptic.success();
  }

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
    console.error(`[Error] ${title}: ${message}`);
    
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
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showEditSettings() {
    if (!this.isHost) return;
    this.showActionFeedback('Settings can be changed in lobby creation', 'info');
  }
}