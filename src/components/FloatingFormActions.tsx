"use client";

import React from 'react';

interface Action {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  description: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'info' | 'success';
  disabled?: boolean;
}

interface FloatingFormActionsProps {
  actions: Action[];
}

export default function FloatingFormActions({ actions }: FloatingFormActionsProps) {
  return (
    <div className="fixed bottom-8 right-8 z-[60] flex flex-col gap-4 items-end pointer-events-none">
      {actions.map((action, i) => (
        <div key={i} className="group relative flex items-center pointer-events-auto">
          {/* Tooltip Description */}
          <div className="absolute right-full mr-4 px-4 py-2.5 bg-slate-900/95 dark:bg-slate-800/95 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0 whitespace-nowrap shadow-2xl backdrop-blur-xl pointer-events-none border border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              {action.description}
            </div>
            {/* Arrow */}
            <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-slate-900/95 dark:bg-slate-800/95 rotate-45 border-r border-t border-white/10"></div>
          </div>
          
          {/* Button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              action.onClick();
            }}
            disabled={action.disabled}
            className={`
              flex items-center gap-3 px-6 py-3.5 rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.2em] transition-all shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] hover:shadow-[0_20px_60px_-10px_rgba(0,0,0,0.4)] hover:scale-105 active:scale-95
              ${action.variant === 'primary' ? 'bg-blue-600 text-white shadow-blue-600/30 hover:bg-blue-700' : 
                action.variant === 'danger' ? 'bg-red-600 text-white shadow-red-600/30 hover:bg-red-700' :
                action.variant === 'info' ? 'bg-indigo-600 text-white shadow-indigo-600/30 hover:bg-indigo-700' :
                action.variant === 'success' ? 'bg-emerald-600 text-white shadow-emerald-600/30 hover:bg-emerald-700' :
                'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-700 hover:bg-slate-50'}
              ${action.disabled ? 'opacity-50 grayscale cursor-not-allowed scale-100 shadow-none' : ''}
              relative group/btn overflow-hidden
            `}
          >
            {/* Glass effect on hover */}
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
            
            <div className="relative z-10 flex items-center gap-3">
              {action.icon && (
                <span className={`${action.variant ? 'text-white' : 'text-blue-500'}`}>
                  {React.cloneElement(action.icon as React.ReactElement<any>, { size: 18, strokeWidth: 3 })}
                </span>
              )}
              <span className="hidden sm:inline">{action.label}</span>
            </div>
          </button>
        </div>
      ))}
    </div>
  );
}
