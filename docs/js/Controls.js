// client/js/Controls.js
class Controls {
  constructor(scene) {
    this.scene = scene;
    this.keys = scene.input.keyboard.addKeys('W,A,S,D,UP,LEFT,DOWN,RIGHT,SPACE');
    this.mobile = this.isMobileDevice();
    
    // Movement state
    this.movement = { x: 0, y: 0 };
    this.movementTouchId = null;
    this.moveJoystickBase = null;
    this.moveJoystickKnob = null;

    // Flashlight state
    this.flashlightMovement = { x: 1, y: 0 }; // Default aim right
    this.flashlightTouchId = null;
    this.flashlightJoystickBase = null;
    this.flashlightJoystickKnob = null;
    
    this.setupKeyboard();
    if (this.mobile) {
      console.log("Mobile device detected, setting up mobile controls.");
      this.setupMobileControls();
    }
  }

  isMobileDevice() {
    return window.matchMedia('(pointer: coarse) and (hover: none)').matches;
  }

  setupKeyboard() {
    this.keys.SPACE.on('down', () => this.handleAction());
  }

  setupMobileControls() {
    // Get joystick elements
    this.moveJoystickBase = document.getElementById('joystick-container');
    this.moveJoystickKnob = document.getElementById('joystick');
    this.flashlightJoystickBase = document.getElementById('flashlight-joystick-container');
    this.flashlightJoystickKnob = document.getElementById('flashlight-joystick');
    const actionBtn = document.getElementById('actionBtn');
    
    if (!this.moveJoystickBase || !this.moveJoystickKnob || !this.flashlightJoystickBase || !this.flashlightJoystickKnob || !actionBtn) {
      console.error("Missing mobile control elements!");
      return;
    }
    
    // Action button listener
    actionBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.handleAction();
    });

    // Listen for NEW touches on the specific joystick bases
    this.moveJoystickBase.addEventListener('touchstart', (e) => {
      e.preventDefault();
      // Assign the first finger that touches this base
      this.movementTouchId = e.changedTouches[0].identifier;
      this.updateJoystick(e.changedTouches[0], this.moveJoystickBase, this.moveJoystickKnob, 'movement');
    }, { passive: false });

    this.flashlightJoystickBase.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.flashlightTouchId = e.changedTouches[0].identifier;
      this.updateJoystick(e.changedTouches[0], this.flashlightJoystickBase, this.flashlightJoystickKnob, 'flashlight');
    }, { passive: false });

    // Listen for ALL touch movements on the whole screen
    document.addEventListener('touchmove', (e) => {
      e.preventDefault();
      // Loop through all fingers that moved
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        
        // Check if this finger is the one we assigned to movement
        if (touch.identifier === this.movementTouchId) {
          this.updateJoystick(touch, this.moveJoystickBase, this.moveJoystickKnob, 'movement');
        } 
        // Check if this finger is the one we assigned to the flashlight
        else if (touch.identifier === this.flashlightTouchId) {
          this.updateJoystick(touch, this.flashlightJoystickBase, this.flashlightJoystickKnob, 'flashlight');
        }
      }
    }, { passive: false });

    // Listen for ALL touch ends on the whole screen
    const endTouch = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        
        if (touch.identifier === this.movementTouchId) {
          // This finger lifted, stop moving
          this.movementTouchId = null;
          this.movement = { x: 0, y: 0 };
          this.moveJoystickKnob.style.transform = `translate(-50%, -50%)`;
        } 
        else if (touch.identifier === this.flashlightTouchId) {
          // This finger lifted, stop aiming (but keep last direction)
          this.flashlightTouchId = null;
          this.flashlightJoystickKnob.style.transform = `translate(-50%, -50%)`;
        }
      }
    };
    document.addEventListener('touchend', endTouch);
    document.addEventListener('touchcancel', endTouch);
  }

  // Helper function to update a joystick's position and state
  updateJoystick(touch, base, knob, controlType) {
    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let deltaX = touch.clientX - centerX;
    let deltaY = touch.clientY - centerY;
      
    const distance = Math.hypot(deltaX, deltaY);
    if (distance === 0) return; // Avoid division by zero
    
    const maxDistance = rect.width / 2;
    const normalizedX = deltaX / distance;
    const normalizedY = deltaY / distance;

    // Update the state
    if (controlType === 'movement') {
      this.movement = { x: normalizedX, y: normalizedY };
    } else if (controlType === 'flashlight') {
      this.flashlightMovement = { x: normalizedX, y: normalizedY };
    }
      
    // Update the knob's visual position
    const knobX = Math.min(maxDistance - knob.clientWidth / 2, distance) * normalizedX;
    const knobY = Math.min(maxDistance - knob.clientHeight / 2, distance) * normalizedY;
    knob.style.transform = `translate(-50%, -50%) translate(${knobX}px, ${knobY}px)`;
  }

  getMovement() {
    if (this.mobile) return this.movement;
    
    let x = 0;
    let y = 0;
    
    if (this.keys.A.isDown || this.keys.LEFT.isDown) x = -1;
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) x = 1;
    if (this.keys.W.isDown || this.keys.UP.isDown) y = -1;
    if (this.keys.S.isDown || this.keys.DOWN.isDown) y = 1;

    // Normalize diagonal movement
    if (x !== 0 && y !== 0) {
      const diag = 1 / Math.sqrt(2);
      x *= diag;
      y *= diag;
    }
    
    return { x, y };
  }
  
  getFlashlightDirection() {
    if (this.mobile) {
      return this.flashlightMovement;
    } else {
      if (!this.scene.localPlayer) return { x: 1, y: 0 };
      const localContainer = this.scene.players.get(this.scene.localPlayer.id);
      if (!localContainer) return { x: 1, y: 0 };
      
      const pointer = this.scene.input.activePointer;
      const deltaX = pointer.worldX - localContainer.x;
      const deltaY = pointer.worldY - localContainer.y;
      const distance = Math.hypot(deltaX, deltaY);
      
      if (distance === 0) return { x: 1, y: 0 }; // Default right
      
      return { x: deltaX / distance, y: deltaY / distance };
    }
  }

  handleAction() {
    if (this.scene.localPlayer && this.scene.localPlayer.state !== 'frozen') {
      const localContainer = this.scene.players.get(this.scene.localPlayer.id);
      if(!localContainer) return;

      const nearbyPlayers = [];
      this.scene.players.forEach(p => {
        if(p.playerData.id !== this.scene.localPlayer.id) {
            if(Phaser.Math.Distance.Between(localContainer.x, localContainer.y, p.x, p.y) < 50) {
              nearbyPlayers.push(p.playerData);
            }
        }
      });
      
      const frozenTeammate = nearbyPlayers.find(p => p.team === this.scene.localPlayer.team && p.state === 'frozen');
      
      if (frozenTeammate) {
        window.networkManager.rescuePlayer(frozenTeammate.id);
      } else {
        window.uiManager.showActionFeedback('No frozen teammate nearby!');
      }
    }
  }
}