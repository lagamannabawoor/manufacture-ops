import React, { useState } from 'react';
import Header from '../components/Header';
import { useApp } from '../context/AppContext';
import { Shield, Search } from 'lucide-react';

const CATEGORY_COLORS = {
  auth:        'bg-blue-100 text-blue-700',
  production:  'bg-green-100 text-green-700',
  materials:   'bg-amber-100 text-amber-700',
  finance:     'bg-purple-100 text-purple-700',
  settings:    'bg-gray-100 text-gray-700',
};

function formatTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

export default function AuditLog({ onBack }) {
  const { auditLog = [] } = useApp();
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');

  const categories = [...new Set(auditLog.map(e => e.category))].filter(Boolean);

  const filtered = auditLog
    .filter(e => !filterCat || e.category === filterCat)
    .filter(e => !search || e.description?.toLowerCase().includes(search.toLowerCase()) || e.userName?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col max-w-[480px] mx-auto">
      <Header title="Audit Log" subtitle={`${auditLog.length} total events`} onBack={onBack} />
      <div className="px-4 pt-4 space-y-2 shrink-0">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by user or action..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setFilterCat('')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 ${!filterCat ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
          >All</button>
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setFilterCat(c === filterCat ? '' : c)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 capitalize ${filterCat === c ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
            >{c}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {filtered.length === 0 && (
          <div className="bg-white rounded-xl p-10 text-center shadow-sm border border-gray-100 mt-4">
            <Shield size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No audit events yet</p>
          </div>
        )}
        {filtered.map(entry => (
          <div key={entry.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${CATEGORY_COLORS[entry.category] || 'bg-gray-100 text-gray-600'}`}>
                    {entry.category}
                  </span>
                  <span className="text-[10px] text-gray-400 capitalize">{entry.role}</span>
                </div>
                <p className="text-xs text-gray-700 font-medium">{entry.description}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">by <span className="font-semibold">{entry.userName}</span></p>
              </div>
              <p className="text-[10px] text-gray-400 shrink-0 text-right">{formatTime(entry.timestamp)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
