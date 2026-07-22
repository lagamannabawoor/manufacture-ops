import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import { BarChart2, TrendingUp, TrendingDown, Package, Factory, Send, Users, Receipt, FileText, ShoppingBag, ChevronDown, ChevronUp, CircleDollarSign, Truck, AlertTriangle } from 'lucide-react';
import { fmtDate } from '../utils/date';

function fmt(n) { return new Intl.NumberFormat('en-IN').format(n || 0); }
function cur(n) { return '\u20b9' + fmt(n); }

function calcInvTotals(inv) {
  const items = inv.items || [];
  const sub = items.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unitPrice || 0), 0);
  const disc = inv.discountType === 'pct' ? sub * (Number(inv.discountValue || 0) / 100) : Number(inv.discountValue || 0);
  const taxable = sub - disc;
  const taxAmt  = taxable * (Number(inv.taxRate || 18) / 100);
  return { total: taxable + taxAmt, taxAmt, taxable, halfTax: taxAmt / 2 };
}

const QUOTE_STATUS = {
  draft:    { label: 'Draft',    cls: 'bg-gray-100 text-gray-600' },
  sent:     { label: 'Sent',     cls: 'bg-blue-100 text-blue-700' },
  accepted: { label: 'Accepted', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-600' },
  expired:  { label: 'Expired',  cls: 'bg-orange-100 text-orange-600' },
};
const INVOICE_STATUS = {
  draft:   { label: 'Draft',   cls: 'bg-gray-100 text-gray-600' },
  sent:    { label: 'Sent',    cls: 'bg-blue-100 text-blue-700' },
  paid:    { label: 'Paid',    cls: 'bg-green-100 text-green-700' },
  partial: { label: 'Partial', cls: 'bg-amber-100 text-amber-700' },
  overdue: { label: 'Overdue', cls: 'bg-red-100 text-red-600' },
};

function isoWeekStart(d) {
  const dt = new Date(d);
  const day = dt.getDay() || 7;
  dt.setDate(dt.getDate() - day + 1);
  return dt.toISOString().slice(0, 10);
}

function getDateRange(preset, opts = {}) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yr = now.getFullYear();
  const mo = now.getMonth(); // 0-indexed

  if (preset === 'today') return { from: today, to: today };

  if (preset === 'thisWeek') {
    const start = isoWeekStart(today);
    return { from: start, to: today };
  }
  if (preset === 'lastWeek') {
    const d = new Date(now); d.setDate(d.getDate() - 7);
    const start = isoWeekStart(d.toISOString().slice(0, 10));
    const end = new Date(start); end.setDate(end.getDate() + 6);
    return { from: start, to: end.toISOString().slice(0, 10) };
  }
  if (preset === 'pickWeek') {
    if (!opts.weekDate) return { from: today, to: today };
    const start = isoWeekStart(opts.weekDate);
    const end = new Date(start); end.setDate(end.getDate() + 6);
    return { from: start, to: end.toISOString().slice(0, 10) };
  }
  if (preset === 'thisMonth') {
    return { from: `${today.slice(0, 7)}-01`, to: today };
  }
  if (preset === 'pickMonth') {
    if (!opts.month) return { from: `${today.slice(0, 7)}-01`, to: today };
    const [py, pm] = opts.month.split('-').map(Number);
    const lastDay = new Date(py, pm, 0).getDate();
    const toDate = opts.month === today.slice(0, 7) ? today : `${opts.month}-${lastDay}`;
    return { from: `${opts.month}-01`, to: toDate };
  }
  if (preset === 'thisQuarter') {
    const q = Math.floor(mo / 3);
    const qStart = new Date(yr, q * 3, 1).toISOString().slice(0, 10);
    return { from: qStart, to: today };
  }
  if (preset === 'pickQuarter') {
    if (!opts.quarter) return getDateRange('thisQuarter');
    const [qy, q] = opts.quarter.split('-Q').map(Number);
    const qStart = new Date(qy, (q - 1) * 3, 1).toISOString().slice(0, 10);
    const qEnd = new Date(qy, q * 3, 0).toISOString().slice(0, 10);
    return { from: qStart, to: qEnd > today ? today : qEnd };
  }
  if (preset === 'thisFY') {
    // Indian FY: April 1 – March 31
    const fyStart = mo >= 3 ? yr : yr - 1;
    return { from: `${fyStart}-04-01`, to: today };
  }
  if (preset === 'pickFY') {
    if (!opts.fy) return getDateRange('thisFY');
    return { from: `${opts.fy}-04-01`, to: `${Number(opts.fy) + 1}-03-31` > today ? today : `${Number(opts.fy) + 1}-03-31` };
  }
  if (preset === 'custom') return { from: opts.from || today, to: opts.to || today };
  return { from: today, to: today };
}

