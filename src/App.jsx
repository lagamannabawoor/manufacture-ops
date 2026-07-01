import React, { useState } from 'react';
import { AppProvider } from './context/AppContext';
import BottomNav from './components/BottomNav';
import GoogleAuth from './components/GoogleAuth';
import Dashboard from './pages/Dashboard';
import Production from './pages/Production';
import Materials from './pages/Materials';
import Finance from './pages/Finance';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

export default function App() {
  const [page, setPage] = useState('dashboard');

  const pages = {
    dashboard: <Dashboard navigate={setPage} />,
    production: <Production navigate={setPage} />,
    materials: <Materials navigate={setPage} />,
    finance: <Finance navigate={setPage} />,
    reports: <Reports navigate={setPage} />,
    settings: <Settings navigate={setPage} />,
  };

  return (
    <AppProvider>
      <div className="flex flex-col min-h-dvh bg-slate-100">
        <main className="flex-1 overflow-y-auto pb-20">
          {pages[page] || pages.dashboard}
          <GoogleAuth />
        </main>
        <BottomNav current={page} onChange={setPage} />
      </div>
    </AppProvider>
  );
}
