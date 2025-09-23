class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.players = new Map();
    this.powerups = new Map();
    this.localPlayer = null;
    this.controls = null;
  }

  // 1. Preload: Create all visual assets programmatically
  preload() {
    // --- THIS IS THE FIX ---
    // Use the correct global variable name: GAME_CONSTANTS
    const { PLAYER_SIZE } = GAME_CONSTANTS.GAME_CONFIG;

    // Player Sprites
    this.add.graphics().fillStyle(0xff4757).fillRect(0, 0, PLAYER_SIZE, PLAYER_SIZE).generateTexture('redPlayer', PLAYER_SIZE, PLAYER_SIZE).destroy();
    this.add.graphics().fillStyle(0x5352ed).fillRect(0, 0, PLAYER_SIZE, PLAYER_SIZE).generateTexture('bluePlayer', PLAYER_SIZE, PLAYER_SIZE).destroy();
    this.add.graphics().fillStyle(0x74b9ff).fillRect(0, 0, PLAYER_SIZE, PLAYER_SIZE).generateTexture('frozenPlayer', PLAYER_SIZE, PLAYER_SIZE).destroy();
    
    // Powerup Sprites (Using GAME_CONSTANTS)
    this.add.graphics().fillStyle(0x2ed573).fillCircle(16, 16, 16).generateTexture(GAME_CONSTANTS.POWERUPS.SPEED_BOOST.id, 32, 32).destroy();
    this.add.graphics().fillStyle(0x0984e3).fillCircle(16, 16, 16).generateTexture(GAME_CONSTANTS.POWERUPS.SHIELD.id, 32, 32).destroy();
    this.add.graphics().fillStyle(0xfdcb6e).fillCircle(16, 16, 16).generateTexture(GAME_CONSTANTS.POWERUPS.REVEAL.id, 32, 32).destroy();
    
    // Effects
    this.add.graphics().fillStyle(0xffffff).fillRect(0, 0, 8, 8).generateTexture('particle', 8, 8).destroy();
    this.add.graphics().lineStyle(3, 0x0984e3, 0.8).strokeCircle(25, 25, 25).generateTexture('shieldEffect', 50, 50).destroy();
  }

  // 2. Create: Set up the scene, controls, and network listeners
  create() {
    this.physics.world.setBounds(0, 0, GAME_CONSTANTS.MAP.WIDTH, GAME_CONSTANTS.MAP.HEIGHT);
    this.add.rectangle(GAME_CONSTANTS.MAP.WIDTH / 2, GAME_CONSTANTS.MAP.HEIGHT / 2, GAME_CONSTANTS.MAP.WIDTH, GAME_CONSTANTS.MAP.HEIGHT, 0x2d3436);
    
    // Add a visible border for the game area
    this.add.rectangle(0, 0, GAME_CONSTANTS.MAP.WIDTH, GAME_CONSTANTS.MAP.HEIGHT).setOrigin(0).setStrokeStyle(10, 0xffffff, 0.5);

    this.createBases();
    this.controls = new Controls(this);
    this.setupNetworkListeners();
    
    this.time.addEvent({ delay: 16, callback: this.gameLoop, callbackScope: this, loop: true });
  }

  setupNetworkListeners() {
    if (!window.networkManager) return;

    window.networkManager.on('gameStarted', (roomState) => {
      window.uiManager.showScreen('gameScreen');
      this.updateGameState(roomState);
    });

    window.networkManager.on('roomStateUpdate', (roomState) => {
      if (roomState.gameState === GAME_CONSTANTS.GAME_STATES.PLAYING) {
        this.updateGameState(roomState);
      }
    });
    
    window.networkManager.on('playerTagged', (data) => this.handlePlayerTagged(data.tagger, data.tagged));
    window.networkManager.on('playerRescued', (data) => this.handlePlayerRescued(data.rescuer, data.rescued));
    window.networkManager.on('powerupCollected', (data) => this.removePowerup(data.powerupId));
    window.networkManager.on('gameOver', (data) => window.uiManager.showGameOver(data));
  }

  // 3. Update Game State: Syncs the visual scene with data from the server
  updateGameState(roomState) {
    if (!roomState) return;
    this.localPlayer = roomState.players.find(p => p.id === window.networkManager.socket.id);

    const serverPlayerIds = new Set(roomState.players.map(p => p.id));
    this.players.forEach((container, id) => {
      if (!serverPlayerIds.has(id)) this.removePlayer(id);
    });

    roomState.players.forEach(playerData => {
      if (!this.players.has(playerData.id)) this.createPlayerSprite(playerData);
      else this.updatePlayerSprite(playerData);
    });

    const serverPowerupIds = new Set(roomState.powerups.map(p => p.id));
    this.powerups.forEach((sprite, id) => {
      if (!serverPowerupIds.has(id)) this.removePowerup(id);
    });
    roomState.powerups.forEach(p => this.spawnPowerup(p));
  }

  // 4. Player Sprites: Manage the creation and updating of player visuals
  createPlayerSprite(playerData) {
    const isLocal = playerData.id === window.networkManager?.socket?.id;
    
    const sprite = this.physics.add.sprite(0, 0, this.getPlayerTexture(playerData));
    const nameText = this.add.text(0, -25, playerData.username, {
      fontSize: '14px', fill: isLocal ? '#ffff00' : '#ffffff',
      stroke: '#000000', strokeThickness: 3, align: 'center'
    }).setOrigin(0.5);
    const freezeText = this.add.text(0, 0, '', {
      fontSize: '16px', fill: '#fff', stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5);
    
    const container = this.add.container(playerData.x, playerData.y, [sprite, nameText, freezeText]);
    container.setSize(sprite.width, sprite.height);
    this.physics.world.enable(container);
    container.body.setCollideWorldBounds(true);
    
    container.sprite = sprite;
    container.nameText = nameText;
    container.freezeText = freezeText;
    container.playerData = playerData;
    
    this.players.set(playerData.id, container);
    
    if (isLocal) this.cameras.main.startFollow(container, true, 0.1, 0.1);
  }

  updatePlayerSprite(playerData) {
    const container = this.players.get(playerData.id);
    if (!container) return;

    container.playerData = playerData;
    container.sprite.setTexture(this.getPlayerTexture(playerData));

    if (playerData.id !== this.localPlayer?.id) {
      this.tweens.add({
        targets: container, x: playerData.x, y: playerData.y,
        duration: 100, ease: 'Linear'
      });
    }

    if (playerData.state === GAME_CONSTANTS.PLAYER_STATES.FROZEN && playerData.frozenUntil > 0) {
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

  // 5. Game Loop: Handles local player input every frame
  gameLoop() {
    if (!this.localPlayer) return;
    const localContainer = this.players.get(this.localPlayer.id);
    if (!localContainer) return;

    if (this.localPlayer.state === GAME_CONSTANTS.PLAYER_STATES.FROZEN) {
      localContainer.body.setVelocity(0, 0);
      return;
    }
    
    const movement = this.controls.getMovement();
    const speed = GAME_CONSTANTS.GAME_CONFIG.PLAYER_SPEED;
    localContainer.body.setVelocity(movement.x * speed, movement.y * speed);

    if (localContainer.body.velocity.lengthSq() > 0) {
      window.networkManager?.updatePosition(localContainer.x, localContainer.y);
    }
    
    this.physics.overlap(localContainer, Array.from(this.powerups.values()), (playerContainer, powerupSprite) => {
      window.networkManager?.collectPowerup(powerupSprite.powerupData.id);
      this.removePowerup(powerupSprite.powerupData.id);
    });
  }

  // 6. Helper Functions for visuals and effects
  getPlayerTexture(playerData) {
    if (playerData.state === GAME_CONSTANTS.PLAYER_STATES.FROZEN) return 'frozenPlayer';
    return playerData.team === GAME_CONSTANTS.TEAMS.RED ? 'redPlayer' : 'bluePlayer';
  }
  
  spawnPowerup(powerupData) {
    if (this.powerups.has(powerupData.id)) return;
    const sprite = this.physics.add.sprite(powerupData.x, powerupData.y, powerupData.type);
    sprite.powerupData = powerupData;
    this.tweens.add({ targets: sprite, y: sprite.y - 10, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
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
    if(rescuedContainer){
      this.createParticles(rescuedContainer.x, rescuedContainer.y, 0x2ed573, 20);
    }
  }

  createParticles(x, y, tint, count) {
      const particles = this.add.particles(x, y, 'particle', {
          speed: { min: 50, max: 150 }, lifespan: 800, scale: { start: 1, end: 0 },
          gravityY: 200, blendMode: 'ADD', emitting: false, tint: tint
      });
      particles.explode(count);
  }

  createBases() {
    const baseTextStyle = { fontSize: '20px', align: 'center', stroke: '#000', strokeThickness: 2 };
    this.add.circle(GAME_CONSTANTS.MAP.RED_BASE.x, GAME_CONSTANTS.MAP.RED_BASE.y, GAME_CONSTANTS.GAME_CONFIG.BASE_SIZE / 2, 0xff4757, 0.3).setStrokeStyle(4, 0xff4757);
    this.add.text(GAME_CONSTANTS.MAP.RED_BASE.x, GAME_CONSTANTS.MAP.RED_BASE.y, 'RED\nBASE', { ...baseTextStyle, fill: '#ff4757' }).setOrigin(0.5);
    this.add.circle(GAME_CONSTANTS.MAP.BLUE_BASE.x, GAME_CONSTANTS.MAP.BLUE_BASE.y, GAME_CONSTANTS.GAME_CONFIG.BASE_SIZE / 2, 0x5352ed, 0.3).setStrokeStyle(4, 0x5352ed);
    this.add.text(GAME_CONSTANTS.MAP.BLUE_BASE.x, GAME_CONSTANTS.MAP.BLUE_BASE.y, 'BLUE\nBASE', { ...baseTextStyle, fill: '#5352ed' }).setOrigin(0.5);
  }
}

