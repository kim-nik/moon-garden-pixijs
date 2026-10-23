import { Application, Container, Graphics, Rectangle } from 'pixi.js';
import type { Color, Frame, GameState, Obstacle, Tile } from './contracts';

const SIZE = 576;
const PITCH = 68;
const OFFSET = 16;
const palette = [0x9ecbb0, 0xe7adb9, 0x9fc9e0, 0xf0d08b, 0xbfb0dc, 0xe8ad83];
const deep = [0x4b8b69, 0xb46f85, 0x598fae, 0xb68b46, 0x8370ac, 0xb7774e];
const point = (i: number) => ({ x: OFFSET + (i % 8) * PITCH + PITCH / 2, y: OFFSET + Math.floor(i / 8) * PITCH + PITCH / 2 });

function plant(color: Color): Graphics {
  const g = new Graphics();
  const fill = palette[color];
  const dark = deep[color];
  if (color === 0) {
    g.moveTo(-15, 17).bezierCurveTo(-31, -9, -8, -25, 21, -22).bezierCurveTo(25, 6, 5, 29, -15, 17).fill(dark);
    g.moveTo(-16, 14).bezierCurveTo(-27, -9, -6, -27, 21, -24).bezierCurveTo(22, 1, 3, 25, -16, 14).fill(fill);
    g.moveTo(-18, 21).lineTo(13, -15).moveTo(-6, 7).lineTo(-8, -5).moveTo(2, -2).lineTo(13, -1).stroke({ color: 0x517d62, width: 1.6, cap: 'round', alpha: 0.8 });
    g.moveTo(-13, -2).quadraticCurveTo(-7, -13, 5, -16).stroke({ color: 0xe0f4db, width: 1.7, alpha: 0.4, cap: 'round' });
  } else if (color === 1) {
    for (let n = 0; n < 5; n++) {
      const a = n / 5 * Math.PI * 2 - Math.PI / 2;
      g.ellipse(Math.cos(a) * 12, Math.sin(a) * 12 + 3, 10.5, 10.5).fill(dark);
    }
    for (let n = 0; n < 5; n++) {
      const a = n / 5 * Math.PI * 2 - Math.PI / 2;
      g.circle(Math.cos(a) * 12, Math.sin(a) * 12, 10.5).fill(fill);
      g.circle(Math.cos(a) * 14 - 1, Math.sin(a) * 14 - 3, 4).fill({ color: 0xffeced, alpha: 0.18 });
    }
    g.circle(0, 0, 7).fill(0xf3d49d).circle(-1, -2, 3).fill(0xffe9bd);
  } else if (color === 2) {
    g.moveTo(0, -25).bezierCurveTo(1, -23, 21, -2, 21, 9).bezierCurveTo(21, 35, -21, 35, -21, 9).bezierCurveTo(-21, -2, -1, -23, 0, -25).fill(dark);
    g.moveTo(0, -27).bezierCurveTo(1, -25, 20, -4, 20, 7).bezierCurveTo(20, 30, -20, 30, -20, 7).bezierCurveTo(-20, -4, -1, -25, 0, -27).fill(fill);
    g.moveTo(-8, -1).quadraticCurveTo(-15, 12, -6, 16).stroke({ color: 0xe9f6ff, width: 3.5, cap: 'round', alpha: 0.6 });
  } else if (color === 3) {
    g.star(0, 3, 4, 26, 12, Math.PI / 4).fill(dark);
    g.star(0, 0, 4, 26, 12, Math.PI / 4).fill(fill);
    g.star(-2, -3, 4, 14, 6, Math.PI / 4).fill({ color: 0xfff2c8, alpha: 0.55 });
    g.circle(-17, -19, 2).fill(0xffe7ae).circle(20, 16, 1.5).fill(0xffe7ae);
  } else if (color === 4) {
    for (let n = 0; n < 4; n++) {
      const a = n / 4 * Math.PI * 2;
      const x = Math.cos(a) * 12, y = Math.sin(a) * 12;
      g.moveTo(0, 3).quadraticCurveTo(x - 13, y + 14, x * 1.7, y * 1.7 + 3).quadraticCurveTo(x + 13, y - 14, 0, 3).fill(dark);
      g.moveTo(0, 0).quadraticCurveTo(x - 13, y + 14, x * 1.7, y * 1.7).quadraticCurveTo(x + 13, y - 14, 0, 0).fill(fill);
    }
    g.circle(0, 0, 5).fill(0xe5d9ed).circle(-1, -1, 2).fill(0xfff0de);
  } else {
    g.circle(0, 4, 21).fill(dark).circle(0, 1, 21).fill(fill);
    g.ellipse(-5, -5, 8, 6).fill({ color: 0xffdeb9, alpha: 0.38 });
    g.moveTo(-1, -16).quadraticCurveTo(0, -29, 17, -25).quadraticCurveTo(14, -14, -1, -16).fill(0x8ab795);
    g.moveTo(0, -17).lineTo(1, -25).stroke({ color: 0x5a7a53, width: 2 });
    g.circle(-10, 7, 1).circle(8, 4, 1).circle(4, 13, 1).fill({ color: dark, alpha: 0.5 });
  }
  return g;
}

