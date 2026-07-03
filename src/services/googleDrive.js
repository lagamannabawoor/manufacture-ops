const FILE_NAME = 'manufacture_ops_data.json';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

let tokenClient = null;
let fileId = localStorage.getItem('mfg_drive_file_id') || null;

function loadScript(src) {
  return new Promise((resolve) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.async = true; s.defer = true;
    s.onload = resolve;
    document.head.appendChild(s);
  });
}

export async function initGoogleAPIs(clientId) {
  if (!clientId) throw new Error('VITE_GOOGLE_CLIENT_ID not set');
  await Promise.all([
    loadScript('https://apis.google.com/js/api.js'),
    loadScript('https://accounts.google.com/gsi/client'),
  ]);
  await new Promise((resolve, reject) => {
    window.gapi.load('client', async () => {
      try {
        await window.gapi.client.init({ discoveryDocs: [DISCOVERY_DOC] });
        resolve();
      } catch (e) { reject(e); }
    });
  });
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: () => {},
  });
}

export function requestSignIn(silent = false) {
  return new Promise((resolve) => {
    tokenClient.callback = (resp) => {
      if (resp.error && !silent) {
        tokenClient.callback = (resp2) => resolve(resp2.error ? null : resp2);
        tokenClient.requestAccessToken({ prompt: 'select_account' });
      } else {
        resolve(resp.error ? null : resp);
      }
    };
    tokenClient.requestAccessToken({ prompt: silent ? '' : 'select_account' });
  });
}

export function signOutDrive() {
  const token = window.gapi?.client?.getToken();
  if (token?.access_token) {
    window.google.accounts.oauth2.revoke(token.access_token);
    window.gapi.client.setToken('');
  }
  fileId = null;
  localStorage.removeItem('mfg_drive_file_id');
}

export function isSignedIn() {
  return !!window.gapi?.client?.getToken()?.access_token;
}

export async function getUserInfo() {
  const token = window.gapi?.client?.getToken()?.access_token;
  if (!token) return null;
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return await res.json();
  } catch { return null; }
}

export async function loadFromDrive() {
  if (fileId) {
    try {
      const res = await window.gapi.client.drive.files.get({ fileId, alt: 'media' });
      return JSON.parse(res.body);
    } catch {
      fileId = null;
      localStorage.removeItem('mfg_drive_file_id');
    }
  }
  const listRes = await window.gapi.client.drive.files.list({
    q: `name='${FILE_NAME}' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  });
  const files = listRes.result.files;
  if (!files || files.length === 0) return null;
  fileId = files[0].id;
  localStorage.setItem('mfg_drive_file_id', fileId);
  const fileRes = await window.gapi.client.drive.files.get({ fileId, alt: 'media' });
  return JSON.parse(fileRes.body);
}

export async function saveToDrive(data) {
  const token = window.gapi.client.getToken()?.access_token;
  if (!token) throw new Error('Not signed in');
  const body = JSON.stringify(data);
  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify({ name: FILE_NAME, mimeType: 'application/json' })], { type: 'application/json' })
  );
  form.append('file', new Blob([body], { type: 'application/json' }));

  if (fileId) {
    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  } else {
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const json = await res.json();
    fileId = json.id;
    localStorage.setItem('mfg_drive_file_id', fileId);
  }
}
