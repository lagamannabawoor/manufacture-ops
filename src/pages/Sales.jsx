import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import Modal, { Field, inputCls, selectCls, SaveBtn } from '../components/Modal';
import { Plus, Trash2, Eye, Pencil, Printer, FileText, Receipt, ArrowRight, X, Download, Share2, Loader, Filter, Search, MessageSquare } from 'lucide-react';
import { OrdersTab } from './Finance';
import { fmtDate, todayISO, monthRange } from '../utils/date';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Utilities ───────────────────────────────────────────────────────────────
function fmt(n) { return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0); }
function cur(n) { return '₹' + fmt(n); }

function genDocId(prefix) {
  const now = new Date();
  const d = now.toISOString().slice(0, 10).replace(/-/g, '');
  const t = (now.getTime() % 100000).toString().padStart(5, '0');
  return `${prefix}-${d}-${t}`;
}

function addDays(iso, n) {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function calcDoc(items, taxType, taxRate, discountValue, discountType) {
  const subtotal = items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
  const discAmt = discountType === 'percent'
    ? subtotal * (Number(discountValue) || 0) / 100
    : (Number(discountValue) || 0);
  const taxable = Math.max(0, subtotal - discAmt);
  const rate = Number(taxRate) || 0;
  const cgst = taxType === 'cgst_sgst' ? taxable * rate / 2 / 100 : 0;
  const sgst = taxType === 'cgst_sgst' ? taxable * rate / 2 / 100 : 0;
  const igst = taxType === 'igst' ? taxable * rate / 100 : 0;
  const total = taxable + cgst + sgst + igst;
  return { subtotal, discAmt, taxable, cgst, sgst, igst, total };
}

function toWords(amount) {
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten',
    'Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function convert(n) {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' ' + ones[n%10] : '');
    if (n < 1000) return ones[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' ' + convert(n%100) : '');
    if (n < 100000) return convert(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' ' + convert(n%1000) : '');
    if (n < 10000000) return convert(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' ' + convert(n%100000) : '');
    return convert(Math.floor(n/10000000)) + ' Crore' + (n%10000000 ? ' ' + convert(n%10000000) : '');
  }
  const intPart = Math.floor(amount);
  const paise = Math.round((amount - intPart) * 100);
  let w = convert(intPart) || 'Zero';
  w += ' Rupees';
  if (paise > 0) w += ' and ' + convert(paise) + ' Paise';
  return w + ' Only';
}

// ── Constants ────────────────────────────────────────────────────────────────
const UNITS = ['pieces', 'sqft', 'kg', 'tons', 'bags', 'trucks', 'nos', 'meters'];
const TAX_TYPES = [
  { id: 'none',      label: 'No Tax'              },
  { id: 'cgst_sgst', label: 'CGST + SGST (Local)' },
  { id: 'igst',      label: 'IGST (Interstate)'   },
];
const TAX_RATES = ['0','5','12','18','28'];
const PAYMENT_TERMS_OPTIONS = [
  { id: 'due_on_delivery', label: 'Due on Delivery'               },
  { id: '50_advance',      label: '50% Advance + 50% on Delivery' },
  { id: 'advance',         label: '100% Advance'                  },
  { id: 'net_7',           label: 'Net 7 Days'                    },
  { id: 'net_15',          label: 'Net 15 Days'                   },
  { id: 'net_30',          label: 'Net 30 Days'                   },
];
const STANDARD_TERMS = `1. This quotation is valid for 30 days from the date of issue.
2. 50% advance payment required on order confirmation.
3. Balance payment due before/on delivery.
4. Goods once dispatched cannot be returned or exchanged.
5. Transit damage is at buyer's risk.
6. All disputes are subject to local jurisdiction only.
7. E.&O.E. (Errors & Omissions Excepted)`;

