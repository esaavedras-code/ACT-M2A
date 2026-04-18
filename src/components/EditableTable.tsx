import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Column<T> {
  header: string;
  key: keyof T;
  type: 'text' | 'number' | 'select' | 'computed' | 'date';
  options?: string[];
  compute?: (row: T) => number;
}

interface EditableTableProps<T> {
  title: string;
  columns: Column<T>[];
  data: T[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (index: number, key: keyof T, value: any) => void;
}

export function EditableTable<T extends { id: string }>({ 
  title, 
  columns, 
  data, 
  onAdd, 
  onRemove, 
  onChange 
}: EditableTableProps<T>) {
  // Compute grand total for computed columns
  const computedTotals = columns
    .filter(col => col.type === 'computed' && col.compute)
    .map(col => ({
      key: col.key,
      total: data.reduce((sum, item) => sum + (col.compute!(item) || 0), 0)
    }));

  return (
    <div className="mb-8 overflow-hidden rounded-[2rem] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      <div className="flex justify-between items-center px-6 py-5 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-widest text-[10px] sm:text-xs">{title}</h3>
        <button 
          onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black rounded-xl transition-all shadow-md shadow-blue-500/10 active:scale-95 uppercase tracking-widest"
        >
          <Plus size={14} />
          AÑADIR
        </button>
      </div>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/30 dark:bg-slate-900/30 text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">
              {columns.map((col, i) => (
                <th key={i} className={`px-6 py-4 border-b border-slate-50 dark:border-slate-800 ${col.type === 'computed' ? 'text-right bg-blue-50/50 dark:bg-blue-900/10 text-blue-500' : ''}`}>{col.header}</th>
              ))}
              <th className="px-6 py-4 border-b border-slate-50 dark:border-slate-800 w-12 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {data.map((item, index) => (
              <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group">
                {columns.map((col, i) => (
                  <td key={i} className={`px-3 py-2 ${col.type === 'computed' ? 'bg-blue-50/30 dark:bg-blue-900/5' : ''}`}>
                    {col.type === 'computed' && col.compute ? (
                      <span className="text-xs font-black text-blue-600 dark:text-blue-400 px-3 py-2 block text-right">
                        {formatCurrency(col.compute(item))}
                      </span>
                    ) : col.type === 'select' ? (
                      <select 
                        value={String(item[col.key])}
                        onChange={(e) => onChange(index, col.key, e.target.value)}
                        className="w-full bg-slate-100/50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-white px-2 py-2 outline-none transition-all shadow-sm hover:border-slate-300 dark:hover:border-slate-600"
                      >
                        {col.options?.map(opt => <option key={opt} value={opt} className="bg-white dark:bg-slate-900">{opt}</option>)}
                      </select>
                      ) : col.type === 'date' ? (
                        <input 
                          type="date"
                          value={String(item[col.key] || '')}
                          onChange={(e) => onChange(index, col.key, e.target.value)}
                          className="w-full bg-slate-100/50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-white px-3 py-2 outline-none transition-all shadow-sm hover:border-slate-300 dark:hover:border-slate-600"
                        />
                      ) : (
                        <input 
                          type={col.type}
                          value={String(item[col.key] || '')}
                          onChange={(e) => onChange(index, col.key, col.type === 'number' ? Number(e.target.value) : e.target.value)}
                          className="w-full bg-slate-100/50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-white px-3 py-2 outline-none transition-all shadow-sm hover:border-slate-300 dark:hover:border-slate-600"
                        />
                      )}
                  </td>
                ))}
                <td className="px-3 py-2 text-center">
                  <button 
                    onClick={() => onRemove(index)}
                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
                <tr>
                    <td colSpan={columns.length + 1} className="px-6 py-10 text-center text-slate-400 font-bold italic text-xs">
                        Haga clic en 'Añadir' para ingresar nuevos registros.
                    </td>
                </tr>
            )}
          </tbody>
          {/* Grand total row for computed columns */}
          {data.length > 0 && computedTotals.length > 0 && (
            <tfoot>
              <tr className="bg-blue-50/50 dark:bg-blue-900/10 border-t-2 border-blue-200 dark:border-blue-800">
                {columns.map((col, i) => (
                  <td key={i} className="px-6 py-4">
                    {col.type === 'computed' ? (
                      <span className="text-sm font-black text-blue-700 dark:text-blue-300 block text-right">
                        {formatCurrency(computedTotals.find(ct => ct.key === col.key)?.total || 0)}
                      </span>
                    ) : i === 0 ? (
                      <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">SUBTOTAL</span>
                    ) : null}
                  </td>
                ))}
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
