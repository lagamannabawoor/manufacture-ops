// ── File layout ──────────────────────────────────────────────────────────────
export const FILE_MAP = {
  'mfg_master.json':     ['factories','productCategories','products','materialTypes','laborGroups','bankAccounts','expenseCategories','users'],
  'mfg_production.json': ['productionEntries','pendingProduction'],
  'mfg_materials.json':  ['materialPurchases'],
  'mfg_finance.json':    ['laborPayments','orders','orderPayments','expenses'],
  'mfg_audit.json':      ['auditLog'],
};

// Reverse map: dataKey -> fileName
export const KEY_TO_FILE = {};
Object.entries(FILE_MAP).forEach(([file, keys]) => keys.forEach(k => { KEY_TO_FILE[k] = file; }));

const LEGACY_FILE = 'manufacture_ops_data.json';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

let tokenClient = null;

// Per-file ID cache (persisted in localStorage)
const fileIds = {};
const lastModTimes = {};
Object.keys(FILE_MAP).forEach(name => {
  fileIds[name] = localStorage.getItem(`mfg_fid_${name}`) || null;
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function loadScript(src) {
  return new Promise((resolve) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.async = true; s.defer = true;
    s.onload = resolve;
    document.head.appendChild(s);
  });
}

function token() { return window.gapi?.client?.getToken()?.access_token || null; }

async function searchFile(name) {
  const res = await window.gapi.client.drive.files.list({
    q: `name='${name}' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  });
  return res.result.files?.[0]?.id || null;
}

async function resolveFileId(name) {
  if (fileIds[name]) {
    try {
      await window.gapi.client.drive.files.get({ fileId: fileIds[name], fields: 'id' });
      return fileIds[name];
    } catch {
      fileIds[name] = null;
      localStorage.removeItem(`mfg_fid_${name}`);
    }
  }
  const id = await searchFile(name);
  if (id) { fileIds[name] = id; localStorage.setItem(`mfg_fid_${name}`, id); }
  return id || null;
}

async function readFile(name) {
  const id = await resolveFileId(name);
  if (!id) return null;
  try {
    const res = await window.gapi.client.drive.files.get({ fileId: id, alt: 'media' });
    return JSON.parse(res.body);
  } catch { return null; }
}

async function writeFile(name, partial) {
  const tk = token();
  if (!tk) throw new Error('Not signed in');
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify({ name, mimeType: 'application/json' })], { type: 'application/json' }));
  form.append('file', new Blob([JSON.stringify(partial)], { type: 'application/json' }));
  const id = fileIds[name];
  if (id) {
    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=multipart`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${tk}` }, body: form,
    });
  } else {
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST', headers: { Authorization: `Bearer ${tk}` }, body: form,
    });
    const json = await res.json();
    fileIds[name] = json.id;
    localStorage.setItem(`mfg_fid_${name}`, json.id);
  }
  try {
    const meta = await window.gapi.client.drive.files.get({ fileId: fileIds[name], fields: 'modifiedTime' });
    lastModTimes[name] = meta.result.modifiedTime;
    return meta.result.modifiedTime;
  } catch { return null; }
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function initGoogleAPIs(clientId) {
  if (!clientId) throw new Error('No client ID');
  await Promise.all([
    loadScript('https://apis.google.com/js/api.js'),
    loadScript('https://accounts.google.com/gsi/client'),
  ]);
  await new Promise((resolve, reject) => {
    window.gapi.load('client', async () => {
      try { await window.gapi.client.init({ discoveryDocs: [DISCOVERY_DOC] }); resolve(); }
      catch (e) { reject(e); }
    });
  });
  tokenClient = window.google.accounts.oauth2.initTokenClient({ client_id: clientId, scope: SCOPES, callback: () => {} });
}

export function requestSignIn(silent = false) {
  return new Promise((resolve) => {
    tokenClient.callback = (resp) => {
      if (resp.error && !silent) {
        tokenClient.callback = (resp2) => resolve(resp2.error ? null : resp2);
        tokenClient.requestAccessToken({ prompt: 'select_account' });
      } else { resolve(resp.error ? null : resp); }
    };
    tokenClient.requestAccessToken({ prompt: silent ? '' : 'select_account' });
  });
}

export function signOutDrive() {
  const tk = window.gapi?.client?.getToken();
  if (tk?.access_token) { window.google.accounts.oauth2.revoke(tk.access_token); window.gapi.client.setToken(''); }
  Object.keys(FILE_MAP).forEach(name => { fileIds[name] = null; localStorage.removeItem(`mfg_fid_${name}`); });
  // clear legacy key too
  localStorage.removeItem('mfg_drive_file_id');
}

export function isSignedIn() { return !!token(); }

export async function getUserInfo() {
  const tk = token();
  if (!tk) return null;
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${tk}` } });
    return await res.json();
  } catch { return null; }
}

/** Load all 5 files in parallel and merge into one data object.
 *  Falls back to legacy single-file and migrates automatically. */
export async function loadFromDrive() {
  const results = await Promise.allSettled(
    Object.keys(FILE_MAP).map(async name => ({ name, data: await readFile(name) }))
  );
  const merged = {};
  let anyFound = false;
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.data) {
      anyFound = true;
      Object.assign(merged, r.value.data);
    }
  }
  if (anyFound) return merged;

  // ── Legacy migration ──────────────────────────────────────────────────────
  try {
    const legacyId = await searchFile(LEGACY_FILE);
    if (legacyId) {
      const res = await window.gapi.client.drive.files.get({ fileId: legacyId, alt: 'media' });
      const legacyData = JSON.parse(res.body);
      // Migrate: save to new files (fire-and-forget)
      saveToDrive(legacyData, null).catch(() => {});
      return legacyData;
    }
  } catch {}
  return null;
}

/** Save only the files that contain dirty keys (or all files if dirtyKeys is null). */
export async function saveToDrive(data, dirtyKeys) {
  const filesToSave = dirtyKeys
    ? [...new Set([...dirtyKeys].map(k => KEY_TO_FILE[k]).filter(Boolean))]
    : Object.keys(FILE_MAP);

  const times = await Promise.allSettled(
    filesToSave.map(name => {
      const partial = {};
      FILE_MAP[name].forEach(k => { if (data[k] !== undefined) partial[k] = data[k]; });
      return writeFile(name, partial);
    })
  );
  return times.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean).sort().pop() || null;
}

/** Returns a fingerprint string that changes whenever ANY Drive file is modified.
 *  Used by the polling logic to detect remote changes. */
export async function getDriveFingerprint() {
  const known = Object.entries(fileIds).filter(([, id]) => id);
  if (known.length === 0) return null;
  const results = await Promise.allSettled(
    known.map(async ([name, id]) => {
      const res = await window.gapi.client.drive.files.get({ fileId: id, fields: 'modifiedTime' });
      return `${name}:${res.result.modifiedTime}`;
    })
  );
  const parts = results.filter(r => r.status === 'fulfilled').map(r => r.value).sort();
  return parts.length ? parts.join('|') : null;
}
