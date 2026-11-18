'use strict';
/* Brick — state, views and actions.
   Several people can use one phone. "brick.profiles" lists them; each person's data is one object S in its own key:
   the first person keeps the original key "brick.v1" (so existing data is untouched), others use "brick.v1.<id>".
   normalize() fills in missing fields for older saves: never rename the keys or break the data shape. */
const REG_KEY = 'brick.profiles';
let KEY = 'brick.v1', REG = null;
const keyFor = id => id === 'p1' ? 'brick.v1' : 'brick.v1.' + id;
const VERSION = 'v1';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pick = a => a[Math.floor(Math.random() * a.length)];
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dayStr = iso => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fmtDate = iso => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const fmtDur = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`; };
const agoText = iso => { const d = daysAgo(iso); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 14 ? `${d} days ago` : d < 60 ? `${Math.round(d / 7)} weeks ago` : `${Math.round(d / 30)} months ago`; };
const kgTxt = kg => (kg === '' || kg == null) ? '?' : String(+kg);

let S, view = 'home', restEnd = 0, restDur = 0, tick = null, backRun = null, doneInfo = null, homeQuote = '';

/* ---------- storage ---------- */
function defaults() {
  return { v: 1, log: [], cur: null, set: { rest: 90, dbEnd: 4 }, plan: {}, back: [], cloud: { on: false, key: '', last: 0, err: '' }, fb: {}, prof: { kind: 'tough', back: true } };
}
function normalize(x) {
  const d = defaults();
  x = x && typeof x === 'object' ? x : {};
  Object.keys(d).forEach(k => { if (x[k] === undefined) x[k] = d[k]; });
  x.set = Object.assign({}, d.set, x.set);
  x.cloud = Object.assign({}, d.cloud, x.cloud);
  x.prof = Object.assign({}, d.prof, x.prof);
  if (!PROGRAMS[x.prof.kind]) x.prof.kind = 'tough';
  if (!Array.isArray(x.log)) x.log = [];
  if (!Array.isArray(x.back)) x.back = [];
  x.log.forEach(s => { s.ex = (s.ex || []).filter(e => EX[e.k]); });
  if (x.cur && (!x.cur.ex || !DAYS[x.cur.day])) x.cur = null;
  Object.keys(x.plan).forEach(day => { if (!DAYS[day] || !Array.isArray(x.plan[day])) delete x.plan[day]; else x.plan[day] = x.plan[day].filter(k => EX[k]); });
  return x;
}
function saveLocal() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }
function save() { saveLocal(); if (typeof queueCloud === 'function') queueCloud(); }
function regLoad() {
  try { REG = JSON.parse(localStorage.getItem(REG_KEY)); } catch (e) { }
  if (!REG || !Array.isArray(REG.list) || !REG.list.length) REG = { active: 'p1', list: [{ id: 'p1', name: 'Me' }] };
  if (!REG.list.some(p => p.id === REG.active)) REG.active = REG.list[0].id;
}
function regSave() { try { localStorage.setItem(REG_KEY, JSON.stringify(REG)); } catch (e) { } }
const activeProfile = () => REG.list.find(p => p.id === REG.active);
function load() {
  regLoad(); KEY = keyFor(REG.active);
  let x = null;
  try { x = JSON.parse(localStorage.getItem(KEY)); } catch (e) { }
  S = normalize(x);
  document.body.dataset.tone = S.prof.kind;
}
// Switch person: save the current one, forget the other person's cloud sign-in, load the new one.
function switchTo(id) {
  if (S) saveLocal();
  REG.active = id; regSave();
  if (typeof idTok !== 'undefined') { idTok = null; idExp = 0; lastCloud = null; clearTimeout(cloudT); }
  restEnd = 0; backRun = null; doneInfo = null; homeQuote = '';
  load(); view = S.cur ? 'workout' : 'home'; window.scrollTo(0, 0); render();
  if (S.cloud.on) queueCloud();
}

/* ---------- helpers ---------- */
const PROG = () => PROGRAMS[S.prof.kind];
const QS = () => S.prof.kind === 'happy' ? QUOTES_HAPPY : QUOTES;
// the mascot's mood in this person's style
const moodFor = m => S.prof.kind !== 'happy' ? m : ({ flex: 'cheer', ready: 'happy' }[m] || m);
const planFor = day => (S.plan[day] && S.plan[day].length ? S.plan[day] : DAYS[day].ex);
function nextDay() {
  const R = PROG().rotation;
  for (let i = S.log.length - 1; i >= 0; i--) {
    const j = R.indexOf(S.log[i].day);
    if (j >= 0) return R[(j + 1) % R.length];
  }
  return R[0];
}
const lastSession = () => S.log[S.log.length - 1];
function weekStart(d = new Date()) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
const thisWeek = () => { const ws = weekStart().getTime(); return S.log.filter(s => new Date(s.date).getTime() >= ws); };
const doneSets = e => e.sets.filter(x => x.done);
const sheetOpen = () => !$('#sheet').hidden;

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 2200);
}
function openSheet(html) { $('#sheet-body').innerHTML = html; $('#sheet').hidden = false; document.body.classList.add('noscroll'); }
function closeSheet() { $('#sheet').hidden = true; document.body.classList.remove('noscroll'); }

/* ---------- views ---------- */
function render() {
  const app = $('#app');
  const inWorkout = view === 'workout' && S.cur;
  document.body.dataset.view = view;
  document.body.dataset.tone = S.prof.kind;
  if (view === 'back' && !S.prof.back) view = 'home';
  const bt = $('#tabs [data-v="back"]'); if (bt) bt.hidden = !S.prof.back;
  $('#tabs').hidden = inWorkout || view === 'done' || view === 'backrun';
  if (view === 'workout' && !S.cur) view = 'home';
  const html = { home: vHome, workout: vWorkout, wall: vWall, back: vBack, me: vMe, done: vDone, backrun: vBackRun }[view]();
  app.innerHTML = html;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === view));
  renderRest();
}

function vHome() {
  const last = lastSession(), gap = last ? daysAgo(last.date) : 0;
  const mood = S.cur ? 'ready' : last && gap >= 7 ? 'sleepy' : 'ready';
  if (!homeQuote) homeQuote = last && gap >= 7 ? pick(QS().gap) : pick(QS().home);
  const nd = nextDay(), D = DAYS[nd];
  const wk = thisWeek(), slots = Math.max(PROG().goal, wk.length);
  let weekBricks = '';
  for (let i = 0; i < slots; i++) {
    const s = wk[i];
    weekBricks += s ? `<div class="wbrick" style="background:${DAYS[s.day].color}" title="${DAYS[s.day].name}">${DAYS[s.day].name[0]}</div>` : `<div class="wbrick empty"></div>`;
  }
  const backDone = S.back.includes(todayStr());
  let main;
  if (S.cur) {
    const C = DAYS[S.cur.day], n = S.cur.ex.reduce((a, e) => a + doneSets(e).length, 0);
    main = `<div class="card next" style="--c:${C.color}">
      <div class="eyebrow">Workout in progress</div>
      <div class="next-name">${C.name}</div>
      <div class="muted">${n} sets logged · started ${fmtDur((Date.now() - S.cur.start) / 1000)} ago</div>
      <button class="btn big" data-a="goWorkout">Continue ${C.name}</button></div>`;
  } else {
    const rows = planFor(nd).map(k => {
      const L = lastPerf(k), e = EX[k];
      const top = L ? (e.eq === 'bw' ? `${Math.max(...L.sets.map(x => +x.reps))} reps` : `${kgTxt(Math.max(...L.sets.map(x => +x.kg || 0)))} kg × ${L.sets[0].reps}`) : 'new';
      return `<li><span>${esc(e.name)}</span><span class="muted">${top}</span></li>`;
    }).join('');
    main = `<div class="card next" style="--c:${D.color}">
      <div class="eyebrow">Next up</div>
      <div class="next-name">${D.name}</div>
      <div class="muted">${D.focus}</div>
      <ul class="plan-list">${rows}</ul>
      <button class="btn big" data-a="start" data-day="${nd}">Start ${D.name}</button>
      <div class="other">Different day: ${PROG().days.filter(d => d !== nd).map(d => `<button class="chip" data-a="start" data-day="${d}" style="--c:${DAYS[d].color}">${DAYS[d].name}${PROG().bonus.includes(d) ? ' ★' : ''}</button>`).join('')}</div>
    </div>`;
  }
  const multi = REG.list.length > 1;
  return `${multi ? `<button class="who" data-a="whoSheet">👤 ${esc(activeProfile().name)} <span>▾</span></button>` : ''}<header class="hero">
      <div class="mascot">${brickSVG(moodFor(mood), 132)}</div>
      <div class="bubble">${esc(homeQuote)}</div>
    </header>
    ${main}
    <div class="card">
      <div class="row between"><b>This week</b><span class="muted small">${wk.length} brick${wk.length === 1 ? '' : 's'} · goal ${PROG().goal}</span></div>
      <div class="week">${weekBricks}</div>
      <div class="muted small">${last ? `Last workout: ${DAYS[last.day].name}, ${agoText(last.date)}.` : (S.prof.kind === 'happy' ? 'No bricks yet. Your first one is waiting!' : 'No bricks yet. The first one is the hardest.')} ${wk.length >= PROG().goal ? (S.prof.kind === 'happy' ? 'Goal reached! Yay!' : 'Goal hit. Anything more is a bonus.') : ''}</div>
    </div>
    ${S.prof.back ? `<button class="card back-card" data-a="tab" data-v="back">
      <div class="row between"><b>🌙 Evening back routine</b><span class="pill ${backDone ? 'ok' : ''}">${backDone ? 'Done today' : '6 min'}</span></div>
      <div class="muted small">Gentle, before sleep. ${S.back.length ? `${S.back.length} nights so far.` : 'Tap to see it.'}</div>
    </button>` : ''}`;
}

/* ---------- workout ---------- */
function startWorkout(day) {
  if (S.cur) { view = 'workout'; render(); return; }
  S.cur = {
    id: 's' + Date.now().toString(36), day, start: Date.now(),
    ex: planFor(day).map(k => newExEntry(k)),
  };
  save(); view = 'workout'; window.scrollTo(0, 0); render();
  toast(pick(QS().start));
}
function newExEntry(k) {
  const sg = suggest(k);
  return { k, sets: sg.sets.map(x => ({ kg: x.kg, reps: '', t: x.reps, tk: x.kg, done: false })), skip: false };
}
function exCard(e, i) {
  const ex = EX[e.k], L = lastPerf(e.k), sg = suggest(e.k, e.sets.length);
  const allDone = e.sets.length && e.sets.every(x => x.done);
  const bw = ex.eq === 'bw';
  const lastTxt = L ? `<div class="last"><span class="lbl">Last · ${fmtDate(L.date)}</span> ${L.sets.map(x => bw ? `${x.reps}` : `${kgTxt(x.kg)}×${x.reps}`).join(' · ')}${bw ? ' reps' : ''} <span class="muted small">· ${agoText(L.date)}</span></div>`
    : `<div class="last"><span class="lbl">Last</span> nothing yet</div>`;
  const tgt = sg.sets;
  const tgtTxt = bw ? `${tgt.map(x => x.reps).join(' · ')} reps` : `${tgt[0].kg === '' ? 'your pick' : kgTxt(tgt[0].kg) + ' kg'} × ${tgt.map(x => x.reps).join(' · ')}`;
  const rows = e.sets.map((x, j) => `
    <div class="set ${x.done ? 'done' : ''}">
      <div class="sn">${j + 1}</div>
      ${bw ? '<div class="kgw bwlbl">bodyweight</div>' : `<div class="kgw">
        <div class="stepper">
          <button class="st" data-a="kgStep" data-i="${i}" data-j="${j}" data-d="-1" aria-label="lighter">−</button>
          <input class="inp kg" inputmode="decimal" data-in="kg" data-i="${i}" data-j="${j}" value="${x.kg === '' ? '' : +x.kg}" placeholder="kg">
          <button class="st" data-a="kgStep" data-i="${i}" data-j="${j}" data-d="1" aria-label="heavier">+</button>
        </div>
        <div class="how" id="how-${i}-${j}">${esc(loadHow(ex.eq, x.kg))}</div></div>`}
      <input class="inp reps" inputmode="numeric" data-in="reps" data-i="${i}" data-j="${j}" value="${esc(x.reps)}" placeholder="${x.t || ''}">
      <button class="tick" data-a="tick" data-i="${i}" data-j="${j}" aria-label="log set">${x.done ? '✓' : ''}</button>
    </div>`).join('');
  const st = stallInfo(e.k);
  const stall = st ? `<div class="stall small"><b>🧱 Stuck for 3 sessions.</b> Normal on a cut. If you want to shake it up, pick one: <ul>${st.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>` : '';
  return `<section class="card ex ${allDone ? 'complete' : ''} ${e.skip ? 'skipped' : ''}" id="ex-${i}">
    <div class="ex-head">
      <div><div class="ex-name">${esc(ex.name)}</div>
      <div class="tags"><span class="tag">${MG[ex.mg]}</span><span class="tag">${EQUIP[ex.eq].label}</span><span class="tag">${ex.min}–${ex.max} reps</span></div></div>
      <button class="icon" data-a="exMenu" data-i="${i}" aria-label="options">⋯</button>
    </div>
    ${e.skip ? `<div class="muted small">Skipped today. <button class="link" data-a="unskip" data-i="${i}">Undo</button></div>` : `
    ${lastTxt}
    <div class="target kind-${sg.kind}"><div><span class="lbl">Today</span> <b>${tgtTxt}</b></div><div class="small">${esc(sg.note)}</div></div>
    ${stall}
    ${ex.tip ? `<div class="tip small">💡 ${esc(ex.tip)}</div>` : ''}
    <div class="sets">${rows}</div>
    <div class="row gap"><button class="link" data-a="addSet" data-i="${i}">+ Add set</button>${e.sets.length > 1 ? `<button class="link muted" data-a="delSet" data-i="${i}">− Remove set</button>` : ''}${L ? `<button class="link muted push-r" data-a="hist" data-k="${e.k}">📈 Progress</button>` : ''}</div>`}
  </section>`;
}
function vWorkout() {
  const C = DAYS[S.cur.day];
  const total = S.cur.ex.filter(e => !e.skip).length, fin = S.cur.ex.filter(e => !e.skip && e.sets.length && e.sets.every(x => x.done)).length;
  return `<div class="wbar" style="--c:${C.color}">
      <button class="icon light" data-a="goHome" aria-label="home">⌂</button>
      <div class="wt"><div class="wname">${C.name}</div><div class="small"><span id="wclock">${fmtDur((Date.now() - S.cur.start) / 1000)}</span> · ${fin}/${total} done</div></div>
      <button class="btn sm light" data-a="finish">Finish</button>
    </div>
    <div class="overview">${S.cur.ex.map((e, i) => { const d = e.sets.length && e.sets.every(x => x.done); return `<button class="ov ${d ? 'd' : ''} ${e.skip ? 's' : ''}" data-a="jump" data-i="${i}">${d ? '✓ ' : ''}${esc(EX[e.k].name)}</button>`; }).join('')}</div>
    ${S.cur.ex.map(exCard).join('')}
    <button class="btn big" data-a="finish">Finish workout</button>
    <button class="link center-block muted" data-a="discard">Discard this workout</button>`;
}

function finishWorkout() {
  const c = S.cur;
  const ex = c.ex.filter(e => !e.skip && doneSets(e).length).map(e => ({ k: e.k, sets: doneSets(e).map(x => ({ kg: EX[e.k].eq === 'bw' ? 0 : +x.kg || 0, reps: +x.reps || 0, t: +x.t || null, tk: x.tk === '' || x.tk == null ? null : +x.tk, done: true })) }));
  // personal bests, measured against everything before this session
  const prs = [];
  ex.forEach(e => {
    const X = EX[e.k];
    if (X.eq === 'bw') { const b = bestReps(e.k), m = Math.max(...e.sets.map(x => x.reps)); if (b && m > b) prs.push(`${X.name}: ${m} reps`); }
    else { const b = bestE1(e.k); let best = null; e.sets.forEach(x => { const v = e1rm(x.kg, x.reps); if (!best || v > best.v) best = { v, x }; }); if (b && best && best.v > b + 0.01) prs.push(`${X.name}: ${best.x.kg} kg × ${best.x.reps}`); }
  });
  const session = { id: c.id, day: c.day, date: new Date(c.start).toISOString(), dur: Math.round((Date.now() - c.start) / 1000), ex };
  S.log.push(session); S.cur = null; restEnd = 0;
  save();
  const sets = ex.reduce((a, e) => a + e.sets.length, 0), vol = ex.reduce((a, e) => a + e.sets.reduce((b, x) => b + x.kg * x.reps, 0), 0);
  doneInfo = { session, prs, sets, vol, quote: pick(QS().done) };
  homeQuote = '';
  view = 'done'; window.scrollTo(0, 0); render();
}
function vDone() {
  const d = doneInfo; if (!d) { view = 'home'; return vHome(); }
  const n = S.log.length;
  return `<div class="done-wrap">
    <div class="mascot bounce">${brickSVG(moodFor('flex'), 150)}</div>
    <h1>Brick #${n}</h1>
    <p class="muted">${DAYS[d.session.day].name} · ${fmtDur(d.session.dur)} · ${d.sets} sets · ${Math.round(d.vol).toLocaleString('en-GB')} kg moved</p>
    ${d.prs.length ? `<div class="card prs"><b>🏆 New bests</b>${d.prs.map(p => `<div>${esc(p)}</div>`).join('')}</div>` : ''}
    <div class="card wall-card">${wallSVG(S.log, { newest: true, minRows: 3 })}</div>
    <p class="quote">“${esc(d.quote)}”</p>
    <button class="btn big" data-a="goHomeDone">Back home</button>
  </div>`;
}

/* ---------- rest timer ---------- */
function startRest() { restDur = S.set.rest; restEnd = Date.now() + restDur * 1000; renderRest(); }
function renderRest() {
  const el = $('#rest');
  if (!restEnd || view !== 'workout') { el.hidden = true; return; }
  const left = Math.ceil((restEnd - Date.now()) / 1000);
  if (left <= 0) {
    restEnd = 0; el.hidden = true;
    try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { }
    beep(); toast('Rest over. Next set.');
    return;
  }
  el.hidden = false;
  el.innerHTML = `<div class="rest-bar" style="width:${Math.max(0, 100 * left / restDur)}%"></div>
    <span class="rest-t">Rest <b>${fmtDur(left)}</b></span>
    <button class="chip" data-a="restAdd">+30 s</button><button class="chip" data-a="restSkip">Skip</button>`;
}
let actx = null;
function beep() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.frequency.value = 880; o.connect(g); g.connect(actx.destination);
    g.gain.setValueAtTime(0.15, actx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.4);
    o.start(); o.stop(actx.currentTime + 0.4);
  } catch (e) { }
}

/* ---------- wall ---------- */
function vWall() {
  const n = S.log.length, now = new Date();
  const month = S.log.filter(s => { const d = new Date(s.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length;
  const weeks = {}; S.log.forEach(s => { const k = weekStart(new Date(s.date)).getTime(); weeks[k] = (weeks[k] || 0) + 1; });
  const best = Math.max(0, ...Object.values(weeks));
  // weeks in a row (ending this or last week) with at least one workout
  let streak = 0; { let w = weekStart(); if (!weeks[w.getTime()]) w.setDate(w.getDate() - 7); while (weeks[w.getTime()]) { streak++; w.setDate(w.getDate() - 7); } }
  return `<h1 class="title">The Wall</h1>
    <p class="muted">One brick per workout. Nobody sees the bricks. Everybody sees the wall.</p>
    <div class="stats">
      <div class="stat"><b>${n}</b><span>bricks</span></div>
      <div class="stat"><b>${month}</b><span>this month</span></div>
      <div class="stat"><b>${streak}</b><span>weeks in a row</span></div>
      <div class="stat"><b>${best}</b><span>best week</span></div>
    </div>
    <div class="card wall-card">${n ? wallSVG(S.log, { minRows: 4 }) : `<div class="center muted" style="padding:20px 0">${brickSVG(moodFor('ready'), 100)}<p>Finish your first workout to lay brick #1.</p></div>`}</div>
    <div class="legend">${PROG().days.map(d => `<span><i style="background:${DAYS[d].color}"></i>${DAYS[d].name}</span>`).join('')}</div>
    ${n ? `<p class="muted small center">Tap a brick to see that workout.</p>` : ''}
    <h2 class="sub">Recent</h2>
    ${S.log.slice(-8).reverse().map(s => `<button class="card row between hist" data-a="openSession" data-id="${s.id}"><span><b style="color:${DAYS[s.day].color}">${DAYS[s.day].name}</b> · ${fmtDate(s.date)}</span><span class="muted small">${s.ex.reduce((a, e) => a + e.sets.length, 0)} sets · ${fmtDur(s.dur)}</span></button>`).join('') || '<p class="muted small">Nothing yet.</p>'}`;
}
function sheetSession(id) {
  const s = S.log.find(x => x.id === id); if (!s) return;
  openSheet(`<div class="sh-head"><b>${DAYS[s.day].name} · ${new Date(s.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</b><button class="icon" data-a="closeSheet">✕</button></div>
    <p class="muted small">Brick #${S.log.indexOf(s) + 1} · ${fmtDur(s.dur)}</p>
    ${s.ex.map(e => `<div class="hrow"><b>${esc(EX[e.k].name)}</b><div class="muted small">${e.sets.map(x => EX[e.k].eq === 'bw' ? x.reps : `${x.kg}×${x.reps}`).join(' · ')}</div></div>`).join('')}
    <button class="link muted center-block" data-a="delSession" data-id="${s.id}">Delete this workout</button>`);
}
function sheetHistory(k) {
  const rows = [];
  for (let i = S.log.length - 1; i >= 0 && rows.length < 10; i--) {
    const e = S.log[i].ex.find(e => e.k === k);
    if (e && e.sets.length) rows.push(`<div class="hrow"><b>${fmtDate(S.log[i].date)}</b> <span class="muted small">${agoText(S.log[i].date)}</span><div class="small">${e.sets.map(x => EX[k].eq === 'bw' ? x.reps : `${x.kg}×${x.reps}`).join(' · ')}</div></div>`);
  }
  openSheet(`<div class="sh-head"><b>${esc(EX[k].name)}</b><button class="icon" data-a="closeSheet">✕</button></div>${progressChart(k)}<h3 class="sub">Recent sessions</h3>${rows.join('') || '<p class="muted">No history yet.</p>'}`);
}
const setTxt = (k, x) => isBw(k) ? `${x.reps} reps` : `${+x.kg} kg × ${x.reps}`;
/* One line: estimated 1-rep max per session (bodyweight: most reps in a set). Tap a point for that session. */
function progressChart(k) {
  const h = perfHistory(k).slice(-30), bw = isBw(k);
  const label = bw ? 'Best set (reps)' : 'Estimated max (kg)';
  if (h.length < 2) return `<div class="chart-card"><div class="chart-t">${label}</div><p class="muted small">The chart appears after your second session of this exercise.</p></div>`;
  const W = 340, H = 170, L = 34, R = 14, T = 22, B = 24;
  const t0 = new Date(h[0].date).getTime(), t1 = new Date(h[h.length - 1].date).getTime();
  const vals = h.map(p => p.score), lo0 = Math.min(...vals), hi0 = Math.max(...vals), pad = Math.max(1, (hi0 - lo0) * 0.15);
  const lo = Math.max(0, Math.floor(lo0 - pad)), hi = Math.ceil(hi0 + pad);
  const x = p => L + (t1 === t0 ? (W - L - R) / 2 : (new Date(p.date).getTime() - t0) / (t1 - t0) * (W - L - R));
  const y = v => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B);
  const fmtV = v => bw ? String(Math.round(v)) : String(Math.round(v));
  const ticks = [lo, (lo + hi) / 2, hi].map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#efe2d4" stroke-width="1"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" class="ct">${fmtV(v)}</text>`).join('');
  const bestI = vals.indexOf(hi0), lastI = h.length - 1;
  const path = h.map((p, i) => `${i ? 'L' : 'M'}${x(p).toFixed(1)} ${y(p.score).toFixed(1)}`).join(' ');
  const dots = h.map((p, i) => `<circle cx="${x(p)}" cy="${y(p.score)}" r="${i === bestI ? 5.5 : 4}" fill="${i === bestI ? '#e8a33d' : '#d9583b'}" stroke="#fff" stroke-width="2"/>`).join('');
  const hits = h.map((p, i) => `<circle cx="${x(p)}" cy="${y(p.score)}" r="16" fill="transparent" data-a="chartPt" data-k="${k}" data-i="${i}"/>`).join('');
  const lab = (i, txt) => { const p = h[i], px = x(p), anchor = px > W - 70 ? 'end' : px < L + 40 ? 'start' : 'middle'; return `<text x="${px}" y="${y(p.score) - 10}" text-anchor="${anchor}" class="cl">${txt}</text>`; };
  const labels = lab(bestI, 'best ' + fmtV(hi0)) + (lastI !== bestI ? lab(lastI, 'now ' + fmtV(vals[lastI])) : '');
  const dates = `<text x="${L}" y="${H - 6}" class="ct">${fmtDate(h[0].date)}</text><text x="${W - R}" y="${H - 6}" text-anchor="end" class="ct">${fmtDate(h[lastI].date)}</text>`;
  const first = vals[0], change = vals[lastI] - first;
  return `<div class="chart-card"><div class="row between"><div class="chart-t">${label}</div><div class="small ${change >= 0 ? 'up-t' : 'muted'}">${change >= 0 ? '+' : ''}${Math.round(change)}${bw ? '' : ' kg'} since ${fmtDate(h[0].date)}</div></div>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label} over time">${ticks}<path d="${path}" fill="none" stroke="#d9583b" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${dots}${labels}${dates}${hits}</svg>
    <div class="chart-tip small" id="chart-tip">${ptTxt(k, h[lastI])}</div>
    ${bw ? '' : '<p class="muted small">Estimated max = what your best set suggests you could lift once. It rises with more weight or more reps.</p>'}</div>`;
}
const ptTxt = (k, p) => `<b>${fmtDate(p.date)}</b> · best set ${setTxt(k, p.best)}${isBw(k) ? '' : ` · est. max ${Math.round(p.score)} kg`} · ${p.sets.length} sets`;

/* ---------- back routine ---------- */
function vBack() {
  const total = BACK.reduce((a, b) => a + b.secs, 0);
  const last14 = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 13 + i); const k = dayStr(d); return `<i class="${S.back.includes(k) ? 'on' : ''}" title="${k}"></i>`; }).join('');
  return `<h1 class="title">Back routine</h1>
    <p class="muted">${Math.round(total / 60)} minutes, in the evening before sleep. Slow and gentle. ${esc(pick(QS().back))}</p>
    <div class="card warn-card small"><b>Stop rule:</b> if pain or tingling travels <b>down your leg</b>, stop that move. Pain that moves back toward the spine is usually fine. No hamstring stretching or toe touches. This is not medical advice; when you get the MRI result, ask what to add or remove.</div>
    <div class="card"><div class="row between"><b>Last 14 nights</b><span class="muted small">${S.back.includes(todayStr()) ? 'done tonight ✓' : ''}</span></div><div class="nights">${last14}</div></div>
    <div class="card">${BACK.map((b, i) => `<div class="bmove"><div class="bnum">${i + 1}</div><div class="grow"><b>${esc(b.name)}</b> <span class="muted small">${b.secs} s</span><div class="small muted">${esc(b.how)}</div>${posesHTML(b)}</div></div>`).join('')}</div>
    <button class="btn big" data-a="backStart">Start routine</button>
    ${S.back.includes(todayStr()) ? '' : '<button class="link center-block muted" data-a="backMark">Did it without the timer? Mark tonight as done</button>'}`;
}
function vBackRun() {
  const r = backRun, b = BACK[r.i], left = r.paused ? r.left : Math.max(0, Math.ceil((r.end - Date.now()) / 1000));
  const pct = 1 - left / b.secs, C = 2 * Math.PI * 70;
  return `<div class="brun">
    <div class="row between"><span class="muted small">${r.i + 1} / ${BACK.length}</span><button class="icon" data-a="backStop" aria-label="stop">✕</button></div>
    <h1>${esc(b.name)}</h1>
    ${posesHTML(b, true)}
    <p class="how-big">${esc(b.how)}</p>
    <svg class="ring" viewBox="0 0 160 160"><circle cx="80" cy="80" r="70" fill="none" stroke="#efdfcf" stroke-width="10"/>
      <circle id="ring" cx="80" cy="80" r="70" fill="none" stroke="#d9583b" stroke-width="10" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}" transform="rotate(-90 80 80)"/>
      <text id="ringt" x="80" y="92" text-anchor="middle" font-size="36" font-weight="800" fill="#2b1a14">${left}</text></svg>
    <div class="row gap center-row"><button class="btn ghost" data-a="backPause">${r.paused ? 'Resume' : 'Pause'}</button><button class="btn ghost" data-a="backNext">${r.i === BACK.length - 1 ? 'Finish' : 'Next'}</button></div>
    <p class="muted small center">${r.i < BACK.length - 1 ? 'Next: ' + esc(BACK[r.i + 1].name) : 'Last one.'}</p>
    <p class="muted small center">Stop if it travels down your leg.</p>
  </div>`;
}
function backGo(i) {
  if (i >= BACK.length) {
    if (!S.back.includes(todayStr())) S.back.push(todayStr());
    save(); backRun = null; view = 'back'; render(); toast('Back routine done. Sleep well.'); return;
  }
  backRun = { i, end: Date.now() + BACK[i].secs * 1000, paused: false, left: BACK[i].secs };
  view = 'backrun'; render();
}

