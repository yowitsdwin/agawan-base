class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.players = new Map();
    this.localPlayer = null;
    this.powerups = new Map();
    this.controls = null;
  }

  preload() {
    // Create colored rectangles for sprites (placeholder)
    this.load.image('redPlayer', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
    
    // Create colored rectangles programmatically
    this.createColoredTextures();
  }

  createColoredTextures() {
    // Red player
    this.add.graphics()
      .fillStyle(0xff4757)
      .fillRect(0, 0, 32, 32)
      .generateTexture('redPlayer', 32, 32)
      .destroy();
    
    // Blue player  
    this.add.graphics()
      .fillStyle(0x5352ed)
      .fillRect(0, 0, 32, 32)
      .generateTexture('bluePlayer', 32, 32)
      .destroy();
    
    // Frozen player
    this.add.graphics()
      .fillStyle(0x74b9ff)
      .fillRect(0, 0, 32, 32)
      .generateTexture('frozenPlayer', 32, 32)
      .destroy();
    
    // Powerups
    this.add.graphics()
      .fillStyle(0xffeaa7)
      .fillCircle(16, 16, 16)
      .generateTexture('powerup', 32, 32)
      .destroy();
  }

  create() {
    // Set world bounds
    this.physics.world.setBounds(0, 0, GAME_CONSTANTS.MAP.WIDTH, GAME_CONSTANTS.MAP.HEIGHT);
    
    // Create background
    this.add.rectangle(GAME_CONSTANTS.MAP.WIDTH / 2, GAME_CONSTANTS.MAP.HEIGHT / 2, 
                      GAME_CONSTANTS.MAP.WIDTH, GAME_CONSTANTS.MAP.HEIGHT, 0x2d3436);
    
    // Create bases
    this.createBases();
    
    // Setup controls
    this.controls = new Controls(this);
    
    // Setup network event listeners
    this.setupNetworkListeners();
    
    // Create UI manager
    window.uiManager = new UIManager();
    
    // Start game loop
    this.startGameLoop();
  }

  createBases() {
    // Red base
    this.add.circle(GAME_CONSTANTS.MAP.RED_BASE.x, GAME_CONSTANTS.MAP.RED_BASE.y, 
                   GAME_CONSTANTS.GAME_CONFIG.BASE_SIZE / 2, 0xff4757, 0.3)
        .setStrokeStyle(4, 0xff4757);
    
    this.add.text(GAME_CONSTANTS.MAP.RED_BASE.x, GAME_CONSTANTS.MAP.RED_BASE.y, 'RED\nBASE', {
      fontSize: '20px',
      fill: '#ff4757',
      align: 'center'
    }).setOrigin(0.5);
    
    // Blue base
    this.add.circle(GAME_CONSTANTS.MAP.BLUE_BASE.x, GAME_CONSTANTS.MAP.BLUE_BASE.y, 
                   GAME_CONSTANTS.GAME_CONFIG.BASE_SIZE / 2, 0x5352ed, 0.3)
        .setStrokeStyle(4, 0x5352ed);
    
    this.add.text(GAME_CONSTANTS.MAP.BLUE_BASE.x, GAME_CONSTANTS.MAP.BLUE_BASE.y, 'BLUE\nBASE', {
      fontSize: '20px',
      fill: '#5352ed',
      align: 'center'
    }).setOrigin(0.5);
    
    // Center line
    this.add.line(GAME_CONSTANTS.MAP.WIDTH / 2, GAME_CONSTANTS.MAP.HEIGHT / 2,
                 0, 0, 0, GAME_CONSTANTS.MAP.HEIGHT, 0xffffff, 0.3)
        .setLineWidth(2);
  }

  setupNetworkListeners() {
    if (!window.networkManager) return;
    
    window.networkManager.on('playerJoined', (data) => {
      this.updateGameState(data.roomState);
      
      // Set local player if it's us
      if (!this.localPlayer && data.player.id === window.networkManager.socket.id) {
        this.localPlayer = data.player;
      }
    });
    
    window.networkManager.on('playerMoved', (data) => {
      this.updatePlayerPosition(data.playerId, data.x, data.y, data.state);
    });
    
    window.networkManager.on('playerTagged', (data) => {
      this.handlePlayerTagged(data.tagger, data.tagged);
    });
    
    window.networkManager.on('playerRescued', (data) => {
      this.handlePlayerRescued(data.rescuer, data.rescued);
    });
    
    window.networkManager.on('scoreUpdate', (data) => {
      window.uiManager.updateScores(data.teamScores);
      this.showScoreNotification(data.scorer);
    });
    
    window.networkManager.on('gameStarted', (data) => {
      this.updateGameState(data.roomState);
    });
    
    window.networkManager.on('gameOver', (data) => {
      window.uiManager.showGameOver(data);
    });
    
    window.networkManager.on('chatMessage', (data) => {
      window.uiManager.addChatMessage(data);
    });
    
    window.networkManager.on('powerupSpawned', (data) => {
      this.spawnPowerup(data);
    });
    
    window.networkManager.on('powerupCollected', (data) => {
      this.removePowerup(data.powerupId);
    });
  }

  updateGameState(roomState) {
    // Update players
    this.updatePlayers(roomState.players);
    
    // Update UI
    window.uiManager.updateScores(roomState.teamScores);
    window.uiManager.updateTimer(roomState.timeRemaining);
    window.uiManager.updatePlayerList(roomState.players);
  }

  updatePlayers(playersData) {
    // Remove players that left
    this.players.forEach((sprite, playerId) => {
      if (!playersData.find(p => p.id === playerId)) {
        sprite.destroy();
        this.players.delete(playerId);
      }
    });
    
    // Add or update players
    playersData.forEach(playerData => {
      if (!this.players.has(playerData.id)) {
        this.createPlayerSprite(playerData);
      } else {
        this.updatePlayerSprite(playerData);
      }
    });
  }

  createPlayerSprite(playerData) {
    const texture = this.getPlayerTexture(playerData);
    const sprite = this.physics.add.sprite(playerData.x, playerData.y, texture);
    
    sprite.setDisplaySize(GAME_CONSTANTS.GAME_CONFIG.PLAYER_SIZE, GAME_CONSTANTS.GAME_CONFIG.PLAYER_SIZE);
    sprite.setCollideWorldBounds(true);
    
    // Add username text
    const nameText = this.add.text(playerData.x, playerData.y - 20, playerData.username, {
      fontSize: '12px',
      fill: playerData.team === GAME_CONSTANTS.TEAMS.RED ? '#ff4757' : '#5352ed',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);
    
    sprite.nameText = nameText;
    sprite.playerData = playerData;
    
    this.players.set(playerData.id, sprite);
    
    // Set as local player if it's us
    if (playerData.id === window.networkManager?.socket?.id) {
      this.localPlayer = playerData;
      this.cameras.main.startFollow(sprite, true, 0.1, 0.1);
    }
  }

  updatePlayerSprite(playerData) {
    const sprite = this.players.get(playerData.id);
    if (!sprite) return;
    
    // Update texture based on state
    const newTexture = this.getPlayerTexture(playerData);
    if (sprite.texture.key !== newTexture) {
      sprite.setTexture(newTexture);
    }
    
    // Update position (smooth interpolation for remote players)
    if (playerData.id !== this.localPlayer?.id) {
      this.tweens.add({
        targets: sprite,
        x: playerData.x,
        y: playerData.y,
        duration: 100,
        ease: 'Linear'
      });
      
      this.tweens.add({
        targets: sprite.nameText,
        x: playerData.x,
        y: playerData.y - 20,
        duration: 100,
        ease: 'Linear'
      });
    }
    
    sprite.playerData = playerData;
  }

  updatePlayerPosition(playerId, x, y, state) {
    if (playerId === this.localPlayer?.id) return; // Don't update local player from network
    
    const sprite = this.players.get(playerId);
    if (sprite) {
      this.tweens.add({
        targets: sprite,
        x: x,
        y: y,
        duration: 100,
        ease: 'Linear'
      });
      
      this.tweens.add({
        targets: sprite.nameText,
        x: x,
        y: y - 20,
        duration: 100,
        ease: 'Linear'
      });
      
      sprite.playerData.state = state;
      sprite.setTexture(this.getPlayerTexture(sprite.playerData));
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
    
    // Visual effect
    const taggedSprite = this.players.get(tagged.id);
    if (taggedSprite) {
      this.tweens.add({
        targets: taggedSprite,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 200,
        yoyo: true,
        ease: 'Power2'
      });
    }
  }

  handlePlayerRescued(rescuer, rescued) {
    this.showNotification(`${rescued.username} rescued by ${rescuer.username}!`, 'rescue');
    
    // Visual effect
    const rescuedSprite = this.players.get(rescued.id);
    if (rescuedSprite) {
      const particles = this.add.particles(rescuedSprite.x, rescuedSprite.y, 'powerup', {
        speed: { min: 50, max: 100 },
        lifespan: 500,
        quantity: 5
      });
      
      this.time.delayedCall(500, () => particles.destroy());
    }
  }

  spawnPowerup(powerupData) {
    const sprite = this.physics.add.sprite(powerupData.x, powerupData.y, 'powerup');
    sprite.setDisplaySize(24, 24);
    sprite.powerupData = powerupData;
    
    // Floating animation
    this.tweens.add({
      targets: sprite,
      y: powerupData.y - 10,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    
    this.powerups.set(powerupData.id, sprite);
  }

  removePowerup(powerupId) {
    const sprite = this.powerups.get(powerupId);
    if (sprite) {
      sprite.destroy();
      this.powerups.delete(powerupId);
    }
  }

  showNotification(message, type) {
    const color = type === 'tag' ? '#ff4757' : type === 'rescue' ? '#00b894' : '#ffeaa7';
    
    const notification = this.add.text(GAME_CONSTANTS.MAP.WIDTH / 2, 100, message, {
      fontSize: '18px',
      fill: color,
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5).setScrollFactor(0);
    
    this.tweens.add({
      targets: notification,
      y: 80,
      alpha: 0,
      duration: 2000,
      ease: 'Power2',
      onComplete: () => notification.destroy()
    });
  }

  showScoreNotification(scorer) {
    this.showNotification(`${scorer.username} scored for ${scorer.team.toUpperCase()} team!`, 'score');
  }

  startGameLoop() {
    // Update local player movement
    this.physics.world.on('worldstep', () => {
      if (this.localPlayer && this.controls) {
        const movement = this.controls.getMovement();
        const localSprite = this.players.get(this.localPlayer.id);
        
        if (localSprite && (movement.x !== 0 || movement.y !== 0)) {
          const speed = GAME_CONSTANTS.GAME_CONFIG.PLAYER_SPEED;
          localSprite.setVelocity(movement.x * speed, movement.y * speed);
          
          // Update local player data
          this.localPlayer.x = localSprite.x;
          this.localPlayer.y = localSprite.y;
          
          // Send position update to server
          window.networkManager?.updatePosition(localSprite.x, localSprite.y);
          
          // Update name text position
          if (localSprite.nameText) {
            localSprite.nameText.setPosition(localSprite.x, localSprite.y - 20);
          }
        } else if (localSprite) {
          localSprite.setVelocity(0, 0);
        }
      }
    });
    
    // Check powerup collection
    this.time.addEvent({
      delay: 100,
      callback: this.checkPowerupCollection,
      callbackScope: this,
      loop: true
    });
  }

  checkPowerupCollection() {
    if (!this.localPlayer) return;
    
    const localSprite = this.players.get(this.localPlayer.id);
    if (!localSprite) return;
    
    this.powerups.forEach((powerupSprite, powerupId) => {
      const distance = Phaser.Math.Distance.Between(
        localSprite.x, localSprite.y,
        powerupSprite.x, powerupSprite.y
      );
      
      if (distance < 30) {
        window.networkManager?.collectPowerup(powerupId);
      }
    });
  }

  findNearbyPlayers(centerPlayer, radius) {
    const nearbyPlayers = [];
    
    this.players.forEach((sprite, playerId) => {
      if (playerId !== centerPlayer.id) {
        const distance = Phaser.Math.Distance.Between(
          centerPlayer.x, centerPlayer.y,
          sprite.x, sprite.y
        );
        
        if (distance <= radius) {
          nearbyPlayers.push(sprite.playerData);
        }
      }
    });
    
    return nearbyPlayers;
  }

  update() {
    // Game update logic runs here
    // Most logic is handled by event-driven network updates
  }
}