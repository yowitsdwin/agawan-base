class UIManager {
  constructor() {
    this.elements = {
      loginScreen: document.getElementById('loginScreen'),
      gameScreen: document.getElementById('gameScreen'),
      gameOverScreen: document.getElementById('gameOverScreen'),
      usernameInput: document.getElementById('usernameInput'),
      joinGameBtn: document.getElementById('joinGameBtn'),
      redScore: document.getElementById('redScore'),
      blueScore: document.getElementById('blueScore'),
      timer: document.getElementById('timer'),
      redPlayers: document.getElementById('redPlayers').querySelector('ul'),
      bluePlayers: document.getElementById('bluePlayers').querySelector('ul'),
      chatMessages: document.getElementById('chatMessages'),
      messageInput: document.getElementById('messageInput'),
      sendMessageBtn: document.getElementById('sendMessageBtn'),
      chatType: document.getElementById('chatType'),
      gameOverTitle: document.getElementById('gameOverTitle'),
      gameOverStats: document.getElementById('gameOverStats'),
      playAgainBtn: document.getElementById('playAgainBtn'),
      actionFeedback: document.getElementById('actionFeedback'), // New UI element
    };
    this.feedbackTimeout = null;
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Login
    this.elements.joinGameBtn.addEventListener('click', () => {
      const username = this.elements.usernameInput.value.trim();
      if (username) {
        this.joinGame(username);
      }
    });
    this.elements.usernameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.elements.joinGameBtn.click();
      }
    });
    
    // Chat
    this.elements.sendMessageBtn.addEventListener('click', () => this.sendMessage());
    this.elements.messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendMessage();
      }
    });

    // Play again - reloads the page for a clean state
    this.elements.playAgainBtn.addEventListener('click', () => {
      window.location.reload();
    });
  }

  async joinGame(username) {
    try {
      if (!window.networkManager) {
        window.networkManager = new NetworkManager();
        await window.networkManager.connect();
      }
      window.networkManager.joinGame(username);
      this.showScreen('gameScreen');
      if (window.initializeGame) {
        window.initializeGame();
      }
    } catch (error) {
      console.error('Failed to join game:', error);
      alert('Failed to connect to the server. Please try again.');
    }
  }

  showScreen(screenName) {
    ['loginScreen', 'gameScreen', 'gameOverScreen'].forEach(id => {
      this.elements[id].classList.add('hidden');
    });
    this.elements[screenName].classList.remove('hidden');
  }

  updateScores(teamScores) {
    this.elements.redScore.textContent = teamScores.red || 0;
    this.elements.blueScore.textContent = teamScores.blue || 0;
  }

  updateTimer(timeRemaining) {
    const minutes = Math.floor(timeRemaining / 60000);
    const seconds = Math.floor((timeRemaining % 60000) / 1000);
    this.elements.timer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  updatePlayerList(players) {
    const redPlayers = players.filter(p => p.team === GAME_CONSTANTS.TEAMS.RED);
    const bluePlayers = players.filter(p => p.team === GAME_CONSTANTS.TEAMS.BLUE);
    
    this.elements.redPlayers.innerHTML = '';
    redPlayers.forEach(player => {
      const li = document.createElement('li');
      li.textContent = `${player.username} (${player.score})`;
      if (player.state === GAME_CONSTANTS.PLAYER_STATES.FROZEN) {
        li.classList.add('frozen');
        li.textContent += ' 🧊';
      }
      this.elements.redPlayers.appendChild(li);
    });

    this.elements.bluePlayers.innerHTML = '';
    bluePlayers.forEach(player => {
      const li = document.createElement('li');
      li.textContent = `${player.username} (${player.score})`;
      if (player.state === GAME_CONSTANTS.PLAYER_STATES.FROZEN) {
        li.classList.add('frozen');
        li.textContent += ' 🧊';
      }
      this.elements.bluePlayers.appendChild(li);
    });
  }

  addChatMessage(messageData) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${messageData.type} ${messageData.team || ''}`;
    const timestamp = new Date(messageData.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const typePrefix = messageData.type === 'team' ? '[TEAM] ' : '';
    
    messageDiv.innerHTML = `
      <span class="timestamp">[${timestamp}]</span>
      ${typePrefix}
      <span class="username">${this.escapeHtml(messageData.username)}:</span>
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
    }
  }

  showGameOver(gameOverData) {
    const { winner, finalScores, playerStats } = gameOverData;
    if (winner) {
      this.elements.gameOverTitle.textContent = `${winner.toUpperCase()} TEAM WINS!`;
      this.elements.gameOverTitle.className = winner === 'red' ? 'red-team' : 'blue-team';
    } else {
      this.elements.gameOverTitle.textContent = 'GAME TIED!';
      this.elements.gameOverTitle.className = '';
    }
    
    let statsHtml = `<div class="final-score">Final Score: <span class="red-team">${finalScores.red}</span> - <span class="blue-team">${finalScores.blue}</span></div><h3>Player Statistics</h3>`;
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

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // **NEW**: Method to show feedback messages
  showActionFeedback(message) {
    if (this.feedbackTimeout) {
      clearTimeout(this.feedbackTimeout);
    }
    const feedbackEl = this.elements.actionFeedback;
    feedbackEl.textContent = message;
    feedbackEl.classList.remove('hidden');
    this.feedbackTimeout = setTimeout(() => {
      feedbackEl.classList.add('hidden');
    }, 1500);
  }
}