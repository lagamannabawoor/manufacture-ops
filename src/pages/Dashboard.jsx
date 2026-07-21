import React from 'react';
import { useApp } from '../context/AppContext';
import {
  TrendingUp, Package, Layers, DollarSign,
  Hammer, ChevronRight, CalendarDays, Building2, AlertTriangle,
  ShoppingBag, Users, Receipt, BarChart2, ArrowUpRight, ArrowDownRight,
  Boxes, FlaskConical, FileText, MessageSquare, Bell, Truck,
  CheckCircle2, Clock, CircleDollarSign, Factory,
} from 'lucide-react';
import { fmtDate, todayISO } from '../utils/date';
import UrbanmudLogo from '../components/UrbanmudLogo';

function fmt(n) { return new Intl.NumberFormat('en-IN').format(n || 0); }
function cur(n) { return '₹' + fmt(n); }

export default function Dashboard({ navigate }) {
  const app = useApp();
  const t = todayISO();
  const thisMonth = t.slice(0, 7);

  // ── Today ────────────────────────────────────────────────────────────
  const todayProd        = app.productionEntries.filter(e => e.date === t);
  const todayUnits       = todayProd.reduce((s, e) => s + Number(e.quantity || 0), 0);
  const todayIncome      = app.orderPayments.filter(p => p.date === t && p.direction === 'received').reduce((s, p) => s + Number(p.amount || 0), 0);
  const todayLaborCost   = app.laborPayments.filter(p => p.date === t).reduce((s, p) => s + Number(p.amount || 0), 0);
  const todayExpenses    = app.expenses.filter(e => e.date === t).reduce((s, e) => s + Number(e.amount || 0), 0);
  const todayMatCost     = app.materialPurchases.filter(p => p.date === t).reduce((s, p) => s + Number(p.totalAmount || 0), 0);
  const netToday         = todayIncome - (todayLaborCost + todayExpenses + todayMatCost);

  // ── Month-to-date ─────────────────────────────────────────────────────
  const mtdIncome   = app.orderPayments.filter(p => p.date?.startsWith(thisMonth) && p.direction === 'received').reduce((s, p) => s + Number(p.amount || 0), 0);
  const mtdCost     = app.expenses.filter(e => e.date?.startsWith(thisMonth)).reduce((s, e) => s + Number(e.amount || 0), 0)
                    + app.laborPayments.filter(p => p.date?.startsWith(thisMonth)).reduce((s, p) => s + Number(p.amount || 0), 0)
                    + app.materialPurchases.filter(p => p.date?.startsWith(thisMonth)).reduce((s, p) => s + Number(p.totalAmount || 0), 0);
  const mtdMargin   = mtdIncome > 0 ? (((mtdIncome - mtdCost) / mtdIncome) * 100).toFixed(0) : 0;

  // ── Receivables ───────────────────────────────────────────────────────
  const totalReceivables = app.orders.reduce((s, o) => {
    const rcvd = app.orderPayments.filter(p => p.orderId === o.id && p.direction === 'received').reduce((a, p) => a + Number(p.amount || 0), 0);
    const bal = Math.max(0, Number(o.totalAmount || 0) - rcvd);
    return s + bal;
  }, 0);

  // ── Alerts ────────────────────────────────────────────────────────────
  const pendingApprovals = (app.pendingProduction || []).length;
  const laborOwed = app.laborGroups.reduce((s, g) => {
    const owed = app.productionEntries.filter(e => e.laborGroupId === g.id).reduce((a, e) => a + Number(e.labourAmountOwed || 0), 0);
    const paid = app.laborPayments.filter(p => p.laborGroupId === g.id).reduce((a, p) => a + Number(p.amount || 0), 0);
    return s + Math.max(0, owed - paid);
  }, 0);
  const overdueOrders = app.orders.filter(o => {
    if (!o.deliveryDate || o.deliveryDate >= t) return false;
    const dispatched = (app.orderDispatches || []).filter(d => d.orderId === o.id).reduce((a, d) => a + Number(d.quantity || 0), 0);
    const rcvd = app.orderPayments.filter(p => p.orderId === o.id && p.direction === 'received').reduce((a, p) => a + Number(p.amount || 0), 0);
    return !(dispatched >= Number(o.quantity || 0) && rcvd >= Number(o.totalAmount || 0));
  }).length;
  const lowStockMats = app.materialTypes.filter(mat => {
    const purchased = app.materialPurchases.filter(p => p.materialTypeId === mat.id).reduce((s, p) => s + Number(p.quantity || 0), 0);
    if (purchased === 0) return false;
    const consumedKg = app.productionEntries.flatMap(e => e.materialsUsed || []).filter(mu => mu.materialTypeId === mat.id).reduce((s, mu) => s + Number(mu.kgUsed || 0), 0);
    const kgPU = Number(mat.weightKgPerUnit || (mat.unit?.toLowerCase() === 'trucks' ? 30000 : 1));
    const pct = ((purchased * kgPU - consumedKg) / (purchased * kgPU)) * 100;
    return pct < 20;
  });
  const totalAlerts = pendingApprovals + overdueOrders + lowStockMats.length;

  // ── Active orders ─────────────────────────────────────────────────────
  const activeOrders = app.orders.map(o => {
    const product     = app.products.find(p => p.id === o.productId);
    const dispatched  = (app.orderDispatches || []).filter(d => d.orderId === o.id).reduce((s, d) => s + Number(d.quantity || 0), 0);
    const received    = app.orderPayments.filter(p => p.orderId === o.id && p.direction === 'received').reduce((s, p) => s + Number(p.amount || 0), 0);
    const balance     = Math.max(0, Number(o.totalAmount || 0) - received);
    const dispPct     = Number(o.quantity || 0) > 0 ? Math.min(100, (dispatched / Number(o.quantity)) * 100) : 0;
    const isOverdue   = o.deliveryDate && o.deliveryDate < t;
    const isComplete  = dispatched >= Number(o.quantity || 0) && balance <= 0;
    return { ...o, product, dispatched, received, balance, dispPct, isOverdue, isComplete };
  }).filter(o => !o.isComplete).sort((a, b) => (a.deliveryDate || 'z').localeCompare(b.deliveryDate || 'z')).slice(0, 6);

  // ── Today's production per product ───────────────────────────────────
  const todayByProduct = app.products.map(prod => {
    const units = todayProd.filter(e => e.productId === prod.id).reduce((s, e) => s + Number(e.quantity || 0), 0);
    const cat   = app.productCategories?.find(c => c.id === prod.categoryId);
    return { ...prod, units, cat };
  }).filter(p => p.units > 0);

  // ── Finished goods per product ────────────────────────────────────────
  const finishedGoods = app.products.map(prod => {
    const produced   = app.productionEntries.filter(e => e.productId === prod.id).reduce((s, e) => s + Number(e.quantity || 0), 0);
    const dispatched = (app.orderDispatches || []).filter(d => {
      const o = app.orders.find(ord => ord.id === d.orderId);
      return o?.productId === prod.id;
    }).reduce((s, d) => s + Number(d.quantity || 0), 0);
    const pendingOrdQty = app.orders.filter(o => o.productId === prod.id).reduce((s, o) => {
      const d = (app.orderDispatches || []).filter(dd => dd.orderId === o.id).reduce((a, dd) => a + Number(dd.quantity || 0), 0);
      return s + Math.max(0, Number(o.quantity || 0) - d);
    }, 0);
    const inStock = Math.max(0, produced - dispatched);
    const cat     = app.productCategories?.find(c => c.id === prod.categoryId);
    return { ...prod, produced, dispatched, pendingOrdQty, inStock, cat };
  }).filter(p => p.produced > 0);

  // ── 7-day production trend ────────────────────────────────────────────
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d     = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const units = app.productionEntries.filter(e => e.date === d).reduce((s, e) => s + Number(e.quantity || 0), 0);
    return { date: d, units };
  }).reverse();

  // ── Recent receipts ───────────────────────────────────────────────────
  const recentReceipts = [...app.orderPayments]
    .filter(p => p.direction === 'received')
    .sort((a, b) => b.date?.localeCompare(a.date || ''))
    .slice(0, 4)
    .map(p => ({ ...p, order: app.orders.find(o => o.id === p.orderId) }));

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

  return (
    <div className="pb-6">

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-amber-800 to-amber-950 px-4 pt-10 pb-10 text-white">
        <p className="text-amber-300 text-xs mb-3 flex items-center gap-1.5">
          <CalendarDays size={12} /> {dateStr}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UrbanmudLogo size={44} />
            <div>
              <h1 className="text-xl font-bold tracking-wide leading-tight">Urbanmud</h1>
              <p className="text-amber-300 text-xs">Bricks &amp; Blocks Manufacturing</p>
            </div>
          </div>
          {totalAlerts > 0 && (
            <div className="bg-red-500 rounded-full w-6 h-6 flex items-center justify-center">
              <span className="text-white text-xs font-bold">{totalAlerts}</span>
            </div>
          )}
        </div>

        {/* Hero 3-stat row */}
        <div className="grid grid-cols-3 gap-2 mt-5">
          <div className="bg-white/15 rounded-xl p-3 text-center backdrop-blur-sm">
            <Layers size={13} className="mx-auto mb-1 text-amber-200" />
            <p className="text-white font-bold text-base leading-tight">{fmt(todayUnits)}</p>
            <p className="text-amber-300 text-[10px] mt-0.5">Units Today</p>
          </div>
          <div className="bg-white/15 rounded-xl p-3 text-center backdrop-blur-sm">
            <TrendingUp size={13} className="mx-auto mb-1 text-amber-200" />
            <p className="text-white font-bold text-base leading-tight">{cur(todayIncome)}</p>
            <p className="text-amber-300 text-[10px] mt-0.5">Today's Income</p>
          </div>
          <div className="bg-white/15 rounded-xl p-3 text-center backdrop-blur-sm">
            <CircleDollarSign size={13} className="mx-auto mb-1 text-amber-200" />
            <p className={`font-bold text-base leading-tight ${totalReceivables > 0 ? 'text-amber-200' : 'text-white'}`}>{cur(totalReceivables)}</p>
            <p className="text-amber-300 text-[10px] mt-0.5">Receivables</p>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-4 space-y-3">

        {/* ── ALERTS ─────────────────────────────────────────────── */}
        {totalAlerts > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border-b border-red-100">
              <Bell size={13} className="text-red-500" />
              <p className="text-xs font-bold text-red-700">Needs Attention ({totalAlerts})</p>
            </div>
            <div className="divide-y divide-gray-50">
              {pendingApprovals > 0 && (
                <button onClick={() => navigate('production')} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 active:bg-gray-100">
                  <div className="flex items-center gap-2">
                    <Clock size={13} className="text-amber-500" />
                    <span className="text-xs text-gray-700">{pendingApprovals} production entr{pendingApprovals > 1 ? 'ies' : 'y'} pending approval</span>
                  </div>
                  <ChevronRight size={13} className="text-gray-400" />
                </button>
              )}
              {overdueOrders > 0 && (
                <button onClick={() => navigate('finance')} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 active:bg-gray-100">
                  <div className="flex items-center gap-2">
                    <Truck size={13} className="text-red-500" />
                    <span className="text-xs text-gray-700">{overdueOrders} order{overdueOrders > 1 ? 's' : ''} past delivery date</span>
                  </div>
                  <ChevronRight size={13} className="text-gray-400" />
                </button>
              )}
              {lowStockMats.map(m => (
                <button key={m.id} onClick={() => navigate('materials')} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 active:bg-gray-100">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={13} className="text-orange-500" />
                    <span className="text-xs text-gray-700">{m.name} stock running low</span>
                  </div>
                  <ChevronRight size={13} className="text-gray-400" />
                </button>
              ))}
              {laborOwed > 0 && (
                <button onClick={() => navigate('finance')} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 active:bg-gray-100">
                  <div className="flex items-center gap-2">
                    <Users size={13} className="text-purple-500" />
                    <span className="text-xs text-gray-700">Labour balance due: {cur(laborOwed)}</span>
                  </div>
                  <ChevronRight size={13} className="text-gray-400" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── QUICK ACTIONS ─────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2.5">Quick Actions</p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Production', icon: Hammer,       color: 'bg-amber-700',  page: 'production' },
              { label: 'Material',   icon: Package,      color: 'bg-blue-600',   page: 'materials'  },
              { label: 'Payment',    icon: TrendingUp,   color: 'bg-green-600',  page: 'finance'    },
              { label: 'Expense',    icon: Receipt,      color: 'bg-red-500',    page: 'finance'    },
              { label: 'Quote',      icon: FileText,     color: 'bg-purple-600', page: 'sales', sub: 'new_quote'    },
              { label: 'Invoice',    icon: DollarSign,   color: 'bg-teal-600',   page: 'sales', sub: 'new_invoice'  },
              { label: 'Enquiry',    icon: MessageSquare,color: 'bg-indigo-600', page: 'sales', sub: 'new_enquiry'  },
              { label: 'Order',      icon: ShoppingBag,  color: 'bg-rose-600',   page: 'finance'    },
            ].map(({ label, icon: Icon, color, page, sub }) => (
              <button key={label} onClick={() => navigate(page, sub)}
                className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform">
                <div className={`${color} w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm`}>
                  <Icon size={20} className="text-white" />
                </div>
                <span className="text-[10px] text-gray-600 font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── THIS MONTH KPIs ───────────────────────────────────── */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 px-0.5">This Month</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-green-50 border border-green-100 rounded-xl p-3">
              <p className="text-[10px] text-gray-500">Revenue Received</p>
              <p className="text-lg font-bold text-green-700 leading-tight">{cur(mtdIncome)}</p>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-xl p-3">
              <p className="text-[10px] text-gray-500">Total Cost Out</p>
              <p className="text-lg font-bold text-red-700 leading-tight">{cur(mtdCost)}</p>
            </div>
            <div className={`${Number(mtdMargin) >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-100'} border rounded-xl p-3`}>
              <p className="text-[10px] text-gray-500">Gross Margin</p>
              <p className={`text-lg font-bold leading-tight ${Number(mtdMargin) >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{mtdMargin}%</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
              <p className="text-[10px] text-gray-500">Receivables</p>
              <p className={`text-lg font-bold leading-tight ${totalReceivables > 0 ? 'text-amber-700' : 'text-gray-400'}`}>{cur(totalReceivables)}</p>
            </div>
          </div>
        </div>

        {/* ── TODAY's NET P&L ───────────────────────────────────── */}
        {(todayIncome > 0 || todayLaborCost > 0 || todayExpenses > 0 || todayMatCost > 0) && (
          <div className={`rounded-xl p-4 border ${netToday >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-gray-600">Today's Net P&L</p>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${netToday >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {netToday >= 0 ? '▲ Profit' : '▼ Loss'}
              </span>
            </div>
            <p className={`text-2xl font-bold ${netToday >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {netToday >= 0 ? '+' : ''}{cur(netToday)}
            </p>
            <div className="grid grid-cols-3 gap-1 mt-2 pt-2 border-t border-gray-200 text-center">
              {[['Income', todayIncome, 'text-green-600'], ['Labour', todayLaborCost, 'text-red-500'], ['Materials', todayMatCost, 'text-red-500']].map(([l, v, cls]) => (
                <div key={l}>
                  <p className="text-[10px] text-gray-400">{l}</p>
                  <p className={`text-xs font-bold ${cls}`}>{cur(v)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ACTIVE ORDERS PIPELINE ────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <ShoppingBag size={14} className="text-blue-600" />
              <p className="text-sm font-semibold text-gray-700">Active Orders</p>
              {activeOrders.length > 0 && <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{activeOrders.length}</span>}
            </div>
            <button onClick={() => navigate('finance')} className="text-amber-700 text-xs flex items-center gap-0.5">
              All <ChevronRight size={13} />
            </button>
          </div>
          {activeOrders.length === 0 ? (
            <div className="py-6 text-center">
              <CheckCircle2 size={28} className="text-gray-200 mx-auto mb-1" />
              <p className="text-xs text-gray-400">All orders fulfilled</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {activeOrders.map(o => (
                <div key={o.id} className="px-4 py-3">
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-semibold text-gray-800 truncate">{o.customerName}</p>
                        {o.isOverdue && <span className="text-[9px] bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-full">OVERDUE</span>}
                      </div>
                      <p className="text-xs text-gray-400">{o.product?.name || '—'} · {fmt(o.quantity)} pcs</p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="text-xs font-bold text-gray-800">{cur(o.totalAmount)}</p>
                      {o.balance > 0 && <p className="text-[10px] font-semibold text-red-500">Due {cur(o.balance)}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                      <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${o.dispPct}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-500 font-medium shrink-0">{fmt(o.dispatched)}/{fmt(o.quantity)} dispatched</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── TODAY'S PRODUCTION BY PRODUCT ────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <Hammer size={14} className="text-amber-600" />
              <p className="text-sm font-semibold text-gray-700">Today's Production</p>
            </div>
            <button onClick={() => navigate('production')} className="text-amber-700 text-xs flex items-center gap-0.5">
              All <ChevronRight size={13} />
            </button>
          </div>
          {todayByProduct.length === 0 ? (
            <div className="py-6 text-center">
              <Factory size={28} className="text-gray-200 mx-auto mb-1" />
              <p className="text-xs text-gray-400">No production recorded today</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {todayByProduct.map(p => (
                <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    {p.cat && <span className="text-[9px] bg-amber-50 text-amber-700 font-medium px-1.5 py-0.5 rounded-full">{p.cat.name}</span>}
                    <p className="text-sm font-medium text-gray-800 mt-0.5">{p.name}</p>
                  </div>
                  <p className="text-xl font-bold text-amber-800">{fmt(p.units)} <span className="text-xs font-normal text-gray-400">{p.unit}</span></p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── FINISHED GOODS STOCK ─────────────────────────────── */}
        {finishedGoods.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <Boxes size={14} className="text-blue-600" />
                <p className="text-sm font-semibold text-gray-700">Finished Goods</p>
              </div>
              <button onClick={() => navigate('production')} className="text-amber-700 text-xs flex items-center gap-0.5">
                Stock <ChevronRight size={13} />
              </button>
            </div>
            <div className="divide-y divide-gray-50">
              {finishedGoods.map(p => {
                const statusColor = p.inStock <= 0 ? 'text-red-500' : p.inStock <= p.pendingOrdQty ? 'text-amber-600' : 'text-green-700';
                return (
                  <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      {p.cat && <span className="text-[9px] bg-blue-50 text-blue-700 font-medium px-1.5 py-0.5 rounded-full">{p.cat.name}</span>}
                      <p className="text-sm font-medium text-gray-800 mt-0.5">{p.name}</p>
                      {p.pendingOrdQty > 0 && <p className="text-[10px] text-amber-600">{fmt(p.pendingOrdQty)} ordered (pending)</p>}
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-bold ${statusColor}`}>{fmt(p.inStock)}</p>
                      <p className="text-[10px] text-gray-400">in stock</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 7-DAY PRODUCTION TREND ────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 size={14} className="text-indigo-500" />
            <p className="text-sm font-semibold text-gray-700">7-Day Production Trend</p>
          </div>
          <div className="flex items-end gap-1.5 h-14">
            {(() => {
              const max = Math.max(...last7.map(d => d.units), 1);
              return last7.map(d => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                  <div className={`w-full rounded-t transition-all ${d.date === t ? 'bg-amber-600' : 'bg-amber-300'}`}
                    style={{ height: `${Math.max(3, (d.units / max) * 44)}px` }} />
                  <span className={`text-[8px] ${d.date === t ? 'text-amber-700 font-bold' : 'text-gray-400'}`}>{d.date.slice(8)}</span>
                </div>
              ));
            })()}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-gray-400">{fmtDate(last7[0]?.date)}</span>
            <span className="text-[10px] text-amber-600 font-semibold">Today: {fmt(todayUnits)} pcs</span>
          </div>
        </div>

        {/* ── RECENT PAYMENTS ───────────────────────────────────── */}
        {recentReceipts.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <ArrowUpRight size={14} className="text-green-600" />
                <p className="text-sm font-semibold text-gray-700">Recent Receipts</p>
              </div>
              <button onClick={() => navigate('finance')} className="text-amber-700 text-xs flex items-center gap-0.5">
                All <ChevronRight size={13} />
              </button>
            </div>
            <div className="divide-y divide-gray-50">
              {recentReceipts.map(p => (
                <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{p.order?.customerName || 'Customer'}</p>
                    <p className="text-xs text-gray-400">{fmtDate(p.date)}</p>
                  </div>
                  <p className="text-sm font-bold text-green-600">+{cur(p.amount)}</p>
                </div>
              ))}
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
      className={`${color} text-white text-sm font-semibold py-3 px-3 rounded-xl w-full active:scale-95 transition-transform flex items-center justify-center gap-2`}>
      <Icon size={15} /> {label}
    </button>
  );
}
