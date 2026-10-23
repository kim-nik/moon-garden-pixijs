import '@fontsource/golos-text/400.css';
import '@fontsource/golos-text/500.css';
import '@fontsource/golos-text/600.css';
import './style.css';
import { greenhouse, icons, plants } from './art';
import { GardenAudio } from './audio';
import { chapters, dailyLevel, dateKey, levels, restorations } from './campaign';
import type { Command, Frame, GameState, Goal, Level, Tool } from './contracts';
import { act, createGame, goalValue, hint, stars } from './engine';
import { availableStars, buyTool, completeLevel, newProfile, parseProfile, ProfileStore, restoreGarden, toolPrices, totalStars, unlockedLevel } from './progress';
import { BoardRenderer } from './renderer';

function element<T extends HTMLElement>(selector: string, constructor: { new (...args: never[]): T }): T {
  const found = document.querySelector(selector);
  if (!(found instanceof constructor)) throw new Error(`Не найден элемент ${selector}`);
  return found;
}

function browserStorage(): Storage | null { try { return window.localStorage; } catch { return null; } }
const store = new ProfileStore(browserStorage());
const audio = new GardenAudio();
let state: GameState;
let busy = false;
let selected = -1;
let armed: Tool | null = null;
let reward = 0;
let dailyKey = '';
let mapChapter = 0;
let previousFocus: Element | null = null;
let toastTimeout: ReturnType<typeof setTimeout>;
const tutorials = [1, 4, 6, 15, 21, 31, 61, 91, 121, 151];
const format = (value: number) => value.toLocaleString('ru-RU');
const moveWord = (value: number) => value % 100 >= 11 && value % 100 <= 14 ? 'ходов' : value % 10 === 1 ? 'ход' : value % 10 >= 2 && value % 10 <= 4 ? 'хода' : 'ходов';
const icon = (name: keyof typeof icons) => `<span class="icon" aria-hidden="true">${icons[name]}</span>`;
const starIcons = (n: number, className = '') => `<span class="star-set ${className}" aria-label="${n} из 3 звёзд">${[1, 2, 3].map(i => `<span class="${i <= n ? 'earned' : ''}">${icons.star}</span>`).join('')}</span>`;

