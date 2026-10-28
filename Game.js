import { Player } from './Player.js';
import { Input } from './input.js';
import { aabb, resolvePlatforms } from './collision.js';

export const STATE = {
  SELECT: 'select',
  READY: 'ready',
  PLAYING: 'playing',
  PAUSED: 'paused',
  WON: 'won',
  LOST: 'lost'
};

export class Game {
  constructor(canvas, images) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;
    this.images = images;
    this.input = new Input();

    this.worldW = 2600;
    this.camX = 0;

    this.selectedChar = null;
    this.player = new Player(80, 500, this._charImgs('pten1'));

    this.state = STATE.SELECT;
    this.wormsCollected = 0;
    this.time = 0;
    this.best = this.loadBest();
    this.lastTime = 0;
    this.running = false;

    // Пол (floor) — высота под новый спрайт ~48–55
    this.platforms = [
      { x: 0, y: 585, w: 2600, h: 55, floor: true },
      // Платформы — рисуем целиком, без обрезки краёв
      { x: 260, y: 455, w: 160, h: 36 },
      { x: 500, y: 370, w: 150, h: 36 },
      { x: 760, y: 450, w: 140, h: 36 },
      { x: 1030, y: 330, w: 160, h: 36 },
      { x: 1300, y: 410, w: 150, h: 36 },
      { x: 1580, y: 290, w: 170, h: 36 },
      { x: 1880, y: 390, w: 160, h: 36 },
      { x: 2180, y: 310, w: 180, h: 36 }
    ];

    // Препятствия "let" — можно перепрыгнуть, касание = смерть
    this.hazards = [
      { x: 420, y: 549, w: 56, h: 36 },
      { x: 900, y: 549, w: 56, h: 36 },
      { x: 1480, y: 549, w: 60, h: 36 },
      { x: 2050, y: 549, w: 56, h: 36 }
    ];

    // 5 червяков
    this.worms = [
      { x: 310, y: 415, w: 28, h: 26, collected: false },
      { x: 545, y: 330, w: 28, h: 26, collected: false },
      { x: 1085, y: 290, w: 28, h: 26, collected: false },
      { x: 1635, y: 250, w: 28, h: 26, collected: false },
      { x: 2240, y: 270, w: 28, h: 26, collected: false }
    ];

    // Финиш — зона в конце уровня
    this.finish = { x: 2450, y: 505, w: 100, h: 80 };

