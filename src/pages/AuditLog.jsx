import React, { useState, useMemo } from 'react';
import Header from '../components/Header';
import { useApp } from '../context/AppContext';
import { Shield, Search, Calendar, Filter } from 'lucide-react';

const CATEGORY_COLORS = {
  auth:        'bg-blue-100 text-blue-700',
  production:  'bg-green-100 text-green-700',
  materials:   'bg-amber-100 text-amber-700',
  finance:     'bg-purple-100 text-purple-700',
  sales:       'bg-rose-100 text-rose-700',
  settings:    'bg-gray-100 text-gray-700',
};

const DATE_PRESETS = [
  { id: 'today',     label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'thisWeek',  label: 'This Week' },
  { id: 'thisMonth', label: 'This Month' },
  { id: 'custom',    label: 'Custom' },
  { id: 'all',       label: 'All Time' },
];

function getTodayIST() {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function getDateRange(preset, customFrom, customTo) {
  const today = getTodayIST();
  const now = new Date(today);
  if (preset === 'today')     return { from: today, to: today };
  if (preset === 'yesterday') {
    const d = new Date(now - 86400000).toISOString().slice(0, 10);
    return { from: d, to: d };
  }
  if (preset === 'thisWeek') {
    const dow = new Date().getDay();
    const mon = new Date(Date.now() - (dow === 0 ? 6 : dow - 1) * 86400000).toISOString().slice(0, 10);
    return { from: mon, to: today };
  }
  if (preset === 'thisMonth') return { from: today.slice(0, 7) + '-01', to: today };
  if (preset === 'custom')    return { from: customFrom || today, to: customTo || today };
  return { from: null, to: null }; // all time
}

function formatTime(iso) {
  try {
    const d = new Date(iso);
    const dd  = String(d.getDate()).padStart(2, '0');
    const mm  = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh  = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  } catch { return iso || ''; }
}

export default function AuditLog({ onBack }) {
  const { auditLog = [] } = useApp();
  const today = getTodayIST();

  const [search,      setSearch]      = useState('');
  const [filterCat,   setFilterCat]   = useState('');
  const [filterUser,  setFilterUser]  = useState('');
  const [datePreset,  setDatePreset]  = useState('today'); // default = today
  const [customFrom,  setCustomFrom]  = useState(today);
  const [customTo,    setCustomTo]    = useState(today);

  const { from, to } = getDateRange(datePreset, customFrom, customTo);

  const categories = useMemo(() => [...new Set(auditLog.map(e => e.category))].filter(Boolean).sort(), [auditLog]);
  const users      = useMemo(() => [...new Set(auditLog.map(e => e.userName))].filter(Boolean).sort(), [auditLog]);

  const filtered = useMemo(() => auditLog
    .filter(e => {
      if (!from) return true;
      const d = (e.timestamp || '').slice(0, 10);
      return d >= from && d <= to;
    })
    .filter(e => !filterCat  || e.category === filterCat)
    .filter(e => !filterUser || e.userName === filterUser)
    .filter(e => !search || [
      e.description, e.userName, e.category,
    ].some(v => v?.toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
  [auditLog, from, to, filterCat, filterUser, search]);

  const rangeLabel = datePreset === 'all' ? `All Time — ${auditLog.length} total`
    : from === to ? `${formatTime(from + 'T00:00:00').slice(0, 10).split('-').reverse().join('/')}`
    : `${from?.split('-').reverse().join('/')} → ${to?.split('-').reverse().join('/')}`;

  return (
    <div className="fixed inset-0 z-[150] bg-slate-100 flex flex-col max-w-[480px] mx-auto">
      <Header title="Audit Log" subtitle={`${filtered.length} events · ${rangeLabel}`} onBack={onBack} />

      <div className="px-4 pt-3 pb-2 space-y-2.5 shrink-0 bg-slate-100">

        {/* Date range presets */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {DATE_PRESETS.map(p => (
            <button key={p.id} onClick={() => setDatePreset(p.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-colors ${
                datePreset === p.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 border border-gray-200'
              }`}>{p.label}</button>
          ))}
        </div>

        {/* Custom date pickers */}
        {datePreset === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-gray-400 mb-1">From</p>
              <input type="date" value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-2.5 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 mb-1">To</p>
              <input type="date" value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-2.5 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search by user, action or category…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>

        {/* Category filter chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          <button onClick={() => setFilterCat('')}
            className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 ${
              !filterCat ? 'bg-rose-600 text-white' : 'bg-white text-gray-500 border border-gray-200'
            }`}>All Categories</button>
          {categories.map(c => (
            <button key={c} onClick={() => setFilterCat(c === filterCat ? '' : c)}
              className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 capitalize ${
                filterCat === c ? 'bg-rose-600 text-white' : 'bg-white text-gray-500 border border-gray-200'
              }`}>{c}</button>
          ))}
        </div>

        {/* User filter */}
        {users.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            <button onClick={() => setFilterUser('')}
              className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 ${
                !filterUser ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 border border-gray-200'
              }`}>All Users</button>
            {users.map(u => (
              <button key={u} onClick={() => setFilterUser(u === filterUser ? '' : u)}
                className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 ${
                  filterUser === u ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 border border-gray-200'
                }`}>{u}</button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
        {filtered.length === 0 && (
          <div className="bg-white rounded-xl p-10 text-center shadow-sm border border-gray-100 mt-4">
            <Shield size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No audit events for this period</p>
            <p className="text-gray-300 text-xs mt-1">Try changing the date range or filters</p>
          </div>
        )}
        {filtered.map(entry => (
          <div key={entry.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                    CATEGORY_COLORS[entry.category] || 'bg-gray-100 text-gray-600'
                  }`}>{entry.category}</span>
                  {entry.role && <span className="text-[10px] text-gray-400 capitalize">{entry.role}</span>}
                </div>
                <p className="text-xs text-gray-700 font-medium leading-snug">{entry.description}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">by <span className="font-semibold text-gray-600">{entry.userName}</span></p>
              </div>
              <p className="text-[10px] text-gray-400 shrink-0 text-right whitespace-nowrap">{formatTime(entry.timestamp)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
