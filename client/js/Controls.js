class Controls {
  constructor(scene) {
    this.scene = scene;
    this.keys = scene.input.keyboard.addKeys('W,A,S,D,UP,LEFT,DOWN,RIGHT,SPACE');
    this.mobile = this.isMobileDevice();
    this.joystick = null;
    this.movement = { x: 0, y: 0 };
    
    this.setupKeyboard();
    if (this.mobile) {
      this.setupMobileControls();
    }
  }

  isMobileDevice() {
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  setupKeyboard() {
    this.keys.SPACE.on('down', () => this.handleAction());
  }

  setupMobileControls() {
    const joystickBase = document.getElementById('joystick-container');
    const joystickKnob = document.getElementById('joystick');
    const actionBtn = document.getElementById('actionBtn');
    
    if (!joystickBase || !joystickKnob || !actionBtn) return;
    
    actionBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.handleAction();
    });

    // Simple joystick logic
    joystickBase.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = joystickBase.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      let deltaX = touch.clientX - centerX;
      let deltaY = touch.clientY - centerY;
      
      const distance = Math.hypot(deltaX, deltaY);
      const maxDistance = rect.width / 2;
      
      // Normalize vector
      const normalizedX = deltaX / distance;
      const normalizedY = deltaY / distance;

      this.movement = { x: normalizedX, y: normalizedY };
      
      const knobX = Math.min(maxDistance - joystickKnob.clientWidth / 2, distance) * normalizedX;
      const knobY = Math.min(maxDistance - joystickKnob.clientHeight / 2, distance) * normalizedY;
      
      joystickKnob.style.transform = `translate(-50%, -50%) translate(${knobX}px, ${knobY}px)`;
    });
    
    joystickBase.addEventListener('touchend', () => {
      this.movement = { x: 0, y: 0 };
      joystickKnob.style.transform = `translate(-50%, -50%)`;
    });
  }

  getMovement() {
    if (this.mobile) return this.movement;
    
    let x = 0;
    let y = 0;
    
    if (this.keys.A.isDown || this.keys.LEFT.isDown) x = -1;
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) x = 1;
    if (this.keys.W.isDown || this.keys.UP.isDown) y = -1;
    if (this.keys.S.isDown || this.keys.DOWN.isDown) y = 1;

    if (x !== 0 && y !== 0) {
      const diag = 1 / Math.sqrt(2);
      x *= diag;
      y *= diag;
    }
    
    return { x, y };
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
