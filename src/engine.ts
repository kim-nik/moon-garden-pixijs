import type {
  Color, Special, ObstacleKind, Tile, Obstacle, Goal, Level,
  GameState, Command, Frame, ActionResult, Move, Tool,
} from './contracts';

const W = 8, H = 8, N = W * H;
const CASCADE_SCORE = 60, MAX_COMBO_MULT = 5, MAX_CASCADE = 100, MOVE_BONUS = 100;
const ALL_COLORS: Color[] = [0, 1, 2, 3, 4, 5];
const DIRS: ReadonlyArray<readonly [number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1]];

const rowOf = (i: number): number => (i / W) | 0;
const colOf = (i: number): number => i % W;
const at = (r: number, c: number): number => r * W + c;
const inBounds = (r: number, c: number): boolean => r >= 0 && r < H && c >= 0 && c < W;
const validIndex = (i: number): boolean => Number.isInteger(i) && i >= 0 && i < N;
const colorCount = (l: Level): number => Math.min(Math.max(l.colors, 2), 6);

function nextRand(state: GameState): number {
  let a = state.rng >>> 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  state.rng = a;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const randInt = (s: GameState, n: number): number => Math.floor(nextRand(s) * n);
const randColor = (s: GameState): Color => ALL_COLORS[randInt(s, colorCount(s.level))];

function makeTile(state: GameState, color: Color, special: Special = 'none'): Tile {
  const id = state.nextId;
  state.nextId += 1;
  return { id, color, special };
}
const makeRandomTile = (s: GameState): Tile => makeTile(s, randColor(s), 'none');

function cloneState(s: GameState): GameState {
  return {
    level: s.level, board: s.board.map(tile => tile ? { ...tile } : null), obstacles: s.obstacles.map(obstacle => obstacle ? { ...obstacle } : null),
    rng: s.rng, nextId: s.nextId, movesLeft: s.movesLeft, score: s.score,
    collected: s.collected.slice(),
    cleared: { ice: s.cleared.ice, crate: s.cleared.crate, vine: s.cleared.vine },
    phase: s.phase, turn: s.turn,
  };
}

function makeFrame(kind: Frame['kind'], state: GameState, cells: number[], score: number, combo: number): Frame {
  return {
    kind, board: state.board.map(tile => tile ? { ...tile } : null), obstacles: state.obstacles.map(obstacle => obstacle ? { ...obstacle } : null),
    cells: cells.slice(), score, combo,
  };
}
const reject = (state: GameState, reason: string): ActionResult =>
  ({ ok: false, state, reason, frames: [] });

const isVine = (s: GameState, i: number): boolean => {
  const ob = s.obstacles[i];
  return ob !== null && ob.kind === 'vine';
};
const isAdjacent = (a: number, b: number): boolean =>
  Math.abs(rowOf(a) - rowOf(b)) + Math.abs(colOf(a) - colOf(b)) === 1;
const swapTiles = (board: (Tile | null)[], a: number, b: number): void => {
  const t = board[a];
  board[a] = board[b];
  board[b] = t;
};

function makesRun(board: (Tile | null)[], i: number, color: Color): boolean {
  const r = rowOf(i), c = colOf(i);
  let count = 1, k = c - 1;
  while (k >= 0) { const nt = board[at(r, k)]; if (nt && nt.color === color) { count++; k--; } else break; }
  k = c + 1;
  while (k < W) { const nt = board[at(r, k)]; if (nt && nt.color === color) { count++; k++; } else break; }
  if (count >= 3) return true;
  count = 1; k = r - 1;
  while (k >= 0) { const nt = board[at(k, c)]; if (nt && nt.color === color) { count++; k--; } else break; }
  k = r + 1;
  while (k < H) { const nt = board[at(k, c)]; if (nt && nt.color === color) { count++; k++; } else break; }
  return count >= 3;
}

function makeNonMatchingTile(state: GameState, i: number): Tile {
  const n = colorCount(state.level);
  for (let attempt = 0; attempt < 16; attempt++) {
    const color = ALL_COLORS[randInt(state, n)];
    if (!makesRun(state.board, i, color)) return makeTile(state, color, 'none');
  }
  return makeRandomTile(state);
}

function fillInitial(state: GameState): void {
  const two = colorCount(state.level) === 2;
  for (let i = 0; i < N; i++) {
    const ob = state.obstacles[i];
    if (ob && ob.kind === 'crate') continue;
    const color = two ? ALL_COLORS[(rowOf(i) + colOf(i)) % 2] : null;
    state.board[i] = color !== null ? makeTile(state, color, 'none') : makeNonMatchingTile(state, i);
  }
}

function findMatchesOnBoard(board: (Tile | null)[]): number[][] {
  const res: number[][] = [];
  for (let r = 0; r < H; r++) {
    let c = 0;
    while (c < W) {
      const t = board[at(r, c)];
      if (!t) { c++; continue; }
      let end = c + 1;
      while (end < W) { const nt = board[at(r, end)]; if (nt && nt.color === t.color) end++; else break; }
      if (end - c >= 3) { const run: number[] = []; for (let k = c; k < end; k++) run.push(at(r, k)); res.push(run); }
      c = end;
    }
  }
  for (let c = 0; c < W; c++) {
    let r = 0;
    while (r < H) {
      const t = board[at(r, c)];
      if (!t) { r++; continue; }
      let end = r + 1;
      while (end < H) { const nt = board[at(end, c)]; if (nt && nt.color === t.color) end++; else break; }
      if (end - r >= 3) { const run: number[] = []; for (let k = r; k < end; k++) run.push(at(k, c)); res.push(run); }
      r = end;
    }
  }
  return res;
}

function applyGravity(state: GameState): number[] {
  const changed: number[] = [];
  for (let c = 0; c < W; c++) {
    const crateRows: number[] = [];
    for (let r = 0; r < H; r++) {
      const index = at(r, c), ob = state.obstacles[index];
      if (ob && (ob.kind === 'crate' || ob.kind === 'vine')) {
        crateRows.push(r);
        if (ob.kind === 'vine' && !state.board[index]) { state.board[index] = makeRandomTile(state); changed.push(index); }
      }
    }
    const bounds: number[] = [-1, ...crateRows, H];
    for (let k = bounds.length - 2; k >= 0; k--) {
      const top = bounds[k] + 1, bottom = bounds[k + 1] - 1;
      const tiles: Tile[] = [];
      for (let r = top; r <= bottom; r++) { const t = state.board[at(r, c)]; if (t) tiles.push(t); }
      const segHeight = bottom - top + 1, empty = segHeight - tiles.length;
      for (let i = 0; i < segHeight; i++) {
        const r = top + i, idx = at(r, c);
        const newTile: Tile | null = i < empty ? makeRandomTile(state) : tiles[i - empty];
        const old = state.board[idx];
        if ((old ? old.id : 0) !== (newTile ? newTile.id : 0)) changed.push(idx);
        state.board[idx] = newTile;
      }
    }
  }
  return changed;
}

function singleEffectCells(state: GameState, special: Special, cell: number, targetColor?: Color): number[] {
  const cells = new Set<number>();
  const r = rowOf(cell), c = colOf(cell);
  if (special === 'row') { for (let k = 0; k < W; k++) cells.add(at(r, k)); }
  else if (special === 'column') { for (let k = 0; k < H; k++) cells.add(at(k, c)); }
  else if (special === 'bomb') {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (inBounds(r + dr, c + dc)) cells.add(at(r + dr, c + dc));
    }
  } else {
    const tile = state.board[cell];
    const color = targetColor !== undefined ? targetColor : special === 'rainbow' ? randomPresentColor(state, cell) : tile ? tile.color : 0;
    for (let i = 0; i < N; i++) { const t = state.board[i]; if (t && t.color === color) cells.add(i); }
  }
  return Array.from(cells);
}

