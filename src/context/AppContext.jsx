import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  initGoogleAPIs, requestSignIn, signOutDrive,
  isSignedIn, loadFromDrive, saveToDrive, getUserInfo,
} from '../services/googleDrive';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

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
  const saveTimer = useRef(null);
  const skipDriveRef = useRef(true);

  // Init Google APIs on mount
  useEffect(() => {
    if (!CLIENT_ID) { setDriveStatus('not-configured'); return; }
    initGoogleAPIs(CLIENT_ID)
      .then(() => setDriveReady(true))
      .catch(() => setDriveStatus('error'));
  }, []);

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
        await saveToDrive(data);
        setDriveStatus('synced');
      } catch {
        setDriveStatus('error');
      }
    }, 2500);
  }, [data, driveReady]);

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
