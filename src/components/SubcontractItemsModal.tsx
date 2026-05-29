import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { X, Search, Loader2 } from "lucide-react";

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
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    
    // local state mapping item_num to { quantity, type }
    const [selection, setSelection] = useState<Record<string, { quantity: number, type: string }>>({});

    useEffect(() => {
        if (!isOpen || !projectId) return;
        fetchItems();
        
        // initialize selection
        const initial: Record<string, { quantity: number, type: string }> = {};
        (assignedItems || []).forEach(i => {
            initial[i.item_num] = { quantity: i.quantity, type: i.type || "NO Especializada" };
        });
        setSelection(initial);
    }, [isOpen, projectId, assignedItems]);

    const fetchItems = async () => {
        setLoading(true);
        const { data } = await supabase.from('contract_items').select('*').eq('project_id', projectId);
        if (data) {
            // natural sort
            const sorted = data.sort((a, b) => a.item_num.localeCompare(b.item_num, undefined, { numeric: true }));
            setItems(sorted);
        }
        setLoading(false);
    };

    const handleCheck = (itemNum: string, defaultQty: number) => {
        setSelection(prev => {
            const next = { ...prev };
            if (next[itemNum]) {
                delete next[itemNum];
            } else {
                next[itemNum] = { quantity: defaultQty, type: "NO Especializada" };
            }
            return next;
        });
    };

    const handleQtyChange = (itemNum: string, qty: number) => {
        setSelection(prev => {
            if (!prev[itemNum]) return prev;
            return { ...prev, [itemNum]: { ...prev[itemNum], quantity: qty } };
        });
    };

    const handleTypeChange = (itemNum: string, type: string) => {
        setSelection(prev => {
            if (!prev[itemNum]) return prev;
            return { ...prev, [itemNum]: { ...prev[itemNum], type } };
        });
    };

    const handleSave = () => {
        const finalItems: AssignedItem[] = Object.keys(selection).map(item_num => ({
            item_num,
            quantity: selection[item_num].quantity,
            type: selection[item_num].type as "Especializada" | "NO Especializada"
        }));
        onSave(finalItems);
        onClose();
    };

    if (!isOpen) return null;

    const filtered = items.filter(i => 
        i.item_num.toLowerCase().includes(search.toLowerCase()) || 
        (i.description && i.description.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white">Partidas Asignadas</h2>
                        <p className="text-xs font-bold text-slate-500">Subcontratista: <span className="text-primary">{subcontractorName || "Sin Nombre"}</span></p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Buscar partida..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {loading ? (
                        <div className="flex items-center justify-center h-32"><Loader2 size={24} className="animate-spin text-primary" /></div>
                    ) : (
                        <div className="space-y-2">
                            {filtered.map(item => {
                                const isSelected = !!selection[item.item_num];
                                const selData = selection[item.item_num];
                                const origQty = parseFloat(item.quantity || 0);

                                return (
                                    <div key={item.id} className={`flex items-center gap-4 p-3 rounded-2xl border transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'border-slate-100 dark:border-slate-800 hover:border-slate-300'}`}>
                                        <input 
                                            type="checkbox" 
                                            checked={isSelected}
                                            onChange={() => handleCheck(item.item_num, origQty)}
                                            className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer shrink-0"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-black text-slate-900 dark:text-white truncate">
                                                {item.item_num} <span className="text-xs text-slate-400 ml-2 font-semibold">{item.description}</span>
                                            </p>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase">
                                                Original: {origQty} {item.unit} @ ${parseFloat(item.unit_price||0).toFixed(2)}
                                            </p>
                                        </div>
                                        
                                        {isSelected && (
                                            <div className="flex items-center gap-3 shrink-0">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Cantidad</span>
                                                    <input 
                                                        type="number" 
                                                        value={selData.quantity}
                                                        onChange={(e) => handleQtyChange(item.item_num, parseFloat(e.target.value) || 0)}
                                                        className="w-24 px-2 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-primary"
                                                    />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Tipo</span>
                                                    <select 
                                                        value={selData.type}
                                                        onChange={(e) => handleTypeChange(item.item_num, e.target.value)}
                                                        className="w-36 px-2 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-primary"
                                                    >
                                                        <option value="NO Especializada">NO Especializada</option>
                                                        <option value="Especializada">Especializada</option>
                                                    </select>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {filtered.length === 0 && <p className="text-center text-slate-500 py-8 text-sm">No se encontraron partidas</p>}
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                    <span className="text-xs font-bold text-slate-500">{Object.keys(selection).length} partidas seleccionadas</span>
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
