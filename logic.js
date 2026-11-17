'use strict';
/* Brick — loads you can actually build with your equipment, and the progression suggestions. */

const r2 = n => Math.round(n * 100) / 100;

// Every per-side (or per-end) sum you can make from the given plate limits, with the fewest plates.
function plateSums(limits, maxCount) {
  const types = Object.keys(limits).map(Number).sort((a, b) => b - a);
  const out = new Map(); // sum -> [plates]
  (function rec(i, sum, used) {
    if (i === types.length) {
      const k = r2(sum);
      if (!out.has(k) || out.get(k).length > used.length) out.set(k, used.slice());
      return;
    }
    const p = types[i];
    for (let c = 0; c <= limits[p] && used.length + c <= maxCount; c++) {
      for (let j = 0; j < c; j++) used.push(p);
      rec(i + 1, sum + p * c, used);
      for (let j = 0; j < c; j++) used.pop();
    }
  })(0, 0, []);
  return out;
}

const loadCache = {};
// Sorted list of { kg, how } for an equipment type. `how` explains the plates.
function loadsFor(eq) {
  const dbEnd = (typeof S !== 'undefined' && S.set && S.set.dbEnd) || 4;
  const ck = eq + ':' + dbEnd;
  if (loadCache[ck]) return loadCache[ck];
  let list = [];
  if (eq === 'machine') {
    for (let kg = 20; kg <= 50; kg += 5) list.push({ kg, how: '' });
  } else if (eq === 'barbell' || eq === 'ez') {
    const lim = {}; Object.keys(PLATES).forEach(p => { lim[p] = Math.floor(PLATES[p] / 2); });
    const bar = EQUIP[eq].bar;
    plateSums(lim, 8).forEach((pl, side) => list.push({ kg: r2(bar + side * 2), how: pl.length ? 'per side: ' + pl.join(' + ') : 'empty bar' }));
  } else if (eq === 'dbpair' || eq === 'dbsingle') {
    const ends = eq === 'dbpair' ? 4 : 2, lim = {};
    DB_PLATES.forEach(p => { lim[p] = Math.floor(PLATES[p] / ends); });
    plateSums(lim, dbEnd).forEach((pl, end) => list.push({ kg: r2(2 + end * 2), how: pl.length ? 'per end: ' + pl.join(' + ') : 'empty handle' }));
  }
  // keep the simplest build for each weight
  const m = new Map();
  list.forEach(x => { const o = m.get(x.kg); if (!o || x.how.length < o.how.length) m.set(x.kg, x); });
  list = [...m.values()].sort((a, b) => a.kg - b.kg);
  loadCache[ck] = list;
  return list;
}
const hasLoads = eq => eq !== 'free' && eq !== 'bw';
function snapLoad(eq, kg) {
  if (!hasLoads(eq)) return kg;
  const L = loadsFor(eq); let best = L[0];
  L.forEach(x => { if (Math.abs(x.kg - kg) < Math.abs(best.kg - kg)) best = x; });
  return best.kg;
}
function stepLoad(eq, kg, dir) {
  if (eq === 'free') return Math.max(0, r2((+kg || 0) + dir * (+kg >= 20 ? 2.5 : 1)));
  if (!hasLoads(eq)) return kg;
  const L = loadsFor(eq);
  if (kg === '' || kg == null || isNaN(kg)) return L[Math.min(L.length - 1, Math.floor(L.length / 3))].kg;
  if (dir > 0) { const x = L.find(x => x.kg > +kg + 1e-9); return x ? x.kg : null; }
  const rev = L.slice().reverse().find(x => x.kg < +kg - 1e-9); return rev ? rev.kg : null;
}
function loadHow(eq, kg) {
  if (!hasLoads(eq) || kg === '' || kg == null) return '';
  const x = loadsFor(eq).find(x => Math.abs(x.kg - kg) < 1e-9);
  return x ? x.how : 'can’t build this exactly';
}

// Smallest sensible jump up (barbell +1 kg is technically buildable but pointless).
const MIN_UP = { barbell: 2, ez: 2, dbpair: 1, dbsingle: 1, machine: 5, free: 1 };
function upLoad(eq, kg) {
  if (eq === 'free') return stepLoad(eq, kg, 1);
  const x = loadsFor(eq).find(x => x.kg >= kg + (MIN_UP[eq] || 1) - 1e-9);
  return x ? x.kg : null;
}
// About 10% lighter (after pain or a long break), but at least one step down.
function lighter(eq, kg) {
  if (!hasLoads(eq)) return eq === 'free' ? Math.max(0, r2(kg * 0.9)) : kg;
  const L = loadsFor(eq), cand = L.filter(x => x.kg <= kg * 0.9 + 1e-9);
  return cand.length ? cand[cand.length - 1].kg : (stepLoad(eq, kg, -1) ?? kg);
}

const e1rm = (kg, reps) => kg * (1 + reps / 30);
const repsAt = (e1, kg) => Math.floor(30 * (e1 / kg - 1));

