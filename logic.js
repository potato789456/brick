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


const daysAgo = iso => Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
const isBw = key => EX[key].eq === 'bw';

// Every finished performance of an exercise, oldest first, with a single "score" to compare sessions:
// estimated 1-rep max of the best set (bodyweight: most reps in one set), plus total reps.
function perfHistory(key) {
  const out = [];
  S.log.forEach(s => {
    const e = s.ex.find(e => e.k === key);
    if (!e) return;
    const sets = e.sets.filter(x => x.done && +x.reps > 0);
    if (!sets.length) return;
    let best = sets[0], score = 0;
    sets.forEach(x => { const v = isBw(key) ? +x.reps : e1rm(+x.kg || 0, +x.reps); if (v > score) { score = v; best = x; } });
    out.push({ id: s.id, date: s.date, sets, best, score, top: Math.max(...sets.map(x => +x.kg || 0)), reps: sets.reduce((a, x) => a + +x.reps, 0) });
  });
  return out;
}
const lastPerf = key => { const h = perfHistory(key); return h.length ? h[h.length - 1] : null; };
const bestE1 = key => Math.max(0, ...perfHistory(key).filter(p => !isBw(key)).map(p => p.score));
const bestReps = key => Math.max(0, ...perfHistory(key).filter(p => isBw(key)).map(p => p.score));

// Did this session beat that one? Higher estimated max, or more total reps at the same top weight.
const improved = (a, b) => a.score > b.score * 1.001 || (a.top === b.top && a.reps > b.reps);

/* Stall: none of the last 3 sessions beat the session before them. Returns fix ideas, never changes anything. */
function stallInfo(key) {
  const h = perfHistory(key);
  if (h.length < 4) return null;
  const base = h[h.length - 4], recent = h.slice(-3);
  if (recent.some(p => improved(p, base))) return null;
  const ex = EX[key], tips = [];
  if (!isBw(key) && hasLoads(ex.eq) || ex.eq === 'free') tips.push(`drop to ${lighter(ex.eq, base.top)} kg and build back up over a few sessions`);
  tips.push(`add one set (${ex.sets + 1} instead of ${ex.sets})`);
  if (ex.alts.length) tips.push(`swap to ${EX[ex.alts[0]].name} for a few weeks (⋯ menu)`);
  return { tips };
}

/* The suggestion for today, based only on what you logged.
   Hit the target last time → move on: add reps inside the range, then add weight (only loads you can build).
   When the next weight jump is big (like +5 kg on the machine), bank extra reps above the range first,
   then jump and land on the reps your estimated 1-rep max predicts.
   Missed the target → same target again, no penalty. Long break → about 10% lighter. */
function suggest(key, nSets) {
  const ex = EX[key], n = nSets || ex.sets, L = lastPerf(key);
  const fill = (kg, reps) => Array.from({ length: n }, (_, i) => ({ kg, reps: Array.isArray(reps) ? reps[Math.min(i, reps.length - 1)] : reps }));

  if (!L) return {
    sets: fill(isBw(key) ? 0 : '', ex.min), kind: 'new',
    note: isBw(key) ? `First time logged. Aim for ${ex.min}–${ex.max} clean reps.` : `First time logged. Pick a weight you could do ~${ex.max} reps with, and stop 1–2 reps short. Brick learns from there.`,
  };

  const lastSet = i => L.sets[i] || L.sets[L.sets.length - 1];
  const lastReps = i => +lastSet(i).reps;
  const gap = daysAgo(L.date);
  // missed = a set done at (or above) the suggested weight but short of the suggested reps
  const missed = L.sets.some(x => x.t && +x.reps < +x.t && (x.tk == null || x.tk === '' || +x.kg >= +x.tk));
  const holdReps = Array.from({ length: n }, (_, i) => { const x = lastSet(i); return Math.max(+x.reps, +x.t || 0); });

  if (isBw(key)) {
    if (missed) return { sets: fill(0, holdReps), kind: 'hold', note: 'Missed a few reps last time. Same target again, no rush.' };
    return { sets: fill(0, Array.from({ length: n }, (_, i) => lastReps(i) + (gap >= 21 ? 0 : 1))), kind: 'reps', note: gap >= 21 ? `Last done ${gap} days ago. Match last time.` : 'Beat each set by a rep.' };
  }

  const W = L.top;
  const atW = L.sets.filter(x => +x.kg === W);
  const e1 = Math.max(...L.sets.map(x => e1rm(+x.kg || 0, +x.reps)));

  if (gap >= 21) {
    const kg = lighter(ex.eq, W);
    const pr = kg > 0 ? Math.min(ex.max, Math.max(ex.min, repsAt(e1, kg) - 2)) : ex.min;
    return { sets: fill(kg, pr), kind: 'back', note: `Last done ${gap} days ago. About 10% lighter to find your groove. Next time it moves again.` };
  }
  if (missed) return { sets: fill(W, holdReps), kind: 'hold', note: 'Missed a few reps last time. Same target again, no rush.' };

  const up = upLoad(ex.eq, W);
  const jump = up ? (up - W) / Math.max(W, 1) : 0;
  const thr = ex.max + (jump > 0.15 ? 2 : jump > 0.08 ? 1 : 0);
  const minAtW = Math.min(...atW.map(x => +x.reps));

  if (up == null) {
    return { sets: fill(W, Array.from({ length: n }, (_, i) => lastReps(i) + 1)), kind: 'reps', note: 'Heaviest you can load here. Add reps, or slow the lowering to 3 seconds.' };
  }
  if (minAtW >= thr) {
    const pred = repsAt(e1, up);
    if (pred >= ex.min - 1) {
      const reps = Math.max(ex.min, Math.min(ex.max, pred));
      return { sets: fill(up, reps), kind: 'up', note: `Weight up: ${W} → ${up} kg. Aim for ${reps} reps.` };
    }
    return { sets: fill(W, Array.from({ length: n }, (_, i) => Math.min(lastReps(i) + 1, thr + 4))), kind: 'bank', note: `Next jump (+${r2(up - W)} kg) is big. Bank a few extra reps first.` };
  }
  const reps = Array.from({ length: n }, (_, i) => Math.min(lastReps(i) + 1, thr));
  return { sets: fill(W, reps), kind: 'reps', note: thr > ex.max ? `Same weight. Push to ${thr} reps on every set, then the weight goes up.` : `Same weight. Beat each set by a rep. At ${ex.max} reps on all sets, the weight goes up.` };
}
