import React from 'react';
import { Home, Factory, Package, Wallet, BarChart2, Settings } from 'lucide-react';
import { ROLES } from '../context/AppContext';

const ALL_TABS = [
  { id: 'dashboard',  label: 'Home',       icon: Home      },
  { id: 'production', label: 'Production',  icon: Factory   },
  { id: 'materials',  label: 'Materials',   icon: Package   },
  { id: 'finance',    label: 'Finance',     icon: Wallet    },
  { id: 'reports',    label: 'Reports',     icon: BarChart2 },
  { id: 'settings',   label: 'Settings',    icon: Settings  },
];

export default function BottomNav({ current, onChange, role }) {
  const allowed = ROLES[role]?.tabs || [];
  const tabs = ALL_TABS.filter(t => allowed.includes(t.id));

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-gray-200 z-50 safe-bottom">
      <div className="flex">
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = current === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${active ? 'text-blue-600' : 'text-gray-400'}`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span className={`text-[10px] font-medium ${active ? 'text-blue-600' : 'text-gray-400'}`}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
