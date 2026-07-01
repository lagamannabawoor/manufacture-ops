import React from 'react';
import { useApp } from '../context/AppContext';
import { Cloud, CloudOff, Loader, CheckCircle, AlertCircle, LogOut } from 'lucide-react';

const GOOGLE_LOGO = (
  <svg viewBox="0 0 18 18" width="14" height="14">
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" />
    <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" />
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" />
  </svg>
);

export default function GoogleAuth() {
  const { driveStatus, driveUser, signInWithGoogle, signOutFromGoogle } = useApp();

  if (driveStatus === 'not-configured') {
    return (
      <div className="mx-4 mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
        <AlertCircle size={15} className="text-amber-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-amber-700">Google Drive not configured</p>
          <p className="text-xs text-amber-600 mt-0.5">Add <code className="bg-amber-100 px-1 rounded">VITE_GOOGLE_CLIENT_ID</code> to Netlify environment variables and redeploy.</p>
        </div>
      </div>
    );
  }

  if (driveStatus === 'loading') {
    return (
      <div className="mx-4 mt-3 bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
        <Loader size={15} className="text-blue-500 animate-spin shrink-0" />
        <p className="text-xs font-semibold text-blue-700">Connecting to Google Drive…</p>
      </div>
    );
  }

  if (!driveUser) {
    return (
      <div className="mx-4 mt-3 bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CloudOff size={16} className="text-slate-400 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-slate-700">Local storage only</p>
            <p className="text-xs text-slate-500">Sign in to back up data to Google Drive</p>
          </div>
        </div>
        <button
          onClick={signInWithGoogle}
          className="flex items-center gap-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg shadow-sm shrink-0 active:scale-95 transition-transform"
        >
          {GOOGLE_LOGO} Sign in
        </button>
      </div>
    );
  }

  const icon = {
    synced: <CheckCircle size={15} className="text-green-500 shrink-0" />,
    syncing: <Loader size={15} className="text-blue-500 animate-spin shrink-0" />,
    error: <AlertCircle size={15} className="text-red-400 shrink-0" />,
  }[driveStatus] || <Cloud size={15} className="text-green-400 shrink-0" />;

  const label = {
    synced: 'Synced to Google Drive',
    syncing: 'Saving to Google Drive…',
    error: 'Sync error — changes saved locally',
  }[driveStatus] || 'Google Drive';

  return (
    <div className="mx-4 mt-3 bg-green-50 border border-green-200 rounded-xl p-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <div className="min-w-0">
          <p className="text-xs font-semibold text-green-700 truncate">{label}</p>
          <p className="text-xs text-green-600 truncate">{driveUser.email}</p>
        </div>
      </div>
      <button
        onClick={signOutFromGoogle}
        className="text-slate-400 hover:text-slate-600 p-1 shrink-0"
        title="Sign out"
      >
        <LogOut size={16} />
      </button>
    </div>
  );
}
