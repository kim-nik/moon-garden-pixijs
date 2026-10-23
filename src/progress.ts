import { z } from 'zod';
import { dateKey, restorations } from './campaign';
import type { Command, Tool } from './contracts';

const index = z.number().int().min(0).max(63);
export const commandSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('swap'), a: index, b: index }),
  z.object({ kind: z.literal('activate'), at: index }),
  z.object({ kind: z.literal('tool'), tool: z.enum(['hammer', 'shuffle', 'color']), at: index }),
]);
const resultSchema = z.object({ stars: z.number().int().min(1).max(3), score: z.number().int().min(0).max(100000000) });
const profileSchema = z.object({
  version: z.literal(1),
  coins: z.number().int().min(0).max(10000000),
  completed: z.record(z.string().regex(/^(?:[1-9]|[1-9]\d|1[0-7]\d|180)$/), resultSchema),
  tools: z.object({ hammer: z.number().int().min(0).max(999), shuffle: z.number().int().min(0).max(999), color: z.number().int().min(0).max(999) }),
  restored: z.number().int().min(0).max(12),
  daily: z.record(z.string().regex(/^\d{4}-\d{2}-\d{2}$/), resultSchema),
  settings: z.object({ sound: z.boolean(), reducedMotion: z.boolean() }),
  active: z.object({ levelId: z.number().int().min(1).max(181), seed: z.number().int().min(0).max(4294967295), log: z.array(commandSchema).max(10000), dailyKey: z.string().max(10) }).nullable(),
  seen: z.array(z.number().int().min(1).max(181)).max(181),
}).superRefine((profile, ctx) => {
  const spent = restorations.slice(0, profile.restored).reduce((n, r) => n + r.cost, 0);
  const earned = Object.values(profile.completed).reduce((n, r) => n + r.stars, 0);
  if (spent > earned) ctx.addIssue({ code: 'custom', message: 'Восстановление требует заработанных звёзд.' });
  if (Object.keys(profile.daily).length > 3660) ctx.addIssue({ code: 'custom', message: 'Слишком много ежедневных результатов.' });
  if (profile.active?.levelId === 181 && !/^\d{4}-\d{2}-\d{2}$/.test(profile.active.dailyKey)) ctx.addIssue({ code: 'custom', message: 'В ежедневной попытке отсутствует дата.' });
});

export type Profile = z.infer<typeof profileSchema>;
export const toolPrices: Record<Tool, number> = { hammer: 35, shuffle: 45, color: 65 };
export const SAVE_KEY = 'moon-garden:save:v1';

export function newProfile(): Profile {
  return { version: 1, coins: 180, completed: {}, tools: { hammer: 3, shuffle: 3, color: 2 }, restored: 0, daily: {}, settings: { sound: true, reducedMotion: false }, active: null, seen: [] };
}

export function totalStars(profile: Profile): number {
  return Object.values(profile.completed).reduce((n, r) => n + r.stars, 0);
}

export function availableStars(profile: Profile): number {
  return totalStars(profile) - restorations.slice(0, profile.restored).reduce((n, r) => n + r.cost, 0);
}

export function unlockedLevel(profile: Profile): number {
  let next = 1;
  while (next < 180 && profile.completed[String(next)]) next++;
  return next;
}

export function completeLevel(profile: Profile, levelId: number, stars: number, score: number, dailyKey = dateKey()): { profile: Profile; reward: number } {
  const next = structuredClone(profile);
  next.active = null;
  const records = levelId === 181 ? next.daily : next.completed;
  const key = levelId === 181 ? dailyKey || dateKey() : String(levelId);
  const previous = records[key];
  const gained = Math.max(0, stars - (previous?.stars ?? 0));
  const reward = levelId === 181 ? previous ? 0 : 80 : (!previous ? 35 : 0) + gained * 10;
  records[key] = { stars: Math.max(stars, previous?.stars ?? 0), score: Math.max(score, previous?.score ?? 0) };
  next.coins += reward;
  return { profile: next, reward };
}

export function buyTool(profile: Profile, tool: Tool): Profile | null {
  if (profile.coins < toolPrices[tool] || profile.tools[tool] >= 999) return null;
  const next = structuredClone(profile);
  next.coins -= toolPrices[tool];
  next.tools[tool]++;
  return next;
}

export function restoreGarden(profile: Profile): Profile | null {
  const item = restorations[profile.restored];
  if (!item || availableStars(profile) < item.cost) return null;
  const next = structuredClone(profile);
  next.restored++;
  next.coins += item.reward;
  return next;
}

export function parseProfile(text: string): Profile | null {
  if (text.length > 1000000) return null;
  try {
    const data: unknown = JSON.parse(text);
    const result = profileSchema.safeParse(data);
    return result.success ? result.data : null;
  } catch { return null; }
}

export interface StoragePort { getItem(key: string): string | null; setItem(key: string, value: string): void }

export class ProfileStore {
  profile: Profile;
  available = true;
  corrupted = false;
  private storage: StoragePort | null;

  constructor(storage: StoragePort | null) {
    this.storage = storage;
    this.profile = newProfile();
    if (!storage) { this.available = false; return; }
    try {
      const raw = storage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = parseProfile(raw);
        if (parsed) this.profile = parsed;
        else this.corrupted = true;
      }
    } catch { this.available = false; }
  }

  update(profile: Profile): void {
    this.profile = profile;
    if (!this.storage) return;
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(profile));
      this.available = true;
      this.corrupted = false;
    } catch { this.available = false; }
  }

  record(command: Command): void {
    const next = structuredClone(this.profile);
    if (next.active) next.active.log.push(command);
    this.update(next);
  }
}
