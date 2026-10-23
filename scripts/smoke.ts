import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { chromium, expect, type Page } from '@playwright/test';
import { z } from 'zod';
import { dateKey, dailyLevel, levels } from '../src/campaign';
import { act, createGame, legalMoves } from '../src/engine';
import { commandSchema, completeLevel, newProfile, parseProfile, SAVE_KEY, type Profile } from '../src/progress';
import type { Command, GameState } from '../src/contracts';

const baseURL = process.env.GAME_URL ?? 'http://localhost:5173';
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : 'chromium') });
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
const errors: string[] = [];
const checks: string[] = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
mkdirSync('reports/verification', { recursive: true });

async function profile(): Promise<Profile> {
  const raw = await page.evaluate(key => localStorage.getItem(key), SAVE_KEY);
  const parsed = raw ? parseProfile(raw) : null;
  assert(parsed, 'valid saved profile');
  return parsed;
}

async function clickCell(at: number, gesture: 'tap' | 'swipe' = 'tap', to = at): Promise<void> {
  const canvas = page.locator('canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  assert(box);
  const point = (i: number) => ({ x: box.x + (16 + i % 8 * 68 + 34) / 576 * box.width, y: box.y + (16 + Math.floor(i / 8) * 68 + 34) / 576 * box.height });
  const a = point(at);
  if (gesture === 'tap') await page.mouse.click(a.x, a.y);
  else {
    const b = point(to);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 4 });
    await page.mouse.up();
  }
}

async function command(input: Command, swipe = false): Promise<void> {
  const before = await profile();
  const length = before.active?.log.length ?? 0;
  if (input.kind === 'swap') {
    if (swipe) await clickCell(input.a, 'swipe', input.b);
    else { await clickCell(input.a); await clickCell(input.b); }
  } else if (input.kind === 'activate') { await clickCell(input.at); await clickCell(input.at); }
  else {
    await page.locator(`[data-action="tool"][data-tool="${input.tool}"]`).click();
    if (input.tool !== 'shuffle') await clickCell(input.at);
  }
  await expect.poll(async () => {
    const p = await profile();
    return !p.active || p.active.log.length > length;
  }, { timeout: 15000 }).toBe(true);
  await expect(page.locator('#board')).toHaveAttribute('aria-busy', 'false');
}

function resume(p: Profile): GameState {
  assert(p.active);
  let state = createGame(p.active.levelId === 181 ? dailyLevel(p.active.dailyKey) : levels[p.active.levelId - 1], p.active.seed);
  for (const input of p.active.log) {
    const result = act(state, input);
    assert(result.ok);
    state = result.state;
  }
  return state;
}

