import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import { BarChart2, TrendingUp, TrendingDown, Package, Factory, Layers, Send, ChevronDown } from 'lucide-react';
import { fmtDate } from '../utils/date';

function fmt(n) { return new Intl.NumberFormat('en-IN').format(n || 0); }

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

export default function Reports() {
  const app = useApp();
  const isSuperAdmin = app.currentUser?.username === 'lbawoor';
  const [preset, setPreset] = useState('today');
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
    const token = localStorage.getItem('gh_token');
    const repo  = localStorage.getItem('gh_repo') || 'lagamannabawoor/manufacture-ops';
    if (!token) { setSendMsg('⚠️ Configure GitHub token in Settings → Cloud Sync first'); return; }
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

  const prodEntries = app.productionEntries.filter(e => inRange(e.date));
  const matPurchases = app.materialPurchases.filter(p => inRange(p.date));
  const laborPays = app.laborPayments.filter(p => inRange(p.date));
  const orderPays = app.orderPayments.filter(p => inRange(p.date));
  const expenses = app.expenses.filter(e => inRange(e.date));

  const totalUnits = prodEntries.reduce((s, e) => s + Number(e.quantity || 0), 0);
  const totalCementUsed = prodEntries.reduce((s, e) => s + Number(e.cementBags || 0), 0);
  const totalMaterialCost = matPurchases.reduce((s, p) => s + Number(p.totalAmount || 0), 0);
  const totalLaborCost = laborPays.reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalIncome = orderPays.filter(p => p.direction === 'received').reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalOut = totalMaterialCost + totalLaborCost + totalExpenses;
  const netPL = totalIncome - totalOut;

  const productionByProduct = {};
  prodEntries.forEach(e => {
    if (!productionByProduct[e.productId]) productionByProduct[e.productId] = { units: 0, cement: 0 };
    productionByProduct[e.productId].units += Number(e.quantity || 0);
    productionByProduct[e.productId].cement += Number(e.cementBags || 0);
  });

  const byAccount = app.bankAccounts.map(acc => {
    const income = orderPays.filter(p => p.direction === 'received' && p.bankAccountId === acc.id).reduce((s, p) => s + Number(p.amount || 0), 0);
    const labor = laborPays.filter(p => p.bankAccountId === acc.id).reduce((s, p) => s + Number(p.amount || 0), 0);
    const exp = expenses.filter(e => e.bankAccountId === acc.id).reduce((s, e) => s + Number(e.amount || 0), 0);
    const mat = matPurchases.filter(p => p.bankAccountId === acc.id).reduce((s, p) => s + Number(p.totalAmount || 0), 0);
    const out = labor + exp + mat;
    return { ...acc, income, out, net: income - out };
  }).filter(a => a.income > 0 || a.out > 0);

  const cementStock = (() => {
    const purchased = app.materialPurchases.filter(p => p.materialTypeId === 'm1').reduce((s, p) => s + Number(p.quantity || 0), 0);
    const used = app.productionEntries.reduce((s, e) => s + Number(e.cementBags || 0), 0);
    return purchased - used;
  })();

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
      <Header title="Reports" subtitle="Consolidated financial & production" />

      <div className="px-4 py-4">
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

        {/* P&L Summary */}
        <div className={`rounded-xl p-4 mb-4 ${netPL >= 0 ? 'bg-green-600' : 'bg-red-600'} text-white`}>
          <p className="text-sm opacity-80 mb-1">Net P&L</p>
          <p className="text-3xl font-bold">{netPL >= 0 ? '+' : ''}₹{fmt(Math.abs(netPL))}</p>
          <div className="flex gap-4 mt-3 pt-3 border-t border-white/20 text-sm">
            <div>
              <p className="opacity-70 text-xs">Income</p>
              <p className="font-semibold">₹{fmt(totalIncome)}</p>
            </div>
            <div>
              <p className="opacity-70 text-xs">Expenses</p>
              <p className="font-semibold">₹{fmt(totalOut)}</p>
            </div>
          </div>
        </div>

        {/* Production Summary */}
        <SectionCard title="Production Summary" icon={<Factory size={16} className="text-blue-500" />}>
          <Row label="Units Produced" value={`${fmt(totalUnits)} pcs`} />
          <Row label="Cement Consumed" value={`${fmt(totalCementUsed)} bags`} />
          <Row label="Cement in Stock" value={`${fmt(cementStock)} bags`} />
          {Object.keys(productionByProduct).length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-50">
              <p className="text-xs font-semibold text-gray-500 mb-2">By Product</p>
              {Object.entries(productionByProduct).map(([pid, data]) => {
                const product = app.products.find(p => p.id === pid);
                return (
                  <div key={pid} className="flex justify-between items-center py-1.5">
                    <span className="text-sm text-gray-600">{product?.name || 'Unknown'}</span>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-gray-800">{fmt(data.units)} pcs</span>
                      <span className="text-xs text-gray-400 ml-2">{data.cement} bags</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* Financial Breakdown */}
        <SectionCard title="Financial Breakdown" icon={<TrendingUp size={16} className="text-green-500" />}>
          <Row label="Order Payments Received" value={`₹${fmt(totalIncome)}`} valueClass="text-green-600" />
          <div className="mt-2 pt-2 border-t border-gray-50">
            <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Outflows</p>
            <Row label="Material Purchases" value={`₹${fmt(totalMaterialCost)}`} valueClass="text-red-500" />
            <Row label="Labor Payments" value={`₹${fmt(totalLaborCost)}`} valueClass="text-red-500" />
            <Row label="Other Expenses" value={`₹${fmt(totalExpenses)}`} valueClass="text-red-500" />
            <div className="flex justify-between items-center pt-2 border-t border-gray-100 mt-2">
              <span className="text-sm font-bold text-gray-700">Total Outflow</span>
              <span className="font-bold text-red-600">₹{fmt(totalOut)}</span>
            </div>
          </div>
        </SectionCard>

        {/* Expense Breakdown */}
        {expenses.length > 0 && (
          <SectionCard title="Expense Breakdown" icon={<TrendingDown size={16} className="text-red-400" />}>
            {app.expenseCategories.map(cat => {
              const total = expenses.filter(e => e.categoryId === cat.id).reduce((s, e) => s + Number(e.amount || 0), 0);
              if (!total) return null;
              return <Row key={cat.id} label={cat.name} value={`₹${fmt(total)}`} valueClass="text-red-500" />;
            })}
          </SectionCard>
        )}

        {/* Per Bank Account */}
        {byAccount.length > 0 && (
          <SectionCard title="By Bank Account" icon={<BarChart2 size={16} className="text-indigo-500" />}>
            {byAccount.map(acc => (
              <div key={acc.id} className="py-2.5 border-b border-gray-50 last:border-0">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-semibold text-gray-700">{acc.name}</p>
                  <p className={`text-sm font-bold ${acc.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {acc.net >= 0 ? '+' : ''}₹{fmt(acc.net)}
                  </p>
                </div>
                <div className="flex gap-4 mt-1 text-xs text-gray-400">
                  <span className="text-green-600">In: ₹{fmt(acc.income)}</span>
                  <span className="text-red-500">Out: ₹{fmt(acc.out)}</span>
                </div>
              </div>
            ))}
          </SectionCard>
        )}

        {/* Material Purchases */}
        {matPurchases.length > 0 && (
          <SectionCard title="Material Purchases" icon={<Package size={16} className="text-amber-500" />}>
            <Row label="Total Amount" value={`₹${fmt(totalMaterialCost)}`} valueClass="text-red-500" />
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
                      {amt > 0 && <span className="text-xs text-gray-400 ml-2">₹{fmt(amt)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}

function SectionCard({ title, icon, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      {children}
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