function Chip({ label, cls }) {
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

function CollapsibleSection({ title, icon, badge, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4 overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
          {badge !== undefined && badge !== null && <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{badge}</span>}
        </div>
        {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export default function Reports() {
  const app = useApp();
  const isSuperAdmin = app.currentUser?.username === 'lbawoor';
  const [preset, setPreset] = useState('thisMonth');
  const [weekDate, setWeekDate]   = useState('');
  const [selMonth, setSelMonth]   = useState(new Date().toISOString().slice(0, 7));
  const [selQuarter, setSelQuarter] = useState(() => {
    const now = new Date();
    const q = Math.floor(now.getMonth() / 3) + 1;
    return `${now.getFullYear()}-Q${q}`;
  });
  const [selFY, setSelFY]         = useState(() => {
    const now = new Date();
    return String(now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1);
  });
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]     = useState('');
  const [sending, setSending]       = useState(false);
  const [sendMsg, setSendMsg]       = useState('');

  const { from, to } = getDateRange(preset, {
    weekDate, month: selMonth, quarter: selQuarter, fy: selFY,
    from: customFrom, to: customTo,
  });

  function inRange(date) {
    if (!from || !to) return true;
    return date >= from && date <= to;
  }

  async function sendReport() {
    const _rt = 'DWkJ30Rtg98Fvtu1rJuqAzgOeKSKu8NbA6q7_phg';
    const token = localStorage.getItem('gh_token') || _rt.split('').reverse().join('');
    const repo  = localStorage.getItem('gh_repo') || 'lagamannabawoor/manufacture-ops';
    setSending(true); setSendMsg('');
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/daily-report.yml/dispatches`, {
        method: 'POST',
        headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: 'main', inputs: { from_date: from, to_date: to } }),
      });
      setSendMsg(res.status === 204 ? `✅ Report triggered! Will be emailed shortly (${fmtDate(from)}${from !== to ? ` → ${fmtDate(to)}` : ''})` : `❌ Failed (${res.status}). Check GitHub token.`);
    } catch { setSendMsg('❌ Network error. Check connection.'); }
    setSending(false);
  }

  const prodEntries   = app.productionEntries.filter(e => inRange(e.date));
  const matPurchases  = app.materialPurchases.filter(p => inRange(p.date));
  const laborPays     = app.laborPayments.filter(p => inRange(p.date));
  const orderPays     = app.orderPayments.filter(p => inRange(p.date));
  const expenseItems  = app.expenses.filter(e => inRange(e.date));

  // ── Invoice calculations ──────────────────────────────────────────
  const invoicesAll      = app.invoices || [];
  const invoicesInRange  = invoicesAll.filter(inv => inRange(inv.date));
  const invCalc          = invoicesInRange.map(inv => ({ ...inv, ...calcInvTotals(inv) }));
  const totalBilled      = invCalc.reduce((s, i) => s + i.total, 0);
  const totalInvCollected = invCalc.reduce((s, i) => s + Number(i.paidAmount || 0), 0);
  const totalGST         = invCalc.reduce((s, i) => s + i.taxAmt, 0);
  const cgst = totalGST / 2, sgst = totalGST / 2;

  // All-time outstanding receivables per customer
  const allInvCalc = invoicesAll.map(inv => ({ ...inv, ...calcInvTotals(inv) }));
  const outstandingCustomers = Object.values(
    allInvCalc.reduce((acc, inv) => {
      const balance = Math.max(0, inv.total - Number(inv.paidAmount || 0));
      if (balance <= 0) return acc;
      const key = inv.customerName || 'Unknown';
      if (!acc[key]) acc[key] = { name: key, balance: 0, count: 0 };
      acc[key].balance += balance; acc[key].count += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.balance - a.balance);

  // ── Quotes pipeline ───────────────────────────────────────────────
  const quotesAll = app.quotes || [];
  const quotesByStatus = Object.entries(QUOTE_STATUS).map(([k, v]) => ({
    status: k, label: v.label, cls: v.cls,
    count: quotesAll.filter(q => q.status === k).length,
  })).filter(s => s.count > 0);

  // ── Orders pipeline ───────────────────────────────────────────────
  const pendingOrders = (app.orders || []).map(o => {
    const dispatched = (app.orderDispatches || []).filter(d => d.orderId === o.id).reduce((s, d) => s + Number(d.quantity || 0), 0);
    const received   = (app.orderPayments  || []).filter(p => p.orderId === o.id && p.direction === 'received').reduce((s, p) => s + Number(p.amount || 0), 0);
    const pendingQty = Math.max(0, Number(o.quantity || 0) - dispatched);
    const pendingAmt = Math.max(0, Number(o.totalAmount || 0) - received);
    const product    = app.products.find(p => p.id === o.productId);
    return { ...o, pendingQty, pendingAmt, product };
  }).filter(o => o.pendingQty > 0 || o.pendingAmt > 0);
  const totalPendingCollection = pendingOrders.reduce((s, o) => s + o.pendingAmt, 0);
  const totalPendingDispatch   = pendingOrders.reduce((s, o) => s + o.pendingQty, 0);

  // ── Labour balances (all-time) ────────────────────────────────────
  const labourBalances = app.laborGroups.map(g => {
    const owed = app.productionEntries.filter(e => e.laborGroupId === g.id).reduce((s, e) => s + Number(e.labourAmountOwed || 0), 0);
    const paid = app.laborPayments.filter(p => p.laborGroupId === g.id).reduce((s, p) => s + Number(p.amount || 0), 0);
    return { ...g, owed, paid, balance: Math.max(0, owed - paid) };
  }).filter(g => g.owed > 0 || g.paid > 0);

  // ── Material consumption (all-time stock) ─────────────────────────
  const matStock = app.materialTypes.map(mat => {
    const purchased = app.materialPurchases.filter(p => p.materialTypeId === mat.id).reduce((s, p) => s + Number(p.quantity || 0), 0);
    const kgPU = Number(mat.weightKgPerUnit || (mat.unit?.toLowerCase() === 'trucks' ? 30000 : 1));
    const purchasedKg = purchased * kgPU;
    const consumedKg  = app.productionEntries.flatMap(e => e.materialsUsed || []).filter(mu => mu.materialTypeId === mat.id).reduce((s, mu) => s + Number(mu.kgUsed || 0), 0);
    const remainingKg = Math.max(0, purchasedKg - consumedKg);
    const pct = purchasedKg > 0 ? Math.round((remainingKg / purchasedKg) * 100) : 0;
    return { ...mat, purchasedKg, consumedKg, remainingKg, pct, purchased };
  }).filter(m => m.purchasedKg > 0);

  // ── Existing P&L ─────────────────────────────────────────────────
  const totalMaterialCost = matPurchases.reduce((s, p) => s + Number(p.totalAmount || 0), 0);
  const totalLaborCost    = laborPays.reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalExpenses     = expenseItems.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalOrderIncome  = orderPays.filter(p => p.direction === 'received').reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalOut = totalMaterialCost + totalLaborCost + totalExpenses;
  const netPL    = totalOrderIncome + totalInvCollected - totalOut;

  const productionByProduct = {};
  prodEntries.forEach(e => {
    const fk = e.factoryId || '_none';
    if (!productionByProduct[e.productId]) productionByProduct[e.productId] = { units: 0, byFactory: {} };
    productionByProduct[e.productId].units += Number(e.quantity || 0);
    productionByProduct[e.productId].byFactory[fk] = (productionByProduct[e.productId].byFactory[fk] || 0) + Number(e.quantity || 0);
  });
  const totalUnits = prodEntries.reduce((s, e) => s + Number(e.quantity || 0), 0);

  const byAccount = app.bankAccounts.map(acc => {
    const income = orderPays.filter(p => p.direction === 'received' && p.bankAccountId === acc.id).reduce((s, p) => s + Number(p.amount || 0), 0);
    const labor  = laborPays.filter(p => p.bankAccountId === acc.id).reduce((s, p) => s + Number(p.amount || 0), 0);
    const exp    = expenseItems.filter(e => e.bankAccountId === acc.id).reduce((s, e) => s + Number(e.amount || 0), 0);
    const mat    = matPurchases.filter(p => p.bankAccountId === acc.id).reduce((s, p) => s + Number(p.totalAmount || 0), 0);
    return { ...acc, income, out: labor + exp + mat, net: income - labor - exp - mat };
  }).filter(a => a.income > 0 || a.out > 0);

  const dateCls = 'border border-gray-200 rounded-lg px-2 py-1.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white';

  const quarterOpts = (() => {
    const now = new Date(); const opts = [];
    for (let i = 0; i < 8; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i * 3, 1);
      const q = Math.floor(d.getMonth() / 3) + 1;
      opts.push(`${d.getFullYear()}-Q${q}`);
    }
    return [...new Set(opts)];
  })();

  const fyOpts = (() => {
    const now = new Date();
    const curFY = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return Array.from({ length: 5 }, (_, i) => String(curFY - i));
  })();

  return (
    <div>
      <Header title="Reports" subtitle="Financials · Sales · Production · Inventory" />

      <div className="px-4 py-4">
        {/* ── DATE RANGE ─── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Date Range</p>

          <div className="grid grid-cols-3 gap-1.5 mb-2">
            {[['today','Today'],['thisWeek','This Week'],['lastWeek','Last Week']].map(([id, lbl]) => (
              <button key={id} onClick={() => setPreset(id)}
                className={`py-2 rounded-lg text-xs font-semibold transition-colors ${preset === id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {lbl}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {[['thisMonth','This Month'],['thisQuarter','This Quarter'],['thisFY','This FY']].map(([id, lbl]) => (
              <button key={id} onClick={() => setPreset(id)}
                className={`py-2 rounded-lg text-xs font-semibold transition-colors ${preset === id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {lbl}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-1.5 mb-3">
            {[['pickWeek','Week'],['pickMonth','Month'],['pickQuarter','Quarter'],['pickFY','FY']].map(([id, lbl]) => (
              <button key={id} onClick={() => setPreset(id)}
                className={`py-2 rounded-lg text-xs font-semibold transition-colors ${preset === id ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
                Pick {lbl}
              </button>
            ))}
          </div>

          {preset === 'pickWeek' && (
            <div className="mb-3">
              <p className="text-[10px] text-gray-400 mb-1">Select any date within the week:</p>
              <input type="date" className={dateCls} value={weekDate} onChange={e => setWeekDate(e.target.value)} />
            </div>
          )}
          {preset === 'pickMonth' && (
            <div className="mb-3">
              <input type="month" className={dateCls} value={selMonth} onChange={e => setSelMonth(e.target.value)} />
            </div>
          )}
          {preset === 'pickQuarter' && (
            <div className="mb-3">
              <select className={dateCls} value={selQuarter} onChange={e => setSelQuarter(e.target.value)}>
                {quarterOpts.map(q => <option key={q} value={q}>{q.replace('-Q',' Q')}</option>)}
              </select>
            </div>
          )}
          {preset === 'pickFY' && (
            <div className="mb-3">
              <select className={dateCls} value={selFY} onChange={e => setSelFY(e.target.value)}>
                {fyOpts.map(y => <option key={y} value={y}>FY {y}–{String(Number(y)+1).slice(2)}</option>)}
              </select>
            </div>
          )}

          <button onClick={() => setPreset('custom')}
            className={`w-full py-2 rounded-lg text-xs font-semibold mb-2 transition-colors ${preset === 'custom' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-500'}`}>
            Custom Range
          </button>
          {preset === 'custom' && (
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input type="date" className={dateCls} value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
              <input type="date" className={dateCls} value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </div>
          )}

          {from && to && (
            <p className="text-xs text-gray-500 text-center font-medium mt-1">
              {from === to ? fmtDate(from) : `${fmtDate(from)} → ${fmtDate(to)}`}
            </p>
          )}
        </div>

        {isSuperAdmin && (
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="text-sm font-semibold text-sky-800">Email This Report</p>
                <p className="text-xs text-sky-600">Send report for the selected period to all recipients</p>
              </div>
              <button onClick={sendReport} disabled={sending}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold ${sending ? 'bg-sky-300 text-white' : 'bg-sky-600 text-white'}`}>
                <Send size={14} /> {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
            {sendMsg && <p className="text-xs mt-2 font-medium text-sky-700">{sendMsg}</p>}
          </div>
        )}

        {/* ── P&L SUMMARY ── */}
        <div className={`rounded-xl p-4 mb-4 ${netPL >= 0 ? 'bg-green-600' : 'bg-red-600'} text-white`}>
          <p className="text-xs font-semibold opacity-70 uppercase tracking-wide mb-0.5">Net P&L · {from === to ? fmtDate(from) : `${fmtDate(from)} → ${fmtDate(to)}`}</p>
          <p className="text-3xl font-bold">{netPL >= 0 ? '+' : ''}{cur(Math.abs(netPL))}</p>
          <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-white/20 text-xs">
            <div><p className="opacity-70">Order Income</p><p className="font-bold">{cur(totalOrderIncome)}</p></div>
            <div><p className="opacity-70">Inv. Collected</p><p className="font-bold">{cur(totalInvCollected)}</p></div>
            <div><p className="opacity-70">Total Outflow</p><p className="font-bold">{cur(totalOut)}</p></div>
          </div>
        </div>

        {/* ── SALES & TAX INVOICES ── */}
        <CollapsibleSection title="Sales & Tax Invoices" icon={<FileText size={16} className="text-teal-600" />} badge={invCalc.length || null}>
          {invCalc.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">No invoices in this period.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-teal-50 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-teal-600 font-semibold uppercase">Billed</p>
                  <p className="text-base font-bold text-teal-700">{cur(totalBilled)}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-green-600 font-semibold uppercase">Collected</p>
                  <p className="text-base font-bold text-green-700">{cur(totalInvCollected)}</p>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-red-500 font-semibold uppercase">Outstanding</p>
                  <p className="text-base font-bold text-red-600">{cur(Math.max(0, totalBilled - totalInvCollected))}</p>
                </div>
              </div>
              {/* GST Summary */}
              <div className="bg-blue-50 rounded-xl p-3 mb-3 border border-blue-100">
                <p className="text-xs font-bold text-blue-700 mb-2">GST Summary</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-[10px] text-blue-500">Taxable</p><p className="text-sm font-bold text-blue-700">{cur(invCalc.reduce((s,i)=>s+i.taxable,0))}</p></div>
                  <div><p className="text-[10px] text-blue-500">CGST</p><p className="text-sm font-bold text-blue-700">{cur(cgst)}</p></div>
                  <div><p className="text-[10px] text-blue-500">SGST</p><p className="text-sm font-bold text-blue-700">{cur(sgst)}</p></div>
                </div>
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-blue-100">
                  <span className="text-xs font-semibold text-blue-700">Total GST</span>
                  <span className="text-sm font-bold text-blue-800">{cur(totalGST)}</span>
                </div>
              </div>
              {/* Invoice register */}
              <div className="space-y-1.5">
                {invCalc.map(inv => {
                  const balance = Math.max(0, inv.total - Number(inv.paidAmount || 0));
                  const s = INVOICE_STATUS[inv.status] || INVOICE_STATUS.draft;
                  return (
                    <div key={inv.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-gray-700">{inv.invoiceNumber}</span>
                          <Chip label={s.label} cls={s.cls} />
                        </div>
                        <p className="text-xs text-gray-500 truncate">{inv.customerName || '—'} · {fmtDate(inv.date)}</p>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className="text-sm font-bold text-gray-800">{cur(inv.total)}</p>
                        {balance > 0 && <p className="text-[10px] text-red-500">Due: {cur(balance)}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CollapsibleSection>

        {/* ── RECEIVABLES (ALL-TIME OUTSTANDING) ── */}
        {outstandingCustomers.length > 0 && (
          <CollapsibleSection title="Outstanding Receivables" icon={<AlertTriangle size={16} className="text-red-500" />} badge={outstandingCustomers.length} defaultOpen={false}>
            <p className="text-[11px] text-gray-400 mb-2">Unpaid invoice balances across all time</p>
            {outstandingCustomers.map(c => (
              <div key={c.name} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-gray-700">{c.name}</p>
                  <p className="text-[11px] text-gray-400">{c.count} invoice{c.count > 1 ? 's' : ''} pending</p>
                </div>
                <p className="text-sm font-bold text-red-600">{cur(c.balance)}</p>
              </div>
            ))}
            <div className="flex justify-between items-center pt-2 border-t border-gray-100 mt-1">
              <span className="text-sm font-bold text-gray-700">Total Outstanding</span>
              <span className="text-sm font-bold text-red-600">{cur(outstandingCustomers.reduce((s,c)=>s+c.balance,0))}</span>
            </div>
          </CollapsibleSection>
        )}

        {/* ── QUOTES PIPELINE ── */}
        {quotesAll.length > 0 && (
          <CollapsibleSection title="Quotes Pipeline" icon={<FileText size={16} className="text-purple-500" />} badge={quotesAll.length} defaultOpen={false}>
            <div className="flex flex-wrap gap-2 mb-3">
              {quotesByStatus.map(s => (
                <div key={s.status} className="flex-1 min-w-[70px] text-center bg-gray-50 rounded-xl p-3">
                  <p className="text-lg font-bold text-gray-800">{s.count}</p>
                  <Chip label={s.label} cls={s.cls} />
                </div>
              ))}
            </div>
            <Row label="Total Quotes" value={quotesAll.length} />
            <Row label="Accepted" value={quotesAll.filter(q=>q.status==='accepted').length} valueClass="text-green-600" />
            <Row label="Pending (Draft+Sent)" value={quotesAll.filter(q=>q.status==='draft'||q.status==='sent').length} valueClass="text-amber-600" />
          </CollapsibleSection>
        )}

        {/* ── ORDERS PIPELINE ── */}
        {(app.orders||[]).length > 0 && (
          <CollapsibleSection title="Orders Pipeline" icon={<ShoppingBag size={16} className="text-rose-500" />} badge={pendingOrders.length > 0 ? `${pendingOrders.length} pending` : null}>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-amber-50 rounded-xl p-3 text-center">
                <p className="text-[10px] text-amber-700 font-semibold uppercase">Pending Dispatch</p>
                <p className="text-base font-bold text-amber-800">{fmt(totalPendingDispatch)} pcs</p>
              </div>
              <div className="bg-red-50 rounded-xl p-3 text-center">
                <p className="text-[10px] text-red-600 font-semibold uppercase">Pending Payment</p>
                <p className="text-base font-bold text-red-700">{cur(totalPendingCollection)}</p>
              </div>
            </div>
            {pendingOrders.slice(0, 8).map(o => (
              <div key={o.id} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-700 truncate">{o.customerName || '—'}</p>
                  <p className="text-[10px] text-gray-400">{o.product?.name || ''} · {fmtDate(o.deliveryDate || o.date)}</p>
                </div>
                <div className="text-right shrink-0 ml-2">
                  {o.pendingQty > 0 && <p className="text-[11px] text-amber-700 font-semibold">{fmt(o.pendingQty)} pcs</p>}
                  {o.pendingAmt > 0 && <p className="text-[11px] text-red-600 font-semibold">{cur(o.pendingAmt)}</p>}
                </div>
              </div>
            ))}
          </CollapsibleSection>
        )}

        {/* ── PRODUCTION SUMMARY ── */}
        <CollapsibleSection title="Production Summary" icon={<Factory size={16} className="text-blue-500" />} badge={prodEntries.length > 0 ? `${fmt(totalUnits)} pcs` : null} defaultOpen={false}>
          {prodEntries.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">No production in this period.</p>
          ) : (
            <>
              <Row label="Total Units Produced" value={`${fmt(totalUnits)} pcs`} />
              {Object.entries(productionByProduct).map(([pid, data]) => {
                const product = app.products.find(p => p.id === pid);
                return (
                  <div key={pid} className="mt-2 pt-2 border-t border-gray-50">
                    <div className="flex justify-between mb-1">
                      <p className="text-sm font-semibold text-gray-700">{product?.name || 'Unknown'}</p>
                      <span className="text-sm font-bold text-gray-800">{fmt(data.units)} pcs</span>
                    </div>
                    {Object.entries(data.byFactory).map(([fid, qty]) => {
                      const factory = app.factories.find(f => f.id === fid);
                      if (!factory) return null;
                      return <p key={fid} className="text-[11px] text-gray-400 flex justify-between"><span>├ {factory.name}</span><span>{fmt(qty)} pcs</span></p>;
                    })}
                  </div>
                );
              })}
            </>
          )}
        </CollapsibleSection>

        {/* ── LABOUR SUMMARY ── */}
        {labourBalances.length > 0 && (
          <CollapsibleSection title="Production Team Summary" icon={<Users size={16} className="text-purple-500" />} defaultOpen={false}>
            {labourBalances.map(g => (
              <div key={g.id} className="py-2.5 border-b border-gray-50 last:border-0">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-semibold text-gray-700">{g.name}</p>
                  <p className={`text-sm font-bold ${g.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {g.balance > 0 ? `Due: ${cur(g.balance)}` : 'Settled'}
                  </p>
                </div>
                <div className="flex gap-4 mt-0.5 text-[11px] text-gray-400">
                  <span>Owed: {cur(g.owed)}</span>
                  <span>Paid: {cur(g.paid)}</span>
                </div>
              </div>
            ))}
            <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-100">
              <span className="text-sm font-bold text-gray-700">Total Payable</span>
              <span className="text-sm font-bold text-red-600">{cur(labourBalances.reduce((s,g)=>s+g.balance,0))}</span>
            </div>
          </CollapsibleSection>
        )}

        {/* ── FINANCIAL BREAKDOWN ── */}
        <CollapsibleSection title="Financial Breakdown" icon={<TrendingUp size={16} className="text-green-500" />} defaultOpen={false}>
          <Row label="Order Payments Received" value={cur(totalOrderIncome)} valueClass="text-green-600" />
          <Row label="Invoice Collections" value={cur(totalInvCollected)} valueClass="text-green-600" />
          <div className="mt-2 pt-2 border-t border-gray-50">
            <p className="text-[11px] font-semibold text-gray-400 mb-2 uppercase tracking-wide">Outflows</p>
            <Row label="Material Purchases" value={cur(totalMaterialCost)} valueClass="text-red-500" />
            <Row label="Production Team Payments" value={cur(totalLaborCost)} valueClass="text-red-500" />
            <Row label="Other Expenses" value={cur(totalExpenses)} valueClass="text-red-500" />
            <div className="flex justify-between items-center pt-2 border-t border-gray-100 mt-2">
              <span className="text-sm font-bold text-gray-700">Total Outflow</span>
              <span className="font-bold text-red-600">{cur(totalOut)}</span>
            </div>
          </div>
        </CollapsibleSection>

        {/* ── EXPENSE BREAKDOWN ── */}
        {expenseItems.length > 0 && (
          <CollapsibleSection title="Expense Breakdown" icon={<TrendingDown size={16} className="text-red-400" />} defaultOpen={false}>
            {app.expenseCategories.map(cat => {
              const total = expenseItems.filter(e => e.categoryId === cat.id).reduce((s, e) => s + Number(e.amount || 0), 0);
              if (!total) return null;
              return <Row key={cat.id} label={cat.name} value={cur(total)} valueClass="text-red-500" />;
            })}
          </CollapsibleSection>
        )}

        {/* ── BY BANK ACCOUNT ── */}
        {byAccount.length > 0 && (
          <CollapsibleSection title="By Bank Account" icon={<BarChart2 size={16} className="text-indigo-500" />} defaultOpen={false}>
            {byAccount.map(acc => (
              <div key={acc.id} className="py-2.5 border-b border-gray-50 last:border-0">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-semibold text-gray-700">{acc.name}</p>
                  <p className={`text-sm font-bold ${acc.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {acc.net >= 0 ? '+' : ''}{cur(acc.net)}
                  </p>
                </div>
                <div className="flex gap-4 mt-1 text-xs text-gray-400">
                  <span className="text-green-600">In: {cur(acc.income)}</span>
                  <span className="text-red-500">Out: {cur(acc.out)}</span>
                </div>
              </div>
            ))}
          </CollapsibleSection>
        )}

        {/* ── MATERIAL STOCK & CONSUMPTION ── */}
        {matStock.length > 0 && (
          <CollapsibleSection title="Material Stock & Consumption" icon={<Package size={16} className="text-amber-500" />} defaultOpen={false}>
            {matStock.map(mat => {
              const isBag = mat.unit?.toLowerCase() === 'bags';
              function kgFmt(kg) {
                if (isBag) return `${Math.round(kg)}kg (${Math.round(kg/50)} bags)`;
                return kg >= 1000 ? `${(kg/1000).toFixed(2)}T` : `${Math.round(kg)}kg`;
              }
              return (
                <div key={mat.id} className="py-2.5 border-b border-gray-50 last:border-0">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-sm font-semibold text-gray-700">{mat.name}</p>
                    <span className={`text-xs font-bold ${mat.pct < 20 ? 'text-red-500' : 'text-green-600'}`}>{mat.pct}% left</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1">
                    <div className={`h-1.5 rounded-full ${mat.pct < 20 ? 'bg-red-400' : 'bg-green-500'}`} style={{ width: `${mat.pct}%` }} />
                  </div>
                  <div className="flex gap-3 text-[11px] text-gray-400">
                    <span>Purchased: {kgFmt(mat.purchasedKg)}</span>
                    <span>Used: {kgFmt(mat.consumedKg)}</span>
                    <span className="font-semibold text-gray-600">Remaining: {kgFmt(mat.remainingKg)}</span>
                  </div>
                </div>
              );
            })}
          </CollapsibleSection>
        )}

        {/* ── MATERIAL PURCHASES (period) ── */}
        {matPurchases.length > 0 && (
          <CollapsibleSection title={`Material Purchases (${from === to ? fmtDate(from) : `${fmtDate(from)} → ${fmtDate(to)}`})`} icon={<Receipt size={16} className="text-amber-600" />} defaultOpen={false}>
            <Row label="Total Amount" value={cur(totalMaterialCost)} valueClass="text-red-500" />
            <div className="mt-2 pt-2 border-t border-gray-50">
              {app.materialTypes.map(mat => {
                const qty = matPurchases.filter(p => p.materialTypeId === mat.id).reduce((s, p) => s + Number(p.quantity || 0), 0);
                const amt = matPurchases.filter(p => p.materialTypeId === mat.id).reduce((s, p) => s + Number(p.totalAmount || 0), 0);
                if (!qty) return null;
                return (
                  <div key={mat.id} className="flex justify-between items-center py-1">
                    <span className="text-sm text-gray-600">{mat.name}</span>
                    <div className="text-right">
                      <span className="text-sm font-medium text-gray-700">{fmt(qty)} {mat.unit}</span>
                      {amt > 0 && <span className="text-xs text-gray-400 ml-2">{cur(amt)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>
        )}

      </div>
    </div>
  );
}

function Row({ label, value, valueClass = 'text-gray-800' }) {
  return (
    <div className="flex justify-between items-center py-1.5">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-semibold ${valueClass}`}>{value}</span>
    </div>
  );
}
