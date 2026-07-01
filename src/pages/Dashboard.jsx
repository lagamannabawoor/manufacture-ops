import React from 'react';
import { useApp } from '../context/AppContext';
import {
  TrendingUp, TrendingDown, Package, Layers, DollarSign,
  Hammer, ChevronRight, CalendarDays, Building2
} from 'lucide-react';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmt(n) {
  return new Intl.NumberFormat('en-IN').format(n || 0);
}

export default function Dashboard({ navigate }) {
  const app = useApp();
  const t = today();

  const todayProduction = app.productionEntries.filter(e => e.date === t);
  const todayCement = todayProduction.reduce((s, e) => s + Number(e.cementBags || 0), 0);
  const todayUnits = todayProduction.reduce((s, e) => s + Number(e.quantity || 0), 0);

  const todayIncome = app.orderPayments
    .filter(p => p.date === t && p.direction === 'received')
    .reduce((s, p) => s + Number(p.amount || 0), 0);

  const todayLaborCost = app.laborPayments
    .filter(p => p.date === t)
    .reduce((s, p) => s + Number(p.amount || 0), 0);

  const todayExpenses = app.expenses
    .filter(e => e.date === t)
    .reduce((s, e) => s + Number(e.amount || 0), 0);

  const todayMaterialCost = app.materialPurchases
    .filter(p => p.date === t)
    .reduce((s, p) => s + Number(p.totalAmount || 0), 0);

  const todayOut = todayLaborCost + todayExpenses + todayMaterialCost;
  const netToday = todayIncome - todayOut;

  const totalCementPurchased = app.materialPurchases
    .filter(p => p.materialTypeId === 'm1')
    .reduce((s, p) => s + Number(p.quantity || 0), 0);

  const totalCementUsed = app.productionEntries
    .reduce((s, e) => s + Number(e.cementBags || 0), 0);

  const cementStock = totalCementPurchased - totalCementUsed;

  const pendingOrders = app.orders.filter(o => o.status !== 'completed').length;

  const recentProduction = app.productionEntries.slice(-5).reverse();

  const dateStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="pb-4">
      <div className="bg-gradient-to-br from-blue-700 to-blue-500 px-4 pt-10 pb-6 text-white">
        <p className="text-blue-200 text-xs mb-1 flex items-center gap-1">
          <CalendarDays size={12} /> {dateStr}
        </p>
        <h1 className="text-2xl font-bold">ManufactureOps</h1>
        <p className="text-blue-100 text-sm">Daily Manufacturing Dashboard</p>
      </div>

      <div className="px-4 -mt-4">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <StatCard
            label="Units Produced"
            value={fmt(todayUnits)}
            sub="today"
            icon={<Layers size={18} className="text-blue-600" />}
            color="blue"
          />
          <StatCard
            label="Cement Used"
            value={`${fmt(todayCement)} bags`}
            sub="today"
            icon={<Hammer size={18} className="text-orange-500" />}
            color="orange"
          />
          <StatCard
            label="Income"
            value={`₹${fmt(todayIncome)}`}
            sub="today"
            icon={<TrendingUp size={18} className="text-green-600" />}
            color="green"
          />
          <StatCard
            label="Outflow"
            value={`₹${fmt(todayOut)}`}
            sub="today"
            icon={<TrendingDown size={18} className="text-red-500" />}
            color="red"
          />
        </div>

        <div className={`rounded-xl p-4 mb-4 ${netToday >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <p className="text-xs text-gray-500 mb-1">Net Cash Flow Today</p>
          <p className={`text-2xl font-bold ${netToday >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {netToday >= 0 ? '+' : ''}₹{fmt(netToday)}
          </p>
          <div className="flex gap-4 mt-2 text-xs text-gray-500">
            <span>Labor: ₹{fmt(todayLaborCost)}</span>
            <span>Expenses: ₹{fmt(todayExpenses)}</span>
            <span>Materials: ₹{fmt(todayMaterialCost)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <Package size={16} className="text-amber-500" />
              <span className="text-xs text-gray-500">Cement Stock</span>
            </div>
            <p className="text-xl font-bold text-gray-800">{fmt(cementStock)}</p>
            <p className="text-xs text-gray-400">bags remaining</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign size={16} className="text-purple-500" />
              <span className="text-xs text-gray-500">Pending Orders</span>
            </div>
            <p className="text-xl font-bold text-gray-800">{pendingOrders}</p>
            <p className="text-xs text-gray-400">orders active</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h2 className="text-sm font-semibold text-gray-700">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 px-4 pb-4">
            <ActionBtn label="Add Production" color="bg-blue-600" onClick={() => navigate('production')} />
            <ActionBtn label="Add Material" color="bg-amber-500" onClick={() => navigate('materials')} />
            <ActionBtn label="Record Payment" color="bg-green-600" onClick={() => navigate('finance')} />
            <ActionBtn label="Add Expense" color="bg-red-500" onClick={() => navigate('finance')} />
          </div>
        </div>

        {recentProduction.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h2 className="text-sm font-semibold text-gray-700">Recent Production</h2>
              <button onClick={() => navigate('production')} className="text-blue-600 text-xs flex items-center gap-0.5">
                View all <ChevronRight size={14} />
              </button>
            </div>
            <div className="divide-y divide-gray-50">
              {recentProduction.map(entry => {
                const product = app.products.find(p => p.id === entry.productId);
                const factory = app.factories.find(f => f.id === entry.factoryId);
                return (
                  <div key={entry.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{product?.name || 'Unknown'}</p>
                      <p className="text-xs text-gray-400">{entry.date} • {factory?.name || ''}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-800">{fmt(entry.quantity)} pcs</p>
                      <p className="text-xs text-gray-400">{entry.cementBags} bags</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {recentProduction.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center mb-4">
            <Building2 size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 text-sm font-medium">No production entries yet</p>
            <p className="text-gray-400 text-xs mt-1">Start by adding today's production</p>
            <button
              onClick={() => navigate('production')}
              className="mt-4 px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl"
            >
              Add Production
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, icon, color }) {
  const colors = {
    blue: 'bg-blue-50',
    orange: 'bg-orange-50',
    green: 'bg-green-50',
    red: 'bg-red-50',
  };
  return (
    <div className={`${colors[color]} rounded-xl p-4 border border-white`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="bg-white rounded-lg p-1.5 shadow-sm">{icon}</div>
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="text-lg font-bold text-gray-800 leading-tight">{value}</p>
      <p className="text-xs text-gray-400">{sub}</p>
    </div>
  );
}

function ActionBtn({ label, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`${color} text-white text-sm font-semibold py-3 rounded-xl w-full active:scale-95 transition-transform`}
    >
      {label}
    </button>
  );
}
