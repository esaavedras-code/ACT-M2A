"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
    X, Save, FileText, CheckCircle2, AlertCircle, 
    Info, ChevronRight, LayoutDashboard, Settings2,
    CheckSquare, Square
} from "lucide-react";
import { generateDOFAEI } from "@/lib/generateDOFAEI";

interface DOFAEIFormProps {
    projectId: string;
    choId: string;
    onClose: () => void;
}

const EVAL_CRITERIA = [
    {
        title: "1. Impact on the original scope of work",
        items: [
            { id: "1.1", text: "Proposed work includes subsidiary obligations of the scope specified in the original bid documents or approved change orders." },
            { id: "1.2", text: "Proposed work is out of the previously authorized scope of work" },
            { id: "1.3", text: "Proposed work extends beyond the project boundaries" },
            { id: "1.4", text: "Proposed work adversely impacts work already underway" },
            { id: "1.5", text: "The cost of the proposed work exceeds available funds (contingencies)" },
            { id: "1.6", text: "Proposed change is related to re-do or faulty work." }
        ]
    },
    {
        title: "2. Basis of payment",
        items: [
            { id: "2.1", text: "PRHTA's independent evaluation of proposed works and contractor's price proposal discovered significant discrepancies." },
            { id: "2.2", text: "Cost analysis of each negotiated contract change or negotiated extra work order has not been documented." }
        ]
    },
    {
        title: "3. Time Adjustments",
        items: [
            { id: "3.1", text: "Contract time extension has not been fully justified and adequately documented." }
        ]
    },
    {
        title: "4. Other Considerations",
        items: [
            { id: "4.1", text: "Proposed work involves routine maintenance." },
            { id: "4.2", text: "Proposed change involves maintenance items, the purchase of surplus material, spare parts, material not incorporated in the project." }
        ]
    }
];

