import { describe, expect, it } from 'vitest';
import { availableStars, buyTool, completeLevel, newProfile, parseProfile, ProfileStore, restoreGarden, SAVE_KEY, unlockedLevel } from '../src/progress';

describe('progress and rewards', () => {
  it('awards only new stars and preserves best results on replays', () => {
    const first = completeLevel(newProfile(), 1, 2, 2000);
    expect(first.reward).toBe(55);
    const repeat = completeLevel(first.profile, 1, 1, 1000);
    expect(repeat.reward).toBe(0);
    expect(repeat.profile.completed['1']).toEqual({ stars: 2, score: 2000 });
    const better = completeLevel(repeat.profile, 1, 3, 3000);
    expect(better.reward).toBe(10);
    expect(unlockedLevel(better.profile)).toBe(2);
  });
  it('daily reward is once per date', () => {
    const first = completeLevel(newProfile(), 181, 1, 2000, '2026-10-23');
    expect(first.reward).toBe(80);
    expect(completeLevel(first.profile, 181, 3, 5000, '2026-10-23').reward).toBe(0);
    expect(unlockedLevel(first.profile)).toBe(1);
    const defaultDate = completeLevel(newProfile(), 181, 1, 2000);
    expect(parseProfile(JSON.stringify(defaultDate.profile))).toEqual(defaultDate.profile);
  });
  it('spends garden stars once without removing completion stars', () => {
    const profile = completeLevel(newProfile(), 1, 3, 3000).profile;
    const restored = restoreGarden(profile);
    expect(restored?.restored).toBe(1);
    expect(restored && availableStars(restored)).toBe(0);
    expect(restored?.completed['1'].stars).toBe(3);
    expect(restored && restoreGarden(restored)).toBeNull();
  });
  it('never buys a tool without enough seeds', () => {
    const profile = newProfile();
    profile.coins = 0;
    expect(buyTool(profile, 'color')).toBeNull();
    expect(profile.tools.color).toBe(2);
  });
  it('validates imports, and keeps playing if saving is unavailable', () => {
    expect(parseProfile('{bad')).toBeNull();
    expect(parseProfile(JSON.stringify({ ...newProfile(), coins: -4 }))).toBeNull();
    expect(parseProfile(JSON.stringify({ ...newProfile(), restored: 12 }))).toBeNull();
    const port = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
    const store = new ProfileStore(port);
    store.update(completeLevel(store.profile, 1, 1, 1000).profile);
    expect(store.available).toBe(false);
    expect(unlockedLevel(store.profile)).toBe(2);
    const saved = new ProfileStore({ getItem: () => 'bad', setItem: () => {} });
    expect(saved.corrupted).toBe(true);
    saved.update(newProfile());
    expect(saved.corrupted).toBe(false);
  });
  it('round-trips an accepted-command log without losing settings', () => {
    const data = new Map<string, string>();
    const port = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
    const store = new ProfileStore(port);
    store.profile.active = { levelId: 1, seed: 123, log: [], dailyKey: '' };
    store.record({ kind: 'swap', a: 3, b: 4 });
    expect(data.has(SAVE_KEY)).toBe(true);
    const resumed = new ProfileStore(port);
    expect(resumed.profile.active?.log).toEqual([{ kind: 'swap', a: 3, b: 4 }]);
    expect(resumed.profile.settings.sound).toBe(true);
  });
});