    this._bindUI();
    this._setupCharSelect();
    this._updateHUD();
    this.render();
  }

  _charImgs(name) {
    const imgs = this.images;
    if (name === 'pten1') {
      return {
        idle: imgs.pten1,
        open: imgs.pten1_1,
        jump: imgs.pten1_jump,
        jumpOpen: imgs.pten1_jump_1
      };
    }
    if (name === 'pten2') {
      return {
        idle: imgs.pten2,
        open: imgs.pten2_1,
        jump: imgs.pten2_jump_1,   // нет отдельного jump без _1
        jumpOpen: imgs.pten2_jump_1
      };
    }
    // pten3
    return {
      idle: imgs.pten3,
      open: imgs.pten3_1,
      jump: imgs.pten3_jump,
      jumpOpen: imgs.pten3_jump   // нет jump_1, используем обычный
    };
  }

  _setupCharSelect() {
    const cards = document.querySelectorAll('.char-card');
    const selectChar = (card) => {
      cards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      this.selectedChar = card.dataset.char;
      this.player.setImages(this._charImgs(this.selectedChar));
      this._drawCharPreviews();
    };

    cards.forEach(card => {
      // click + touch для мобильных
      const handler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectChar(card);
      };
      card.addEventListener('click', handler);
      card.addEventListener('touchend', handler, { passive: false });
    });

    // Кнопка «Играть» внутри панели выбора
    const btnPlay = document.getElementById('btn-select-play');
    if (btnPlay) {
      const playHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.start();
      };
      btnPlay.addEventListener('click', playHandler);
      btnPlay.addEventListener('touchend', playHandler, { passive: false });
    }

    // По умолчанию выбираем первого
    cards[0].classList.add('selected');
    this.selectedChar = 'pten1';
    this._drawCharPreviews();
  }

  _drawCharPreviews() {
    const previews = document.querySelectorAll('.char-preview');
    previews.forEach(cv => {
      const name = cv.dataset.char;
      const img = this.images[name];
      if (!img) return;
      const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, cv.width, cv.height);
      // Вписываем с сохранением пропорций
      const scale = Math.min(cv.width / img.width, cv.height / img.height) * 0.92;
      const dw = img.width * scale;
      const dh = img.height * scale;
      const dx = (cv.width - dw) / 2;
      const dy = (cv.height - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
    });
  }

  _bindUI() {
    this.btnStart = document.getElementById('btn-start');
    this.btnPause = document.getElementById('btn-pause');
    this.btnRestart = document.getElementById('btn-restart');
    this.overlay = document.getElementById('overlay');
    this.overlayTitle = document.getElementById('overlay-title');
    this.overlayMsg = document.getElementById('overlay-message');
    this.overlayRestart = document.getElementById('overlay-restart');
    this.charSelect = document.getElementById('char-select');

    this.btnStart.addEventListener('click', () => this.start());
    this.btnPause.addEventListener('click', () => this.togglePause());
    this.btnRestart.addEventListener('click', () => this.restart());
    this.overlayRestart.addEventListener('click', () => this.restart());

    const bindHold = (el, on, off) => {
      el.addEventListener('touchstart', e => { e.preventDefault(); on(); }, { passive: false });
      el.addEventListener('touchend', e => { e.preventDefault(); off(); }, { passive: false });
      el.addEventListener('touchcancel', off);
      el.addEventListener('mousedown', on);
      el.addEventListener('mouseup', off);
      el.addEventListener('mouseleave', off);
    };
    bindHold(document.getElementById('btn-left'), () => this.input.setLeft(true), () => this.input.setLeft(false));
    bindHold(document.getElementById('btn-right'), () => this.input.setRight(true), () => this.input.setRight(false));
    bindHold(document.getElementById('btn-jump'), () => this.input.setJump(true), () => this.input.setJump(false));

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === STATE.PLAYING) this.pause();
    });
  }

  loadBest() {
    try {
      const v = localStorage.getItem('djapmeryBestTime');
      return v ? parseFloat(v) : null;
    } catch { return null; }
  }

  saveBest() {
    try {
      if (this.best != null) localStorage.setItem('djapmeryBestTime', String(this.best));
    } catch {}
  }

  start() {
    if (this.state === STATE.PLAYING) return;
    if (!this.selectedChar) return;

    if (this.state === STATE.SELECT || this.state === STATE.READY || this.state === STATE.WON || this.state === STATE.LOST) {
      this._resetLevel();
    }
    this.state = STATE.PLAYING;
    this.charSelect.classList.add('hidden');
    this.btnStart.disabled = true;
    this.btnPause.disabled = false;
    this.btnPause.textContent = 'ПАУЗА';
    this.overlay.classList.add('hidden');
    this.input.clearAll();
    this.lastTime = 0;
    if (!this.running) {
      this.running = true;
      requestAnimationFrame(t => this.loop(t));
    }
    this._updateHUD();
  }

  pause() {
    if (this.state !== STATE.PLAYING) return;
    this.state = STATE.PAUSED;
    this.btnPause.textContent = 'ПРОДОЛЖИТЬ';
    this.btnStart.disabled = false;
    this.input.clearAll();
    this._updateHUD();
  }

  togglePause() {
    if (this.state === STATE.PLAYING) this.pause();
    else if (this.state === STATE.PAUSED) this.start();
  }

  restart() {
    this._resetLevel();
    this.state = STATE.SELECT;
    this.charSelect.classList.remove('hidden');
    this.btnStart.disabled = false;
    this.btnPause.disabled = true;
    this.btnPause.textContent = 'ПАУЗА';
    this.overlay.classList.add('hidden');
    this.input.clearAll();
    this.camX = 0;
    this._updateHUD();
    this.render();
  }

  _resetLevel() {
    this.player.reset();
    this.player.setImages(this._charImgs(this.selectedChar || 'pten1'));
    this.wormsCollected = 0;
    this.time = 0;
    this.camX = 0;
    for (const w of this.worms) w.collected = false;
  }

  _updateHUD() {
    document.getElementById('worms').textContent = 'ЧЕРВЯКИ: ' + this.wormsCollected + '/5';
    document.getElementById('timer').textContent = 'ВРЕМЯ: ' + this.time.toFixed(1);
    document.getElementById('best').textContent =
      this.best != null ? 'РЕКОРД: ' + this.best.toFixed(1) + 'с' : 'РЕКОРД: --';
    const map = {
      [STATE.SELECT]: 'ВЫБОР',
      [STATE.READY]: 'ГОТОВ',
      [STATE.PLAYING]: 'ИГРА',
      [STATE.PAUSED]: 'ПАУЗА',
      [STATE.WON]: 'ЕССС ПОБЕДА!',
      [STATE.LOST]: 'Eх... неудача(((('
    };
    document.getElementById('status').textContent = map[this.state] || '';
  }

  loop(ts) {
    if (!this.running) return;
    if (this.state === STATE.PLAYING) {
      if (this.lastTime === 0) this.lastTime = ts;
      let dt = (ts - this.lastTime) / 1000;
      this.lastTime = ts;
      if (dt > 0.05) dt = 0.05;
      this.update(dt);
    } else {
      this.lastTime = ts;
    }
    this.render();
    requestAnimationFrame(t => this.loop(t));
  }

  update(dt) {
    this.time += dt;
    const prevX = this.player.x;
    const prevY = this.player.y;

    this.player.update(dt, this.input);

    if (this.player.x < 0) this.player.x = 0;
    if (this.player.x + this.player.w > this.worldW) {
      this.player.x = this.worldW - this.player.w;
    }

    this.player.grounded = resolvePlatforms(this.player, this.platforms, prevX, prevY);

    // камера
    const target = this.player.x - this.W * 0.35;
    this.camX += (target - this.camX) * Math.min(1, dt * 6);
    if (this.camX < 0) this.camX = 0;
    if (this.camX > this.worldW - this.W) this.camX = Math.max(0, this.worldW - this.W);



    // препятствия let
    for (const h of this.hazards) {
      if (aabb(this.player, h)) {
        this._lose('｡°(°¯᷄◠¯᷅°)°｡');
        return;
      }
    }

    // червяки
    for (const w of this.worms) {
      if (!w.collected && aabb(this.player, w)) {
        w.collected = true;
        this.wormsCollected++;
        this._updateHUD();
      }
    }

    // победа: все червяки + финиш
    if (this.wormsCollected >= 5 && aabb(this.player, this.finish)) {
      this._win();
    }

    this._updateHUD();
  }

  _win() {
    this.state = STATE.WON;
    if (this.best == null || this.time < this.best) {
      this.best = this.time;
      this.saveBest();
    }
    this.btnStart.disabled = false;
    this.btnPause.disabled = true;
    this.overlayTitle.textContent = 'ЕССС ПОБЕДА!';
    this.overlayMsg.textContent =
      'Все червяки собраны!\nВремя: ' + this.time.toFixed(1) + 'с\nРекорд: ' + this.best.toFixed(1) + 'с';
    this.overlay.classList.remove('hidden');
    this._updateHUD();
  }

  _lose(reason) {
    this.state = STATE.LOST;
    this.btnStart.disabled = false;
    this.btnPause.disabled = true;
    this.overlayTitle.textContent = 'Eх... неудача((((';
    this.overlayMsg.textContent = reason + '\nдавай еще раз!';
    this.overlay.classList.remove('hidden');
    this._updateHUD();
  }

  render() {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    const cam = this.camX;

    // Фон (backround.png)
    const bg = this.images.bg;
    const bgScale = H / bg.height;
    const bgW = bg.width * bgScale;
    const bgX = -((cam * 0.3) % bgW);
    ctx.drawImage(bg, bgX, 0, bgW, H);
    if (bgX + bgW < W) {
      ctx.drawImage(bg, bgX + bgW, 0, bgW, H);
    }

    // Платформы и пол
    for (const p of this.platforms) {
      const dx = p.x - cam;
      if (dx + p.w < -40 || dx > W + 40) continue;
      if (p.floor) {
        // Пол тайлим по горизонтали без обрезки краёв
        this._drawTiled(ctx, this.images.floor, dx, p.y, p.w, p.h);
      } else {
        // Платформа — целиком один спрайт (бесшовный), без нарезки
        ctx.drawImage(
          this.images.platform,
          Math.round(dx),
          Math.round(p.y),
          Math.round(p.w),
          Math.round(p.h)
        );
      }
    }

    // Препятствия let
    for (const h of this.hazards) {
      const dx = h.x - cam;
      if (dx + h.w < -10 || dx > W + 10) continue;
      ctx.drawImage(this.images.let, Math.round(dx), Math.round(h.y), h.w, h.h);
    }

    // Червяки
    for (const w of this.worms) {
      if (w.collected) continue;
      const dx = w.x - cam;
      if (dx + w.w < -10 || dx > W + 10) continue;
      const bob = Math.sin(this.time * 3.5 + w.x * 0.04) * 4;
      ctx.drawImage(this.images.worm, Math.round(dx), Math.round(w.y + bob), w.w, w.h);
    }

    // Финиш
    {
      const dx = this.finish.x - cam;
      if (dx + this.finish.w > -20 && dx < W + 20) {
        ctx.fillStyle = 'rgba(122, 176, 255, 0.28)';
        ctx.fillRect(Math.round(dx), Math.round(this.finish.y), this.finish.w, this.finish.h);
        ctx.strokeStyle = '#7ab0ff';
        ctx.lineWidth = 3;
        ctx.strokeRect(Math.round(dx), Math.round(this.finish.y), this.finish.w, this.finish.h);
        ctx.fillStyle = '#a8c4ff';
        ctx.font = '22px Paddis, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ФИНИШ', Math.round(dx + this.finish.w / 2), Math.round(this.finish.y + 30));
      }
    }

    // Игрок
    if (this.state !== STATE.SELECT) {
      this.player.draw(ctx, cam);
    }

    // Оверлеи на канвасе
    if (this.state === STATE.PAUSED) {
      ctx.fillStyle = 'rgba(26, 34, 56, 0.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#a8c4ff';
      ctx.font = '36px Paddis, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ПАУЗА  ❙❙', W / 2, H / 2 - 18);
      ctx.font = '22px Paddis, sans-serif';
      ctx.fillText('стоп стоп', W / 2, H / 2 + 22);
    }

    if (this.state === STATE.READY) {
      ctx.fillStyle = 'rgba(26, 34, 56, 0.45)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#a8c4ff';
      ctx.font = '28px Paddis, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('НАЖМИ «СТАРТ»', W / 2, H / 2 - 14);
      ctx.font = '20px Paddis, sans-serif';
      ctx.fillStyle = '#c8d8ff';
      ctx.fillText('Собери 5 червяков и дойди до финиша', W / 2, H / 2 + 20);
    }
  }

  _drawTiled(ctx, img, x, y, w, h) {
    const iw = img.width;
    const ih = img.height;
    // Масштабируем по высоте, тайлим по ширине целиком (без обрезки «рваных» краёв)
    const scale = h / ih;
    const tileW = iw * scale;
    let left = w;
    let cx = x;
    while (left > 0.5) {
      const tw = Math.min(tileW, left);
      // берём пропорциональную часть исходника, чтобы край не «срезался» странно
      const srcW = (tw / tileW) * iw;
      ctx.drawImage(img, 0, 0, srcW, ih, Math.round(cx), Math.round(y), Math.round(tw), Math.round(h));
      cx += tw;
      left -= tw;
    }
  }
}
