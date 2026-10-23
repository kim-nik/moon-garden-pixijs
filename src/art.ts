export function greenhouse(stage = 0, large = false): string {
  const bloom = stage >= 2;
  const lights = stage >= 3;
  const flowers = Array.from({ length: 16 }, (_, i) => {
    const x = 32 + (i * 47) % 275;
    const y = 207 + (i * 17) % 46;
    return `<g opacity="${bloom ? 0.9 : 0.3}"><path d="M${x},${y + 18}q-7,-15 2,-28" fill="none" stroke="#83a58a" stroke-width="2"/><ellipse cx="${x - 6}" cy="${y + 6}" rx="8" ry="3" transform="rotate(35 ${x - 6} ${y + 6})" fill="#6b997c"/>${bloom ? `<g fill="${i % 3 === 0 ? '#e8c88b' : i % 3 === 1 ? '#d59ba6' : '#9eafcf'}"><ellipse cx="${x}" cy="${y - 6}" rx="4" ry="8"/><ellipse cx="${x}" cy="${y - 6}" rx="4" ry="8" transform="rotate(60 ${x} ${y - 6})"/><ellipse cx="${x}" cy="${y - 6}" rx="4" ry="8" transform="rotate(120 ${x} ${y - 6})"/></g><circle cx="${x}" cy="${y - 6}" r="2.5" fill="#f1db9f"/>` : ''}</g>`;
  }).join('');
  return `<svg class="greenhouse-art ${large ? 'large' : ''}" viewBox="0 0 340 280" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Ночная оранжерея: ${stage} этапов восстановления" role="img">
  <defs><linearGradient id="glass${large}" x1="170" y1="65" x2="170" y2="242" gradientUnits="userSpaceOnUse"><stop stop-color="#659387" stop-opacity=".18"/><stop offset="1" stop-color="#659387" stop-opacity=".02"/></linearGradient><radialGradient id="moon${large}"><stop stop-color="#e9d39a" stop-opacity=".1"/><stop offset="1" stop-color="#e9d39a" stop-opacity="0"/></radialGradient></defs>
  <circle cx="244" cy="54" r="48" fill="url(#moon${large})"/><path d="M253 29a20 20 0 1 0 12 31 20 20 0 0 1-12-31" fill="#e1cf9b"/>
  <g fill="#b5c8b6" opacity=".5"><circle cx="64" cy="53" r="1"/><circle cx="124" cy="27" r="1.4"/><circle cx="288" cy="100" r="1"/><circle cx="192" cy="20" r="1"/><path d="M304 29v7m-3-3h6M82 95v6m-3-3h6" stroke="#b5c8b6"/></g>
  <ellipse cx="167" cy="257" rx="150" ry="13" fill="#0c1d17" opacity=".65"/>
  <path d="M63 247V125L166 55l106 70v122Z" fill="url(#glass${large})" stroke="#739589" stroke-width="1.6"/>
  <path d="M63 125h209M166 55v192M98 100v147M130 78v169M202 78v169M237 101v146M63 166h209M63 206h209M53 128l113-79 115 79" stroke="#739589" stroke-opacity=".65" stroke-width="1.3"/>
  <path d="M144 247v-69a22 22 0 0 1 44 0v69M144 206h44" stroke="#9fb6a0" stroke-width="1.5"/>
  <circle cx="180" cy="221" r="2" fill="#d8bc7d"/>
  <path d="M139 260h56l-7-13h-44Z" fill="#3c5242"/><path d="M127 269h80l-12-9h-56Z" fill="#2b4234"/>
  <path d="M51 245c-30-13-37-44-28-72 19 14 29 37 28 72M44 231c-23-1-36-17-32-35 17 1 31 15 32 35M276 246c-4-26 8-53 27-66 6 26-3 51-27 66M286 231c8-21 23-27 39-23-5 17-17 26-39 23" fill="#476c54"/>
  <path d="M54 248c-4-23-6-39-3-65 13 12 20 36 3 65M284 249c-8-24-5-41 3-53 12 19 11 37-3 53" fill="#75917a"/>
  <path d="M28 255q15-23 31-9t29-1q14-12 30 7M220 252q14-18 29-7t28-2 38 11" stroke="#65856a" stroke-width="2"/>
  ${flowers}
  ${lights ? `<path d="M65 128q103 48 206 0" stroke="#ac9868" stroke-width="1"/><g fill="#ebce88">${[80,110,140,170,200,230,260].map((x, i) => `<circle cx="${x}" cy="${132 + Math.sin(i / 6 * Math.PI) * 30}" r="3"/>`).join('')}</g>` : ''}
  ${stage >= 6 ? '<g fill="#d6c0d3"><circle cx="99" cy="97" r="6"/><circle cx="130" cy="77" r="5"/><circle cx="204" cy="80" r="6"/><circle cx="236" cy="102" r="5"/></g>' : ''}
  ${stage >= 1 ? '<rect x="148" y="131" width="37" height="13" rx="3" fill="#526b4d"/><path d="M158 137h18m-15 3h12" stroke="#ced2a3" stroke-width="1.3"/>' : ''}
  ${stage >= 4 ? '<g stroke="#9bbdb2" stroke-width="1.2"><ellipse cx="90" cy="250" rx="19" ry="5" fill="#4e7067"/><path d="M90 247v-24m0 5q-16-17-16 9m16-9q16-17 16 9M86 248h8"/><ellipse cx="90" cy="242" rx="11" ry="3" fill="#799b85"/></g>' : ''}
  ${stage >= 5 ? '<g fill="#927e56" stroke="#b3a17a" stroke-width="1"><path d="M224 237h35v6h-35Z"/><path d="M227 236v-12h29v12m-27 7v9m25-9v9"/></g>' : ''}
  ${stage >= 7 ? '<g stroke="#d5e5cc" stroke-width="1" opacity=".4"><path d="m104 112 20-20m-20 32 20-20m82 71 25-25m-25 38 25-25"/></g>' : ''}
  ${stage >= 8 ? '<path d="M202 230h18v20h-18Z" fill="#66806a" stroke="#a0b292"/><path d="M205 233v13m4-13v13m5-13v13" stroke="#d4c298" stroke-width="2"/>' : ''}
  ${stage >= 9 ? '<g fill="#efdc9d"><circle cx="44" cy="139" r="1.8"/><circle cx="286" cy="148" r="1.5"/><circle cx="114" cy="187" r="1.7"/><circle cx="216" cy="57" r="1.5"/><circle cx="74" cy="208" r="1.3"/></g>' : ''}
  ${stage >= 10 ? '<g stroke="#b6b2cf" stroke-width="2" stroke-linecap="round"><path d="M27 243v-22m-4 14h8m-7-5h6m266 16v-22m-4 13h8m-7-6h6"/></g>' : ''}
  ${stage >= 11 ? '<g stroke="#afc0a4" stroke-width="1.5"><path d="m245 200 10 13m-10-4-5 22m5-22 13 15m-23-23 20-14 5 7-20 14Z" fill="#6e8f7e"/></g>' : ''}
  ${stage >= 12 ? '<g><path d="M167 237v-28" stroke="#a9bf91" stroke-width="2"/><g fill="#f4e3ab"><ellipse cx="167" cy="201" rx="5" ry="12"/><ellipse cx="167" cy="201" rx="5" ry="12" transform="rotate(60 167 201)"/><ellipse cx="167" cy="201" rx="5" ry="12" transform="rotate(120 167 201)"/></g><circle cx="167" cy="201" r="4" fill="#fffae5"/></g>' : ''}
  </svg>`;
}

