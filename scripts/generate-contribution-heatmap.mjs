import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outputDirectory = process.argv[2] ?? 'dist';
const username = process.env.GITHUB_REPOSITORY_OWNER ?? 'anandh8x';
const response = await fetch(`https://github.com/users/${encodeURIComponent(username)}/contributions`, {
  headers: { 'user-agent': 'anandh8x-profile-heatmap' },
});

if (!response.ok) {
  throw new Error(`GitHub returned ${response.status} while fetching public contributions for ${username}.`);
}

const html = await response.text();
const cells = [...html.matchAll(/data-date="(\d{4}-\d{2}-\d{2})"[^>]*data-level="([0-4])"/g)]
  .map(([, date, level]) => ({ date, level: Number(level) }))
  .sort((left, right) => left.date.localeCompare(right.date));

if (cells.length < 300) {
  throw new Error(`Expected a full public contribution calendar; found only ${cells.length} cells.`);
}

const start = new Date(`${cells[0].date}T00:00:00Z`);
const dayMilliseconds = 24 * 60 * 60 * 1000;
const monthLabel = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' });

function renderHeatmap({ dark }) {
  const theme = dark
    ? {
        background: '#0d1117', border: '#30363d', text: '#f0f6fc', muted: '#8b949e',
        levels: ['#161b22', '#0f3d4f', '#0e7490', '#06b6d4', '#8b5cf6'],
      }
    : {
        background: '#ffffff', border: '#d0d7de', text: '#24292f', muted: '#57606a',
        levels: ['#ebedf0', '#bfe6ed', '#7dd3e2', '#22b8cf', '#7c3aed'],
      };

  const cellSize = 12;
  const cellGap = 4;
  const left = 62;
  const top = 87;
  const weekWidth = cellSize + cellGap;
  const monthLabels = new Map();
  const squares = cells.map(({ date, level }) => {
    const current = new Date(`${date}T00:00:00Z`);
    const day = current.getUTCDay();
    const week = Math.floor((current - start) / dayMilliseconds / 7);
    if (current.getUTCDate() <= 7 && day === 0) {
      monthLabels.set(week, monthLabel.format(current));
    }
    return `<rect x="${left + week * weekWidth}" y="${top + day * weekWidth}" width="${cellSize}" height="${cellSize}" rx="2" fill="${theme.levels[level]}"/>`;
  }).join('');
  const months = [...monthLabels.entries()]
    .map(([week, label]) => `<text x="${left + week * weekWidth}" y="68" fill="${theme.muted}" font-family="ui-sans-serif,system-ui,sans-serif" font-size="11">${label}</text>`)
    .join('');
  const legend = theme.levels
    .map((color, index) => `<rect x="${1040 + index * 17}" y="202" width="12" height="12" rx="2" fill="${color}"/>`)
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 240" role="img" aria-labelledby="title description">
  <title id="title">${username}'s public GitHub contribution heatmap</title>
  <desc id="description">A year of public GitHub contribution activity, updated daily.</desc>
  <rect width="1200" height="240" rx="12" fill="${theme.background}"/>
  <rect x="16" y="16" width="1168" height="208" rx="9" fill="${theme.background}" stroke="${theme.border}"/>
  <text x="62" y="45" fill="${theme.text}" font-family="ui-sans-serif,system-ui,sans-serif" font-size="18" font-weight="700">Public contribution activity</text>
  <text x="1138" y="45" text-anchor="end" fill="${theme.muted}" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="10" letter-spacing="1">UPDATED DAILY</text>
  ${months}
  <text x="30" y="108" fill="${theme.muted}" font-family="ui-sans-serif,system-ui,sans-serif" font-size="10">Sun</text>
  <text x="29" y="140" fill="${theme.muted}" font-family="ui-sans-serif,system-ui,sans-serif" font-size="10">Tue</text>
  <text x="27" y="172" fill="${theme.muted}" font-family="ui-sans-serif,system-ui,sans-serif" font-size="10">Thu</text>
  ${squares}
  <text x="1005" y="213" fill="${theme.muted}" font-family="ui-sans-serif,system-ui,sans-serif" font-size="10">Less</text>
  ${legend}
  <text x="1132" y="213" fill="${theme.muted}" font-family="ui-sans-serif,system-ui,sans-serif" font-size="10">More</text>
</svg>`;
}

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(path.join(outputDirectory, 'contribution-heatmap.svg'), renderHeatmap({ dark: false })),
  writeFile(path.join(outputDirectory, 'contribution-heatmap-dark.svg'), renderHeatmap({ dark: true })),
]);