// The most recent completed performance of an exercise (any day, any time ago).
function lastPerf(key, before) {
  for (let i = S.log.length - 1; i >= 0; i--) {
    const s = S.log[i];
    if (before && s.id === before) continue;
    const e = s.ex.find(e => e.k === key);
    if (!e) continue;
    const sets = e.sets.filter(x => x.done && +x.reps > 0);
    if (sets.length) return { date: s.date, sets, effort: e.effort || 'solid', pain: !!e.pain };
  }
  return null;
}
function bestE1(key) {
  let b = 0;
  S.log.forEach(s => s.ex.forEach(e => { if (e.k === key) e.sets.forEach(x => { if (x.done && +x.kg > 0 && +x.reps > 0) b = Math.max(b, e1rm(+x.kg, +x.reps)); }); }));
  return b;
}
function bestReps(key) {
  let b = 0;
  S.log.forEach(s => s.ex.forEach(e => { if (e.k === key) e.sets.forEach(x => { if (x.done) b = Math.max(b, +x.reps || 0); }); }));
  return b;
}
const daysAgo = iso => Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);

/* The suggestion for today.
   Double progression on the loads you can build: add reps inside the range, then add weight.
   When the next weight jump is big (like +5 kg on the machine), bank extra reps above the range first,
   then jump and land on the reps your estimated 1-rep max predicts. On a cut, matching last time is a win. */
function suggest(key, nSets) {
  const ex = EX[key], n = nSets || ex.sets, L = lastPerf(key);
  const fill = (kg, reps) => Array.from({ length: n }, (_, i) => ({ kg, reps: Array.isArray(reps) ? reps[Math.min(i, reps.length - 1)] : reps }));

  if (!L) return {
    sets: fill(ex.eq === 'bw' ? 0 : '', ex.min), kind: 'new',
    note: ex.eq === 'bw' ? `First time logged. Aim for ${ex.min}–${ex.max} clean reps.` : `First time logged. Pick a weight you could do ~${ex.max} reps with, and stop 1–2 reps short. Brick learns from there.`,
  };

  const lastReps = i => +((L.sets[i] || L.sets[L.sets.length - 1]).reps);
  const inc = L.effort === 'easy' ? 2 : L.effort === 'hard' ? 0 : 1;
  const gap = daysAgo(L.date);

  if (ex.eq === 'bw') {
    const reps = Array.from({ length: n }, (_, i) => L.pain ? Math.min(lastReps(i), ex.min) : lastReps(i) + (gap >= 21 ? 0 : inc));
    return { sets: fill(0, reps), kind: L.pain ? 'pain' : 'reps', note: L.pain ? 'Pain flagged last time. Fewer, smooth reps.' : inc ? 'Beat each set by a rep.' : 'Last time was a grind. Match it.' };
  }

  const W = Math.max(...L.sets.map(x => +x.kg || 0));
  const atW = L.sets.filter(x => +x.kg === W);
  const e1 = Math.max(...L.sets.map(x => e1rm(+x.kg || 0, +x.reps)));

  if (L.pain) {
    const kg = lighter(ex.eq, W);
    return { sets: fill(kg, ex.min), kind: 'pain', note: 'Pain flagged last time: about 10% lighter, smooth reps. If it travels down your leg, swap or skip it.' };
  }
  if (gap >= 21) {
    const kg = lighter(ex.eq, W);
    const pr = kg > 0 ? Math.min(ex.max, Math.max(ex.min, repsAt(e1, kg) - 2)) : ex.min;
    return { sets: fill(kg, pr), kind: 'back', note: `Last done ${gap} days ago. About 10% lighter to find your groove. Next time it moves again.` };
  }

  const up = upLoad(ex.eq, W);
  const jump = up ? (up - W) / Math.max(W, 1) : 0;
  const thr = ex.max + (jump > 0.15 ? 2 : jump > 0.08 ? 1 : 0);
  const minAtW = Math.min(...atW.map(x => +x.reps));

  if (L.effort === 'hard') {
    return { sets: fill(W, Array.from({ length: n }, (_, i) => lastReps(i))), kind: 'hold', note: 'Last time was a grind. Match it today. On a cut, matching is a win.' };
  }
  if (up == null) {
    return { sets: fill(W, Array.from({ length: n }, (_, i) => lastReps(i) + inc)), kind: 'reps', note: 'Heaviest you can load here. Add reps, or slow the lowering to 3 seconds.' };
  }
  if (minAtW >= thr) {
    const pred = repsAt(e1, up);
    if (pred >= ex.min - 1) {
      const reps = Math.max(ex.min, Math.min(ex.max, pred));
      return { sets: fill(up, reps), kind: 'up', note: `Weight up: ${W} → ${up} kg. Aim for ${reps} reps.` };
    }
    return { sets: fill(W, Array.from({ length: n }, (_, i) => Math.min(lastReps(i) + Math.max(inc, 1), thr + 4))), kind: 'bank', note: `Next jump (+${r2(up - W)} kg) is big. Bank a few extra reps first.` };
  }
  const reps = Array.from({ length: n }, (_, i) => Math.min(lastReps(i) + inc, thr));
  return { sets: fill(W, reps), kind: 'reps', note: thr > ex.max ? `Same weight. Push to ${thr} reps on every set, then the weight goes up.` : `Same weight. Beat each set by a rep. At ${ex.max} reps on all sets, the weight goes up.` };
}
