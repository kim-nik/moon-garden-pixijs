import { describe, expect, it } from 'vitest';
import { levels } from '../src/campaign';
import { act, createGame, findMatches, legalMoves, stars } from '../src/engine';
import type { ActionResult, GameState } from '../src/contracts';

function ongoing(): GameState {
  const state = createGame({ ...levels[100], obstacles: [], goals: [{ kind: 'score', amount: 10000000 }] });
  state.obstacles.fill(null);
  return state;
}
function accepted(result: ActionResult): asserts result is Extract<ActionResult, { ok: true }> { expect(result.ok).toBe(true); if (!result.ok) throw new Error(result.reason); }

describe('rule boundaries', () => {
  it('does not mutate obstacle objects or snapshots across accepted actions', () => {
    const state = ongoing();
    state.obstacles[0] = { kind: 'ice', hp: 2 };
    const original = JSON.stringify(state);
    const result = act(state, { kind: 'tool', tool: 'color', at: 0 });
    accepted(result);
    expect(JSON.stringify(state)).toBe(original);
    const frame = result.frames[0];
    expect(frame.obstacles[0]?.hp).toBe(2);
    const before = JSON.stringify(frame);
    const second = act(result.state, { kind: 'tool', tool: 'color', at: 0 });
    accepted(second);
    expect(JSON.stringify(frame)).toBe(before);
  });
  it('consumes a rainbow and clears the swapped color without a second root effect', () => {
    const state = ongoing();
    const tile = state.board[0];
    const neighbor = state.board[1];
    if (!tile || !neighbor) throw new Error('Missing plant');
    state.board[0] = { ...tile, special: 'rainbow', color: neighbor.color === 0 ? 1 : 0 };
    const expected = state.board.flatMap((t, i) => t?.color === neighbor.color || i === 0 ? [i] : []);
    const result = act(state, { kind: 'swap', a: 0, b: 1 });
    accepted(result);
    const clear = result.frames.find(f => f.kind === 'special');
    expect(clear?.cells.slice().sort((a, b) => a - b)).toEqual(expected.sort((a, b) => a - b));
    expect(result.state.board.some(t => t?.id === tile.id)).toBe(false);
  });
  it('propagates an activated line into a second line it hits', () => {
    const state = ongoing();
    const first = state.board[0], second = state.board[3];
    if (!first || !second) throw new Error('Missing plant');
    state.board[0] = { ...first, special: 'row' };
    state.board[3] = { ...second, special: 'column' };
    const result = act(state, { kind: 'activate', at: 0 });
    accepted(result);
    const clear = result.frames.find(f => f.kind === 'special');
    expect(clear?.cells).toContain(59);
    expect(clear?.cells.length).toBe(15);
  });
  it('keeps vine-bound plants fixed when a lower row disappears', () => {
    const state = ongoing();
    const held = state.board[16];
    const trigger = state.board[56];
    if (!trigger) throw new Error('Missing plant');
    state.obstacles[16] = { kind: 'vine', hp: 2 };
    state.board[56] = { ...trigger, special: 'row' };
    const result = act(state, { kind: 'activate', at: 56 });
    accepted(result);
    const firstFall = result.frames.find(f => f.kind === 'fall');
    expect(firstFall?.board[16]?.id).toBe(held?.id);
  });
  it('reshuffles without discarding existing plants, specials, goals or moves', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const state = createGame({ ...levels[70], goals: [{ kind: 'score', amount: 10000000 }] }, seed);
      const first = state.board.findIndex(t => t !== null && !state.obstacles[state.board.indexOf(t)]);
      const tile = state.board[first];
      if (!tile) throw new Error('Missing plant');
      state.board[first] = { ...tile, special: 'bomb' };
      const ids = state.board.flatMap(t => t ? [t.id] : []).sort((a, b) => a - b);
      const original = JSON.stringify(state);
      const result = act(state, { kind: 'tool', tool: 'shuffle', at: 0 });
      accepted(result);
      expect(result.state.board.flatMap(t => t ? [t.id] : []).sort((a, b) => a - b)).toEqual(ids);
      expect(result.state.board.some(t => t?.id === tile.id && t.special === 'bomb')).toBe(true);
      expect(findMatches(result.state)).toHaveLength(0);
      expect(legalMoves(result.state).length).toBeGreaterThan(0);
      expect(result.state.score).toBe(0);
      expect(result.state.movesLeft).toBe(state.movesLeft);
      expect(result.state.collected).toEqual(state.collected);
      expect(JSON.stringify(state)).toBe(original);
    }
  });
  it('removes a layered obstacle only after both hammer hits', () => {
    const state = ongoing();
    state.obstacles[2] = { kind: 'ice', hp: 2 };
    const first = act(state, { kind: 'tool', tool: 'hammer', at: 2 });
    accepted(first);
    expect(first.state.obstacles[2]?.hp).toBe(1);
    expect(first.state.cleared.ice).toBe(0);
    const second = act(first.state, { kind: 'tool', tool: 'hammer', at: 2 });
    accepted(second);
    expect(second.state.obstacles[2]).toBeNull();
    expect(second.state.cleared.ice).toBe(1);
  });
  it('rejects terminal actions and respects star thresholds', () => {
    const state = ongoing();
    state.phase = 'won';
    state.movesLeft = Math.ceil(state.level.moves * .3);
    expect(stars(state)).toBe(3);
    expect(act(state, { kind: 'tool', tool: 'shuffle', at: 0 }).ok).toBe(false);
    state.movesLeft = 0;
    expect(stars(state)).toBe(1);
  });
  it('resolves a normal match formed at the same time as a special swap', () => {
    const state = ongoing();
    for (const i of [0, 2, 9]) {
      const tile = state.board[i];
      if (tile) state.board[i] = { ...tile, color: 1, special: 'none' };
    }
    const trigger = state.board[1];
    if (!trigger) throw new Error('Missing plant');
    state.board[1] = { ...trigger, color: 0, special: 'row' };
    const result = act(state, { kind: 'swap', a: 1, b: 9 });
    accepted(result);
    const initial = result.frames.find(frame => frame.kind === 'special');
    expect(initial?.cells).toEqual(expect.arrayContaining([0, 1, 2, 8, 9, 10, 11, 12, 13, 14, 15]));
  });
  it('never chooses a unique rainbow-only color during activation', () => {
    const state = ongoing();
    const first = state.board[0];
    if (!first) throw new Error('Missing plant');
    state.board[0] = { ...first, color: 5, special: 'rainbow' };
    const result = act(state, { kind: 'activate', at: 0 });
    accepted(result);
    const initial = result.frames.find(frame => frame.kind === 'special');
    expect(initial?.cells.length).toBeGreaterThan(1);
    expect(result.state.board.some(tile => tile?.id === first.id)).toBe(false);
  });
  it('rescues an isolated free cell with an activatable special after shuffle exhaustion', () => {
    const state = ongoing();
    const first = state.board[0];
    if (!first) throw new Error('Missing plant');
    state.board.fill(null);
    state.obstacles = Array.from({ length: 64 }, () => ({ kind: 'crate', hp: 1 }));
    state.board[0] = first;
    state.obstacles[0] = null;
    const result = act(state, { kind: 'tool', tool: 'shuffle', at: 0 });
    accepted(result);
    expect(result.state.phase).toBe('playing');
    expect(result.state.board[0]?.special).toBe('bomb');
    const explosion = act(result.state, { kind: 'activate', at: 0 });
    accepted(explosion);
    expect(explosion.state.cleared.crate).toBeGreaterThan(0);
  });
});