element('#app', HTMLElement).innerHTML = `
  <div class="ambient" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
  <div class="app-shell">
    <aside class="sidebar">
      <a class="brand" href="./" aria-label="Лунный сад — главная">${icon('moon')}<span>лунный сад<small>маленькие совпадения, большие чудеса</small></span></a>
      <div class="sidebar-line"></div>
      <nav aria-label="Разделы игры">
        <button class="nav-item active" data-action="play">${icon('play')}<span>Оранжерея</span><span class="nav-dot"></span></button>
        <button class="nav-item" data-action="map">${icon('map')}<span>Карта путешествия</span><span class="nav-count">180</span></button>
        <button class="nav-item" data-action="garden">${icon('leaf')}<span>Мой сад</span><span id="garden-alert" class="nav-dot hidden"></span></button>
        <button class="nav-item" data-action="journal">${icon('book')}<span>Дневник садовника</span></button>
      </nav>
      <div class="sidebar-garden">
        <div class="eyebrow">ВАША МАЛЕНЬКАЯ ВСЕЛЕННАЯ</div>
        <div id="sidebar-art">${greenhouse(store.profile.restored)}</div>
        <div class="garden-caption"><span>Сад просыпается</span><span id="restored-count">0 / 12</span></div>
        <div class="thin-track"><span id="garden-progress"></span></div>
        <button class="text-button" data-action="garden">Позаботиться о саде ${icon('arrow')}</button>
      </div>
      <div class="sidebar-bottom">
        <button class="daily-link" data-action="daily">${icon('color')}<span>Цветок дня<small>Новое созвездие каждый день</small></span>${icon('arrow')}</button>
        <button class="nav-item small" data-action="help">${icon('hint')}<span>Как играть</span></button>
        <div class="sidebar-note"><span class="live-dot"></span><span id="save-note">Прогресс сохраняется автоматически</span></div>
      </div>
    </aside>
    <main class="main-content">
      <header class="topbar">
        <div class="breadcrumb">Оранжерея <span>/</span> <span id="chapter-label">Забытый сад</span></div>
        <div class="top-actions">
          <button class="wallet star-wallet" data-action="garden" title="Звёзды для восстановления сада">${icon('star')}<span id="star-wallet">0</span></button>
          <button class="wallet" data-action="shop" title="Семена для инструментов">${icon('seed')}<span id="coin-wallet">180</span><span class="wallet-plus">+</span></button>
          <span class="action-divider"></span>
          <button class="icon-button" data-action="sound" aria-label="Выключить звук" title="Звук">${icon('sound')}</button>
          <button class="icon-button" data-action="settings" aria-label="Настройки" title="Настройки">${icon('settings')}</button>
        </div>
      </header>
      <div class="page-intro"><div><div class="eyebrow"><span class="tiny-star">✦</span> МЕСТО, ГДЕ МОЖНО НЕ СПЕШИТЬ</div><h1>Пусть сад снова <em>цветёт.</em></h1><p>Одно совпадение — и в мире становится чуть больше жизни.</p></div><div class="intro-flower" aria-hidden="true">✳</div></div>
      <div class="play-layout">
        <section class="game-section" aria-label="Игра три в ряд">
          <div class="level-bar"><div class="level-name"><span class="level-emblem">${icon('leaf')}</span><div><div class="eyebrow" id="level-chapter">ГЛАВА 01 · ЗАБЫТЫЙ САД</div><h2 id="level-title">Уровень 01 <span>Первые ростки</span></h2></div></div><div class="level-controls"><span id="difficulty" class="difficulty">Спокойный</span><button class="icon-button" data-action="pause" aria-label="Пауза" title="Пауза">${icon('pause')}</button></div></div>
          <div class="board-card">
            <div class="board-hud"><div class="move-counter"><span id="moves">24</span><small id="move-label">хода осталось</small></div><div class="score-block"><div class="score-caption"><span>ВАШ СЧЁТ</span><strong id="score">0</strong></div><div class="score-track"><span id="score-fill"></span><i></i><i></i><i></i></div><div class="score-marks"><span>✦</span><span>✦</span><span>✦</span></div></div><div class="hud-flower" aria-hidden="true">❧</div></div>
            <div id="board" class="board-host"><div class="board-loading">Выращиваем растения…</div></div>
            <div class="board-footer"><span><span class="live-dot"></span><span id="board-caption">У каждого цветка есть своя пара</span></span><span id="cascade" class="cascade"></span></div>
          </div>
          <div class="tools-bar"><div class="tools-label"><span class="eyebrow">НЕМНОГО ВОЛШЕБСТВА</span><small>Инструменты не тратят ходы</small></div><div class="tool-buttons"><button class="tool-button" data-action="tool" data-tool="hammer" aria-label="Лопатка" title="Лопатка: убрать растение или слой препятствия">${icon('hammer')}<span data-count="hammer">3</span></button><button class="tool-button" data-action="tool" data-tool="shuffle" aria-label="Перемешивание" title="Перемешивание: новое расположение растений">${icon('shuffle')}<span data-count="shuffle">3</span></button><button class="tool-button" data-action="tool" data-tool="color" aria-label="Цветочная волна" title="Цветочная волна: убрать растения выбранного цвета">${icon('color')}<span data-count="color">2</span></button><span class="tool-separator"></span><button class="hint-button" data-action="hint" title="Бесплатная подсказка (H)">${icon('hint')}<span>Подсказка</span></button></div></div>
          <div class="game-status" id="game-status" aria-live="polite">Нажмите на два соседних растения или проведите по полю.</div>
          <button id="result-button" class="primary-button hidden" data-action="result">Посмотреть результат ${icon('arrow')}</button>
        </section>
        <aside class="right-panel">
          <section class="objectives panel"><div class="panel-eyebrow"><span>ВАША ЗАДАЧА</span><span>✧</span></div><h3>Маленькие цели.<br /><em>Большое цветение.</em></h3><p>Выполните все задачи,<br />пока не закончились ходы.</p><div id="goals" class="goal-list"></div><div class="objective-bottom">${icon('star')}<span>Осталось больше ходов?<br />Больше шансов на три звезды.</span></div></section>
          <section class="note-card"><span class="note-pin" aria-hidden="true"></span><div class="eyebrow">ЗАМЕТКА САДОВНИКА</div><div class="note-drawing" aria-hidden="true">❧</div><p id="garden-tip">Три одинаковых растения в ряд — начало чего-то прекрасного.</p><button data-action="help" class="note-link">Все секреты сада ${icon('arrow')}</button></section>
          <div class="chapter-progress"><div><span id="chapter-progress-label">Глава 1 из 6</span><strong id="chapter-completed">0 / 30</strong></div><div class="chapter-dots">${chapters.map(c => `<span data-chapter-dot="${c.id}"></span>`).join('')}</div><p>За каждым поворотом —<br />новая история.</p></div>
        </aside>
      </div>
      <footer class="page-footer"><span>СОЗДАНО ДЛЯ ТИХИХ МОМЕНТОВ</span><span>180 уровней <i>·</i> 6 уголков сада <i>·</i> никаких жизней и ожиданий</span><span>☾</span></footer>
    </main>
  </div>
  <dialog id="modal" aria-labelledby="modal-title"></dialog>
  <div id="toast" class="toast" role="status"></div>
  <input type="file" id="import-file" accept="application/json,.json" hidden />
`;

const dialog = element('#modal', HTMLDialogElement);
const status = element('#game-status', HTMLElement);
const renderer = new BoardRenderer({ tap: tapCell, swipe: (a, b) => { void perform({ kind: 'swap', a, b }); }, focus: describeCell, activate: at => { void perform({ kind: 'activate', at }); } }, onFrame);

function toast(text: string): void {
  const el = element('#toast', HTMLElement);
  clearTimeout(toastTimeout);
  el.textContent = text;
  el.classList.add('visible');
  toastTimeout = setTimeout(() => el.classList.remove('visible'), 4000);
}

function openModal(title: string, body: string, className = ''): void {
  if (!dialog.open) previousFocus = document.activeElement;
  dialog.className = className;
  dialog.innerHTML = `<div class="modal-top"><span class="eyebrow">ЛУННЫЙ САД</span><button class="icon-button" data-action="close" aria-label="Закрыть">${icon('close')}</button></div><h2 id="modal-title">${title}</h2>${body}`;
  if (!dialog.open) dialog.showModal();
  const focus = dialog.querySelector<HTMLElement>('[data-autofocus]') ?? dialog.querySelector<HTMLElement>('button');
  focus?.focus({ preventScroll: true });
}

function closeModal(): void {
  dialog.close();
  if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
}
dialog.addEventListener('click', event => { if (event.target === dialog && (event.clientX < dialog.getBoundingClientRect().left || event.clientX > dialog.getBoundingClientRect().right || event.clientY < dialog.getBoundingClientRect().top || event.clientY > dialog.getBoundingClientRect().bottom)) closeModal(); });

