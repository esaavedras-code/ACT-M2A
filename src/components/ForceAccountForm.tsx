"use client";

import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { Save, Plus, Trash2, Calculator, Users, Truck, Package, FileText, ChevronRight, ChevronLeft, LayoutDashboard } from "lucide-react";
import FloatingFormActions from "./FloatingFormActions";
import type { FormRef } from "./ProjectForm";
import { formatCurrency } from "@/lib/utils";

const ForceAccountForm = forwardRef<FormRef, { projectId?: string, numAct?: string, onDirty?: () => void, onSaved?: () => void }>(function ForceAccountForm({ projectId, numAct, onDirty, onSaved }, ref) {
    const [activeSubTab, setActiveSubTab] = useState("list"); // list, edit
    const [forceAccounts, setForceAccounts] = useState<any[]>([]);
    const [currentFA, setCurrentFA] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    
    // Sub-sections of a single Force Account
    const [editTab, setEditTab] = useState("general"); // general; labor, equipment, materials, summary

    useEffect(() => {
        if (projectId) fetchForceAccounts();
    }, [projectId]);

    const fetchForceAccounts = async () => {
        setLoading(true);
        const { data, error } = await supabase.from("force_accounts").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
        if (data) setForceAccounts(data);
        setLoading(false);
    };

    const handleCreateNew = () => {
        const newFA = {
            project_id: projectId,
            fa_num: `FA-${forceAccounts.length + 1}`,
            descripcion: "",
            fecha_inicio: new Date().toISOString().split("T")[0],
            fecha_fin: "",
            labor: [],
            equipment: [],
            materials: []
        };
        setCurrentFA(newFA);
        setActiveSubTab("edit");
        setEditTab("general");
    };

    const handleEdit = async (fa: any) => {
        setLoading(true);
        const [laborRes, equipRes, matRes] = await Promise.all([
            supabase.from("fa_labor").select("*").eq("force_account_id", fa.id),
            supabase.from("fa_equipment").select("*").eq("force_account_id", fa.id),
            supabase.from("fa_materials").select("*").eq("force_account_id", fa.id)
        ]);

        setCurrentFA({
            ...fa,
            labor: laborRes.data || [],
            equipment: equipRes.data || [],
            materials: matRes.data || []
        });
        setActiveSubTab("edit");
        setLoading(false);
    };

    const saveData = async (silent = false) => {
        if (!currentFA || !projectId) return;
        setLoading(true);
        
        try {
            const { labor, equipment, materials, ...faData } = currentFA;
            
            let faId = currentFA.id;
            if (faId) {
                await supabase.from("force_accounts").update(faData).eq("id", faId);
            } else {
                const { data, error } = await supabase.from("force_accounts").insert([faData]).select().single();
                if (error) throw error;
                faId = data.id;
                setCurrentFA((prev: any) => ({ ...prev, id: faId }));
            }

            // Upsert child tables
            const processChildTable = async (table: string, items: any[]) => {
                const itemsWithFAId = items.map(item => {
                    const { id, created_at, ...rest } = item;
                    return { ...rest, force_account_id: faId };
                });
                
                // For simplicity in this tool, we delete and re-insert 
                // In production, a proper upsert/diff would be better
                await supabase.from(table).delete().eq("force_account_id", faId);
                if (itemsWithFAId.length > 0) {
                    await supabase.from(table).insert(itemsWithFAId);
                }
            };

            await Promise.all([
                processChildTable("fa_labor", labor),
                processChildTable("fa_equipment", equipment),
                processChildTable("fa_materials", materials)
            ]);

            if (!silent) alert("Force Account guardado exitosamente");
            fetchForceAccounts();
            if (onSaved) onSaved();
            setActiveSubTab("list");
        } catch (err: any) {
            alert("Error al guardar: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    useImperativeHandle(ref, () => ({ save: () => saveData(true) }));

    const calculateTotals = () => {
        if (!currentFA) return { labor: 0, equipment: 0, materials: 0, total: 0 };
        const labor = currentFA.labor?.reduce((acc: number, curr: any) => 
            acc + ((curr.horas_normales || 0) * (curr.tasa_normal || 0)) + ((curr.horas_extra || 0) * (curr.tasa_extra || 0)), 0) || 0;
        const equipment = currentFA.equipment?.reduce((acc: number, curr: any) => 
            acc + ((curr.horas_activo || 0) * (curr.tasa_activo || 0)) + ((curr.horas_inactivo || 0) * (curr.tasa_inactivo || 0)), 0) || 0;
        const materials = currentFA.materials?.reduce((acc: number, curr: any) => 
            acc + ((curr.cantidad || 0) * (curr.precio_unitario || 0)), 0) || 0;
        
        return { labor, equipment, materials, total: labor + equipment + materials };
    };

    if (activeSubTab === "list") {
        return (
            <div className="space-y-6">
                <div className="sticky top-0 z-40 bg-[#F8FAFC]/95 dark:bg-[#020617]/95 backdrop-blur-md pt-6 pb-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Calculator className="text-primary" />
                        12. Force Account
                    </h2>
                    <div className="flex items-center gap-3">
                        {/* Los botones ahora son flotantes para mayor accesibilidad */}
                        <button onClick={handleCreateNew} className="btn-primary flex items-center gap-2">
                            <Plus size={18} /> Nuevo Force Account
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {forceAccounts.map(fa => (
                        <div key={fa.id} className="card hover:shadow-md transition-all cursor-pointer border-l-4 border-primary" onClick={() => handleEdit(fa)}>
                            <div className="flex justify-between items-start mb-4">
                                <span className="text-xs font-black text-primary uppercase tracking-widest bg-primary/10 px-2 py-1 rounded-lg">{fa.fa_num}</span>
                                <span className="text-[10px] text-slate-400 font-bold">{new Date(fa.fecha_inicio).toLocaleDateString()}</span>
                            </div>
                            <h3 className="font-bold text-slate-800 dark:text-white mb-2 line-clamp-1">{fa.descripcion || "Sin descripción"}</h3>
                            <div className="flex items-center gap-2 text-primary font-black text-lg">
                                <ChevronRight size={20} className="ml-auto" />
                            </div>
                        </div>
                    ))}
                    {forceAccounts.length === 0 && (
                        <div className="col-span-full py-20 text-center text-slate-400 italic">No hay registros de Force Account.</div>
                    )}
                </div>
            </div>
        );
    }

    const totals = calculateTotals();

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="sticky top-0 z-40 bg-[#F8FAFC]/95 dark:bg-[#020617]/95 backdrop-blur-md pt-6 pb-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between mb-6">
                <button onClick={() => setActiveSubTab("list")} className="flex items-center gap-2 text-slate-500 hover:text-primary transition-colors font-bold text-sm">
                    <ChevronLeft size={18} /> Volver a la lista
                </button>
                <div className="flex gap-2">
                    {/* Los botones ahora son flotantes para mayor accesibilidad */}
                </div>
            </div>

            <FloatingFormActions
                actions={[
                    {
                        label: loading ? "Guardando..." : "Guardar cambios",
                        icon: <Save />,
                        onClick: () => saveData(false),
                        description: "Actualizar balances de mano de obra, equipo y materiales para este Force Account",
                        variant: 'primary' as const,
                        disabled: loading
                    }
                ]}
            />

            <div className="card p-0 overflow-hidden border-none shadow-xl rounded-[2rem] bg-white dark:bg-slate-900">
                <div className="bg-slate-50 dark:bg-slate-800/50 flex border-b border-slate-100 dark:border-slate-800">
                    <TabBtn id="general" active={editTab} set={setEditTab} icon={<FileText size={16} />} label="General" />
                    <TabBtn id="labor" active={editTab} set={setEditTab} icon={<Users size={16} />} label="Mano de Obra" />
                    <TabBtn id="equipment" active={editTab} set={setEditTab} icon={<Truck size={16} />} label="Equipo" />
                    <TabBtn id="materials" active={editTab} set={setEditTab} icon={<Package size={16} />} label="Materiales" />
                    <TabBtn id="summary" active={editTab} set={setEditTab} icon={<LayoutDashboard size={16} />} label="Resumen" />
                </div>

                <div className="p-8">
                    {editTab === "general" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Número de FA</label>
                                <input 
                                    className="input-field font-bold" 
                                    value={currentFA.fa_num} 
                                    onChange={e => setCurrentFA((prev: any) => ({ ...prev, fa_num: e.target.value }))} 
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha Inicio</label>
                                <input 
                                    type="date" 
                                    className="input-field" 
                                    value={currentFA.fecha_inicio} 
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentFA((prev: any) => ({...prev, fecha_inicio: e.target.value}))} 
                                />
                            </div>
                            <div className="md:col-span-2 space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descripción</label>
                                <textarea 
                                    rows={4} 
                                    className="input-field" 
                                    value={currentFA.descripcion} 
                                    onChange={e => setCurrentFA({...currentFA, descripcion: e.target.value})} 
                                />
                            </div>
                        </div>
                    )}

                    {editTab === "labor" && (
                        <TableEditor 
                            items={currentFA.labor} 
                            setItems={(items: any[]) => setCurrentFA((prev: any) => ({...prev, labor: items}))}
                            columns={[
                                { key: 'fecha', label: 'Fecha', type: 'date' },
                                { key: 'nombre', label: 'Nombre / Empleado', type: 'text' },
                                { key: 'clasificacion', label: 'Clasificación', type: 'text' },
                                { key: 'horas_normales', label: 'Horas Reg', type: 'number' },
                                { key: 'tasa_normal', label: 'Tasa Reg', type: 'number' },
                                { key: 'horas_extra', label: 'Horas Extra', type: 'number' },
                                { key: 'tasa_extra', label: 'Tasa Extra', type: 'number' },
                            ]}
                        />
                    )}

                    {editTab === "equipment" && (
                        <TableEditor 
                            items={currentFA.equipment} 
                            setItems={(items: any[]) => setCurrentFA((prev: any) => ({...prev, equipment: items}))}
                            columns={[
                                { key: 'fecha', label: 'Fecha', type: 'date' },
                                { key: 'descripcion', label: 'Descripción Equipo', type: 'text' },
                                { key: 'num_equipo', label: 'ID Equipo', type: 'text' },
                                { key: 'horas_activo', label: 'Hrs Act', type: 'number' },
                                { key: 'tasa_activo', label: 'Tasa Act', type: 'number' },
                                { key: 'horas_inactivo', label: 'Hrs Idle', type: 'number' },
                                { key: 'tasa_inactivo', label: 'Tasa Idle', type: 'number' },
                            ]}
                        />
                    )}

                    {editTab === "materials" && (
                        <TableEditor 
                            items={currentFA.materials} 
                            setItems={(items: any[]) => setCurrentFA((prev: any) => ({...prev, materials: items}))}
                            columns={[
                                { key: 'fecha', label: 'Fecha', type: 'date' },
                                { key: 'descripcion', label: 'Descripción Material', type: 'text' },
                                { key: 'unidad', label: 'Unidad', type: 'text' },
                                { key: 'cantidad', label: 'Cantidad', type: 'number' },
                                { key: 'precio_unitario', label: 'Precio Unit.', type: 'number' },
                            ]}
                        />
                    )}

                    {editTab === "summary" && (
                        <div className="space-y-8">
                            <h3 className="text-xl font-bold border-b pb-4">Desglose de Costos Finales</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <SummaryBlock label="Mano de Obra" value={totals.labor} icon={<Users />} />
                                <SummaryBlock label="Equipo" value={totals.equipment} icon={<Truck />} />
                                <SummaryBlock label="Materiales" value={totals.materials} icon={<Package />} />
                            </div>
                            <div className="bg-primary/5 p-8 rounded-[2.5rem] border-2 border-primary/10 flex justify-between items-center mt-12">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black text-primary uppercase tracking-widest">Total Force Account</span>
                                    <h4 className="text-4xl font-black text-primary">{formatCurrency(totals.total)}</h4>
                                </div>
                                <Calculator size={48} className="text-primary/20" />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

function TabBtn({ id, active, set, icon, label }: any) {
    const isActive = active === id;
    return (
        <button 
            onClick={() => set(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
                isActive ? 'bg-white dark:bg-slate-900 border-primary text-primary shadow-inner' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
        >
            {icon} {label}
        </button>
    );
}

function SummaryBlock({ label, value, icon }: any) {
    return (
        <div className="bg-slate-50 dark:bg-slate-850 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
            <div className="text-primary mb-2 opacity-50">{icon}</div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{formatCurrency(value)}</p>
        </div>
    );
}

function TableEditor({ items, setItems, columns }: any) {
    const handleAdd = () => {
        const newItem = columns.reduce((acc: any, col: any) => {
            acc[col.key] = col.type === 'number' ? 0 : col.type === 'date' ? new Date().toISOString().split("T")[0] : "";
            return acc;
        }, {});
        setItems([...items, newItem]);
    };

    const handleUpdate = (idx: number, key: string, val: any) => {
        const newItems = [...items];
        newItems[idx][key] = val;
        setItems(newItems);
    };

    const handleRemove = (idx: number) => {
        setItems(items.filter((_: any, i: number) => i !== idx));
    };

    return (
        <div className="space-y-4">
            <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/80">
                        <tr>
                            {columns.map((col: any) => (
                                <th key={col.key} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">{col.label}</th>
                            ))}
                            <th className="w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                        {items.map((item: any, idx: number) => (
                            <tr key={idx}>
                                {columns.map((col: any) => (
                                    <td key={col.key} className="px-2 py-2">
                                        <input 
                                            type={col.type} 
                                            className="input-field text-xs py-2" 
                                            value={item[col.key]} 
                                            onChange={e => handleUpdate(idx, col.key, col.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)} 
                                        />
                                    </td>
                                ))}
                                <td className="px-4 py-2">
                                    <button onClick={() => handleRemove(idx)} className="text-red-300 hover:text-red-500 transition-colors">
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <button onClick={handleAdd} className="flex items-center gap-1.5 text-xs font-black text-primary hover:underline pl-2 uppercase tracking-widest">
                <Plus size={14} /> Añadir Fila
            </button>
        </div>
    );
}

export default ForceAccountForm;
