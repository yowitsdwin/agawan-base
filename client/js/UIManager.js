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
      playAgainBtn: document.getElementById('playAgainBtn')
    };
    
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
    this.elements.sendMessageBtn.addEventListener('click', () => {
      this.sendMessage();
    });
    
    this.elements.messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendMessage();
      }
    });
    
    // Play again
    this.elements.playAgainBtn.addEventListener('click', () => {
      this.showScreen('loginScreen');
    });
  }

  async joinGame(username) {
    try {
      // Connect to server
      if (!window.networkManager) {
        window.networkManager = new NetworkManager();
        await window.networkManager.connect();
      }
      
      // Join game
      window.networkManager.joinGame(username);
      
      // Switch to game screen
      this.showScreen('gameScreen');
      
      // Initialize game
      if (window.initializeGame) {
        window.initializeGame();
      }
      
    } catch (error) {
      console.error('Failed to join game:', error);
      alert('Failed to connect to server. Please try again.');
    }
  }

  showScreen(screenName) {
    Object.keys(this.elements).forEach(key => {
      if (key.endsWith('Screen')) {
        this.elements[key].classList.add('hidden');
      }
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
    this.elements.bluePlayers.innerHTML = '';
    
    redPlayers.forEach(player => {
      const li = document.createElement('li');
      li.textContent = `${player.username} (${player.score})`;
      if (player.state === GAME_CONSTANTS.PLAYER_STATES.FROZEN) {
        li.style.opacity = '0.5';
        li.textContent += ' 🧊';
      }
      this.elements.redPlayers.appendChild(li);
    });
    
    bluePlayers.forEach(player => {
      const li = document.createElement('li');
      li.textContent = `${player.username} (${player.score})`;
      if (player.state === GAME_CONSTANTS.PLAYER_STATES.FROZEN) {
        li.style.opacity = '0.5';
        li.textContent += ' 🧊';
      }
      this.elements.bluePlayers.appendChild(li);
    });
  }

  addChatMessage(messageData) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${messageData.type} ${messageData.team}`;
    
    const timestamp = new Date(messageData.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const typePrefix = messageData.type === 'team' ? '[TEAM] ' : '';
    
    messageDiv.innerHTML = `
      <span class="timestamp">[${timestamp}]</span>
      ${typePrefix}
      <span class="username">${messageData.username}:</span>
      <span class="message">${this.escapeHtml(messageData.message)}</span>
    `;
    
    this.elements.chatMessages.appendChild(messageDiv);
    this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    
    // Remove old messages (keep last 50)
    const messages = this.elements.chatMessages.children;
    if (messages.length > 50) {
      messages[0].remove();
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
    
    // Show winner
    if (winner) {
      this.elements.gameOverTitle.textContent = `${winner.toUpperCase()} TEAM WINS!`;
      this.elements.gameOverTitle.style.color = winner === 'red' ? '#ff4757' : '#5352ed';
    } else {
      this.elements.gameOverTitle.textContent = 'GAME TIED!';
      this.elements.gameOverTitle.style.color = '#333';
    }
    
    // Show stats
    let statsHtml = `
      <div class="winner-announcement">
        Final Score: Red ${finalScores.red} - ${finalScores.blue} Blue
      </div>
      <h3>Player Statistics</h3>
    `;
    
    playerStats.sort((a, b) => b.score - a.score).forEach(player => {
      statsHtml += `
        <div class="stat-row">
          <span style="color: ${player.team === 'red' ? '#ff4757' : '#5352ed'}">${player.username}</span>
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
}