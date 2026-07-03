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
