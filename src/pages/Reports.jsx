import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import { BarChart2, TrendingUp, TrendingDown, Package, Factory, Layers } from 'lucide-react';

function fmt(n) { return new Intl.NumberFormat('en-IN').format(n || 0); }

function getDateRange(preset) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (preset === 'today') return { from: today, to: today };
  if (preset === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return { from: d.toISOString().slice(0, 10), to: today };
  }
  if (preset === 'month') {
    return { from: `${today.slice(0, 7)}-01`, to: today };
  }
  return { from: today, to: today };
}

export default function Reports() {
  const app = useApp();
  const [preset, setPreset] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const { from, to } = preset === 'custom'
    ? { from: customFrom, to: customTo }
    : getDateRange(preset);

  function inRange(date) {
    if (!from || !to) return true;
    return date >= from && date <= to;
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

  const presets = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'Last 7 Days' },
    { id: 'month', label: 'This Month' },
    { id: 'custom', label: 'Custom' },
  ];

  return (
    <div>
      <Header title="Reports" subtitle="Consolidated financial & production" />

      <div className="px-4 py-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Date Range</p>
          <div className="grid grid-cols-4 gap-1.5 mb-3">
            {presets.map(p => (
              <button
                key={p.id}
                onClick={() => setPreset(p.id)}
                className={`py-2 rounded-lg text-xs font-semibold transition-colors ${
                  preset === p.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="grid grid-cols-2 gap-2">
              <input type="date" className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
              <input type="date" className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </div>
          )}
          {from && to && from !== to && (
            <p className="text-xs text-gray-400 mt-2 text-center">{from} → {to}</p>
          )}
        </div>

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
