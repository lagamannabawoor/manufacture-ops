import React, { useState, useMemo } from 'react';
import Header from '../components/Header';
import { useApp } from '../context/AppContext';
import { Shield, Search, SlidersHorizontal, X, Trash2, ChevronDown } from 'lucide-react';

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
  if (preset === 'today')     return { from: today, to: today };
  if (preset === 'yesterday') {
    const d = new Date(new Date(today) - 86400000).toISOString().slice(0, 10);
    return { from: d, to: d };
  }
  if (preset === 'thisWeek') {
    const dow = new Date().getDay();
    const mon = new Date(Date.now() - (dow === 0 ? 6 : dow - 1) * 86400000).toISOString().slice(0, 10);
    return { from: mon, to: today };
  }
  if (preset === 'thisMonth') return { from: today.slice(0, 7) + '-01', to: today };
  if (preset === 'custom')    return { from: customFrom || today, to: customTo || today };
  return { from: null, to: null };
}

function formatTime(iso) {
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  } catch { return iso || ''; }
}

function Chip({ label, active, onClick, color = 'blue' }) {
  const activeClass = color === 'blue'   ? 'bg-blue-600 text-white border-blue-600'
                    : color === 'violet' ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-slate-700 text-white border-slate-700';
  return (
    <button onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 capitalize border transition-colors ${
        active ? activeClass : 'bg-white text-gray-500 border-gray-200'
      }`}>
      {label}
    </button>
  );
}

export default function AuditLog({ onBack }) {
  const { auditLog = [], setList, currentUser } = useApp();
  const today = getTodayIST();
  const isAdmin = currentUser?.role === 'admin';

  const [search,      setSearch]      = useState('');
  const [filterCat,   setFilterCat]   = useState('');
  const [filterUser,  setFilterUser]  = useState('');
  const [datePreset,  setDatePreset]  = useState('today');
  const [customFrom,  setCustomFrom]  = useState(today);
  const [customTo,    setCustomTo]    = useState(today);
  const [showFilters, setShowFilters] = useState(false);

  const { from, to } = getDateRange(datePreset, customFrom, customTo);

  const categories = useMemo(() =>
    [...new Set(auditLog.map(e => e.category))].filter(Boolean).sort(), [auditLog]);
  const users = useMemo(() =>
    [...new Set(auditLog.map(e => e.userName))].filter(Boolean).sort(), [auditLog]);

  const filtered = useMemo(() => auditLog
    .filter(e => { if (!from) return true; const d = (e.timestamp || '').slice(0, 10); return d >= from && d <= to; })
    .filter(e => !filterCat  || e.category === filterCat)
    .filter(e => !filterUser || e.userName === filterUser)
    .filter(e => !search || [e.description, e.userName, e.category]
      .some(v => v?.toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
  [auditLog, from, to, filterCat, filterUser, search]);

  const activeFilterCount = (filterCat ? 1 : 0) + (filterUser ? 1 : 0);

  function clearFilters() {
    setFilterCat(''); setFilterUser(''); setSearch('');
    setDatePreset('today');
  }

  function clearLog() {
    if (!window.confirm(`Clear ${filtered.length} visible log entr${filtered.length !== 1 ? 'ies' : 'y'}? This cannot be undone.`)) return;
    const filteredIds = new Set(filtered.map(e => e.id));
    setList('auditLog', auditLog.filter(e => !filteredIds.has(e.id)));
  }

  const rangeLabel = datePreset === 'all'
    ? 'All Time'
    : from === to
    ? from?.split('-').reverse().join('/')
    : `${from?.split('-').reverse().join('/')} – ${to?.split('-').reverse().join('/')}`;

  return (
    <div className="fixed inset-0 z-[150] bg-slate-100 flex flex-col max-w-[480px] mx-auto">
      <Header
        title="Audit Log"
        subtitle={`${filtered.length} of ${auditLog.length} events`}
        onBack={onBack}
        action={isAdmin && filtered.length > 0 ? (
          <button onClick={clearLog}
            className="flex flex-col items-center gap-0.5 bg-white/20 hover:bg-red-500/30 text-white rounded-xl px-2.5 py-1.5 transition-colors">
            <Trash2 size={15} />
            <span className="text-[9px] font-semibold leading-none">Clear</span>
          </button>
        ) : null}
      />

      {/* ── Filter bar ─────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 shadow-sm shrink-0">

        {/* Row 1: Search + filter toggle */}
        <div className="flex items-center gap-2 px-3 pt-3 pb-2">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search action, user…"
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-7 pr-7 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-300" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                <X size={12} />
              </button>
            )}
          </div>
          <button onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
              showFilters || activeFilterCount > 0
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-gray-50 text-gray-600 border-gray-200'
            }`}>
            <SlidersHorizontal size={13} />
            Filters
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-white text-blue-600 text-[10px] font-bold flex items-center justify-center leading-none">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown size={11} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Row 2: Date presets */}
        <div className="flex gap-1.5 overflow-x-auto px-3 pb-2 scrollbar-none">
          {DATE_PRESETS.map(p => (
            <Chip key={p.id} label={p.label} active={datePreset === p.id}
              onClick={() => setDatePreset(p.id)} color="blue" />
          ))}
        </div>

        {/* Custom date inputs (inline, only when custom) */}
        {datePreset === 'custom' && (
          <div className="grid grid-cols-2 gap-2 px-3 pb-2">
            <div>
              <p className="text-[9px] text-gray-400 mb-0.5 font-semibold uppercase tracking-wide">From</p>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <p className="text-[9px] text-gray-400 mb-0.5 font-semibold uppercase tracking-wide">To</p>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
        )}

        {/* Collapsible: Category + User filters */}
        {showFilters && (
          <div className="px-3 pb-3 space-y-2.5 border-t border-gray-100 pt-2.5">
            {/* Category */}
            <div>
              <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Category</p>
              <div className="flex gap-1.5 flex-wrap">
                <Chip label="All" active={!filterCat} onClick={() => setFilterCat('')} color="violet" />
                {categories.map(c => (
                  <Chip key={c} label={c} active={filterCat === c}
                    onClick={() => setFilterCat(c === filterCat ? '' : c)} color="violet" />
                ))}
              </div>
            </div>
            {/* User */}
            {users.length > 1 && (
              <div>
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">User</p>
                <div className="flex gap-1.5 flex-wrap">
                  <Chip label="All" active={!filterUser} onClick={() => setFilterUser('')} color="slate" />
                  {users.map(u => (
                    <Chip key={u} label={u} active={filterUser === u}
                      onClick={() => setFilterUser(u === filterUser ? '' : u)} color="slate" />
                  ))}
                </div>
              </div>
            )}
            {/* Clear all filters */}
            {(filterCat || filterUser || search || datePreset !== 'today') && (
              <button onClick={clearFilters}
                className="flex items-center gap-1.5 text-xs text-red-500 font-semibold">
                <X size={12} /> Reset all filters
              </button>
            )}
          </div>
        )}

        {/* Active range label */}
        <div className="px-3 pb-2 flex items-center justify-between">
          <p className="text-[10px] text-gray-400">
            Showing <span className="font-semibold text-gray-600">{filtered.length}</span> event{filtered.length !== 1 ? 's' : ''} · <span className="text-blue-500 font-medium">{rangeLabel}</span>
          </p>
        </div>
      </div>

      {/* ── Log entries ───────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {filtered.length === 0 && (
          <div className="bg-white rounded-xl p-10 text-center shadow-sm border border-gray-100 mt-4">
            <Shield size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No events found</p>
            <p className="text-gray-300 text-xs mt-1">Try a different date range or clear filters</p>
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
