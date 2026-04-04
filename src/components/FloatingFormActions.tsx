"use client";

import React from 'react';

interface Action {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  description: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'info' | 'success';
  disabled?: boolean;
  position?: 'bottom-right' | 'middle-right';
  size?: 'normal' | 'small';
}

interface FloatingFormActionsProps {
  actions: Action[];
}

export default function FloatingFormActions({ actions }: FloatingFormActionsProps) {
  const bottomActions = actions.filter(a => a.position !== 'middle-right');
  const middleActions = actions.filter(a => a.position === 'middle-right');

  const renderAction = (action: Action, i: number) => {
    const isSmall = action.size === 'small';
    return (
      <div key={i} className="group relative flex items-center pointer-events-auto">
        {/* Tooltip Description */}
        <div className="absolute right-full mr-4 px-4 py-2.5 bg-slate-900/95 dark:bg-slate-800/95 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0 whitespace-nowrap shadow-2xl backdrop-blur-xl pointer-events-none border border-white/10">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${action.variant === 'info' ? 'bg-blue-400' : 'bg-slate-400'}`} />
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
            flex items-center font-black uppercase tracking-[0.2em] transition-all shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] hover:shadow-[0_20px_60px_-10px_rgba(0,0,0,0.4)] hover:scale-105 active:scale-95
            ${isSmall ? 'px-3 py-2 gap-2 rounded-xl text-[9px]' : 'px-6 py-3.5 gap-3 rounded-[1.5rem] text-[11px]'}
            ${action.variant === 'primary' ? 'bg-blue-600 text-white shadow-blue-600/30 hover:bg-blue-700' : 
              action.variant === 'danger' ? 'bg-red-600 text-white shadow-red-600/30 hover:bg-red-700' :
              action.variant === 'info' ? 'bg-indigo-600 text-white shadow-indigo-600/30 hover:bg-indigo-700' :
              action.variant === 'success' ? 'bg-emerald-600 text-white shadow-emerald-600/30 hover:bg-emerald-700' :
              'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-700 hover:bg-slate-50 border-2'}
            ${action.disabled ? 'opacity-50 grayscale cursor-not-allowed scale-100 shadow-none' : ''}
            relative group/btn overflow-hidden
          `}
        >
          {/* Glass effect on hover */}
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
          
          <div className="relative z-10 flex items-center gap-2">
            {action.icon && (
              <span className={`${action.variant ? 'text-white' : 'text-slate-500'}`}>
                {React.cloneElement(action.icon as React.ReactElement<any>, { size: isSmall ? 14 : 18, strokeWidth: isSmall ? 2.5 : 3 })}
              </span>
            )}
            <span className="hidden sm:inline">{action.label}</span>
          </div>
        </button>
      </div>
    );
  };

  return (
    <>
      {middleActions.length > 0 && (
        <div className="fixed top-1/2 -translate-y-1/2 right-4 z-[60] flex flex-col gap-2 items-end pointer-events-none opacity-80 hover:opacity-100 transition-opacity">
          {middleActions.map(renderAction)}
        </div>
      )}
      {bottomActions.length > 0 && (
        <div className="fixed bottom-20 right-8 z-[60] flex flex-col gap-4 items-end pointer-events-none">
          {bottomActions.map(renderAction)}
        </div>
      )}
    </>
  );
}
