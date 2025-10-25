// client/js/GameScene.js
// PRODUCTION-READY: Fixed asset loading, AudioContext, and texture conflicts

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
    this.assetsLoaded = false;
    this.isInitialized = false;
    this.fallbacksCreated = false;
  }

  preload() {
    console.log('[GameScene] Starting asset preload...');
    
    // Show loading progress
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

    const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading Assets...', {
      fontSize: '20px',
      fill: '#ffffff'
    }).setOrigin(0.5);

    const percentText = this.add.text(width / 2, height / 2, '0%', {
      fontSize: '18px',
      fill: '#ffffff'
    }).setOrigin(0.5);

    this.load.on('progress', (value) => {
      progressBar.clear();
      progressBar.fillStyle(0x5352ed, 1);
      progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
      percentText.setText(Math.floor(value * 100) + '%');
    });

    this.load.on('complete', () => {
      console.log('[GameScene] All assets loaded successfully');
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
      percentText.destroy();
      this.assetsLoaded = true;
    });

    this.load.on('loaderror', (file) => {
      console.warn('[GameScene] Failed to load:', file.key);
    });

    // Try loading character sprites
    this.loadCharacterSprites();
    
    // Create procedural textures for powerups and effects
    this.createPowerupTextures();
    this.createEffectTextures();
  }

  loadCharacterSprites() {
    const basePath = 'assets/';
    const sprites = [
      'red_back1', 'red_back2', 'red_front1', 'red_front2',
      'red_left1', 'red_left2', 'red_right1', 'red_right2',
      'blue_back1', 'blue_back2', 'blue_front1', 'blue_front2',
      'blue_left1', 'blue_left2', 'blue_right1', 'blue_right2',
      'frozen_redback', 'frozen_redfront', 'frozen_redleft', 'frozen_redright',
      'frozen_blueback', 'frozen_bluefront', 'frozen_blueleft', 'frozen_blueright'
    ];

    sprites.forEach(sprite => {
      this.load.image(sprite, `${basePath}${sprite}.png`);
    });

    console.log('[GameScene] Queued character sprite loading');
  }

  createPowerupTextures() {
    const powerupConfig = {
      speed_boost: { color: 0x2ed573, symbol: '⚡' },
      shield: { color: 0x0984e3, symbol: '🛡' },
      reveal: { color: 0xfdcb6e, symbol: '👁' }
    };

    Object.entries(powerupConfig).forEach(([id, config]) => {
      const graphics = this.make.graphics({ x: 0, y: 0, add: false });
      
      // Outer glow
      graphics.fillStyle(config.color, 0.3);
      graphics.fillCircle(16, 16, 16);
      
      // Inner circle
      graphics.fillStyle(config.color, 0.9);
      graphics.fillCircle(16, 16, 12);
      
      // Border
      graphics.lineStyle(2, 0xffffff, 0.8);
      graphics.strokeCircle(16, 16, 14);
      
      graphics.generateTexture(id, 32, 32);
      graphics.destroy();
    });
    
    console.log('[GameScene] Created powerup textures');
  }

  createEffectTextures() {
    // Particle texture
    const particle = this.make.graphics({ x: 0, y: 0, add: false });
    particle.fillStyle(0xffffff);
    particle.fillCircle(4, 4, 4);
    particle.generateTexture('particle', 8, 8);
    particle.destroy();

    // Shield effect
    const shield = this.make.graphics({ x: 0, y: 0, add: false });
    shield.lineStyle(3, 0x0984e3, 0.8);
    shield.strokeCircle(25, 25, 25);
    shield.lineStyle(2, 0xffffff, 0.4);
    shield.strokeCircle(25, 25, 22);
    shield.generateTexture('shieldEffect', 50, 50);
    shield.destroy();

    console.log('[GameScene] Created effect textures');
  }

  createFallbackTextures() {
    if (this.fallbacksCreated) {
      console.log('[GameScene] Fallbacks already created, skipping');
      return;
    }

    console.log('[GameScene] Creating fallback textures for missing sprites');
    
    const teams = ['red', 'blue'];
    const directions = ['front', 'back', 'left', 'right'];
    const frames = [1, 2];
    
    teams.forEach(team => {
      const color = team === 'red' ? 0xff4757 : 0x5352ed;
      
      directions.forEach(direction => {
        frames.forEach(frame => {
          const key = `${team}_${direction}${frame}`;
          // Only create fallback if texture doesn't exist
          if (!this.textures.exists(key)) {
            this.createPlayerFallback(key, color, direction);
          }
        });
        
        // Frozen state
        const frozenKey = `frozen_${team}${direction}`;
        if (!this.textures.exists(frozenKey)) {
          this.createPlayerFallback(frozenKey, 0x74b9ff, direction, true);
        }
      });
    });
    
    this.fallbacksCreated = true;
    console.log('[GameScene] Fallback textures created');
  }

  createPlayerFallback(key, color, direction, frozen = false) {
    const size = 32;
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    
    // Draw body
    graphics.fillStyle(color);
    graphics.fillCircle(size / 2, size / 2, size / 2 - 2);
    
    // Add direction indicator
    graphics.fillStyle(0xffffff, 0.8);
    let indicatorX = size / 2;
    let indicatorY = size / 2;
    
    switch(direction) {
      case 'front':
        indicatorY = size * 0.7;
        break;
      case 'back':
        indicatorY = size * 0.3;
        break;
      case 'left':
        indicatorX = size * 0.3;
        break;
      case 'right':
        indicatorX = size * 0.7;
        break;
    }
    
    graphics.fillCircle(indicatorX, indicatorY, size / 8);
    
    // Add frozen effect
    if (frozen) {
      graphics.lineStyle(2, 0x00d2ff, 0.8);
      graphics.strokeCircle(size / 2, size / 2, size / 2 - 4);
    }
    
    graphics.generateTexture(key, size, size);
    graphics.destroy();
  }

  create() {
    console.log('[GameScene] Scene created');
    
    if (!this.assetsLoaded) {
      console.warn('[GameScene] Assets not fully loaded, waiting...');
      this.time.delayedCall(100, () => this.create());
      return;
    }

    try {
      // Create fallback textures AFTER assets are loaded
      this.createFallbackTextures();
      
      this.controls = new Controls(this);
      this.setupNetworkListeners();
      
      this.time.addEvent({ 
        delay: 16, 
        callback: this.gameLoop, 
        callbackScope: this, 
        loop: true 
      });
      
      if (window.pendingGameStart) {
        console.log('[GameScene] Processing pending game start');
        const roomState = window.pendingGameStart;
        this.initializeGame(roomState);
        window.pendingGameStart = null;
      }

      this.isInitialized = true;
      console.log('[GameScene] Initialization complete');
    } catch (error) {
      console.error('[GameScene] Initialization error:', error);
      if (window.uiManager) {
        window.uiManager.showError(
          'Failed to initialize game. Please refresh the page.',
          'Initialization Error'
        );
      }
    }
  }

  initializeGame(roomState) {
    if (!roomState || !roomState.settings) {
      console.error('[GameScene] Invalid room state');
      return;
    }

    try {
      this.initializeMap(roomState.settings.map, roomState.settings.gameMode);
      this.updateGameState(roomState);
    } catch (error) {
      console.error('[GameScene] Game initialization error:', error);
      if (window.uiManager) {
        window.uiManager.showActionFeedback('Error loading game. Using default map.', 'error');
      }
      this.initializeMap('classic', GAME_CONSTANTS.GAME_MODES.DAY);
    }
  }

  pauseKeyboard() {
    if (this.input && this.input.keyboard) {
      this.input.keyboard.disableGlobalCapture();
    }
  }

  resumeKeyboard() {
    if (this.input && this.input.keyboard) {
      this.input.keyboard.enableGlobalCapture();
    }
  }

  initializeMap(mapId, gameMode) {
    console.log(`[GameScene] Initializing map: ${mapId}, mode: ${gameMode}`);
    
    try {
      const mapKey = (mapId || 'classic').toUpperCase();
      this.mapConfig = GAME_CONSTANTS.MAPS[mapKey] || GAME_CONSTANTS.MAPS.CLASSIC;
      this.gameMode = gameMode || GAME_CONSTANTS.GAME_MODES.DAY;

      // Clear existing elements
      this.children.removeAll();
      if (this.obstaclesGroup) {
        this.obstaclesGroup.clear(true, true);
      }

      const width = this.mapConfig.width || 1600;
      const height = this.mapConfig.height || 800;
      this.physics.world.setBounds(0, 0, width, height);
      this.obstaclesGroup = this.physics.add.staticGroup();

      // Create background
      const bgColor = this.mapConfig.backgroundColor || 0x2d3436;
      this.add.rectangle(width / 2, height / 2, width, height, bgColor);

      // Create border
      const border = this.add.rectangle(0, 0, width, height);
      border.setOrigin(0);
      border.setStrokeStyle(10, 0xffffff, 0.5);

      // Create obstacles
      if (this.mapConfig.obstacles && Array.isArray(this.mapConfig.obstacles)) {
        this.createObstacles();
      }

      // Create bases
      this.createBases();

      // Setup night mode
      if (this.gameMode === GAME_CONSTANTS.GAME_MODES.NIGHT) {
        this.setupNightMode();
      }

      console.log('[GameScene] Map initialized successfully');
    } catch (error) {
      console.error('[GameScene] Map initialization error:', error);
      this.createFallbackMap();
    }
  }

  createFallbackMap() {
    console.log('[GameScene] Creating fallback map');
    this.mapConfig = GAME_CONSTANTS.MAPS.CLASSIC;
    this.physics.world.setBounds(0, 0, 1600, 800);
    this.add.rectangle(800, 400, 1600, 800, 0x2d3436);
    this.createBases();
  }

  createObstacles() {
    try {
      this.mapConfig.obstacles.forEach((obstacle, index) => {
        try {
          const obstacleSprite = this.add.rectangle(
            obstacle.x, 
            obstacle.y, 
            obstacle.width, 
            obstacle.height, 
            0x8b4513, 
            0.8
          );
          obstacleSprite.setStrokeStyle(2, 0x5c2e0a);
          this.physics.world.enable(obstacleSprite);
          obstacleSprite.body.setImmovable(true);
          this.obstaclesGroup.add(obstacleSprite);
        } catch (error) {
          console.warn(`[GameScene] Failed to create obstacle ${index}:`, error);
        }
      });
      console.log(`[GameScene] Created ${this.mapConfig.obstacles.length} obstacles`);
    } catch (error) {
      console.error('[GameScene] Obstacle creation error:', error);
    }
  }

  createBases() {
    const baseTextStyle = { 
      fontSize: '20px', 
      align: 'center', 
      stroke: '#000', 
      strokeThickness: 2 
    };

    try {
      const redBase = this.mapConfig.redBase || { x: 100, y: 400 };
      const blueBase = this.mapConfig.blueBase || { x: 1500, y: 400 };
      const baseSize = GAME_CONSTANTS.GAME_CONFIG.BASE_SIZE / 2;

      // Red base
      const redCircle = this.add.circle(redBase.x, redBase.y, baseSize, 0xff4757, 0.3);
      redCircle.setStrokeStyle(4, 0xff4757);
      redCircle.setDepth(2);
      
      const redText = this.add.text(redBase.x, redBase.y, 'RED\nBASE', {
        ...baseTextStyle,
        fill: '#ff4757'
      }).setOrigin(0.5).setDepth(3);

      // Blue base
      const blueCircle = this.add.circle(blueBase.x, blueBase.y, baseSize, 0x5352ed, 0.3);
      blueCircle.setStrokeStyle(4, 0x5352ed);
      blueCircle.setDepth(2);
      
      const blueText = this.add.text(blueBase.x, blueBase.y, 'BLUE\nBASE', {
        ...baseTextStyle,
        fill: '#5352ed'
      }).setOrigin(0.5).setDepth(3);

      console.log('[GameScene] Bases created');
    } catch (error) {
      console.error('[GameScene] Base creation error:', error);
    }
  }

  setupNightMode() {
    try {
      this.nightOverlay = this.add.rectangle(
        0, 0, 
        this.mapConfig.width, 
        this.mapConfig.height, 
        0x000000, 
        0.85
      );
      this.nightOverlay.setOrigin(0).setDepth(1000);

      this.flashlightGraphics = this.add.graphics().setDepth(1001);
      console.log('[GameScene] Night mode enabled');
    } catch (error) {
      console.error('[GameScene] Night mode setup error:', error);
      this.gameMode = GAME_CONSTANTS.GAME_MODES.DAY;
    }
  }

  updateFlashlight() {
    if (!this.flashlightGraphics || !this.localPlayer || 
        this.gameMode !== GAME_CONSTANTS.GAME_MODES.NIGHT) {
      return;
    }

    const localContainer = this.players.get(this.localPlayer.id);
    if (!localContainer) return;

    try {
      this.flashlightGraphics.clear();

      const direction = this.controls.getFlashlightDirection();
      const flashlightAngle = Math.atan2(direction.y, direction.x);

      this.flashlightGraphics.fillStyle(0xffffff, 0.3);
      this.flashlightGraphics.beginPath();
      this.flashlightGraphics.moveTo(localContainer.x, localContainer.y);
      
      const angleSpread = Phaser.Math.DegToRad(GAME_CONSTANTS.GAME_CONFIG.FLASHLIGHT_ANGLE / 2);
      const distance = GAME_CONSTANTS.GAME_CONFIG.FLASHLIGHT_DISTANCE;
      
      const numSegments = 20;
      for (let i = 0; i <= numSegments; i++) {
        const segmentAngle = flashlightAngle - angleSpread + (angleSpread * 2 * i / numSegments);
        const x = localContainer.x + Math.cos(segmentAngle) * distance;
        const y = localContainer.y + Math.sin(segmentAngle) * distance;
        this.flashlightGraphics.lineTo(x, y);
      }
      
      this.flashlightGraphics.closePath();
      this.flashlightGraphics.fillPath();

      this.flashlightGraphics.fillStyle(0xffffff, 0.2);
      this.flashlightGraphics.fillCircle(
        localContainer.x, 
        localContainer.y, 
        GAME_CONSTANTS.GAME_CONFIG.NIGHT_VISION_RADIUS
      );

      const ambientRadius = GAME_CONSTANTS.GAME_CONFIG.NIGHT_VISION_RADIUS;

      this.players.forEach((playerContainer, id) => {
        if (id === this.localPlayer.id) return;
        
        const isVisible = this.isTargetInLight(
          localContainer, playerContainer, flashlightAngle, 
          angleSpread, distance, ambientRadius
        );
        playerContainer.setVisible(isVisible);
      });
      
      this.powerups.forEach((powerupSprite) => {
        const isVisible = this.isTargetInLight(
          localContainer, powerupSprite, flashlightAngle, 
          angleSpread, distance, ambientRadius
        );
        powerupSprite.setVisible(isVisible);
      });
    } catch (error) {
      console.error('[GameScene] Flashlight update error:', error);
    }
  }

  isTargetInLight(localContainer, target, flashlightAngle, angleSpread, coneDistance, ambientRadius) {
    const dist = Phaser.Math.Distance.Between(
      localContainer.x, localContainer.y, target.x, target.y
    );

    if (dist < ambientRadius) return true;
    if (dist > coneDistance) return false;

    const angleToTarget = Phaser.Math.Angle.Between(
      localContainer.x, localContainer.y, target.x, target.y
    );
    const angleDiff = Phaser.Math.Angle.Wrap(angleToTarget - flashlightAngle);

    return Math.abs(angleDiff) < angleSpread;
  }

  setupNetworkListeners() {
    if (!window.networkManager) {
      console.error('[GameScene] NetworkManager not available');
      return;
    }

    window.networkManager.on('gameStarted', (roomState) => {
      console.log('[GameScene] Game started event received');
      
      if (!this.isInitialized) {
        console.log('[GameScene] Scene not ready, storing pending start');
        window.pendingGameStart = roomState;
        return;
      }

      this.initializeGame(roomState);
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
      console.log('[GameScene] Game over received:', data);
      window.uiManager.showGameOver(data);
    });
  }

  updateGameState(roomState) {
    if (!roomState || !this.mapConfig) {
      console.warn('[GameScene] Cannot update - missing data');
      return;
    }
    
    try {
      this.localPlayer = roomState.players.find(
        p => p.id === window.networkManager.socket.id
      );

      if (!this.localPlayer) {
        console.warn('[GameScene] Local player not found');
        return;
      }

      const serverPlayerIds = new Set(roomState.players.map(p => p.id));
      this.players.forEach((container, id) => {
        if (!serverPlayerIds.has(id)) {
          this.removePlayer(id);
        }
      });

      roomState.players.forEach(playerData => {
        try {
          if (!this.players.has(playerData.id)) {
            this.createPlayerSprite(playerData);
          } else {
            this.updatePlayerSprite(playerData);
          }
        } catch (error) {
          console.error('[GameScene] Player update error:', error);
        }
      });

      const serverPowerupIds = new Set(roomState.powerups.map(p => p.id));
      this.powerups.forEach((sprite, id) => {
        if (!serverPowerupIds.has(id)) {
          this.removePowerup(id);
        }
      });
      
      roomState.powerups.forEach(p => this.spawnPowerup(p));
    } catch (error) {
      console.error('[GameScene] Game state update error:', error);
    }
  }

  getPlayerTexture(playerData, direction, frame) {
    const team = playerData.team;
    const state = playerData.state;

    if (state === GAME_CONSTANTS.PLAYER_STATES.FROZEN) {
      const key = `frozen_${team}${direction}`;
      return this.textures.exists(key) ? key : `frozen_${team}front`;
    }
    
    const key = `${team}_${direction}${frame}`;
    return this.textures.exists(key) ? key : `${team}_front1`;
  }

  createPlayerSprite(playerData) {
    const isLocal = playerData.id === window.networkManager?.socket?.id;
    
    try {
      const initialTexture = this.getPlayerTexture(playerData, 'front', 1);
      
      const sprite = this.physics.add.sprite(0, 0, initialTexture);
      sprite.setDisplaySize(
        GAME_CONSTANTS.GAME_CONFIG.PLAYER_SIZE, 
        GAME_CONSTANTS.GAME_CONFIG.PLAYER_SIZE
      );
      
      let glowCircle = null;
      if (isLocal) {
        glowCircle = this.add.circle(
          0, 0, 
          GAME_CONSTANTS.GAME_CONFIG.PLAYER_SIZE / 2 + 5, 
          0xffff00, 0.3
        );
        glowCircle.setStrokeStyle(2, 0xffff00, 1);
      }
      
      const nameText = this.add.text(0, -25, playerData.username, {
        fontSize: '14px', 
        fill: isLocal ? '#ffff00' : '#ffffff',
        stroke: '#000000', 
        strokeThickness: 3, 
        align: 'center',
        fontStyle: isLocal ? 'bold' : 'normal'
      }).setOrigin(0.5);
      
      const freezeText = this.add.text(0, 0, '', {
        fontSize: '16px', 
        fill: '#fff', 
        stroke: '#000', 
        strokeThickness: 3
      }).setOrigin(0.5);
      
      const containerChildren = isLocal && glowCircle ? 
        [glowCircle, sprite, nameText, freezeText] : 
        [sprite, nameText, freezeText];
      
      const container = this.add.container(playerData.x, playerData.y, containerChildren);
      container.setSize(
        GAME_CONSTANTS.GAME_CONFIG.PLAYER_SIZE, 
        GAME_CONSTANTS.GAME_CONFIG.PLAYER_SIZE
      );
      this.physics.world.enable(container);
      container.body.setCollideWorldBounds(true);

      if (this.obstaclesGroup) {
        this.physics.add.collider(container, this.obstaclesGroup);
      }
      
      container.sprite = sprite;
      container.nameText = nameText;
      container.freezeText = freezeText;
      container.glowCircle = glowCircle;
      container.playerData = playerData;
      container.direction = 'front';
      container.animFrame = 1;
      container.animTimer = 0;
      
      const depth = this.gameMode === GAME_CONSTANTS.GAME_MODES.NIGHT ? 1002 : 10;
      container.setDepth(depth);

      if (this.gameMode === GAME_CONSTANTS.GAME_MODES.NIGHT) {
        container.setVisible(isLocal);
      }
      
      this.players.set(playerData.id, container);
      
      if (isLocal) {
        this.cameras.main.startFollow(container, true, 0.1, 0.1);
        this.cameras.main.setZoom(1);
        
        if (glowCircle) {
          this.tweens.add({
            targets: glowCircle,
            alpha: { from: 0.3, to: 0.6 },
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
          });
        }
        
        console.log(`[GameScene] Local player created: ${playerData.username}`);
      }
    } catch (error) {
      console.error('[GameScene] Player sprite creation error:', error);
    }
  }

  updatePlayerSprite(playerData) {
    const container = this.players.get(playerData.id);
    if (!container) return;

    try {
      container.playerData = playerData;
      container.direction = playerData.direction || 'front';

      let textureKey;
      if (playerData.state === GAME_CONSTANTS.PLAYER_STATES.FROZEN) {
        textureKey = this.getPlayerTexture(playerData, container.direction, 1);
      } else {
        if (container.x !== playerData.x || container.y !== playerData.y) {
          container.animTimer++;
          if (container.animTimer > 10) {
            container.animFrame = container.animFrame === 1 ? 2 : 1;
            container.animTimer = 0;
          }
        }
        textureKey = this.getPlayerTexture(playerData, container.direction, container.animFrame);
      }

      if (this.textures.exists(textureKey)) {
        container.sprite.setTexture(textureKey);
      }

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
    } catch (error) {
      console.error('[GameScene] Player sprite update error:', error);
    }
  }

  removePlayer(playerId) {
    const container = this.players.get(playerId);
    if (container) {
      container.destroy();
      this.players.delete(playerId);
      console.log(`[GameScene] Removed player: ${playerId}`);
    }
  }

  gameLoop() {
    if (!this.localPlayer || !this.mapConfig || !this.isInitialized) return;
    
    try {
      const localContainer = this.players.get(this.localPlayer.id);
      if (!localContainer) return;

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

      let newDirection = localContainer.direction;
      if (movement.y < -0.5) newDirection = 'back';
      else if (movement.y > 0.5) newDirection = 'front';
      else if (movement.x < -0.5) newDirection = 'left';
      else if (movement.x > 0.5) newDirection = 'right';

      let isMoving = movement.x !== 0 || movement.y !== 0;
      
      if (isMoving) {
        localContainer.animTimer++;
        if (localContainer.animTimer > 8) {
          localContainer.animFrame = localContainer.animFrame === 1 ? 2 : 1;
          localContainer.animTimer = 0;
        }
      } else {
        localContainer.animFrame = 1;
      }
      localContainer.direction = newDirection;
      
      const newTexture = this.getPlayerTexture(
        this.localPlayer, localContainer.direction, localContainer.animFrame
      );
      if (this.textures.exists(newTexture)) {
        localContainer.sprite.setTexture(newTexture);
      }

      if (localContainer.body.velocity.lengthSq() > 0) {
        window.networkManager?.updatePosition(
          localContainer.x, localContainer.y, localContainer.direction
        );
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
    } catch (error) {
      console.error('[GameScene] Game loop error:', error);
    }
  }

  spawnPowerup(powerupData) {
    if (this.powerups.has(powerupData.id)) return;
    
    try {
      const sprite = this.physics.add.sprite(
        powerupData.x, 
        powerupData.y, 
        powerupData.type
      );
      
      sprite.powerupData = powerupData;
      
      if (this.gameMode === GAME_CONSTANTS.GAME_MODES.NIGHT) {
        sprite.setDepth(1002);
        sprite.setVisible(false);
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
    } catch (error) {
      console.error('[GameScene] Powerup spawn error:', error);
    }
  }

  removePowerup(powerupId) {
    const sprite = this.powerups.get(powerupId);
    if (sprite) {
      try {
        this.createParticles(sprite.x, sprite.y, 0xffa502, 15);
        sprite.destroy();
        this.powerups.delete(powerupId);
      } catch (error) {
        console.error('[GameScene] Powerup removal error:', error);
      }
    }
  }

  handlePlayerTagged(tagger, tagged) {
    try {
      const taggedContainer = this.players.get(tagged.id);
      if (taggedContainer) {
        this.cameras.main.flash(200, 255, 0, 0);
        this.createParticles(taggedContainer.x, taggedContainer.y, 0x74b9ff, 20);
      }
    } catch (error) {
      console.error('[GameScene] Tag handling error:', error);
    }
  }

  handlePlayerRescued(rescuer, rescued) {
    try {
      const rescuedContainer = this.players.get(rescued.id);
      if (rescuedContainer) {
        this.createParticles(rescuedContainer.x, rescuedContainer.y, 0x2ed573, 20);
      }
    } catch (error) {
      console.error('[GameScene] Rescue handling error:', error);
    }
  }

  createParticles(x, y, tint, count) {
    try {
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
    } catch (error) {
      console.error('[GameScene] Particle creation error:', error);
    }
  }
}