'use strict';
/* Brick, the mascot, drawn as inline SVG. mood: 'ready' | 'flex' | 'sleepy' | 'calm' */
function brickSVG(mood = 'ready', size = 120) {
  const body = `
    <rect x="22" y="40" width="116" height="72" rx="12" fill="#d9583b"/>
    <rect x="22" y="40" width="116" height="72" rx="12" fill="url(#bk-shade)"/>
    <path d="M22 76h116M80 40v36M51 76v36M109 76v36" stroke="#b8442b" stroke-width="3" opacity=".55"/>
    <rect x="22" y="40" width="116" height="72" rx="12" fill="none" stroke="#7a2b1b" stroke-width="3.5"/>`;
  const defs = `<defs><linearGradient id="bk-shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></linearGradient></defs>`;
  let eyes, brows, mouth, arms = '', extra = '';
  const legs = `<path d="M58 112v14h-10M102 112v14h10" stroke="#7a2b1b" stroke-width="5" stroke-linecap="round" fill="none"/>`;
  if (mood === 'sleepy' || mood === 'calm') {
    eyes = `<path d="M60 70q6 5 12 0M92 70q6 5 12 0" stroke="#2b1a14" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
    brows = '';
    mouth = mood === 'calm' ? `<path d="M74 88q6 5 12 0" stroke="#2b1a14" stroke-width="3" fill="none" stroke-linecap="round"/>` : `<ellipse cx="80" cy="89" rx="4" ry="3" fill="#2b1a14"/>`;
    arms = `<path d="M22 86q-12 6-10 18M138 86q12 6 10 18" stroke="#7a2b1b" stroke-width="5" stroke-linecap="round" fill="none"/>`;
    if (mood === 'sleepy') extra = `<text x="140" y="38" font-size="16" font-weight="800" fill="#7a2b1b" font-family="system-ui">z</text><text x="150" y="24" font-size="12" font-weight="800" fill="#7a2b1b" font-family="system-ui">z</text>`;
  } else {
    eyes = `<circle cx="66" cy="70" r="6" fill="#fff"/><circle cx="98" cy="70" r="6" fill="#fff"/><circle cx="67.5" cy="71" r="3.6" fill="#2b1a14"/><circle cx="99.5" cy="71" r="3.6" fill="#2b1a14"/>`;
    brows = `<path d="M56 58l18 6M108 58l-18 6" stroke="#2b1a14" stroke-width="4" stroke-linecap="round"/>`;
    mouth = mood === 'flex'
      ? `<path d="M70 86q10 10 20 0z" fill="#2b1a14"/>`
      : `<path d="M72 89h16" stroke="#2b1a14" stroke-width="3.5" stroke-linecap="round"/>`;
    if (mood === 'flex') {
      arms = `<path d="M22 80q-16-2-16-22M138 80q16-2 16-22" stroke="#7a2b1b" stroke-width="6" stroke-linecap="round" fill="none"/>
        <circle cx="6" cy="56" r="7" fill="#d9583b" stroke="#7a2b1b" stroke-width="3"/><circle cx="154" cy="56" r="7" fill="#d9583b" stroke="#7a2b1b" stroke-width="3"/>`;
      extra = `<path d="M30 26l4 8M80 14v9M130 26l-4 8" stroke="#e8a33d" stroke-width="4" stroke-linecap="round"/>`;
    } else {
      // holding a dumbbell
      arms = `<path d="M22 84q-10 4-12 16M138 84q10 4 12 16" stroke="#7a2b1b" stroke-width="5" stroke-linecap="round" fill="none"/>
        <rect x="140" y="98" width="20" height="5" rx="2" fill="#5a5a5a"/><rect x="138" y="92" width="6" height="17" rx="2" fill="#333"/><rect x="156" y="92" width="6" height="17" rx="2" fill="#333"/>`;
    }
  }
  return `<svg class="brick-svg" viewBox="0 0 170 134" width="${size}" height="${Math.round(size * 134 / 170)}" aria-hidden="true">${defs}${extra}${legs}${arms}${body}${brows}${eyes}${mouth}
    <ellipse cx="80" cy="130" rx="46" ry="3.5" fill="#000" opacity=".08"/></svg>`;
}

/* The wall: one brick per finished workout, laid in running bond from the bottom up. */
function wallSVG(sessions, opts = {}) {
  const perRow = opts.perRow || 6, W = 52, H = 24, G = 4, rows = Math.max(opts.minRows || 4, Math.ceil(sessions.length / perRow) + 1);
  const width = perRow * (W + G) + W / 2 + G, height = rows * (H + G) + G;
  let out = '';
  for (let r = 0; r < rows; r++) {
    const y = height - (r + 1) * (H + G);
    const off = r % 2 ? W / 2 + G / 2 : 0;
    for (let c = 0; c < perRow; c++) {
      const i = r * perRow + c, x = G + off + c * (W + G);
      const s = sessions[i];
      if (s) {
        const col = (DAYS[s.day] || {}).color || '#d9583b';
        const isNew = opts.newest && i === sessions.length - 1;
        out += `<g class="wb${isNew ? ' drop' : ''}" data-a="openSession" data-id="${s.id}" style="--d:${isNew ? 0 : 0}s">
          <rect x="${x}" y="${y}" width="${W}" height="${H}" rx="4" fill="${col}"/>
          <rect x="${x}" y="${y}" width="${W}" height="${H / 2.6}" rx="4" fill="#fff" opacity=".18"/>
          <rect x="${x}" y="${y}" width="${W}" height="${H}" rx="4" fill="none" stroke="#00000033" stroke-width="1.5"/></g>`;
      } else {
        out += `<rect x="${x}" y="${y}" width="${W}" height="${H}" rx="4" fill="none" stroke="#c9b6a3" stroke-width="1.5" stroke-dasharray="4 4"/>`;
      }
    }
  }
  return `<svg class="wall-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMax meet">${out}</svg>`;
}