function refreshProfile(): void {
  const p = store.profile;
  element('#coin-wallet', HTMLElement).textContent = format(p.coins);
  element('#star-wallet', HTMLElement).textContent = format(availableStars(p));
  element('#restored-count', HTMLElement).textContent = `${p.restored} / 12`;
  element('#garden-progress', HTMLElement).style.width = `${p.restored / 12 * 100}%`;
  element('#sidebar-art', HTMLElement).innerHTML = greenhouse(p.restored);
  const item = restorations[p.restored];
  element('#garden-alert', HTMLElement).classList.toggle('hidden', !item || availableStars(p) < item.cost);
  for (const tool of ['hammer', 'shuffle', 'color']) {
    const count = document.querySelector(`[data-count="${tool}"]`);
    if (count && (tool === 'hammer' || tool === 'shuffle' || tool === 'color')) count.textContent = String(p.tools[tool]);
  }
  const soundButton = document.querySelector<HTMLButtonElement>('[data-action="sound"]');
  soundButton?.classList.toggle('muted', !p.settings.sound);
  soundButton?.setAttribute('aria-label', p.settings.sound ? 'Выключить звук' : 'Включить звук');
  soundButton?.setAttribute('aria-pressed', String(p.settings.sound));
  audio.enabled = p.settings.sound;
  renderer.setReduced(p.settings.reducedMotion);
  document.documentElement.classList.toggle('reduced-motion', p.settings.reducedMotion);
  element('#save-note', HTMLElement).textContent = store.available ? 'Прогресс сохраняется автоматически' : 'Сохранение недоступно — экспортируйте прогресс';
}

function goalMarkup(goal: Goal): string {
  const current = Math.min(goal.amount, goalValue(state, goal));
  const done = current >= goal.amount;
  const mark = goal.kind === 'score' ? '✦' : goal.kind === 'collect' ? plants[goal.color].symbol : goal.obstacle === 'ice' ? '❄' : goal.obstacle === 'crate' ? '▧' : '❧';
  const name = goal.kind === 'score' ? 'Наберите очки' : goal.kind === 'collect' ? plants[goal.color].name : goal.obstacle === 'ice' ? 'Растопите иней' : goal.obstacle === 'crate' ? 'Уберите ящики' : 'Освободите лозы';
  const color = goal.kind === 'collect' ? plants[goal.color].color : goal.kind === 'clear' && goal.obstacle === 'ice' ? '#a8cbd9' : '#ddc793';
  return `<div class="goal-row ${done ? 'done' : ''}"><span class="goal-icon" style="--plant:${color}">${mark}</span><div class="goal-details"><span>${name}</span><div class="goal-track"><span style="width:${current / goal.amount * 100}%"></span></div></div><strong>${done ? '<span class="goal-check">✓</span>' : `${format(current)}<small> / ${format(goal.amount)}</small>`}</strong></div>`;
}

function refreshGame(): void {
  const level = state.level;
  const chapter = chapters[level.chapter];
  element('#chapter-label', HTMLElement).textContent = level.id === 181 ? 'Цветок дня' : chapter.name;
  element('#level-chapter', HTMLElement).textContent = level.id === 181 ? `ЕЖЕДНЕВНОЕ ИСПЫТАНИЕ · ${dailyKey}` : `ГЛАВА ${String(level.chapter + 1).padStart(2, '0')} · ${chapter.name.toUpperCase()}`;
  element('#level-title', HTMLElement).innerHTML = level.id === 181 ? `Цветок дня <span>${dailyKey}</span>` : `Уровень ${String(level.id).padStart(2, '0')} <span>${level.title}</span>`;
  element('#difficulty', HTMLElement).textContent = level.id === 181 ? 'Особенный' : level.difficulty === 'gentle' ? 'Спокойный' : level.difficulty === 'hard' ? 'Испытание' : 'Приключение';
  element('#difficulty', HTMLElement).classList.toggle('hard', level.difficulty === 'hard');
  element('#moves', HTMLElement).textContent = String(state.movesLeft);
  element('#move-label', HTMLElement).textContent = `${moveWord(state.movesLeft)} ${state.movesLeft % 10 === 1 && state.movesLeft % 100 !== 11 ? 'остался' : 'осталось'}`;
  element('#moves', HTMLElement).classList.toggle('low', state.movesLeft <= 5);
  element('#score', HTMLElement).textContent = format(state.score);
  const target = level.goals.find(g => g.kind === 'score')?.amount ?? 5000 + level.chapter * 2500;
  element('#score-fill', HTMLElement).style.width = `${Math.min(100, state.score / (target * 1.7) * 100)}%`;
  element('#goals', HTMLElement).innerHTML = level.goals.map(goalMarkup).join('');
  element('#garden-tip', HTMLElement).textContent = level.id === 1 ? 'Три одинаковых растения в ряд — начало чего-то прекрасного.' : level.id < 6 ? 'Четыре в ряд создают усилитель. Попробуйте объединить два усилителя рядом.' : level.id < 31 ? 'Иней нужно убрать совпадением прямо на замёрзшей клетке.' : level.id < 61 ? 'Ящик убирается совпадением рядом. Взрыв тоже поможет.' : 'Сначала доберитесь до трудных уголков. Каскады позаботятся об остальном.';
  const complete = levels.filter(l => l.chapter === level.chapter && store.profile.completed[String(l.id)]).length;
  element('#chapter-completed', HTMLElement).textContent = `${complete} / 30`;
  element('#chapter-progress-label', HTMLElement).textContent = `Глава ${level.chapter + 1} из 6`;
  document.querySelectorAll<HTMLElement>('[data-chapter-dot]').forEach(el => el.classList.toggle('filled', Number(el.dataset.chapterDot) <= level.chapter));
  element('#result-button', HTMLElement).classList.toggle('hidden', state.phase === 'playing');
  document.querySelectorAll<HTMLButtonElement>('[data-action="tool"]').forEach(el => {
    el.disabled = level.id === 181 || state.phase !== 'playing';
    el.classList.toggle('armed', el.dataset.tool === armed);
  });
  element('#board-caption', HTMLElement).textContent = level.id === 181 ? 'Испытание без инструментов' : armed ? 'Выберите растение на поле' : 'У каждого цветка есть своя пара';
}

