import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import Modal, { Field, inputCls, selectCls, SaveBtn } from '../components/Modal';
import { Plus, Trash2, Eye, Pencil, Printer, FileText, Receipt, ArrowRight, X, Download, Share2, Loader } from 'lucide-react';
import { fmtDate, todayISO } from '../utils/date';
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
    discountValue: '', discountType: 'flat', notes: '', terms: STANDARD_TERMS, status: 'draft' };
}
function freshInvoice(fromQuote) {
  const today = todayISO();
  const base = { invoiceNumber: genDocId('INV'), date: today, dueDate: addDays(today, 7),
    quoteRef: '', customerName: '', customerPhone: '', customerAddress: '', customerGST: '',
    placeOfSupply: '', items: [freshItem()], taxType: 'cgst_sgst', taxRate: '18',
    discountValue: '', discountType: 'flat', paymentTerms: 'due_on_delivery', notes: '',
    status: 'draft', paidAmount: '' };
  if (!fromQuote) return base;
  return { ...base, quoteRef: fromQuote.quoteNumber, customerName: fromQuote.customerName,
    customerPhone: fromQuote.customerPhone, customerAddress: fromQuote.customerAddress,
    customerGST: fromQuote.customerGST, taxType: fromQuote.taxType, taxRate: fromQuote.taxRate,
    discountValue: fromQuote.discountValue, discountType: fromQuote.discountType,
    items: fromQuote.items.map(i => ({ ...i, _key: Date.now() + Math.random() })) };
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function Sales() {
  const app = useApp();
  const canWrite = (app.currentUser?.role === 'admin' || app.currentUser?.role === 'accountant');
  const [activeTab, setActiveTab] = useState('quotes');
  const [modalType, setModalType] = useState(null); // 'quote' | 'invoice'
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [prefill, setPrefill] = useState(null);

  const quotes   = [...(app.quotes   || [])].sort((a, b) => b.date?.localeCompare(a.date));
  const invoices = [...(app.invoices || [])].sort((a, b) => b.date?.localeCompare(a.date));

  function openCreate(type, pre) {
    setEditing(null); setPrefill(pre || null);
    setModalType(type); setActiveTab(type === 'quote' ? 'quotes' : 'invoices');
  }
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
      <Header title="Sales" subtitle="Quotes & Invoices"
        action={canWrite && (
          <div className="flex gap-1">
            <button onClick={() => openCreate('quote')}
              className="bg-white/20 hover:bg-white/30 text-white rounded-full p-2" title="New Quote">
              <FileText size={18} />
            </button>
            <button onClick={() => openCreate('invoice')}
              className="bg-white/20 hover:bg-white/30 text-white rounded-full p-2" title="New Invoice">
              <Receipt size={18} />
            </button>
          </div>
        )}
      />

      {/* Tabs */}
      <div className="flex px-4 pt-4 gap-2">
        {[{ id: 'quotes', label: `Quotes (${(app.quotes||[]).length})` },
          { id: 'invoices', label: `Invoices (${(app.invoices||[]).length})` }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${activeTab === t.id ? 'bg-amber-700 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 space-y-3">
        {activeTab === 'quotes' ? (
          quotes.length === 0
            ? <EmptyCard icon="📄" label="No Quotes Yet" sub="Tap the document icon to create a quote" />
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
        ) : (
          invoices.length === 0
            ? <EmptyCard icon="🧾" label="No Invoices Yet" sub="Tap the receipt icon to create an invoice" />
            : invoices.map(inv => {
                const { total, subtotal } = calcDoc(inv.items||[], inv.taxType, inv.taxRate, inv.discountValue, inv.discountType);
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
              })
        )}
      </div>

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
  const isQuote = type === 'quote';
  const defaultForm = isQuote ? freshQuote() : freshInvoice();
  const [form, setForm] = useState(() => initial ? { ...defaultForm, ...initial } : defaultForm);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function addItem() { setForm(f => ({ ...f, items: [...f.items, freshItem()] })); }
  function removeItem(key) { setForm(f => ({ ...f, items: f.items.filter(i => i._key !== key) })); }
  function updateItem(key, k, v) {
    setForm(f => ({
      ...f,
      items: f.items.map(i => {
        if (i._key !== key) return i;
        const updated = { ...i, [k]: v };
        if (k === 'productId' && v) {
          const prod = products.find(p => p.id === v);
          if (prod) { updated.description = prod.name; updated.unit = prod.unit || 'pieces'; }
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
    const hasItems = form.items.some(i => i.description && Number(i.quantity) > 0);
    if (!hasItems) return alert('Add at least one item with description and quantity.');
    onSave({ ...form });
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
            <Field label="Address">
              <textarea className={inputCls} rows={2} placeholder="Street, City, State, Pincode" value={form.customerAddress} onChange={e => set('customerAddress', e.target.value)} />
            </Field>
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
              <Plus size={14} /> Add Row
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

function buildPDF(docData, type, ci) {
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
  const A  = [146, 64, 14];    // amber
  const DK = [30, 30, 30];     // dark
  const MD = [90, 90, 90];     // mid
  const LT = [190, 190, 190];  // light
  const rp = (n) => 'Rs.' + fmt(n); // jsPDF standard fonts can't render ₹

  let y = ML;
  const needPage = (h) => { if (y + h > H - 18) { pdf.addPage(); y = ML; } };

  // ─── HEADER ────────────────────────────────────────────────────────────────
  pdf.setFontSize(16); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...A);
  pdf.text(coName.toUpperCase(), ML, y + 7);
  pdf.setFontSize(13); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...DK);
  pdf.text(isQ ? 'QUOTATION' : 'TAX INVOICE', W - MR, y + 7, { align: 'right' });
  y += 10;

  if (coTagline) {
    pdf.setFontSize(7.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...MD);
    pdf.text(coTagline, ML, y); y += 4;
  }
  pdf.setFontSize(8.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...MD);
  coAddress.split('\n').forEach(l => { pdf.text(l, ML, y); y += 4; });
  if (coPhone) { pdf.text('Ph: ' + coPhone, ML, y); y += 4; }
  if (coEmail) { pdf.text(coEmail, ML, y); y += 4; }
  if (coGSTIN) {
    pdf.setFont('helvetica', 'bold');
    pdf.text('GSTIN: ' + coGSTIN, ML, y);
    pdf.setFont('helvetica', 'normal'); y += 4;
  }

  // Doc meta (right column, positioned at top)
  const metaX = W - MR, metaYStart = 22;
  pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...A);
  pdf.text(docNo, metaX, metaYStart, { align: 'right' });
  pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...MD);
  pdf.text('Date: ' + (docData.date || ''), metaX, metaYStart + 5, { align: 'right' });
  let metaOffset = metaYStart + 10;
  if (isQ && docData.validUntil) {
    pdf.text('Valid Until: ' + docData.validUntil, metaX, metaOffset, { align: 'right' }); metaOffset += 5;
  }
  if (!isQ && docData.dueDate) {
    pdf.text('Due Date: ' + docData.dueDate, metaX, metaOffset, { align: 'right' }); metaOffset += 5;
  }
  if (!isQ && docData.quoteRef) {
    pdf.text('Quote Ref: ' + docData.quoteRef, metaX, metaOffset, { align: 'right' }); metaOffset += 5;
  }
  const payLabel = PAYMENT_TERMS_OPTIONS.find(p => p.id === docData.paymentTerms)?.label || docData.paymentTerms || '';
  if (payLabel) {
    pdf.text('Terms: ' + payLabel, metaX, metaOffset, { align: 'right' }); metaOffset += 5;
  }

  y = Math.max(y, metaOffset) + 4;
  pdf.setDrawColor(...A); pdf.setLineWidth(0.6);
  pdf.line(ML, y, W - MR, y); y += 7;

  // ─── BILL TO ───────────────────────────────────────────────────────────────
  needPage(30);
  pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...LT);
  pdf.text('BILL TO', ML, y); y += 4.5;
  pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...DK);
  pdf.text(docData.customerName || '—', ML, y); y += 5;
  pdf.setFontSize(8.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...MD);
  if (docData.customerPhone) { pdf.text(docData.customerPhone, ML, y); y += 4; }
  if (docData.customerAddress) {
    docData.customerAddress.split('\n').forEach(l => { pdf.text(l, ML, y); y += 4; });
  }
  if (docData.customerGST) { pdf.text('GSTIN: ' + docData.customerGST, ML, y); y += 4; }
  if (docData.placeOfSupply) { pdf.text('Place of Supply: ' + docData.placeOfSupply, ML, y); y += 4; }
  y += 4;

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
    margin: { left: ML, right: MR },
    headStyles: { fillColor: A, textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold', cellPadding: 3.5 },
    bodyStyles: { fontSize: 8.5, textColor: DK, cellPadding: 3 },
    alternateRowStyles: { fillColor: [255, 248, 235] },
    columnStyles: {
      0: { cellWidth: 8,  halign: 'center' },
      2: { cellWidth: 16, halign: 'center' },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 12, halign: 'right'  },
      5: { cellWidth: 25, halign: 'right'  },
      6: { cellWidth: 27, halign: 'right'  },
    },
    styles: { overflow: 'linebreak' },
    showFoot: 'never',
  });
  y = pdf.lastAutoTable.finalY + 7;

  // ─── TOTALS ────────────────────────────────────────────────────────────────
  needPage(55);
  const TW = 78, TX = W - MR - TW;
  const trow = (label, val, bold = false, color = MD) => {
    pdf.setFontSize(9); pdf.setFont('helvetica', bold ? 'bold' : 'normal'); pdf.setTextColor(...color);
    pdf.text(label, TX, y); pdf.text(val, W - MR, y, { align: 'right' }); y += 5.5;
  };
  trow('Subtotal', rp(subtotal));
  if (discAmt > 0) trow('Discount', '- ' + rp(discAmt), false, [22, 163, 74]);
  if (cgst > 0) trow('CGST (' + (Number(docData.taxRate)/2) + '%)', rp(cgst));
  if (sgst > 0) trow('SGST (' + (Number(docData.taxRate)/2) + '%)', rp(sgst));
  if (igst > 0) trow('IGST (' + docData.taxRate + '%)', rp(igst));
  pdf.setDrawColor(...A); pdf.setLineWidth(0.4); pdf.line(TX, y, W - MR, y); y += 4;
  trow('TOTAL', rp(total), true, A);
  if (!isQ && Number(docData.paidAmount) > 0) {
    trow('Paid', '- ' + rp(Number(docData.paidAmount)), false, [22, 163, 74]);
    trow('Balance Due', rp(Math.max(0, total - Number(docData.paidAmount))), true, [220, 38, 38]);
  }
  y += 5;

  // ─── AMOUNT IN WORDS ───────────────────────────────────────────────────────
  needPage(12);
  pdf.setFontSize(8); pdf.setFont('helvetica', 'italic'); pdf.setTextColor(...MD);
  const wl = pdf.splitTextToSize('Amount in words: ' + toWords(total), CW);
  pdf.text(wl, ML, y); y += wl.length * 4.5 + 5;

  // ─── NOTES ─────────────────────────────────────────────────────────────────
  if (docData.notes) {
    needPage(20);
    pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...LT);
    pdf.text('NOTES', ML, y); y += 4;
    pdf.setFontSize(8.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...MD);
    const nl = pdf.splitTextToSize(docData.notes, CW);
    pdf.text(nl, ML, y); y += nl.length * 4.2 + 5;
  }

  // ─── TERMS ─────────────────────────────────────────────────────────────────
  if (isQ && docData.terms) {
    needPage(24);
    pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...LT);
    pdf.text('TERMS & CONDITIONS', ML, y); y += 4;
    pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...MD);
    const tl = pdf.splitTextToSize(docData.terms, CW);
    pdf.text(tl, ML, y); y += tl.length * 4 + 5;
  }

  // ─── SIGNING AUTHORITIES ───────────────────────────────────────────────────
  needPage(38);
  y += 5;
  pdf.setDrawColor(...LT); pdf.setLineWidth(0.3);
  pdf.line(ML, y, W - MR, y); y += 15;
  const sw = CW / 3;
  [['Customer Signature', 'Name & Seal'], ['Prepared By', ''], ['Authorised Signatory', 'For ' + coName]]
    .forEach(([label, sub], i) => {
      const cx = ML + i * sw + sw / 2;
      pdf.setDrawColor(...MD); pdf.setLineWidth(0.4);
      pdf.line(cx - sw/2 + 6, y, cx + sw/2 - 6, y);
      pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...DK);
      pdf.text(label, cx, y + 5, { align: 'center' });
      if (sub) {
        pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...MD);
        pdf.text(sub, cx, y + 9, { align: 'center' });
      }
    });

  // ─── PAGE FOOTER ───────────────────────────────────────────────────────────
  const tp = pdf.internal.getNumberOfPages();
  for (let p = 1; p <= tp; p++) {
    pdf.setPage(p);
    pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...LT);
    pdf.text('Generated by Urbanmud Manufacturing Ops  |  Page ' + p + ' of ' + tp, W/2, H - 8, { align: 'center' });
  }

  return pdf;
}

