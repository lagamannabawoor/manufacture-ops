import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot,
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

// ── Document layout (mirrors Drive FILE_MAP) ───────────────────────────────
export const DOC_MAP = {
  master:     ['factories','productCategories','products','materialTypes','laborGroups','bankAccounts','expenseCategories','users'],
  production: ['productionEntries','pendingProduction'],
  materials:  ['materialPurchases'],
  finance:    ['laborPayments','orders','orderPayments','expenses'],
  audit:      ['auditLog'],
};

export const KEY_TO_DOC = {};
Object.entries(DOC_MAP).forEach(([d, keys]) => keys.forEach(k => { KEY_TO_DOC[k] = d; }));

const COLLECTION = 'mfg_data';
let db = null;
let _unsubscribers = [];

// ── Default config (Urbanmud Firebase project) ─────────────────────────────
const DEFAULT_CONFIG = {
  apiKey:            "AIzaSyAQJpBkkUOqJkRYrPNuE6cfmfKhxm45m1I",
  authDomain:        "urbanmud-930d2.firebaseapp.com",
  projectId:         "urbanmud-930d2",
  storageBucket:     "urbanmud-930d2.firebasestorage.app",
  messagingSenderId: "809973738121",
  appId:             "1:809973738121:web:f23d7e2def53fac1aff458",
};

// ── Init ───────────────────────────────────────────────────────────────────
export function initFirebase(config) {
  try {
    const app = getApps().length ? getApps()[0] : initializeApp(config || DEFAULT_CONFIG);
    db = getFirestore(app);
    // Silent anonymous auth — blocks unauthenticated external access
    signInAnonymously(getAuth(app)).catch(() => {});
    return true;
  } catch { return false; }
}

export function isFirebaseReady() { return !!db; }

function parseConfig(raw) {
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
}

export function getStoredConfig() {
  const env = {
    apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  };
  if (env.apiKey && env.projectId) return env;
  const stored = parseConfig(localStorage.getItem('mfg_firebase_config'));
  return stored || DEFAULT_CONFIG;
}

// ── Read ───────────────────────────────────────────────────────────────────
export async function loadFromFirestore() {
  if (!db) return null;
  const results = await Promise.allSettled(
    Object.keys(DOC_MAP).map(async id => {
      const snap = await getDoc(doc(db, COLLECTION, id));
      return snap.exists() ? snap.data() : null;
    })
  );
  const merged = {};
  let anyFound = false;
  results.forEach(r => {
    if (r.status === 'fulfilled' && r.value) { anyFound = true; Object.assign(merged, r.value); }
  });
  return anyFound ? merged : null;
}

// ── Write ──────────────────────────────────────────────────────────────────
export async function saveToFirestore(data, dirtyKeys) {
  if (!db) return;
  const docsToSave = dirtyKeys
    ? [...new Set([...dirtyKeys].map(k => KEY_TO_DOC[k]).filter(Boolean))]
    : Object.keys(DOC_MAP);

  await Promise.allSettled(
    docsToSave.map(id => {
      const partial = {};
      DOC_MAP[id].forEach(k => { if (data[k] !== undefined) partial[k] = data[k]; });
      return setDoc(doc(db, COLLECTION, id), partial, { merge: true });
    })
  );
}

// ── Real-time listener ─────────────────────────────────────────────────────
export function subscribeToChanges(onUpdate) {
  _unsubscribers.forEach(u => u());
  _unsubscribers = [];
  if (!db) return;

  const cache = {};
  Object.keys(DOC_MAP).forEach(id => {
    const unsub = onSnapshot(doc(db, COLLECTION, id), snap => {
      if (snap.exists()) {
        Object.assign(cache, snap.data());
        onUpdate({ ...cache });
      }
    });
    _unsubscribers.push(unsub);
  });
}

export function unsubscribeAll() {
  _unsubscribers.forEach(u => u());
  _unsubscribers = [];
}
