// ── File layout ──────────────────────────────────────────────────────────────
export const FILE_MAP = {
  'mfg_master.json':     ['factories','productCategories','products','materialTypes','laborGroups','installationTeams','bankAccounts','expenseCategories','users'],
  'mfg_production.json': ['productionEntries','pendingProduction'],
  'mfg_materials.json':  ['materialPurchases'],
  'mfg_finance.json':    ['laborPayments','orders','orderPayments','expenses','installationJobs','installationPayments'],
  'mfg_audit.json':      ['auditLog'],
};

// Reverse map: dataKey -> fileName
export const KEY_TO_FILE = {};
Object.entries(FILE_MAP).forEach(([file, keys]) => keys.forEach(k => { KEY_TO_FILE[k] = file; }));

const FOLDER_NAME         = 'ManufactureOps';
const BACKUP_FOLDER_NAME  = 'ManufactureOps_Backups';
const BACKUP_RETAIN_DAYS  = 30;
const LEGACY_FILE         = 'manufacture_ops_data.json';
const SCOPES              = 'https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOC       = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

let tokenClient    = null;
let folderId       = localStorage.getItem('mfg_folder_id')        || null;
let backupFolderId = localStorage.getItem('mfg_backup_folder_id') || null;

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

/** Find or create the dedicated Drive folder; returns its ID. */
async function resolveFolder() {
  if (folderId) {
    try {
      await window.gapi.client.drive.files.get({ fileId: folderId, fields: 'id' });
      return folderId;
    } catch {
      folderId = null;
      localStorage.removeItem('mfg_folder_id');
    }
  }
  // Search for existing folder
  const listRes = await window.gapi.client.drive.files.list({
    q: `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  });
  if (listRes.result.files?.length > 0) {
    folderId = listRes.result.files[0].id;
    localStorage.setItem('mfg_folder_id', folderId);
    return folderId;
  }
  // Create folder
  const tk = token();
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });
  const folder = await createRes.json();
  folderId = folder.id;
  localStorage.setItem('mfg_folder_id', folderId);
  return folderId;
}

/** Search for a file by name INSIDE the dedicated folder. */
async function searchFile(name) {
  const parent = await resolveFolder();
  const res = await window.gapi.client.drive.files.list({
    q: `name='${name}' and '${parent}' in parents and trashed=false`,
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
  const parent = await resolveFolder();
  const form = new FormData();
  const id = fileIds[name];
  if (id) {
    // Update existing — metadata without parents (can't change parent on PATCH)
    form.append('metadata', new Blob([JSON.stringify({ name, mimeType: 'application/json' })], { type: 'application/json' }));
    form.append('file', new Blob([JSON.stringify(partial)], { type: 'application/json' }));
    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=multipart`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${tk}` }, body: form,
    });
  } else {
    // Create inside folder
    form.append('metadata', new Blob([JSON.stringify({ name, mimeType: 'application/json', parents: [parent] })], { type: 'application/json' }));
    form.append('file', new Blob([JSON.stringify(partial)], { type: 'application/json' }));
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
  folderId = null; backupFolderId = null;
  localStorage.removeItem('mfg_folder_id');
  localStorage.removeItem('mfg_backup_folder_id');
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

// ── Backup ───────────────────────────────────────────────────────────────────
async function resolveBackupFolder() {
  if (backupFolderId) {
    try { await window.gapi.client.drive.files.get({ fileId: backupFolderId, fields: 'id' }); return backupFolderId; }
    catch { backupFolderId = null; localStorage.removeItem('mfg_backup_folder_id'); }
  }
  const res = await window.gapi.client.drive.files.list({
    q: `name='${BACKUP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)', spaces: 'drive',
  });
  if (res.result.files?.length > 0) {
    backupFolderId = res.result.files[0].id;
    localStorage.setItem('mfg_backup_folder_id', backupFolderId);
    return backupFolderId;
  }
  const tk = token();
  const cr = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: BACKUP_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });
  const folder = await cr.json();
  backupFolderId = folder.id;
  localStorage.setItem('mfg_backup_folder_id', backupFolderId);
  return backupFolderId;
}

async function cleanupOldBackups(backupRoot) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - BACKUP_RETAIN_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  try {
    const res = await window.gapi.client.drive.files.list({
      q: `'${backupRoot}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id,name)', spaces: 'drive',
    });
    const old = (res.result.files || []).filter(f => f.name < cutoffStr);
    const tk = token();
    await Promise.allSettled(old.map(f =>
      fetch(`https://www.googleapis.com/drive/v3/files/${f.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tk}` } })
    ));
  } catch {}
}

/** Create today's backup (skips if already done today). Deletes backups older than 30 days. */
export async function createDailyBackup(force = false) {
  const today = new Date().toISOString().slice(0, 10);
  if (!force && localStorage.getItem('mfg_last_backup') === today) return 'already_done';
  const tk = token();
  if (!tk) return 'not_signed_in';
  try {
    const backupRoot = await resolveBackupFolder();
    // Find or create today's sub-folder
    const checkRes = await window.gapi.client.drive.files.list({
      q: `name='${today}' and '${backupRoot}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id)', spaces: 'drive',
    });
    let dayFolderId;
    if (checkRes.result.files?.length > 0) {
      dayFolderId = checkRes.result.files[0].id;
    } else {
      const fr = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: today, mimeType: 'application/vnd.google-apps.folder', parents: [backupRoot] }),
      });
      dayFolderId = (await fr.json()).id;
    }
    // Copy each live file into today's folder
    await Promise.allSettled(
      Object.keys(FILE_MAP).map(name => {
        const fid = fileIds[name];
        if (!fid) return Promise.resolve();
        return fetch(`https://www.googleapis.com/drive/v3/files/${fid}/copy`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, parents: [dayFolderId] }),
        });
      })
    );
    localStorage.setItem('mfg_last_backup', today);
    // Cleanup old backups async
    cleanupOldBackups(backupRoot);
    return today;
  } catch (e) { return 'error'; }
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
