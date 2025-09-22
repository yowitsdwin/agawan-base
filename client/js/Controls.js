class Controls {
  constructor(scene) {
    this.scene = scene;
    this.keys = {};
    this.mobile = this.isMobileDevice();
    this.joystick = null;
    this.movement = { x: 0, y: 0 };
    
    this.setupKeyboard();
    if (this.mobile) {
      this.setupMobileControls();
    }
  }

  isMobileDevice() {
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
  }

  setupKeyboard() {
    // WASD Keys
    this.keys.W = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keys.A = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keys.S = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keys.D = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    
    // Arrow Keys
    this.keys.UP = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.keys.LEFT = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.keys.DOWN = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.keys.RIGHT = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    
    // Action Keys
    this.keys.SPACE = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keys.ENTER = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    
    // Action key handlers
    this.keys.SPACE.on('down', () => {
      this.handleAction();
    });
  }

  setupMobileControls() {
    const joystickElement = document.getElementById('joystick');
    const rescueBtn = document.getElementById('rescueBtn');
    
    if (!joystickElement) return;
    
    this.joystick = {
      element: joystickElement,
      center: { x: 50, y: 50 },
      isDragging: false,
      currentPos: { x: 50, y: 50 }
    };
    
    // Touch events for joystick
    joystickElement.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.joystick.isDragging = true;
      this.updateJoystick(e.touches[0]);
    });
    
    document.addEventListener('touchmove', (e) => {
      if (this.joystick.isDragging) {
        e.preventDefault();
        this.updateJoystick(e.touches[0]);
      }
    });
    
    document.addEventListener('touchend', () => {
      if (this.joystick.isDragging) {
        this.joystick.isDragging = false;
        this.resetJoystick();
      }
    });
    
    // Rescue button
    if (rescueBtn) {
      rescueBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.handleAction();
      });
    }
  }

  updateJoystick(touch) {
    const rect = this.joystick.element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    let deltaX = touch.clientX - centerX;
    let deltaY = touch.clientY - centerY;
    
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const maxDistance = rect.width / 2 - 20;
    
    if (distance > maxDistance) {
      deltaX = (deltaX / distance) * maxDistance;
      deltaY = (deltaY / distance) * maxDistance;
    }
    
    this.joystick.currentPos.x = 50 + (deltaX / maxDistance) * 30;
    this.joystick.currentPos.y = 50 + (deltaY / maxDistance) * 30;
    
    // Update visual position
    const knob = this.joystick.element.querySelector('::after') || this.joystick.element;
    knob.style.transform = `translate(${this.joystick.currentPos.x - 50}px, ${this.joystick.currentPos.y - 50}px)`;
    
    // Set movement values
    this.movement.x = deltaX / maxDistance;
    this.movement.y = deltaY / maxDistance;
  }

  resetJoystick() {
    this.joystick.currentPos = { x: 50, y: 50 };
    this.movement = { x: 0, y: 0 };
    
    // Reset visual position
    const knob = this.joystick.element.querySelector('::after') || this.joystick.element;
    knob.style.transform = 'translate(-50%, -50%)';
  }

  getMovement() {
    if (this.mobile && this.joystick) {
      return this.movement;
    }
    
    // Keyboard movement
    let x = 0;
    let y = 0;
    
    if (this.keys.A.isDown || this.keys.LEFT.isDown) x = -1;
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) x = 1;
    if (this.keys.W.isDown || this.keys.UP.isDown) y = -1;
    if (this.keys.S.isDown || this.keys.DOWN.isDown) y = 1;
    
    // Normalize diagonal movement
    if (x !== 0 && y !== 0) {
      x *= 0.707;
      y *= 0.707;
    }
    
    return { x, y };
  }

  handleAction() {
    // Find nearby players to rescue
    if (this.scene.localPlayer) {
      const nearbyPlayers = this.scene.findNearbyPlayers(this.scene.localPlayer, 50);
      const frozenTeammate = nearbyPlayers.find(p => 
        p.team === this.scene.localPlayer.team && 
        p.state === GAME_CONSTANTS.PLAYER_STATES.FROZEN
      );
      
      if (frozenTeammate) {
        window.networkManager.rescuePlayer(frozenTeammate.id);
      }
    }
  }

  isActionPressed() {
    return this.keys.SPACE.isDown;
  }
}