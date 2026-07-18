import React, { useState } from 'react';
import { useApp, ROLES } from '../context/AppContext';
import Header from '../components/Header';
import Modal, { Field, inputCls, selectCls, SaveBtn } from '../components/Modal';
import AuditLog from './AuditLog';
import { Plus, Trash2, ChevronRight, Building2, Layers, Package, Users, CreditCard, Tag, AlertTriangle, Cloud, CloudOff, CheckCircle, ExternalLink, Shield, LogOut, UserPlus, ArchiveRestore, Database, Wifi, WifiOff } from 'lucide-react';

export default function Settings() {
  const { currentUser, logout } = useApp();
  const isAdmin = currentUser?.role === 'admin';
  const [section, setSection] = useState(null);
  const [showUsers, setShowUsers] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const sections = [
    { id: 'factories', label: 'Factories', icon: Building2, color: 'text-blue-500 bg-blue-50' },
    { id: 'productCategories', label: 'Product Categories', icon: Layers, color: 'text-indigo-500 bg-indigo-50' },
    { id: 'products', label: 'Products', icon: Package, color: 'text-green-500 bg-green-50' },
    { id: 'materialTypes', label: 'Material Types', icon: Package, color: 'text-amber-500 bg-amber-50' },
    { id: 'laborGroups', label: 'Labor Groups', icon: Users, color: 'text-purple-500 bg-purple-50' },
    { id: 'bankAccounts', label: 'Bank Accounts', icon: CreditCard, color: 'text-teal-500 bg-teal-50' },
    { id: 'expenseCategories', label: 'Expense Categories', icon: Tag, color: 'text-red-500 bg-red-50' },
  ];
  return (
    <div>
      <Header title="Settings" subtitle="Configure master data" />
      <div className="px-4 py-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-4">
          {sections.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`w-full flex items-center justify-between px-4 py-4 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors ${i > 0 ? 'border-t border-gray-50' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.color}`}>
                  <s.icon size={18} />
                </div>
                <span className="text-sm font-medium text-gray-700">{s.label}</span>
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </button>
          ))}
        </div>
        <FirebaseSection />
        {isAdmin && (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-4">
              <button onClick={() => setShowUsers(true)} className="w-full flex items-center justify-between px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-violet-500 bg-violet-50"><UserPlus size={18} /></div>
                  <span className="text-sm font-medium text-gray-700">User Management</span>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
              </button>
              <button onClick={() => setShowAudit(true)} className="w-full flex items-center justify-between px-4 py-4 border-t border-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-rose-500 bg-rose-50"><Shield size={18} /></div>
                  <span className="text-sm font-medium text-gray-700">Audit Log</span>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
              </button>
            </div>
            <BackupSection />
          </>
        )}
        <ResetSection />
        <button onClick={logout} className="w-full flex items-center justify-center gap-2 mt-4 py-3 bg-white border border-red-200 text-red-600 font-semibold rounded-xl text-sm shadow-sm">
          <LogOut size={16} /> Sign Out ({currentUser?.name})
        </button>
      </div>
      {showUsers && <UserManagementPanel onClose={() => setShowUsers(false)} />}
      {showAudit && <AuditLog onBack={() => setShowAudit(false)} />}
      {section && (
        <SectionEditor
          sectionId={section}
          label={sections.find(s => s.id === section)?.label}
          onClose={() => setSection(null)}
        />
      )}
    </div>
  );
}