function tileView(tile: Tile): Container {
  const container = new Container();
  const shadow = plant(tile.color);
  shadow.tint = 0x000000;
  shadow.alpha = 0.16;
  shadow.y = 4;
  container.addChild(shadow, plant(tile.color));
  const g = new Graphics();
  if (tile.special === 'rainbow') {
    container.removeChildren().forEach(child => child.destroy());
    for (let n = 0; n < 6; n++) {
      const a = n * Math.PI / 3;
      g.circle(Math.cos(a) * 13, Math.sin(a) * 13, 10).fill(palette[n]);
    }
    g.circle(0, 0, 8).fill(0xf7edd2).star(0, 0, 4, 6, 2).fill(0xb29152);
    g.circle(0, 0, 29).stroke({ color: 0xf8e8b5, width: 1, alpha: 0.6 });
  } else if (tile.special !== 'none') {
    g.circle(0, 0, 28).stroke({ color: 0xffe7ac, width: 1.7, alpha: 0.85 });
    if (tile.special === 'row') g.roundRect(-25, -3, 50, 6, 3).fill({ color: 0xfff4d3, alpha: 0.9 });
    if (tile.special === 'column') g.roundRect(-3, -25, 6, 50, 3).fill({ color: 0xfff4d3, alpha: 0.9 });
    if (tile.special === 'bomb') g.star(0, 0, 8, 17, 10).fill(0xffe9b7).circle(0, 0, 7).fill(palette[tile.color]);
  }
  container.addChild(g);
  return container;
}

export interface BoardCallbacks { tap(index: number): void; swipe(a: number, b: number): void; focus(index: number): void; activate(index: number): void }

export class BoardRenderer {
  private app = new Application();
  private tiles = new Container();
  private obstacleLayer = new Graphics();
  private highlights = new Graphics();
  private effects = new Container();
  private views = new Map<number, { view: Container; special: string; color: Color }>();
  private selected = -1;
  private hints: number[] = [];
  private keyboard = -1;
  private down: { index: number; x: number; y: number } | null = null;
  private callbacks: BoardCallbacks;
  private activeBoard: (Tile | null)[] = [];
  private hintTimer: ReturnType<typeof setTimeout> | null = null;
  private reduced = false;
  private alive = true;
  private onFrame: (frame: Frame) => void;

  constructor(callbacks: BoardCallbacks, onFrame: (frame: Frame) => void) { this.callbacks = callbacks; this.onFrame = onFrame; }

