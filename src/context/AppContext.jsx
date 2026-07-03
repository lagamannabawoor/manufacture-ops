import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  initGoogleAPIs, requestSignIn, signOutDrive,
  isSignedIn, loadFromDrive, saveToDrive, getUserInfo, getFileModifiedTime,
} from '../services/googleDrive';

const ENV_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const STORAGE_KEY = 'mfg_ops_data';

const SEED = {
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
  const [driveStatus, setDriveStatus] = useState('idle');
  const [driveUser, setDriveUser] = useState(null);
  const [driveReady, setDriveReady] = useState(false);
  const [clientId, setClientId] = useState(
    () => ENV_CLIENT_ID || localStorage.getItem('mfg_google_client_id') || ''
  );
  const saveTimer = useRef(null);
  const skipDriveRef = useRef(true);
  const lastModifiedRef = useRef(null);
  const pollRef = useRef(null);

  // Init Google APIs whenever clientId changes
  useEffect(() => {
    if (!clientId) { setDriveStatus('not-configured'); setDriveReady(false); return; }
    setDriveReady(false);
    setDriveStatus('idle');
    initGoogleAPIs(clientId)
      .then(() => setDriveReady(true))
      .catch(() => setDriveStatus('error'));
  }, [clientId]);

  function saveClientId(id) {
    const trimmed = id.trim();
    localStorage.setItem('mfg_google_client_id', trimmed);
    setClientId(trimmed);
    setDriveUser(null);
  }

  // Save to localStorage always; debounce-save to Drive when signed in
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    if (!driveReady || !isSignedIn() || skipDriveRef.current) {
      skipDriveRef.current = false;
      return;
    }
    setDriveStatus('syncing');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const modifiedTime = await saveToDrive(data);
        if (modifiedTime) lastModifiedRef.current = modifiedTime;
        setDriveStatus('synced');
      } catch {
        setDriveStatus('error');
      }
    }, 2500);
  }, [data, driveReady]);

  // Poll Drive every 20s for changes made by other devices
  useEffect(() => {
    if (!driveReady || !driveUser) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(async () => {
      if (!isSignedIn()) return;
      try {
        const remoteTime = await getFileModifiedTime();
        if (!remoteTime) return;
        if (lastModifiedRef.current && remoteTime !== lastModifiedRef.current) {
          const remoteData = await loadFromDrive();
          if (remoteData) {
            lastModifiedRef.current = remoteTime;
            skipDriveRef.current = true;
            setData(prev => ({ ...prev, ...remoteData }));
            setDriveStatus('synced');
          }
        } else if (!lastModifiedRef.current) {
          lastModifiedRef.current = remoteTime;
        }
      } catch {}
    }, 20000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [driveReady, driveUser]);

  async function signInWithGoogle() {
    setDriveStatus('loading');
    try {
      const resp = await requestSignIn(false);
      if (!resp) { setDriveStatus('idle'); return; }
      const user = await getUserInfo();
      setDriveUser(user);
      setDriveStatus('loading');
      const driveData = await loadFromDrive();
      skipDriveRef.current = true;
      if (driveData) {
        setData({ ...SEED, ...driveData });
      } else {
        await saveToDrive(data);
      }
      setDriveStatus('synced');
    } catch {
      setDriveStatus('error');
    }
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
    setData(prev => ({ ...prev, [key]: [...prev[key], { id: uid(), ...item }] }));
  }

  function updateItem(key, id, updates) {
    setData(prev => ({
      ...prev,
      [key]: prev[key].map(item => (item.id === id ? { ...item, ...updates } : item)),
    }));
  }

  function deleteItem(key, id) {
    setData(prev => ({ ...prev, [key]: prev[key].filter(item => item.id !== id) }));
  }

  function setList(key, list) {
    setData(prev => ({ ...prev, [key]: list }));
  }

  function resetData() {
    setData(SEED);
  }

  const ctx = {
    ...data,
    driveStatus,
    driveUser,
    driveReady,
    clientId,
    saveClientId,
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
