"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { Save, Info, Download, Upload } from "lucide-react";
import FloatingFormActions from "./FloatingFormActions";
import { formatCurrency } from "@/lib/utils";
import { exportSectionToJSON, importSectionFromJSON } from "@/lib/sectionIO";

interface CCMLMod {
    modification_num: number;
    label: string;
    federal_share: number;
    toll_credits: number;
    state_funds: number;
}

const ROWS_COUNT = 11; // 0 for Original, 1-10 for modifications

import type { FormRef } from "./ProjectForm";

const CCMLModificationsForm = forwardRef<FormRef, { projectId: string, onSaved?: () => void, onDirty?: () => void }>(({ projectId, onSaved, onDirty }, ref) => {
    const [mods, setMods] = useState<CCMLMod[]>([]);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [editingField, setEditingField] = useState<{ idx: number, field: string } | null>(null);

    useEffect(() => {
        if (projectId) fetchMods();
    }, [projectId]);

    const fetchMods = async () => {
        setFetching(true);
        try {
            const { data } = await supabase
                .from('project_ccml_modifications')
                .select('*')
                .eq('project_id', projectId)
                .order('modification_num', { ascending: true });

            const initialMods: CCMLMod[] = [];
            for (let i = 0; i < ROWS_COUNT; i++) {
                const label = i === 0 ? "Original Project Funds" : `Modification #${i}`;
                const dbMod = data?.find(m => m.modification_num === i);
                initialMods.push({
                    modification_num: i,
                    label: dbMod?.label || label,
                    federal_share: dbMod?.federal_share || 0,
                    toll_credits: dbMod?.toll_credits || 0,
                    state_funds: dbMod?.state_funds || 0
                });
            }
            setMods(initialMods);
        } catch (err) {
            console.error("Error fetching mods:", err);
        } finally {
            setFetching(false);
        }
    };

    const handleChange = (idx: number, field: keyof CCMLMod, value: any) => {
        const newMods = [...mods];
        (newMods[idx] as any)[field] = value;
        
        // Auto-calculate State Funds if Total Cost or Federal Share changes?
        // Let's keep it manual asrequested "pida la informacion de las celdas en blanco"
        // although usually State Funds = Total Cost - Federal Share.
        
        setMods(newMods);
        if (onDirty) onDirty();
    };

    useImperativeHandle(ref, () => ({ save: () => saveMods() }));

    const saveMods = async () => {
        setLoading(true);
        try {
            const dataToUpsert = mods.map(m => ({
                ...m,
                project_id: projectId
            }));

            const { error } = await supabase
                .from('project_ccml_modifications')
                .upsert(dataToUpsert, { onConflict: 'project_id, modification_num' });

            if (error) throw error;
            alert("Información de Cambios al CCML guardada con éxito.");
            if (onSaved) onSaved();
        } catch (err: any) {
            alert("Error al guardar: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    if (fetching) return <div className="p-10 text-center animate-pulse text-slate-400">Cargando sección 14...</div>;

    return (
        <div className="space-y-6">
            <div className="sticky top-0 z-40 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/95 backdrop-blur-md dark:bg-slate-800/95 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm -mx-4 px-4 md:-mx-8 md:px-8">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
                        <Info className="text-primary" size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase">14. Cambios al CCML</h3>
                        <p className="text-slate-500 text-xs font-medium">Información de Cartas de Requerimiento de Modificación de Proyecto</p>
                    </div>
                </div>
                {/* El botón de guardar ahora es flotante */}
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800 flex items-start gap-3">
                <Info size={16} className="text-blue-600 mt-0.5 shrink-0" />
                <p className="text-[11px] text-blue-800 dark:text-blue-300 font-medium leading-relaxed italic">
                    AS INDICATED IN THE PROJECT MODIFICATION REQUEST LETTERS (THE LETTERS ARE DEVELOPED BY THE PRHTA FEDERAL LIAISON OFFICE AND EVALUATED/APPROVED BY THE FHWA PR/USVI DIVISION. 
                    FUNDS INFORMATION IN THE LETTERS WILL BE ACCESSED THROUGH A FOLDER IN A CLOUD PLATFORM):
                </p>
            </div>

            <div className="overflow-x-auto rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
                <table className="min-w-full text-xs border-collapse">
                    <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800">
                            <th className="border p-3 text-left font-black text-slate-500 uppercase tracking-widest min-w-[200px]">
                                Obligations Amount (excludes Payroll, Mileage and Diets)
                            </th>
                            <th className="border p-3 bg-orange-50 dark:bg-orange-900/20 text-orange-700 font-black uppercase tracking-widest">Federal Share</th>
                            <th className="border p-3 bg-green-50 dark:bg-green-900/20 text-green-700 font-black uppercase tracking-widest">Toll Credits</th>
                            <th className="border p-3 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 font-black uppercase tracking-widest">State Funds</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                        {mods.map((mod, idx) => (
                            <tr key={idx} className={idx === 0 ? "bg-slate-50/50 font-bold" : ""}>
                                <td className="border p-3 bg-slate-50/30 dark:bg-slate-800/20 font-bold text-slate-700 dark:text-slate-300">
                                    {mod.label}
                                </td>
                                {/* Federal Share */}
                                <td className="border p-1 text-right" style={{ backgroundColor: '#66FF99' }}>
                                    {editingField?.idx === idx && editingField?.field === 'federal_share' ? (
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full border-none p-2 text-right rounded-lg focus:ring-2 focus:ring-primary/20 outline-none font-bold text-black"
                                            style={{ backgroundColor: '#66FF99' }}
                                            value={mod.federal_share || ""}
                                            autoFocus
                                            onBlur={() => setEditingField(null)}
                                            onChange={(e) => handleChange(idx, 'federal_share', parseFloat(e.target.value) || 0)}
                                            onKeyDown={(e) => e.key === 'Enter' && setEditingField(null)}
                                        />
                                    ) : (
                                        <div 
                                            className="p-2 cursor-pointer hover:bg-black/5 dark:hover:bg-slate-800/50 rounded-lg transition-colors font-bold text-black"
                                            onClick={() => setEditingField({ idx, field: 'federal_share' })}
                                        >
                                            {formatCurrency(mod.federal_share)}
                                        </div>
                                    )}
                                </td>
                                {/* Toll Credits */}
                                <td className="border p-1 text-right" style={{ backgroundColor: '#66FF99' }}>
                                    {editingField?.idx === idx && editingField?.field === 'toll_credits' ? (
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full border-none p-2 text-right rounded-lg focus:ring-2 focus:ring-primary/20 outline-none font-bold text-black"
                                            style={{ backgroundColor: '#66FF99' }}
                                            value={mod.toll_credits || ""}
                                            autoFocus
                                            onBlur={() => setEditingField(null)}
                                            onChange={(e) => handleChange(idx, 'toll_credits', parseFloat(e.target.value) || 0)}
                                            onKeyDown={(e) => e.key === 'Enter' && setEditingField(null)}
                                        />
                                    ) : (
                                        <div 
                                            className="p-2 cursor-pointer hover:bg-black/5 dark:hover:bg-slate-800/50 rounded-lg transition-colors font-bold text-black"
                                            onClick={() => setEditingField({ idx, field: 'toll_credits' })}
                                        >
                                            {formatCurrency(mod.toll_credits)}
                                        </div>
                                    )}
                                </td>
                                {/* State Funds */}
                                <td className="border p-1 text-right" style={{ backgroundColor: '#66FF99' }}>
                                    {editingField?.idx === idx && editingField?.field === 'state_funds' ? (
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full border-none p-2 text-right rounded-lg focus:ring-2 focus:ring-primary/20 outline-none font-bold text-black"
                                            style={{ backgroundColor: '#66FF99' }}
                                            value={mod.state_funds || ""}
                                            autoFocus
                                            onBlur={() => setEditingField(null)}
                                            onChange={(e) => handleChange(idx, 'state_funds', parseFloat(e.target.value) || 0)}
                                            onKeyDown={(e) => e.key === 'Enter' && setEditingField(null)}
                                        />
                                    ) : (
                                        <div 
                                            className="p-2 cursor-pointer hover:bg-black/5 dark:hover:bg-slate-800/50 rounded-lg transition-colors font-bold text-black"
                                            onClick={() => setEditingField({ idx, field: 'state_funds' })}
                                        >
                                            {formatCurrency(mod.state_funds)}
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {/* Revised Amount row */}
                        <tr className="bg-slate-900 text-white font-black">
                            <td className="border p-3 uppercase tracking-widest text-[10px]">Revised Amount</td>
                            <td className="border p-3 text-right text-orange-400">{formatCurrency(mods.reduce((acc, m) => acc + m.federal_share, 0))}</td>
                            <td className="border p-3 text-right text-green-400">{formatCurrency(mods.reduce((acc, m) => acc + m.toll_credits, 0))}</td>
                            <td className="border p-3 text-right text-yellow-400">{formatCurrency(mods.reduce((acc, m) => acc + m.state_funds, 0))}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <input id="import-ccml-json" type="file" accept=".json" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const result = await importSectionFromJSON(file);
                if (result.success && Array.isArray(result.data)) {
                    const imported: CCMLMod[] = result.data.map((m: any) => ({
                        modification_num: m.modification_num ?? 0,
                        label: m.label ?? '',
                        federal_share: m.federal_share ?? 0,
                        toll_credits: m.toll_credits ?? 0,
                        state_funds: m.state_funds ?? 0,
                    }));
                    setMods(imported);
                    if (onDirty) onDirty();
                    alert("Datos CCML importados. Guarde para confirmar.");
                } else {
                    alert("Error al importar: " + (result.error || "Formato inválido"));
                }
                e.target.value = "";
            }} />
            <FloatingFormActions
                actions={[
                    {
                        label: "Exportar JSON", position: "middle-right" as const, size: "small" as const,
                        icon: <Download />,
                        onClick: () => exportSectionToJSON("ccml_modificaciones", mods),
                        description: "Exportar tabla de modificaciones CCML a un archivo JSON",
                        variant: 'info' as const,
                        disabled: loading
                    },
                    {
                        label: "Importar JSON", position: "middle-right" as const, size: "small" as const,
                        icon: <Upload />,
                        onClick: () => document.getElementById('import-ccml-json')?.click(),
                        description: "Cargar tabla de modificaciones CCML desde un archivo JSON",
                        variant: 'secondary' as const,
                        disabled: loading
                    },
                    {
                        label: loading ? "Guardando..." : "Guardar cambios",
                        icon: <Save />,
                        onClick: () => saveMods(),
                        description: "Actualizar y sincronizar las modificaciones y montos obligados del CCML",
                        variant: 'primary' as const,
                        disabled: loading
                    }
                ]}
            />
        </div>
    );

});

export default CCMLModificationsForm;