const QUOTE_STATUS = {
  draft:    { label: 'Draft',    cls: 'bg-gray-100 text-gray-600'   },
  sent:     { label: 'Sent',     cls: 'bg-blue-100 text-blue-700'   },
  accepted: { label: 'Accepted', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-600'     },
  expired:  { label: 'Expired',  cls: 'bg-amber-100 text-amber-700' },
};
const INVOICE_STATUS = {
  draft:   { label: 'Draft',   cls: 'bg-gray-100 text-gray-600'   },
  sent:    { label: 'Sent',    cls: 'bg-blue-100 text-blue-700'   },
  paid:    { label: 'Paid',    cls: 'bg-green-100 text-green-700' },
  partial: { label: 'Partial', cls: 'bg-amber-100 text-amber-700' },
  overdue: { label: 'Overdue', cls: 'bg-red-100 text-red-600'     },
};

// ── Fresh form factories ─────────────────────────────────────────────────────
function freshItem() {
  return { _key: Date.now() + Math.random(), description: '', productId: '', hsnCode: '6810', quantity: '', unit: 'pieces', unitPrice: '' };
}
function freshQuote() {
  const today = todayISO();
  return { quoteNumber: genDocId('QT'), date: today, validUntil: addDays(today, 30),
    customerName: '', customerPhone: '', customerAddress: '', customerGST: '',
    items: [freshItem()], taxType: 'cgst_sgst', taxRate: '18',
    discountValue: '', discountType: 'flat', notes: '', terms: STANDARD_TERMS,
    paymentAccountId: '', shipToAddress: '', status: 'draft' };
}
function freshInvoice(fromQuote) {
  const today = todayISO();
  const base = { invoiceNumber: genDocId('INV'), date: today, dueDate: addDays(today, 7),
    quoteRef: '', customerName: '', customerPhone: '', customerAddress: '', customerGST: '',
    placeOfSupply: '', items: [freshItem()], taxType: 'cgst_sgst', taxRate: '18',
    discountValue: '', discountType: 'flat', paymentTerms: 'due_on_delivery', notes: '',
    paymentAccountId: '', shipToAddress: '', status: 'draft', paidAmount: '' };
  if (!fromQuote) return base;
  return { ...base, quoteRef: fromQuote.quoteNumber, customerName: fromQuote.customerName,
    customerPhone: fromQuote.customerPhone, customerAddress: fromQuote.customerAddress,
    customerGST: fromQuote.customerGST, taxType: fromQuote.taxType, taxRate: fromQuote.taxRate,
    discountValue: fromQuote.discountValue, discountType: fromQuote.discountType,
    items: fromQuote.items.map(i => ({ ...i, _key: Date.now() + Math.random() })) };
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function Sales({ initialAction, onActionConsumed }) {
  const app = useApp();
  const canWrite = (app.currentUser?.role === 'admin' || app.currentUser?.role === 'accountant');
  const [activeTab, setActiveTab] = useState('enquiries');
  const [triggerOrderAdd, setTriggerOrderAdd] = useState(false);
  const [pendingEnqAdd, setPendingEnqAdd] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [prefill, setPrefill] = useState(null);
  const [filterFrom, setFilterFrom]   = useState(() => monthRange().from);
  const [filterTo, setFilterTo]       = useState(() => monthRange().to);
  const [filterQStatus, setFilterQStatus] = useState('');
  const [filterIStatus, setFilterIStatus] = useState('');

  const quotes = [...(app.quotes || [])]
    .filter(q => (!filterFrom || q.date >= filterFrom) && (!filterTo || q.date <= filterTo))
    .filter(q => !filterQStatus || q.status === filterQStatus)
    .sort((a, b) => b.date?.localeCompare(a.date));
  const invoices = [...(app.invoices || [])]
    .filter(i => (!filterFrom || i.date >= filterFrom) && (!filterTo || i.date <= filterTo))
    .filter(i => !filterIStatus || i.status === filterIStatus)
    .sort((a, b) => b.date?.localeCompare(a.date));

  function openCreate(type, pre) {
    setEditing(null); setPrefill(pre || null);
    setModalType(type); setActiveTab(type === 'quote' ? 'quotes' : activeTab);
  }

  useEffect(() => {
    if (initialAction === 'new_quote')   { openCreate('quote');   onActionConsumed?.(); }
    if (initialAction === 'new_invoice') { openCreate('invoice'); onActionConsumed?.(); }
    if (initialAction === 'new_enquiry') { setActiveTab('enquiries'); setPendingEnqAdd(true); onActionConsumed?.(); }
    if (initialAction === 'tab_quotes')  { setActiveTab('quotes');   onActionConsumed?.(); }
    if (initialAction === 'tab_orders')  { setActiveTab('orders');   onActionConsumed?.(); }
    if (initialAction === 'new_order')   { setActiveTab('orders');   setTriggerOrderAdd(true); onActionConsumed?.(); }
    if (initialAction === 'tab_enquiries'){ setActiveTab('enquiries'); onActionConsumed?.(); }
  }, [initialAction]);
  function openEdit(type, doc) { setEditing(doc); setPrefill(null); setModalType(type); }

  function handleSave(type, data) {
    if (editing) app.updateItem(type === 'quote' ? 'quotes' : 'invoices', editing.id, data);
    else app.addItem(type === 'quote' ? 'quotes' : 'invoices', data);
    setModalType(null); setEditing(null); setPrefill(null);
  }

  function convertToInvoice(q) {
    setViewing(null);
    openCreate('invoice', freshInvoice(q));
  }

  return (
    <div>
      <Header title="Sales" subtitle={activeTab === 'enquiries' ? 'Enquiries' : activeTab === 'orders' ? 'Sales Orders · Invoices' : 'Quotes'}
        action={canWrite && (
          <button onClick={() => {
            if (activeTab === 'quotes') openCreate('quote');
            else if (activeTab === 'orders') setTriggerOrderAdd(true);
            else { setActiveTab('enquiries'); setPendingEnqAdd(true); }
          }} className="bg-white/20 hover:bg-white/30 text-white rounded-xl px-2.5 py-1.5 flex flex-col items-center gap-0.5">
            <Plus size={16} />
            <span className="text-[9px] font-semibold leading-none">
              {activeTab === 'quotes' ? 'Quote' : activeTab === 'orders' ? 'Order' : 'Enquiry'}
            </span>
          </button>
        )}
      />

      {/* Tabs */}
      <div className="flex px-4 pt-4 gap-1.5">
        {[{ id: 'enquiries', label: `Enquiries (${(app.enquiries||[]).length})` },
          { id: 'quotes',    label: `Quotes (${quotes.length})` },
          { id: 'orders',    label: `Sales Order (${(app.orders||[]).length})` }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${activeTab === t.id ? 'bg-amber-700 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'enquiries' && <EnquiriesTab doAdd={pendingEnqAdd} onAddDone={() => setPendingEnqAdd(false)} />}
      {activeTab === 'orders' && <OrdersTab triggerAdd={triggerOrderAdd} onTriggerConsumed={() => setTriggerOrderAdd(false)} onCreateInvoice={(order, product) => {
        openCreate('invoice', {
          ...freshInvoice(),
          customerName:    order.customerName  || '',
          customerPhone:   order.customerPhone || '',
          items: [{
            _key:        Date.now() + Math.random(),
            description: product?.name || '',
            productId:   order.productId || '',
            hsnCode:     '6810',
            quantity:    String(order.quantity  || ''),
            unit:        product?.unit || 'pieces',
            unitPrice:   String(order.unitPrice || ''),
          }],
        });
      }} />}

      {/* Tax Invoices section — shown under Sales/Orders tab */}
      {activeTab === 'orders' && (
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between mb-3 mt-1">
            <div className="flex items-center gap-2">
              <Receipt size={14} className="text-teal-600" />
              <p className="text-sm font-semibold text-gray-700">Tax Invoices</p>
              {invoices.length > 0 && <span className="bg-teal-100 text-teal-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{invoices.length}</span>}
            </div>
            {canWrite && (
              <button onClick={() => openCreate('invoice')}
                className="flex items-center gap-1 bg-teal-600 text-white text-xs font-semibold px-3 py-2 rounded-xl">
                <Plus size={13} /> New Invoice
              </button>
            )}
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 mb-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Filter size={12} className="text-amber-700" />
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Filter</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" className={inputCls} value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
              <input type="date" className={inputCls} value={filterTo}   onChange={e => setFilterTo(e.target.value)} />
              <select className={`${selectCls} col-span-2`} value={filterIStatus} onChange={e => setFilterIStatus(e.target.value)}>
                <option value="">All Statuses</option>
                {Object.entries(INVOICE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          {invoices.length === 0 ? (
            <EmptyCard icon="🧾" label="No invoices in this range" sub={'Tap "New Invoice" to create one'} />
          ) : (
            <div className="space-y-3">
              {invoices.map(inv => {
                const { total } = calcDoc(inv.items||[], inv.taxType, inv.taxRate, inv.discountValue, inv.discountType);
                const paid = Number(inv.paidAmount) || 0;
                const balance = Math.max(0, total - paid);
                return (
                  <DocCard key={inv.id} docNo={inv.invoiceNumber} customerName={inv.customerName}
                    date={inv.date} statusMap={INVOICE_STATUS} status={inv.status}
                    totalLabel={cur(total)}
                    subLabel={balance > 0 ? `Balance: ${cur(balance)}` : 'Fully Paid'}
                    onView={() => setViewing({ doc: inv, type: 'invoice' })}
                    onEdit={canWrite ? () => openEdit('invoice', inv) : null}
                    onDelete={canWrite ? () => { if (confirm(`Delete ${inv.invoiceNumber}?`)) app.deleteItem('invoices', inv.id); } : null}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Filter bar — quotes only */}
      {activeTab === 'quotes' && <div className="px-4 pt-3">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Filter size={12} className="text-amber-700" />
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Filter</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" className={inputCls} value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
            <input type="date" className={inputCls} value={filterTo}   onChange={e => setFilterTo(e.target.value)} />
            <select className={`${selectCls} col-span-2`} value={filterQStatus} onChange={e => setFilterQStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {Object.entries(QUOTE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>
      </div>}

      {activeTab === 'quotes' && <div className="px-4 py-4 space-y-3">
        {quotes.length === 0
          ? <EmptyCard icon="📄" label="No Quotes in this range" sub="Adjust dates or tap the document icon" />
          : quotes.map(q => (
              <DocCard key={q.id} docNo={q.quoteNumber} customerName={q.customerName}
                date={q.date} statusMap={QUOTE_STATUS} status={q.status}
                totalLabel={cur(calcDoc(q.items||[], q.taxType, q.taxRate, q.discountValue, q.discountType).total)}
                subLabel={`Valid till ${fmtDate(q.validUntil)}`}
                onView={() => setViewing({ doc: q, type: 'quote' })}
                onEdit={canWrite ? () => openEdit('quote', q) : null}
                onDelete={canWrite ? () => { if (confirm(`Delete ${q.quoteNumber}?`)) app.deleteItem('quotes', q.id); } : null}
              />
            ))
        }
      </div>}

      {/* Create / Edit modal */}
      {modalType && (
        <SalesDocModal
          type={modalType}
          initial={editing || prefill}
          isEditing={!!editing}
          products={app.products || []}
          productCategories={app.productCategories || []}
          onClose={() => { setModalType(null); setEditing(null); setPrefill(null); }}
          onSave={(data) => handleSave(modalType, data)}
        />
      )}

      {/* View / Print modal */}
      {viewing && (
        <DocViewer
          doc={viewing.doc}
          type={viewing.type}
          products={app.products || []}
          companyInfo={app.companyInfo || {}}
          onClose={() => setViewing(null)}
          onConvert={viewing.type === 'quote' && canWrite ? () => convertToInvoice(viewing.doc) : null}
          onEdit={canWrite ? () => { setViewing(null); openEdit(viewing.type, viewing.doc); } : null}
        />
      )}
    </div>
  );
}

// ── Reusable card for quote/invoice list ─────────────────────────────────────
function EmptyCard({ icon, label, sub }) {
  return (
    <div className="bg-white rounded-xl p-10 text-center shadow-sm border border-gray-100">
      <div className="text-4xl mb-3">{icon}</div>
      <p className="text-gray-500 text-sm font-medium">{label}</p>
      <p className="text-gray-400 text-xs mt-1">{sub}</p>
    </div>
  );
}

function DocCard({ docNo, customerName, date, statusMap, status, totalLabel, subLabel, onView, onEdit, onDelete }) {
  const s = statusMap[status] || statusMap.draft;
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-gray-700">{docNo}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
          </div>
          <p className="text-sm font-semibold text-gray-800 truncate">{customerName || '—'}</p>
          <p className="text-xs text-gray-400 mt-0.5">{fmtDate(date)} · {subLabel}</p>
        </div>
        <div className="text-right ml-3 shrink-0">
          <p className="text-base font-bold text-amber-700">{totalLabel}</p>
          <div className="flex gap-1 mt-2 justify-end">
            <button onClick={onView} className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100"><Eye size={14} /></button>
            {onEdit && <button onClick={onEdit} className="p-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100"><Pencil size={14} /></button>}
            {onDelete && <button onClick={onDelete} className="p-1.5 rounded-lg bg-red-50 text-red-400 hover:bg-red-100"><Trash2 size={14} /></button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Create / Edit form modal ─────────────────────────────────────────────────
function SalesDocModal({ type, initial, isEditing, products, productCategories, onClose, onSave }) {
  const app = useApp();
  const isQuote = type === 'quote';
  const payBanks = (app.bankAccounts || []).filter(b => b.type !== 'cash' && (b.accountNumber || b.ifscCode || b.branchName));
  const defaultForm = isQuote ? freshQuote() : freshInvoice();
  const [form, setForm] = useState(() => {
    const base = initial ? { ...defaultForm, ...initial } : defaultForm;
    if (!base.paymentAccountId && payBanks.length === 1) base.paymentAccountId = payBanks[0].id;
    return base;
  });

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function addItem() { setForm(f => ({ ...f, items: [freshItem(), ...f.items] })); }
  function removeItem(key) { setForm(f => ({ ...f, items: f.items.filter(i => i._key !== key) })); }
  function updateItem(key, k, v) {
    setForm(f => ({
      ...f,
      items: f.items.map(i => {
        if (i._key !== key) return i;
        const updated = { ...i, [k]: v };
        if (k === 'productId' && v) {
          const prod = products.find(p => p.id === v);
          if (prod) {
            updated.description = prod.name;
            updated.unit = prod.unit || 'pieces';
            updated.hsnCode = prod.hsnCode || '6810';
          }
        }
        return updated;
      })
    }));
  }

  const { subtotal, discAmt, taxable, cgst, sgst, igst, total } = calcDoc(
    form.items, form.taxType, form.taxRate, form.discountValue, form.discountType
  );

  function save() {
    if (!form.customerName) return alert('Customer name is required.');
    if ((form._shipToDiffers || form.shipToAddress !== undefined) && form._shipToDiffers && !form.shipToAddress.trim()) return alert('Please enter the shipping address.');
    const hasItems = form.items.some(i => i.description && Number(i.quantity) > 0);
    if (!hasItems) return alert('Add at least one item with description and quantity.');
    const { _shipToDiffers, ...toSave } = form;
    onSave(toSave);
  }

  const titlePrefix = isEditing ? 'Edit' : 'New';
  const title = isQuote ? `${titlePrefix} Quote` : `${titlePrefix} Invoice`;

  return (
    <div className="fixed inset-0 z-[200] bg-slate-100 flex flex-col max-w-[480px] mx-auto">
      <Header title={title} onBack={onClose} />
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-24">

        {/* Document number & dates */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Document Info</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label={isQuote ? 'Quote No.' : 'Invoice No.'} required>
              <input className={inputCls} value={isQuote ? form.quoteNumber : form.invoiceNumber}
                onChange={e => set(isQuote ? 'quoteNumber' : 'invoiceNumber', e.target.value)} />
            </Field>
            <Field label="Date" required>
              <input type="date" className={inputCls} value={form.date} onChange={e => set('date', e.target.value)} />
            </Field>
            {isQuote ? (
              <Field label="Valid Until">
                <input type="date" className={inputCls} value={form.validUntil} onChange={e => set('validUntil', e.target.value)} />
              </Field>
            ) : (
              <Field label="Due Date">
                <input type="date" className={inputCls} value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
              </Field>
            )}
            <Field label={isQuote ? 'Status' : 'Status'}>
              <select className={selectCls} value={form.status} onChange={e => set('status', e.target.value)}>
                {Object.entries(isQuote ? QUOTE_STATUS : INVOICE_STATUS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </Field>
          </div>
          {!isQuote && (
            <div className="mt-3">
              <Field label="Quote Reference (optional)">
                <input className={inputCls} placeholder="QT-..." value={form.quoteRef} onChange={e => set('quoteRef', e.target.value)} />
              </Field>
            </div>
          )}
        </div>

        {/* Customer info */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Customer Details</p>
          <div className="space-y-3">
            <Field label="Customer Name" required>
              <input className={inputCls} placeholder="Full name or company" value={form.customerName} onChange={e => set('customerName', e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone">
                <input className={inputCls} type="tel" placeholder="+91..." value={form.customerPhone} onChange={e => set('customerPhone', e.target.value)} />
              </Field>
              <Field label="GST Number">
                <input className={inputCls} placeholder="22AAAAA..." value={form.customerGST} onChange={e => set('customerGST', e.target.value)} />
              </Field>
            </div>
            <Field label="Billing Address">
              <textarea className={inputCls} rows={2} placeholder="Street, City, State, Pincode" value={form.customerAddress} onChange={e => set('customerAddress', e.target.value)} />
            </Field>
            <div>
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input type="checkbox" className="accent-amber-700" checked={!!form._shipToDiffers || !!form.shipToAddress} onChange={e => { set('_shipToDiffers', e.target.checked); if (!e.target.checked) set('shipToAddress', ''); }} />
                <span className="text-xs font-medium text-gray-600">Ship to a different address</span>
              </label>
              {(!!form._shipToDiffers || !!form.shipToAddress) && (
                <Field label="Shipping Address" required>
                  <textarea className={inputCls} rows={2} placeholder="Enter shipping / delivery address" value={form.shipToAddress} onChange={e => set('shipToAddress', e.target.value)} />
                </Field>
              )}
            </div>
            {!isQuote && (
              <Field label="Place of Supply">
                <input className={inputCls} placeholder="State name (for IGST)" value={form.placeOfSupply} onChange={e => set('placeOfSupply', e.target.value)} />
              </Field>
            )}
          </div>
        </div>

        {/* Line items */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Items</p>
            <button onClick={addItem} className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg">
              <Plus size={14} /> Add Item
            </button>
          </div>
          <div className="space-y-3">
            {form.items.map((item, idx) => (
              <LineItemRow key={item._key} item={item} idx={idx} products={products} productCategories={productCategories}
                onChange={(k, v) => updateItem(item._key, k, v)}
                onRemove={form.items.length > 1 ? () => removeItem(item._key) : null}
              />
            ))}
          </div>
        </div>

        {/* Tax & Discount */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Tax & Discount</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tax Type">
              <select className={selectCls} value={form.taxType} onChange={e => set('taxType', e.target.value)}>
                {TAX_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </Field>
            {form.taxType !== 'none' && (
              <Field label="Tax Rate (%)">
                <select className={selectCls} value={form.taxRate} onChange={e => set('taxRate', e.target.value)}>
                  {TAX_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                </select>
              </Field>
            )}
            <Field label="Discount">
              <input type="number" className={inputCls} placeholder="0" value={form.discountValue} onChange={e => set('discountValue', e.target.value)} min="0" />
            </Field>
            <Field label="Discount Type">
              <select className={selectCls} value={form.discountType} onChange={e => set('discountType', e.target.value)}>
                <option value="flat">Flat (₹)</option>
                <option value="percent">Percent (%)</option>
              </select>
            </Field>
          </div>

          {/* Summary */}
          <div className="mt-4 border-t border-gray-100 pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{cur(subtotal)}</span></div>
            {discAmt > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>- {cur(discAmt)}</span></div>}
            {cgst > 0 && <div className="flex justify-between text-gray-600"><span>CGST ({Number(form.taxRate)/2}%)</span><span>{cur(cgst)}</span></div>}
            {sgst > 0 && <div className="flex justify-between text-gray-600"><span>SGST ({Number(form.taxRate)/2}%)</span><span>{cur(sgst)}</span></div>}
            {igst > 0 && <div className="flex justify-between text-gray-600"><span>IGST ({form.taxRate}%)</span><span>{cur(igst)}</span></div>}
            <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-200 pt-2 mt-1">
              <span>Total</span><span className="text-amber-700">{cur(total)}</span>
            </div>
          </div>

          {!isQuote && (
            <div className="mt-3">
              <Field label="Amount Paid (₹)">
                <input type="number" className={inputCls} placeholder="0" value={form.paidAmount} onChange={e => set('paidAmount', e.target.value)} min="0" />
              </Field>
            </div>
          )}
        </div>

        {/* Payment terms / Notes */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Notes & Terms</p>
          <div className="space-y-3">
            {!isQuote && (
              <Field label="Payment Terms">
                <select className={selectCls} value={form.paymentTerms} onChange={e => set('paymentTerms', e.target.value)}>
                  {PAYMENT_TERMS_OPTIONS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </Field>
            )}
            {payBanks.length > 0 && (
              <Field label="Payment Account (shown on document)">
                {payBanks.length === 1 ? (
                  <div className="text-xs bg-green-50 border border-green-100 rounded-xl px-3 py-2 text-green-800 font-medium">
                    ✓ {payBanks[0].accountHolder || payBanks[0].name} — {payBanks[0].bankName}
                  </div>
                ) : (
                  <select className={selectCls} value={form.paymentAccountId} onChange={e => set('paymentAccountId', e.target.value)}>
                    <option value="">— No payment details on document —</option>
                    {payBanks.map(b => <option key={b.id} value={b.id}>{b.name} — {b.bankName}</option>)}
                  </select>
                )}
              </Field>
            )}
            <Field label="Notes">
              <textarea className={inputCls} rows={2} placeholder="Additional notes for customer..." value={form.notes} onChange={e => set('notes', e.target.value)} />
            </Field>
            {isQuote && (
              <Field label="Terms & Conditions">
                <textarea className={inputCls} rows={5} value={form.terms} onChange={e => set('terms', e.target.value)} />
              </Field>
            )}
          </div>
        </div>
      </div>

      {/* Sticky save */}
      <div className="px-4 py-3 bg-white border-t border-gray-100">
        <button onClick={save} className="w-full bg-amber-700 hover:bg-amber-800 text-white font-semibold py-3 rounded-xl text-sm">
          {isEditing ? 'Update' : 'Save'} {isQuote ? 'Quote' : 'Invoice'}
        </button>
      </div>
    </div>
  );
}

// ── Single line item row ──────────────────────────────────────────────────────
function LineItemRow({ item, idx, products, productCategories, onChange, onRemove }) {
  const amt = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
  return (
    <div className="border border-gray-100 rounded-xl p-3 bg-gray-50 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-gray-400">Item {idx + 1}</span>
        {onRemove && <button onClick={onRemove} className="text-red-400 hover:text-red-600 p-1"><X size={14} /></button>}
      </div>
      <div>
        <select className={selectCls} value={item.productId} onChange={e => onChange('productId', e.target.value)}>
          <option value="">— Select product or type below —</option>
          {productCategories.map(cat => (
            <optgroup key={cat.id} label={cat.name}>
              {products.filter(p => p.categoryId === cat.id).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <input className={inputCls} placeholder="Description (required)" value={item.description} onChange={e => onChange('description', e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <input className={inputCls} placeholder="HSN Code" value={item.hsnCode} onChange={e => onChange('hsnCode', e.target.value)} />
        <select className={selectCls} value={item.unit} onChange={e => onChange('unit', e.target.value)}>
          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="number" className={inputCls} placeholder="Qty" value={item.quantity} onChange={e => onChange('quantity', e.target.value)} min="0" />
        <input type="number" className={inputCls} placeholder="Rate (₹)" value={item.unitPrice} onChange={e => onChange('unitPrice', e.target.value)} min="0" />
      </div>
      {amt > 0 && <p className="text-right text-xs font-semibold text-amber-700">= {cur(amt)}</p>}
    </div>
  );
}

// ── PDF helpers ───────────────────────────────────────────────────────────────
function blobToBase64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

function buildPDF(docData, type, ci, bankAccounts) {
  const coName    = ci?.name    || 'UrbanMud Bricks and Blocks';
  const coTagline = ci?.tagline || '';
  const coAddress = ci?.address || 'Bhaktharahalli, Poojeana Agrahara,\nnear Hoskote, Bangalore - 562114';
  const coPhone   = ci?.phone   || '';
  const coEmail   = ci?.email   || '';
  const coGSTIN   = ci?.gstin   || '';

  const isQ   = type === 'quote';
  const docNo = isQ ? docData.quoteNumber : docData.invoiceNumber;
  const { subtotal, discAmt, cgst, sgst, igst, total } = calcDoc(
    docData.items || [], docData.taxType, docData.taxRate, docData.discountValue, docData.discountType
  );

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, H = 297, ML = 14, MR = 14, CW = W - ML - MR;
  const A  = [146, 64, 14];   // amber-800
  const DK = [31, 41, 55];    // near-black
  const MD = [107, 114, 128]; // gray
  const LT = [253, 230, 138]; // amber-200
  const rp = (n) => 'Rs.' + fmt(n);

  let y = ML;
  const needPage = (h) => { if (y + h > H - 18) { pdf.addPage(); y = ML; } };

  // ─── HEADER ───────────────────────────────────────────────────────────────────
  const headerStartY = y;
  const metaX = W - MR;

  pdf.setFontSize(16); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...A);
  pdf.text(coName.toUpperCase(), ML, y + 7); y += 11;
  if (coTagline) {
    pdf.setFontSize(7.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...MD);
    pdf.text(coTagline, ML, y); y += 4;
  }
  pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...MD);
  coAddress.split('\n').forEach(l => { pdf.text(l, ML, y); y += 4; });
  if (coPhone) { pdf.text('Ph: ' + coPhone, ML, y); y += 4; }
  if (coEmail) { pdf.text(coEmail, ML, y); y += 4; }
  if (coGSTIN) {
    pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...A);
    pdf.text('GSTIN: ' + coGSTIN, ML, y);
    pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...MD); y += 4;
  }

  // Right column
  const payLabel = PAYMENT_TERMS_OPTIONS.find(p => p.id === docData.paymentTerms)?.label || docData.paymentTerms || '';
  let ry = headerStartY + 7;
  pdf.setFontSize(13); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...DK);
  pdf.text(isQ ? 'QUOTATION' : 'TAX INVOICE', metaX, ry, { align: 'right' }); ry += 8;
  pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...A);
  pdf.text(docNo, metaX, ry, { align: 'right' }); ry += 6;
  pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...MD);
  pdf.text('Date: ' + (docData.date || ''), metaX, ry, { align: 'right' }); ry += 5;
  if (isQ && docData.validUntil) { pdf.text('Valid Until: ' + docData.validUntil, metaX, ry, { align: 'right' }); ry += 5; }
  if (!isQ && docData.dueDate)   { pdf.text('Due Date: '   + docData.dueDate,   metaX, ry, { align: 'right' }); ry += 5; }
  if (!isQ && docData.quoteRef)  { pdf.text('Quote Ref: '  + docData.quoteRef,  metaX, ry, { align: 'right' }); ry += 5; }
  if (payLabel)                  { pdf.text('Terms: '      + payLabel,          metaX, ry, { align: 'right' }); ry += 5; }

  y = Math.max(y, ry) + 4;
  pdf.setDrawColor(...A); pdf.setLineWidth(0.6);
  pdf.line(ML, y, W - MR, y); y += 6;

  // ─── TWO-COLUMN: BILL TO (left) | QUOTE REFERENCE (right) ────────────────
  needPage(38);
  const colMid = ML + CW * 0.55;
  const boxTop = y;
  const leftW  = CW * 0.55 - 4;
  const rightW = CW * 0.45 - 4;
  const rightX = colMid + 4;

  const BP = 4; // inner cell left padding
  const innerW = leftW - BP - 2; // usable text width inside left cell

  // Left — BILL TO
  pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...A);
  pdf.text('BILL TO', ML + BP, y + 4.5);
  let ly = y + 9;
  pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...DK);
  pdf.text(pdf.splitTextToSize(docData.customerName || '—', innerW)[0], ML + BP, ly); ly += 5;
  pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...MD);
  if (docData.customerPhone) { pdf.text(docData.customerPhone, ML + BP, ly); ly += 4; }
  if (docData.customerAddress) {
    pdf.splitTextToSize(docData.customerAddress, innerW).forEach(l => { pdf.text(l, ML + BP, ly); ly += 4; });
  }
  if (docData.customerGST) { pdf.setFont('helvetica','bold'); pdf.text('GSTIN: ' + docData.customerGST, ML + BP, ly); pdf.setFont('helvetica','normal'); ly += 4; }
  if (docData.placeOfSupply) { pdf.text('Place of Supply: ' + docData.placeOfSupply, ML + BP, ly); ly += 4; }

  // SHIP TO (if different from billing)
  if (docData.shipToAddress) {
    ly += 2;
    pdf.setDrawColor(210, 210, 210); pdf.setLineWidth(0.2); pdf.line(ML + BP, ly, colMid - 4, ly); ly += 4;
    pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...A);
    pdf.text('SHIP TO', ML + BP, ly); ly += 4.5;
    pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...MD);
    pdf.splitTextToSize(docData.shipToAddress, innerW).forEach(l => { pdf.text(l, ML + BP, ly); ly += 4; });
  }

  // Right — REFERENCE
  const refRows = [
    [isQ ? 'Quotation No.' : 'Invoice No.', docNo],
    ['Date', docData.date || ''],
    ...(isQ && docData.validUntil ? [['Valid Until', docData.validUntil]] : []),
    ...(!isQ && docData.dueDate   ? [['Due Date',   docData.dueDate]]    : []),
    ...(payLabel                  ? [['Payment Terms', payLabel]]        : []),
    ...(docData.placeOfSupply     ? [['Place of Supply', docData.placeOfSupply]] : []),
  ];
  let ry2 = y + 4;
  pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...A);
  pdf.text('REFERENCE', rightX, ry2); ry2 += 5.5;
  refRows.forEach(([lbl, val]) => {
    pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...MD);
    pdf.text(lbl + ':', rightX, ry2);
    pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...DK);
    pdf.text(String(val), W - MR - 3, ry2, { align: 'right' });
    ry2 += 5;
  });

  y = Math.max(ly, ry2) + 2;
  pdf.setDrawColor(180, 180, 180); pdf.setLineWidth(0.3);
  pdf.rect(ML - 1, boxTop - 1, CW + 2, y - boxTop + 1);
  pdf.line(colMid, boxTop - 1, colMid, y);
  y += 3;

  // ─── SUBJECT LINE (quotes only) — bordered cell ───────────────────────────
  if (isQ) {
    y += 4; // top gap from Bill To section
    const descList = (docData.items || []).map(i => i.description).filter(Boolean).join(', ');
    const subText = pdf.splitTextToSize('Quotation for supply of ' + (descList || 'goods'), CW - 22);
    const subBoxH = subText.length * 5 + 7;
    needPage(subBoxH + 4);
    pdf.setDrawColor(200, 200, 200); pdf.setLineWidth(0.3);
    pdf.rect(ML - 1, y, CW + 2, subBoxH);
    pdf.setFontSize(8.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...A);
    pdf.text('Sub:', ML + 3, y + 5);
    pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...DK);
    subText.forEach((l, i) => pdf.text(l, ML + 16, y + 5 + i * 5));
    y += subBoxH + 4;
  }

  // ─── ITEMS TABLE ───────────────────────────────────────────────────────────
  const rows = (docData.items || []).map((it, i) => [
    i + 1,
    it.description || '',
    it.hsnCode || '6810',
    it.unit || 'pcs',
    Number(it.quantity) || 0,
    rp(Number(it.unitPrice) || 0),
    rp((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)),
  ]);

  autoTable(pdf, {
    startY: y,
    head: [['#', 'Description', 'HSN', 'Unit', 'Qty', 'Rate', 'Amount']],
    body: rows,
    theme: 'grid',
    margin: { left: ML, right: MR },
    headStyles: { fillColor: A, textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold', cellPadding: 3, lineColor: A, lineWidth: 0.3 },
    bodyStyles: { fontSize: 8.5, textColor: DK, cellPadding: 3, lineColor: [180, 180, 180], lineWidth: 0.25 },
    alternateRowStyles: { fillColor: [255, 251, 235] },
    columnStyles: {
      0: { cellWidth: 8,  halign: 'center' },
      2: { cellWidth: 16, halign: 'center' },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 28, halign: 'right'  },
      6: { cellWidth: 30, halign: 'right'  },
    },
    styles: { overflow: 'ellipsize' },
    showFoot: 'never',
  });
  y = pdf.lastAutoTable.finalY + 7;

  // ─── TOTALS (bordered table) ───────────────────────────────────────────────
  needPage(55);
  const TX = W - MR - 82;
  const totalsRows = [['Subtotal', rp(subtotal)]];
  if (discAmt > 0) totalsRows.push(['Discount', '- ' + rp(discAmt)]);
  if (cgst > 0) totalsRows.push(['CGST (' + (Number(docData.taxRate)/2) + '%)', rp(cgst)]);
  if (sgst > 0) totalsRows.push(['SGST (' + (Number(docData.taxRate)/2) + '%)', rp(sgst)]);
  if (igst > 0) totalsRows.push(['IGST (' + docData.taxRate + '%)', rp(igst)]);
  const totalRowIdx = totalsRows.length;
  totalsRows.push(['TOTAL', rp(total)]);
  if (!isQ && Number(docData.paidAmount) > 0) {
    totalsRows.push(['Paid', '- ' + rp(Number(docData.paidAmount))]);
    totalsRows.push(['Balance Due', rp(Math.max(0, total - Number(docData.paidAmount)))]);
  }
  autoTable(pdf, {
    startY: y,
    body: totalsRows,
    theme: 'grid',
    margin: { left: TX, right: MR },
    bodyStyles: { fontSize: 9, textColor: MD, cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 }, lineColor: [210, 210, 210], lineWidth: 0.2 },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold' },
      1: { halign: 'right', textColor: DK },
    },
    didParseCell: (data) => {
      if (data.row.index === totalRowIdx) {
        data.cell.styles.fontStyle = 'bold'; data.cell.styles.fontSize = 10;
        data.cell.styles.textColor = A; data.cell.styles.fillColor = [255, 251, 235];
      }
      if (discAmt > 0 && data.row.index === 1) data.cell.styles.textColor = [22, 163, 74];
      if (!isQ && Number(docData.paidAmount) > 0 && data.row.index === totalsRows.length - 1) {
        data.cell.styles.textColor = [220, 38, 38]; data.cell.styles.fontStyle = 'bold';
      }
    },
  });
  y = pdf.lastAutoTable.finalY + 5;

  // ─── AMOUNT IN WORDS ───────────────────────────────────────────────────────
  needPage(12);
  pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...DK);
  const wl = pdf.splitTextToSize('Amount in words: ' + toWords(total), CW);
  pdf.text(wl, ML, y); y += wl.length * 4.5 + 6;

  // ─── BANK PAYMENT DETAILS ──────────────────────────────────────────────────
  const payBanksList = (bankAccounts || []).filter(b => b.type !== 'cash' && (b.accountNumber || b.ifscCode || b.branchName));
  const printBank = docData.paymentAccountId
    ? payBanksList.find(b => b.id === docData.paymentAccountId)
    : payBanksList[0];
  // ─── PAYMENT DETAILS (left) + AUTHORISED SIGNATORY (right) side by side ──────────
  const bLines = printBank ? [
    ['Account Name', printBank.accountHolder || coName],
    ['Bank',         printBank.bankName || ''],
    ...(printBank.branchName    ? [['Branch',      printBank.branchName]]    : []),
    ...(printBank.accountNumber ? [['Account No.', printBank.accountNumber]] : []),
    ...(printBank.ifscCode      ? [['IFSC Code',   printBank.ifscCode]]      : []),
  ].filter(([,v]) => v) : [];

  needPage(42);
  const secTop = y;
  let bankEnd = y;

  if (printBank) {
    pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...A);
    pdf.text('PAYMENT DETAILS', ML, y); y += 5;
    const bTop = y;
    const LBL_X = ML + 4; const VAL_X = ML + 38;
    bLines.forEach(([lbl, val]) => {
      pdf.setFontSize(8.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...MD);
      pdf.text(lbl, LBL_X, y + 3);
      pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...DK);
      pdf.text(String(val), VAL_X, y + 3);
      y += 5;
    });
    y += 3;
    bankEnd = y;
    pdf.setDrawColor(180, 180, 180); pdf.setLineWidth(0.25);
    pdf.rect(ML - 1, bTop - 2, CW * 0.55 + 2, y - bTop + 2);
  }

  // Signatory — right side, bottom-aligned with bank box
  const sw = CW * 0.35; const sx = W - MR - sw;
  const sigLineY = Math.max(bankEnd - 2, secTop + 18);
  if (ci?.signature) { try { pdf.addImage(ci.signature, 'PNG', sx + 4, sigLineY - 13, sw - 8, 10); } catch(e) {} }
  pdf.setDrawColor(...MD); pdf.setLineWidth(0.4);
  pdf.line(sx, sigLineY, W - MR, sigLineY);
  pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...DK);
  pdf.text('Authorised Signatory', sx + sw / 2, sigLineY + 4.5, { align: 'center' });
  pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...MD);
  pdf.text('For ' + coName, sx + sw / 2, sigLineY + 8.5, { align: 'center' });

  y = Math.max(y, sigLineY + 10) + 5;

  // ─── NOTES ─────────────────────────────────────────────────────────────────
  if (docData.notes) {
    needPage(20);
    pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...MD);
    pdf.text('NOTES', ML, y); y += 4;
    pdf.setFontSize(8.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...MD);
    const nl = pdf.splitTextToSize(docData.notes, CW);
    pdf.text(nl, ML, y); y += nl.length * 4.2 + 5;
  }

  // ─── TERMS ─────────────────────────────────────────────────────────────────
  if (isQ && docData.terms) {
    needPage(24);
    pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...MD);
    pdf.text('TERMS & CONDITIONS', ML, y); y += 4;
    pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...MD);
    const tl = pdf.splitTextToSize(docData.terms, CW);
    pdf.text(tl, ML, y); y += tl.length * 4 + 5;
  }

  // ─── PAGE FOOTER ───────────────────────────────────────────────────────────
  const tp = pdf.internal.getNumberOfPages();
  for (let p = 1; p <= tp; p++) {
    pdf.setPage(p);
    pdf.setDrawColor(...LT); pdf.setLineWidth(0.3); pdf.line(ML, H - 10, W - MR, H - 10);
    pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...MD);
    pdf.text('Generated by Urbanmud Manufacturing Ops  |  Page ' + p + ' of ' + tp, W / 2, H - 6, { align: 'center' });
  }

  return pdf;
}

// ── View / Print document ─────────────────────────────────────────────────────
function DocViewer({ doc, type, products, companyInfo, onClose, onConvert, onEdit }) {
  const app = useApp();
  const ci = companyInfo || {};
  const coName    = ci.name    || 'UrbanMud Bricks and Blocks';
  const coTagline = ci.tagline || '';
  const coAddress = ci.address || 'Bhaktharahalli, Poojeana Agrahara,\nnear Hoskote, Bangalore - 562114';
  const coPhone   = ci.phone   || '';
  const coEmail   = ci.email   || '';
  const coGSTIN   = ci.gstin   || '';
  const [pdfBusy, setPdfBusy] = useState(null); // 'download' | 'share' | null
  const isQuote = type === 'quote';
  const docNo = isQuote ? doc.quoteNumber : doc.invoiceNumber;
  const { subtotal, discAmt, taxable, cgst, sgst, igst, total } = calcDoc(
    doc.items || [], doc.taxType, doc.taxRate, doc.discountValue, doc.discountType
  );
  const paymentTermLabel = PAYMENT_TERMS_OPTIONS.find(p => p.id === doc.paymentTerms)?.label || doc.paymentTerms || '';
  const statusInfo = isQuote ? QUOTE_STATUS[doc.status] : INVOICE_STATUS[doc.status];

  async function handleDownload() {
    setPdfBusy('download');
    try {
      const pdf = buildPDF(doc, type, ci, app.bankAccounts);
      pdf.save(`${docNo}.pdf`);
    } catch (e) { alert('Could not generate PDF: ' + e.message); }
    finally { setPdfBusy(null); }
  }

  async function handleShare() {
    setPdfBusy('share');
    try {
      const pdf = buildPDF(doc, type, ci, app.bankAccounts);
      const blob = pdf.output('blob');
      const filename = `${docNo}.pdf`;

      let shared = false;

      // Try Capacitor Share (Android native)
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');
        const b64 = await blobToBase64(blob);
        await Filesystem.writeFile({ path: filename, data: b64, directory: Directory.Cache });
        const uri = await Filesystem.getUri({ directory: Directory.Cache, path: filename });
        await Share.share({
          title: `${docNo} – ${doc.customerName || ''}`,
          text: `Please find the ${isQuote ? 'quotation' : 'invoice'} ${docNo} attached.`,
          files: [uri.uri],
          dialogTitle: 'Share via',
        });
        shared = true;
      } catch (_) {}

      // Fallback: Web Share API
      if (!shared && navigator.canShare) {
        const file = new File([blob], filename, { type: 'application/pdf' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ title: docNo, files: [file] });
          shared = true;
        }
      }

      // Last fallback: just download
      if (!shared) {
        pdf.save(filename);
      }
    } catch (e) { alert('Could not share: ' + e.message); }
    finally { setPdfBusy(null); }
  }

  function printDoc() {
    document.getElementById('__um_ps')?.remove();
    document.getElementById('__um_pp')?.remove();

    const styleEl = document.createElement('style');
    styleEl.id = '__um_ps';
    styleEl.textContent = `
      #__um_pp { display: none; }
      @media print {
        body > *:not(#__um_pp) { display: none !important; }
        #__um_pp {
          display: block !important;
          font-family: Arial, sans-serif;
          font-size: 12px;
          color: #333;
          padding: 16px;
        }
        #__um_pp * { max-width: 100%; box-sizing: border-box; }
        #__um_pp table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        #__um_pp th {
          background: #92400e !important;
          color: white !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          padding: 7px 8px;
          text-align: left;
          font-size: 11px;
        }
        #__um_pp td { padding: 6px 8px; border-bottom: 1px solid #eee; font-size: 11px; }
        #__um_pp tr:nth-child(even) td {
          background: #fef9f0 !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        #__um_pp .sign-box { text-align: center; }
      }
    `;
    document.head.appendChild(styleEl);

    const portal = document.createElement('div');
    portal.id = '__um_pp';
    portal.innerHTML = document.getElementById('sales-print-view').innerHTML;
    document.body.appendChild(portal);

    const cleanup = () => {
      document.getElementById('__um_ps')?.remove();
      document.getElementById('__um_pp')?.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);

    setTimeout(() => window.print(), 150);
  }

  return (
    <div className="fixed inset-0 z-[200] bg-slate-100 flex flex-col max-w-[480px] mx-auto">
      <div className="flex items-center justify-between px-4 py-3 bg-amber-700 text-white">
        <button onClick={onClose} className="p-1.5"><X size={20} /></button>
        <span className="font-bold text-base">{docNo}</span>
        <div className="flex gap-1.5">
          {onEdit && <button onClick={onEdit} className="p-1.5 bg-white/20 rounded-full"><Pencil size={16} /></button>}
          <button onClick={handleDownload} disabled={!!pdfBusy}
            className="p-1.5 bg-white/20 rounded-full disabled:opacity-50" title="Download PDF">
            {pdfBusy === 'download' ? <Loader size={16} className="animate-spin" /> : <Download size={16} />}
          </button>
          <button onClick={handleShare} disabled={!!pdfBusy}
            className="p-1.5 bg-white/20 rounded-full disabled:opacity-50" title="Share via WhatsApp">
            {pdfBusy === 'share' ? <Loader size={16} className="animate-spin" /> : <Share2 size={16} />}
          </button>
          <button onClick={printDoc} className="p-1.5 bg-white/20 rounded-full" title="Print"><Printer size={16} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {/* Convert to Invoice button for quotes */}
        {onConvert && (
          <button onClick={onConvert}
            className="w-full mb-3 flex items-center justify-center gap-2 py-2.5 bg-amber-700 text-white rounded-xl text-sm font-semibold">
            <ArrowRight size={16} /> Convert to Invoice
          </button>
        )}

        {/* Document view */}
        <div id="sales-print-view" className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">

          {/* Company header */}
          <div className="flex justify-between items-start pb-4 border-b-2 border-amber-700 mb-4">
            <div className="max-w-[55%]">
              <p className="text-xl font-bold text-amber-700 leading-tight">{coName.toUpperCase()}</p>
              {coTagline && <p className="text-[10px] text-gray-500 mt-0.5">{coTagline}</p>}
              <p className="text-xs text-gray-500 mt-1 whitespace-pre-line leading-snug">{coAddress}</p>
              {coPhone && <p className="text-xs text-gray-500">Ph: {coPhone}</p>}
              {coEmail && <p className="text-xs text-gray-500">{coEmail}</p>}
              {coGSTIN && <p className="text-xs font-semibold text-gray-600 mt-0.5">GSTIN: {coGSTIN}</p>}
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-gray-700">{isQuote ? 'QUOTATION' : 'TAX INVOICE'}</p>
              <p className="text-xs font-semibold text-amber-700 mt-0.5">{docNo}</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusInfo?.cls}`}>{statusInfo?.label}</span>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
            <div>
              <p className="text-gray-400 font-semibold uppercase text-[10px]">Date</p>
              <p className="font-semibold text-gray-700">{fmtDate(doc.date)}</p>
            </div>
            <div>
              <p className="text-gray-400 font-semibold uppercase text-[10px]">{isQuote ? 'Valid Until' : 'Due Date'}</p>
              <p className="font-semibold text-gray-700">{fmtDate(isQuote ? doc.validUntil : doc.dueDate)}</p>
            </div>
            {!isQuote && doc.quoteRef && (
              <div>
                <p className="text-gray-400 font-semibold uppercase text-[10px]">Quote Ref</p>
                <p className="font-semibold text-gray-700">{doc.quoteRef}</p>
              </div>
            )}
            {!isQuote && paymentTermLabel && (
              <div>
                <p className="text-gray-400 font-semibold uppercase text-[10px]">Payment Terms</p>
                <p className="font-semibold text-gray-700">{paymentTermLabel}</p>
              </div>
            )}
          </div>

          {/* Bill to */}
          <div className="bg-gray-50 rounded-xl p-3 mb-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Bill To</p>
            <p className="text-sm font-bold text-gray-800">{doc.customerName || '—'}</p>
            {doc.customerPhone && <p className="text-xs text-gray-500">{doc.customerPhone}</p>}
            {doc.customerAddress && <p className="text-xs text-gray-500 whitespace-pre-line">{doc.customerAddress}</p>}
            {doc.customerGST && <p className="text-xs text-gray-500 mt-0.5">GSTIN: {doc.customerGST}</p>}
            {doc.placeOfSupply && <p className="text-xs text-gray-500">Place of Supply: {doc.placeOfSupply}</p>}
          </div>

          {/* Items table */}
          <div className="mb-4 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-amber-700 text-white">
                  <th className="p-2 text-left">#</th>
                  <th className="p-2 text-left">Description</th>
                  <th className="p-2 text-center">HSN</th>
                  <th className="p-2 text-center">Qty</th>
                  <th className="p-2 text-right">Rate</th>
                  <th className="p-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(doc.items || []).map((item, i) => {
                  const prod = products.find(p => p.id === item.productId);
                  const amt = (Number(item.quantity)||0) * (Number(item.unitPrice)||0);
                  return (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-amber-50/30'}>
                      <td className="p-2 text-gray-500">{i+1}</td>
                      <td className="p-2">
                        <p className="font-semibold text-gray-800">{item.description}</p>
                        <p className="text-gray-400">{item.unit}</p>
                      </td>
                      <td className="p-2 text-center text-gray-500">{item.hsnCode || '6810'}</td>
                      <td className="p-2 text-center font-semibold">{item.quantity}</td>
                      <td className="p-2 text-right">{cur(Number(item.unitPrice)||0)}</td>
                      <td className="p-2 text-right font-bold text-gray-800">{cur(amt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{cur(subtotal)}</span></div>
            {discAmt > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>- {cur(discAmt)}</span></div>}
            {cgst > 0 && <div className="flex justify-between text-gray-600"><span>CGST ({Number(doc.taxRate)/2}%)</span><span>{cur(cgst)}</span></div>}
            {sgst > 0 && <div className="flex justify-between text-gray-600"><span>SGST ({Number(doc.taxRate)/2}%)</span><span>{cur(sgst)}</span></div>}
            {igst > 0 && <div className="flex justify-between text-gray-600"><span>IGST ({doc.taxRate}%)</span><span>{cur(igst)}</span></div>}
            <div className="flex justify-between font-bold text-amber-700 text-base border-t-2 border-amber-700 pt-2">
              <span>Total</span><span>{cur(total)}</span>
            </div>
            {!isQuote && Number(doc.paidAmount) > 0 && (
              <>
                <div className="flex justify-between text-green-600"><span>Paid</span><span>- {cur(Number(doc.paidAmount))}</span></div>
                <div className="flex justify-between font-bold text-red-600 border-t border-red-200 pt-1">
                  <span>Balance Due</span><span>{cur(Math.max(0, total - Number(doc.paidAmount)))}</span>
                </div>
              </>
            )}
          </div>

          {/* Amount in words */}
          <p className="text-xs text-gray-500 italic mt-3">
            Amount in words: <span className="font-semibold">{toWords(total)}</span>
          </p>

          {/* Notes */}
          {doc.notes && (
            <div className="mt-4 text-xs text-gray-600 bg-gray-50 rounded-xl p-3">
              <p className="font-bold text-gray-400 uppercase text-[10px] mb-1">Notes</p>
              <p>{doc.notes}</p>
            </div>
          )}

          {/* Terms */}
          {isQuote && doc.terms && (
            <div className="mt-4 border-t border-gray-100 pt-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Terms &amp; Conditions</p>
              <p className="text-xs text-gray-500 whitespace-pre-line">{doc.terms}</p>
            </div>
          )}

          {/* Signing Authorities — Authorised Signatory only */}
          <div className="mt-8 pt-5 border-t border-gray-200 flex justify-end">
            <div className="w-1/3 text-center sign-box">
              {ci.signature && <img src={ci.signature} alt="Signature" className="h-10 mx-auto mb-1 object-contain" />}
              <div className="border-t border-gray-400 pt-1.5">
                <p className="text-[10px] font-bold text-gray-600">Authorised Signatory</p>
                <p className="text-[9px] text-gray-400 mt-0.5">For {coName}</p>
              </div>
            </div>
          </div>

          <p className="text-center text-[10px] text-gray-300 mt-5">Generated by Urbanmud Manufacturing Ops</p>
        </div>
      </div>
    </div>
  );
}

// ── Enquiries ─────────────────────────────────────────────────────────────────
const ENQ_STATUS = {
  open:      { label: 'Open',      color: 'bg-blue-100 text-blue-700'   },
  confirmed: { label: 'Confirmed', color: 'bg-green-100 text-green-700' },
  converted: { label: 'Converted', color: 'bg-purple-100 text-purple-700' },
  lost:      { label: 'Lost',      color: 'bg-gray-100 text-gray-500'   },
};

function freshEnquiry() {
  return {
    date: todayISO(), firmName: '', phone: '', email: '', location: '',
    enquiredItems: [{ productId: '', customProduct: '', quantity: '' }],
    expectedDate: '', remarks: '', status: 'open',
  };
}

function EnquiriesTab({ doAdd, onAddDone }) {
  const app     = useApp();
  const canWrite = app.currentUser?.role === 'admin' || app.currentUser?.role === 'accountant';
  const [showModal, setShowModal] = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [form,      setForm]      = useState(freshEnquiry);
  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFrom,   setFilterFrom]   = useState('');
  const [filterTo,     setFilterTo]     = useState('');

  useEffect(() => { if (doAdd) { openAdd(); onAddDone?.(); } }, [doAdd]);

  function openAdd()       { setForm(freshEnquiry()); setEditing(null); setShowModal(true); }
  function openEdit(enq)   { setForm({ ...enq, enquiredItems: enq.enquiredItems?.length ? [...enq.enquiredItems] : [{ productId: '', customProduct: '', quantity: '' }] }); setEditing(enq); setShowModal(true); }
  function setItem(i,k,v)  { setForm(f => { const items = [...f.enquiredItems]; items[i] = { ...items[i], [k]: v }; return { ...f, enquiredItems: items }; }); }
  function addItemRow()    { setForm(f => ({ ...f, enquiredItems: [{ productId: '', customProduct: '', quantity: '' }, ...f.enquiredItems] })); }
  function removeItemRow(i){ setForm(f => ({ ...f, enquiredItems: f.enquiredItems.filter((_,idx) => idx !== i) })); }

  function save() {
    if (!form.firmName.trim()) return alert('Name / Firm is required.');
    if (!form.phone.trim())    return alert('Contact number is required.');
    const clean = { ...form, enquiredItems: form.enquiredItems.filter(it => it.productId || it.customProduct.trim()) };
    if (editing) app.updateItem('enquiries', editing.id, clean);
    else         app.addItem('enquiries', clean);
    setShowModal(false);
  }

  const all = [...(app.enquiries || [])];
  const filtered = all
    .filter(e => !filterStatus || e.status === filterStatus)
    .filter(e => !filterFrom  || e.date >= filterFrom)
    .filter(e => !filterTo    || e.date <= filterTo)
    .filter(e => {
      if (!search) return true;
      const s = search.toLowerCase();
      return e.firmName?.toLowerCase().includes(s)
          || e.phone?.toLowerCase().includes(s)
          || e.email?.toLowerCase().includes(s)
          || e.location?.toLowerCase().includes(s)
          || e.remarks?.toLowerCase().includes(s)
          || (e.enquiredItems||[]).some(it => it.customProduct?.toLowerCase().includes(s)
              || app.products?.find(p => p.id === it.productId)?.name?.toLowerCase().includes(s));
    })
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return (
    <div className="px-4 pt-3 pb-24">
      {/* Search + Add */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input type="text" placeholder="Search name, phone, location…"
            className={`${inputCls} pl-9`}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {canWrite && (
          <button onClick={openAdd}
            className="bg-amber-700 text-white rounded-xl px-4 flex items-center gap-1.5 text-sm font-semibold shrink-0 active:scale-95 transition-transform">
            <Plus size={15}/> Add
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 mb-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Filter size={12} className="text-amber-700"/>
          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Filter</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" className={inputCls} placeholder="From" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
          <input type="date" className={inputCls} placeholder="To"   value={filterTo}   onChange={e => setFilterTo(e.target.value)} />
          <select className={`${selectCls} col-span-2`} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {Object.entries(ENQ_STATUS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyCard icon="📋" label="No enquiries found"
          sub={search || filterStatus || filterFrom ? 'Clear filters to see all' : 'Tap Add to record your first enquiry'} />
      ) : (
        <div className="space-y-3">
          {filtered.map(enq => {
            const st = ENQ_STATUS[enq.status] || ENQ_STATUS.open;
            const itemLabels = (enq.enquiredItems||[]).map(it =>
              it.productId ? (app.products?.find(p => p.id === it.productId)?.name || it.productId) : it.customProduct
            ).filter(Boolean);
            return (
              <div key={enq.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="font-semibold text-gray-800 text-sm">{enq.firmName}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                    </div>
                    {enq.location && <p className="text-xs text-gray-500">📍 {enq.location}</p>}
                    <p className="text-xs text-gray-500">📞 {enq.phone}{enq.email ? ` · ${enq.email}` : ''}</p>
                    {itemLabels.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {itemLabels.map((l,i) => {
                          const qty = enq.enquiredItems?.[i]?.quantity;
                          return (
                            <span key={i} className="text-[10px] bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full">
                              {l}{qty ? ` ×${qty}` : ''}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {enq.expectedDate && <p className="text-xs text-gray-400 mt-1">🗓 Expected: {fmtDate(enq.expectedDate)}</p>}
                    {enq.remarks && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 italic">"{enq.remarks}"</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {canWrite && (
                      <button onClick={() => openEdit(enq)} className="p-1.5 text-blue-500 active:scale-95">
                        <Pencil size={14}/>
                      </button>
                    )}
                    {canWrite && (
                      <button onClick={() => { if (confirm('Delete this enquiry?')) app.deleteItem('enquiries', enq.id); }}
                        className="p-1.5 text-red-400 active:scale-95">
                        <Trash2 size={14}/>
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                  <p className="text-[10px] text-gray-400">{fmtDate(enq.date)}</p>
                  {canWrite && (
                    <select
                      className="text-[10px] border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600"
                      value={enq.status}
                      onChange={e => app.updateItem('enquiries', enq.id, { status: e.target.value })}>
                      {Object.entries(ENQ_STATUS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <Modal title={editing ? 'Edit Enquiry' : 'New Enquiry'} onClose={() => setShowModal(false)}>
          <Field label="Date" required>
            <input type="date" className={inputCls} value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </Field>
          <Field label="Firm / Organisation / Person" required>
            <input type="text" className={inputCls} placeholder="Name of firm or contact…"
              value={form.firmName} onChange={e => setForm(f => ({ ...f, firmName: e.target.value }))} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone" required>
              <input type="tel" className={inputCls} placeholder="Contact number"
                value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </Field>
            <Field label="Email">
              <input type="email" className={inputCls} placeholder="email@…"
                value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </Field>
          </div>
          <Field label="Location">
            <input type="text" className={inputCls} placeholder="City / area…"
              value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          </Field>

          {/* Products enquired */}
          <div className="mt-1">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-700">Products Enquired</p>
              <button type="button" onClick={addItemRow}
                className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 font-semibold flex items-center gap-1">
                <Plus size={11}/> Add Item
              </button>
            </div>
            <div className="space-y-2">
              {form.enquiredItems.map((it, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-2.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <select
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                      value={it.productId}
                      onChange={e => { setItem(i, 'productId', e.target.value); if (e.target.value !== '__others__') setItem(i, 'customProduct', ''); }}>
                      <option value="" disabled>— Select product —</option>
                      {(app.products||[]).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      <option value="__others__">Others (enter manually)</option>
                    </select>
                    <button type="button" onClick={() => removeItemRow(i)} className="text-red-400 p-1 shrink-0"><X size={14}/></button>
                  </div>
                  {it.productId === '__others__' && (
                    <input type="text" placeholder="Enter product name…"
                      className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                      value={it.customProduct}
                      onChange={e => setItem(i, 'customProduct', e.target.value)} />
                  )}
                  <input type="number" placeholder="Quantity" min="0"
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                    value={it.quantity}
                    onChange={e => setItem(i, 'quantity', e.target.value)} />
                </div>
              ))}
            </div>
          </div>

          <Field label="Expected Order Date">
            <input type="date" className={inputCls} value={form.expectedDate}
              onChange={e => setForm(f => ({ ...f, expectedDate: e.target.value }))} />
          </Field>
          <Field label="Remarks">
            <textarea className={inputCls} rows={3} placeholder="Additional notes…"
              value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} />
          </Field>
          <Field label="Status">
            <select className={selectCls} value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              {Object.entries(ENQ_STATUS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <SaveBtn onClick={save} />
        </Modal>
      )}
    </div>
  );
}