function onFrame(frame: Frame): void {
  if (frame.kind === 'clear' || frame.kind === 'special') {
    audio.play(frame.cells.length >= 8 ? 'special' : 'match', frame.combo);
    element('#cascade', HTMLElement).textContent = frame.combo > 1 ? `Каскад ×${frame.combo}` : frame.cells.length >= 8 ? 'Красивое совпадение!' : '';
    element('#score', HTMLElement).textContent = format(frame.score);
  } else if (frame.kind === 'shuffle') toast('Новых совпадений нет — сад бережно перемешан. Ход сохранён.');
}

function describeCell(at: number): void {
  if (!state) return;
  const tile = state.board[at];
  const obstacle = state.obstacles[at];
  status.textContent = `Ряд ${Math.floor(at / 8) + 1}, столбец ${at % 8 + 1}: ${tile ? plants[tile.color].name : 'ящик'}${tile && tile.special !== 'none' ? ', усилитель' : ''}${obstacle ? `, ${obstacle.kind === 'ice' ? 'иней' : obstacle.kind === 'vine' ? 'лоза' : 'ящик'}, слоёв: ${obstacle.hp}` : ''}.`;
}

function tapCell(at: number): void {
  if (busy || dialog.open || state.phase !== 'playing') return;
  if (at < 0) { selected = -1; armed = null; renderer.select(-1); refreshGame(); return; }
  if (armed) { void perform({ kind: 'tool', tool: armed, at }); return; }
  if (selected === at) {
    if (state.board[at]?.special !== 'none' && state.board[at]) void perform({ kind: 'activate', at });
    else { selected = -1; renderer.select(-1); }
    return;
  }
  if (selected >= 0 && (Math.abs(selected - at) === 8 || (Math.abs(selected - at) === 1 && Math.floor(selected / 8) === Math.floor(at / 8)))) {
    const from = selected;
    selected = -1;
    void perform({ kind: 'swap', a: from, b: at });
    return;
  }
  selected = at;
  renderer.select(at);
  describeCell(at);
  audio.play('select');
}

async function perform(command: Command): Promise<void> {
  if (busy || dialog.open || state.phase !== 'playing') return;
  if (command.kind === 'tool' && (state.level.id === 181 || store.profile.tools[command.tool] <= 0)) { toast('Этот инструмент пока недоступен.'); return; }
  const result = act(state, command);
  selected = -1;
  renderer.select(-1);
  if (!result.ok) {
    audio.play('invalid');
    status.textContent = 'Здесь нет совпадения. Попробуйте другой обмен — ход не потрачен.';
    setBusy(true);
    try { await renderer.invalid(command.kind === 'swap' ? [command.a, command.b] : [command.at]); }
    finally { setBusy(false); }
    return;
  }
  setBusy(true);
  state = result.state;
  const next = structuredClone(store.profile);
  if (next.active) next.active.log.push(command);
  if (command.kind === 'tool') next.tools[command.tool]--;
  store.update(next);
  armed = null;
  refreshProfile();
  element('#moves', HTMLElement).textContent = String(state.movesLeft);
  try { await renderer.animate(result.frames, state); }
  finally { setBusy(false); renderer.render(state); refreshGame(); }
  if (state.phase !== 'playing') finishLevel();
  else status.textContent = state.movesLeft <= 5 ? 'Осталось мало ходов. Проверьте цели и используйте усилители.' : 'Не спешите. Ищите длинные ряды и сочетания усилителей.';
}

function setBusy(value: boolean): void {
  busy = value;
  element('#board', HTMLElement).setAttribute('aria-busy', String(value));
  document.querySelectorAll<HTMLButtonElement>('[data-action="tool"]').forEach(button => { button.disabled = value || state.phase !== 'playing' || state.level.id === 181; });
  const hintButton = document.querySelector<HTMLButtonElement>('[data-action="hint"]');
  if (hintButton) hintButton.disabled = value || state.phase !== 'playing';
}

function finishLevel(): void {
  if (state.phase === 'won') {
    const completed = completeLevel(store.profile, state.level.id, stars(state), state.score, dailyKey);
    reward = completed.reward;
    store.update(completed.profile);
    audio.play('win');
    status.textContent = 'Сад стал чуточку живее. Уровень пройден!';
  } else {
    const next = structuredClone(store.profile);
    next.active = null;
    store.update(next);
    reward = 0;
    audio.play('lose');
    status.textContent = 'Ходы закончились. Можно попробовать снова — без ожидания.';
  }
  refreshProfile();
  refreshGame();
  showResult();
}

function showResult(): void {
  const won = state.phase === 'won';
  const finalCampaign = state.level.id === 180;
  openModal(won ? finalCampaign ? 'Сад снова цветёт.' : 'Ещё немного жизни.' : 'Цветение ещё впереди.', `
    <div class="result-art">${won ? icon('leaf') : icon('moon')}</div>
    ${won ? starIcons(stars(state), 'result-stars') : '<div class="result-stars dim">✦ &nbsp; ✦ &nbsp; ✦</div>'}
    <p class="modal-description">${won ? finalCampaign ? 'Все 180 уровней пройдены. Спасибо, хранитель. В саду ещё можно собирать звёзды и завершать восстановление.' : 'Каждое маленькое совпадение меняет этот сад. Спасибо, хранитель.' : 'Иногда сад просит ещё одну попытку. Попробуйте новое поле или сохраните усилитель для сложной цели.'}</p>
    <div class="result-stats"><div><small>Счёт</small><strong>${format(state.score)}</strong></div><div><small>${won ? 'Награда' : 'Цели выполнены'}</small><strong>${won ? `+${reward} ${icon('seed')}` : `${state.level.goals.filter(g => goalValue(state, g) >= g.amount).length} / ${state.level.goals.length}`}</strong></div></div>
    <div class="modal-buttons"><button class="primary-button" data-action="${won && state.level.id < 180 ? 'next' : 'retry'}" data-autofocus>${won && state.level.id < 180 ? 'Следующий уровень' : won ? 'Сыграть ещё раз' : 'Попробовать снова'} ${icon('arrow')}</button><button class="secondary-button" data-action="${won ? 'garden' : 'map'}">${won ? 'Заглянуть в сад' : 'Карта путешествия'}</button></div>
  `, 'result-modal');
}

