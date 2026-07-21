import React, { useState } from 'react';
import { useApp, ROLES } from '../context/AppContext';
import Header from '../components/Header';
import Modal, { Field, inputCls, selectCls, SaveBtn } from '../components/Modal';
import { Plus, Trash2, Factory, Filter, CheckCircle, XCircle, Clock, Send } from 'lucide-react';
import { fmtDate, todayISO, monthRange } from '../utils/date';

function fmt(n) { return new Intl.NumberFormat('en-IN').format(n || 0); }

const emptyForm = { date: todayISO(), productId: '', factoryId: '', quantity: '', laborGroupId: '', notes: '' };

export default function Production() {
  const app = useApp();
  const role = app.currentUser?.role;
  const perms = ROLES[role] || {};
  const isLabour = role === 'labour';
  const canApprove = perms.canApprove;
  const canWrite = perms.canWrite;

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filterFrom, setFilterFrom] = useState(() => monthRange().from);
  const [filterTo, setFilterTo]     = useState(() => monthRange().to);
  const [filterCat, setFilterCat]   = useState('');
  const [filterFactory, setFilterFactory] = useState('');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function save() {
    if (!form.productId || !form.quantity) return alert('Product and quantity are required.');
    const product = app.products.find(p => p.id === form.productId);
    const qty = Number(form.quantity);
    const materialsUsed = (product?.bom || []).map(b => ({
      materialTypeId: b.materialTypeId,
      kgUsed:  Number(((b.kgPerProductUnit  || 0) * qty).toFixed(4)),
      qtyUsed: Number(((b.qtyPerProductUnit || 0) * qty).toFixed(6)),
    })).filter(m => m.kgUsed > 0);
    const labourAmountOwed = Number(((parseFloat(product?.labourCostPerUnit) || 0) * qty).toFixed(2));
    const entry = { ...form, qty, materialsUsed, labourAmountOwed };
    if (isLabour) {
      app.submitPendingProduction({ ...entry, unit: product?.unit || 'units' });
      alert('Submitted for approval!');
    } else {
      app.addItem('productionEntries', entry);
    }
    setForm({ ...emptyForm, date: form.date });
    setShowModal(false);
  }

  const filtered = app.productionEntries
    .filter(e => (!filterFrom || e.date >= filterFrom) && (!filterTo || e.date <= filterTo))
    .filter(e => {
      if (!filterCat) return true;
      const prod = app.products.find(p => p.id === e.productId);
      return prod?.categoryId === filterCat;
    })
    .filter(e => !filterFactory || e.factoryId === filterFactory)
    .sort((a, b) => b.date.localeCompare(a.date));

  const totalUnits = filtered.reduce((s, e) => s + Number(e.quantity || 0), 0);
  const totalLabourOwed = filtered.reduce((s, e) => s + Number(e.labourAmountOwed || 0), 0);

  const pendingMine = (app.pendingProduction || []).filter(p => p.submittedBy === app.currentUser?.id);
  const pendingAll = app.pendingProduction || [];

  if (isLabour) {
    return (
      <div>
        <Header
          title="Production"
          subtitle={`My submissions — ${fmtDate(todayISO())}`}
          action={
            <button onClick={() => { setForm({ ...emptyForm, date: todayISO() }); setShowModal(true); }}
              className="bg-white/20 hover:bg-white/30 text-white rounded-full p-2">
              <Plus size={20} />
            </button>
          }
        />
        <div className="px-4 py-4 space-y-3">
          {pendingMine.length === 0 && (
            <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-gray-100">
              <Send size={36} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 text-sm font-medium">No pending submissions</p>
              <p className="text-gray-400 text-xs mt-1">Tap + to submit today's production</p>
            </div>
          )}
          {pendingMine.map(p => {
            const product = app.products.find(pr => pr.id === p.productId);
            return (
              <div key={p.id} className="bg-white rounded-xl shadow-sm border border-amber-100 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock size={14} className="text-amber-500" />
                  <span className="text-xs font-semibold text-amber-600">Pending Approval</span>
                </div>
                <p className="font-semibold text-gray-800">{product?.name || 'Unknown'}</p>
                <p className="text-xs text-gray-400">{fmtDate(p.date)} · {p.quantity} units{p.laborGroupId ? ` · ${app.laborGroups.find(g => g.id === p.laborGroupId)?.name || ''}` : ''}</p>
                {p.notes && <p className="text-xs text-gray-500 mt-1 italic">{p.notes}</p>}
              </div>
            );
          })}
        </div>
        {showModal && (
          <Modal title="Submit Production Entry" onClose={() => setShowModal(false)}>
            <Field label="Date" required>
              <input type="date" className={inputCls} value={form.date} onChange={e => set('date', e.target.value)} />
            </Field>
            <Field label="Product" required>
              <select className={selectCls} value={form.productId} onChange={e => set('productId', e.target.value)}>
                <option value="">Select product...</option>
                {app.productCategories.map(cat => (
                  <optgroup key={cat.id} label={cat.name}>
                    {app.products.filter(p => p.categoryId === cat.id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
                <input type="number" className={inputCls} placeholder="0" value={form.quantity} onChange={e => set('quantity', e.target.value)} min="0" />
              </Field>
              <Field label="Labour Group">
                <select className={selectCls} value={form.laborGroupId} onChange={e => set('laborGroupId', e.target.value)}>
                  <option value="">Select group…</option>
                  {app.laborGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Notes">
              <textarea className={inputCls} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional notes..." />
            </Field>
            <SaveBtn onClick={save} label="Submit for Approval" />
          </Modal>
        )}
      </div>
    );
  }

  return (
    <div>
      <Header
        title="Production"
        subtitle="Daily manufacturing records"
        action={
          (canWrite || canApprove) && (
            <button
              onClick={() => { setForm(emptyForm); setShowModal(true); }}
              className="bg-white/20 hover:bg-white/30 text-white rounded-full p-2"
            >
              <Plus size={20} />
            </button>
          )
        }
      />

      <div className="px-4 py-4">
        {canApprove && pendingAll.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            <p className="text-xs font-bold text-amber-700 mb-3 flex items-center gap-1.5">
              <Clock size={14} /> Pending Approvals ({pendingAll.length})
            </p>
            <div className="space-y-2">
              {pendingAll.map(p => {
                const product = app.products.find(pr => pr.id === p.productId);
                const factory = app.factories.find(f => f.id === p.factoryId);
                return (
                  <div key={p.id} className="bg-white rounded-xl p-3 border border-amber-100">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-700">{product?.name || 'Unknown'}</p>
                        <p className="text-xs text-gray-400">{fmtDate(p.date)} · {fmt(p.quantity)} units{p.laborGroupId ? ` · ${app.laborGroups.find(g => g.id === p.laborGroupId)?.name || ''}` : ''}</p>
                        <p className="text-xs text-amber-600 mt-0.5">By: {p.submittedByName} · {factory?.name || ''}</p>
                        {p.notes && <p className="text-xs text-gray-500 italic mt-0.5">{p.notes}</p>}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => app.approvePendingProduction(p.id)}
                          className="text-green-600 hover:text-green-800 p-1.5 bg-green-50 rounded-lg" title="Approve">
                          <CheckCircle size={18} />
                        </button>
                        <button onClick={() => { if (confirm('Reject this entry?')) app.rejectPendingProduction(p.id); }}
                          className="text-red-400 hover:text-red-600 p-1.5 bg-red-50 rounded-lg" title="Reject">
                          <XCircle size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter size={14} className="text-amber-700" />
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Filter</span>
            <span className="ml-auto text-xs text-gray-400">{filtered.length} entr{filtered.length !== 1 ? 'ies' : 'y'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" className={inputCls} value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
            <input type="date" className={inputCls} value={filterTo}   onChange={e => setFilterTo(e.target.value)} />
            <select className={selectCls} value={filterFactory} onChange={e => setFilterFactory(e.target.value)}>
              <option value="">All Factories</option>
              {app.factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <select className={selectCls} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
              <option value="">All Categories</option>
              {app.productCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        {totalUnits > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
              <p className="text-xs text-gray-500 mb-1">Total Units</p>
              <p className="text-xl font-bold text-blue-700">{fmt(totalUnits)}</p>
              <p className="text-xs text-gray-400">produced</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
              <p className="text-xs text-gray-500 mb-1">Labour Owed</p>
              <p className="text-xl font-bold text-purple-600">₹{fmt(totalLabourOwed)}</p>
              <p className="text-xs text-gray-400">this period</p>
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
                      <p className="text-xs text-gray-400 mt-0.5">{fmtDate(entry.date)}</p>
                      {entry.notes && <p className="text-xs text-gray-500 mt-1 italic">{entry.notes}</p>}
                      {entry.materialsUsed?.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {entry.materialsUsed.map((mu, idx) => {
                            const mat = app.materialTypes.find(m => m.id === mu.materialTypeId);
                            return (
                              <span key={idx} className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full border border-amber-100">
                                {mat?.name}: {mu.qtyUsed.toFixed ? mu.qtyUsed.toFixed(3) : mu.qtyUsed} {mat?.unit}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      {entry.laborGroupId && (
                        <p className="text-xs text-purple-600 mt-0.5">Labour: {app.laborGroups.find(g => g.id === entry.laborGroupId)?.name || ''}</p>
                      )}
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-lg font-bold text-gray-800">{fmt(entry.quantity)}</p>
                      <p className="text-xs text-gray-400">{app.products.find(p => p.id === entry.productId)?.unit || 'units'}</p>
                      {entry.labourAmountOwed > 0 && <p className="text-xs font-semibold text-purple-600 mt-1">₹{fmt(entry.labourAmountOwed)}</p>}
                    </div>
                  </div>
                  {canWrite && (
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={() => { if (confirm('Delete this entry?')) app.deleteItem('productionEntries', entry.id); }}
                        className="text-red-400 hover:text-red-600 p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
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
            <Field label="Labour Group">
              <select className={selectCls} value={form.laborGroupId} onChange={e => set('laborGroupId', e.target.value)}>
                <option value="">Select group…</option>
                {app.laborGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </Field>
          </div>
          {form.productId && Number(form.quantity) > 0 && (() => {
            const prod = app.products.find(p => p.id === form.productId);
            const qty  = Number(form.quantity);
            const bom  = prod?.bom || [];
            if (!bom.length && !prod?.labourCostPerUnit) return null;
            return (
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                <p className="text-xs font-bold text-amber-700 mb-2">Materials to be deducted:</p>
                <div className="space-y-1">
                  {bom.map((b, i) => {
                    const mat = app.materialTypes.find(m => m.id === b.materialTypeId);
                    const qtyUsed = (b.qtyPerProductUnit || 0) * qty;
                    const kgUsed  = (b.kgPerProductUnit  || 0) * qty;
                    return (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">{mat?.name || b.materialTypeId}</span>
                        <span className="font-semibold text-amber-800">{qtyUsed.toFixed(3)} {mat?.unit} ({kgUsed.toFixed(2)}kg)</span>
                      </div>
                    );
                  })}
                </div>
                {prod?.labourCostPerUnit > 0 && (
                  <p className="text-xs text-purple-700 font-semibold mt-2 pt-2 border-t border-amber-200">
                    Labour owed: ₹{fmt((parseFloat(prod.labourCostPerUnit) * qty))}
                  </p>
                )}
              </div>
            );
          })()}
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