try {
  await page.goto(baseURL);
  await expect(page.locator('canvas')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('#modal')).toBeVisible();
  await expect(page.locator('#modal-title')).toHaveText('У каждого сада есть начало.');
  await page.locator('[data-action="begin"]').click();
  checks.push('Fresh profile, PixiJS canvas and first-run tutorial');

  const initial = resume(await profile());
  let invalid: Command | null = null;
  for (let i = 0; i < 63; i++) {
    if (i % 8 === 7) continue;
    if (!act(initial, { kind: 'swap', a: i, b: i + 1 }).ok) { invalid = { kind: 'swap', a: i, b: i + 1 }; break; }
  }
  assert(invalid && invalid.kind === 'swap');
  await clickCell(invalid.a);
  await clickCell(invalid.b);
  await expect(page.locator('#game-status')).toContainText('ход не потрачен');
  assert.equal((await profile()).active?.log.length, 0);
  await expect(page.locator('#moves')).toHaveText(String(initial.movesLeft));
  checks.push('Invalid real pointer swap is rejected without spending a move');
  await expect(page.locator('#board')).toHaveAttribute('aria-busy', 'false');

  await page.locator('[data-action="hint"]').click();
  await expect(page.locator('#game-status')).toContainText('Подсказка');
  await page.locator('canvas').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#game-status')).toContainText('Ряд');
  await page.keyboard.press('Escape');
  checks.push('Free hint and keyboard cell navigation');

  await page.locator('[data-action="settings"]').click();
  await page.locator('#setting-motion').check();
  await page.locator('#setting-sound').uncheck();
  await page.locator('#modal .modal-top [data-action="close"]').click();
  assert.equal((await profile()).settings.reducedMotion, true);

  const report = z.object({ rows: z.array(z.object({ level: z.number(), commands: z.array(commandSchema) })) }).parse(JSON.parse(readFileSync('reports/verification/balance.json', 'utf8')));
  for (let id = 1; id <= 3; id++) {
    const run = report.rows.find(row => row.level === id);
    assert(run);
    for (const input of run.commands) await command(input, id === 2);
    await expect(page.locator('#modal-title')).toHaveText('Ещё немного жизни.');
    assert((await profile()).completed[String(id)]);
    if (id < 3) await page.locator('[data-action="next"]').click();
  }
  checks.push('Levels 1–3 won with real pointer taps and swipes, rewards and sequential unlocking');

  await page.locator('#modal [data-action="garden"]').click();
  const gardenBefore = await profile();
  await page.locator('[data-action="restore"]').click();
  const gardenAfter = await profile();
  assert.equal(gardenAfter.restored, 1);
  assert.equal(gardenAfter.coins, gardenBefore.coins + 40);
  await expect(page.locator('.restoration-next h3')).toHaveText('Первые клумбы');
  await page.screenshot({ path: 'reports/verification/garden.png', fullPage: true });
  await page.locator('#modal .modal-top [data-action="close"]').click();
  checks.push('Garden restoration spends stars, adds reward and advances visible story');

  await page.locator('[data-action="result"]').click();
  await page.locator('[data-action="next"]').click();
  await page.locator('[data-action="begin"]').click();
  let ongoing = resume(await profile());
  const move = legalMoves(ongoing).find(move => {
    const result = act(ongoing, { kind: 'swap', ...move });
    return result.ok && result.state.phase === 'playing';
  });
  assert(move);
  await command({ kind: 'swap', ...move });
  const beforeReload = await profile();
  const oldState = resume(beforeReload);
  await page.reload();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('#moves')).toHaveText(String(oldState.movesLeft));
  const afterReload = await profile();
  assert.deepEqual(afterReload, beforeReload);
  assert.deepEqual(resume(afterReload), oldState);
  checks.push('Reload restores exact active board, moves, inventory, rewards and settings');

  ongoing = resume(afterReload);
  const toolBefore = await profile();
  await command({ kind: 'tool', tool: 'hammer', at: 0 });
  const toolAfter = await profile();
  assert.equal(toolAfter.tools.hammer, toolBefore.tools.hammer - 1);
  await expect(page.locator('#moves')).toHaveText(String(ongoing.movesLeft));
  checks.push('Tool uses one inventory item and leaves moves unchanged');

  await page.locator('[data-action="pause"]').click();
  const paused = await profile();
  await clickCell(3);
  assert.deepEqual(await profile(), paused);
  await page.locator('#modal .modal-top [data-action="close"]').click();
  checks.push('Pause dialog blocks board actions');

  await page.locator('[data-action="shop"]').click();
  const buyBefore = await profile();
  await page.locator('[data-action="buy"][data-tool="shuffle"]').click();
  const buyAfter = await profile();
  assert.equal(buyAfter.tools.shuffle, buyBefore.tools.shuffle + 1);
  assert.equal(buyAfter.coins, buyBefore.coins - 45);
  await page.locator('#modal .modal-top [data-action="close"]').click();
  checks.push('Shop purchase spends seeds and grants one tool');

  await page.locator('[data-action="map"]').click();
  await expect(page.locator('.level-node')).toHaveCount(30);
  await expect(page.locator('[data-level="5"]')).toBeDisabled();
  for (let chapter = 0; chapter < 6; chapter++) {
    await page.locator(`[data-action="map-chapter"][data-chapter="${chapter}"]`).click();
    await expect(page.locator('.level-node')).toHaveCount(30);
  }
  await page.screenshot({ path: 'reports/verification/map.png', fullPage: true });
  await page.locator('#modal .modal-top [data-action="close"]').click();
  checks.push('All 6 map chapters render 30 levels each and lock future levels');

  await page.locator('[data-action="journal"]').click();
  await expect(page.locator('.mechanic.locked')).toHaveCount(7);
  await page.locator('#modal .modal-top [data-action="close"]').click();
  await page.locator('[data-action="daily"]').click();
  await page.locator('[data-action="start-daily"]').click();
  if (await page.locator('#modal').isVisible()) await page.locator('[data-action="begin"]').click();
  const daily = await profile();
  assert.equal(daily.active?.levelId, 181);
  assert.equal(daily.active?.dailyKey, dateKey());
  await expect(page.locator('[data-action="tool"]').first()).toBeDisabled();
  await page.locator('[data-action="pause"]').click();
  await page.locator('[data-action="restart-confirm"]').click();
  await page.locator('[data-action="retry"]').click();
  assert.equal((await profile()).active?.seed, daily.active?.seed);
  checks.push('Journal unlocks mechanics by progress; daily challenge disables tools and retries same date seed');

  await page.screenshot({ path: 'reports/verification/desktop.png', fullPage: true });
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 740 }, { width: 768, height: 1024 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => scrollTo(0, 0));
    const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, view: innerWidth, canvas: document.querySelector('canvas')?.getBoundingClientRect().toJSON() }));
    assert(dimensions.scroll <= dimensions.view + 1, `no horizontal overflow at ${viewport.width}`);
    assert(dimensions.canvas && dimensions.canvas.width <= viewport.width, 'responsive board');
    if (viewport.width === 390) await page.screenshot({ path: 'reports/verification/mobile.png', fullPage: true });
    await page.locator('[data-action="map"]').click();
    await expect(page.locator('#modal')).toBeVisible();
    await page.locator('#modal .modal-top [data-action="close"]').click();
  }
  checks.push('390, 320, 768 and 1280px viewports have no horizontal overflow; map remains operable');

  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.locator('[data-action="settings"]').click();
  const downloadEvent = page.waitForEvent('download');
  await page.locator('[data-action="export"]').click();
  const download = await downloadEvent;
  assert(download.suggestedFilename().startsWith('moon-garden-'));
  await page.locator('#modal .modal-top [data-action="close"]').click();
  checks.push('Export downloads a JSON backup');

  const importFile = page.locator('#import-file');
  const beforeInvalidImport = await profile();
  await importFile.setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"version":1,"coins":-7}') });
  await expect(page.locator('#toast')).toContainText('не распознано');
  assert.deepEqual(await profile(), beforeInvalidImport);
  checks.push('Malformed import is rejected without changing current progress');

  let fixture = newProfile();
  for (let id = 1; id <= 120; id++) fixture = completeLevel(fixture, id, 3, 10000).profile;
  fixture.settings = { sound: false, reducedMotion: true };
  fixture.seen = [121];
  fixture.active = { levelId: 121, seed: levels[120].seed, log: [], dailyKey: '' };
  await importFile.setInputFiles({ name: 'late-game.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) });
  await expect(page.locator('#modal-title')).toHaveText('Продолжить другую историю?');
  await page.locator('#confirm-import').click();
  await expect(page.locator('#level-title')).toContainText('121');
  assert.equal((await profile()).active?.levelId, 121);
  const late = resume(await profile());
  assert.equal(late.level.colors, 6);
  assert(late.obstacles.some(o => o?.hp === 2));
  const lateMove = legalMoves(late)[0];
  assert(lateMove);
  await command({ kind: 'swap', ...lateMove }, true);
  await page.screenshot({ path: 'reports/verification/late-game.png', fullPage: true });
  checks.push('Valid import restores level 121 with six plant types and layered mixed obstacles; swipe remains playable');

  let lossState = createGame(levels[120]);
  const losingLog: Command[] = [];
  while (lossState.phase === 'playing') {
    const nextMove = legalMoves(lossState)[0];
    assert(nextMove);
    const input: Command = { kind: 'swap', ...nextMove };
    const result = act(lossState, input);
    assert(result.ok);
    losingLog.push(input);
    lossState = result.state;
  }
  assert.equal(lossState.phase, 'lost');
  const lastInput = losingLog.pop();
  assert(lastInput);
  fixture.active = { levelId: 121, seed: levels[120].seed, log: losingLog, dailyKey: '' };
  await importFile.setInputFiles({ name: 'one-move-left.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) });
  await page.locator('#confirm-import').click();
  await expect(page.locator('#moves')).toHaveText('1');
  await command(lastInput);
  await expect(page.locator('#modal-title')).toHaveText('Цветение ещё впереди.');
  await page.locator('[data-action="retry"]').click();
  await expect(page.locator('#moves')).toHaveText(String(levels[120].moves));
  assert.equal((await profile()).active?.log.length, 0);
  checks.push('Last move produces defeat when goals remain; retry starts immediately without a life timer');

  await page.locator('[data-action="settings"]').click();
  await page.locator('[data-action="reset-confirm"]').click();
  await expect(page.locator('#modal-title')).toHaveText('Начать новую историю?');
  assert.equal(Object.keys((await profile()).completed).length, 120);
  await page.locator('[data-action="reset"]').click();
  await expect(page.locator('#modal-title')).toHaveText('У каждого сада есть начало.');
  assert.equal(Object.keys((await profile()).completed).length, 0);
  await page.locator('[data-action="begin"]').click();
  checks.push('Reset requires an explicit destructive confirmation');

  const animated = resume(await profile());
  const candidates = legalMoves(animated).map(move => ({ move, result: act(animated, { kind: 'swap', ...move }) })).filter(item => item.result.ok).sort((a, b) => a.result.frames.length - b.result.frames.length);
  const animatedMove = candidates[0]?.move;
  assert(animatedMove);
  const preview = act(animated, { kind: 'swap', ...animatedMove });
  assert(preview.ok);
  await command({ kind: 'swap', ...animatedMove });
  assert(preview.frames.some(frame => frame.kind === 'clear'));
  assert(preview.frames.some(frame => frame.kind === 'fall'));
  if (preview.state.phase === 'playing') await expect(page.locator('#moves')).toHaveText(String(preview.state.movesLeft));
  checks.push('Default animated mode completes real swap, clear and fall frames without browser errors');

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const touchPage = await touchContext.newPage();
  touchPage.on('pageerror', error => errors.push(error.message));
  await touchPage.goto(baseURL);
  await expect(touchPage.locator('canvas')).toBeVisible();
  await touchPage.locator('[data-action="begin"]').tap();
  await touchPage.screenshot({ path: 'reports/verification/mobile.png', fullPage: true });
  const touchMove = legalMoves(createGame(levels[0]))[0];
  assert(touchMove);
  await touchPage.locator('canvas').scrollIntoViewIfNeeded();
  const touchBox = await touchPage.locator('canvas').boundingBox();
  assert(touchBox);
  for (const cell of [touchMove.a, touchMove.b]) await touchPage.touchscreen.tap(touchBox.x + (16 + cell % 8 * 68 + 34) / 576 * touchBox.width, touchBox.y + (16 + Math.floor(cell / 8) * 68 + 34) / 576 * touchBox.height);
  await expect.poll(async () => {
    const raw = await touchPage.evaluate(key => localStorage.getItem(key), SAVE_KEY);
    const saved = raw ? parseProfile(raw) : null;
    return saved ? !saved.active || saved.active.log.length > 0 : false;
  }).toBe(true);
  await expect(touchPage.locator('#board')).toHaveAttribute('aria-busy', 'false', { timeout: 15000 });
  await touchContext.close();
  checks.push('Touch-enabled mobile context accepts a real touchscreen swap');

  assert.deepEqual(errors, [], 'no browser errors');
  writeFileSync('reports/verification/browser.json', JSON.stringify({ generatedAt: new Date().toISOString(), browser: await browser.version(), baseURL, checks, errors }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, checks, errors }, null, 2));
} catch (error) {
  await page.screenshot({ path: 'reports/verification/failure.png', fullPage: true });
  console.error(error);
  console.error('Browser errors:', errors);
  process.exitCode = 1;
} finally { await browser.close(); }
