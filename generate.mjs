import fs from 'node:fs/promises';

const token = process.env.GITHUB_TOKEN;
const username = process.env.GITHUB_USER;
const output = process.env.OUTPUT || 'github-contribution-spaceship.svg';
const theme = process.env.THEME || 'light';

if (!token || !username) {
  throw new Error('Defina GITHUB_TOKEN e GITHUB_USER.');
}

const query = `query($login:String!) {
  user(login:$login) {
    contributionsCollection {
      contributionCalendar {
        weeks { contributionDays { contributionCount date } }
      }
    }
  }
}`;

const response = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: {
    authorization: `bearer ${token}`,
    'content-type': 'application/json',
    'user-agent': 'github-spaceship-contribution-generator'
  },
  body: JSON.stringify({ query, variables: { login: username } })
});

if (!response.ok) throw new Error(`GitHub respondeu ${response.status}`);
const payload = await response.json();
if (payload.errors?.length) throw new Error(payload.errors.map(e => e.message).join('; '));

const weeks = payload.data.user.contributionsCollection.contributionCalendar.weeks;
const cells = weeks.flatMap((week, x) => week.contributionDays.map((day, y) => ({ x, y, count: day.contributionCount })));
const max = Math.max(1, ...cells.map(c => c.count));
const width = 1700, height = 400, cell = 22, gap = 6, left = 60, top = 155;
const bg = 'transparent';
const fg = '#ffffff';
const muted = '#ffffff';
const levels = theme === 'dark'
  ? ['#161b22','#0e4429','#006d32','#26a641','#39d353']
  : ['#ebedf0','#9be9a8','#40c463','#30a14e','#216e39'];
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const level = count => count === 0 ? 0 : Math.min(4, Math.ceil((count / max) * 4));
const starSeed = 17;
const stars = Array.from({length: 42}, (_, i) => {
  const x = (i * 83 + starSeed * 7) % width;
  const y = (i * 47 + 11) % 52;
  const r = i % 7 === 0 ? 3 : i % 3 === 0 ? 2.2 : 1.5;
  const delay = (i % 9) * 0.37;
  return `<circle class="star" cx="${x}" cy="${y}" r="${r}" style="animation-delay:${delay}s"/>`;
}).join('');
const starPolygon = (cx, cy, outer, inner) => Array.from({length: 10}, (_, i) => {
  const angle = -Math.PI / 2 + i * Math.PI / 5;
  const radius = i % 2 === 0 ? outer : inner;
  return `${(cx + Math.cos(angle) * radius).toFixed(2)},${(cy + Math.sin(angle) * radius).toFixed(2)}`;
}).join(' ');
// Uma estrela ativa por semana define o trajeto da nave.
const routeCells = weeks.flatMap((week, x) => {
  const days = week.contributionDays.map((day, y) => ({ x, y, count: day.contributionCount }));
  const active = days.filter(day => day.count > 0);
  if (!active.length) return [];
  return [active.sort((a, b) => b.count - a.count || Math.abs(a.y - 3) - Math.abs(b.y - 3))[0]];
});
const routeIndex = new Map(routeCells.map((cell, index) => [`${cell.x}:${cell.y}`, index]));
const contributionStars = cells.map(({x, y, count}) => {
  const px = left + x * (cell + gap);
  const py = top + y * (cell + gap);
  const cx = px + cell / 2;
  const cy = py + cell / 2;
  const currentLevel = level(count);
  const outer = currentLevel === 0 ? 4.8 : 6.2 + currentLevel * 1.1;
  const inner = outer * 0.42;
  const index = routeIndex.get(`${x}:${y}`);
  const routeClass = index === undefined ? '' : ' route-star';
  const routeDelay = index === undefined || routeCells.length < 2 ? 0 : (index / (routeCells.length - 1)) * 18 - 1.2;
  const style = index === undefined ? '' : ` style="--pulse-delay:${routeDelay.toFixed(2)}s"`;
  return `<polygon class="contribution-star level-${currentLevel}${routeClass}" points="${starPolygon(cx, cy, outer, inner)}"${style}><title>${esc(count)} contribuição(ões)</title></polygon>`;
}).join('');
const path = routeCells.map(c => `${left + c.x * (cell + gap) + cell / 2},${top + c.y * (cell + gap) + cell / 2}`).join(' ');
const endX = left + (weeks.length - 1) * (cell + gap) + cell / 2;
const endY = top + 3 * (cell + gap) + cell / 2;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">Contribuições de ${esc(username)} em uma viagem espacial</title>
  <desc id="desc">Uma espaçonave atravessa uma grade de contribuições cercada por estrelas.</desc>
  <style>
    :root { color-scheme: ${theme}; }
    .label, .subtle { fill: ${fg}; stroke: #0d1117; stroke-width: 2px; paint-order: stroke; stroke-linejoin: round; }
    .label { font: 700 30px system-ui, sans-serif; }
    .subtle { font: 18px system-ui, sans-serif; }
    .contribution-star { stroke: ${theme === 'dark' ? '#30363d' : '#d0d7de'}; stroke-width: .35; opacity: .92; }
    .level-0 { fill: ${levels[0]}; opacity: .5; } .level-1 { fill: ${levels[1]}; }
    .level-2 { fill: ${levels[2]}; } .level-3 { fill: ${levels[3]}; } .level-4 { fill: ${levels[4]}; }
    .route-star { transform-box: fill-box; transform-origin: center; animation: pulse-star 18s linear infinite var(--pulse-delay); }
    .star { fill: ${theme === 'dark' ? '#fff' : '#0969da'}; opacity: .7; animation: twinkle 2.4s ease-in-out infinite alternate; }
    .route { fill: none; stroke: #58a6ff; stroke-width: 2; stroke-dasharray: 6 7; opacity: .55; }
    .ship { offset-path: path('M ${path}'); offset-distance: 0%; animation: fly 18s linear infinite; transform-box: fill-box; transform-origin: center; }
    .flame { animation: flame .24s ease-in-out infinite alternate; transform-origin: 0 10px; }
    @keyframes fly { to { offset-distance: 100%; } }
    @keyframes twinkle { from { opacity: .25; } to { opacity: 1; } }
    @keyframes pulse-star { 0%, 4%, 100% { transform: scale(1); filter: brightness(1); } 5%, 8% { transform: scale(1.75); filter: brightness(2.2) drop-shadow(0 0 7px #fde68a); } 12% { transform: scale(1); filter: brightness(1); } }
    @keyframes flame { from { transform: scaleX(.65); opacity: .6; } to { transform: scaleX(1.15); opacity: 1; } }
    @media (prefers-reduced-motion: reduce) { .ship { animation: none; offset-distance: 100%; } .star, .flame, .route-star { animation: none; } }
  </style>
  <g aria-hidden="true">${stars}</g>
  <text class="label" x="45" y="48">${esc(username)} · missão de contribuições</text>
  <text class="subtle" x="45" y="88">Cada estrela representa uma contribuição. Quanto maior e mais brilhante, maior a atividade.</text>
  <polyline class="route" points="${path}"/>
  <g>${contributionStars}</g>
  <g class="ship" transform="translate(-30 -25) scale(1.35)">
    <path d="M5 21 C10 8 21 2 39 2 C36 16 26 26 10 29 Z" fill="#facc15" stroke="#fff7ed" stroke-width="1.5"/>
    <path d="M15 22 L5 34 L22 27 Z" fill="#d97706" stroke="#fff7ed" stroke-width="1"/>
    <path d="M29 17 L39 25 L25 26 Z" fill="#b45309" stroke="#fff7ed" stroke-width="1"/>
    <path d="M33 4 L42 1 L38 10 Z" fill="#fde68a" stroke="#fff7ed" stroke-width="1"/>
    <circle cx="27" cy="10" r="4.2" fill="#451a03" stroke="#fff7ed" stroke-width="1.3"/>
    <circle cx="28" cy="9" r="1.1" fill="#ffffff"/>
    <path class="flame" d="M12 27 C6 29 2 34 1 40 C7 37 12 35 16 30 Z" fill="#f97316"/>
    <path class="flame" d="M16 29 C12 34 12 38 14 41 C18 36 19 32 19 29 Z" fill="#fde047"/>
  </g>
  <text class="subtle" x="${left}" y="380">menos</text>
  ${levels.map((_, i) => { const r = i === 0 ? 4.8 : 6.2 + i * 1.1; return `<polygon class="contribution-star level-${i}" points="${starPolygon(left + 82 + i * 30, 373, r, r * .42)}"/>`; }).join('')}
  <text class="subtle" x="${left + 195}" y="380">mais</text>
  <text class="subtle" x="${width - 250}" y="380">últimas 52 semanas</text>
</svg>`;

await fs.mkdir('dist', { recursive: true });
await fs.writeFile(`dist/${output}`, svg);
console.log(`Gerado dist/${output}`);
