class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.players = new Map();
    this.localPlayer = null;
    this.powerups = new Map();
    this.controls = null;
  }

  preload() {
    // Programmatically create textures to avoid loading assets
    this.createColoredTextures();
  }

  createColoredTextures() {
    const size = GAME_CONSTANTS.GAME_CONFIG.PLAYER_SIZE;
    // Red player
    this.add.graphics().fillStyle(0xff4757).fillRect(0, 0, size, size).generateTexture('redPlayer', size, size).destroy();
    // Blue player
    this.add.graphics().fillStyle(0x5352ed).fillRect(0, 0, size, size).generateTexture('bluePlayer', size, size).destroy();
    // Frozen player
    this.add.graphics().fillStyle(0x74b9ff).fillRect(0, 0, size, size).generateTexture('frozenPlayer', size, size).destroy();
    // Powerup
    this.add.graphics().fillStyle(0xffeaa7).fillCircle(16, 16, 16).generateTexture('powerup', 32, 32).destroy();
  }

  create() {
    this.physics.world.setBounds(0, 0, GAME_CONSTANTS.MAP.WIDTH, GAME_CONSTANTS.MAP.HEIGHT);
    this.add.rectangle(GAME_CONSTANTS.MAP.WIDTH / 2, GAME_CONSTANTS.MAP.HEIGHT / 2, GAME_CONSTANTS.MAP.WIDTH, GAME_CONSTANTS.MAP.HEIGHT, 0x2d3436);
    this.createBases();
    
    this.controls = new Controls(this);
    this.setupNetworkListeners();
    
    // The UIManager is now created on DOMContentLoaded in main.js
    this.time.addEvent({ delay: 16, callback: this.gameLoop, callbackScope: this, loop: true });
  }

  createBases() {
    const baseTextStyle = { fontSize: '20px', align: 'center', stroke: '#000', strokeThickness: 2 };
    // Red base
    this.add.circle(GAME_CONSTANTS.MAP.RED_BASE.x, GAME_CONSTANTS.MAP.RED_BASE.y, GAME_CONSTANTS.GAME_CONFIG.BASE_SIZE / 2, 0xff4757, 0.3).setStrokeStyle(4, 0xff4757);
    this.add.text(GAME_CONSTANTS.MAP.RED_BASE.x, GAME_CONSTANTS.MAP.RED_BASE.y, 'RED\nBASE', { ...baseTextStyle, fill: '#ff4757' }).setOrigin(0.5);
    // Blue base
    this.add.circle(GAME_CONSTANTS.MAP.BLUE_BASE.x, GAME_CONSTANTS.MAP.BLUE_BASE.y, GAME_CONSTANTS.GAME_CONFIG.BASE_SIZE / 2, 0x5352ed, 0.3).setStrokeStyle(4, 0x5352ed);
    this.add.text(GAME_CONSTANTS.MAP.BLUE_BASE.x, GAME_CONSTANTS.MAP.BLUE_BASE.y, 'BLUE\nBASE', { ...baseTextStyle, fill: '#5352ed' }).setOrigin(0.5);
    // Center line
    this.add.line(0, 0, GAME_CONSTANTS.MAP.WIDTH / 2, 0, GAME_CONSTANTS.MAP.WIDTH / 2, GAME_CONSTANTS.MAP.HEIGHT, 0xffffff, 0.5).setOrigin(0,0);
  }

  setupNetworkListeners() {
    if (!window.networkManager) return;

    window.networkManager.on('gameStarted', (data) => this.updateGameState(data.roomState));
    window.networkManager.on('playerJoined', (data) => this.updateGameState(data.roomState));
    window.networkManager.on('playerLeft', (data) => this.removePlayer(data.playerId));
    window.networkManager.on('gameOver', (data) => window.uiManager.showGameOver(data));
    window.networkManager.on('scoreUpdate', (data) => {
      window.uiManager.updateScores(data.teamScores);
      this.showScoreNotification(data.scorer);
    });
    window.networkManager.on('playerMoved', (data) => this.updatePlayerPosition(data.playerId, data.x, data.y));
    window.networkManager.on('playerTagged', (data) => this.handlePlayerTagged(data.tagger, data.tagged));
    window.networkManager.on('playerRescued', (data) => this.handlePlayerRescued(data.rescuer, data.rescued));
    window.networkManager.on('chatMessage', (data) => window.uiManager.addChatMessage(data));
    window.networkManager.on('powerupSpawned', (data) => this.spawnPowerup(data));
    window.networkManager.on('powerupCollected', (data) => this.removePowerup(data.powerupId));

    // **NEW**: Dedicated listener for state changes
    window.networkManager.on('playerStateChanged', (data) => {
      const sprite = this.players.get(data.playerId);
      if (sprite) {
        sprite.playerData.state = data.state;
        sprite.setTexture(this.getPlayerTexture(sprite.playerData));
        window.uiManager.updatePlayerList(Array.from(this.players.values()).map(s => s.playerData)); // Refresh UI
      }
    });
  }

  updateGameState(roomState) {
    this.players.forEach((sprite, playerId) => {
      if (!roomState.players.find(p => p.id === playerId)) {
        this.removePlayer(playerId);
      }
    });
    roomState.players.forEach(playerData => {
      if (!this.players.has(playerData.id)) {
        this.createPlayerSprite(playerData);
      } else {
        this.updatePlayerSprite(playerData);
      }
    });

    if (!this.localPlayer && window.networkManager?.socket?.id) {
        const localData = roomState.players.find(p => p.id === window.networkManager.socket.id);
        if(localData) this.localPlayer = localData;
    }
    
    window.uiManager.updateScores(roomState.teamScores);
    window.uiManager.updateTimer(roomState.timeRemaining);
    window.uiManager.updatePlayerList(roomState.players);
  }

  removePlayer(playerId) {
    const sprite = this.players.get(playerId);
    if (sprite) {
      sprite.nameText.destroy();
      sprite.destroy();
      this.players.delete(playerId);
      window.uiManager.updatePlayerList(Array.from(this.players.values()).map(s => s.playerData));
    }
  }

  createPlayerSprite(playerData) {
    const isLocal = playerData.id === window.networkManager?.socket?.id;
    const sprite = this.physics.add.sprite(playerData.x, playerData.y, this.getPlayerTexture(playerData));
    sprite.setCollideWorldBounds(true);
    
    const nameText = this.add.text(0, -20, playerData.username, {
      fontSize: '12px',
      fill: isLocal ? '#ffff00' : '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);
    
    const container = this.add.container(playerData.x, playerData.y, [sprite, nameText]);
    container.setSize(sprite.width, sprite.height);
    this.physics.world.enable(container);
    container.body.setCollideWorldBounds(true);
    
    container.sprite = sprite;
    container.nameText = nameText;
    container.playerData = playerData;
    
    this.players.set(playerData.id, container);
    
    if (isLocal) {
      this.localPlayer = playerData;
      this.cameras.main.startFollow(container, true, 0.1, 0.1);
    }
  }

  updatePlayerSprite(playerData) {
    const container = this.players.get(playerData.id);
    if (!container) return;

    container.playerData = playerData; // Always update data
    container.sprite.setTexture(this.getPlayerTexture(playerData));

    if (playerData.id !== this.localPlayer?.id) {
      this.tweens.add({
        targets: container,
        x: playerData.x,
        y: playerData.y,
        duration: 100, // Smoothing duration
        ease: 'Linear'
      });
    }
  }

  updatePlayerPosition(playerId, x, y) {
    if (playerId === this.localPlayer?.id) return; // Ignore updates for self
    const container = this.players.get(playerId);
    if (container) {
      this.tweens.add({
        targets: container,
        x: x, y: y,
        duration: 100,
        ease: 'Linear'
      });
    }
  }

  getPlayerTexture(playerData) {
    if (playerData.state === GAME_CONSTANTS.PLAYER_STATES.FROZEN) {
      return 'frozenPlayer';
    }
    return playerData.team === GAME_CONSTANTS.TEAMS.RED ? 'redPlayer' : 'bluePlayer';
  }

  handlePlayerTagged(tagger, tagged) {
    this.showNotification(`${tagged.username} tagged by ${tagger.username}!`, 'tag');
    const taggedSprite = this.players.get(tagged.id);
    if (taggedSprite) {
      this.cameras.main.flash(200, 255, 0, 0); // Red flash
    }
  }

  handlePlayerRescued(rescuer, rescued) {
    this.showNotification(`${rescued.username} rescued by ${rescuer.username}!`, 'rescue');
  }
  
  showNotification(message, type) {
    const color = type === 'tag' ? '#ff4757' : type === 'rescue' ? '#2ed573' : '#ffa502';
    const notification = this.add.text(this.cameras.main.width / 2, 50, message, {
      fontSize: '24px', fill: color, stroke: '#000', strokeThickness: 4
    }).setOrigin(0.5).setScrollFactor(0);

    this.tweens.add({
      targets: notification, y: 30, alpha: 0, duration: 2500, ease: 'Power2',
      onComplete: () => notification.destroy()
    });
  }

  showScoreNotification(scorer) {
    this.showNotification(`${scorer.username} scored for the ${scorer.team.toUpperCase()} team!`, 'score');
  }

  spawnPowerup(powerupData) {
    const sprite = this.physics.add.sprite(powerupData.x, powerupData.y, 'powerup');
    sprite.powerupData = powerupData;
    this.tweens.add({ targets: sprite, y: sprite.y - 10, duration: 1000, yoyo: true, repeat: -1 });
    this.powerups.set(powerupData.id, sprite);
  }

  removePowerup(powerupId) {
    const sprite = this.powerups.get(powerupId);
    if (sprite) {
      sprite.destroy();
      this.powerups.delete(powerupId);
    }
  }

  findNearbyPlayers(centerPlayer, radius) {
    const nearby = [];
    this.players.forEach((container, playerId) => {
      if (playerId !== centerPlayer.id) {
        const dist = Phaser.Math.Distance.Between(centerPlayer.x, centerPlayer.y, container.x, container.y);
        if (dist <= radius) {
          nearby.push(container.playerData);
        }
      }
    });
    return nearby;
  }
  
  gameLoop() {
    if (!this.localPlayer) return;
    const localContainer = this.players.get(this.localPlayer.id);
    if (!localContainer) return;
    
    // Player Movement
    const movement = this.controls.getMovement();
    const speed = GAME_CONSTANTS.GAME_CONFIG.PLAYER_SPEED;
    localContainer.body.setVelocity(movement.x * speed, movement.y * speed);

    if (localContainer.body.velocity.x !== 0 || localContainer.body.velocity.y !== 0) {
      this.localPlayer.x = localContainer.x;
      this.localPlayer.y = localContainer.y;
      window.networkManager?.updatePosition(localContainer.x, localContainer.y);
    }
    
    // Powerup Collection Check
    this.physics.overlap(localContainer, Array.from(this.powerups.values()), (playerContainer, powerupSprite) => {
      window.networkManager?.collectPowerup(powerupSprite.powerupData.id);
      this.removePowerup(powerupSprite.powerupData.id); // Immediately remove on client for responsiveness
    });
  }
}