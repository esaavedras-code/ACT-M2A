import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { X, Loader2, Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export interface AssignedItem {
    item_num: string;
    quantity: number;
    type: "Especializada" | "NO Especializada";
}

export default function SubcontractItemsModal({ 
    isOpen, 
    onClose, 
    projectId, 
    subcontractorName,
    assignedItems, 
    onSave 
}: { 
    isOpen: boolean, 
    onClose: () => void, 
    projectId: string, 
    subcontractorName: string,
    assignedItems: AssignedItem[], 
    onSave: (items: AssignedItem[]) => void 
}) {
    const [projectItems, setProjectItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Instead of a dictionary of selections, we use an array of rows
    const [rows, setRows] = useState<Array<{
        id: string; // unique row id
        item_num: string;
        spec_num: string;
        description: string;
        unit: string;
        quantity: number;
        unit_price: number;
        type: "Especializada" | "NO Especializada";
    }>>([]);

    useEffect(() => {
        if (!isOpen || !projectId) return;
        fetchItems();
    }, [isOpen, projectId]);

    const fetchItems = async () => {
        setLoading(true);
        const { data } = await supabase.from('contract_items').select('*').eq('project_id', projectId);
        if (data) {
            const sorted = data.sort((a, b) => a.item_num.localeCompare(b.item_num, undefined, { numeric: true }));
            setProjectItems(sorted);
            
            // Reconstruct rows from assignedItems based on fetched data
            const initialRows = (assignedItems || []).map(ai => {
                const projectItem = sorted.find(pi => pi.item_num === ai.item_num);
                return {
                    id: Math.random().toString(36).substr(2, 9),
                    item_num: ai.item_num,
                    spec_num: projectItem ? projectItem.spec_num || "" : "",
                    description: projectItem ? projectItem.description || "" : "",
                    unit: projectItem ? projectItem.unit || "" : "",
                    quantity: ai.quantity,
                    unit_price: projectItem ? parseFloat(projectItem.unit_price || 0) : 0,
                    type: ai.type || "NO Especializada"
                };
            });
            // If empty, add one empty row
            if (initialRows.length === 0) {
                initialRows.push(createEmptyRow());
            }
            setRows(initialRows as any);
        }
        setLoading(false);
    };

    const createEmptyRow = () => ({
        id: Math.random().toString(36).substr(2, 9),
        item_num: "",
        spec_num: "",
        description: "",
        unit: "",
        quantity: 0,
        unit_price: 0,
        type: "NO Especializada" as const
    });

    const handleAddRow = () => {
        setRows([...rows, createEmptyRow()]);
    };

    const handleRemoveRow = (id: string) => {
        setRows(rows.filter(r => r.id !== id));
    };

    const handleItemChange = (id: string, newItemNum: string) => {
        const pItem = projectItems.find(p => p.item_num === newItemNum);
        setRows(rows.map(r => {
            if (r.id === id) {
                if (pItem) {
                    return {
                        ...r,
                        item_num: newItemNum,
                        spec_num: pItem.spec_num || "",
                        description: pItem.description || "",
                        unit: pItem.unit || "",
                        quantity: parseFloat(pItem.quantity || 0),
                        unit_price: parseFloat(pItem.unit_price || 0)
                    };
                }
                return { ...r, item_num: newItemNum }; // just update number if not found
            }
            return r;
        }));
    };

    const handleRowChange = (id: string, field: string, value: any) => {
        setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const handleSave = () => {
        const finalItems: AssignedItem[] = rows
            .filter(r => r.item_num.trim() !== "")
            .map(r => ({
                item_num: r.item_num,
                quantity: r.quantity,
                type: r.type
            }));
        onSave(finalItems);
        onClose();
    };

    const totalAmount = rows.reduce((acc, r) => acc + (r.quantity * r.unit_price), 0);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white">Partidas Asignadas</h2>
                        <p className="text-xs font-bold text-slate-500">Subcontratista: <span className="text-primary">{subcontractorName || "Sin Nombre"}</span></p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {loading ? (
                        <div className="flex items-center justify-center h-32"><Loader2 size={24} className="animate-spin text-primary" /></div>
                    ) : (
                        <div className="space-y-4">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-700 text-[10px] uppercase font-black text-slate-400">
                                        <th className="pb-2 pl-2 w-32">Partida</th>
                                        <th className="pb-2">Spec</th>
                                        <th className="pb-2">Descripción</th>
                                        <th className="pb-2 text-right">Cantidad</th>
                                        <th className="pb-2 text-center">Unidad</th>
                                        <th className="pb-2 text-right">Unit Price</th>
                                        <th className="pb-2 text-right">Amount</th>
                                        <th className="pb-2 pl-4">Tipo</th>
                                        <th className="pb-2 text-center w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row) => (
                                        <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/20 group">
                                            <td className="py-2 pl-2 pr-2">
                                                <input 
                                                    type="text" 
                                                    list={`items-list-${row.id}`}
                                                    value={row.item_num}
                                                    onChange={(e) => handleItemChange(row.id, e.target.value)}
                                                    placeholder="Ej. 100-1"
                                                    className="w-full px-2 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-primary uppercase"
                                                />
                                                <datalist id={`items-list-${row.id}`}>
                                                    {projectItems.map(p => <option key={p.id} value={p.item_num}>{p.description}</option>)}
                                                </datalist>
                                            </td>
                                            <td className="py-2 pr-2">
                                                <span className="text-xs text-slate-500 font-medium">{row.spec_num || "-"}</span>
                                            </td>
                                            <td className="py-2 pr-2">
                                                <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold line-clamp-1" title={row.description}>{row.description || "-"}</span>
                                            </td>
                                            <td className="py-2 text-right pr-2">
                                                <input 
                                                    type="number" 
                                                    value={row.quantity || ""}
                                                    onChange={(e) => handleRowChange(row.id, 'quantity', parseFloat(e.target.value) || 0)}
                                                    className="w-24 text-right px-2 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-primary"
                                                />
                                            </td>
                                            <td className="py-2 text-center pr-2">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">{row.unit || "-"}</span>
                                            </td>
                                            <td className="py-2 text-right pr-2 text-xs font-bold text-slate-600 dark:text-slate-400">
                                                {formatCurrency(row.unit_price)}
                                            </td>
                                            <td className="py-2 text-right pr-2 text-xs font-black text-primary">
                                                {formatCurrency(row.quantity * row.unit_price)}
                                            </td>
                                            <td className="py-2 pl-4">
                                                <select 
                                                    value={row.type}
                                                    onChange={(e) => handleRowChange(row.id, 'type', e.target.value)}
                                                    className="w-full px-2 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-primary"
                                                >
                                                    <option value="NO Especializada">NO Especializada</option>
                                                    <option value="Especializada">Especializada</option>
                                                </select>
                                            </td>
                                            <td className="py-2 pr-2 text-center">
                                                <button 
                                                    onClick={() => handleRemoveRow(row.id)}
                                                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Eliminar fila"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <button 
                                onClick={handleAddRow}
                                className="mt-4 flex items-center gap-2 text-xs font-bold text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 px-4 py-2 rounded-xl transition-colors"
                            >
                                <Plus size={14} /> Añadir otra partida
                            </button>
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 rounded-b-3xl">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total del Subcontrato</span>
                        <span className="text-xl font-black text-slate-900 dark:text-white">
                            {formatCurrency(totalAmount)}
                        </span>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-6 py-2 rounded-xl text-xs font-black text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors uppercase tracking-widest">
                            Cancelar
                        </button>
                        <button onClick={handleSave} className="px-6 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-black uppercase tracking-widest transition-colors shadow-md shadow-primary/20">
                            Guardar Asignación
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
