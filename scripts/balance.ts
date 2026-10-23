import { mkdirSync, writeFileSync } from 'node:fs';
import { levels } from '../src/campaign';
import { act, createGame, findMatches, goalValue, legalMoves } from '../src/engine';
import type { Command, GameState, Goal, Level } from '../src/contracts';

const attempts = Number(process.env.BALANCE_ATTEMPTS ?? 5);
const filter = Number(process.env.BALANCE_LEVEL ?? 0);
const campaign = filter ? levels.filter(l => l.id === filter) : levels;
const rows: { level: number; chapter: number; colors: number; obstacles: number; signature: string; solved: boolean; tries: number; moves: number; score: number; seed: number; commands: Command[] }[] = [];

function progress(state: GameState, goal: Goal): number { return Math.min(goal.amount, goalValue(state, goal)) / goal.amount; }

function potential(state: GameState): number {
  return state.board.reduce((n, tile) => n + (tile?.special === 'rainbow' ? 0.06 : tile?.special === 'bomb' ? 0.025 : tile && tile.special !== 'none' ? 0.018 : 0), 0);
}

function merit(before: GameState, after: GameState, path: number, choice: number): number {
  if (after.phase === 'won') return 1000 + after.movesLeft;
  let delta = 0;
  for (const goal of before.level.goals) {
    const weight = goal.kind === 'clear' ? 1.4 : goal.kind === 'collect' ? 1 : 0.6;
    delta += (progress(after, goal) - progress(before, goal)) * weight;
  }
  const oldHp = before.obstacles.reduce((n, o) => n + (o?.hp ?? 0), 0);
  const newHp = after.obstacles.reduce((n, o) => n + (o?.hp ?? 0), 0);
  const jitter = path ? (((choice * 1103515245 + path * 12345 + before.turn * 7919) >>> 0) % 1000) / 1000 * 0.035 : 0;
  return delta + (potential(after) - potential(before)) * 0.8 + (oldHp - newHp) * 0.001 + jitter;
}

function play(level: Level, path: number): { state: GameState; commands: Command[] } {
  let state = createGame(level);
  const commands: Command[] = [];
  while (state.phase === 'playing' && commands.length < level.moves + 2) {
    if (findMatches(state).length) throw new Error(`Unsettled board on level ${level.id}`);
    const choices: Command[] = legalMoves(state).map(move => ({ kind: 'swap', ...move }));
    state.board.forEach((tile, at) => { if (tile && tile.special !== 'none' && state.obstacles[at]?.kind !== 'vine') choices.push({ kind: 'activate', at }); });
    let best: { state: GameState; command: Command; value: number } | null = null;
    for (const [i, command] of choices.entries()) {
      const result = act(state, command);
      if (!result.ok) continue;
      const value = merit(state, result.state, path, i);
      if (!best || value > best.value) best = { state: result.state, command, value };
    }
    if (!best) throw new Error(`No actionable move on level ${level.id}, turn ${state.turn}`);
    commands.push(best.command);
    state = best.state;
  }
  return { state, commands };
}

for (const level of campaign) {
  const initial = createGame(level);
  if (findMatches(initial).length || !legalMoves(initial).length) throw new Error(`Invalid initial board: ${level.id}`);
  if (JSON.stringify(initial) !== JSON.stringify(createGame(level))) throw new Error(`Non-deterministic level: ${level.id}`);
  for (let variant = 1; variant <= 3; variant++) {
    const alternate = createGame(level, (level.seed + variant * 104729) >>> 0);
    if (findMatches(alternate).length || !legalMoves(alternate).length) throw new Error(`Invalid alternate initial board: ${level.id}/${variant}`);
  }
  for (const goal of level.goals) if (goal.kind === 'clear' && goal.amount > level.obstacles.filter(o => o.kind === goal.obstacle).length) throw new Error(`Impossible obstacle target: ${level.id}`);
  let result = play(level, 0);
  let tries = 1;
  while (result.state.phase !== 'won' && tries < attempts) { result = play(level, tries); tries++; }
  const row = { level: level.id, chapter: level.chapter + 1, colors: level.colors, obstacles: level.obstacles.length, signature: JSON.stringify([level.colors, level.moves, level.goals, level.obstacles]), solved: result.state.phase === 'won', tries, moves: result.commands.length, score: result.state.score, seed: level.seed, commands: result.commands };
  rows.push(row);
  let replay = createGame(level);
  for (const command of row.commands) {
    const result = act(replay, command);
    if (!result.ok) throw new Error(`Replay rejected: ${level.id}`);
    replay = result.state;
  }
  if (JSON.stringify(replay) !== JSON.stringify(result.state)) throw new Error(`Replay diverged: ${level.id}`);
  process.stdout.write(`${String(level.id).padStart(3)} ${row.solved ? 'WIN ' : 'FAIL'} ${String(row.moves).padStart(2)} moves ${tries} tries\n`);
}

mkdirSync('reports/verification', { recursive: true });
const solved = rows.filter(r => r.solved);
const totalMoves = rows.reduce((n, r) => n + r.moves, 0);
const report = {
  generatedAt: new Date().toISOString(), engineVersion: 1,
  method: 'Deterministic goal-aware greedy agent; canonical campaign seed; alternative tie-break paths, no tools; actual accepted commands included for every successful run.',
  levels: rows.length, solved: solved.length, unsolved: rows.filter(r => !r.solved).map(r => r.level),
  initialBoardsChecked: rows.length * 4, successfulRunsIndependentlyReplayed: solved.length,
  uniqueConfigurations: new Set(rows.map(r => r.signature)).size,
  movesInRecordedRuns: totalMoves, meanMoves: Number((totalMoves / rows.length).toFixed(2)),
  pacing: { humanPlaytest: false, assumedSecondsPerMove: [4, 6, 8], hoursFromRecordedMovesOnly: [4, 6, 8].map(seconds => Number((totalMoves * seconds / 3600).toFixed(2))), note: 'Assumptions, not measured human duration. Excludes failed paths, menu reading, garden, daily mode and replays. A bot solution does not prove typical human difficulty.' },
  rows,
};
writeFileSync(`reports/verification/${filter ? `level-${filter}` : 'balance'}.json`, JSON.stringify(report, null, 2));
writeFileSync(`reports/verification/${filter ? `level-${filter}` : 'balance'}.tsv`, ['level\tchapter\tcolors\tobstacles\tsolved\ttries\tmoves\tscore', ...rows.map(r => [r.level, r.chapter, r.colors, r.obstacles, r.solved, r.tries, r.moves, r.score].join('\t'))].join('\n') + '\n');
process.stdout.write(JSON.stringify({ levels: report.levels, solved: report.solved, unsolved: report.unsolved, uniqueConfigurations: report.uniqueConfigurations, totalMoves, pacing: report.pacing }, null, 2) + '\n');
if (report.unsolved.length) process.exitCode = 1;
