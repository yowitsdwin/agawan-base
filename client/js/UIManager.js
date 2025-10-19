// client/js/UIManager.js
// Comprehensive UI management for all screens and features

class UIManager {
  constructor() {
    this.elements = this.initializeElements();
    this.currentLobbyId = null;
    this.isHost = false;
    this.setupEventListeners();
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
    // Main Menu
    this.elements.hostGameBtn.addEventListener('click', () => {
      const username = this.getUsername();
      if (username) {
        this.showScreen('hostSettingsScreen');
      }
    });

    this.elements.joinGameBtn.addEventListener('click', () => {
      const username = this.getUsername();
      if (username) {
        this.showScreen('joinLobbyScreen');
      }
    });

    // Join Lobby
    this.elements.confirmJoinBtn.addEventListener('click', () => this.handleJoinLobby());
    this.elements.backToMenuBtn.addEventListener('click', () => {
      this.showScreen('mainMenuScreen');
    });

    this.elements.lobbyCodeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleJoinLobby();
    });

    // Host Settings
    this.elements.createLobbyBtn.addEventListener('click', () => this.handleCreateLobby());
    this.elements.backToMenuFromHostBtn.addEventListener('click', () => {
      this.showScreen('mainMenuScreen');
    });

    // Lobby
    this.elements.copyLobbyCodeBtn.addEventListener('click', () => this.copyLobbyCode());
    this.elements.editSettingsBtn.addEventListener('click', () => this.showEditSettings());
    this.elements.changeTeamBtn.addEventListener('click', async () => {
      this.elements.changeTeamBtn.disabled = true;
      try {
        await window.networkManager.changeTeam();
      } catch (error) {
        console.error('Failed to change team:', error);
      } finally {
        setTimeout(() => {
          this.elements.changeTeamBtn.disabled = false;
        }, 500);
      }
    });

    this.elements.readyBtn.addEventListener('click', async () => {
      this.elements.readyBtn.disabled = true;
      try {
        await window.networkManager.playerReady();
      } catch (error) {
        console.error('Failed to toggle ready:', error);
      } finally {
        setTimeout(() => {
          this.elements.readyBtn.disabled = false;
        }, 500);
      }
    });

    this.elements.leaveLobbyBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to leave the lobby?')) {
        window.networkManager.disconnect();
        window.location.reload();
      }
    });

    // Game UI
    this.elements.toggleLeaderboardBtn.addEventListener('click', () => {
      this.elements.leaderboard.classList.toggle('hidden');
    });

    this.elements.chatToggleBtn.addEventListener('click', () => this.toggleChat());
    this.elements.sendMessageBtn.addEventListener('click', () => this.sendMessage());
    this.elements.messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });

    // Game Over
    this.elements.playAgainBtn.addEventListener('click', () => {
      window.networkManager.disconnect();
      window.location.reload();
    });

    this.elements.mainMenuBtn.addEventListener('click', () => {
      window.networkManager.disconnect();
      window.location.reload();
    });
  }

  // ==================== SCREEN MANAGEMENT ====================

  showScreen(screenName) {
    const screens = [
      'loadingScreen', 'mainMenuScreen', 'joinLobbyScreen',
      'hostSettingsScreen', 'lobbyScreen', 'gameScreen', 'gameOverScreen'
    ];

    screens.forEach(screen => {
      this.elements[screen].classList.add('hidden');
    });

    this.elements[screenName].classList.remove('hidden');
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
      this.showActionFeedback('Please enter a username (at least 2 characters)');
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
      this.showActionFeedback('Please enter a valid 6-character lobby code');
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
    
    // Show edit button only for host
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
      this.showActionFeedback('Lobby code copied to clipboard!');
    }).catch(() => {
      this.showActionFeedback('Failed to copy code');
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

      // Update host status
      this.isHost = (localPlayer.id === settings.hostId);
      if (this.isHost) {
        this.elements.editSettingsBtn.classList.remove('hidden');
      }
    }

    // Update settings display
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
      this.elements.messageInput.focus();
    }
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

    // Keep only last 50 messages
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
        // client/js/UIManager.js (continued)

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
  }

  // ==================== UTILITY METHODS ====================

  showActionFeedback(message, duration = 2000) {
    const feedback = document.createElement('div');
    feedback.className = 'action-feedback';
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
    closeBtn.addEventListener('click', () => {
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
    // Only host can edit settings
    if (!this.isHost) return;
    
    // Show a modal or navigate to settings
    // For simplicity, we can navigate back to host settings screen
    this.showActionFeedback('Settings can be changed in lobby creation');
  }
}