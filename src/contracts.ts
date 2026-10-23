export type Color = 0 | 1 | 2 | 3 | 4 | 5;
export type Special = 'none' | 'row' | 'column' | 'bomb' | 'rainbow';
export type ObstacleKind = 'ice' | 'crate' | 'vine';
export type Tool = 'hammer' | 'shuffle' | 'color';
export interface Tile { id: number; color: Color; special: Special }
export interface Obstacle { kind: ObstacleKind; hp: number }
export type Goal =
  | { kind: 'score'; amount: number }
  | { kind: 'collect'; color: Color; amount: number }
  | { kind: 'clear'; obstacle: ObstacleKind; amount: number };
export interface Level {
  id: number;
  chapter: number;
  title: string;
  story: string;
  seed: number;
  colors: number;
  moves: number;
  goals: Goal[];
  obstacles: { index: number; kind: ObstacleKind; hp: number }[];
  difficulty: 'gentle' | 'normal' | 'hard';
}
export interface Chapter { id: number; name: string; subtitle: string; description: string; color: string; mechanic: string }
export interface GameState {
  level: Level;
  board: (Tile | null)[];
  obstacles: (Obstacle | null)[];
  rng: number;
  nextId: number;
  movesLeft: number;
  score: number;
  collected: number[];
  cleared: Record<ObstacleKind, number>;
  phase: 'playing' | 'won' | 'lost';
  turn: number;
}
export type Command =
  | { kind: 'swap'; a: number; b: number }
  | { kind: 'activate'; at: number }
  | { kind: 'tool'; tool: Tool; at: number };
export interface Frame {
  kind: 'swap' | 'clear' | 'fall' | 'shuffle' | 'special';
  board: (Tile | null)[];
  obstacles: (Obstacle | null)[];
  cells: number[];
  score: number;
  combo: number;
}
export type ActionResult =
  | { ok: true; state: GameState; frames: Frame[] }
  | { ok: false; state: GameState; reason: string; frames: Frame[] };
export interface Move { a: number; b: number }
export interface Restoration { id: number; name: string; description: string; cost: number; reward: number }
