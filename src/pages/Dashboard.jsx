import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  TrendingUp, TrendingDown, Package, Layers, DollarSign,
  Hammer, ChevronRight, CalendarDays, Building2, AlertTriangle,
  ShoppingBag, Users, Receipt, BarChart2, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { fmtDate, todayISO } from '../utils/date';

function fmt(n) { return new Intl.NumberFormat('en-IN').format(n || 0); }
function cur(n) { return '₹' + fmt(n); }

export default function Dashboard({ navigate }) {
  const app = useApp();
  const t = todayISO();
  const [activeSection, setActiveSection] = useState('today');

  // ── Today's data ──────────────────────────────────────────────────────
  const todayProd     = app.productionEntries.filter(e => e.date === t);
  const todayCement   = todayProd.reduce((s, e) => s + Number(e.cementBags || 0), 0);
  const todayUnits    = todayProd.reduce((s, e) => s + Number(e.quantity || 0), 0);
  const todayIncome   = app.orderPayments.filter(p => p.date === t && p.direction === 'received').reduce((s, p) => s + Number(p.amount || 0), 0);
  const todayLaborCost    = app.laborPayments.filter(p => p.date === t).reduce((s, p) => s + Number(p.amount || 0), 0);
  const todayExpenses     = app.expenses.filter(e => e.date === t).reduce((s, e) => s + Number(e.amount || 0), 0);
  const todayMaterialCost = app.materialPurchases.filter(p => p.date === t).reduce((s, p) => s + Number(p.totalAmount || 0), 0);
  const todayOut  = todayLaborCost + todayExpenses + todayMaterialCost;
  const netToday  = todayIncome - todayOut;

  // ── Stock levels ──────────────────────────────────────────────────────
  const stockLevels = app.materialTypes.map(mat => {
    const purchased = app.materialPurchases.filter(p => p.materialTypeId === mat.id).reduce((s, p) => s + Number(p.quantity || 0), 0);
    const used = mat.id === 'm1' ? app.productionEntries.reduce((s, e) => s + Number(e.cementBags || 0), 0) : 0;
    return { ...mat, purchased, used, stock: purchased - used };
  });

  // ── Orders summary ────────────────────────────────────────────────────
  const pendingOrders   = app.orders.filter(o => o.status === 'pending').length;
  const inProgressOrders = app.orders.filter(o => o.status === 'in_progress').length;
  const pendingOrderValue = app.orders
    .filter(o => o.status !== 'completed')
    .reduce((s, o) => {
      const received = app.orderPayments.filter(p => p.orderId === o.id && p.direction === 'received').reduce((a, p) => a + Number(p.amount || 0), 0);
      return s + Math.max(0, Number(o.totalAmount || 0) - received);
    }, 0);

  // ── Production by factory today ───────────────────────────────────────
  const byFactory = app.factories.map(f => ({
    ...f,
    units: todayProd.filter(e => e.factoryId === f.id).reduce((s, e) => s + Number(e.quantity || 0), 0),
    cement: todayProd.filter(e => e.factoryId === f.id).reduce((s, e) => s + Number(e.cementBags || 0), 0),
  })).filter(f => f.units > 0);

  // ── Last 7 days trend ─────────────────────────────────────────────────
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const units = app.productionEntries.filter(e => e.date === d).reduce((s, e) => s + Number(e.quantity || 0), 0);
    const income = app.orderPayments.filter(p => p.date === d && p.direction === 'received').reduce((s, p) => s + Number(p.amount || 0), 0);
    return { date: d, units, income };
  }).reverse();

  const recentProduction = [...app.productionEntries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const recentPayments   = [...app.orderPayments].filter(p => p.direction === 'received').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="bg-gradient-to-br from-amber-800 to-amber-950 px-4 pt-10 pb-8 text-white">
        <p className="text-amber-300 text-xs mb-2 flex items-center gap-1.5">
          <CalendarDays size={12} /> {dateStr}
        </p>
        <h1 className="text-2xl font-bold tracking-wide">Urbanmud</h1>
        <p className="text-amber-200 text-sm mt-0.5">Manufacturing Operations</p>

        {/* Today's key metrics inline */}
        <div className="grid grid-cols-3 gap-2 mt-5">
          {[
            { label: 'Units Today', value: fmt(todayUnits), icon: Layers },
            { label: 'Income', value: cur(todayIncome), icon: TrendingUp },
            { label: 'Net P&L', value: `${netToday >= 0 ? '+' : ''}${cur(netToday)}`, icon: netToday >= 0 ? ArrowUpRight : ArrowDownRight },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-white/15 rounded-xl p-3 text-center backdrop-blur-sm">
              <Icon size={14} className="mx-auto mb-1 text-amber-200" />
              <p className="text-white font-bold text-base leading-tight">{value}</p>
              <p className="text-amber-300 text-[10px] mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 -mt-3">

        {/* Section tabs */}
        <div className="flex bg-white rounded-xl shadow-sm border border-gray-100 p-1 mb-4">
          {[['today', 'Today'], ['stock', 'Stock'], ['orders', 'Orders']].map(([id, label]) => (
            <button key={id} onClick={() => setActiveSection(id)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                activeSection === id ? 'bg-amber-700 text-white shadow-sm' : 'text-gray-500'
              }`}>{label}</button>
          ))}
        </div>

        {/* ── TODAY SECTION ─────────────────────────────────────── */}
        {activeSection === 'today' && (
          <>
            {/* Cash flow card */}
            <div className={`rounded-xl p-4 mb-4 ${netToday >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-600">Today's Net P&L</p>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${netToday >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {netToday >= 0 ? 'Profit' : 'Loss'}
                </span>
              </div>
              <p className={`text-3xl font-bold ${netToday >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {netToday >= 0 ? '+' : ''}{cur(netToday)}
              </p>
              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-200">
                <div className="text-center">
                  <p className="text-xs text-gray-400">Labor</p>
                  <p className="text-xs font-bold text-red-600">{cur(todayLaborCost)}</p>
                </div>
                <div className="text-center border-x border-gray-200">
                  <p className="text-xs text-gray-400">Materials</p>
                  <p className="text-xs font-bold text-red-600">{cur(todayMaterialCost)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">Expenses</p>
                  <p className="text-xs font-bold text-red-600">{cur(todayExpenses)}</p>
                </div>
              </div>
            </div>

            {/* Production today */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4">
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <div className="flex items-center gap-2">
                  <Hammer size={15} className="text-amber-600" />
                  <h2 className="text-sm font-semibold text-gray-700">Today's Production</h2>
                </div>
                <button onClick={() => navigate('production')} className="text-amber-700 text-xs flex items-center gap-0.5">
                  All <ChevronRight size={13} />
                </button>
              </div>
              {todayProd.length === 0 ? (
                <p className="text-xs text-gray-400 px-4 pb-4">No production recorded today</p>
              ) : (
                <>
                  <div className="px-4 pb-3 grid grid-cols-2 gap-2">
                    <div className="bg-amber-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Units Produced</p>
                      <p className="text-xl font-bold text-amber-800">{fmt(todayUnits)}</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Cement Used</p>
                      <p className="text-xl font-bold text-orange-700">{fmt(todayCement)} bags</p>
                    </div>
                  </div>
                  {byFactory.length > 0 && (
                    <div className="px-4 pb-4">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">By Factory</p>
                      <div className="space-y-2">
                        {byFactory.map(f => (
                          <div key={f.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                            <div className="flex items-center gap-2">
                              <Building2 size={13} className="text-gray-400" />
                              <span className="text-sm font-medium text-gray-700">{f.name}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-bold text-gray-800">{fmt(f.units)} units</span>
                              <span className="text-xs text-gray-400 ml-2">{f.cement} bags</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 7-day trend */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4 p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart2 size={15} className="text-blue-500" />
                <h2 className="text-sm font-semibold text-gray-700">Last 7 Days — Production</h2>
              </div>
              <div className="flex items-end gap-1.5 h-16">
                {(() => {
                  const max = Math.max(...last7.map(d => d.units), 1);
                  return last7.map(d => (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t-sm bg-amber-500 transition-all"
                        style={{ height: `${Math.max(4, (d.units / max) * 52)}px` }}
                        title={`${fmtDate(d.date)}: ${fmt(d.units)} units`}
                      />
                      <span className="text-[8px] text-gray-400">{d.date.slice(8)}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* Recent payments */}
            {recentPayments.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4">
                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={15} className="text-green-600" />
                    <h2 className="text-sm font-semibold text-gray-700">Recent Payments</h2>
                  </div>
                  <button onClick={() => navigate('finance')} className="text-amber-700 text-xs flex items-center gap-0.5">
                    All <ChevronRight size={13} />
                  </button>
                </div>
                <div className="divide-y divide-gray-50">
                  {recentPayments.map(p => {
                    const order = app.orders.find(o => o.id === p.orderId);
                    return (
                      <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{order?.customerName || 'Customer'}</p>
                          <p className="text-xs text-gray-400">{fmtDate(p.date)}</p>
                        </div>
                        <p className="text-sm font-bold text-green-600">+{cur(p.amount)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4 p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-2">
                <ActionBtn label="Add Production" icon={Hammer}      color="bg-amber-700"  onClick={() => navigate('production')} />
                <ActionBtn label="Add Material"   icon={Package}     color="bg-blue-600"   onClick={() => navigate('materials')} />
                <ActionBtn label="Record Payment" icon={TrendingUp}  color="bg-green-600"  onClick={() => navigate('finance')} />
                <ActionBtn label="Add Expense"    icon={Receipt}     color="bg-red-500"    onClick={() => navigate('finance')} />
              </div>
            </div>
          </>
        )}

        {/* ── STOCK SECTION ─────────────────────────────────────── */}
        {activeSection === 'stock' && (
          <div className="space-y-3 mb-4">
            {stockLevels.map(mat => {
              const pct = mat.purchased > 0 ? (mat.stock / mat.purchased) * 100 : 0;
              const isLow = pct < 20 && mat.purchased > 0;
              return (
                <div key={mat.id} className={`bg-white rounded-xl shadow-sm border p-4 ${isLow ? 'border-red-200' : 'border-gray-100'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isLow ? 'bg-red-50' : 'bg-amber-50'}`}>
                        <Package size={17} className={isLow ? 'text-red-500' : 'text-amber-500'} />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{mat.name}</p>
                        <p className="text-xs text-gray-400">{mat.unit}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-bold ${mat.stock > 0 ? 'text-gray-800' : 'text-red-600'}`}>{fmt(mat.stock)}</p>
                      <p className="text-xs text-gray-400">in stock</p>
                    </div>
                  </div>
                  {isLow && (
                    <div className="flex items-center gap-1.5 bg-red-50 rounded-lg px-3 py-1.5 mb-2">
                      <AlertTriangle size={12} className="text-red-500" />
                      <span className="text-xs text-red-600 font-medium">Low stock — reorder soon</span>
                    </div>
                  )}
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1.5">
                    <div className={`h-1.5 rounded-full transition-all ${isLow ? 'bg-red-500' : 'bg-amber-500'}`}
                      style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span>Purchased: {fmt(mat.purchased)}</span>
                    {mat.used > 0 && <span>Used: {fmt(mat.used)}</span>}
                    <span>{Math.round(pct)}% remaining</span>
                  </div>
                </div>
              );
            })}
            <button onClick={() => navigate('materials')}
              className="w-full py-3 bg-amber-700 text-white font-semibold rounded-xl text-sm">
              + Add Material Purchase
            </button>
          </div>
        )}

        {/* ── ORDERS SECTION ────────────────────────────────────── */}
        {activeSection === 'orders' && (
          <div className="mb-4">
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                ['Pending', pendingOrders, 'bg-amber-50 text-amber-700 border-amber-200'],
                ['In Progress', inProgressOrders, 'bg-blue-50 text-blue-700 border-blue-200'],
                ['Due Amount', cur(pendingOrderValue), 'bg-red-50 text-red-700 border-red-200'],
              ].map(([label, value, cls]) => (
                <div key={label} className={`rounded-xl p-3 text-center border ${cls}`}>
                  <p className="text-lg font-bold">{value}</p>
                  <p className="text-[10px] mt-0.5 opacity-70">{label}</p>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              {app.orders.filter(o => o.status !== 'completed').slice(0, 8).map(order => {
                const product = app.products.find(p => p.id === order.productId);
                const received = app.orderPayments.filter(p => p.orderId === order.id && p.direction === 'received').reduce((s, p) => s + Number(p.amount || 0), 0);
                const balance = Number(order.totalAmount || 0) - received;
                const statusCls = order.status === 'in_progress' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700';
                return (
                  <div key={order.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{order.customerName}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{product?.name || ''} · {fmt(order.quantity)} units</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${statusCls}`}>
                        {order.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                      <div className="flex gap-3 text-xs">
                        <span className="text-gray-400">Total: <span className="font-semibold text-gray-700">{cur(order.totalAmount)}</span></span>
                        <span className="text-gray-400">Rcvd: <span className="font-semibold text-green-600">{cur(received)}</span></span>
                      </div>
                      {balance > 0 && (
                        <span className="text-xs font-bold text-red-500">Due: {cur(balance)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {app.orders.filter(o => o.status !== 'completed').length === 0 && (
                <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-gray-100">
                  <ShoppingBag size={36} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">No active orders</p>
                </div>
              )}
              <button onClick={() => navigate('finance')}
                className="w-full py-3 bg-amber-700 text-white font-semibold rounded-xl text-sm">
                Manage Orders & Payments
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionBtn({ label, icon: Icon, color, onClick }) {
  return (
    <button onClick={onClick}
      className={`${color} text-white text-sm font-semibold py-3 px-3 rounded-xl w-full active:scale-95 transition-transform flex items-center justify-center gap-2`}
    >
      <Icon size={15} /> {label}
    </button>
  );
}
