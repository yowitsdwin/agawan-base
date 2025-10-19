// client/js/GameScene.js
// Enhanced game scene with night mode and dynamic map support

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.players = new Map();
    this.powerups = new Map();
    this.localPlayer = null;
    this.controls = null;
    this.mapConfig = null;
    this.gameMode = GAME_CONSTANTS.GAME_MODES.DAY;
    this.nightOverlay = null;
    this.flashlightGraphics = null;
  }

  preload() {
    const { PLAYER_SIZE } = GAME_CONSTANTS.GAME_CONFIG;

    // Player sprites
    this.createPlayerSprites(PLAYER_SIZE);
    
    // Powerup sprites
    Object.values(GAME_CONSTANTS.POWERUPS).forEach(powerup => {
      this.add.graphics()
        .fillStyle(this.getPowerupColor(powerup.id))
        .fillCircle(16, 16, 16)
        .generateTexture(powerup.id, 32, 32)
        .destroy();
    });
    
    // Effects
    this.add.graphics().fillStyle(0xffffff).fillRect(0, 0, 8, 8)
      .generateTexture('particle', 8, 8).destroy();
    this.add.graphics().lineStyle(3, 0x0984e3, 0.8).strokeCircle(25, 25, 25)
      .generateTexture('shieldEffect', 50, 50).destroy();
  }

  createPlayerSprites(size) {
    // Red team
    this.add.graphics().fillStyle(0xff4757).fillRect(0, 0, size, size)
      .generateTexture('redPlayer', size, size).destroy();
    
    // Blue team
    this.add.graphics().fillStyle(0x5352ed).fillRect(0, 0, size, size)
      .generateTexture('bluePlayer', size, size).destroy();
    
    // Frozen
    this.add.graphics().fillStyle(0x74b9ff).fillRect(0, 0, size, size)
      .generateTexture('frozenPlayer', size, size).destroy();
  }

  getPowerupColor(powerupId) {
    const colors = {
      speed_boost: 0x2ed573,
      shield: 0x0984e3,
      reveal: 0xfdcb6e
    };
    return colors[powerupId] || 0xffffff;
  }

  create() {
    // Will be set when game starts with proper map config
    this.controls = new Controls(this);
    this.setupNetworkListeners();
    
    this.time.addEvent({ 
      delay: 16, 
      callback: this.gameLoop, 
      callbackScope: this, 
      loop: true 
    });
  }

  initializeMap(mapId, gameMode) {
    const mapKey = mapId.toUpperCase();
    this.mapConfig = GAME_CONSTANTS.MAPS[mapKey] || GAME_CONSTANTS.MAPS.CLASSIC;
    this.gameMode = gameMode || GAME_CONSTANTS.GAME_MODES.DAY;

    // Clear existing map elements
    this.children.removeAll();

    // Set world bounds
    this.physics.world.setBounds(0, 0, this.mapConfig.width, this.mapConfig.height);

    // Create background
    this.add.rectangle(
      this.mapConfig.width / 2, 
      this.mapConfig.height / 2, 
      this.mapConfig.width, 
      this.mapConfig.height, 
      this.mapConfig.backgroundColor
    );

    // Create border
    this.add.rectangle(0, 0, this.mapConfig.width, this.mapConfig.height)
      .setOrigin(0)
      .setStrokeStyle(10, 0xffffff, 0.5);

    // Create obstacles if any
    if (this.mapConfig.obstacles && this.mapConfig.obstacles.length > 0) {
      this.createObstacles();
    }

    // Create bases
    this.createBases();

    // Setup night mode if needed
    if (this.gameMode === GAME_CONSTANTS.GAME_MODES.NIGHT) {
      this.setupNightMode();
    }
  }

  createObstacles() {
    this.mapConfig.obstacles.forEach(obstacle => {
      const obstacleSprite = this.add.rectangle(
        obstacle.x, 
        obstacle.y, 
        obstacle.width, 
        obstacle.height, 
        0x8b4513, 
        0.8
      );
      obstacleSprite.setStrokeStyle(2, 0x5c2e0a);
      this.physics.add.existing(obstacleSprite, true); // true = static body
    });
  }

  createBases() {
    const baseTextStyle = { 
      fontSize: '20px', 
      align: 'center', 
      stroke: '#000', 
      strokeThickness: 2 
    };

    // Red base
    this.add.circle(
      this.mapConfig.redBase.x, 
      this.mapConfig.redBase.y, 
      GAME_CONSTANTS.GAME_CONFIG.BASE_SIZE / 2, 
      0xff4757, 
      0.3
    ).setStrokeStyle(4, 0xff4757);
    
    this.add.text(
      this.mapConfig.redBase.x, 
      this.mapConfig.redBase.y, 
      'RED\nBASE', 
      { ...baseTextStyle, fill: '#ff4757' }
    ).setOrigin(0.5);

    // Blue base
    this.add.circle(
      this.mapConfig.blueBase.x, 
      this.mapConfig.blueBase.y, 
      GAME_CONSTANTS.GAME_CONFIG.BASE_SIZE / 2, 
      0x5352ed, 
      0.3
    ).setStrokeStyle(4, 0x5352ed);
    
    this.add.text(
      this.mapConfig.blueBase.x, 
      this.mapConfig.blueBase.y, 
      'BLUE\nBASE', 
      { ...baseTextStyle, fill: '#5352ed' }
    ).setOrigin(0.5);
  }

  setupNightMode() {
    // Create dark overlay
    this.nightOverlay = this.add.rectangle(
      0, 0, 
      this.mapConfig.width, 
      this.mapConfig.height, 
      0x000000, 
      0.85
    ).setOrigin(0).setDepth(1000);

    // Create flashlight graphics
    this.flashlightGraphics = this.add.graphics().setDepth(1001);
  }

  updateFlashlight() {
    if (!this.flashlightGraphics || !this.localPlayer || 
        this.gameMode !== GAME_CONSTANTS.GAME_MODES.NIGHT) {
      return;
    }

    const localContainer = this.players.get(this.localPlayer.id);
    if (!localContainer) return;

    this.flashlightGraphics.clear();

    // Get mouse/pointer position for flashlight direction
    const pointer = this.input.activePointer;
    const angle = Phaser.Math.Angle.Between(
      localContainer.x, 
      localContainer.y, 
      pointer.worldX, 
      pointer.worldY
    );

    // Draw flashlight cone
    this.flashlightGraphics.fillStyle(0xffffff, 0.3);
    this.flashlightGraphics.beginPath();
    this.flashlightGraphics.moveTo(localContainer.x, localContainer.y);
    
    const angleSpread = Phaser.Math.DegToRad(GAME_CONSTANTS.GAME_CONFIG.FLASHLIGHT_ANGLE / 2);
    const distance = GAME_CONSTANTS.GAME_CONFIG.FLASHLIGHT_DISTANCE;
    
    // Create arc for flashlight
    const numSegments = 20;
    for (let i = 0; i <= numSegments; i++) {
      const segmentAngle = angle - angleSpread + (angleSpread * 2 * i / numSegments);
      const x = localContainer.x + Math.cos(segmentAngle) * distance;
      const y = localContainer.y + Math.sin(segmentAngle) * distance;
      this.flashlightGraphics.lineTo(x, y);
    }
    
    this.flashlightGraphics.closePath();
    this.flashlightGraphics.fillPath();

    // Add central bright spot
    this.flashlightGraphics.fillStyle(0xffffff, 0.2);
    this.flashlightGraphics.fillCircle(
      localContainer.x, 
      localContainer.y, 
      GAME_CONSTANTS.GAME_CONFIG.NIGHT_VISION_RADIUS
    );
  }

  setupNetworkListeners() {
    if (!window.networkManager) return;

    window.networkManager.on('gameStarted', (roomState) => {
      window.uiManager.showScreen('gameScreen');
      this.initializeMap(roomState.settings.map, roomState.settings.gameMode);
      this.updateGameState(roomState);
    });

    window.networkManager.on('roomStateUpdate', (roomState) => {
      if (roomState.gameState === GAME_CONSTANTS.GAME_STATES.PLAYING) {
        this.updateGameState(roomState);
      }
    });
    
    window.networkManager.on('playerTagged', (data) => 
      this.handlePlayerTagged(data.tagger, data.tagged));
    
    window.networkManager.on('playerRescued', (data) => 
      this.handlePlayerRescued(data.rescuer, data.rescued));
    
    window.networkManager.on('powerupSpawned', (powerup) => 
      this.spawnPowerup(powerup));
    
    window.networkManager.on('powerupCollected', (data) => 
      this.removePowerup(data.powerupId));
    
    window.networkManager.on('gameOver', (data) => {
      window.uiManager.showGameOver(data);
    });
  }

  updateGameState(roomState) {
    if (!roomState || !this.mapConfig) return;
    
    this.localPlayer = roomState.players.find(
      p => p.id === window.networkManager.socket.id
    );

    const serverPlayerIds = new Set(roomState.players.map(p => p.id));
    this.players.forEach((container, id) => {
      if (!serverPlayerIds.has(id)) {
        this.removePlayer(id);
      }
    });

    roomState.players.forEach(playerData => {
      if (!this.players.has(playerData.id)) {
        this.createPlayerSprite(playerData);
      } else {
        this.updatePlayerSprite(playerData);
      }
    });

    const serverPowerupIds = new Set(roomState.powerups.map(p => p.id));
    this.powerups.forEach((sprite, id) => {
      if (!serverPowerupIds.has(id)) {
        this.removePowerup(id);
      }
    });
    
    roomState.powerups.forEach(p => this.spawnPowerup(p));
  }

  createPlayerSprite(playerData) {
    const isLocal = playerData.id === window.networkManager?.socket?.id;
    
    const sprite = this.physics.add.sprite(0, 0, this.getPlayerTexture(playerData));
    const nameText = this.add.text(0, -25, playerData.username, {
      fontSize: '14px', 
      fill: isLocal ? '#ffff00' : '#ffffff',
      stroke: '#000000', 
      strokeThickness: 3, 
      align: 'center'
    }).setOrigin(0.5);
    
    const freezeText = this.add.text(0, 0, '', {
      fontSize: '16px', 
      fill: '#fff', 
      stroke: '#000', 
      strokeThickness: 3
    }).setOrigin(0.5);
    
    const container = this.add.container(playerData.x, playerData.y, [
      sprite, nameText, freezeText
    ]);
    
    container.setSize(sprite.width, sprite.height);
    this.physics.world.enable(container);
    container.body.setCollideWorldBounds(true);
    
    container.sprite = sprite;
    container.nameText = nameText;
    container.freezeText = freezeText;
    container.playerData = playerData;
    
    // Set depth based on night mode
    if (this.gameMode === GAME_CONSTANTS.GAME_MODES.NIGHT) {
      container.setDepth(1002);
    }
    
    this.players.set(playerData.id, container);
    
    if (isLocal) {
      this.cameras.main.startFollow(container, true, 0.1, 0.1);
    }
  }

  updatePlayerSprite(playerData) {
    const container = this.players.get(playerData.id);
    if (!container) return;

    container.playerData = playerData;
    container.sprite.setTexture(this.getPlayerTexture(playerData));

    if (playerData.id !== this.localPlayer?.id) {
      this.tweens.add({
        targets: container, 
        x: playerData.x, 
        y: playerData.y,
        duration: 100, 
        ease: 'Linear'
      });
    }

    if (playerData.state === GAME_CONSTANTS.PLAYER_STATES.FROZEN && 
        playerData.frozenUntil > 0) {
      const timeLeft = Math.max(0, (playerData.frozenUntil - Date.now()) / 1000).toFixed(1);
      container.freezeText.setText(`${timeLeft}s`);
      container.freezeText.visible = true;
    } else {
      container.freezeText.visible = false;
    }
  }

  removePlayer(playerId) {
    const container = this.players.get(playerId);
    if (container) {
      container.destroy();
      this.players.delete(playerId);
    }
  }

  gameLoop() {
    if (!this.localPlayer || !this.mapConfig) return;
    
    const localContainer = this.players.get(this.localPlayer.id);
    if (!localContainer) return;

    // Update flashlight in night mode
    if (this.gameMode === GAME_CONSTANTS.GAME_MODES.NIGHT) {
      this.updateFlashlight();
    }

    if (this.localPlayer.state === GAME_CONSTANTS.PLAYER_STATES.FROZEN) {
      localContainer.body.setVelocity(0, 0);
      return;
    }
    
    const movement = this.controls.getMovement();
    const speed = GAME_CONSTANTS.GAME_CONFIG.PLAYER_SPEED * 
                  (this.localPlayer.speedMultiplier || 1);
    
    localContainer.body.setVelocity(movement.x * speed, movement.y * speed);

    if (localContainer.body.velocity.lengthSq() > 0) {
      window.networkManager?.updatePosition(localContainer.x, localContainer.y);
    }
    
    this.physics.overlap(
      localContainer, 
      Array.from(this.powerups.values()), 
      (playerContainer, powerupSprite) => {
        window.networkManager?.collectPowerup(
          powerupSprite.powerupData.id,
          powerupSprite.powerupData.type
        );
      }
    );
  }

  getPlayerTexture(playerData) {
    if (playerData.state === GAME_CONSTANTS.PLAYER_STATES.FROZEN) {
      return 'frozenPlayer';
    }
    return playerData.team === GAME_CONSTANTS.TEAMS.RED ? 'redPlayer' : 'bluePlayer';
  }
  
  spawnPowerup(powerupData) {
    if (this.powerups.has(powerupData.id)) return;
    
    const sprite = this.physics.add.sprite(
      powerupData.x, 
      powerupData.y, 
      powerupData.type
    );
    
    sprite.powerupData = powerupData;
    
    if (this.gameMode === GAME_CONSTANTS.GAME_MODES.NIGHT) {
      sprite.setDepth(1002);
    }
    
    this.tweens.add({ 
      targets: sprite, 
      y: sprite.y - 10, 
      duration: 1500, 
      yoyo: true, 
      repeat: -1, 
      ease: 'Sine.easeInOut' 
    });
    
    this.powerups.set(powerupData.id, sprite);
  }

  removePowerup(powerupId) {
    const sprite = this.powerups.get(powerupId);
    if (sprite) {
      this.createParticles(sprite.x, sprite.y, 0xffa502, 15);
      sprite.destroy();
      this.powerups.delete(powerupId);
    }
  }

  handlePlayerTagged(tagger, tagged) {
    const taggedContainer = this.players.get(tagged.id);
    if (taggedContainer) {
      this.cameras.main.flash(200, 255, 0, 0);
      this.createParticles(taggedContainer.x, taggedContainer.y, 0x74b9ff, 20);
    }
  }

  handlePlayerRescued(rescuer, rescued) {
    const rescuedContainer = this.players.get(rescued.id);
    if (rescuedContainer) {
      this.createParticles(rescuedContainer.x, rescuedContainer.y, 0x2ed573, 20);
    }
  }

  createParticles(x, y, tint, count) {
    const particles = this.add.particles(x, y, 'particle', {
      speed: { min: 50, max: 150 }, 
      lifespan: 800, 
      scale: { start: 1, end: 0 },
      gravityY: 200, 
      blendMode: 'ADD', 
      emitting: false, 
      tint: tint
    });
    
    if (this.gameMode === GAME_CONSTANTS.GAME_MODES.NIGHT) {
      particles.setDepth(1003);
    }
    
    particles.explode(count);
  }
}