function startLevel(level: Level, seed = level.seed, showTutorial = true): void {
  if (busy) { toast('Дождитесь завершения каскада.'); return; }
  closeModal();
  dailyKey = level.id === 181 ? dateKey() : '';
  state = createGame(level, seed);
  selected = -1;
  armed = null;
  reward = 0;
  const next = structuredClone(store.profile);
  next.active = { levelId: level.id, seed, log: [], dailyKey };
  store.update(next);
  renderer.render(state);
  renderer.select(-1);
  refreshProfile();
  refreshGame();
  setBusy(false);
  status.textContent = 'Нажмите на два соседних растения или проведите по полю.';
  element('#cascade', HTMLElement).textContent = '';
  if (showTutorial && !store.profile.seen.includes(level.id) && (tutorials.includes(level.id) || level.id === 181 || (level.id - 1) % 30 === 0)) {
    openModal(level.id === 181 ? 'Ваш цветок сегодня' : level.id === 1 ? 'У каждого сада есть начало.' : level.title, `<div class="tutorial-art">${level.id === 1 ? greenhouse(store.profile.restored) : icon(level.id === 6 || level.id === 91 ? 'color' : 'leaf')}</div><p class="modal-description">${level.story}</p><div class="tutorial-mini"><span>1</span> Выберите растение <i>→</i><span>2</span> Выберите соседнее</div><button class="primary-button full" data-action="begin" data-autofocus>${level.id === 1 ? 'Разбудить сад' : 'Начать'} ${icon('arrow')}</button>`, 'tutorial-modal');
  }
}

function showMap(chapter = state.level.chapter): void {
  mapChapter = Math.max(0, Math.min(5, chapter));
  const p = store.profile;
  const unlocked = unlockedLevel(p);
  const ch = chapters[mapChapter];
  const passed = Object.keys(p.completed).length;
  openModal('Карта путешествия', `<p class="modal-description">Шесть уголков одного сада. Пройдено ${passed} из 180 уровней · ${totalStars(p)} из 540 звёзд.</p><div class="chapter-tabs" role="group" aria-label="Главы">${chapters.map(c => `<button data-action="map-chapter" data-chapter="${c.id}" class="${c.id === mapChapter ? 'active' : ''}" aria-label="${c.name}" aria-pressed="${c.id === mapChapter}">${String(c.id + 1).padStart(2, '0')}<small>${c.name}</small></button>`).join('')}</div><div class="map-chapter-heading"><div><span class="eyebrow">ГЛАВА ${mapChapter + 1}</span><h3>${ch.name}</h3><p>${ch.description}</p></div><span class="map-flower" style="color:${ch.color}">❧</span></div><div class="level-grid">${levels.filter(l => l.chapter === mapChapter).map(level => {
    const saved = p.completed[String(level.id)];
    const locked = level.id > unlocked;
    return `<button class="level-node ${saved ? 'complete' : ''} ${level.id === unlocked ? 'current' : ''} ${level.difficulty === 'hard' ? 'challenge' : ''}" data-action="level" data-level="${level.id}" ${locked ? 'disabled' : ''} aria-label="Уровень ${level.id}, ${level.title}${locked ? ', закрыт' : saved ? `, ${saved.stars} звезды` : ', доступен'}"><span>${locked ? '<small>⌑</small>' : level.difficulty === 'hard' ? '✧' : ''}</span><strong>${level.id}</strong>${starIcons(saved?.stars ?? 0)}</button>`;
  }).join('')}</div><div class="map-legend"><span>✧ Испытание хранителя</span><span>Новые главы открываются по порядку</span></div>`, 'map-modal');
}

function showGarden(): void {
  const p = store.profile;
  const next = restorations[p.restored];
  const enough = next && availableStars(p) >= next.cost;
  openModal('Место, которое оживает.', `<p class="modal-description">Ваши звёзды превращаются в свет, цветы и маленькие истории.</p><div class="garden-scene">${greenhouse(p.restored, true)}<span class="garden-scene-caption">${p.restored === 12 ? 'Сад восстановлен. Лунный цветок распустился.' : `${p.restored} из 12 историй уже ожили`}</span></div><div class="garden-wallet">${icon('star')}<strong>${availableStars(p)}</strong><span>звёзд для новых историй</span></div>${next ? `<div class="restoration-next"><span class="eyebrow">СЛЕДУЮЩАЯ ИСТОРИЯ · ${next.id + 1} / 12</span><h3>${next.name}</h3><p>${next.description}</p><button class="primary-button full" data-action="restore" ${enough ? '' : 'disabled'}>Восстановить <span>${next.cost} ${icon('star')}</span></button><small>${enough ? `В подарок: ${next.reward} семян для инструментов` : `Нужно ещё ${next.cost - availableStars(p)} звёзд. Проходите уровни или улучшайте результат.`}</small></div>` : '<div class="restoration-next"><h3>Здесь теперь ваш дом.</h3><p>Продолжайте собирать звёзды и возвращайтесь к цветку дня. Сад всегда будет ждать.</p><button class="primary-button full" data-action="map">Вернуться к путешествию</button></div>'}<details class="garden-history"><summary>Все истории сада</summary>${restorations.map(r => `<div class="history-row ${r.id < p.restored ? 'done' : ''}"><span>${r.id < p.restored ? '✓' : String(r.id + 1).padStart(2, '0')}</span><p><strong>${r.name}</strong><small>${r.description}</small></p><b>${r.cost} ✦</b></div>`).join('')}</details>`, 'garden-modal');
}

