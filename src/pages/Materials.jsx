import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import Modal, { Field, inputCls, selectCls, SaveBtn } from '../components/Modal';
import { Plus, Trash2, Package, TrendingDown } from 'lucide-react';
import { fmtDate, todayISO } from '../utils/date';

function fmt(n) {
  return new Intl.NumberFormat('en-IN').format(n || 0);
}

function genBillId() {
  const now = new Date();
  const d = now.toISOString().slice(0, 10).replace(/-/g, '');
  const t = (now.getTime() % 100000).toString().padStart(5, '0');
  return `BILL-${d}-${t}`;
}

function freshForm() {
  return {
    date: todayISO(),
    materialTypeId: '',
    quantity: '',
    ratePerUnit: '',
    totalAmount: '',
    supplier: '',
    bankAccountId: '',
    billNumber: genBillId(),
    notes: '',
  };
}

export default function Materials() {
  const app = useApp();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(freshForm);
  const [activeTab, setActiveTab] = useState('stock');

  function set(k, v) {
    setForm(f => {
      const updated = { ...f, [k]: v };
      if (k === 'quantity' || k === 'ratePerUnit') {
        const qty = parseFloat(k === 'quantity' ? v : f.quantity) || 0;
        const rate = parseFloat(k === 'ratePerUnit' ? v : f.ratePerUnit) || 0;
        if (qty > 0 && rate > 0) updated.totalAmount = String(qty * rate);
      }
      return updated;
    });
  }

  function save() {
    if (!form.materialTypeId || !form.quantity) return alert('Material type and quantity are required.');
    app.addItem('materialPurchases', form);
    setForm({ ...freshForm(), date: form.date });
    setShowModal(false);
  }

  function getStock(materialTypeId) {
    const purchased = app.materialPurchases
      .filter(p => p.materialTypeId === materialTypeId)
      .reduce((s, p) => s + Number(p.quantity || 0), 0);

    if (materialTypeId === 'm1') {
      const used = app.productionEntries.reduce((s, e) => s + Number(e.cementBags || 0), 0);
      return purchased - used;
    }
    return purchased;
  }

  const sortedPurchases = [...app.materialPurchases].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <Header
        title="Raw Materials"
        subtitle="Stock & purchase tracking"
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
        <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
          {['stock', 'purchases'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors capitalize ${
                activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              {tab === 'stock' ? 'Stock Levels' : 'Purchase History'}
            </button>
          ))}
        </div>

        {activeTab === 'stock' && (
          <div className="space-y-3">
            {app.materialTypes.map(mat => {
              const stock = getStock(mat.id);
              const isCement = mat.id === 'm1';
              const purchased = app.materialPurchases
                .filter(p => p.materialTypeId === mat.id)
                .reduce((s, p) => s + Number(p.quantity || 0), 0);
              const used = isCement
                ? app.productionEntries.reduce((s, e) => s + Number(e.cementBags || 0), 0)
                : 0;
              return (
                <div key={mat.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                        <Package size={18} className="text-amber-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{mat.name}</p>
                        <p className="text-xs text-gray-400">Unit: {mat.unit}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-bold ${stock > 0 ? 'text-gray-800' : 'text-red-600'}`}>
                        {fmt(stock)}
                      </p>
                      <p className="text-xs text-gray-400">{mat.unit} in stock</p>
                    </div>
                  </div>
                  {(purchased > 0 || isCement) && (
                    <div className="mt-3 pt-3 border-t border-gray-50 flex gap-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-400">Purchased: </span>
                        <span className="text-xs font-semibold text-green-700">{fmt(purchased)} {mat.unit}</span>
                      </div>
                      {isCement && used > 0 && (
                        <div className="flex items-center gap-1.5">
                          <TrendingDown size={12} className="text-red-400" />
                          <span className="text-xs text-gray-400">Used: </span>
                          <span className="text-xs font-semibold text-red-600">{fmt(used)} bags</span>
                        </div>
                      )}
                    </div>
                  )}
                  {isCement && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-amber-500 h-2 rounded-full transition-all"
                          style={{ width: purchased > 0 ? `${Math.min(100, (stock / purchased) * 100)}%` : '0%' }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {purchased > 0 ? `${Math.round((stock / purchased) * 100)}% remaining` : 'No purchases yet'}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'purchases' && (
          <div>
            {sortedPurchases.length === 0 ? (
              <div className="bg-white rounded-xl p-10 text-center shadow-sm border border-gray-100">
                <Package size={40} className="text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500 text-sm font-medium">No purchases recorded</p>
                <p className="text-gray-400 text-xs mt-1">Tap + to add a material purchase</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedPurchases.map(p => {
                  const mat = app.materialTypes.find(m => m.id === p.materialTypeId);
                  const account = app.bankAccounts.find(b => b.id === p.bankAccountId);
                  return (
                    <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800">{mat?.name || 'Unknown'}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{fmtDate(p.date)}</p>
                          {p.supplier && <p className="text-xs text-gray-500 mt-1">Supplier: {p.supplier}</p>}
                          {p.billNumber && <p className="text-xs text-gray-500">Bill #: {p.billNumber}</p>}
                          {account && <p className="text-xs text-gray-500">Via: {account.name}</p>}
                        </div>
                        <div className="text-right ml-3">
                          <p className="text-lg font-bold text-gray-800">{fmt(p.quantity)}</p>
                          <p className="text-xs text-gray-400">{mat?.unit}</p>
                          {p.ratePerUnit && <p className="text-xs text-gray-400">@ ₹{fmt(p.ratePerUnit)}/{app.materialTypes.find(m=>m.id===p.materialTypeId)?.unit||'unit'}</p>}
                          {p.totalAmount && (
                            <p className="text-sm font-semibold text-red-600 mt-1">₹{fmt(p.totalAmount)}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={() => { if (confirm('Delete this purchase?')) app.deleteItem('materialPurchases', p.id); }}
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
        )}
      </div>

      {showModal && (
        <Modal title="Add Material Purchase" onClose={() => setShowModal(false)}>
          <Field label="Date" required>
            <input type="date" className={inputCls} value={form.date} onChange={e => set('date', e.target.value)} />
          </Field>
          <Field label="Material Type" required>
            <select className={selectCls} value={form.materialTypeId} onChange={e => set('materialTypeId', e.target.value)}>
              <option value="">Select material...</option>
              {app.materialTypes.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
              ))}
            </select>
          </Field>
          {(() => {
            const mat = app.materialTypes.find(m => m.id === form.materialTypeId);
            const unitLabel = mat?.unit || 'unit';
            return (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Quantity" required>
                    <input type="number" className={inputCls} placeholder="0" value={form.quantity}
                      onChange={e => set('quantity', e.target.value)} min="0" />
                  </Field>
                  <Field label={`Rate per ${unitLabel} (₹)`}>
                    <input type="number" className={inputCls} placeholder="0" value={form.ratePerUnit}
                      onChange={e => set('ratePerUnit', e.target.value)} min="0" />
                  </Field>
                </div>
                <Field label="Total Amount (₹) — auto-calculated">
                  <input type="number" className={inputCls} placeholder="Auto-filled or enter manually" value={form.totalAmount}
                    onChange={e => set('totalAmount', e.target.value)} min="0" />
                </Field>
              </>
            );
          })()}
          <Field label="Supplier">
            <input type="text" className={inputCls} placeholder="Supplier name..." value={form.supplier}
              onChange={e => set('supplier', e.target.value)} />
          </Field>
          <Field label="Bill Number (auto-generated)">
            <input type="text" className={inputCls} value={form.billNumber}
              onChange={e => set('billNumber', e.target.value)} />
          </Field>
          <Field label="Payment Account">
            <select className={selectCls} value={form.bankAccountId} onChange={e => set('bankAccountId', e.target.value)}>
              <option value="">Select account...</option>
              {app.bankAccounts.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
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
