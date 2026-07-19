import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  initGoogleAPIs, requestSignIn, signOutDrive,
  isSignedIn, loadFromDrive, saveToDrive, getUserInfo, createDailyBackup,
} from '../services/googleDrive';
import {
  initFirebase, isFirebaseReady, getStoredConfig,
  loadFromFirestore, saveToFirestore, subscribeToChanges, unsubscribeAll, KEY_TO_DOC,
} from '../services/firestoreDb';

const ENV_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '761810394116-9vt8ratsjnmfn27m0jld1jgpc0ioahss.apps.googleusercontent.com';

const STORAGE_KEY = 'mfg_ops_data';

export const ROLES = {
  admin:      { label: 'Admin',      tabs: ['dashboard','production','materials','finance','reports','settings'], canWrite: true,  canApprove: true,  canSettings: true  },
  accountant: { label: 'Accountant', tabs: ['dashboard','production','materials','finance','reports'],            canWrite: true,  canApprove: true,  canSettings: false },
  labour:     { label: 'Labour',     tabs: ['production'],                                                       canWrite: false, canApprove: false, canSettings: false },
  guest:      { label: 'Guest',      tabs: ['dashboard','production','materials','finance','reports'],            canWrite: false, canApprove: false, canSettings: false },
};

const SEED = {
  users: [
    { id: 'u_superadmin', name: 'Super Admin', username: 'lbawoor',      password: '@urbanmud#RK', role: 'admin',      email: 'lagamanna@gmail.com' },
    { id: 'u_admin',      name: 'Admin',       username: 'admin',        password: 'admin123',     role: 'admin'      },
    { id: 'u_accountant', name: 'Accountant',  username: 'accountant',   password: 'accountant123',role: 'accountant' },
    { id: 'u_labour',     name: 'Labour',      username: 'labour',       password: 'labour123',    role: 'labour'     },
    { id: 'u_guest',      name: 'Guest',       username: 'guest',        password: 'guest123',     role: 'guest'      },
  ],
  factories: [
    { id: 'f1', name: 'Factory 1' },
    { id: 'f2', name: 'Factory 2' },
  ],
  productCategories: [
    { id: 'pc1', name: 'Concrete Blocks' },
    { id: 'pc2', name: 'Paving Stones' },
    { id: 'pc3', name: 'Hollow Blocks' },
    { id: 'pc4', name: 'Interlocking Blocks' },
  ],
  products: [
    { id: 'p1', name: '4" Solid Block', categoryId: 'pc1', unit: 'pieces' },
    { id: 'p2', name: '6" Solid Block', categoryId: 'pc1', unit: 'pieces' },
    { id: 'p3', name: '8" Solid Block', categoryId: 'pc1', unit: 'pieces' },
    { id: 'p4', name: '60mm Paver', categoryId: 'pc2', unit: 'pieces' },
    { id: 'p5', name: '80mm Paver', categoryId: 'pc2', unit: 'pieces' },
    { id: 'p6', name: '4" Hollow Block', categoryId: 'pc3', unit: 'pieces' },
    { id: 'p7', name: '6" Hollow Block', categoryId: 'pc3', unit: 'pieces' },
    { id: 'p8', name: 'Interlocking Block', categoryId: 'pc4', unit: 'pieces' },
  ],
  materialTypes: [
    { id: 'm1', name: 'Portland Cement', unit: 'bags' },
    { id: 'm2', name: 'River Sand', unit: 'trucks' },
    { id: 'm3', name: 'M-Sand', unit: 'trucks' },
    { id: 'm4', name: 'Mud', unit: 'trucks' },
    { id: 'm5', name: 'Chemical Admixture', unit: 'liters' },
    { id: 'm6', name: 'Blue Metal', unit: 'trucks' },
  ],
  laborGroups: [
    { id: 'lg1', name: 'Group A' },
    { id: 'lg2', name: 'Group B' },
    { id: 'lg3', name: 'Group C' },
  ],
  bankAccounts: [
    { id: 'ba1', name: 'HDFC Main', bankName: 'HDFC Bank', type: 'current' },
    { id: 'ba2', name: 'SBI Account', bankName: 'SBI', type: 'savings' },
    { id: 'ba3', name: 'Cash', bankName: 'Cash', type: 'cash' },
  ],
  expenseCategories: [
    { id: 'ec1', name: 'Electricity' },
    { id: 'ec2', name: 'Internet' },
    { id: 'ec3', name: 'Office Supplies' },
    { id: 'ec4', name: 'Vehicle/Transport' },
    { id: 'ec5', name: 'Equipment Repair' },
    { id: 'ec6', name: 'Other' },
  ],
  productionEntries: [],
  materialPurchases: [],
  laborPayments: [],
  orders: [],
  orderPayments: [],
  expenses: [],
  pendingProduction: [],
  auditLog: [],
};

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED;
    const saved = JSON.parse(raw);
    return { ...SEED, ...saved };
  } catch {
    return SEED;
  }
}

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [data, setData] = useState(loadData);
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('mfg_session')); } catch { return null; }
  });
  const currentUserRef = useRef(null);
  currentUserRef.current = currentUser;

  // ── Firebase sync state ─────────────────────────────────────────────────
  const [fbStatus, setFbStatus] = useState('not-configured'); // not-configured | connecting | ready | error
  const skipFbRef = useRef(true);
  const dirtyKeysRef = useRef(new Set());
  const saveTimer = useRef(null);

  // ── Drive (backup only) state ────────────────────────────────────────────
  const [driveStatus, setDriveStatus] = useState('idle');
  const [driveUser, setDriveUser]   = useState(null);
  const [driveReady, setDriveReady] = useState(false);
  const [clientId, setClientId]     = useState(
    () => ENV_CLIENT_ID || localStorage.getItem('mfg_google_client_id') || ''
  );

  function markDirty(key) { dirtyKeysRef.current.add(key); }

  function _log(category, description, user) {
    const u = user || currentUserRef.current;
    if (!u) return;
    const entry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      userId: u.id, userName: u.name, role: u.role,
      category, description,
    };
    setData(prev => ({ ...prev, auditLog: [entry, ...(prev.auditLog || [])].slice(0, 5000) }));
    markDirty('auditLog');
  }

  function login(username, password) {
    const users = data.users || [];
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    if (!user) return false;
    const session = { id: user.id, name: user.name, role: user.role, username: user.username };
    sessionStorage.setItem('mfg_session', JSON.stringify(session));
    setCurrentUser(session);
    _log('auth', `${user.name} logged in`, session);
    return true;
  }

  function logout() {
    _log('auth', `${currentUser?.name} logged out`);
    sessionStorage.removeItem('mfg_session');
    setCurrentUser(null);
  }

  function submitPendingProduction(entry) {
    const u = currentUserRef.current;
    const item = { ...entry, id: uid(), status: 'pending', submittedBy: u?.id, submittedByName: u?.name, submittedAt: new Date().toISOString() };
    setData(prev => ({ ...prev, pendingProduction: [...(prev.pendingProduction || []), item] }));
    markDirty('pendingProduction');
    _log('production', `${u?.name} submitted production for approval: ${entry.qty} ${entry.unit || 'units'}`);
  }

  function approvePendingProduction(pendingId) {
    setData(prev => {
      const entry = prev.pendingProduction.find(p => p.id === pendingId);
      if (!entry) return prev;
      const { status, submittedBy, submittedByName, submittedAt, ...rest } = entry;
      const approved = { ...rest, approvedBy: currentUserRef.current?.id, approvedByName: currentUserRef.current?.name, approvedAt: new Date().toISOString() };
      _log('production', `Approved production entry from ${submittedByName}: ${entry.qty} units`);
      return { ...prev, productionEntries: [...prev.productionEntries, approved], pendingProduction: prev.pendingProduction.filter(p => p.id !== pendingId) };
    });
    markDirty('productionEntries'); markDirty('pendingProduction');
  }

  function rejectPendingProduction(pendingId) {
    setData(prev => {
      const entry = prev.pendingProduction.find(p => p.id === pendingId);
      _log('production', `Rejected production entry from ${entry?.submittedByName}`);
      return { ...prev, pendingProduction: prev.pendingProduction.filter(p => p.id !== pendingId) };
    });
    markDirty('pendingProduction');
  }

  // ── Firebase init (on mount + whenever user saves new config) ────────────
  function connectFirebase(config) {
    const cfg = config || getStoredConfig();
    if (!cfg) { setFbStatus('not-configured'); return; }
    setFbStatus('connecting');
    const ok = initFirebase(cfg);
    if (!ok) { setFbStatus('error'); return; }
    loadFromFirestore().then(remote => {
      if (remote) {
        skipFbRef.current = true;
        setData({ ...SEED, ...remote });
      } else {
        // First time: push local seed/data to Firestore
        saveToFirestore(data, null).catch(() => {});
      }
      setFbStatus('ready');
      subscribeToChanges(remote => {
        skipFbRef.current = true;
        setData(prev => ({ ...SEED, ...prev, ...remote }));
      });
    }).catch(() => setFbStatus('error'));
  }

  useEffect(() => {
    connectFirebase();
    return () => unsubscribeAll();
  }, []);

  function saveFirebaseConfig(rawConfig) {
    localStorage.setItem('mfg_firebase_config', JSON.stringify(rawConfig));
    unsubscribeAll();
    connectFirebase(rawConfig);
  }

  // ── Save to localStorage + debounce-save to Firestore ────────────────────
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    if (!isFirebaseReady() || skipFbRef.current) { skipFbRef.current = false; return; }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const dirty = new Set(dirtyKeysRef.current);
        dirtyKeysRef.current.clear();
        await saveToFirestore(data, dirty.size > 0 ? dirty : null);
      } catch {}
    }, 1500);
  }, [data]);

  // ── Drive (backup only) ───────────────────────────────────────────────────
  function saveClientId(id) {
    const trimmed = id.trim();
    localStorage.setItem('mfg_google_client_id', trimmed);
    setClientId(trimmed);
    setDriveUser(null);
  }

  // Init Drive APIs when clientId present (needed for backup)
  useEffect(() => {
    if (!clientId) { setDriveReady(false); return; }
    initGoogleAPIs(clientId).then(() => setDriveReady(true)).catch(() => {});
  }, [clientId]);

  async function signInWithGoogle() {
    setDriveStatus('loading');
    try {
      const resp = await requestSignIn(false);
      if (!resp) { setDriveStatus('idle'); return; }
      const user = await getUserInfo();
      setDriveUser(user);
      setDriveStatus('synced');
      createDailyBackup(false).catch(() => {});
    } catch { setDriveStatus('error'); }
  }

  function signOutFromGoogle() {
    signOutDrive();
    setDriveUser(null);
    setDriveStatus('idle');
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function addItem(key, item) {
    const newItem = { id: uid(), ...item };
    setData(prev => ({ ...prev, [key]: [...(prev[key] || []), newItem] }));
    markDirty(key);
    _log(key, `Added ${key} entry: ${item.name || item.description || item.qty || ''}`);
    return newItem;
  }

  function updateItem(key, id, updates) {
    setData(prev => ({ ...prev, [key]: (prev[key] || []).map(i => i.id === id ? { ...i, ...updates } : i) }));
    markDirty(key);
    _log(key, `Updated ${key} entry`);
  }

  function deleteItem(key, id) {
    setData(prev => ({ ...prev, [key]: (prev[key] || []).filter(i => i.id !== id) }));
    markDirty(key);
    _log(key, `Deleted ${key} entry`);
  }

  function setList(key, list) {
    setData(prev => ({ ...prev, [key]: list }));
    markDirty(key);
  }

  function resetData() {
    setData(SEED);
  }

  const ctx = {
    ...data,
    currentUser,
    login,
    logout,
    submitPendingProduction,
    approvePendingProduction,
    rejectPendingProduction,
    fbStatus,
    saveFirebaseConfig,
    driveStatus,
    driveUser,
    driveReady,
    clientId,
    saveClientId,
    createDailyBackup,
    signInWithGoogle,
    signOutFromGoogle,
    addItem,
    updateItem,
    deleteItem,
    setList,
    resetData,
  };

  return <AppContext.Provider value={ctx}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}