function comboCells(state: GameState, s1: Special, at1: number, s2: Special, at2: number): number[] {
  const cells = new Set<number>();
  cells.add(at1); cells.add(at2);
  const isLine = (s: Special): boolean => s === 'row' || s === 'column';
  const addLine = (center: number, special: Special): void => {
    const r = rowOf(center), c = colOf(center);
    if (special === 'row') for (let k = 0; k < W; k++) cells.add(at(r, k));
    else for (let k = 0; k < H; k++) cells.add(at(k, c));
  };
  const addArea = (center: number, radius: number): void => {
    const r = rowOf(center), c = colOf(center);
    for (let dr = -radius; dr <= radius; dr++) for (let dc = -radius; dc <= radius; dc++) {
      if (inBounds(r + dr, c + dc)) cells.add(at(r + dr, c + dc));
    }
  };
  const addColor = (color: Color): void => {
    for (let i = 0; i < N; i++) { const t = state.board[i]; if (t && t.color === color) cells.add(i); }
  };
  const addBombLine = (bombAt: number): void => {
    const r = rowOf(bombAt), c = colOf(bombAt);
    for (let dr = -1; dr <= 1; dr++) { if (r + dr < 0 || r + dr >= H) continue; for (let k = 0; k < W; k++) cells.add(at(r + dr, k)); }
    for (let dc = -1; dc <= 1; dc++) { if (c + dc < 0 || c + dc >= W) continue; for (let k = 0; k < H; k++) cells.add(at(k, c + dc)); }
  };
  if (s1 === 'rainbow' && s2 === 'rainbow') { for (let i = 0; i < N; i++) cells.add(i); return Array.from(cells); }
  if (s1 === 'rainbow' || s2 === 'rainbow') {
    const otherAt = s1 === 'rainbow' ? at2 : at1;
    const other = state.board[otherAt];
    if (other) {
      addColor(other.color);
      if (other.special !== 'none') {
        for (let i = 0; i < N; i++) {
          if (state.board[i]?.color === other.color) for (const hit of singleEffectCells(state, other.special, i)) cells.add(hit);
        }
      }
    }
    return Array.from(cells);
  }
  if (s1 === 'bomb' && s2 === 'bomb') { addArea(at1, 2); addArea(at2, 2); return Array.from(cells); }
  if (s1 === 'bomb' && isLine(s2)) { addBombLine(at1); return Array.from(cells); }
  if (s2 === 'bomb' && isLine(s1)) { addBombLine(at2); return Array.from(cells); }
  if (isLine(s1) && isLine(s2)) { addLine(at1, 'row'); addLine(at1, 'column'); }
  else { addLine(at1, s1); addLine(at2, s2); }
  return Array.from(cells);
}