  async init(host: HTMLElement): Promise<void> {
    await this.app.init({ width: SIZE, height: SIZE, backgroundAlpha: 0, antialias: true, resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true, preference: 'webgl' });
    host.appendChild(this.app.canvas);
    const canvas = this.app.canvas;
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'application');
    canvas.setAttribute('aria-label', 'Поле 8 на 8. Стрелки: выбор клетки. Enter: выбрать растение и соседнее для обмена. Пробел: активировать усилитель. Escape: снять выбор.');
    const grid = new Graphics();
    for (let i = 0; i < 64; i++) {
      const { x, y } = point(i);
      grid.roundRect(x - 32, y - 32, 64, 64, 10).fill({ color: (Math.floor(i / 8) + i % 8) % 2 ? 0x294039 : 0x2c443c, alpha: 0.75 });
      grid.roundRect(x - 31.5, y - 31.5, 63, 63, 10).stroke({ color: 0xa3c6a6, alpha: 0.045, width: 1 });
    }
    this.app.stage.addChild(grid, this.tiles, this.obstacleLayer, this.highlights, this.effects);
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = new Rectangle(0, 0, SIZE, SIZE);
    this.app.stage.on('pointerdown', event => {
      canvas.focus({ preventScroll: true });
      const i = this.indexAt(event.global.x, event.global.y);
      if (i >= 0) this.down = { index: i, x: event.global.x, y: event.global.y };
    });
    this.app.stage.on('pointerup', event => {
      if (!this.down) return;
      const start = this.down;
      this.down = null;
      const dx = event.global.x - start.x, dy = event.global.y - start.y;
      if (Math.hypot(dx, dy) > 18) {
        const direction = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 1 : -1 : dy > 0 ? 8 : -8;
        const b = start.index + direction;
        if (b >= 0 && b < 64 && (Math.abs(direction) === 8 || Math.floor(start.index / 8) === Math.floor(b / 8))) this.callbacks.swipe(start.index, b);
      } else this.callbacks.tap(start.index);
    });
    this.app.stage.on('pointerupoutside', () => { this.down = null; });
    this.app.stage.on('pointercancel', () => { this.down = null; });
    canvas.addEventListener('keydown', event => {
      const offsets: Record<string, number> = { ArrowUp: -8, ArrowDown: 8, ArrowLeft: -1, ArrowRight: 1 };
      if (event.key in offsets) {
        event.preventDefault();
        if (this.keyboard < 0) this.keyboard = 0;
        else {
          const next = this.keyboard + offsets[event.key];
          if (next >= 0 && next < 64 && (Math.abs(offsets[event.key]) === 8 || Math.floor(next / 8) === Math.floor(this.keyboard / 8))) this.keyboard = next;
        }
        this.drawHighlights();
        this.callbacks.focus(this.keyboard);
      } else if (event.key === 'Enter') { event.preventDefault(); this.callbacks.tap(Math.max(0, this.keyboard)); }
      else if (event.key === ' ') { event.preventDefault(); this.callbacks.activate(Math.max(0, this.keyboard)); }
      else if (event.key === 'Escape') { this.select(-1); this.callbacks.tap(-1); }
    });
    canvas.addEventListener('blur', () => { this.keyboard = -1; this.drawHighlights(); });
  }

  private indexAt(x: number, y: number): number {
    const c = Math.floor((x - OFFSET) / PITCH), r = Math.floor((y - OFFSET) / PITCH);
    return c >= 0 && c < 8 && r >= 0 && r < 8 ? r * 8 + c : -1;
  }

  setReduced(value: boolean): void { this.reduced = value; }
  select(index: number): void { this.selected = index; this.drawHighlights(); }
  showHint(cells: number[]): void {
    this.hints = cells;
    if (this.hintTimer) clearTimeout(this.hintTimer);
    this.drawHighlights();
    this.hintTimer = setTimeout(() => { this.hints = []; this.drawHighlights(); }, 4500);
  }

  private drawHighlights(): void {
    const g = this.highlights.clear();
    for (let i = 0; i < 64; i++) {
      const { x, y } = point(i);
      if (this.selected === i) g.roundRect(x - 31, y - 31, 62, 62, 11).fill({ color: 0xd9e3b2, alpha: 0.1 }).stroke({ color: 0xe4dbad, width: 2.2 });
      if (this.hints.includes(i)) g.roundRect(x - 29, y - 29, 58, 58, 9).stroke({ color: 0xebd397, width: 2.5 }).circle(x + 23, y - 23, 4).fill(0xebd397);
      if (this.keyboard === i) g.roundRect(x - 33, y - 33, 66, 66, 12).stroke({ color: 0xd6e8d2, width: 1.4, alpha: 0.9 });
    }
  }

  private drawObstacles(obstacles: (Obstacle | null)[]): void {
    const g = this.obstacleLayer.clear();
    obstacles.forEach((obstacle, i) => {
      if (!obstacle) return;
      const { x, y } = point(i);
      if (obstacle.kind === 'ice') {
        g.roundRect(x - 30, y - 30, 60, 60, 9).fill({ color: 0xc4e7f5, alpha: 0.12 }).stroke({ color: 0xc2e7f7, alpha: 0.75, width: 1.8 });
        g.moveTo(x - 25, y - 12).lineTo(x - 25, y - 24).lineTo(x - 13, y - 24).moveTo(x + 25, y + 12).lineTo(x + 25, y + 24).lineTo(x + 13, y + 24).stroke({ color: 0xe2f5ff, alpha: 0.8, width: 2 });
        if (obstacle.hp > 1) g.roundRect(x - 24, y - 24, 48, 48, 5).stroke({ color: 0xd7eeff, width: 1, alpha: 0.6 });
      } else if (obstacle.kind === 'crate') {
        g.roundRect(x - 27, y - 27, 54, 54, 6).fill(0x946f4b).stroke({ color: 0xc29b67, width: 2 });
        for (const off of [-16, 0, 16]) g.moveTo(x - 24, y + off).lineTo(x + 24, y + off).stroke({ color: 0x5c4939, width: 2 });
        g.moveTo(x - 20, y - 21).lineTo(x + 20, y + 21).stroke({ color: 0xc49c6e, width: 7, cap: 'round' });
        g.circle(x - 18, y - 19, 2).circle(x + 18, y + 19, 2).fill(0x675441);
        if (obstacle.hp > 1) g.moveTo(x + 20, y - 21).lineTo(x - 20, y + 21).stroke({ color: 0xc49c6e, width: 6 });
      } else {
        g.moveTo(x - 28, y + 27).bezierCurveTo(x + 30, y - 12, x - 29, y + 5, x + 28, y - 27).stroke({ color: 0x648c60, width: 5, cap: 'round' });
        for (const off of [-15, 0, 15]) g.ellipse(x + off - 3, y - off - 3, 8, 4).fill(0x9bb480);
        if (obstacle.hp > 1) g.moveTo(x - 28, y - 27).quadraticCurveTo(x + 20, y, x + 28, y + 27).stroke({ color: 0x87a670, width: 3 });
      }
    });
  }

  render(state: Pick<GameState, 'board' | 'obstacles'>): void {
    this.activeBoard = state.board;
    const keep = new Set<number>();
    state.board.forEach((tile, i) => {
      if (!tile) return;
      keep.add(tile.id);
      let entry = this.views.get(tile.id);
      if (entry && (entry.special !== tile.special || entry.color !== tile.color)) {
        entry.view.destroy({ children: true });
        this.views.delete(tile.id);
        entry = undefined;
      }
      if (!entry) {
        entry = { view: tileView(tile), special: tile.special, color: tile.color };
        this.views.set(tile.id, entry);
        this.tiles.addChild(entry.view);
      }
      const { x, y } = point(i);
      entry.view.position.set(x, y);
      entry.view.alpha = 1;
      entry.view.scale.set(0.92);
    });
    for (const [id, entry] of this.views) if (!keep.has(id)) { entry.view.destroy({ children: true }); this.views.delete(id); }
    this.drawObstacles(state.obstacles);
    this.drawHighlights();
  }

  private tween(ms: number, step: (t: number) => void): Promise<void> {
    if (this.reduced || !this.alive) { step(1); return Promise.resolve(); }
    return new Promise(resolve => {
      const start = performance.now();
      const update = () => {
        const t = Math.min(1, (performance.now() - start) / ms);
        step(1 - Math.pow(1 - t, 3));
        if (t < 1 && this.alive) requestAnimationFrame(update);
        else resolve();
      };
      requestAnimationFrame(update);
    });
  }

  async animate(frames: Frame[], final: GameState): Promise<void> {
    this.hints = [];
    this.select(-1);
    for (const frame of frames) {
      this.onFrame(frame);
      if (frame.kind === 'clear' || frame.kind === 'special') {
        this.render(frame);
        const targets = frame.cells.flatMap(i => { const tile = frame.board[i]; const entry = tile ? this.views.get(tile.id) : undefined; return entry ? [entry.view] : []; });
        const particles = new Graphics();
        this.effects.addChild(particles);
        await this.tween(180, t => {
          for (const target of targets) { target.scale.set(0.92 + t * 0.3); target.alpha = 1 - t; }
          particles.clear();
          for (const i of frame.cells) {
            const tile = frame.board[i], p = point(i);
            for (let n = 0; n < 5; n++) {
              const a = (n * 1.257 + i * 0.3);
              particles.circle(p.x + Math.cos(a) * t * 45, p.y + Math.sin(a) * t * 45 + t * t * 15, (1 - t) * 3 + 0.2).fill({ color: tile ? palette[tile.color] : 0xe3cc95, alpha: 1 - t });
            }
          }
        });
        particles.destroy();
      } else {
        const before = new Map<number, { x: number; y: number }>();
        for (const [id, entry] of this.views) before.set(id, { x: entry.view.x, y: entry.view.y });
        this.render(frame);
        const tweens = frame.board.flatMap((tile, i) => {
          if (!tile) return [];
          const entry = this.views.get(tile.id);
          if (!entry) return [];
          const end = point(i);
          const start = before.get(tile.id) ?? { x: end.x, y: end.y - PITCH * (Math.floor(i / 8) + 1) };
          return [{ view: entry.view, start, end }];
        });
        await this.tween(frame.kind === 'shuffle' ? 250 : 180, t => {
          for (const { view, start, end } of tweens) {
            view.position.set(start.x + (end.x - start.x) * t, start.y + (end.y - start.y) * t);
            if (frame.kind === 'shuffle') view.alpha = 0.3 + t * 0.7;
          }
        });
      }
    }
    this.render(final);
  }

  async invalid(cells: number[]): Promise<void> {
    const targets = cells.flatMap(i => { const t = this.activeBoard[i]; const e = t ? this.views.get(t.id) : undefined; return e ? [{ view: e.view, x: e.view.x }] : []; });
    await this.tween(220, t => { for (const item of targets) item.view.x = item.x + Math.sin(t * Math.PI * 5) * 5 * (1 - t); });
    for (const item of targets) item.view.x = item.x;
  }

  destroy(): void { this.alive = false; if (this.hintTimer) clearTimeout(this.hintTimer); this.app.destroy(true, { children: true }); }
}
