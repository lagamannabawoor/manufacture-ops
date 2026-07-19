import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import Modal, { Field, inputCls, selectCls, SaveBtn } from '../components/Modal';
import { Plus, Trash2, Users, ShoppingBag, Receipt, ChevronRight, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { fmtDate, todayISO } from '../utils/date';

function fmt(n) { return new Intl.NumberFormat('en-IN').format(n || 0); }

function genOrderId() {
  const now = new Date();
  const d = now.toISOString().slice(0, 10).replace(/-/g, '');
  const t = (now.getTime() % 100000).toString().padStart(5, '0');
  return `ORD-${d}-${t}`;
}

export default function Finance() {
  const [tab, setTab] = useState('orders');
  const tabs = [
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'labor', label: 'Labour', icon: Users },
  ];
  return (
    <div>
      <Header title="Finance" subtitle="Orders · Expenses · Labour" />
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 pt-2 pb-0">
        <div className="flex gap-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                tab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400'
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>
      <div>
        {tab === 'orders' && <OrdersTab />}
        {tab === 'expenses' && <ExpensesTab />}
        {tab === 'labor' && <LaborTab />}
      </div>
    </div>
  );
}

/* ── LABOR ─────────────────────────────────────────────── */
function LaborTab() {
  const app = useApp();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ date: todayISO(), laborGroupId: '', amount: '', paymentType: 'regular', bankAccountId: '', notes: '' });
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function save() {
    if (!form.laborGroupId || !form.amount) return alert('Group and amount required.');
    app.addItem('laborPayments', form);
    setForm(f => ({ ...f, laborGroupId: '', amount: '', notes: '' }));
    setShowModal(false);
  }

  const sorted = [...app.laborPayments].sort((a, b) => b.date.localeCompare(a.date));

  const groupTotals = app.laborGroups.map(g => ({
    ...g,
    total: app.laborPayments.filter(p => p.laborGroupId === g.id).reduce((s, p) => s + Number(p.amount || 0), 0),
    advance: app.laborPayments.filter(p => p.laborGroupId === g.id && p.paymentType === 'advance').reduce((s, p) => s + Number(p.amount || 0), 0),
  }));

  return (
    <div className="px-4 py-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-semibold text-gray-700">Labor Group Summary</h2>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1 bg-blue-600 text-white text-xs font-semibold px-3 py-2 rounded-xl">
          <Plus size={14} /> Add Payment
        </button>
      </div>

      <div className="space-y-3 mb-5">
        {groupTotals.map(g => (
          <div key={g.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                  <Users size={18} className="text-purple-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{g.name}</p>
                  <p className="text-xs text-gray-400">Advance: ₹{fmt(g.advance)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-gray-800">₹{fmt(g.total)}</p>
                <p className="text-xs text-gray-400">total paid</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-sm font-semibold text-gray-700 mb-3">Payment History</h2>
      {sorted.length === 0 ? (
        <EmptyState icon={<Users size={36} className="text-gray-200" />} msg="No labor payments yet" />
      ) : (
        <div className="space-y-2">
          {sorted.map(p => {
            const group = app.laborGroups.find(g => g.id === p.laborGroupId);
            const account = app.bankAccounts.find(b => b.id === p.bankAccountId);
            const typeColors = { regular: 'bg-green-50 text-green-700', advance: 'bg-amber-50 text-amber-700', installment: 'bg-blue-50 text-blue-700' };
            return (
              <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-gray-800">{group?.name || 'Unknown'}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${typeColors[p.paymentType] || 'bg-gray-100 text-gray-600'}`}>
                      {p.paymentType}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{fmtDate(p.date)} {account ? `· ${account.name}` : ''}</p>
                  {p.notes && <p className="text-xs text-gray-500 mt-1">{p.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-base font-bold text-red-600">₹{fmt(p.amount)}</p>
                  <button onClick={() => { if (confirm('Delete?')) app.deleteItem('laborPayments', p.id); }} className="text-gray-300 hover:text-red-400 p-1">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <Modal title="Add Labor Payment" onClose={() => setShowModal(false)}>
          <Field label="Date" required><input type="date" className={inputCls} value={form.date} onChange={e => set('date', e.target.value)} /></Field>
          <Field label="Labor Group" required>
            <select className={selectCls} value={form.laborGroupId} onChange={e => set('laborGroupId', e.target.value)}>
              <option value="">Select group...</option>
              {app.laborGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </Field>
          <Field label="Payment Type" required>
            <select className={selectCls} value={form.paymentType} onChange={e => set('paymentType', e.target.value)}>
              <option value="regular">Regular Payment</option>
              <option value="advance">Advance</option>
              <option value="installment">Installment</option>
            </select>
          </Field>
          <Field label="Amount (₹)" required><input type="number" className={inputCls} placeholder="0" value={form.amount} onChange={e => set('amount', e.target.value)} min="0" /></Field>
          <Field label="Bank Account">
            <select className={selectCls} value={form.bankAccountId} onChange={e => set('bankAccountId', e.target.value)}>
              <option value="">Select account...</option>
              {app.bankAccounts.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Notes"><textarea className={inputCls} rows={2} placeholder="Optional notes..." value={form.notes} onChange={e => set('notes', e.target.value)} /></Field>
          <SaveBtn onClick={save} />
        </Modal>
      )}
    </div>
  );
}

/* ── ORDERS ─────────────────────────────────────────────── */
function OrdersTab() {
  const app = useApp();
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderForm, setOrderForm] = useState(() => ({ orderNumber: genOrderId(), customerName: '', customerPhone: '', productId: '', quantity: '', unitPrice: '', deliveryDate: '', notes: '' }));
  const [payForm, setPayForm] = useState({ date: todayISO(), orderId: '', amount: '', direction: 'received', bankAccountId: '', notes: '' });

  function setOF(k, v) { setOrderForm(f => ({ ...f, [k]: v })); }
  function setPF(k, v) { setPayForm(f => ({ ...f, [k]: v })); }

  function saveOrder() {
    if (!orderForm.customerName || !orderForm.productId || !orderForm.quantity) return alert('Customer, product, and quantity required.');
    const total = Number(orderForm.quantity) * Number(orderForm.unitPrice || 0);
    app.addItem('orders', { ...orderForm, totalAmount: total, status: 'pending' });
    setOrderForm({ orderNumber: genOrderId(), customerName: '', customerPhone: '', productId: '', quantity: '', unitPrice: '', deliveryDate: '', notes: '' });
    setShowOrderModal(false);
  }

  function savePayment() {
    if (!payForm.orderId || !payForm.amount) return alert('Order and amount required.');
    app.addItem('orderPayments', payForm);
    setPF('amount', ''); setPF('notes', '');
    setShowPayModal(false);
  }

  const sorted = [...app.orders].sort((a, b) => (b.id > a.id ? 1 : -1));
  const statusColors = { pending: 'bg-amber-50 text-amber-700', in_progress: 'bg-blue-50 text-blue-700', completed: 'bg-green-50 text-green-700' };

  return (
    <div className="px-4 py-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-semibold text-gray-700">Orders</h2>
        <div className="flex gap-2">
          <button onClick={() => { setPayForm(f => ({ ...f, orderId: '' })); setShowPayModal(true); }} className="flex items-center gap-1 bg-green-600 text-white text-xs font-semibold px-3 py-2 rounded-xl">
            <ArrowDownCircle size={14} /> Payment
          </button>
          <button onClick={() => setShowOrderModal(true)} className="flex items-center gap-1 bg-blue-600 text-white text-xs font-semibold px-3 py-2 rounded-xl">
            <Plus size={14} /> Order
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <EmptyState icon={<ShoppingBag size={36} className="text-gray-200" />} msg="No orders yet" />
      ) : (
        <div className="space-y-3">
          {sorted.map(order => {
            const product = app.products.find(p => p.id === order.productId);
            const payments = app.orderPayments.filter(p => p.orderId === order.id);
            const received = payments.filter(p => p.direction === 'received').reduce((s, p) => s + Number(p.amount || 0), 0);
            const paid = payments.filter(p => p.direction === 'paid').reduce((s, p) => s + Number(p.amount || 0), 0);
            const balance = Number(order.totalAmount || 0) - received;
            return (
              <div key={order.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {order.orderNumber && <span className="text-xs text-gray-400">#{order.orderNumber}</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusColors[order.status] || 'bg-gray-100 text-gray-600'}`}>
                        {order.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="font-semibold text-gray-800">{order.customerName}</p>
                    {order.customerPhone && <p className="text-xs text-gray-400">{order.customerPhone}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold text-gray-800">₹{fmt(order.totalAmount)}</p>
                    <p className="text-xs text-green-600">Rcvd: ₹{fmt(received)}</p>
                    {balance > 0 && <p className="text-xs text-red-500">Due: ₹{fmt(balance)}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 border-t border-gray-50 pt-2">
                  <span>{product?.name || 'Unknown'} · {fmt(order.quantity)} units</span>
                  {order.deliveryDate && <span>· Delivery: {order.deliveryDate}</span>}
                </div>
                <div className="flex gap-2 mt-3">
                  <select
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                    value={order.status}
                    onChange={e => app.updateItem('orders', order.id, { status: e.target.value })}
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                  <button
                    onClick={() => { setPayForm(f => ({ ...f, orderId: order.id })); setShowPayModal(true); }}
                    className="flex items-center gap-1 bg-green-50 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-green-200"
                  >
                    <ArrowDownCircle size={12} /> Add Payment
                  </button>
                  <button onClick={() => { if (confirm('Delete order?')) app.deleteItem('orders', order.id); }} className="text-gray-300 hover:text-red-400 p-1">
                    <Trash2 size={15} />
                  </button>
                </div>
                {payments.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-gray-50 space-y-1">
                    {payments.slice(-3).map(p => (
                      <div key={p.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">{fmtDate(p.date)}</span>
                        <span className={p.direction === 'received' ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                          {p.direction === 'received' ? '+' : '-'}₹{fmt(p.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showOrderModal && (
        <Modal title="Add New Order" onClose={() => setShowOrderModal(false)}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Order ID (auto-generated)"><input type="text" className={inputCls} value={orderForm.orderNumber} onChange={e => setOF('orderNumber', e.target.value)} /></Field>
            <Field label="Delivery Date"><input type="date" className={inputCls} value={orderForm.deliveryDate} onChange={e => setOF('deliveryDate', e.target.value)} /></Field>
          </div>
          <Field label="Customer Name" required><input type="text" className={inputCls} placeholder="Customer name..." value={orderForm.customerName} onChange={e => setOF('customerName', e.target.value)} /></Field>
          <Field label="Phone"><input type="tel" className={inputCls} placeholder="Phone number..." value={orderForm.customerPhone} onChange={e => setOF('customerPhone', e.target.value)} /></Field>
          <Field label="Product" required>
            <select className={selectCls} value={orderForm.productId} onChange={e => setOF('productId', e.target.value)}>
              <option value="">Select product...</option>
              {app.productCategories.map(cat => (
                <optgroup key={cat.id} label={cat.name}>
                  {app.products.filter(p => p.categoryId === cat.id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </optgroup>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity" required><input type="number" className={inputCls} placeholder="0" value={orderForm.quantity} onChange={e => setOF('quantity', e.target.value)} min="0" /></Field>
            <Field label="Unit Price (₹)"><input type="number" className={inputCls} placeholder="0.00" value={orderForm.unitPrice} onChange={e => setOF('unitPrice', e.target.value)} min="0" /></Field>
          </div>
          {orderForm.quantity && orderForm.unitPrice && (
            <div className="bg-blue-50 rounded-lg p-3 mb-3 text-sm">
              <span className="text-gray-600">Total: </span>
              <span className="font-bold text-blue-700">₹{fmt(Number(orderForm.quantity) * Number(orderForm.unitPrice))}</span>
            </div>
          )}
          <Field label="Notes"><textarea className={inputCls} rows={2} placeholder="Optional notes..." value={orderForm.notes} onChange={e => setOF('notes', e.target.value)} /></Field>
          <SaveBtn onClick={saveOrder} label="Create Order" />
        </Modal>
      )}

      {showPayModal && (
        <Modal title="Record Payment" onClose={() => setShowPayModal(false)}>
          <Field label="Date" required><input type="date" className={inputCls} value={payForm.date} onChange={e => setPF('date', e.target.value)} /></Field>
          <Field label="Order" required>
            <select className={selectCls} value={payForm.orderId} onChange={e => setPF('orderId', e.target.value)}>
              <option value="">Select order...</option>
              {app.orders.map(o => <option key={o.id} value={o.id}>{o.customerName} — ₹{fmt(o.totalAmount)}</option>)}
            </select>
          </Field>
          <Field label="Direction" required>
            <select className={selectCls} value={payForm.direction} onChange={e => setPF('direction', e.target.value)}>
              <option value="received">Payment Received (from customer)</option>
              <option value="paid">Payment Made (to supplier/other)</option>
            </select>
          </Field>
          <Field label="Amount (₹)" required><input type="number" className={inputCls} placeholder="0" value={payForm.amount} onChange={e => setPF('amount', e.target.value)} min="0" /></Field>
          <Field label="Bank Account">
            <select className={selectCls} value={payForm.bankAccountId} onChange={e => setPF('bankAccountId', e.target.value)}>
              <option value="">Select account...</option>
              {app.bankAccounts.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Notes"><textarea className={inputCls} rows={2} value={payForm.notes} onChange={e => setPF('notes', e.target.value)} /></Field>
          <SaveBtn onClick={savePayment} label="Record Payment" />
        </Modal>
      )}
    </div>
  );
}

/* ── EXPENSES ─────────────────────────────────────────────── */
function ExpensesTab() {
  const app = useApp();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ date: todayISO(), categoryId: '', description: '', amount: '', bankAccountId: '', hasGST: false, gstAmount: '', notes: '' });
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function save() {
    if (!form.categoryId || !form.amount) return alert('Category and amount required.');
    app.addItem('expenses', form);
    setForm(f => ({ ...f, categoryId: '', description: '', amount: '', gstAmount: '', hasGST: false, notes: '' }));
    setShowModal(false);
  }

  const sorted = [...app.expenses].sort((a, b) => b.date.localeCompare(a.date));
  const totalToday = app.expenses.filter(e => e.date === todayISO()).reduce((s, e) => s + Number(e.amount || 0), 0);

  return (
    <div className="px-4 py-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">Other Expenses</h2>
          <p className="text-xs text-gray-400">Today: ₹{fmt(totalToday)}</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1 bg-blue-600 text-white text-xs font-semibold px-3 py-2 rounded-xl">
          <Plus size={14} /> Add Expense
        </button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState icon={<Receipt size={36} className="text-gray-200" />} msg="No expenses recorded" />
      ) : (
        <div className="space-y-2">
          {sorted.map(e => {
            const cat = app.expenseCategories.find(c => c.id === e.categoryId);
            const account = app.bankAccounts.find(b => b.id === e.bankAccountId);
            return (
              <div key={e.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 bg-red-50 text-red-700 rounded-full font-medium">{cat?.name || 'Other'}</span>
                    {e.hasGST && <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full">GST</span>}
                  </div>
                  <p className="text-sm font-medium text-gray-800">{e.description || cat?.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{fmtDate(e.date)} {account ? `· ${account.name}` : ''}</p>
                  {e.hasGST && e.gstAmount && <p className="text-xs text-purple-600 mt-0.5">GST: ₹{fmt(e.gstAmount)}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-base font-bold text-red-600">₹{fmt(e.amount)}</p>
                  <button onClick={() => { if (confirm('Delete?')) app.deleteItem('expenses', e.id); }} className="text-gray-300 hover:text-red-400 p-1">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <Modal title="Add Expense" onClose={() => setShowModal(false)}>
          <Field label="Date" required><input type="date" className={inputCls} value={form.date} onChange={e => set('date', e.target.value)} /></Field>
          <Field label="Category" required>
            <select className={selectCls} value={form.categoryId} onChange={e => set('categoryId', e.target.value)}>
              <option value="">Select category...</option>
              {app.expenseCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Description"><input type="text" className={inputCls} placeholder="e.g. June electricity bill" value={form.description} onChange={e => set('description', e.target.value)} /></Field>
          <Field label="Amount (₹)" required><input type="number" className={inputCls} placeholder="0" value={form.amount} onChange={e => set('amount', e.target.value)} min="0" /></Field>
          <Field label="Bank Account">
            <select className={selectCls} value={form.bankAccountId} onChange={e => set('bankAccountId', e.target.value)}>
              <option value="">Select account...</option>
              {app.bankAccounts.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <div className="flex items-center gap-3 mb-4">
            <input type="checkbox" id="hasGST" checked={form.hasGST} onChange={e => set('hasGST', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
            <label htmlFor="hasGST" className="text-sm text-gray-700">Includes GST</label>
          </div>
          {form.hasGST && (
            <Field label="GST Amount (₹)"><input type="number" className={inputCls} placeholder="0" value={form.gstAmount} onChange={e => set('gstAmount', e.target.value)} min="0" /></Field>
          )}
          <Field label="Notes"><textarea className={inputCls} rows={2} placeholder="Optional notes..." value={form.notes} onChange={e => set('notes', e.target.value)} /></Field>
          <SaveBtn onClick={save} />
        </Modal>
      )}
    </div>
  );
}

function EmptyState({ icon, msg }) {
  return (
    <div className="bg-white rounded-xl p-10 text-center shadow-sm border border-gray-100">
      <div className="flex justify-center mb-3">{icon}</div>
      <p className="text-gray-500 text-sm font-medium">{msg}</p>
    </div>
  );
}