function pickCreationCell(run: number[], preferred: number[]): number {
  for (const i of preferred) if (run.includes(i)) return i;
  return run[Math.floor(run.length / 2)];
}

interface PlannedSpecial { at: number; color: Color; special: Special; }

function planSpecials(matches: number[][], board: (Tile | null)[], preferred: number[]): PlannedSpecial[] {
  const res: PlannedSpecial[] = [];
  const inH = new Set<number>(), inV = new Set<number>();
  for (const run of matches) {
    const horizontal = rowOf(run[0]) === rowOf(run[1]);
    for (const i of run) { if (horizontal) inH.add(i); else inV.add(i); }
  }
  const bombCells = new Set<number>();
  inH.forEach((i) => { if (inV.has(i)) bombCells.add(i); });
  bombCells.forEach((i) => { const t = board[i]; if (t) res.push({ at: i, color: t.color, special: 'bomb' }); });
  for (const run of matches) {
    const horizontal = rowOf(run[0]) === rowOf(run[1]);
    if (run.some((i) => bombCells.has(i))) continue;
    if (run.length === 4) {
      const cell = pickCreationCell(run, preferred);
      const t = board[cell];
      if (t) res.push({ at: cell, color: t.color, special: horizontal ? 'row' : 'column' });
    } else if (run.length >= 5) {
      const cell = pickCreationCell(run, preferred);
      const t = board[cell];
      if (t) res.push({ at: cell, color: t.color, special: 'rainbow' });
    }
  }
  return res;
}

