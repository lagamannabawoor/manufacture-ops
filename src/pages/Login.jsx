import React, { useState } from 'react';
import { useApp, ROLES } from '../context/AppContext';
import { Factory, Eye, EyeOff, LogIn } from 'lucide-react';

export default function Login() {
  const { login } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim() || !password) { setError('Enter username and password'); return; }
    setLoading(true);
    setError('');
    setTimeout(() => {
      const ok = login(username.trim(), password);
      if (!ok) { setError('Invalid username or password'); setLoading(false); }
    }, 300);
  }

  return (
    <div className="min-h-dvh bg-gradient-to-br from-amber-800 to-amber-950 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
            <Factory size={34} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">Urbanmud</h1>
          <p className="text-amber-300 text-sm mt-1">Manufacturing Operations</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-800 mb-2">Sign In</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-xs text-red-600 font-medium">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Username</label>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-gray-50"
              placeholder="Enter username"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-gray-50"
                placeholder="Enter password"
              />
              <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-amber-700 text-white font-semibold py-3 rounded-xl text-sm active:scale-98 transition-transform disabled:opacity-60 mt-2"
          >
            <LogIn size={17} />
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="mt-5 bg-white/10 rounded-xl p-4">
          <p className="text-xs text-amber-300 font-semibold mb-2">Default credentials</p>
          {Object.entries(ROLES).map(([role, info]) => (
            <p key={role} className="text-xs text-amber-100">
              <span className="font-semibold">{info.label}:</span> username = <span className="font-mono bg-white/10 px-1 rounded">{role}</span> / password = <span className="font-mono bg-white/10 px-1 rounded">{role}123</span>
            </p>
          ))}
          <p className="text-xs text-amber-300 mt-2">Create more users in Settings after logging in as Admin.</p>
        </div>
      </div>
    </div>
  );
}
