import React, { useState, useEffect } from 'react';
import { useApp, ROLES } from '../context/AppContext';
import Header from '../components/Header';
import Modal, { Field, inputCls, selectCls, SaveBtn } from '../components/Modal';
import { Plus, Trash2, Factory, Filter, CheckCircle, XCircle, Clock, Send, Package } from 'lucide-react';
import { fmtDate, todayISO, monthRange } from '../utils/date';

function fmt(n) { return new Intl.NumberFormat('en-IN').format(n || 0); }

const emptyForm = { date: todayISO(), productId: '', factoryId: '', quantity: '', laborGroupId: '', notes: '' };

export default function Production({ initialAction, onActionConsumed }) {
  const app = useApp();
  const role = app.currentUser?.role;
  const perms = ROLES[role] || {};
  const isLabour = role === 'labour';
  const canApprove = perms.canApprove;
  const canWrite = perms.canWrite;

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (initialAction === 'new_production' && canWrite) { setShowModal(true); onActionConsumed?.(); }
  }, [initialAction]);
  const [filterFrom, setFilterFrom] = useState(() => monthRange().from);
  const [filterTo, setFilterTo]     = useState(() => monthRange().to);
  const [filterCat, setFilterCat]       = useState('');
  const [filterFactory, setFilterFactory] = useState('');
  const [filterLabour, setFilterLabour]   = useState('');
  const [filterMaterial, setFilterMaterial] = useState('');
  const [activeTab, setActiveTab] = useState('stock');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function save() {
    if (!form.productId)    return alert('Product is required.');
    if (!form.factoryId)    return alert('Factory is required.');
    if (!form.quantity)     return alert('Quantity is required.');
    if (!form.laborGroupId) return alert('Labour group is required.');
    if (!form.notes?.trim())  return alert('Notes is required.');
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
    .filter(e => !filterLabour || e.laborGroupId === filterLabour)
    .filter(e => !filterMaterial || (e.materialsUsed || []).some(mu => mu.materialTypeId === filterMaterial && mu.kgUsed > 0))
    .sort((a, b) => b.date.localeCompare(a.date));

  const totalUnits = filtered.reduce((s, e) => s + Number(e.quantity || 0), 0);

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
              className="bg-white/20 hover:bg-white/30 text-white rounded-xl px-2.5 py-1.5 flex flex-col items-center gap-0.5">
              <Plus size={16} />
              <span className="text-[9px] font-semibold leading-none">Production</span>
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
            <Field label="Factory" required>
              <select className={selectCls} value={form.factoryId} onChange={e => set('factoryId', e.target.value)}>
                <option value="">Select factory...</option>
                {app.factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantity (units)" required>
                <input type="number" className={inputCls} placeholder="0" value={form.quantity} onChange={e => set('quantity', e.target.value)} min="0" />
              </Field>
              <Field label="Labour Group" required>
                <select className={selectCls} value={form.laborGroupId} onChange={e => set('laborGroupId', e.target.value)}>
                  <option value="">Select group…</option>
                  {app.laborGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Notes" required>
              <textarea className={inputCls} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="e.g. shift details, batch info..." />
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
            <button onClick={() => { setForm(emptyForm); setShowModal(true); }}
              className="bg-white/20 hover:bg-white/30 text-white rounded-xl px-2.5 py-1.5 flex flex-col items-center gap-0.5">
              <Plus size={16} />
              <span className="text-[9px] font-semibold leading-none">Production</span>
            </button>
          )
        }
      />

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white px-4">
        {[['stock', Package, 'Stock'], ['records', Factory, 'Records']].map(([t, Icon, label]) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === t ? 'border-amber-600 text-amber-700' : 'border-transparent text-gray-500'}`}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4">
        {/* ── STOCK TAB ── */}
        {activeTab === 'stock' && (() => {
          const goods = app.products.map(prod => {
            const category = app.productCategories.find(c => c.id === prod.categoryId);
            const produced = app.productionEntries
              .filter(e => e.productId === prod.id)
              .reduce((s, e) => s + Number(e.quantity || 0), 0);
            const dispatched = app.orderDispatches
              .filter(d => {
                const order = app.orders.find(o => o.id === d.orderId);
                return order?.productId === prod.id;
              })
              .reduce((s, d) => s + Number(d.quantity || 0), 0);
            const pendingOrdered = app.orders
              .filter(o => o.productId === prod.id)
              .reduce((s, o) => s + Math.max(0, Number(o.quantity || 0) - (
                app.orderDispatches.filter(d => d.orderId === o.id).reduce((ss, d) => ss + Number(d.quantity || 0), 0)
              )), 0);
            const inStock = Math.max(0, produced - dispatched);
            const pct = produced > 0 ? Math.min(100, (inStock / produced) * 100) : 0;
            return { ...prod, category, produced, dispatched, pendingOrdered, inStock, pct };
          }).filter(p => p.produced > 0);

          if (goods.length === 0) return (
            <div className="bg-white rounded-xl p-10 text-center border border-gray-100">
              <Package size={40} className="text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-500 font-medium">No production records yet</p>
              <p className="text-xs text-gray-400 mt-1">Add production entries to see stock</p>
            </div>
          );

          return (
            <div className="space-y-2">
              {goods.map(p => (
                <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex-1 min-w-0">
                      {p.category && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">{p.category.name}</span>}
                      <p className="font-semibold text-gray-800 text-sm mt-0.5">{p.name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xl font-bold ${p.inStock > 0 ? 'text-green-700' : 'text-red-500'}`}>{fmt(p.inStock)}</p>
                      <p className="text-[10px] text-gray-400">{p.unit} in stock</p>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1.5">
                    <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${p.pct}%` }} />
                  </div>
                  {p.pendingOrdered > 0 && (
                    <div className="flex justify-end mt-0.5">
                      <span className="text-[10px] font-semibold text-red-500 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
                        {fmt(p.pendingOrdered)} pending orders
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })()}

        {/* ── RECORDS TAB ── */}
        {activeTab === 'records' && (
          <>
            {canApprove && pendingAll.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                <p className="text-xs font-bold text-amber-700 mb-2 flex items-center gap-1.5">
                  <Clock size={13} /> Pending Approvals ({pendingAll.length})
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
                          <div className="flex gap-1.5 shrink-0">
                            <button onClick={() => app.approvePendingProduction(p.id)}
                              className="text-green-600 p-1.5 bg-green-50 rounded-lg" title="Approve">
                              <CheckCircle size={18} />
                            </button>
                            <button onClick={() => { if (confirm('Reject this entry?')) app.rejectPendingProduction(p.id); }}
                              className="text-red-400 p-1.5 bg-red-50 rounded-lg" title="Reject">
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

            {/* Filter */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <Filter size={13} className="text-amber-700" />
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
                <select className={selectCls} value={filterLabour} onChange={e => setFilterLabour(e.target.value)}>
                  <option value="">All Labour Groups</option>
                  {app.laborGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <select className={selectCls} value={filterMaterial} onChange={e => setFilterMaterial(e.target.value)}>
                  <option value="">All Materials</option>
                  {app.materialTypes.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>

            {/* Entry list */}
            {filtered.length === 0 ? (
              <div className="bg-white rounded-xl p-10 text-center shadow-sm border border-gray-100">
                <Factory size={40} className="text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500 text-sm font-medium">No production entries</p>
                <p className="text-gray-400 text-xs mt-1">Tap + to add today's production</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(entry => {
                  const product  = app.products.find(p => p.id === entry.productId);
                  const category = app.productCategories.find(c => c.id === product?.categoryId);
                  const factory  = app.factories.find(f => f.id === entry.factoryId);
                  const labourGroup = app.laborGroups.find(g => g.id === entry.laborGroupId);
                  const hasMaterials = entry.materialsUsed?.some(mu => mu.kgUsed > 0);
                  return (
                    <div key={entry.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
                      {/* Row 1: category + factory chips + qty */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1 flex-1 min-w-0">
                          {category && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">{category.name}</span>}
                          {factory  && <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full">{factory.name}</span>}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-base font-bold text-gray-800">{fmt(entry.quantity)}</span>
                          <span className="text-[10px] text-gray-400 ml-1">{product?.unit || 'pcs'}</span>
                        </div>
                      </div>

                      {/* Row 2: product + date + labour charge */}
                      <div className="flex items-baseline justify-between mt-0.5">
                        <p className="font-semibold text-gray-800 text-sm leading-tight">{product?.name || 'Unknown'}</p>
                        {entry.labourAmountOwed > 0 && <span className="text-xs font-semibold text-purple-600 shrink-0 ml-2">₹{fmt(entry.labourAmountOwed)}</span>}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(entry.date)}{entry.notes ? ` · ${entry.notes}` : ''}</p>

                      {/* Row 3: materials + labour group inline */}
                      {(hasMaterials || labourGroup) && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          {hasMaterials && entry.materialsUsed.filter(mu => mu.kgUsed > 0).map((mu, idx) => {
                            const mat = app.materialTypes.find(m => m.id === mu.materialTypeId);
                            const isBagUnit = mat?.unit?.toLowerCase() === 'bags';
                            const kgDisp = isBagUnit
                              ? `${Math.round(mu.kgUsed)}Kgs (${Math.round(mu.kgUsed / 50)} Bags)`
                              : mu.kgUsed >= 1000 ? `${(mu.kgUsed/1000).toFixed(2)}T` : `${mu.kgUsed.toFixed(2)}kg`;
                            return (
                              <span key={idx} className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full border border-amber-100">
                                {mat?.name}: {kgDisp}
                              </span>
                            );
                          })}
                          {labourGroup && (
                            <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded-full border border-purple-100">
                              👷 {labourGroup.name}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Delete */}
                      {canWrite && (
                        <div className="flex justify-end mt-1">
                          <button onClick={() => { if (confirm('Delete this entry?')) app.deleteItem('productionEntries', entry.id); }}
                            className="text-gray-300 hover:text-red-400 p-1">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
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
          <Field label="Factory" required>
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
            <Field label="Labour Group" required>
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
                    const kgUsed = (b.kgPerProductUnit || 0) * qty;
                    const kgDisp = kgUsed >= 1000
                      ? `${(kgUsed / 1000).toFixed(3)} T`
                      : `${kgUsed.toFixed(2)} kg`;
                    return (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">{mat?.name || b.materialTypeId}</span>
                        <span className="font-semibold text-amber-800">{kgDisp}</span>
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
          <Field label="Notes" required>
            <textarea className={inputCls} rows={2} placeholder="e.g. shift details, batch info..." value={form.notes}
              onChange={e => set('notes', e.target.value)} />
          </Field>
          <SaveBtn onClick={save} />
        </Modal>
      )}
    </div>
  );
}
