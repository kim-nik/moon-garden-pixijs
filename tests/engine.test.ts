import { describe, it, expect } from 'vitest';
import type { Color, GameState, Level, Obstacle, Special, Tile } from '../src/contracts';
import { act, createGame, findMatches, goalValue, hint, legalMoves, stars } from '../src/engine';

function level(overrides: Partial<Level> = {}): Level {
  return {
    id: 1, chapter: 1, title: 'test', story: 'story', seed: 123, colors: 5, moves: 12,
    goals: [{ kind: 'score', amount: 100000 }], obstacles: [], difficulty: 'normal',
    ...overrides,
  };
}

let idCounter = 1;
function tile(color: Color, special: Special = 'none'): Tile {
  return { id: idCounter++, color, special };
}

function fromGrid(grid: (Color | null)[][]): (Tile | null)[] {
  const board: (Tile | null)[] = new Array(64).fill(null);
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const v = grid[r][c];
      board[r * 8 + c] = v === null ? null : tile(v);
    }
  }
  return board;
}

function cleanGrid(): (Color | null)[][] {
  return [
    [0, 1, 2, 3, 4, 0, 1, 2],
    [1, 2, 3, 4, 0, 1, 2, 3],
    [2, 3, 4, 0, 1, 2, 3, 4],
    [3, 4, 0, 1, 2, 3, 4, 0],
    [4, 0, 1, 2, 3, 4, 0, 1],
    [0, 1, 2, 3, 4, 0, 1, 2],
    [1, 2, 3, 4, 0, 1, 2, 3],
    [2, 3, 4, 0, 1, 2, 3, 4],
  ];
}

function mkState(board: (Tile | null)[], overrides: Partial<GameState> = {}): GameState {
  return {
    level: level(), board,
    obstacles: new Array<Obstacle | null>(64).fill(null),
    rng: 999, nextId: 100000, movesLeft: 12, score: 0,
    collected: [0, 0, 0, 0, 0, 0], cleared: { ice: 0, crate: 0, vine: 0 },
    phase: 'playing', turn: 0,
    ...overrides,
  };
}

describe('createGame', () => {
  it('produces a settled board with at least one legal move', () => {
    const s = createGame(level());
    expect(s.board.length).toBe(64);
    expect(s.obstacles.length).toBe(64);
    expect(findMatches(s).length).toBe(0);
    expect(legalMoves(s).length).toBeGreaterThan(0);
  });

  it('is deterministic for a given seed', () => {
    const a = createGame(level());
    const b = createGame(level());
    expect(a.board.map((x) => (x ? x.color : null))).toEqual(b.board.map((x) => (x ? x.color : null)));
    expect(a.rng).toBe(b.rng);
  });

  it('replays identical sequences identically', () => {
    const a = createGame(level());
    const b = createGame(level());
    const m = hint(a);
    expect(m).not.toBeNull();
    if (!m) return;
    expect(JSON.stringify(act(a, { kind: 'swap', a: m.a, b: m.b })))
      .toBe(JSON.stringify(act(b, { kind: 'swap', a: m.a, b: m.b })));
  });
});

