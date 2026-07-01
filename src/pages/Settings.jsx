import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import Modal, { Field, inputCls, selectCls, SaveBtn } from '../components/Modal';
import { Plus, Trash2, ChevronRight, Building2, Layers, Package, Users, CreditCard, Tag, AlertTriangle } from 'lucide-react';

export default function Settings() {
  const [section, setSection] = useState(null);
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
        <ResetSection />
      </div>
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
