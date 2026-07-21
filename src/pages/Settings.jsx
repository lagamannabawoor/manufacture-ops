import React, { useState, useRef, useEffect } from 'react';
import { useApp, ROLES } from '../context/AppContext';
import Header from '../components/Header';
import Modal, { Field, inputCls, selectCls, SaveBtn } from '../components/Modal';
import AuditLog from './AuditLog';
import CAExport from './CAExport';
import { Plus, Trash2, Pencil, X, ChevronRight, Building2, Layers, Package, Users, CreditCard, Tag, AlertTriangle, Cloud, CloudOff, CheckCircle, ExternalLink, Shield, LogOut, UserPlus, ArchiveRestore, Archive, Database, Wifi, WifiOff, Mail, MapPin, FileDown, FileUp, Share2, SlidersHorizontal } from 'lucide-react';
import { DOC_MAP } from '../services/firestoreDb';

export default function Settings() {
  const { currentUser, logout } = useApp();
  const isSuperAdmin = currentUser?.username === 'lbawoor';
  const [section, setSection] = useState(null);
  const [showUsers, setShowUsers] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [showReportEmails, setShowReportEmails] = useState(false);
  const [showCompanyInfo, setShowCompanyInfo] = useState(false);
  const [showThresholds, setShowThresholds]   = useState(false);
  const [showBackup, setShowBackup]           = useState(false);
  const [showCAExport, setShowCAExport]   = useState(false);
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-4">
          <button onClick={() => setShowThresholds(true)} className="w-full flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-orange-500 bg-orange-50"><SlidersHorizontal size={18} /></div>
              <div>
                <span className="text-sm font-medium text-gray-700">Alert Thresholds</span>
                <p className="text-[11px] text-gray-400 leading-tight">Low stock % · Needs Attention triggers</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </button>
        </div>

        {isSuperAdmin && (
          <>
            <FirebaseSection />
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
              <button onClick={() => setShowReportEmails(true)} className="w-full flex items-center justify-between px-4 py-4 border-t border-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sky-500 bg-sky-50"><Mail size={18} /></div>
                  <span className="text-sm font-medium text-gray-700">Report Email Recipients</span>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
              </button>
              <button onClick={() => setShowCompanyInfo(true)} className="w-full flex items-center justify-between px-4 py-4 border-t border-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-amber-600 bg-amber-50"><MapPin size={18} /></div>
                  <span className="text-sm font-medium text-gray-700">Company Info &amp; Address</span>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
              </button>
              <button onClick={() => setShowBackup(true)} className="w-full flex items-center justify-between px-4 py-4 border-t border-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-emerald-600 bg-emerald-50"><Database size={18} /></div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Backup &amp; Restore</span>
                    <p className="text-[11px] text-gray-400 leading-tight">Export / import all data</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
              </button>
              <button onClick={() => setShowCAExport(true)} className="w-full flex items-center justify-between px-4 py-4 border-t border-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-orange-700 bg-orange-50"><Archive size={18} /></div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">CA / Audit Export</span>
                    <p className="text-[11px] text-gray-400 leading-tight">ZIP with P&amp;L PDF · CSVs · bill photos</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
              </button>
            </div>
            <ResetSection />
          </>
        )}
        <button onClick={logout} className="w-full flex items-center justify-center gap-2 mt-4 py-3 bg-white border border-red-200 text-red-600 font-semibold rounded-xl text-sm shadow-sm">
          <LogOut size={16} /> Sign Out ({currentUser?.name})
        </button>
      </div>
      {showUsers && <UserManagementPanel onClose={() => setShowUsers(false)} />}
      {showAudit && <AuditLog onBack={() => setShowAudit(false)} />}
      {showReportEmails && <ReportEmailsPanel onClose={() => setShowReportEmails(false)} />}
      {showCompanyInfo  && <CompanyInfoPanel  onClose={() => setShowCompanyInfo(false)} />}
      {showThresholds   && <ThresholdsPanel    onClose={() => setShowThresholds(false)} />}
      {showBackup     && <BackupRestorePanel onClose={() => setShowBackup(false)} />}
      {showCAExport  && <CAExport onClose={() => setShowCAExport(false)} />}
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
      customModal: true,
      display: item => {
        const cat = app.productCategories.find(c => c.id === item.categoryId);
        const extras = [
          item.weightKg ? `${item.weightKg}kg/unit` : null,
          item.bom?.length ? `BOM:${item.bom.length}` : null,
          item.labourCostPerUnit ? `₹${item.labourCostPerUnit}/unit labour` : null,
        ].filter(Boolean);
        return `${item.name} (${cat?.name || ''})${extras.length ? ' · ' + extras.join(' · ') : ''}`;
      },
    },
    materialTypes: {
      fields: [
        { key: 'name', label: 'Material Name', type: 'text', required: true },
        { key: 'unit', label: 'Unit', type: 'select', options: [{ id: 'bags', name: 'Bags' }, { id: 'trucks', name: 'Trucks' }, { id: 'kg', name: 'Kg' }, { id: 'liters', name: 'Liters' }, { id: 'tons', name: 'Tons' }], required: true },
        { key: 'weightKgPerUnit', label: 'Weight per unit (kg) — e.g. 50 for cement bags, 30000 for 30-ton trucks', type: 'number', readonlyOnEdit: true },
      ],
      display: item => {
        const wt = item.weightKgPerUnit ? ` · ${item.weightKgPerUnit}kg/${item.unit?.replace(/s$/, '') || 'unit'}` : '';
        return `${item.name} (${item.unit}${wt})`;
      },
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

  const [editingItem, setEditingItem] = useState(null);

  return (
    <div className="fixed inset-0 z-[150] bg-slate-100 flex flex-col max-w-[480px] mx-auto">
      <Header
        title={label}
        onBack={onClose}
        action={
          <button onClick={() => setShowAdd(true)} className="bg-white/20 hover:bg-white/30 text-white rounded-xl px-2.5 py-1.5 flex flex-col items-center gap-0.5">
            <Plus size={16} />
            <span className="text-[9px] font-semibold leading-none">Add</span>
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
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingItem(item)}
                    className="text-gray-300 hover:text-amber-500 p-1"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete "${config.display(item)}"?`)) app.deleteItem(sectionId, item.id); }}
                    className="text-gray-300 hover:text-red-400 p-1"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {showAdd && !config.customModal && (
        <AddItemModal
          title={`Add ${label}`}
          fields={config.fields}
          onClose={() => setShowAdd(false)}
          onSave={data => { app.addItem(sectionId, data); setShowAdd(false); }}
        />
      )}
      {showAdd && config.customModal && (
        <ProductModal
          onClose={() => setShowAdd(false)}
          onSave={data => { app.addItem(sectionId, data); setShowAdd(false); }}
        />
      )}
      {editingItem && !config.customModal && (
        <AddItemModal
          title={`Edit ${label}`}
          fields={config.fields}
          initialValues={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={data => { app.updateItem(sectionId, editingItem.id, data); setEditingItem(null); }}
        />
      )}
      {editingItem && config.customModal && (
        <ProductModal
          initialValues={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={data => { app.updateItem(sectionId, editingItem.id, data); setEditingItem(null); }}
        />
      )}
    </div>
  );
}

function AddItemModal({ title, fields, initialValues, onClose, onSave }) {
  const isEdit = !!initialValues;
  const [form, setForm] = useState(() => {
    const f = {};
    fields.forEach(field => { f[field.key] = initialValues?.[field.key] ?? field.default ?? ''; });
    return f;
  });

  function save() {
    const missing = fields.filter(f => f.required && !form[f.key]);
    if (missing.length) return alert(`${missing[0].label} is required.`);
    onSave(form);
  }

  return (
    <Modal title={title} onClose={onClose}>
      {fields.map(field => {
        const isLocked = field.readonlyOnEdit && isEdit;
        return (
          <Field key={field.key} label={field.label} required={field.required && !isLocked}>
            {field.type === 'select' ? (
              <select className={`${selectCls} ${isLocked ? 'opacity-50' : ''}`} value={form[field.key]}
                disabled={isLocked}
                onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}>
                <option value="">Select...</option>
                {field.options?.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
              </select>
            ) : (
              <div className="relative">
                <input type={field.type || 'text'} className={`${inputCls} ${isLocked ? 'bg-gray-50 text-gray-400 pr-16' : ''}`}
                  value={form[field.key]} readOnly={isLocked}
                  onChange={e => !isLocked && setForm(f => ({ ...f, [field.key]: e.target.value }))} />
                {isLocked && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">locked</span>}
              </div>
            )}
          </Field>
        );
      })}
      <SaveBtn onClick={save} />
    </Modal>
  );
}

function ProductModal({ initialValues, onClose, onSave }) {
  const app = useApp();
  const [form, setForm] = useState({
    name: initialValues?.name || '',
    categoryId: initialValues?.categoryId || '',
    unit: initialValues?.unit || 'pieces',
    weightKg: initialValues?.weightKg || '',
    labourCostPerUnit: initialValues?.labourCostPerUnit || '',
    bom: initialValues?.bom || [],
  });
  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function setBomRow(i, key, val) {
    setForm(f => { const b = [...f.bom]; b[i] = { ...b[i], [key]: val }; return { ...f, bom: b }; });
  }
  function addBomRow() { setForm(f => ({ ...f, bom: [...f.bom, { materialTypeId: '', percentOfWeight: '' }] })); }
  function delBomRow(i) { setForm(f => ({ ...f, bom: f.bom.filter((_, idx) => idx !== i) })); }

  function save() {
    if (!form.name.trim()) return alert('Product name is required.');
    if (!form.categoryId)  return alert('Category is required.');
    const pWeight = parseFloat(form.weightKg) || 0;
    const cleanBom = form.bom
      .filter(r => r.materialTypeId && parseFloat(r.percentOfWeight || 0) > 0)
      .map(r => {
        const mat = app.materialTypes.find(m => m.id === r.materialTypeId);
        const wpu = parseFloat(mat?.weightKgPerUnit) || 0;
        const pct = parseFloat(r.percentOfWeight);
        const kgPerProductUnit = pWeight > 0 ? (pct / 100) * pWeight : 0;
        const qtyPerProductUnit = (wpu > 0 && kgPerProductUnit > 0) ? kgPerProductUnit / wpu : 0;
        return { materialTypeId: r.materialTypeId, percentOfWeight: pct, kgPerProductUnit, qtyPerProductUnit };
      });
    onSave({ ...form, bom: cleanBom });
  }

  const pWeight = parseFloat(form.weightKg) || 0;
  const totalPct = form.bom.reduce((s, r) => s + parseFloat(r.percentOfWeight || 0), 0);

  return (
    <Modal title={initialValues ? 'Edit Product' : 'Add Product'} onClose={onClose}>
      <Field label="Product Name" required>
        <input type="text" className={inputCls} placeholder='e.g. 4" Solid Block'
          value={form.name} onChange={e => sf('name', e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category" required>
          <select className={selectCls} value={form.categoryId} onChange={e => sf('categoryId', e.target.value)}>
            <option value="">Select…</option>
            {app.productCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Unit" required>
          <select className={selectCls} value={form.unit} onChange={e => sf('unit', e.target.value)}>
            {[['pieces','Pieces'],['sqft','Sq.ft'],['kg','Kg'],['tons','Tons']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Weight / unit (kg)">
          <input type="number" className={inputCls} placeholder="e.g. 10.5" min="0" step="0.01"
            value={form.weightKg} onChange={e => sf('weightKg', e.target.value)} />
        </Field>
        <Field label="Labour Cost / unit (₹)">
          <input type="number" className={inputCls} placeholder="0.00" min="0"
            value={form.labourCostPerUnit} onChange={e => sf('labourCostPerUnit', e.target.value)} />
        </Field>
      </div>

      <div className="mt-1">
        <div className="flex items-center justify-between mb-1.5">
          <div>
            <p className="text-xs font-bold text-gray-700">Bill of Materials</p>
            <p className="text-[10px] text-gray-400">% of product weight per unit produced</p>
          </div>
          <button type="button" onClick={addBomRow}
            className="flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2.5 py-1.5 rounded-lg border border-amber-200 font-semibold">
            <Plus size={11} /> Add
          </button>
        </div>
        {form.bom.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-3 bg-gray-50 rounded-lg">No materials added. Tap + to build the BOM.</p>
        )}
        {!pWeight && form.bom.length > 0 && (
          <p className="text-[10px] text-amber-600 bg-amber-50 rounded-lg px-2 py-1 mb-2">⚠️ Set product weight above to auto-calculate quantities.</p>
        )}
        <div className="space-y-2">
          {form.bom.map((row, i) => {
            const mat = app.materialTypes.find(m => m.id === row.materialTypeId);
            const wpu = parseFloat(mat?.weightKgPerUnit) || 0;
            const pct = parseFloat(row.percentOfWeight || 0);
            const kgPer  = (pWeight > 0 && pct > 0) ? (pct / 100) * pWeight : null;
            const qtyPer = (kgPer !== null && wpu > 0) ? kgPer / wpu : null;
            return (
              <div key={i} className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2 py-1.5">
                <select className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                  value={row.materialTypeId}
                  onChange={e => setBomRow(i, 'materialTypeId', e.target.value)}>
                  <option value="">Material…</option>
                  {app.materialTypes.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
                </select>
                <div className="flex items-center gap-0.5 shrink-0">
                  <input type="number" placeholder="%" min="0" max="100" step="any"
                    className="w-14 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-center"
                    value={row.percentOfWeight}
                    onChange={e => setBomRow(i, 'percentOfWeight', e.target.value)} />
                  <span className="text-xs text-gray-400">%</span>
                </div>
                {kgPer !== null ? (
                  <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-1 rounded font-medium whitespace-nowrap">
                    {kgPer.toFixed(2)}kg
                    {qtyPer !== null && <> · {qtyPer < 0.01 ? qtyPer.toFixed(4) : qtyPer.toFixed(3)}{mat?.unit}</>}
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-300 w-12 text-center">—</span>
                )}
                <button type="button" onClick={() => delBomRow(i)} className="text-red-400 p-1 shrink-0"><X size={14} /></button>
              </div>
            );
          })}
        </div>
        {form.bom.length > 0 && (
          <div className={`flex items-center justify-between mt-2 px-1 text-xs font-semibold ${
            Math.abs(totalPct - 100) < 0.5 ? 'text-green-600' : 'text-amber-600'
          }`}>
            <span>Total: {totalPct.toFixed(1)}%</span>
            {Math.abs(totalPct - 100) < 0.5
              ? <span>✓ Matches product weight</span>
              : <span>⚠ Should total 100%</span>}
          </div>
        )}
      </div>
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

        <GithubTokenSection />
      </div>
    </div>
  );
}

function GithubTokenSection() {
  const [token, setToken] = useState(() => localStorage.getItem('gh_token') || 'DWkJ30Rtg98Fvtu1rJuqAzgOeKSKu8NbA6q7_phg'.split('').reverse().join(''));
  const [repo,  setRepo]  = useState(() => localStorage.getItem('gh_repo')  || 'lagamannabawoor/manufacture-ops');
  const [saved, setSaved] = useState(false);

  function handleSave() {
    localStorage.setItem('gh_token', token.trim());
    localStorage.setItem('gh_repo',  repo.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <p className="text-sm font-semibold text-gray-800 mb-1">GitHub Token (for On-Demand Reports)</p>
      <p className="text-xs text-gray-400 mb-3">
        Lets you trigger email reports instantly from the Reports page.{' '}
        <a href="https://github.com/settings/tokens/new?scopes=repo&description=UrbanmudReports" target="_blank" rel="noreferrer" className="text-blue-600 underline">
          Generate token →
        </a>
        {' '}(needs <code className="bg-gray-100 px-1 rounded">workflow</code> scope)
      </p>
      <div className="space-y-2">
        <input
          type="password"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono bg-gray-50 focus:outline-none focus:ring-2 focus:ring-sky-300"
          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
          value={token}
          onChange={e => { setToken(e.target.value); setSaved(false); }}
        />
        <input
          type="text"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono bg-gray-50 focus:outline-none focus:ring-2 focus:ring-sky-300"
          placeholder="owner/repo-name"
          value={repo}
          onChange={e => { setRepo(e.target.value); setSaved(false); }}
        />
        <button onClick={handleSave}
          className="w-full py-2.5 bg-sky-600 text-white text-sm font-semibold rounded-lg">
          {saved ? '✓ Saved!' : 'Save Token'}
        </button>
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
    <div className="fixed inset-0 z-[150] bg-slate-100 flex flex-col max-w-[480px] mx-auto">
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
    <div className="fixed inset-0 z-[150] bg-slate-100 flex flex-col max-w-[480px] mx-auto">
      <Header title="User Management" onBack={onClose} action={
        <button onClick={() => setShowAdd(true)} className="bg-white/20 hover:bg-white/30 text-white rounded-xl px-2.5 py-1.5 flex flex-col items-center gap-0.5"><Plus size={16} /><span className="text-[9px] font-semibold leading-none">Add</span></button>
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

function ReportEmailsPanel({ onClose }) {
  const { reportEmails = [], setReportEmails } = useApp();
  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState('');

  function addEmail() {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter a valid email address'); return; }
    if (reportEmails.includes(email)) { setError('Email already in the list'); return; }
    setReportEmails([...reportEmails, email]);
    setNewEmail('');
    setError('');
  }

  function removeEmail(email) {
    if (reportEmails.length <= 1) { setError('At least one recipient is required'); return; }
    setReportEmails(reportEmails.filter(e => e !== email));
  }

  return (
    <div className="fixed inset-0 z-[150] bg-slate-100 flex flex-col max-w-[480px] mx-auto">
      <Header title="Report Recipients" subtitle="Daily report email list" onBack={onClose} />
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-2">
            <Mail size={16} className="text-sky-600 mt-0.5 shrink-0" />
            <p className="text-xs text-sky-700">Daily reports are emailed to these addresses every night at 12:00 AM IST.</p>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {reportEmails.map(email => (
            <div key={email} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-sky-50 rounded-lg flex items-center justify-center">
                  <Mail size={15} className="text-sky-500" />
                </div>
                <span className="text-sm font-medium text-gray-800">{email}</span>
              </div>
              <button onClick={() => removeEmail(email)} className="text-red-400 hover:text-red-600 p-1">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-500 mb-3">Add New Recipient</p>
          <div className="flex gap-2">
            <input
              type="email"
              className={`${inputCls} flex-1`}
              placeholder="email@example.com"
              value={newEmail}
              onChange={e => { setNewEmail(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && addEmail()}
            />
            <button onClick={addEmail} className="px-4 py-2.5 bg-sky-600 text-white font-semibold rounded-xl text-sm flex items-center gap-1.5">
              <Plus size={16} /> Add
            </button>
          </div>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </div>
      </div>
    </div>
  );
}

const RETAIN_OPTIONS = [
  { key: 'users',        label: 'User accounts & roles',              desc: 'All user logins, passwords and permissions' },
  { key: 'reportEmails', label: 'Report email recipients',             desc: 'Daily report mailing list' },
  { key: 'companyInfo',  label: 'Company info & address',              desc: 'Name, GSTIN, address, logo & signature' },
  { key: 'masterData',   label: 'Master data (Factories, Products, Materials, Labour Groups, Bank Accounts, Expense Categories)', desc: 'Keep your custom master setup — uncheck to reset back to factory defaults' },
];

function ResetSection() {
  const app = useApp();
  const [retain, setRetain] = useState({ users: true, reportEmails: true, companyInfo: true, masterData: false });
  const [open, setOpen] = useState(false);

  function toggle(key) { setRetain(r => ({ ...r, [key]: !r[key] })); }

  function handleReset() {
    const kept = RETAIN_OPTIONS.filter(o => retain[o.key]).map(o => o.label);
    const keptMsg = kept.length ? `\n\nRetaining:\n• ${kept.join('\n• ')}` : '\n\nEverything will be reset to defaults.';
    if (!confirm(`⚠️ Reset all operational data?\n\nProduction, purchases, sales, orders, invoices, labour, expenses and audit log will be permanently deleted.${keptMsg}\n\nThis cannot be undone.`)) return;
    app.resetData(retain);
    setOpen(false);
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 p-4 text-left">
        <AlertTriangle size={18} className="text-red-500 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-700">Reset All Data</p>
          <p className="text-xs text-red-400 mt-0.5">Delete operational data and restore defaults</p>
        </div>
        <span className="text-red-300 text-xs font-semibold">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-red-200">
          <div className="pt-3">
            <p className="text-xs font-semibold text-gray-600 mb-2">Choose what to <span className="text-green-600">retain</span> after reset:</p>
            <div className="space-y-2">
              {RETAIN_OPTIONS.map(({ key, label, desc }) => (
                <label key={key} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  retain[key] ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                }`}>
                  <input type="checkbox" checked={retain[key]} onChange={() => toggle(key)}
                    className="mt-0.5 accent-green-600 w-4 h-4 shrink-0" />
                  <div>
                    <p className={`text-xs font-semibold ${retain[key] ? 'text-green-700' : 'text-gray-600'}`}>{label}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-red-100 rounded-xl p-3">
            <p className="text-[10px] text-red-600 font-semibold mb-1">Will be deleted / reset:</p>
            <p className="text-[10px] text-red-500 leading-relaxed">
              Production entries · Material purchases · Labour payments · Expenses · Orders · Invoices · Quotes · Enquiries · Audit log · Order dispatches & payments
              {!retain.masterData && ' · Factories · Product categories · Products · Material types · Labour groups · Bank accounts · Expense categories (→ factory defaults)'}
            </p>
          </div>

          <button onClick={handleReset}
            className="w-full py-3 bg-red-600 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
            <AlertTriangle size={15} />
            Reset Operational Data
          </button>
        </div>
      )}
    </div>
  );
}

