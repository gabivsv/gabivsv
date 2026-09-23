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
const width = 920, height = 210, cell = 11, gap = 3, left = 30, top = 70;
const bg = theme === 'dark' ? '#0d1117' : '#ffffff';
const fg = theme === 'dark' ? '#c9d1d9' : '#24292f';
const muted = theme === 'dark' ? '#6e7681' : '#57606a';
const levels = theme === 'dark'
  ? ['#161b22','#0e4429','#006d32','#26a641','#39d353']
  : ['#ebedf0','#9be9a8','#40c463','#30a14e','#216e39'];
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const level = count => count === 0 ? 0 : Math.min(4, Math.ceil((count / max) * 4));
const starSeed = 17;
const stars = Array.from({length: 42}, (_, i) => {
  const x = (i * 83 + starSeed * 7) % width;
  const y = (i * 47 + 11) % 52;
  const r = i % 7 === 0 ? 1.5 : i % 3 === 0 ? 1.1 : 0.7;
  const delay = (i % 9) * 0.37;
  return `<circle class="star" cx="${x}" cy="${y}" r="${r}" style="animation-delay:${delay}s"/>`;
}).join('');
const rects = cells.map(({x, y, count}) => {
  const px = left + x * (cell + gap);
  const py = top + y * (cell + gap);
  return `<rect class="cell level-${level(count)}" x="${px}" y="${py}" width="${cell}" height="${cell}" rx="2"><title>${esc(count)} contribuição(ões)</title></rect>`;
}).join('');
const path = cells.filter(c => c.y === 3).map(c => `${left + c.x * (cell + gap) + cell / 2},${top + c.y * (cell + gap) + cell / 2}`).join(' ');
const endX = left + (weeks.length - 1) * (cell + gap) + cell / 2;
const endY = top + 3 * (cell + gap) + cell / 2;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">Contribuições de ${esc(username)} em uma viagem espacial</title>
  <desc id="desc">Uma espaçonave atravessa uma grade de contribuições cercada por estrelas.</desc>
  <style>
    :root { color-scheme: ${theme}; }
    .bg { fill: ${bg}; }
    .label { fill: ${fg}; font: 600 13px system-ui, sans-serif; }
    .subtle { fill: ${muted}; font: 11px system-ui, sans-serif; }
    .cell { stroke: ${theme === 'dark' ? '#30363d' : '#d0d7de'}; stroke-width: .35; }
    .level-0 { fill: ${levels[0]}; } .level-1 { fill: ${levels[1]}; } .level-2 { fill: ${levels[2]}; }
    .level-3 { fill: ${levels[3]}; } .level-4 { fill: ${levels[4]}; }
    .star { fill: ${theme === 'dark' ? '#fff' : '#0969da'}; opacity: .7; animation: twinkle 2.4s ease-in-out infinite alternate; }
    .route { fill: none; stroke: ${theme === 'dark' ? '#58a6ff' : '#0969da'}; stroke-width: 1.4; stroke-dasharray: 4 5; opacity: .45; }
    .ship { offset-path: path('M ${path}'); offset-distance: 0%; animation: fly 18s linear infinite; transform-box: fill-box; transform-origin: center; }
    .flame { animation: flame .24s ease-in-out infinite alternate; transform-origin: 0 10px; }
    @keyframes fly { to { offset-distance: 100%; } }
    @keyframes twinkle { from { opacity: .25; } to { opacity: 1; } }
    @keyframes flame { from { transform: scaleX(.65); opacity: .6; } to { transform: scaleX(1.15); opacity: 1; } }
    @media (prefers-reduced-motion: reduce) { .ship { animation: none; offset-distance: 100%; } .star, .flame { animation: none; } }
  </style>
  <rect class="bg" width="100%" height="100%" rx="12"/>
  <g aria-hidden="true">${stars}</g>
  <text class="label" x="20" y="27">${esc(username)} · missão de contribuições</text>
  <text class="subtle" x="20" y="45">Cada quadrado é um planeta visitado. Quanto mais escuro, maior a atividade.</text>
  <polyline class="route" points="${path}"/>
  <g>${rects}</g>
  <g class="ship" transform="translate(-18 -13)">
    <path d="M4 14 C6 5 14 1 26 1 C24 10 19 16 10 20 Z" fill="${theme === 'dark' ? '#79c0ff' : '#0969da'}" stroke="${fg}" stroke-width="1"/>
    <circle cx="17" cy="8" r="2.2" fill="${bg}" stroke="${fg}" stroke-width="1"/>
    <path class="flame" d="M7 16 C3 17 1 20 0 24 C5 22 8 21 10 19 Z" fill="#f0883e"/>
    <path class="flame" d="M10 18 C7 21 7 24 8 26 C11 23 12 21 12 19 Z" fill="#ffdf5d"/>
  </g>
  <text class="subtle" x="${left}" y="190">menos</text>
  ${levels.map((_, i) => `<rect class="level-${i}" x="${left + 42 + i * 16}" y="181" width="11" height="11" rx="2"/>`).join('')}
  <text class="subtle" x="${left + 130}" y="190">mais</text>
  <text class="subtle" x="${width - 170}" y="190">últimas 52 semanas</text>
</svg>`;

await fs.mkdir('dist', { recursive: true });
await fs.writeFile(`dist/${output}`, svg);
console.log(`Gerado dist/${output}`);
