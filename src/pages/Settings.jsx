import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import Modal, { Field, inputCls, selectCls, SaveBtn } from '../components/Modal';
import { Plus, Trash2, ChevronRight, Building2, Layers, Package, Users, CreditCard, Tag, AlertTriangle, Cloud, CloudOff, CheckCircle, ExternalLink } from 'lucide-react';

export default function Settings() {
  const [section, setSection] = useState(null);
  const [showDrive, setShowDrive] = useState(false);
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
        <GoogleDriveSection />
        <ResetSection />
      </div>
      {showDrive && <DriveClientPanel onClose={() => setShowDrive(false)} />}
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

function GoogleDriveSection() {
  const { clientId, driveUser, driveStatus, signOutFromGoogle } = useApp();
  const [showPanel, setShowPanel] = useState(false);

  const isConfigured = !!clientId;
  const isConnected = !!driveUser;

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-4">
        <button
          onClick={() => setShowPanel(true)}
          className="w-full flex items-center justify-between px-4 py-4 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-blue-500 bg-blue-50">
              <Cloud size={18} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Google Drive Sync</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {isConnected ? `Connected: ${driveUser.email}` : isConfigured ? 'Configured — tap to sign in' : 'Not configured'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isConnected && <CheckCircle size={16} className="text-green-500" />}
            {!isConnected && isConfigured && <CloudOff size={16} className="text-amber-400" />}
            <ChevronRight size={16} className="text-gray-300" />
          </div>
        </button>
      </div>
      {showPanel && <DriveClientPanel onClose={() => setShowPanel(false)} />}
    </>
  );
}

function DriveClientPanel({ onClose }) {
  const { clientId, saveClientId, driveUser, driveStatus, signInWithGoogle, signOutFromGoogle } = useApp();
  const [input, setInput] = useState(clientId || '');
  const [saved, setSaved] = useState(false);

  function handleSave() {
    if (!input.trim()) return alert('Please enter your Client ID');
    if (!input.includes('.apps.googleusercontent.com')) {
      return alert('Invalid Client ID. It must end with .apps.googleusercontent.com');
    }
    saveClientId(input);
    setSaved(true);
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col max-w-[480px] mx-auto">
      <Header title="Google Drive Sync" onBack={onClose} />
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {driveUser ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle size={16} className="text-green-500" />
              <p className="text-sm font-semibold text-green-700">Connected to Google Drive</p>
            </div>
            <p className="text-xs text-green-600 mb-3">{driveUser.email}</p>
            <p className="text-xs text-green-600">All data auto-saves to <strong>manufacture_ops_data.json</strong> in your Drive.</p>
            <button
              onClick={() => { signOutFromGoogle(); }}
              className="mt-3 px-4 py-2 bg-white border border-red-300 text-red-600 text-sm font-semibold rounded-lg"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-sm font-semibold text-gray-700 mb-1">Sign in with Google</p>
            <p className="text-xs text-gray-500 mb-3">Once your Client ID is saved below, tap this to connect your Google Drive.</p>
            <button
              onClick={signInWithGoogle}
              disabled={!clientId || driveStatus === 'loading'}
              className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 text-sm font-semibold px-4 py-2 rounded-lg shadow-sm disabled:opacity-40"
            >
              <svg viewBox="0 0 18 18" width="16" height="16"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/><path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
              Sign in with Google
            </button>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm font-semibold text-gray-700 mb-1">Google OAuth Client ID</p>
          <p className="text-xs text-gray-500 mb-3">Paste your Client ID from Google Cloud Console. It ends with <code className="bg-gray-100 px-1 rounded">.apps.googleusercontent.com</code></p>
          <textarea
            className="w-full border border-gray-200 rounded-lg p-3 text-xs font-mono bg-gray-50 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
            rows={3}
            placeholder="123456789-abc....apps.googleusercontent.com"
            value={input}
            onChange={e => { setInput(e.target.value); setSaved(false); }}
          />
          <button
            onClick={handleSave}
            className="mt-2 w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg"
          >
            {saved ? '✓ Saved — tap Sign in above' : 'Save Client ID'}
          </button>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-700 mb-2">How to get your Client ID</p>
          <ol className="text-xs text-amber-700 space-y-1.5 list-decimal list-inside">
            <li>Go to <strong>console.cloud.google.com</strong></li>
            <li>Create a project → Enable <strong>Google Drive API</strong></li>
            <li>APIs & Services → <strong>OAuth consent screen</strong> → External → Fill name → Save</li>
            <li>Credentials → <strong>+ Create Credentials → OAuth client ID</strong></li>
            <li>Application type: <strong>Web application</strong></li>
            <li>Authorized JS origins: add your app URL</li>
            <li>Click Create → Copy the <strong>Client ID</strong></li>
          </ol>
        </div>
      </div>
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