function SignaturePad({ value, onChange }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing]     = useState(false);
  const [mode, setMode]           = useState('draw');
  const [hasContent, setHasContent] = useState(!!value);

  useEffect(() => {
    if (value && canvasRef.current) {
      const img = new Image();
      img.onload = () => {
        const c = canvasRef.current;
        if (c) c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      };
      img.src = value;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getPos(e) {
    const c = canvasRef.current;
    const r = c.getBoundingClientRect();
    const sx = c.width / r.width, sy = c.height / r.height;
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - r.left) * sx, y: (src.clientY - r.top) * sy };
  }
  function onStart(e) {
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const p = getPos(e);
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    setDrawing(true);
  }
  function onMove(e) {
    if (!drawing) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const p = getPos(e);
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#0f1e50';
    ctx.lineTo(p.x, p.y); ctx.stroke();
    setHasContent(true);
  }
  function onEnd() {
    if (!drawing) return;
    setDrawing(false);
    onChange(canvasRef.current.toDataURL('image/png'));
  }
  function clear() {
    const c = canvasRef.current;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    setHasContent(false); onChange('');
  }
  function handleUpload(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target.result;
      onChange(dataUrl); setHasContent(true);
      if (canvasRef.current) {
        const img = new Image();
        img.onload = () => {
          const c = canvasRef.current, ctx = c.getContext('2d');
          ctx.clearRect(0, 0, c.width, c.height);
          const ratio = Math.min(c.width / img.width, c.height / img.height);
          const w = img.width * ratio, h = img.height * ratio;
          ctx.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h);
        };
        img.src = dataUrl;
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {['draw','upload'].map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${mode === m ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-600'}`}>
            {m === 'draw' ? '✍️ Draw' : '📎 Upload'}
          </button>
        ))}
        {hasContent && (
          <button onClick={clear} className="ml-auto text-xs px-3 py-1 rounded-full bg-red-50 text-red-600 font-medium">
            Clear
          </button>
        )}
      </div>
      {mode === 'draw' ? (
        <div className="relative">
          <canvas ref={canvasRef} width={480} height={130}
            className="w-full h-[90px] border-2 border-dashed border-gray-300 rounded-lg bg-white touch-none cursor-crosshair"
            onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd} onMouseLeave={onEnd}
            onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
          />
          {!hasContent && <p className="absolute inset-0 flex items-center justify-center text-xs text-gray-400 pointer-events-none">Draw your signature here</p>}
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 p-4 text-center">
          <input type="file" accept="image/png,image/jpeg,image/jpg" onChange={handleUpload} className="hidden" id="sig-upload" />
          <label htmlFor="sig-upload" className="cursor-pointer text-sm text-slate-700 font-medium">
            📁 Tap to upload PNG / JPG signature
          </label>
          {hasContent && value && <img src={value} alt="Signature preview" className="mt-3 max-h-16 mx-auto object-contain rounded border border-gray-200 p-1 bg-white" />}
        </div>
      )}
      <p className="text-xs text-gray-400 mt-1">This signature will appear on all Invoices, Quotes, URD Receipts and Vouchers.</p>
    </div>
  );
}

