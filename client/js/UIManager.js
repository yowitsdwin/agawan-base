class UIManager {
  constructor() {
    this.elements = {
      // Screens
      loginScreen: document.getElementById('loginScreen'),
      lobbyScreen: document.getElementById('lobbyScreen'),
      gameScreen: document.getElementById('gameScreen'),
      gameOverScreen: document.getElementById('gameOverScreen'),

      // Login Controls
      usernameInput: document.getElementById('usernameInput'),
      joinGameBtn: document.getElementById('joinGameBtn'),

      // Lobby Controls
      lobbyRedTeam: document.getElementById('lobbyRedTeam').querySelector('ul'),
      lobbyBlueTeam: document.getElementById('lobbyBlueTeam').querySelector('ul'),
      changeTeamBtn: document.getElementById('changeTeamBtn'),
      readyBtn: document.getElementById('readyBtn'),

      // Game UI
      redScore: document.getElementById('redScore'),
      blueScore: document.getElementById('blueScore'),
      timer: document.getElementById('timer'),

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
      playAgainBtn: document.getElementById('playAgainBtn')
    };

    this.setupEventListeners();
  }

  setupEventListeners() {
    // Login
    this.elements.joinGameBtn.addEventListener('click', () => {
      const username = this.elements.usernameInput.value.trim();
      if (username) this.joinGame(username);
    });
    this.elements.usernameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.elements.joinGameBtn.click();
    });

    // Lobby
    this.elements.changeTeamBtn.addEventListener('click', () => window.networkManager.changeTeam());
    this.elements.readyBtn.addEventListener('click', () => window.networkManager.playerReady());

    // Chat
    this.elements.chatToggleBtn.addEventListener('click', () => this.toggleChat());
    this.elements.sendMessageBtn.addEventListener('click', () => this.sendMessage());
    this.elements.messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });

    // Game Over
    this.elements.playAgainBtn.addEventListener('click', () => window.location.reload());
  }

  async joinGame(username) {
    try {
      if (!window.networkManager) {
        window.networkManager = new NetworkManager();
        await window.networkManager.connect();
      }
      window.networkManager.joinGame(username);
      this.showScreen('lobbyScreen');
    } catch (error) {
      console.error('Failed to join game:', error);
      alert('Failed to connect to the server. Please try again.');
    }
  }

  showScreen(screenName) {
    ['loginScreen', 'lobbyScreen', 'gameScreen', 'gameOverScreen'].forEach(id => {
      this.elements[id].classList.add('hidden');
    });
    this.elements[screenName].classList.remove('hidden');
  }

  // Update the lobby UI based on the room state from the server
  updateLobby(roomState) {
    const { players } = roomState;
    this.elements.lobbyRedTeam.innerHTML = '';
    this.elements.lobbyBlueTeam.innerHTML = '';

    players.forEach(player => {
      const li = document.createElement('li');
      li.textContent = player.username;
      if (player.isReady) li.classList.add('ready');
      
      const listElement = player.team === 'red' ? this.elements.lobbyRedTeam : this.elements.lobbyBlueTeam;
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
    }
  }

  updateGameUI(roomState) {
    this.updateScores(roomState.teamScores);
    this.updateTimer(roomState.timeRemaining);
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

  toggleChat() {
    this.elements.chatContainer.classList.toggle('hidden');
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
    const { winner, reason, finalScores, playerStats } = gameOverData;
    if (winner) {
      this.elements.gameOverTitle.textContent = `${winner.toUpperCase()} TEAM WINS!`;
      this.elements.gameOverTitle.className = winner === 'red' ? 'red-team' : 'blue-team';
    } else {
      this.elements.gameOverTitle.textContent = 'GAME TIED!';
      this.elements.gameOverTitle.className = '';
    }

    let statsHtml = `<p class="game-over-reason">${this.escapeHtml(reason)}</p>
                     <div class="final-score">Final Score: <span class="red-team">${finalScores.red}</span> - <span class="blue-team">${finalScores.blue}</span></div>
                     <h3>Player Statistics</h3>`;
                     
    playerStats.sort((a, b) => b.score - a.score).forEach(player => {
      statsHtml += `
        <div class="stat-row">
          <span class="${player.team}-team">${this.escapeHtml(player.username)}</span>
          <span>Score: ${player.score} | Tags: ${player.tags} | Rescues: ${player.rescues}</span>
        </div>`;
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

