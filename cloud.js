'use strict';
/* Automatic cloud backup, same approach as Spuddy: Firebase with plain web requests,
   an anonymous sign-in per phone, and one backup document named by a 16-character recovery code.
   Uses Spuddy's Firebase project (public web config, not a secret) and its own collection "brick_backups". */
const FB = { key: 'AIzaSyD6yh9yVqPmJwmvjNqoFScYtJFB5hZY84c', project: 'spuddy-9f790' };
const FS_URL = `https://firestore.googleapis.com/v1/projects/${FB.project}/databases/(default)/documents`;
const BK_COLL = 'brick_backups';
let idTok = null, idExp = 0, cloudT = null, cloudBusy = false, lastCloud = null;

async function callJson(url, opts) {
  const r = await fetch(url, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error((j.error && (j.error.message || j.error.status)) || String(r.status)), { status: r.status });
  return j;
}
async function fbToken() {
  if (idTok && Date.now() < idExp) return idTok;
  let j;
  if (S.fb.refresh) {
    j = await callJson(`https://securetoken.googleapis.com/v1/token?key=${FB.key}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(S.fb.refresh) });
    idTok = j.id_token; S.fb.refresh = j.refresh_token; S.fb.uid = j.user_id; idExp = Date.now() + (Number(j.expires_in) - 60) * 1000;
  } else {
    j = await callJson(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FB.key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) });
    idTok = j.idToken; S.fb.refresh = j.refreshToken; S.fb.uid = j.localId; idExp = Date.now() + (Number(j.expiresIn) - 60) * 1000;
  }
  saveLocal();
  return idTok;
}
async function fsCall(method, path, body) {
  const tok = await fbToken();
  return callJson(FS_URL + path, { method, headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
}

const fmtKey = k => String(k || '').replace(/(.{4})(?=.)/g, '$1-');
const b64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
async function pack(str) {
  if (typeof CompressionStream === 'undefined') return { z: 0, d: str };
  const buf = await new Response(new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  return { z: 1, d: b64(new Uint8Array(buf)) };
}
async function unpack(z, d) {
  if (!z) return d;
  if (typeof DecompressionStream === 'undefined') throw new Error('old-browser');
  const bytes = Uint8Array.from(atob(d), c => c.charCodeAt(0));
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}
function newKey() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, x => abc[x % abc.length]).join('');
}
function cloudError(e) {
  if (!navigator.onLine) return 'No internet right now. It will try again.';
  if (e && e.status === 403) return 'Firebase refused the backup. The database rule for Brick is not published yet.';
  if (e && e.status === 404) return 'No backup found for that code.';
  if (e && e.message === 'too-big') return 'The backup is too big to save automatically. Use the backup file below.';
  return 'Could not reach the backup right now. It will try again.';
}
const backupText = () => JSON.stringify(Object.assign({}, S, { fb: {}, cloud: { on: false, key: '', last: 0, err: '' } }));

async function cloudUp(force) {
  if (!S.cloud.on || !S.cloud.key || cloudBusy) return;
  const text = backupText();
  if (text === lastCloud && !force) return;
  cloudBusy = true;
  try {
    const p = await pack(text);
    if (p.d.length > 950000) throw new Error('too-big');
    await fbToken();
    await fsCall('PATCH', `/${BK_COLL}/${S.cloud.key}`, { fields: { uid: { stringValue: S.fb.uid }, z: { integerValue: String(p.z) }, d: { stringValue: p.d }, t: { integerValue: String(Date.now()) } } });
    lastCloud = text; S.cloud.last = Date.now(); S.cloud.err = '';
  } catch (e) { S.cloud.err = cloudError(e); }
  cloudBusy = false; saveLocal();
  if (view === 'me' && !sheetOpen()) render();
}
function queueCloud() {
  if (!S.cloud || !S.cloud.on) return;
  clearTimeout(cloudT); cloudT = setTimeout(cloudUp, 5000);
}
async function cloudRestore(code) {
  const key = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (key.length !== 16) throw new Error('The recovery code has 16 letters and numbers.');
  let j;
  try { j = await fsCall('GET', `/${BK_COLL}/${key}`); }
  catch (e) { throw new Error(cloudError(e)); }
  const f = j.fields || {};
  const text = await unpack(+(f.z && f.z.integerValue) || 0, f.d && f.d.stringValue);
  const data = JSON.parse(text);
  return { data, key };
}