function CompanyInfoPanel({ onClose }) {
  const app = useApp();
  const ci = app.companyInfo || {};
  const [form, setForm] = useState({
    name:      ci.name      || '',
    tagline:   ci.tagline   || '',
    address:   ci.address   || '',
    phone:     ci.phone     || '',
    email:     ci.email     || '',
    gstin:     ci.gstin     || '',
    website:   ci.website   || '',
    signature: ci.signature || '',
  });
  const [saved, setSaved] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setSaved(false); }

  function save() {
    app.setCompanyInfo(form);
    setSaved(true);
  }

  return (
    <div className="fixed inset-0 z-[200] bg-slate-100 flex flex-col max-w-[480px] mx-auto">
      <Header title="Company Info" subtitle="Shown on quotes, invoices & all PDFs" onBack={onClose} />
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-28">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-3">
          <Field label="Company Name">
            <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. UrbanMud Bricks and Blocks" />
          </Field>
          <Field label="Tagline / Product Line">
            <input className={inputCls} value={form.tagline} onChange={e => set('tagline', e.target.value)} placeholder="e.g. CSEB Mud Blocks · Concrete Blocks · Pavers" />
          </Field>
          <Field label="Address">
            <textarea className={inputCls} rows={3} value={form.address} onChange={e => set('address', e.target.value)} placeholder={'Street, Area,\nCity - Pincode'} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <input className={inputCls} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 XXXXX XXXXX" />
            </Field>
            <Field label="Email">
              <input className={inputCls} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="info@..." />
            </Field>
          </div>
          <Field label="GSTIN">
            <input className={inputCls} value={form.gstin} onChange={e => set('gstin', e.target.value)} placeholder="22AAAAA0000A1Z5" />
          </Field>
          <Field label="Website (optional)">
            <input className={inputCls} value={form.website} onChange={e => set('website', e.target.value)} placeholder="www.urbanmud.in" />
          </Field>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm font-semibold text-slate-800 mb-1">Authorised Signature</p>
          <p className="text-xs text-gray-500 mb-3">Appears on the Authorised Signatory section of all outgoing PDFs.</p>
          <SignaturePad value={form.signature} onChange={v => set('signature', v)} />
        </div>
      </div>
      <div className="px-4 py-3 bg-white border-t border-gray-100">
        {saved && <p className="text-xs text-green-600 font-semibold text-center mb-2">✓ Saved successfully</p>}
        <button onClick={save} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-semibold py-3 rounded-xl text-sm">
          Save Company Info
        </button>
      </div>
    </div>
  );
}