function showShop(): void {
  openModal('Немного садового волшебства', `<p class="modal-description">Инструменты помогают в трудных местах и не расходуют ходы. Семена зарабатываются за новые звёзды и восстановление сада.</p><div class="shop-wallet">${icon('seed')} ${format(store.profile.coins)} <small>семян</small></div><div class="shop-grid">${(['hammer', 'shuffle', 'color'] satisfies Tool[]).map(tool => `<div class="shop-item">${icon(tool)}<h3>${tool === 'hammer' ? 'Лопатка' : tool === 'shuffle' ? 'Перемешивание' : 'Цветочная волна'}</h3><p>${tool === 'hammer' ? 'Убирает одно растение или слой препятствия в выбранной клетке.' : tool === 'shuffle' ? 'Меняет расположение растений. Препятствия остаются на месте.' : 'Убирает с поля все растения выбранного цвета.'}</p><small>В запасе: ${store.profile.tools[tool]}</small><button class="secondary-button" data-action="buy" data-tool="${tool}" ${store.profile.coins < toolPrices[tool] ? 'disabled' : ''}>${toolPrices[tool]} ${icon('seed')}<span>Купить</span></button></div>`).join('')}</div>`, 'shop-modal');
}

const mechanics = [
  { at: 1, title: 'Маленькие совпадения', mark: '❧', text: 'Соберите три одинаковых растения в ряд. Каскады приносят больше очков. Обмен без совпадения не тратит ход.' },
  { at: 4, title: 'Луч света', mark: '═', text: 'Четыре в ряд создают усилитель линии. Нажмите на него дважды, нажмите Пробел или поменяйте с соседом.' },
  { at: 6, title: 'Утренний иней', mark: '❄', text: 'Соберите совпадение на клетке с инеем. Взрыв также снимает слой. Сам иней не мешает обмену.' },
  { at: 15, title: 'Цветочный фейерверк', mark: '✹', text: 'Пересечение рядов в форме Т или L даёт бомбу 3 × 3. Сочетание бомбы и линии очищает три строки и три столбца.' },
  { at: 21, title: 'Радужный цветок', mark: '✺', text: 'Пять растений в ряд создают радугу. Обменяйте её с растением для удаления всего цвета. Две радуги очищают всё поле.' },
  { at: 31, title: 'Старые ящики', mark: '▧', text: 'Убираются соседним совпадением или взрывом. Их нельзя передвинуть, и растения не падают сквозь них.' },
  { at: 61, title: 'Объятия лозы', mark: '〰', text: 'Лоза держит растение и запрещает его двигать. Совпадение на клетке, рядом или взрыв освободят растение.' },
  { at: 91, title: 'Второй слой', mark: '◇', text: 'Два контура на льду или второй переплёт означают два слоя. Один каскад снимает один слой прочности.' },
  { at: 121, title: 'Шестое растение', mark: '●', text: 'Мандарины приносят в сад больше цвета и требуют внимательнее искать совпадения.' },
];

function showHelp(journal = false): void {
  const unlocked = unlockedLevel(store.profile);
  openModal(journal ? 'Дневник садовника' : 'У сада есть свои секреты.', `<p class="modal-description">${journal ? 'Все приёмы, встреченные в путешествии. Новые страницы открываются вместе с уровнями.' : 'Выполните все цели до конца ходов. Выберите растение и соседнее или сделайте свайп. У каждого вида своя форма и цвет.'}</p><div class="mechanics-list">${mechanics.map(m => { const locked = journal && m.at > unlocked; return `<article class="mechanic ${locked ? 'locked' : ''}"><span>${locked ? '⌑' : m.mark}</span><div><h3>${locked ? `Новая страница · уровень ${m.at}` : m.title}</h3><p>${locked ? 'Сад расскажет об этом чуть позже.' : m.text}</p></div></article>`; }).join('')}</div><div class="help-bottom"><h3>Ещё несколько вещей</h3><p>Инструменты не тратят ходы, подсказка бесплатна. При отсутствии ходов поле перемешивается автоматически. Комбинация двух линий очищает крест; двух бомб — область 5 × 5. Усилители запускают цепные реакции.</p><p>Звёзды зависят от сохранённых ходов: выполните цели с запасом примерно 15% ходов для двух звёзд и 30% для трёх. Лучший результат и награды сохраняются.</p><p><strong>Клавиатура:</strong> стрелки — клетка, Enter — выбор и обмен, Пробел — усилитель, Escape — снять выбор или закрыть окно, H — подсказка, P — пауза.</p></div><button class="primary-button full" data-action="close">Всё понятно ${icon('leaf')}</button>`, 'help-modal');
}