export const icons = {
  moon: '<svg viewBox="0 0 32 32" fill="none"><path d="M21 4a13 13 0 1 0 7 20A13 13 0 0 1 21 4Z" stroke="currentColor" stroke-width="1.4"/><path d="M13 25c-1-8 1-11 7-13 1 6-1 10-7 13Z" fill="currentColor"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="none"><path d="m9 5 11 7-11 7V5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  map: '<svg viewBox="0 0 24 24" fill="none"><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5ZM9 3v16m6-14v16" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
  leaf: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 19C0 8 10 2 21 3c1 11-5 21-16 16ZM5 19l10-10m-5 5V9m0 5h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 5C9 2 4 3 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-3-1-7-2-10 1Zm0 0v15" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1L12 2Z"/></svg>',
  seed: '<svg viewBox="0 0 24 24" fill="none"><path d="M8 19C0 12 5 4 19 3c2 12-3 19-11 16Zm0 0 7-9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none"><path d="M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3Z" stroke="currentColor" stroke-width="1.3"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.3"/></svg>',
  sound: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 9h4l5-4v14l-5-4H4V9Zm13-2a7 7 0 0 1 0 10m2-13a11 11 0 0 1 0 16" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="none"><path d="M8 6v12M16 6v12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>',
  hint: '<svg viewBox="0 0 24 24" fill="none"><path d="M9 19h6m-5 3h4M8 15C1 8 7 2 12 2s11 6 4 13l-1 2H9l-1-2Z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  hammer: '<svg viewBox="0 0 24 24" fill="none"><path d="m6 21 9-12m-5-4 4-3 7 6-4 4-7-7Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="none"><path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 4-3 6-6s4-6 6-6h3m-4-4 4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  color: '<svg viewBox="0 0 24 24" fill="none"><path d="m12 2 2.5 6.5L21 11l-6.5 2.5L12 20l-2.5-6.5L3 11l6.5-2.5L12 2ZM20 18v4m-2-2h4" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 12h15m-5-5 5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

export const plants = [
  { name: 'Листья', color: '#96c5a5', symbol: '❧' },
  { name: 'Розы', color: '#e4a8b2', symbol: '✿' },
  { name: 'Капли', color: '#96bfd6', symbol: '♦' },
  { name: 'Солнца', color: '#eccb87', symbol: '✦' },
  { name: 'Ирисы', color: '#b4a3ce', symbol: '✾' },
  { name: 'Мандарины', color: '#dfa67d', symbol: '●' },
];
