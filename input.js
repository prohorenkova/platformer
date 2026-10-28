export class Input {
  constructor() {
    this.keys = { left: false, right: false, jump: false, jumpPressed: false };
    this._kd = this._kd.bind(this);
    this._ku = this._ku.bind(this);
    window.addEventListener('keydown', this._kd);
    window.addEventListener('keyup', this._ku);
    window.addEventListener('keydown', (e) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'KeyW', 'KeyA', 'KeyD'].includes(e.code)) {
        e.preventDefault();
      }
    });
  }

  _kd(e) {
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.keys.left = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.keys.right = true;
        break;
      case 'Space':
      case 'KeyW':
      case 'ArrowUp':
        if (!this.keys.jump) this.keys.jumpPressed = true;
        this.keys.jump = true;
        break;
    }
  }

  _ku(e) {
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.keys.left = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.keys.right = false;
        break;
      case 'Space':
      case 'KeyW':
      case 'ArrowUp':
        this.keys.jump = false;
        break;
    }
  }

  setLeft(v) {
    this.keys.left = v;
  }

  setRight(v) {
    this.keys.right = v;
  }

  setJump(v) {
    if (v && !this.keys.jump) this.keys.jumpPressed = true;
    this.keys.jump = v;
  }

  clearJumpPressed() {
    this.keys.jumpPressed = false;
  }

  clearAll() {
    this.keys.left = false;
    this.keys.right = false;
    this.keys.jump = false;
    this.keys.jumpPressed = false;
  }
}