interface ResolveCtx { damaged: Set<number>; combo: number; }

function expandSpecials(state: GameState, initial: number[], suppressed: number[]): number[] {
  const clear = new Set(initial);
  const pending = initial.slice();
  const processed = new Set<number>(suppressed);
  while (pending.length) {
    const cell = pending.pop();
    if (cell === undefined || processed.has(cell)) continue;
    processed.add(cell);
    const tile = state.board[cell];
    if (!tile || tile.special === 'none') continue;
    for (const hit of singleEffectCells(state, tile.special, cell)) {
      if (!clear.has(hit)) { clear.add(hit); pending.push(hit); }
    }
  }
  return Array.from(clear);
}

function isAdjacentHit(i: number, cells: number[]): boolean {
  if (cells.indexOf(i) >= 0) return true;
  const r = rowOf(i), c = colOf(i);
  for (const [dr, dc] of DIRS) {
    if (inBounds(r + dr, c + dc) && cells.indexOf(at(r + dr, c + dc)) >= 0) return true;
  }
  return false;
}

function clearCells(state: GameState, frames: Frame[], cells: number[], ctx: ResolveCtx, frameKind: Frame['kind']): void {
  if (cells.length === 0) return;
  const frame = makeFrame(frameKind, state, cells, 0, ctx.combo);
  let removed = 0;
  for (const i of cells) {
    const t = state.board[i];
    if (t) { state.board[i] = null; removed++; state.collected[t.color] = (state.collected[t.color] ?? 0) + 1; }
    const ob = state.obstacles[i];
    if (ob && ob.kind === 'ice') ob.hp -= 1;
  }
  for (let i = 0; i < N; i++) {
    const ob = state.obstacles[i];
    if (!ob || ctx.damaged.has(i)) continue;
    if (ob.kind !== 'crate' && ob.kind !== 'vine') continue;
    if (isAdjacentHit(i, cells)) { ob.hp -= 1; ctx.damaged.add(i); }
  }
  for (let i = 0; i < N; i++) {
    const ob = state.obstacles[i];
    if (ob && ob.hp <= 0) { state.obstacles[i] = null; state.cleared[ob.kind] = (state.cleared[ob.kind] ?? 0) + 1; }
  }
  const score = removed * CASCADE_SCORE * Math.min(ctx.combo, MAX_COMBO_MULT);
  state.score += score;
  frame.score = state.score;
  frames.push(frame);
}

function cascadeLoop(state: GameState, frames: Frame[], ctx: ResolveCtx, preferredInit: number[]): void {
  let preferred = preferredInit.slice();
  for (let guard = 0; guard < MAX_CASCADE; guard++) {
    const matches = findMatchesOnBoard(state.board);
    if (matches.length === 0) break;
    ctx.combo += 1;
    ctx.damaged.clear();
    const clear = new Set<number>();
    for (const run of matches) for (const i of run) clear.add(i);
    const queue: number[] = [];
    clear.forEach((i) => { const t = state.board[i]; if (t && t.special !== 'none') queue.push(i); });
    const processed = new Set<number>();
    while (queue.length > 0) {
      const idx = queue.pop();
      if (idx === undefined || processed.has(idx)) continue;
      processed.add(idx);
      const t = state.board[idx];
      if (!t || t.special === 'none') continue;
      for (const c of singleEffectCells(state, t.special, idx)) {
        if (!clear.has(c)) {
          clear.add(c);
          const ct = state.board[c];
          if (ct && ct.special !== 'none' && !processed.has(c)) queue.push(c);
        }
      }
    }
    const toCreate = planSpecials(matches, state.board, preferred);
    clearCells(state, frames, Array.from(clear), ctx, 'clear');
    for (const spec of toCreate) {
      if (state.board[spec.at] === null) state.board[spec.at] = makeTile(state, spec.color, spec.special);
    }
    preferred = applyGravity(state);
    frames.push(makeFrame('fall', state, [], 0, ctx.combo));
  }
  if (findMatchesOnBoard(state.board).length > 0) settleBoard(state);
}

