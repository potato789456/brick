'use strict';
/* Pictures for the evening back routine: a simple side-view figure in each position.
   Each pose lists joints in a 180×112 box (floor at y=104). "N" = near-side limb (dark), "F" = far-side limb (light). */

const QUAD = { head: [146, 52], sh: [128, 62], hip: [62, 62], c: [95, 62], armN: [[129, 83], [130, 104]], armF: [[124, 83], [125, 104]], legN: [[64, 104], [28, 104]], legF: [[59, 104], [23, 104]] };
const SUP = { head: [24, 92], sh: [42, 95], hip: [96, 97], c: [69, 96], armN: [[60, 100], [78, 102]], armF: [[58, 98], [76, 100]], legN: [[124, 66], [146, 104]], legF: [[119, 66], [141, 104]] };
const KNEEL = { head: [80, 13], sh: [79, 30], hip: [78, 68], c: [77, 49], armN: [[70, 50], [84, 64]], armF: [[88, 50], [80, 64]], legN: [[116, 68], [118, 104]], legF: [[76, 104], [44, 102]] };
const P = (base, o) => Object.assign({}, base, o);

const POSES = {
  catcow: [
    { cap: 'Cat: round your back up, chin to chest', p: P(QUAD, { c: [95, 40], head: [146, 72], sh: [128, 60], hip: [62, 60] }), arrow: [95, 30, 95, 18] },
    { cap: 'Cow: let the belly sag a little, look ahead', p: P(QUAD, { c: [95, 76], head: [150, 46] }), arrow: [95, 86, 95, 96] },
  ],
  hipflexor: [
    { cap: 'Half-kneel, back knee on a soft mat, tall chest', p: KNEEL },
    { cap: 'Tuck the pelvis (squeeze the glute), shift forward', p: P(KNEEL, { head: [90, 15], sh: [89, 32], hip: [91, 70], c: [89, 51], armN: [[81, 52], [95, 66]], armF: [[99, 52], [93, 66]], legN: [[125, 72], [118, 104]] }), arrow: [104, 40, 122, 40] },
  ],
  figure4: [
    { cap: 'On your back, ankle over the opposite knee', p: P(SUP, { legF: [[104, 58], [124, 63]] }) },
    { cap: 'Lift the bottom foot, pull that thigh toward you', p: P(SUP, { legN: [[110, 60], [136, 66]], legF: [[92, 56], [112, 58]], armN: [[66, 80], [104, 66]], armF: [[64, 78], [101, 64]] }), arrow: [130, 46, 114, 46] },
  ],
  birddog: [
    { cap: 'Hands and knees, flat back', p: QUAD },
    { cap: 'Reach one arm forward and the opposite leg back. Hold 5 s', p: P(QUAD, { armN: [[151, 58], [173, 55]], legF: [[38, 61], [12, 59]] }) },
    { cap: 'Swap: other arm, other leg', p: P(QUAD, { armF: [[149, 57], [171, 54]], legN: [[40, 62], [14, 60]] }) },
  ],
  deadbug: [
    { cap: 'Arms up, knees over hips at 90°, back pressed down', p: P(SUP, { armN: [[44, 73], [46, 51]], armF: [[49, 73], [51, 51]], legN: [[100, 62], [130, 62]], legF: [[95, 62], [125, 60]] }) },
    { cap: 'Slowly lower one arm back and the opposite leg out', p: P(SUP, { armN: [[44, 73], [46, 51]], armF: [[24, 84], [6, 96]], legN: [[132, 90], [166, 98]], legF: [[95, 62], [125, 60]] }), arrow: [150, 74, 160, 86] },
  ],
  kneehug: [
    { cap: 'On your back, knees bent, feet flat', p: SUP },
    { cap: 'Hug one knee gently to your chest, breathe', p: P(SUP, { legN: [[80, 62], [104, 72]], armN: [[60, 74], [80, 60]], armF: [[58, 72], [77, 58]] }), arrow: [118, 56, 100, 52] },
  ],
};

function figure(p) {
  const ink = '#3d2a22', far = '#c4a593';
  const limb = (from, pts, col, w) => `<path d="M${from} L${pts[0]} L${pts[1]}" stroke="${col}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  return [
    limb(p.sh, p.armF, far, 6), limb(p.hip, p.legF, far, 7),
    `<path d="M${p.sh} Q${p.c} ${p.hip}" stroke="${ink}" stroke-width="10" fill="none" stroke-linecap="round"/>`,
    `<path d="M${p.sh} L${p.head}" stroke="${ink}" stroke-width="6" stroke-linecap="round"/>`,
    limb(p.hip, p.legN, ink, 7), limb(p.sh, p.armN, ink, 6),
    `<circle cx="${p.head[0]}" cy="${p.head[1]}" r="9" fill="${ink}"/>`,
  ].join('');
}
function poseSVG(frame, flip) {
  const a = frame.arrow;
  const arrow = a ? `<g stroke="#d9583b" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M${a[0]} ${a[1]} L${a[2]} ${a[3]}"/><path d="M${a[2]} ${a[3]} l${-(a[2] - a[0]) * .35 - (a[3] - a[1]) * .25} ${-(a[3] - a[1]) * .35 + (a[2] - a[0]) * .25} M${a[2]} ${a[3]} l${-(a[2] - a[0]) * .35 + (a[3] - a[1]) * .25} ${-(a[3] - a[1]) * .35 - (a[2] - a[0]) * .25}"/></g>` : '';
  return `<svg class="pose" viewBox="0 0 180 112" aria-hidden="true"><rect x="2" y="104" width="176" height="6" rx="3" fill="#ecd6c1"/>
    <g ${flip ? 'transform="translate(180 0) scale(-1 1)"' : ''}>${figure(frame.p)}${arrow}</g></svg>`;
}
function posesHTML(move, big) {
  const frames = POSES[move.art] || [];
  return `<div class="poses ${big ? 'big' : ''} n${frames.length}">${frames.map((f, i) => `<figure><div class="pnum">${i + 1}</div>${poseSVG(f, move.flip)}<figcaption>${esc(f.cap)}</figcaption></figure>`).join('')}</div>`;
}
