import React from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50">
      <div className="bg-white w-full max-w-[480px] rounded-t-2xl flex flex-col" style={{maxHeight:'88dvh'}}>
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-semibold text-gray-800">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-4 py-4 pb-6">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, required }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

export const inputCls = 'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';
export const selectCls = 'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none';

export function SaveBtn({ label = 'Save', onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl mt-2 disabled:opacity-50 active:scale-95 transition-transform"
    >
      {label}
    </button>
  );
}