function runResolve(state: GameState, frames: Frame[], initialCells: number[], initialKind: Frame['kind'], preferredInit: number[] = [], suppressed: number[] = [], creations: PlannedSpecial[] = []): void {
  const ctx: ResolveCtx = { damaged: new Set<number>(), combo: 0 };
  if (initialCells.length > 0) {
    ctx.combo = 1;
    const expanded = expandSpecials(state, initialCells, suppressed);
    clearCells(state, frames, expanded, ctx, initialKind);
    for (const spec of creations) if (!state.board[spec.at]) state.board[spec.at] = makeTile(state, spec.color, spec.special);
    applyGravity(state);
    frames.push(makeFrame('fall', state, [], 0, ctx.combo));
  }
  cascadeLoop(state, frames, ctx, preferredInit);
}

export function goalValue(state: GameState, goal: Goal): number {
  if (goal.kind === 'score') return state.score;
  if (goal.kind === 'collect') return state.collected[goal.color] ?? 0;
  return state.cleared[goal.obstacle] ?? 0;
}

function goalsMet(state: GameState): boolean {
  if (state.level.goals.length === 0) return false;
  for (const g of state.level.goals) if (goalValue(state, g) < g.amount) return false;
  return true;
}

function shuffleTiles(state: GameState): void {
  const positions: number[] = [], tiles: Tile[] = [];
  for (let i = 0; i < N; i++) {
    const t = state.board[i];
    if (!t) continue;
    const ob = state.obstacles[i];
    if (ob && (ob.kind === 'crate' || ob.kind === 'vine')) continue;
    if (t.special !== 'none') continue;
    positions.push(i); tiles.push(t);
  }
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = randInt(state, i + 1);
    const tmp = tiles[i]; tiles[i] = tiles[j]; tiles[j] = tmp;
  }
  for (let k = 0; k < positions.length; k++) {
    state.board[positions[k]] = tiles[k];
  }
}

function forceMove(state: GameState): boolean {
  for (let r = 0; r < H - 1; r++) {
    for (let c = 1; c < W - 1; c++) {
      const idx = [at(r, c - 1), at(r, c), at(r, c + 1), at(r + 1, c)];
      let ok = true;
      for (const cell of idx) {
        const ob = state.obstacles[cell];
        if ((ob && (ob.kind === 'crate' || ob.kind === 'vine')) || !state.board[cell] || state.board[cell]?.special !== 'none') { ok = false; break; }
      }
      if (!ok) continue;
      const original = state.board.slice();
      for (const a of ALL_COLORS.slice(0, colorCount(state.level))) {
        for (const b of ALL_COLORS.slice(0, colorCount(state.level))) {
          if (a === b) continue;
          for (const [k, cell] of idx.entries()) {
            const tile = original[cell];
            if (tile) state.board[cell] = { ...tile, color: k === 1 ? b : a };
          }
          if (!findMatchesOnBoard(state.board).length && legalMoves(state).length) return true;
        }
      }
      state.board = original;
    }
  }
  return false;
}

function settleBoard(state: GameState): void {
  for (let guard = 0; guard < MAX_CASCADE; guard++) {
    const matches = findMatchesOnBoard(state.board);
    if (matches.length === 0) break;
    const clear = new Set<number>();
    for (const run of matches) for (const i of run) clear.add(i);
    clear.forEach((i) => { state.board[i] = null; });
    applyGravity(state);
  }
}

function hasAction(state: GameState): boolean {
  return legalMoves(state).length > 0 || state.board.some((tile, i) => tile && tile.special !== 'none' && !isVine(state, i));
}