describe('act validation', () => {
  it('rejects a non-adjacent swap with the identical state reference', () => {
    const s = createGame(level());
    const res = act(s, { kind: 'swap', a: 0, b: 9 });
    expect(res.ok).toBe(false);
    expect(res.state).toBe(s);
  });

  it('rejects a no-match swap without mutating input', () => {
    const s = mkState(fromGrid(cleanGrid()));
    const before = JSON.stringify(s);
    const res = act(s, { kind: 'swap', a: 0, b: 1 });
    expect(res.ok).toBe(false);
    expect(res.state).toBe(s);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('rejects activate on a non-special', () => {
    const s = mkState(fromGrid(cleanGrid()));
    const res = act(s, { kind: 'activate', at: 0 });
    expect(res.ok).toBe(false);
  });
});

describe('matches and legal moves', () => {
  it('finds maximal horizontal and vertical runs', () => {
    const grid = cleanGrid();
    grid[0][0] = 0; grid[0][1] = 0; grid[0][2] = 0;
    grid[0][7] = 1; grid[1][7] = 1; grid[2][7] = 1;
    const runs = findMatches(mkState(fromGrid(grid)));
    const hasH = runs.some((r) => r.length === 3 && r[0] === 0 && r[2] === 2);
    const hasV = runs.some((r) => r.length === 3 && r[0] === 7 && r[2] === 23);
    expect(hasH).toBe(true);
    expect(hasV).toBe(true);
  });

  it('hint returns a move that produces a match', () => {
    const grid = cleanGrid();
    grid[0][2] = 0; grid[1][1] = 0;
    const s = mkState(fromGrid(grid));
    const m = hint(s);
    expect(m).not.toBeNull();
  });
});

describe('specials', () => {
  it('activate row special clears its row and spends a move', () => {
    const s = mkState(fromGrid(cleanGrid()));
    s.board[28] = tile(0, 'row');
    const res = act(s, { kind: 'activate', at: 28 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.movesLeft).toBe(11);
    expect(res.state.score).toBeGreaterThanOrEqual(480);
  });

  it('swapping two line specials triggers a cross combo', () => {
    const s = mkState(fromGrid(cleanGrid()));
    s.board[0] = tile(0, 'row');
    s.board[1] = tile(1, 'column');
    const res = act(s, { kind: 'swap', a: 0, b: 1 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.movesLeft).toBe(11);
    expect(res.state.score).toBeGreaterThanOrEqual(15 * 60);
  });

  it('a 4-in-a-row creates a row special at the swapped destination', () => {
    const grid = cleanGrid();
    grid[0][0] = 0; grid[0][1] = 0; grid[0][2] = 0; grid[0][3] = 1;
    grid[1][3] = 0;
    const s = mkState(fromGrid(grid));
    const res = act(s, { kind: 'swap', a: 3, b: 11 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.board.some((x) => x !== null && x.special === 'row')).toBe(true);
  });
  it('five in a row creates a rainbow in the first settled frame', () => {
    const grid = cleanGrid();
    for (const c of [0, 1, 3, 4]) grid[0][c] = 0;
    grid[0][2] = 1;
    grid[0][5] = 2;
    grid[1][2] = 0;
    const res = act(mkState(fromGrid(grid)), { kind: 'swap', a: 10, b: 2 });
    expect(res.ok).toBe(true);
    expect(res.frames.find(f => f.kind === 'fall')?.board.some(t => t?.special === 'rainbow')).toBe(true);
  });
  it('intersecting horizontal and vertical matches create a bomb', () => {
    const grid = cleanGrid();
    grid[3][2] = 0; grid[3][3] = 1; grid[3][4] = 0;
    grid[1][3] = 0; grid[2][3] = 0; grid[4][3] = 0;
    const res = act(mkState(fromGrid(grid)), { kind: 'swap', a: 35, b: 27 });
    expect(res.ok).toBe(true);
    expect(res.frames.find(f => f.kind === 'fall')?.board.some(t => t?.special === 'bomb')).toBe(true);
  });
});

describe('obstacles', () => {
  it('crate is immobile and blocks its cell', () => {
    const lv = level({ obstacles: [{ index: 10, kind: 'crate', hp: 2 }] });
    const s = createGame(lv);
    expect(s.board[10]).toBeNull();
    expect(s.obstacles[10]?.kind).toBe('crate');
  });

  it('vine blocks an otherwise-valid swap', () => {
    const grid = cleanGrid();
    grid[0][2] = 0; grid[1][1] = 0;
    const free = mkState(fromGrid(grid));
    expect(act(free, { kind: 'swap', a: 1, b: 9 }).ok).toBe(true);

    const blocked = mkState(fromGrid(grid));
    blocked.obstacles[1] = { kind: 'vine', hp: 1 };
    const res = act(blocked, { kind: 'swap', a: 1, b: 9 });
    expect(res.ok).toBe(false);
  });
});

describe('goals, tools, and terminal phases', () => {
  it('wins when the score goal is met, with a remaining-move bonus', () => {
    const grid = cleanGrid();
    grid[0][2] = 0; grid[1][1] = 0;
    const s = mkState(fromGrid(grid));
    s.level = level({ goals: [{ kind: 'score', amount: 100 }], moves: 5 });
    s.movesLeft = 5;
    const res = act(s, { kind: 'swap', a: 1, b: 9 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.phase).toBe('won');
    expect(res.state.score).toBeGreaterThanOrEqual(580);
    expect(stars(res.state)).toBeGreaterThanOrEqual(1);
  });

  it('loses when moves run out without meeting goals', () => {
    const grid = cleanGrid();
    grid[0][2] = 0; grid[1][1] = 0;
    const s = mkState(fromGrid(grid));
    s.level = level({ goals: [{ kind: 'score', amount: 999999 }], moves: 1 });
    s.movesLeft = 1;
    const res = act(s, { kind: 'swap', a: 1, b: 9 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.phase).toBe('lost');
  });

  it('hammer removes one crate layer without spending a move', () => {
    const lv = level({ obstacles: [{ index: 10, kind: 'crate', hp: 3 }] });
    const s = createGame(lv);
    const res = act(s, { kind: 'tool', tool: 'hammer', at: 10 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.obstacles[10]?.hp).toBe(2);
    expect(res.state.cleared.crate).toBe(0);
    expect(res.state.movesLeft).toBe(s.movesLeft);
  });

  it('color tool clears every tile of the target color', () => {
    const s = mkState(fromGrid(cleanGrid()));
    s.level = level({ goals: [{ kind: 'score', amount: 999999 }], moves: 3 });
    s.movesLeft = 3;
    const target = s.board.findIndex((x) => x !== null && x.color === 0);
    const count = s.board.filter((x) => x !== null && x.color === 0).length;
    const res = act(s, { kind: 'tool', tool: 'color', at: target });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.collected[0]).toBeGreaterThanOrEqual(count);
    expect(res.state.movesLeft).toBe(3);
  });
});

describe('purity and snapshots', () => {
  it('a successful act does not mutate the input state', () => {
    const grid = cleanGrid();
    grid[0][2] = 0; grid[1][1] = 0;
    const s = mkState(fromGrid(grid));
    const before = JSON.stringify(s);
    act(s, { kind: 'swap', a: 1, b: 9 });
    expect(JSON.stringify(s)).toBe(before);
  });

  it('frame boards are isolated snapshots', () => {
    const grid = cleanGrid();
    grid[0][2] = 0; grid[1][1] = 0;
    const s = mkState(fromGrid(grid));
    s.level = level({ goals: [{ kind: 'score', amount: 999999 }], moves: 3 });
    const res = act(s, { kind: 'swap', a: 1, b: 9 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const swapFrame = res.frames.find((f) => f.kind === 'swap');
    expect(swapFrame).toBeDefined();
    if (!swapFrame) return;
    const snapshot = swapFrame.board.slice();
    res.state.board[0] = null;
    expect(swapFrame.board).toEqual(snapshot);
    expect(swapFrame.board[0]).not.toBeNull();
  });

  it('goalValue and stars reflect state', () => {
    const s = mkState(fromGrid(cleanGrid()));
    s.level = level({ goals: [{ kind: 'score', amount: 500 }] });
    expect(goalValue(s, s.level.goals[0])).toBe(0);
    expect(stars(s)).toBe(0);
    s.score = 600;
    expect(goalValue(s, s.level.goals[0])).toBe(600);
  });
});