export default function DOFAEIForm({ projectId, choId, onClose }: DOFAEIFormProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [choData, setChoData] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const [dofaeiData, setDofaeiData] = useState<any>({
        road_classif: "NHS",
        determination_conditions: {
            deductive_items: false,
            safety_items: false,
            rideability_bonus: false,
            sub_estimated_items: false,
            minor_change: false,
            known_non_participating: false,
            other: ""
        },
        evaluations: {},
        prepared_by_name: "",
        prepared_by_position: "",
        prepared_by_date: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const { data: cho } = await supabase.from('chos').select('*').eq('id', choId).single();
                if (cho) {
                    setChoData(cho);
                    setItems(cho.items || []);
                    if (cho.dofaei_data && Object.keys(cho.dofaei_data).length > 0) {
                        setDofaeiData({
                            ...dofaeiData,
                            ...cho.dofaei_data
                        });
                    }
                }
                
                // Cargar datos del usuario actual para el preparador
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    const { data: userData } = await supabase.from('users').select('name').eq('id', session.user.id).single();
                    if (userData && !dofaeiData.prepared_by_name) {
                        setDofaeiData((prev: any) => ({ ...prev, prepared_by_name: userData.name }));
                    }
                }
            } catch (err) {
                console.error("Error loading DOFAEI data:", err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [choId]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const { error } = await supabase
                .from('chos')
                .update({ dofaei_data: dofaeiData })
                .eq('id', choId);
            
            if (error) throw error;
            alert("Evaluación DOFAEI guardada correctamente");
        } catch (err: any) {
            alert("Error al guardar: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleGenerateExcel = async () => {
        await handleSave();
        try {
            const blob = await generateDOFAEI(projectId, choId);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `DOFAEI_CHO_${choData?.cho_num}${choData?.amendment_letter || ""}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Error generating Excel:", err);
            alert("Error al generar el Excel. Asegúrese de que el template esté disponible.");
        }
    };

    const toggleEval = (itemId: string, criterionId: string, value: string) => {
        const newEvals = { ...dofaeiData.evaluations };
        if (!newEvals[itemId]) newEvals[itemId] = {};
        
        // Si hace clic en el mismo que ya está, lo desmarca?
        // En este caso, el PDF original tiene X en uno u otro.
        newEvals[itemId][criterionId] = newEvals[itemId][criterionId] === value ? null : value;
        
        setDofaeiData({ ...dofaeiData, evaluations: newEvals });
    };

    if (loading) return (
        <div className="flex items-center justify-center p-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-6xl max-h-[90vh] rounded-[2.5rem] shadow-2xl border border-white/20 overflow-hidden flex flex-col">
                
                {/* Header */}
                <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-2xl">
                            <FileText size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black uppercase tracking-tight">Evaluación Federal Aid (DOFAEI)</h2>
                            <p className="text-xs font-bold text-blue-100 opacity-80">Change Order #{choData?.cho_num} - Enmienda {choData?.amendment_letter}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                    
                    {/* Seccion I: Project Info (Read Only) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-slate-100 dark:border-slate-800">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Clasificación de Carretera</label>
                            <div className="flex gap-2">
                                {["Interstate", "NHS", "Non NHS"].map(c => (
                                    <button 
                                        key={c}
                                        onClick={() => setDofaeiData({ ...dofaeiData, road_classif: c })}
                                        className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase transition-all ${
                                            dofaeiData.road_classif === c 
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' 
                                            : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 hover:border-blue-400'
                                        }`}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="md:col-span-2 bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Deductive Items</label>
                                <CheckButton 
                                    checked={dofaeiData.determination_conditions.deductive_items} 
                                    onChange={(v) => setDofaeiData({...dofaeiData, determination_conditions: {...dofaeiData.determination_conditions, deductive_items: v}})}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Safety Items</label>
                                <CheckButton 
                                    checked={dofaeiData.determination_conditions.safety_items} 
                                    onChange={(v) => setDofaeiData({...dofaeiData, determination_conditions: {...dofaeiData.determination_conditions, safety_items: v}})}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Minor Change</label>
                                <CheckButton 
                                    checked={dofaeiData.determination_conditions.minor_change} 
                                    onChange={(v) => setDofaeiData({...dofaeiData, determination_conditions: {...dofaeiData.determination_conditions, minor_change: v}})}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Sub-estimated</label>
                                <CheckButton 
                                    checked={dofaeiData.determination_conditions.sub_estimated_items} 
                                    onChange={(v) => setDofaeiData({...dofaeiData, determination_conditions: {...dofaeiData.determination_conditions, sub_estimated_items: v}})}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Seccion VI: Matrix */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] overflow-hidden shadow-xl shadow-blue-900/5">
                        <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 flex items-center gap-2">
                                <Settings2 size={16} className="text-blue-600" />
                                Matriz de Evaluación de Elegibilidad Federal
                            </h3>
                            <div className="flex gap-4 text-[9px] font-black uppercase tracking-tighter">
                                <span className="flex items-center gap-1 text-blue-600"><div className="w-2 h-2 rounded-full bg-blue-600"></div> Y/T (Elegible)</span>
                                <span className="flex items-center gap-1 text-emerald-600"><div className="w-2 h-2 rounded-full bg-emerald-600"></div> N/F (No Elegible)</span>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800/50">
                                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase w-1/3">Criterio de Elegibilidad</th>
                                        {items.map(it => (
                                            <th key={it.id || it.item_num} className="p-4 text-[10px] font-black text-slate-400 uppercase text-center border-l border-slate-100 dark:border-slate-800 min-w-[100px]">
                                                Item #{it.item_num}
                                                <div className="text-[8px] opacity-60 line-clamp-1">{it.description}</div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {EVAL_CRITERIA.map(category => (
                                        <>
                                            <tr key={category.title} className="bg-amber-50/50 dark:bg-amber-900/10">
                                                <td colSpan={items.length + 1} className="p-3 text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">
                                                    {category.title}
                                                </td>
                                            </tr>
                                            {category.items.map(criterion => (
                                                <tr key={criterion.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                                    <td className="p-4 text-[11px] font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                                                        <span className="font-black text-blue-600 mr-2">{criterion.id}</span>
                                                        {criterion.text}
                                                    </td>
                                                    {items.map(it => {
                                                        const itemId = it.item_num;
                                                        const currentVal = dofaeiData.evaluations[itemId]?.[criterion.id];
                                                        
                                                        return (
                                                            <td key={it.id || it.item_num} className="p-2 border-l border-slate-50 dark:border-slate-800">
                                                                <div className="flex flex-col gap-1 items-center">
                                                                    <button 
                                                                        onClick={() => toggleEval(itemId, criterion.id, "YT")}
                                                                        className={`w-full py-1 text-[9px] font-black rounded-lg transition-all ${
                                                                            currentVal === "YT" 
                                                                            ? 'bg-blue-600 text-white shadow-md' 
                                                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-blue-100'
                                                                        }`}
                                                                    >
                                                                        Y/T
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => toggleEval(itemId, criterion.id, "NF")}
                                                                        className={`w-full py-1 text-[9px] font-black rounded-lg transition-all ${
                                                                            currentVal === "NF" 
                                                                            ? 'bg-emerald-600 text-white shadow-md' 
                                                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-emerald-100'
                                                                        }`}
                                                                    >
                                                                        N/F
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Firmas y Preparador */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Preparado por:</label>
                            <input 
                                type="text" 
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                value={dofaeiData.prepared_by_name}
                                onChange={(e) => setDofaeiData({...dofaeiData, prepared_by_name: e.target.value})}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Posición:</label>
                            <input 
                                type="text" 
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                value={dofaeiData.prepared_by_position}
                                onChange={(e) => setDofaeiData({...dofaeiData, prepared_by_position: e.target.value})}
                                placeholder="Ingeniero Residente, etc."
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Fecha:</label>
                            <input 
                                type="date" 
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                value={dofaeiData.prepared_by_date}
                                onChange={(e) => setDofaeiData({...dofaeiData, prepared_by_date: e.target.value})}
                            />
                        </div>
                    </div>

                </div>

                {/* Footer Actions */}
                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 italic">
                        <Info size={14} className="text-blue-500" />
                        Asegúrese de guardar antes de generar el PDF oficial.
                    </div>
                    <div className="flex gap-4">
                        <button 
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
                        >
                            <Save size={16} />
                            {saving ? "Guardando..." : "Guardar Datos"}
                        </button>
                        <button 
                            onClick={handleGenerateExcel}
                            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-600/30 transition-all active:scale-95"
                        >
                            <FileText size={16} />
                            Descargar Formato Excel
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}

function CheckButton({ checked, onChange }: { checked: boolean, onChange: (v: boolean) => void }) {
    return (
        <button 
            onClick={() => onChange(!checked)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                checked 
                ? 'bg-blue-600 text-white' 
                : 'bg-white dark:bg-slate-900 text-slate-400 border border-slate-200 dark:border-slate-700'
            }`}
        >
            {checked ? <CheckSquare size={14} /> : <Square size={14} />}
            {checked ? 'Marcado' : 'No marcado'}
        </button>
    );
}
