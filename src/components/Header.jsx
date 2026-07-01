import React from 'react';
import { ArrowLeft } from 'lucide-react';

export default function Header({ title, subtitle, onBack, action }) {
  return (
    <div className="bg-gradient-to-r from-blue-700 to-blue-500 px-4 pt-10 pb-4 text-white sticky top-0 z-40 shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-1 -ml-1 rounded-full hover:bg-white/20">
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h1 className="text-lg font-bold leading-tight">{title}</h1>
            {subtitle && <p className="text-blue-100 text-xs mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action && <div>{action}</div>}
      </div>
    </div>
  );
}