/* ---------- me / settings ---------- */
function vMe() {
  const c = S.cloud;
  const cloud = !c.on ? `<div class="card"><b>☁️ Automatic backup</b>
      <p class="muted small">Saves a copy online after every change, so nothing is lost if the phone breaks. You get a recovery code to bring it back.</p>
      <button class="btn sm" data-a="cloudOn">Turn on automatic backup</button>
      <label class="f"><span>Restore from a recovery code</span><input class="inp" id="cl-code" autocapitalize="characters" autocomplete="off" placeholder="XXXX-XXXX-XXXX-XXXX"></label>
      <button class="btn ghost sm" data-a="cloudRestore">Restore</button></div>`
    : `<div class="card"><b>☁️ Automatic backup is on</b>
      <p class="small">${c.err ? `<span class="warn-t">${esc(c.err)}</span>` : c.last ? 'Last saved ' + agoText(new Date(c.last).toISOString()) + '.' : 'Saving the first copy…'}</p>
      <div class="code">${esc(fmtKey(c.key))}</div>
      <p class="muted small center">Your recovery code. Keep it somewhere outside this phone.</p>
      <div class="row gap"><button class="btn ghost sm" data-a="copyCode">Copy code</button><button class="btn ghost sm" data-a="cloudNow">Save now</button><button class="link muted" data-a="cloudOff">Turn off</button></div></div>`;
  const swapped = Object.keys(S.plan).length, P = PROG(), me = activeProfile();
  const people = `<div class="card"><b>👥 People on this phone</b>
      <p class="muted small">Each person has their own workouts, wall, settings and backup.</p>
      <div class="people">${REG.list.map(p => `<button class="chip ${p.id === REG.active ? 'sel' : ''}" data-a="pickWho" data-id="${p.id}">${esc(p.name)}</button>`).join('')}
      <button class="chip" data-a="addPerson">+ Add person</button></div></div>
    <div class="card"><b>This person</b>
      <label class="f"><span>Name</span><input class="inp" data-prof="name" maxlength="20" value="${esc(me.name)}"></label>
      <label class="f"><span>Program and style</span>
        <select class="inp" data-prof="kind">${Object.keys(PROGRAMS).map(k => `<option value="${k}" ${S.prof.kind === k ? 'selected' : ''}>${esc(PROGRAMS[k].label)}</option>`).join('')}</select></label>
      <label class="f"><span>Evening back routine</span>
        <select class="inp" data-prof="back"><option value="1" ${S.prof.back ? 'selected' : ''}>Show it</option><option value="0" ${S.prof.back ? '' : 'selected'}>Hide it</option></select></label>
      ${REG.list.length > 1 ? `<button class="link muted" data-a="delPerson">Remove ${esc(me.name)} from this phone</button>` : ''}
    </div>`;
  return `<h1 class="title">Me</h1>
    ${people}
    <div class="card">
      <label class="f"><span>Rest timer after each set</span>
        <select class="inp" data-set="rest">${[60, 90, 120, 150, 180].map(v => `<option value="${v}" ${S.set.rest === v ? 'selected' : ''}>${fmtDur(v)}</option>`).join('')}</select></label>
      <label class="f"><span>Most plates that fit on one dumbbell end</span>
        <select class="inp" data-set="dbEnd">${[2, 3, 4, 5, 6].map(v => `<option value="${v}" ${S.set.dbEnd === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <p class="muted small">Weights are only suggested if you can build them: machine 20–50 kg in 5 kg steps, barbell 10 kg, EZ bar 8 kg, dumbbell handles 2 kg with equal plates on both ends.</p>
    </div>
    ${cloud}
    <div class="card"><b>Backup file</b>
      <p class="muted small">Download everything as a file, or load one back in.</p>
      <div class="row gap"><button class="btn ghost sm" data-a="export">Download backup</button><button class="btn ghost sm" data-a="import">Load backup</button></div>
      <input type="file" id="imp" accept="application/json,.json" hidden></div>
    <div class="card"><b>Plan</b>
      <p class="muted small">${swapped ? 'You swapped some exercises for good. ' : ''}Rotation: ${P.rotation.map(d => DAYS[d].name).join(' → ')}.${P.bonus.length ? ` ${P.bonus.map(d => DAYS[d].name).join(', ')} is a bonus day that does not move the rotation.` : ''} Goal: ${P.goal} a week.</p>
      ${swapped ? '<button class="btn ghost sm" data-a="resetPlan">Reset plan to default</button>' : ''}</div>
    <p class="muted small center">Brick ${VERSION} · ${S.log.length} workouts saved on this phone</p>`;
}

function personForm() {
  openSheet(`<div class="sh-head"><b>Add a person</b><button class="icon" data-a="closeSheet">✕</button></div>
    <label class="f"><span>Name</span><input class="inp" id="np-name" maxlength="20" placeholder="Name"></label>
    <label class="f"><span>Program and style</span>
      <select class="inp" id="np-kind">${Object.keys(PROGRAMS).map(k => `<option value="${k}" ${k === 'happy' ? 'selected' : ''}>${esc(PROGRAMS[k].label)}</option>`).join('')}</select></label>
    <p class="muted small">You can change the program, swap exercises and turn the back routine on or off later in Me.</p>
    <button class="btn" data-a="addPersonGo">Add and switch to them</button>`);
}
function whoSheet() {
  openSheet(`<div class="sh-head"><b>Who is training?</b><button class="icon" data-a="closeSheet">✕</button></div>
    ${REG.list.map(p => `<button class="btn ${p.id === REG.active ? '' : 'ghost'}" data-a="pickWho" data-id="${p.id}">${esc(p.name)}</button>`).join('')}
    <button class="link center-block" data-a="addPerson">+ Add person</button>`);
}

/* ---------- actions ---------- */
const A = {
  whoSheet: () => whoSheet(),
  pickWho: el => { closeSheet(); if (el.dataset.id !== REG.active) { switchTo(el.dataset.id); toast(`Hi ${activeProfile().name}!`); } },
  addPerson: () => personForm(),
  addPersonGo: () => {
    const name = ($('#np-name').value || '').trim() || 'Person ' + (REG.list.length + 1), kind = $('#np-kind').value;
    const id = 'p' + Date.now().toString(36);
    const fresh = normalize({ prof: { kind, back: kind !== 'happy' } });
    try { localStorage.setItem(keyFor(id), JSON.stringify(fresh)); } catch (e) { }
    REG.list.push({ id, name }); regSave(); closeSheet(); switchTo(id); toast(`Hi ${name}!`);
  },
  delPerson: () => {
    const me = activeProfile();
    if (!confirm(`Remove ${me.name} and all their workouts from this phone? Their cloud backup (if on) stays online. This cannot be undone on this phone.`)) return;
    try { localStorage.removeItem(keyFor(me.id)); } catch (e) { }
    REG.list = REG.list.filter(p => p.id !== me.id); S = null; switchTo(REG.list[0].id);
  },
  tab: el => { view = el.dataset.v; homeQuote = view === 'home' ? '' : homeQuote; window.scrollTo(0, 0); render(); },
  start: el => {
    const day = el.dataset.day;
    if (S.cur) { view = 'workout'; render(); return; }
    startWorkout(day);
  },
  goWorkout: () => { view = 'workout'; render(); },
  goHome: () => { view = 'home'; render(); },
  goHomeDone: () => { doneInfo = null; view = 'home'; window.scrollTo(0, 0); render(); },
  jump: el => { const t = document.getElementById('ex-' + el.dataset.i); if (t) window.scrollTo({ top: t.offsetTop - 70, behavior: 'smooth' }); },
  kgStep: el => {
    const i = +el.dataset.i, j = +el.dataset.j, e = S.cur.ex[i], X = EX[e.k];
    const nv = stepLoad(X.eq, e.sets[j].kg === '' ? '' : +e.sets[j].kg, +el.dataset.d);
    if (nv == null) { toast(+el.dataset.d > 0 ? 'That is the heaviest you can load.' : 'That is the lightest.'); return; }
    e.sets.forEach((x, jj) => { if (jj >= j && !x.done) x.kg = nv; });
    save(); rerenderEx(i);
  },
  tick: el => {
    const i = +el.dataset.i, j = +el.dataset.j, e = S.cur.ex[i], x = e.sets[j], X = EX[e.k];
    if (x.done) { x.done = false; save(); rerenderEx(i); return; }
    if (x.reps === '' && x.t) x.reps = String(x.t);
    if (!(+x.reps > 0)) { toast('Type the reps first.'); return; }
    if (X.eq !== 'bw' && !(+x.kg > 0)) { toast('Type the weight first.'); return; }
    x.done = true; save();
    const all = e.sets.every(s => s.done);
    if (!all) startRest(); else restEnd = 0;
    if (Math.random() < 0.35) toast(pick(QS().set));
    rerenderEx(i, true);
  },
  addSet: el => { const e = S.cur.ex[+el.dataset.i], l = e.sets[e.sets.length - 1] || { kg: '', t: EX[e.k].min }; e.sets.push({ kg: l.kg, reps: '', t: l.t, tk: l.kg, done: false }); save(); rerenderEx(+el.dataset.i); },
  delSet: el => { const e = S.cur.ex[+el.dataset.i]; if (e.sets.length > 1) e.sets.pop(); save(); rerenderEx(+el.dataset.i); },
  unskip: el => { S.cur.ex[+el.dataset.i].skip = false; save(); render(); },
  exMenu: el => {
    const i = +el.dataset.i, e = S.cur.ex[i], X = EX[e.k];
    const used = new Set(S.cur.ex.map(x => x.k));
    const opts = [...new Set([...X.alts, ...Object.keys(EX).filter(k => EX[k].mg === X.mg)])].filter(k => !used.has(k));
    openSheet(`<div class="sh-head"><b>${esc(X.name)}</b><button class="icon" data-a="closeSheet">✕</button></div>
      <button class="btn ghost" data-a="hist" data-k="${e.k}">See history</button>
      <button class="btn ghost" data-a="skip" data-i="${i}">Skip today</button>
      ${opts.length ? `<h3 class="sub">Swap for</h3>${opts.map(k => `<div class="swap"><div class="grow"><b>${esc(EX[k].name)}</b><div class="muted small">${EQUIP[EX[k].eq].label}${EX[k].back ? ' · heavy on the lower back' : ''}</div></div>
        <button class="chip" data-a="swap" data-i="${i}" data-k="${k}">Today</button><button class="chip" data-a="swap" data-i="${i}" data-k="${k}" data-keep="1">For good</button></div>`).join('')}` : ''}`);
  },
  hist: el => sheetHistory(el.dataset.k),
  chartPt: el => { const k = el.dataset.k, p = perfHistory(k).slice(-30)[+el.dataset.i], t = $('#chart-tip'); if (p && t) t.innerHTML = ptTxt(k, p); },
  skip: el => { const e = S.cur.ex[+el.dataset.i]; e.skip = true; closeSheet(); save(); render(); },
  swap: el => {
    const i = +el.dataset.i, k = el.dataset.k, old = S.cur.ex[i].k;
    if (S.cur.ex[i].sets.some(x => x.done) && !confirm('You already logged sets on this exercise. Swap anyway?')) return;
    S.cur.ex[i] = newExEntry(k);
    if (el.dataset.keep) { const p = planFor(S.cur.day).slice(); const j = p.indexOf(old); if (j >= 0) p[j] = k; S.plan[S.cur.day] = p; }
    closeSheet(); save(); render(); toast(el.dataset.keep ? 'Swapped for good.' : 'Swapped for today.');
  },
  finish: () => {
    const any = S.cur.ex.some(e => doneSets(e).length);
    if (!any) { if (confirm('Nothing logged yet. Discard this workout?')) A.discard(null, true); return; }
    const open = S.cur.ex.filter(e => !e.skip && e.sets.some(x => !x.done)).length;
    if (open && !confirm(`${open} exercise${open > 1 ? 's are' : ' is'} not finished. Finish the workout anyway?`)) return;
    finishWorkout();
  },
  discard: (el, sure) => { if (!sure && !confirm('Discard this workout? Logged sets are lost.')) return; S.cur = null; restEnd = 0; save(); view = 'home'; render(); },
  restAdd: () => { restEnd += 30000; restDur += 30; renderRest(); },
  restSkip: () => { restEnd = 0; renderRest(); },
  openSession: el => sheetSession(el.dataset.id || el.closest('[data-id]').dataset.id),
  delSession: el => { if (!confirm('Delete this workout from the wall? This cannot be undone.')) return; S.log = S.log.filter(s => s.id !== el.dataset.id); save(); closeSheet(); render(); },
  closeSheet: () => closeSheet(),
  backStart: () => backGo(0),
  backNext: () => backGo(backRun.i + 1),
  backPause: () => { const r = backRun; if (r.paused) { r.end = Date.now() + r.left * 1000; r.paused = false; } else { r.left = Math.max(0, Math.ceil((r.end - Date.now()) / 1000)); r.paused = true; } render(); },
  backStop: () => { backRun = null; view = 'back'; render(); },
  backMark: () => { if (!S.back.includes(todayStr())) S.back.push(todayStr()); save(); render(); toast('Marked. Sleep well.'); },
  cloudOn: () => { S.cloud = { on: true, key: newKey(), last: 0, err: '' }; save(); render(); cloudUp(true).then(render); },
  cloudOff: () => { if (!confirm('Turn off automatic backup? The copy online stays, and you can still restore it with the code.')) return; S.cloud.on = false; save(); render(); },
  cloudNow: () => { cloudUp(true).then(() => { render(); toast(S.cloud.err ? 'Backup failed.' : 'Saved.'); }); },
  copyCode: () => { navigator.clipboard && navigator.clipboard.writeText(fmtKey(S.cloud.key)).then(() => toast('Code copied.'), () => toast('Could not copy. Write it down.')); },
  cloudRestore: async () => {
    const code = ($('#cl-code') || {}).value;
    try {
      const { data, key } = await cloudRestore(code);
      if (!confirm(`Found a backup with ${(data.log || []).length} workouts. Replace what is on this phone with it?`)) return;
      const fb = S.fb; S = normalize(data); S.fb = fb; S.cloud = { on: true, key, last: Date.now(), err: '' };
      save(); view = 'home'; render(); toast('Restored. Welcome back.');
    } catch (e) { toast(e.message || 'Restore failed.'); }
  },
  export: () => {
    const blob = new Blob([JSON.stringify(Object.assign({}, S, { fb: {} }), null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `brick-backup-${activeProfile().name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${todayStr()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
  import: () => $('#imp').click(),
  resetPlan: () => { if (!confirm('Put every day back to the default exercises?')) return; S.plan = {}; save(); render(); },
};

function rerenderEx(i, scrollNext) {
  const el = document.getElementById('ex-' + i); if (!el) return render();
  const y = window.scrollY;
  render(); window.scrollTo(0, y);
  if (scrollNext) {
    const e = S.cur.ex[i];
    if (e.sets.every(x => x.done)) {
      const next = document.getElementById('ex-' + (i + 1));
      if (next) setTimeout(() => window.scrollTo({ top: next.offsetTop - 70, behavior: 'smooth' }), 350);
    }
  }
}

/* ---------- events ---------- */
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-a]');
  if (!el) { if (ev.target.id === 'sheet') closeSheet(); return; }
  const fn = A[el.dataset.a];
  if (fn) { ev.preventDefault(); fn(el); }
});
document.addEventListener('input', ev => {
  const el = ev.target;
  if (el.dataset.in && S.cur) {
    const i = +el.dataset.i, j = +el.dataset.j, x = S.cur.ex[i].sets[j];
    const v = el.value.replace(',', '.').replace(/[^0-9.]/g, '');
    if (el.dataset.in === 'kg') {
      x.kg = v === '' ? '' : v;
      const h = document.getElementById(`how-${i}-${j}`); if (h) h.textContent = loadHow(EX[S.cur.ex[i].k].eq, v === '' ? '' : +v);
    } else x.reps = v.replace('.', '');
    saveLocal();
  }
});
document.addEventListener('change', ev => {
  const el = ev.target;
  if (el.dataset.in && S.cur) { save(); return; }
  if (el.dataset.set) { S.set[el.dataset.set] = +el.value; save(); render(); toast('Saved.'); return; }
  if (el.dataset.prof === 'name') { activeProfile().name = el.value.trim().slice(0, 20) || activeProfile().name; regSave(); render(); toast('Saved.'); return; }
  if (el.dataset.prof === 'kind') { S.prof.kind = el.value; if (S.cur && !PROG().days.includes(S.cur.day)) { /* keep the running workout */ } homeQuote = ''; save(); render(); toast('Program changed. Your wall and history stay.'); return; }
  if (el.dataset.prof === 'back') { S.prof.back = el.value === '1'; save(); render(); toast('Saved.'); return; }
  if (el.id === 'imp' && el.files[0]) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (!data || !Array.isArray(data.log)) throw new Error();
        if (!confirm(`This file has ${data.log.length} workouts. Replace what is on this phone with it?`)) return;
        const keep = { fb: S.fb, cloud: S.cloud }; S = normalize(data); Object.assign(S, keep);
        save(); view = 'home'; render(); toast('Backup loaded.');
      } catch (e) { toast('That file is not a Brick backup.'); }
    };
    r.readAsText(el.files[0]);
  }
});
document.addEventListener('focusin', ev => { if (ev.target.matches('.inp.kg, .inp.reps')) setTimeout(() => ev.target.select && ev.target.select(), 0); });

function loop() {
  if (view === 'workout' && S.cur) { const c = $('#wclock'); if (c) c.textContent = fmtDur((Date.now() - S.cur.start) / 1000); }
  if (restEnd) renderRest();
  if (view === 'backrun' && backRun && !backRun.paused) {
    const b = BACK[backRun.i], left = Math.max(0, Math.ceil((backRun.end - Date.now()) / 1000));
    const t = $('#ringt'), ring = $('#ring'), C = 2 * Math.PI * 70;
    if (t) t.textContent = left;
    if (ring) ring.setAttribute('stroke-dashoffset', C * (left / b.secs));
    if (left <= 0) { try { navigator.vibrate && navigator.vibrate(150); } catch (e) { } beep(); backGo(backRun.i + 1); }
  }
}

/* ---------- start ---------- */
load();
if (S.cur) view = 'workout';
render();
tick = setInterval(loop, 500);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { if (S.cloud.on) queueCloud(); loop(); } });
if (S.cloud.on) queueCloud();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
