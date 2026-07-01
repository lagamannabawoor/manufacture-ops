import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import Modal, { Field, inputCls, selectCls, SaveBtn } from '../components/Modal';
import { Plus, Trash2, Factory, Filter } from 'lucide-react';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmt(n) {
  return new Intl.NumberFormat('en-IN').format(n || 0);
}

const emptyForm = {
  date: today(),
  productId: '',
  factoryId: '',
  quantity: '',
  cementBags: '',
  notes: '',
};

export default function Production() {
  const app = useApp();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filterDate, setFilterDate] = useState(today());
  const [filterCat, setFilterCat] = useState('');
  const [filterFactory, setFilterFactory] = useState('');

  function set(k, v) {
    setForm(f => ({ ...f, [k]: v }));
  }

  function save() {
    if (!form.productId || !form.quantity) return alert('Product and quantity are required.');
    app.addItem('productionEntries', form);
    setForm({ ...emptyForm, date: form.date });
    setShowModal(false);
  }

  const filtered = app.productionEntries
    .filter(e => (!filterDate || e.date === filterDate))
    .filter(e => {
      if (!filterCat) return true;
      const prod = app.products.find(p => p.id === e.productId);
      return prod?.categoryId === filterCat;
    })
    .filter(e => !filterFactory || e.factoryId === filterFactory)
    .sort((a, b) => b.date.localeCompare(a.date));

  const totalUnits = filtered.reduce((s, e) => s + Number(e.quantity || 0), 0);
  const totalCement = filtered.reduce((s, e) => s + Number(e.cementBags || 0), 0);

  return (
    <div>
      <Header
        title="Production"
        subtitle="Daily manufacturing records"
        action={
          <button
            onClick={() => { setForm(emptyForm); setShowModal(true); }}
            className="bg-white/20 hover:bg-white/30 text-white rounded-full p-2"
          >
            <Plus size={20} />
          </button>
        }
      />

      <div className="px-4 py-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter size={14} className="text-gray-400" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filters</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              className={inputCls}
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
            />
            <select className={selectCls} value={filterFactory} onChange={e => setFilterFactory(e.target.value)}>
              <option value="">All Factories</option>
              {app.factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <select className={`${selectCls} col-span-2`} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
              <option value="">All Categories</option>
              {app.productCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        {(totalUnits > 0 || totalCement > 0) && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
              <p className="text-xs text-gray-500 mb-1">Total Units</p>
              <p className="text-xl font-bold text-blue-700">{fmt(totalUnits)}</p>
              <p className="text-xs text-gray-400">pieces produced</p>
            </div>
            <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
              <p className="text-xs text-gray-500 mb-1">Cement Used</p>
              <p className="text-xl font-bold text-orange-600">{fmt(totalCement)}</p>
              <p className="text-xs text-gray-400">bags consumed</p>
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-10 text-center shadow-sm border border-gray-100">
            <Factory size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 text-sm font-medium">No production entries</p>
            <p className="text-gray-400 text-xs mt-1">Tap + to add today's production</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(entry => {
              const product = app.products.find(p => p.id === entry.productId);
              const category = app.productCategories.find(c => c.id === product?.categoryId);
              const factory = app.factories.find(f => f.id === entry.factoryId);
              return (
                <div key={entry.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">
                          {category?.name || 'Uncategorized'}
                        </span>
                        {factory && (
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                            {factory.name}
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-gray-800">{product?.name || 'Unknown'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{entry.date}</p>
                      {entry.notes && <p className="text-xs text-gray-500 mt-1 italic">{entry.notes}</p>}
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-lg font-bold text-gray-800">{fmt(entry.quantity)}</p>
                      <p className="text-xs text-gray-400">units</p>
                      <p className="text-sm font-semibold text-orange-600 mt-1">{entry.cementBags} bags</p>
                    </div>
                  </div>
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={() => { if (confirm('Delete this entry?')) app.deleteItem('productionEntries', entry.id); }}
                      className="text-red-400 hover:text-red-600 p-1"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <Modal title="Add Production Entry" onClose={() => setShowModal(false)}>
          <Field label="Date" required>
            <input type="date" className={inputCls} value={form.date} onChange={e => set('date', e.target.value)} />
          </Field>
          <Field label="Product" required>
            <select className={selectCls} value={form.productId} onChange={e => set('productId', e.target.value)}>
              <option value="">Select product...</option>
              {app.productCategories.map(cat => (
                <optgroup key={cat.id} label={cat.name}>
                  {app.products
                    .filter(p => p.categoryId === cat.id)
                    .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field label="Factory">
            <select className={selectCls} value={form.factoryId} onChange={e => set('factoryId', e.target.value)}>
              <option value="">Select factory...</option>
              {app.factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity (units)" required>
              <input type="number" className={inputCls} placeholder="0" value={form.quantity}
                onChange={e => set('quantity', e.target.value)} min="0" />
            </Field>
            <Field label="Cement Bags">
              <input type="number" className={inputCls} placeholder="0" value={form.cementBags}
                onChange={e => set('cementBags', e.target.value)} min="0" />
            </Field>
          </div>
          <Field label="Notes">
            <textarea className={inputCls} rows={2} placeholder="Optional notes..." value={form.notes}
              onChange={e => set('notes', e.target.value)} />
          </Field>
          <SaveBtn onClick={save} />
        </Modal>
      )}
    </div>
  );
}