function ensurePlayable(state: GameState, frames: Frame[], force = false): boolean {
  if (!force && hasAction(state)) return true;
  const original = state.board.slice();
  for (let attempt = 0; attempt < 128; attempt++) {
    shuffleTiles(state);
    if (!findMatchesOnBoard(state.board).length && hasAction(state)) { frames.push(makeFrame('shuffle', state, [], state.score, 0)); return true; }
  }
  state.board = original;
  if (!hasAction(state) && !forceMove(state)) {
    const free = state.board.findIndex((tile, i) => tile && !isVine(state, i));
    const tile = state.board[free];
    if (tile) state.board[free] = { ...tile, special: 'bomb' };
  }
  frames.push(makeFrame('shuffle', state, [], state.score, 0));
  return hasAction(state);
}

function finish(state: GameState, frames: Frame[]): ActionResult {
  if (goalsMet(state)) { state.score += state.movesLeft * MOVE_BONUS; state.phase = 'won'; }
  else if (state.movesLeft <= 0) { state.phase = 'lost'; }
  else if (!ensurePlayable(state, frames)) { state.phase = 'lost'; }
  return { ok: true, state, frames };
}

export function createGame(level: Level, seed: number = level.seed): GameState {
  const state: GameState = {
    level, board: new Array<Tile | null>(N).fill(null), obstacles: new Array<Obstacle | null>(N).fill(null),
    rng: seed >>> 0, nextId: 1, movesLeft: level.moves, score: 0,
    collected: [0, 0, 0, 0, 0, 0], cleared: { ice: 0, crate: 0, vine: 0 }, phase: 'playing', turn: 0,
  };
  for (const ob of level.obstacles) {
    if (!validIndex(ob.index) || ob.hp <= 0) continue;
    state.obstacles[ob.index] = { kind: ob.kind, hp: ob.hp };
    if (ob.kind === 'crate') state.board[ob.index] = null;
  }
  fillInitial(state);
  settleBoard(state);
  if (!ensurePlayable(state, [])) state.phase = 'lost';
  return state;
}

export function findMatches(state: GameState): number[][] { return findMatchesOnBoard(state.board); }

function canSwap(state: GameState, a: number, b: number): boolean {
  if (!state.board[a] || !state.board[b]) return false;
  if (isVine(state, a) || isVine(state, b)) return false;
  return true;
}

export function legalMoves(state: GameState): Move[] {
  const res: Move[] = [];
  for (let i = 0; i < N; i++) {
    const r = rowOf(i), c = colOf(i);
    for (const [dr, dc] of [[0, 1], [1, 0]]) {
      if (!inBounds(r + dr, c + dc)) continue;
      const j = at(r + dr, c + dc);
      if (!canSwap(state, i, j)) continue;
      const ta = state.board[i], tb = state.board[j];
      if ((ta && ta.special !== 'none') || (tb && tb.special !== 'none')) { res.push({ a: i, b: j }); continue; }
      const board = state.board.slice();
      swapTiles(board, i, j);
      if (findMatchesOnBoard(board).length > 0) res.push({ a: i, b: j });
    }
  }
  return res;
}

export function hint(state: GameState): Move | null {
  const moves = legalMoves(state);
  if (moves.length > 0) return moves[0];
  const special = state.board.findIndex((tile, i) => tile && tile.special !== 'none' && !isVine(state, i));
  return special >= 0 ? { a: special, b: special } : null;
}

export function stars(state: GameState): number {
  if (state.phase !== 'won') return 0;
  if (state.level.moves <= 0) return 1;
  const ratio = state.movesLeft / state.level.moves;
  if (ratio >= 0.3) return 3;
  if (ratio >= 0.15) return 2;
  return 1;
}

function randomPresentColor(state: GameState, excluded: number): Color {
  const present: Color[] = [];
  for (let i = 0; i < N; i++) { const t = state.board[i]; if (t && i !== excluded) present.push(t.color); }
  if (present.length === 0) return ALL_COLORS[0];
  return present[randInt(state, present.length)];
}

