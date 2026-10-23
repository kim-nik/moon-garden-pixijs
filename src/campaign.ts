import type { Chapter, Color, Goal, Level, ObstacleKind, Restoration } from './contracts';

export const chapters: Chapter[] = [
  { id: 0, name: 'Забытый сад', subtitle: 'Там, где всё начинается', description: 'За старой калиткой ещё пахнет мятой. Найдите первые ростки и разбудите оранжерею.', color: '#b8c9a1', mechanic: 'Совпадения, усилители и первый иней' },
  { id: 1, name: 'Хрустальный павильон', subtitle: 'Тепло сквозь стекло', description: 'На стёклах застыл рассвет. Разберите старые ящики, чтобы впустить в павильон свет.', color: '#9ec7d4', mechanic: 'Ящики и цепные реакции' },
  { id: 2, name: 'Дикие тропы', subtitle: 'У природы свои планы', description: 'Тропинки исчезли под листьями. Освободите растения из объятий старых лоз.', color: '#90b999', mechanic: 'Лозы и смешанные цели' },
  { id: 3, name: 'Сумеречный пруд', subtitle: 'Отражение далёких звёзд', description: 'Вода помнит лунный свет. Растопите двойной иней и верните пруду его отражения.', color: '#b2acd0', mechanic: 'Двойные слои и точные взрывы' },
  { id: 4, name: 'Янтарная роща', subtitle: 'Последнее тепло осени', description: 'Листья светятся изнутри. Здесь пригодятся все приёмы, которым научил вас сад.', color: '#d6b67d', mechanic: 'Шесть растений и сложные сочетания' },
  { id: 5, name: 'Лунная обсерватория', subtitle: 'Сад, который смотрит в небо', description: 'Под стеклянным куполом ждёт последний цветок. Соберите целое созвездие совпадений.', color: '#d3acb8', mechanic: 'Мастерские испытания всех механик' },
];

const names = ['Первые ростки', 'Тихая тропа', 'Роса на листьях', 'Тёплый луч', 'Садовый вальс', 'Хрупкий узор', 'Зелёное письмо', 'Цветочный этюд', 'Ветер перемен', 'Ночное созвездие', 'Забытый ключ', 'Шёпот трав', 'Маленькое чудо', 'Свет фонаря', 'Запах дождя', 'Плетение ветвей', 'Лунная пыль', 'Между лепестками', 'Новая надежда', 'Сердце оранжереи', 'Рассвет близко', 'Узор на стекле', 'Звёздная дорожка', 'Долгая прогулка', 'Медовый свет', 'Тайная скамья', 'Шелест страниц', 'Память о лете', 'Цветение', 'Хранитель сада'];
const colors: Color[] = [0, 1, 2, 3, 4, 5];

function layout(id: number, chapter: number): Level['obstacles'] {
  if (id < 6) return [];
  const count = Math.min(25, 6 + Math.floor(id / 9));
  const pattern = id % 8;
  const candidates = Array.from({ length: 64 }, (_, index) => {
    const r = Math.floor(index / 8), c = index % 8;
    let order = 0;
    switch (pattern) {
      case 0: order = Math.abs(r - 3.5) + Math.abs(c - 3.5); break;
      case 1: order = Math.min(r, c, 7 - r, 7 - c); break;
      case 2: order = (r + c) % 3; break;
      case 3: order = Math.abs(r - c); break;
      case 4: order = Math.abs(r + c - 7); break;
      case 5: order = c % 3 + r % 2; break;
      case 6: order = r % 3 + c % 2; break;
      default: order = (index * 17 + id * 7) % 67;
    }
    return { index, order: order * 100 + (index * 23 + id * 11) % 97 };
  }).sort((a, b) => a.order - b.order);
  return candidates.slice(0, count).map(({ index }, i) => {
    let kind: ObstacleKind = 'ice';
    if (chapter === 1) kind = i % 3 === 0 ? 'crate' : 'ice';
    if (chapter === 2) kind = i % 3 === 0 ? 'ice' : 'vine';
    if (chapter >= 3) kind = i % 4 === 0 ? 'crate' : i % 4 === 1 ? 'vine' : 'ice';
    // Never form a solid crate wall: only isolated interior parity cells can be crates.
    if (kind === 'crate' && (index % 2 === 0 || Math.floor(index / 8) % 2 === 0)) kind = 'ice';
    return { index, kind, hp: chapter >= 3 && i % 3 === 0 ? 2 : 1 };
  });
}

