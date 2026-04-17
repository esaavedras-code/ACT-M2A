import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface Column<T> {
  header: string;
  key: keyof T;
  type: 'text' | 'number' | 'select';
  options?: string[];
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
  return (
    <div className="mb-8 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <div className="flex justify-between items-center px-6 py-4 border-b border-white/10 bg-white/5">
        <h3 className="font-bold text-white uppercase tracking-wider text-sm">{title}</h3>
        <button 
          onClick={onAdd}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          AÑADIR
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-white/5 text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">
              {columns.map((col, i) => (
                <th key={i} className="px-6 py-3">{col.header}</th>
              ))}
              <th className="px-6 py-3 w-10 text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data.map((item, index) => (
              <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                {columns.map((col, i) => (
                  <td key={i} className="px-4 py-2">
                    {col.type === 'select' ? (
                      <select 
                        value={String(item[col.key])}
                        onChange={(e) => onChange(index, col.key, e.target.value)}
                        className="w-full bg-transparent border-none focus:ring-1 focus:ring-blue-500/50 rounded text-sm text-slate-300"
                      >
                        {col.options?.map(opt => <option key={opt} value={opt} className="bg-slate-900">{opt}</option>)}
                      </select>
                    ) : (
                      <input 
                        type={col.type}
                        value={String(item[col.key])}
                        onChange={(e) => onChange(index, col.key, col.type === 'number' ? Number(e.target.value) : e.target.value)}
                        className="w-full bg-transparent border-none focus:ring-1 focus:ring-blue-500/50 rounded text-sm text-slate-300 px-2 py-1"
                      />
                    )}
                  </td>
                ))}
                <td className="px-4 py-2 text-center">
                  <button 
                    onClick={() => onRemove(index)}
                    className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