function actSwap(state: GameState, a: number, b: number): ActionResult {
  if (!validIndex(a) || !validIndex(b) || a === b) return reject(state, 'index');
  if (!isAdjacent(a, b)) return reject(state, 'not-adjacent');
  const ta = state.board[a], tb = state.board[b];
  if (!ta || !tb) return reject(state, 'empty');
  if (isVine(state, a) || isVine(state, b)) return reject(state, 'vine');
  const specialInvolved = ta.special !== 'none' || tb.special !== 'none';
  const next = cloneState(state);
  swapTiles(next.board, a, b);
  if (!specialInvolved && findMatchesOnBoard(next.board).length === 0) return reject(state, 'no-match');
  const frames: Frame[] = [];
  frames.push(makeFrame('swap', next, [a, b], 0, 0));
  next.turn += 1; next.movesLeft -= 1;
  let initialCells: number[] = [];
  let initialKind: Frame['kind'] = 'clear';
  if (specialInvolved) {
    initialKind = 'special';
    if (ta.special !== 'none' && tb.special !== 'none') {
      initialCells = comboCells(next, ta.special, b, tb.special, a);
    } else if (ta.special !== 'none') {
      initialCells = singleEffectCells(next, ta.special, b, ta.special === 'rainbow' ? tb.color : undefined);
    } else {
      initialCells = singleEffectCells(next, tb.special, a, tb.special === 'rainbow' ? ta.color : undefined);
    }
  }
  const concurrent = specialInvolved ? findMatchesOnBoard(next.board) : [];
  const creations = planSpecials(concurrent, next.board, [b, a]);
  if (specialInvolved) initialCells = Array.from(new Set([...initialCells, a, b, ...concurrent.flat()]));
  runResolve(next, frames, initialCells, initialKind, [b, a], specialInvolved ? [a, b] : [], creations);
  return finish(next, frames);
}

function actActivate(state: GameState, cell: number): ActionResult {
  if (!validIndex(cell)) return reject(state, 'index');
  const t = state.board[cell];
  if (!t || t.special === 'none') return reject(state, 'no-special');
  if (isVine(state, cell)) return reject(state, 'vine');
  const next = cloneState(state);
  const frames: Frame[] = [];
  next.turn += 1; next.movesLeft -= 1;
  const targetColor = t.special === 'rainbow' ? randomPresentColor(next, cell) : undefined;
  runResolve(next, frames, Array.from(new Set([cell, ...singleEffectCells(next, t.special, cell, targetColor)])), 'special', [cell], [cell]);
  return finish(next, frames);
}

function actTool(state: GameState, tool: Tool, cell: number): ActionResult {
  if (!validIndex(cell)) return reject(state, 'index');
  const next = cloneState(state);
  const frames: Frame[] = [];
  if (tool === 'hammer') {
    const ob = next.obstacles[cell], tile = next.board[cell];
    if (!ob && !tile) return reject(state, 'empty');
    if (ob) {
      ob.hp -= 1;
      if (ob.hp <= 0) { next.obstacles[cell] = null; next.cleared[ob.kind]++; }
      frames.push(makeFrame('special', next, [cell], next.score, 1));
      applyGravity(next);
      frames.push(makeFrame('fall', next, [], next.score, 1));
      runResolve(next, frames, [], 'clear', []);
    } else runResolve(next, frames, [cell], 'clear', []);
    return finish(next, frames);
  }
  if (tool === 'color') {
    const tile = next.board[cell];
    if (!tile) return reject(state, 'empty');
    const cells: number[] = [];
    for (let i = 0; i < N; i++) { const t = next.board[i]; if (t && t.color === tile.color) cells.push(i); }
    runResolve(next, frames, cells, 'clear', []);
    return finish(next, frames);
  }
  if (tool === 'shuffle') {
    ensurePlayable(next, frames, true);
    return finish(next, frames);
  }
  return reject(state, 'tool');
}

export function act(state: GameState, command: Command): ActionResult {
  if (state.phase !== 'playing') return reject(state, 'game-over');
  if (command.kind === 'swap') return actSwap(state, command.a, command.b);
  if (command.kind === 'activate') return actActivate(state, command.at);
  return actTool(state, command.tool, command.at);
}