function showSettings(): void {
  openModal('Устроиться поудобнее.', `<p class="modal-description">Небольшие настройки для вашей прогулки.</p><div class="settings-list"><label class="setting-row"><span><strong>Звуки сада</strong><small>Мягкие ноты совпадений и побед</small></span><input id="setting-sound" type="checkbox" ${store.profile.settings.sound ? 'checked' : ''} /></label><label class="setting-row"><span><strong>Меньше движения</strong><small>Короткие переходы без частиц и падений</small></span><input id="setting-motion" type="checkbox" ${store.profile.settings.reducedMotion ? 'checked' : ''} /></label></div><div class="settings-save"><h3>Ваш прогресс</h3><p>${store.available ? 'Сохраняется в этом браузере после каждого хода. Экспортируйте файл перед очисткой данных браузера.' : 'Браузер не разрешает сохранение. Экспортируйте файл, чтобы не потерять прогресс.'}</p><div class="settings-buttons"><button class="secondary-button" data-action="export">Экспортировать</button><button class="secondary-button" data-action="import">Импортировать</button></div><button class="danger-link" data-action="reset-confirm">Начать всё заново</button></div><div class="about-game"><span>Лунный сад · 1.0</span><span>PixiJS · игра хранит данные только на вашем устройстве</span></div>`, 'settings-modal');
}

function showPause(): void {
  openModal('Сад подождёт.', `<div class="pause-art">${icon('moon')}</div><p class="modal-description">Сделайте вдох. Здесь никуда не нужно торопиться.</p><div class="modal-buttons"><button class="primary-button" data-action="close" data-autofocus>Продолжить ${icon('play')}</button><button class="secondary-button" data-action="restart-confirm">Начать уровень заново</button><button class="text-button centered" data-action="map">Карта путешествия</button></div>`, 'pause-modal');
}

function showDaily(): void {
  const key = dateKey();
  const record = store.profile.daily[key];
  openModal('Один день. Одно созвездие.', `<div class="daily-art">${icon('color')}</div><p class="eyebrow centered">ЦВЕТОК ДНЯ · ${key}</p><p class="modal-description">Одинаковое поле для этой даты, 48 ходов и никаких инструментов. Первая победа сегодня принесёт 80 семян.</p>${record ? `<div class="daily-record">${starIcons(record.stars)}<strong>${format(record.score)}</strong><span>Ваш лучший результат · награда получена</span></div>` : '<div class="daily-record"><strong>+80 ❧</strong><span>Награда за первую победу</span></div>'}<button class="primary-button full" data-action="start-daily" data-autofocus>${state.phase === 'playing' && state.turn > 0 ? 'Начать испытание вместо текущей попытки' : 'Вырастить цветок дня'} ${icon('arrow')}</button><p class="fine-print">Текущая попытка будет заменена. Прогресс кампании сохранится.</p>`, 'daily-modal');
}

function getTool(value: string | undefined): Tool | null { return value === 'hammer' || value === 'shuffle' || value === 'color' ? value : null; }
function numberIn(value: string | undefined, max: number): number | null { const n = Number(value); return Number.isInteger(n) && n >= 0 && n <= max ? n : null; }

document.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest<HTMLButtonElement>('button[data-action]');
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  if (action === 'close' || action === 'play') closeModal();
  else if (action === 'begin') {
    const next = structuredClone(store.profile);
    if (!next.seen.includes(state.level.id)) next.seen.push(state.level.id);
    store.update(next);
    closeModal();
  } else if (action === 'map') showMap();
  else if (action === 'map-chapter') { const n = numberIn(button.dataset.chapter, 5); if (n !== null) showMap(n); }
  else if (action === 'level') {
    const n = numberIn(button.dataset.level, 180);
    if (n && n <= unlockedLevel(store.profile)) {
      if (state.phase === 'playing' && state.turn > 0) openModal('Сменить тропинку?', `<p class="modal-description">Незавершённая попытка будет заменена уровнем ${n}. Заработанные звёзды и сад сохранятся.</p><div class="modal-buttons"><button class="primary-button" data-action="start-level" data-level="${n}">Перейти к уровню ${n}</button><button class="secondary-button" data-action="map">Остаться на карте</button></div>`);
      else startLevel(levels[n - 1]);
    }
  } else if (action === 'start-level') { const n = numberIn(button.dataset.level, 180); if (n && n <= unlockedLevel(store.profile)) startLevel(levels[n - 1]); }
  else if (action === 'garden') showGarden();
  else if (action === 'restore') { const next = restoreGarden(store.profile); if (next) { store.update(next); audio.play('restore'); refreshProfile(); showGarden(); toast('Ещё одна история ожила. Семена уже в вашем кошельке.'); } }
  else if (action === 'shop') showShop();
  else if (action === 'buy') { const tool = getTool(button.dataset.tool); if (tool) { const next = buyTool(store.profile, tool); if (next) { store.update(next); audio.play('select'); refreshProfile(); showShop(); } } }
  else if (action === 'help' || action === 'journal') showHelp(action === 'journal');
  else if (action === 'settings') showSettings();
  else if (action === 'sound') { const next = structuredClone(store.profile); next.settings.sound = !next.settings.sound; store.update(next); refreshProfile(); toast(next.settings.sound ? 'Звуки сада включены' : 'Звуки сада выключены'); }
  else if (action === 'pause') showPause();
  else if (action === 'hint') showHint();
  else if (action === 'tool') {
    if (busy || dialog.open || state.phase !== 'playing') return;
    const tool = getTool(button.dataset.tool);
    if (!tool) return;
    if (store.profile.tools[tool] <= 0) { showShop(); return; }
    if (tool === 'shuffle') { void perform({ kind: 'tool', tool, at: 0 }); }
    else { armed = armed === tool ? null : tool; selected = -1; renderer.select(-1); refreshGame(); status.textContent = armed ? 'Выберите клетку на поле. Нажмите инструмент ещё раз для отмены.' : 'Инструмент отменён.'; }
  } else if (action === 'restart-confirm') openModal('Ещё одна попытка?', '<p class="modal-description">Вы получите новое поле с теми же целями. Потраченные инструменты не возвращаются. Звёзды и сад сохранятся.</p><div class="modal-buttons"><button class="primary-button" data-action="retry">Начать заново</button><button class="secondary-button" data-action="close">Продолжить текущую</button></div>');
  else if (action === 'retry') { if (state.level.id === 181) startLevel(dailyLevel(), dailyLevel().seed, false); else startLevel(state.level, (state.rng + 104729) >>> 0, false); }
  else if (action === 'next') { if (state.level.id < 180) startLevel(levels[state.level.id]); }
  else if (action === 'result') showResult();
  else if (action === 'daily') showDaily();
  else if (action === 'start-daily') startLevel(dailyLevel());
  else if (action === 'export') exportSave();
  else if (action === 'import') element('#import-file', HTMLInputElement).click();
  else if (action === 'reset-confirm') openModal('Начать новую историю?', '<p class="modal-description">Будут удалены уровни, звёзды, инструменты и восстановление сада в этом браузере. Это действие нельзя отменить. Сначала можно экспортировать сохранение.</p><div class="modal-buttons"><button class="secondary-button" data-action="export">Экспортировать сохранение</button><button class="danger-button" data-action="reset">Удалить прогресс и начать заново</button><button class="text-button centered" data-action="settings">Оставить мой сад</button></div>');
  else if (action === 'reset') { if (!busy) { store.update(newProfile()); startLevel(levels[0]); } }
});