function SectionEditor({ sectionId, label, onClose }) {
  const app = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const items = app[sectionId] || [];

  const configs = {
    factories: {
      fields: [{ key: 'name', label: 'Factory Name', type: 'text', required: true }],
      display: item => item.name,
    },
    productCategories: {
      fields: [{ key: 'name', label: 'Category Name', type: 'text', required: true }],
      display: item => item.name,
    },
    products: {
      fields: [
        { key: 'name', label: 'Product Name', type: 'text', required: true },
        { key: 'categoryId', label: 'Category', type: 'select', options: app.productCategories, required: true },
        { key: 'unit', label: 'Unit', type: 'select', options: [{ id: 'pieces', name: 'Pieces' }, { id: 'sqft', name: 'Sq.ft' }, { id: 'kg', name: 'Kg' }], required: true },
      ],
      display: item => {
        const cat = app.productCategories.find(c => c.id === item.categoryId);
        return `${item.name} (${cat?.name || ''})`;
      },
    },
    materialTypes: {
      fields: [
        { key: 'name', label: 'Material Name', type: 'text', required: true },
        { key: 'unit', label: 'Unit', type: 'select', options: [{ id: 'bags', name: 'Bags' }, { id: 'trucks', name: 'Trucks' }, { id: 'kg', name: 'Kg' }, { id: 'liters', name: 'Liters' }, { id: 'tons', name: 'Tons' }], required: true },
      ],
      display: item => `${item.name} (${item.unit})`,
    },
    laborGroups: {
      fields: [
        { key: 'name', label: 'Group Name', type: 'text', required: true },
        { key: 'description', label: 'Description', type: 'text' },
      ],
      display: item => item.name,
    },
    bankAccounts: {
      fields: [
        { key: 'name', label: 'Account Nickname', type: 'text', required: true },
        { key: 'bankName', label: 'Bank Name', type: 'text', required: true },
        { key: 'type', label: 'Account Type', type: 'select', options: [{ id: 'current', name: 'Current' }, { id: 'savings', name: 'Savings' }, { id: 'cash', name: 'Cash' }], required: true },
        { key: 'accountNumber', label: 'Account Number (last 4)', type: 'text' },
      ],
      display: item => `${item.name} — ${item.bankName}`,
    },
    expenseCategories: {
      fields: [{ key: 'name', label: 'Category Name', type: 'text', required: true }],
      display: item => item.name,
    },
  };

  const config = configs[sectionId];

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col max-w-[480px] mx-auto">
      <Header
        title={label}
        onBack={onClose}
        action={
          <button onClick={() => setShowAdd(true)} className="bg-white/20 hover:bg-white/30 text-white rounded-full p-2">
            <Plus size={20} />
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {items.length === 0 ? (
          <div className="bg-white rounded-xl p-10 text-center shadow-sm border border-gray-100">
            <p className="text-gray-400 text-sm">No items yet. Tap + to add.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {items.map((item, i) => (
              <div key={item.id} className={`flex items-center justify-between px-4 py-3.5 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                <p className="text-sm text-gray-700">{config.display(item)}</p>
                <button
                  onClick={() => { if (confirm(`Delete "${config.display(item)}"?`)) app.deleteItem(sectionId, item.id); }}
                  className="text-gray-300 hover:text-red-400 p-1"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      {showAdd && (
        <AddItemModal
          title={`Add ${label}`}
          fields={config.fields}
          onClose={() => setShowAdd(false)}
          onSave={data => { app.addItem(sectionId, data); setShowAdd(false); }}
        />
      )}
    </div>
  );
}

function AddItemModal({ title, fields, onClose, onSave }) {
  const [form, setForm] = useState(() => {
    const f = {};
    fields.forEach(field => { f[field.key] = field.default || ''; });
    return f;
  });

  function save() {
    const missing = fields.filter(f => f.required && !form[f.key]);
    if (missing.length) return alert(`${missing[0].label} is required.`);
    onSave(form);
  }

  return (
    <Modal title={title} onClose={onClose}>
      {fields.map(field => (
        <Field key={field.key} label={field.label} required={field.required}>
          {field.type === 'select' ? (
            <select className={selectCls} value={form[field.key]} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}>
              <option value="">Select...</option>
              {field.options?.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
            </select>
          ) : (
            <input type={field.type} className={inputCls} value={form[field.key]} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))} />
          )}
        </Field>
      ))}
      <SaveBtn onClick={save} />
    </Modal>
  );
}

function FirebaseSection() {
  const { fbStatus, saveFirebaseConfig } = useApp();
  const [showPanel, setShowPanel] = useState(false);

  const statusColor = fbStatus === 'ready' ? 'text-green-500' : fbStatus === 'error' ? 'text-red-400' : fbStatus === 'connecting' ? 'text-amber-400' : 'text-gray-400';
  const statusLabel = { ready: 'Connected — syncing in real-time', error: 'Connection error', connecting: 'Connecting…', 'not-configured': 'Not configured — tap to set up' }[fbStatus] || fbStatus;

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-4">
        <button onClick={() => setShowPanel(true)} className="w-full flex items-center justify-between px-4 py-4 text-left">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-blue-500 bg-blue-50">
              <Database size={18} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Cloud Sync (Firebase)</p>
              <p className={`text-xs mt-0.5 ${statusColor}`}>{statusLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {fbStatus === 'ready' ? <Wifi size={16} className="text-green-500" /> : <WifiOff size={16} className="text-gray-300" />}
            <ChevronRight size={16} className="text-gray-300" />
          </div>
        </button>
      </div>
      {showPanel && <FirebasePanel onClose={() => setShowPanel(false)} />}
    </>
  );
}

function parseFirebaseConfig(raw) {
  try {
    // Try plain JSON first
    const j = JSON.parse(raw);
    if (j.apiKey) return j;
  } catch {}
  try {
    // Extract from JS object literal: apiKey: "...", ...
    const extract = (key) => {
      const m = raw.match(new RegExp(`${key}\\s*:\\s*["'\`]([^"'\`]+)["'\`]`));
      return m ? m[1] : '';
    };
    const cfg = {
      apiKey:            extract('apiKey'),
      authDomain:        extract('authDomain'),
      projectId:         extract('projectId'),
      storageBucket:     extract('storageBucket'),
      messagingSenderId: extract('messagingSenderId'),
      appId:             extract('appId'),
    };
    if (cfg.apiKey && cfg.projectId) return cfg;
  } catch {}
  return null;
}

function FirebasePanel({ onClose }) {
  const { fbStatus, saveFirebaseConfig } = useApp();
  const stored = (() => { try { return localStorage.getItem('mfg_firebase_config') || ''; } catch { return ''; } })();
  const [raw, setRaw] = useState(stored);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  function handleSave() {
    const cfg = parseFirebaseConfig(raw);
    if (!cfg) {
      setError('Could not read config — make sure you pasted the full firebaseConfig block.');
      return;
    }
    setError('');
    saveFirebaseConfig(cfg);
    setSaved(true);
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col max-w-[480px] mx-auto">
      <Header title="Cloud Sync Setup" onBack={onClose} />
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {fbStatus === 'ready' && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle size={16} className="text-green-500" />
            <p className="text-sm font-semibold text-green-700">Connected ✓ — all employees share data automatically.</p>
          </div>
        )}

        {/* Step-by-step with direct links */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          <div className="p-4">
            <p className="text-sm font-bold text-gray-800 mb-3">3 steps — takes 2 minutes</p>

            <div className="space-y-3">
              <div className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center shrink-0">1</span>
                <div>
                  <p className="text-xs font-semibold text-gray-700">Create a Firebase project</p>
                  <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer"
                    className="text-xs text-blue-600 underline">Open console.firebase.google.com →</a>
                  <p className="text-xs text-gray-400 mt-0.5">Click "Add project" → any name → Continue → Create</p>
                </div>
              </div>

              <div className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center shrink-0">2</span>
                <div>
                  <p className="text-xs font-semibold text-gray-700">Enable Firestore Database</p>
                  <p className="text-xs text-gray-400">Left sidebar → Build → Firestore Database → Create database → <strong>Start in test mode</strong> → Enable</p>
                </div>
              </div>

              <div className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center shrink-0">3</span>
                <div>
                  <p className="text-xs font-semibold text-gray-700">Get your config</p>
                  <p className="text-xs text-gray-400">⚙️ gear → Project settings → scroll down → click <strong>&lt;/&gt;</strong> → Register app → copy the <strong>firebaseConfig</strong> block → paste below</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4">
            <p className="text-xs font-semibold text-gray-700 mb-2">Paste your firebaseConfig here</p>
            <p className="text-xs text-gray-400 mb-2">Copy everything from <code className="bg-gray-100 px-1 rounded">apiKey: "..."</code> to the closing <code className="bg-gray-100 px-1 rounded">{'}'}</code> and paste it below.</p>
            <textarea
              className="w-full border border-gray-200 rounded-lg p-3 text-xs font-mono bg-gray-50 resize-none focus:outline-none focus:ring-2 focus:ring-amber-300"
              rows={8}
              placeholder={`apiKey: "AIzaSy...",\nauthDomain: "your-app.firebaseapp.com",\nprojectId: "your-app",\nstorageBucket: "your-app.appspot.com",\nmessagingSenderId: "123456789",\nappId: "1:123:web:abc"`}
              value={raw}
              onChange={e => { setRaw(e.target.value); setSaved(false); setError(''); }}
            />
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
            <button onClick={handleSave} className="mt-2 w-full py-2.5 bg-amber-700 text-white text-sm font-semibold rounded-lg">
              {saved ? '✓ Connected!' : 'Connect'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DriveClientPanel({ onClose }) {
  const { clientId, saveClientId, driveUser, driveStatus, signInWithGoogle, signOutFromGoogle } = useApp();
  const [input, setInput] = useState(clientId || '');
  const [saved, setSaved] = useState(false);

  function handleSave() {
    if (!input.trim()) return alert('Please enter your Client ID');
    if (!input.includes('.apps.googleusercontent.com')) return alert('Invalid Client ID.');
    saveClientId(input);
    setSaved(true);
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col max-w-[480px] mx-auto">
      <Header title="Google Drive Backup" onBack={onClose} />
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs text-blue-700">This is for <strong>backup only</strong>. Your live data syncs via Firebase (no Google login needed for employees). Only the Admin needs to connect here.</p>
        </div>
        {driveUser ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle size={16} className="text-green-500" />
              <p className="text-sm font-semibold text-green-700">Connected: {driveUser.email}</p>
            </div>
            <p className="text-xs text-green-600">Backups will be saved to <strong>ManufactureOps_Backups/</strong> in this account's Drive.</p>
            <button onClick={signOutFromGoogle} className="mt-3 px-4 py-2 bg-white border border-red-300 text-red-600 text-sm font-semibold rounded-lg">Disconnect</button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Sign in with Google (Admin only)</p>
            <button onClick={signInWithGoogle} disabled={!clientId || driveStatus === 'loading'}
              className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 text-sm font-semibold px-4 py-2 rounded-lg shadow-sm disabled:opacity-40">
              <svg viewBox="0 0 18 18" width="16" height="16"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/><path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
              Sign in with Google
            </button>
          </div>
        )}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm font-semibold text-gray-700 mb-1">Google OAuth Client ID</p>
          <textarea className="w-full border border-gray-200 rounded-lg p-3 text-xs font-mono bg-gray-50 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
            rows={3} placeholder="123456789-abc....apps.googleusercontent.com"
            value={input} onChange={e => { setInput(e.target.value); setSaved(false); }} />
          <button onClick={handleSave} className="mt-2 w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg">
            {saved ? '✓ Saved' : 'Save Client ID'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BackupSection() {
  const { createDailyBackup, driveUser, clientId, driveReady } = useApp();
  const [showDrivePanel, setShowDrivePanel] = useState(false);
  const [status, setStatus] = useState('');
  const lastBackup = localStorage.getItem('mfg_last_backup') || null;

  async function runBackup() {
    if (!driveUser) { setStatus('Not connected to Google Drive'); return; }
    setStatus('backing_up');
    const result = await createDailyBackup(true);
    setStatus(result === 'error' ? 'error' : result === 'not_signed_in' ? 'not_signed_in' : 'done');
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-4">
      <div className="px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-teal-500 bg-teal-50">
            <ArchiveRestore size={18} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Backup & Archive</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {lastBackup ? `Last backup: ${lastBackup}` : 'No backup yet'}
            </p>
          </div>
        </div>
        <button
          onClick={runBackup}
          disabled={status === 'backing_up'}
          className="px-3 py-1.5 bg-teal-50 text-teal-700 text-xs font-semibold rounded-lg border border-teal-200 disabled:opacity-50"
        >
          {status === 'backing_up' ? 'Backing up…' : status === 'done' ? '✓ Done' : 'Backup Now'}
        </button>
      </div>
      {status === 'error' && <p className="px-4 pb-3 text-xs text-red-500">Backup failed — ensure Drive is connected.</p>}
      {status === 'not_signed_in' && (
        <p className="px-4 pb-3 text-xs text-amber-600">
          Connect Google Drive first. <button onClick={() => setShowDrivePanel(true)} className="underline font-semibold">Set up Drive</button>
        </p>
      )}
      {!driveUser && (
        <button onClick={() => setShowDrivePanel(true)} className="mx-4 mb-3 px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500">
          {clientId ? 'Connect Google Drive for backups' : 'Configure Google Drive for backups'}
        </button>
      )}
      <div className="px-4 pb-3 border-t border-gray-50 pt-3">
        <p className="text-xs text-gray-400 leading-relaxed">
          Backups are stored in <strong>ManufactureOps_Backups/</strong> on your Google Drive. Older than 30 days are deleted automatically.
        </p>
      </div>
      {showDrivePanel && <DriveClientPanel onClose={() => setShowDrivePanel(false)} />}
    </div>
  );
}

function UserManagementPanel({ onClose }) {
  const { users = [], addItem, deleteItem, currentUser } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', username: '', password: '', role: 'accountant' });

  function save() {
    if (!form.name || !form.username || !form.password) return alert('All fields are required.');
    if (users.find(u => u.username.toLowerCase() === form.username.toLowerCase())) return alert('Username already exists.');
    addItem('users', form);
    setForm({ name: '', username: '', password: '', role: 'accountant' });
    setShowAdd(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col max-w-[480px] mx-auto">
      <Header title="User Management" onBack={onClose} action={
        <button onClick={() => setShowAdd(true)} className="bg-white/20 hover:bg-white/30 text-white rounded-full p-2"><Plus size={20} /></button>
      } />
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {users.map(u => (
          <div key={u.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">{u.name}</p>
              <p className="text-xs text-gray-400">@{u.username}</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block capitalize ${
                u.role === 'admin' ? 'bg-red-100 text-red-700' :
                u.role === 'accountant' ? 'bg-blue-100 text-blue-700' :
                u.role === 'labour' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}>{ROLES[u.role]?.label || u.role}</span>
            </div>
            {u.id !== currentUser?.id && (
              <button onClick={() => { if (confirm(`Delete user "${u.name}"?`)) deleteItem('users', u.id); }}
                className="text-gray-300 hover:text-red-400 p-1"><Trash2 size={16} /></button>
            )}
          </div>
        ))}
      </div>
      {showAdd && (
        <Modal title="Add User" onClose={() => setShowAdd(false)}>
          <Field label="Full Name" required>
            <input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="John Smith" />
          </Field>
          <Field label="Username" required>
            <input className={inputCls} value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="johnsmith" autoCapitalize="none" />
          </Field>
          <Field label="Password" required>
            <input type="password" className={inputCls} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 4 characters" />
          </Field>
          <Field label="Role" required>
            <select className={selectCls} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              {Object.entries(ROLES).map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}
            </select>
          </Field>
          <SaveBtn onClick={save} label="Create User" />
        </Modal>
      )}
    </div>
  );
}

function ResetSection() {
  const app = useApp();
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="text-red-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-red-700">Reset All Data</p>
          <p className="text-xs text-red-500 mt-1">This will delete all operational data and restore default master settings.</p>
          <button
            onClick={() => { if (confirm('Are you sure? All data will be lost!')) app.resetData(); }}
            className="mt-3 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg"
          >
            Reset Data
          </button>
        </div>
      </div>
    </div>
  );
}
