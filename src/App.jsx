import React, { useState } from 'react';
import { AppProvider, ROLES, useApp } from './context/AppContext';
import BottomNav from './components/BottomNav';
import GoogleAuth from './components/GoogleAuth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Production from './pages/Production';
import Materials from './pages/Materials';
import Finance from './pages/Finance';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import { LogOut } from 'lucide-react';

const ROLE_COLORS = {
  admin:      'bg-red-100 text-red-700',
  accountant: 'bg-blue-100 text-blue-700',
  labour:     'bg-green-100 text-green-700',
  guest:      'bg-gray-100 text-gray-600',
};

function UserBar() {
  const { currentUser, logout } = useApp();
  if (!currentUser) return null;
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-100 shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-700">{currentUser.name}</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${ROLE_COLORS[currentUser.role] || 'bg-gray-100 text-gray-600'}`}>
          {ROLES[currentUser.role]?.label || currentUser.role}
        </span>
      </div>
      <button
        onClick={logout}
        className="flex items-center gap-1.5 text-xs text-red-500 font-semibold py-1.5 px-3 rounded-lg bg-red-50 active:scale-95 transition-transform"
      >
        <LogOut size={13} /> Logout
      </button>
    </div>
  );
}

function AppShell() {
  const { currentUser } = useApp();
  const [page, setPage] = useState('');

  if (!currentUser) return <Login />;

  const role = currentUser.role;
  const allowedTabs = ROLES[role]?.tabs || [];

  const defaultPage = allowedTabs[0] || 'production';
  const activePage = page && allowedTabs.includes(page) ? page : defaultPage;

  const navigate = (p) => { if (allowedTabs.includes(p)) setPage(p); };

  const pages = {
    dashboard:  <Dashboard navigate={navigate} />,
    production: <Production navigate={navigate} />,
    materials:  <Materials navigate={navigate} />,
    finance:    <Finance navigate={navigate} />,
    reports:    <Reports navigate={navigate} />,
    settings:   <Settings navigate={navigate} />,
  };

  return (
    <div className="flex flex-col min-h-dvh bg-slate-100">
      <UserBar />
      <main className="flex-1 overflow-y-auto pb-20">
        {pages[activePage]}
        <GoogleAuth />
      </main>
      <BottomNav current={activePage} onChange={navigate} role={role} />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