function showHint(): void {
  if (busy || dialog.open || state.phase !== 'playing') return;
  const move = hint(state);
  if (move) { renderer.showHint([move.a, move.b]); status.textContent = move.a === move.b ? `Подсказка: дважды нажмите усилитель — ряд ${Math.floor(move.a / 8) + 1}, столбец ${move.a % 8 + 1}.` : `Подсказка: ряд ${Math.floor(move.a / 8) + 1}, столбец ${move.a % 8 + 1} → ряд ${Math.floor(move.b / 8) + 1}, столбец ${move.b % 8 + 1}.`; }
  else toast('Попробуйте активировать усилитель двойным нажатием.');
}

document.addEventListener('keydown', event => {
  if (event.target instanceof HTMLInputElement || dialog.open) return;
  if (event.code === 'KeyH') showHint();
  if (event.code === 'KeyP') showPause();
});
document.addEventListener('change', event => {
  if (!(event.target instanceof HTMLInputElement)) return;
  if (event.target.id === 'setting-sound' || event.target.id === 'setting-motion') {
    const next = structuredClone(store.profile);
    if (event.target.id === 'setting-sound') next.settings.sound = event.target.checked;
    else next.settings.reducedMotion = event.target.checked;
    store.update(next);
    refreshProfile();
  }
});

function exportSave(): void {
  const blob = new Blob([JSON.stringify(store.profile, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `moon-garden-${dateKey()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Сохранение экспортировано. Храните файл до следующей прогулки.');
}

element('#import-file', HTMLInputElement).addEventListener('change', async event => {
  if (!(event.target instanceof HTMLInputElement)) return;
  const input = event.target;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (file.size > 1000000) { toast('Файл слишком большой. Выберите сохранение Лунного сада.'); return; }
  let parsed;
  try { parsed = parseProfile(await file.text()); } catch { parsed = null; }
  if (!parsed) { toast('Сохранение не распознано. Ваш текущий сад не изменён.'); return; }
  const imported = parsed;
  openModal('Продолжить другую историю?', `<p class="modal-description">В файле: ${Object.keys(imported.completed).length} пройденных уровней, ${totalStars(imported)} звёзд, ${imported.restored} восстановлений. Текущий прогресс будет заменён.</p><div class="modal-buttons"><button id="confirm-import" class="primary-button">Загрузить этот сад</button><button class="secondary-button" data-action="settings">Отмена</button></div>`);
  element('#confirm-import', HTMLButtonElement).addEventListener('click', () => { if (!busy) { store.update(imported); resumeGame(); closeModal(); toast('Ваша история загружена.'); } });
});

function resumeGame(): void {
  const active = store.profile.active;
  if (active) {
    const level = active.levelId === 181 ? dailyLevel(active.dailyKey) : levels[active.levelId - 1];
    if (active.levelId <= unlockedLevel(store.profile) || active.levelId === 181) {
      let restored = createGame(level, active.seed);
      let valid = true;
      for (const command of active.log) {
        const result = act(restored, command);
        if (!result.ok) { valid = false; break; }
        restored = result.state;
      }
      if (valid) {
        state = restored;
        dailyKey = active.dailyKey;
        selected = -1;
        armed = null;
        renderer.render(state);
        refreshProfile();
        refreshGame();
        if (state.phase !== 'playing') finishLevel();
        return;
      }
      toast('Правила сохранённой попытки изменились. Начато новое поле; звёзды и сад сохранены.');
    }
  }
  startLevel(levels[unlockedLevel(store.profile) - 1]);
}

async function init(): Promise<void> {
  const board = element('#board', HTMLElement);
  await renderer.init(board);
  board.querySelector('.board-loading')?.remove();
  const saveWasCorrupted = store.corrupted;
  resumeGame();
  refreshProfile();
  if (!store.available) toast('Сохранение недоступно в этом браузере. Используйте экспорт в настройках.');
  else if (saveWasCorrupted) toast('Повреждённое сохранение не удалось прочитать. Можно импортировать резервную копию в настройках.');
}

void init().catch(error => {
  element('#board', HTMLElement).innerHTML = '<div class="board-error"><span>☾</span><h3>Не удалось открыть оранжерею</h3><p>Обновите страницу и проверьте, включено ли аппаратное ускорение браузера.</p><button class="primary-button" onclick="location.reload()">Попробовать снова</button></div>';
  console.error(error);
});