// ── View / Print document ─────────────────────────────────────────────────────
function DocViewer({ doc, type, products, companyInfo, onClose, onConvert, onEdit }) {
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
      const pdf = buildPDF(doc, type, ci);
      pdf.save(`${docNo}.pdf`);
    } catch (e) { alert('Could not generate PDF: ' + e.message); }
    finally { setPdfBusy(null); }
  }

  async function handleShare() {
    setPdfBusy('share');
    try {
      const pdf = buildPDF(doc, type, ci);
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

          {/* Signing Authorities */}
          <div className="mt-8 pt-5 border-t border-gray-200">
            <div className="grid grid-cols-3 gap-4 text-center">
              {[{ label: 'Customer Signature', sub: 'Name & Seal' },
                { label: 'Prepared By',        sub: '' },
                { label: 'Authorised Signatory', sub: `For ${coName}` }].map(s => (
                <div key={s.label} className="sign-box">
                  <div className="h-10" />
                  <div className="border-t border-gray-400 pt-1.5">
                    <p className="text-[10px] font-bold text-gray-600">{s.label}</p>
                    {s.sub && <p className="text-[9px] text-gray-400 mt-0.5">{s.sub}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-center text-[10px] text-gray-300 mt-5">Generated by Urbanmud Manufacturing Ops</p>
        </div>
      </div>
    </div>
  );
}