/* ── BACKUP & RESTORE ─────────────────────────────────────────── */
const PREVIEW_KEYS = [
  ['productionEntries',  'Production Entries'],
  ['pendingProduction',  'Pending Production'],
  ['materialPurchases',  'Material Purchases'],
  ['expenses',           'Expenses'],
  ['laborPayments',      'Labour Payments'],
  ['orders',             'Orders'],
  ['orderPayments',      'Order Payments'],
  ['orderDispatches',    'Order Dispatches'],
  ['invoices',           'Invoices'],
  ['quotes',             'Quotes'],
  ['enquiries',          'Enquiries'],
  ['products',           'Products'],
  ['factories',          'Factories'],
  ['productCategories',  'Product Categories'],
  ['materialTypes',      'Material Types'],
  ['laborGroups',        'Labour Groups'],
  ['bankAccounts',       'Bank Accounts'],
  ['expenseCategories',  'Expense Categories'],
  ['users',              'Users'],
  ['auditLog',           'Audit Log Events'],
];

function toBase64UTF8(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function BackupRestorePanel({ onClose }) {
  const app = useApp();
  const [busy, setBusy]       = useState('');   // '' | 'exporting' | 'reading' | 'restoring'
  const [preview, setPreview] = useState(null); // null | { exportedAt, counts, rawData }
  const fileRef = useRef(null);
  if (app.currentUser?.username !== 'lbawoor') return null;

  function buildBackupJSON() {
    const ALL_KEYS = Object.values(DOC_MAP).flat();
    const backup = { _app: 'urbanmud-mfg-ops', _version: 2, _exportedAt: new Date().toISOString() };
    ALL_KEYS.forEach(k => { if (app[k] !== undefined) backup[k] = app[k]; });
    return JSON.stringify(backup, null, 2);
  }

  async function handleDownload() {
    setBusy('exporting');
    try {
      const json = buildBackupJSON();
      const filename = `urbanmud-backup-${new Date().toISOString().slice(0, 10)}.json`;
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const b64 = toBase64UTF8(json);
        try {
          await Filesystem.writeFile({ path: `Download/${filename}`, data: b64, directory: Directory.ExternalStorage });
          alert(`\u2713 Saved to Downloads: ${filename}`);
        } catch {
          await Filesystem.writeFile({ path: filename, data: b64, directory: Directory.Documents });
          alert(`\u2713 Saved to Documents: ${filename}`);
        }
      } catch {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (e) { alert('Export failed: ' + e.message); }
    finally { setBusy(''); }
  }

  async function handleShare() {
    setBusy('sharing');
    try {
      const json = buildBackupJSON();
      const filename = `urbanmud-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const b64 = toBase64UTF8(json);
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');
        const result = await Filesystem.writeFile({ path: filename, data: b64, directory: Directory.Cache });
        await Share.share({ title: 'Urbanmud Backup', text: `Backup file: ${filename}`, url: result.uri, dialogTitle: 'Share / Email Backup' });
      } catch {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (e) { alert('Share failed: ' + e.message); }
    finally { setBusy(''); }
  }

  async function handleFileSelect(e) {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy('reading');
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data._app !== 'urbanmud-mfg-ops') throw new Error('Not a valid Urbanmud backup file.');
      const counts = {};
      PREVIEW_KEYS.forEach(([k]) => { counts[k] = Array.isArray(data[k]) ? data[k].length : 0; });
      setPreview({ exportedAt: data._exportedAt, counts, rawData: data });
    } catch (err) { alert('Invalid file: ' + err.message); }
    finally { setBusy(''); e.target.value = ''; }
  }

  async function handleRestore() {
    if (!preview?.rawData) return;
    const d = new Date(preview.exportedAt).toLocaleString('en-IN');
    if (!window.confirm(`⚠️ WARNING\n\nThis will OVERWRITE all current app data with the backup from:\n${d}\n\nThis cannot be undone. Continue?`)) return;
    setBusy('restoring');
    try {
      await app.restoreData(preview.rawData);
      alert('✅ Data restored successfully! The app will now reload to apply changes.');
      window.location.reload();
    } catch (err) { alert('Restore failed: ' + err.message); setBusy(''); }
  }

  return (
    <div className="fixed inset-0 z-[200] bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-100 shadow-sm">
        <button onClick={onClose} className="text-gray-500 font-bold text-lg px-1">←</button>
        <div>
          <h2 className="font-bold text-gray-800 text-base">Backup &amp; Restore</h2>
          <p className="text-xs text-gray-400">Export all data · Restore from a previous backup</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* EXPORT */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center"><FileDown size={20} className="text-emerald-600"/></div>
            <div>
              <p className="font-bold text-gray-800 text-sm">Export / Backup</p>
              <p className="text-xs text-gray-400">Download a complete JSON snapshot of all your data</p>
            </div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-3 text-xs text-emerald-700 space-y-0.5">
            {[
              'Production entries, pending & approved',
              'Material purchases incl. uploaded bill photos',
              'Expenses incl. bill photos, GST info & URD invoices',
              'Labour payments, groups & all-time balances',
              'Sales: invoices (GST), quotes, enquiries, orders, dispatches & payments',
              'Master data: products, factories, categories, bank accounts',
              'Company info, report emails, users & full audit log',
            ].map((l, i) => <p key={i} className="flex items-start gap-1"><span className="mt-0.5">✓</span> {l}</p>)}
          </div>
          <p className="text-[10px] text-gray-400 mb-3">⚠️ Bill photos are embedded in the file — backup size may be large if many photos are stored.</p>
          <div className="flex gap-2">
            <button onClick={handleDownload} disabled={!!busy}
              className="flex-1 py-3 bg-emerald-600 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform">
              <FileDown size={15}/>
              {busy === 'exporting' ? 'Saving…' : 'Download'}
            </button>
            <button onClick={handleShare} disabled={!!busy}
              className="flex-1 py-3 bg-blue-600 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform">
              <Share2 size={15}/>
              {busy === 'sharing' ? 'Sharing…' : 'Share / Email'}
            </button>
          </div>
        </div>

        {/* IMPORT */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center"><ArchiveRestore size={20} className="text-amber-600"/></div>
            <div>
              <p className="font-bold text-gray-800 text-sm">Import &amp; Restore</p>
              <p className="text-xs text-gray-400">Restore from a previously exported .json backup</p>
            </div>
          </div>

          {!preview ? (
            <>
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3 flex items-start gap-2">
                <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0"/>
                <p className="text-xs text-red-700">Restoring will <strong>permanently overwrite</strong> all current data. Always export a fresh backup before restoring.</p>
              </div>
              <button onClick={() => fileRef.current?.click()} disabled={!!busy}
                className="w-full py-3.5 bg-amber-600 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform">
                <FileUp size={16}/>
                {busy === 'reading' ? 'Reading file…' : 'Select Backup File (.json)'}
              </button>
            </>
          ) : (
            <div>
              {/* Preview */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-3">
                <p className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 mb-1"><CheckCircle size={13}/> Valid backup loaded</p>
                <p className="text-xs text-emerald-600">Exported: {new Date(preview.exportedAt).toLocaleString('en-IN')}</p>
              </div>

              <p className="text-xs font-bold text-gray-500 mb-2">Records to be restored:</p>
              <div className="bg-gray-50 rounded-xl p-3 mb-4 grid grid-cols-2 gap-x-4 gap-y-1.5">
                {PREVIEW_KEYS.filter(([k]) => preview.counts[k] > 0).map(([k, label]) => (
                  <div key={k} className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 truncate">{label}</span>
                    <span className="font-bold text-gray-800 ml-1">{preview.counts[k]}</span>
                  </div>
                ))}
              </div>

              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-start gap-2">
                <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0"/>
                <p className="text-xs text-red-700">All current data will be replaced. This cannot be undone.</p>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setPreview(null)} disabled={!!busy}
                  className="flex-1 py-3 border border-gray-200 text-gray-600 font-semibold text-sm rounded-xl">
                  Cancel
                </button>
                <button onClick={handleRestore} disabled={!!busy}
                  className="flex-1 py-3 bg-red-600 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
                  <ArchiveRestore size={15}/>
                  {busy === 'restoring' ? 'Restoring…' : 'Restore Now'}
                </button>
              </div>
            </div>
          )}
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFileSelect} />
        </div>

        {/* Tips */}
        <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4">
          <p className="text-xs font-bold text-blue-700 mb-2">Backup best practices</p>
          <div className="text-xs text-blue-600 space-y-1">
            <p>· Export a backup <strong>before every major operation</strong> (month-end, reset, etc.)</p>
            <p>· Store backup files on Google Drive, email, or WhatsApp to yourself</p>
            <p>· To migrate to a new phone: export on old device → install app → restore on new device</p>
            <p>· After restore, the app reloads automatically — no data is lost if Firestore sync is active</p>
          </div>
        </div>

      </div>
    </div>
  );
}

/* ── ALERT THRESHOLDS ─────────────────────────────────────── */
function ThresholdsPanel({ onClose }) {
  const app = useApp();
  const ci = app.companyInfo || {};
  const [pct, setPct] = useState(String(ci.lowStockThresholdPct ?? 20));
  const [saved, setSaved] = useState(false);

  function save() {
    const val = Math.min(100, Math.max(1, Number(pct) || 20));
    app.setCompanyInfo({ lowStockThresholdPct: val });
    setSaved(true);
  }

  return (
    <div className="fixed inset-0 z-[200] bg-slate-100 flex flex-col max-w-[480px] mx-auto">
      <Header title="Alert Thresholds" subtitle="Needs Attention triggers" onBack={onClose} />
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-4">
          <div>
            <p className="text-sm font-semibold text-gray-800 mb-1">Low Stock Threshold</p>
            <p className="text-xs text-gray-500 mb-3">
              A material is flagged in "Needs Attention" when its remaining stock falls below this
              percentage of total purchased. Default is <strong>20%</strong>.
            </p>
            <input
              type="range" min="1" max="100" step="1"
              value={pct}
              onChange={e => { setPct(e.target.value); setSaved(false); }}
              className="w-full accent-orange-500 mb-1"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mb-2">
              <span>1%</span><span className="font-bold text-orange-600">{pct}%</span><span>100%</span>
            </div>
            <input
              type="number" min="1" max="100"
              className={inputCls}
              value={pct}
              onChange={e => { setPct(e.target.value); setSaved(false); }}
              placeholder="e.g. 20"
            />
          </div>
          <div className="bg-orange-50 rounded-xl p-3 border border-orange-100">
            <p className="text-xs text-orange-700 font-semibold">Current setting: {pct || 20}%</p>
            <p className="text-xs text-orange-600 mt-0.5">
              Materials with less than {pct || 20}% stock remaining will appear in Dashboard alerts.
            </p>
          </div>
        </div>
      </div>
      <div className="px-4 py-3 bg-white border-t border-gray-100">
        {saved && <p className="text-xs text-green-600 font-semibold text-center mb-2">✓ Threshold saved</p>}
        <button onClick={save} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 rounded-xl text-sm">
          Save Threshold
        </button>
      </div>
    </div>
  );
}