export function makeLevel(id: number): Level {
  const chapter = Math.min(5, Math.floor((id - 1) / 30));
  const local = (id - 1) % 30;
  const hard = id % 10 === 0;
  const colorCount = id <= 3 ? 4 : id < 121 ? 5 : 6;
  const obstacles = layout(id, chapter);
  const primary = colors[(id + chapter) % colorCount];
  const secondary = colors[(id + chapter + 2) % colorCount];
  const collectionCurve = [54, 76, 94, 108, 60, 69];
  const amount = collectionCurve[chapter] + (chapter < 4 ? Math.floor(local * .9) : Math.floor(local / 6) * 3) + (hard ? 8 : 0);
  const score = (2300 + chapter * 1500 + local * 100) * (chapter < 4 ? 1.5 : 1) + (hard ? 1800 : 0);
  let goals: Goal[];
  if (id === 1) goals = [{ kind: 'collect', color: 0, amount: 12 }, { kind: 'collect', color: 1, amount: 12 }];
  else if (id === 2) goals = [{ kind: 'score', amount: 2400 }, { kind: 'collect', color: 2, amount: 18 }];
  else if (id === 3) goals = [{ kind: 'collect', color: 3, amount: 28 }, { kind: 'collect', color: 1, amount: 24 }];
  else {
    const mode = local % 6;
    goals = mode === 0 || mode === 3
      ? [{ kind: 'collect', color: primary, amount }, { kind: 'collect', color: secondary, amount: amount - 6 }]
      : mode === 1 || mode === 4
        ? [{ kind: 'score', amount: score }, { kind: 'collect', color: primary, amount }]
        : [{ kind: 'collect', color: primary, amount: amount + 8 }];
    const kinds: ObstacleKind[] = ['ice', 'crate', 'vine'];
    for (const kind of kinds) {
      const n = obstacles.filter(o => o.kind === kind).length;
      if (n > 0) goals.push({ kind: 'clear', obstacle: kind, amount: n });
    }
    if (hard && !goals.some(g => g.kind === 'score')) goals.push({ kind: 'score', amount: score });
  }
  const story = id === 1 ? 'Добро пожаловать в сад. Поменяйте два соседних растения, чтобы собрать ряд из трёх. Соберите листья и розы — и первые ростки оживут.'
    : id === 4 ? 'Четыре растения в ряд оставляют линейный усилитель. Дважды нажмите на него или поменяйте с соседом, чтобы очистить линию.'
    : id === 6 ? 'На листьях появился иней. Соберите совпадение прямо на замёрзшей клетке, чтобы растопить его.'
    : id === 15 ? 'Ряды в форме Т или L создают бомбу. Взрыв очищает квадрат 3 × 3. Два усилителя рядом можно объединить.'
    : id === 21 ? 'Пять в ряд создают радужный цветок. Поменяйте его с растением — исчезнут все растения этого цвета.'
    : id === 31 ? 'Старые ящики перекрывают путь. Собирайте растения рядом с ними или используйте взрыв. Растения не падают сквозь ящики.'
    : id === 61 ? 'Лозы держат растения на месте. Совпадение рядом или на самой клетке освободит растение. Усилители тоже помогут.'
    : id === 91 ? 'Некоторые препятствия теперь имеют два слоя. Один каскад снимает один слой — планируйте цепные реакции.'
    : id === 121 ? 'В роще появился шестой вид растений. Совпадений меньше, зато каждое удачное сочетание особенно ценно.'
    : local === 0 ? chapters[chapter].description
    : hard ? 'Испытание хранителя: выполните все цели. Сохраните усилители для самых неудобных уголков.'
    : chapters[chapter].subtitle + '. Не торопитесь: у каждого сада свой ритм.';
  const moveCurve = [34, 40, 44, 48, 50, 55];
  return { id, chapter, title: names[local], story, seed: (id * 7919 + 20261023) >>> 0, colors: colorCount, moves: id === 1 ? 24 : id < 4 ? 28 : id === 180 ? 72 : moveCurve[chapter] + Math.floor(local / 10) * 2 + (hard ? 3 : 0), goals, obstacles, difficulty: id <= 5 ? 'gentle' : hard ? 'hard' : 'normal' };
}

export const levels: Level[] = Array.from({ length: 180 }, (_, i) => makeLevel(i + 1));

export const restorations: Restoration[] = [
  { id: 0, name: 'Открыть калитку', description: 'Смахнём пыль с вывески и впустим в сад первые цветы.', cost: 3, reward: 40 },
  { id: 1, name: 'Первые клумбы', description: 'У тропинки распустились розы. Сад уже узнаёт ваши шаги.', cost: 6, reward: 50 },
  { id: 2, name: 'Зажечь гирлянды', description: 'Тёплые огоньки помогают задержаться здесь ещё немного.', cost: 9, reward: 60 },
  { id: 3, name: 'Починить фонтан', description: 'Тихое журчание снова наполняет старый двор.', cost: 12, reward: 70 },
  { id: 4, name: 'Вернуть скамейку', description: 'Место, где можно посидеть и просто послушать листья.', cost: 15, reward: 80 },
  { id: 5, name: 'Плетистые розы', description: 'Они обвивают каркас и тянутся к далёкой луне.', cost: 18, reward: 90 },
  { id: 6, name: 'Хрустальные стёкла', description: 'Теперь оранжерея хранит тепло даже в холодную ночь.', cost: 21, reward: 100 },
  { id: 7, name: 'Садовая библиотека', description: 'В дневниках нашлись имена всех прежних хранителей.', cost: 24, reward: 110 },
  { id: 8, name: 'Дом для светлячков', description: 'Маленькие фонарики поселились в ветвях старой груши.', cost: 27, reward: 120 },
  { id: 9, name: 'Сад ароматов', description: 'Лаванда и мята. Кажется, именно так пахнет покой.', cost: 30, reward: 130 },
  { id: 10, name: 'Новый телескоп', description: 'Теперь звёзды кажутся совсем близко.', cost: 33, reward: 140 },
  { id: 11, name: 'Лунный цветок', description: 'Он раскрылся впервые за сто лет. Этот сад теперь ваш.', cost: 36, reward: 200 },
];

export function dateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function dailyLevel(key = dateKey()): Level {
  let seed = 5381;
  for (const char of key) seed = ((seed * 33) ^ char.charCodeAt(0)) >>> 0;
  return { ...makeLevel(75 + seed % 25), id: 181, title: 'Цветок дня', story: 'Одна дата — одно созвездие растений. Попробуйте собрать лучший результат без инструментов. Награда за первую победу сегодня: 80 семян.', seed, moves: 48 };
}
