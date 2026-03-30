"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { Save, Users, Plus, Trash2, Download, Upload } from "lucide-react";
import FloatingFormActions from "./FloatingFormActions";
import { exportSectionToJSON, importSectionFromJSON } from "@/lib/sectionIO";
import { formatPhoneNumber } from "@/lib/utils";
import type { FormRef } from "./ProjectForm";

const STAFF_ROLES = [
    "Director Ejecutivo", "Subdirector Ejecutivo", "Dir. Ejec. Infraestructura",
    "Dir. Área Construcción", "Director Finanzas", "Director Regional",
    "Supervisor de Área", "Administrador del Proyecto", "Oficial de Liquidación",
    "Dir. Oficina Control de Proyectos"
];

const ROLES_WITHOUT_CONTACT_INFO = [
    "Director Ejecutivo", "Subdirector Ejecutivo", "Dir. Ejec. Infraestructura",
    "Dir. Área Construcción", "Director Finanzas", "Oficial de Liquidación",
    "Dir. Oficina Control de Proyectos"
];

const PersonnelForm = forwardRef<FormRef, { projectId?: string, numAct?: string, onDirty?: () => void, onSaved?: () => void }>(function PersonnelForm({ projectId, numAct, onDirty, onSaved }, ref) {
    const [personnel, setPersonnel] = useState<any[]>([]);
    const [mounted, setMounted] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (projectId) fetchPersonnel();
    }, [projectId]);

    const fetchPersonnel = async () => {
        const { data } = await supabase.from("act_personnel").select("*").eq("project_id", projectId).order("active_from", { ascending: false });
        if (data && data.length > 0) setPersonnel(data);
        else setPersonnel([{ role: STAFF_ROLES[0], name: "", phone_office: "", phone_mobile: "", email: "", active_from: new Date().toISOString().split('T')[0] }]);
    };

    const addItem = () => {
        setPersonnel([{ role: STAFF_ROLES[0], name: "", phone_office: "", phone_mobile: "", email: "", active_from: new Date().toISOString().split('T')[0] }, ...personnel]);
        if (onDirty) onDirty();
    };

    const updateItem = (index: number, field: string, value: any) => {
        const newList = [...personnel];
        newList[index][field] = value;
        setPersonnel(newList);
        if (onDirty) onDirty();
    };

    const removeItem = (index: number) => {
        setPersonnel(personnel.filter((_, i) => i !== index));
        if (onDirty) onDirty();
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const result = await importSectionFromJSON(file);
        if (result.success && Array.isArray(result.data)) {
            const cleaned = result.data.map(p => {
                const { id, project_id, created_at, ...rest } = p;
                return { 
                    ...rest, 
                    project_id: projectId 
                };
            });
            setPersonnel([...personnel, ...cleaned]);
            alert("Firmas importadas. Guarde para confirmar.");
        } else {
            alert("Error al importar: " + (result.error || "Formato inválido"));
        }
        e.target.value = "";
    };

    const saveData = async (silent = false) => {
        if (!projectId) return;

        try {
            const { data: existingRecords, error: fetchError } = await supabase.from("act_personnel").select("id").eq("project_id", projectId);
            if (fetchError) throw fetchError;
            const existingIds = existingRecords?.map(r => r.id) || [];

            const updates: any[] = [];
            const inserts: any[] = [];

            // Ignore rows where no name has been typed to avoid creating junk rows
            const validPersonnel = personnel.filter(p => p.name?.trim() !== "");

            for (const p of validPersonnel) {
                const { id, created_at, show_successor, new_name, new_start_date, ...rest } = p;
                const payload = { ...rest, project_id: projectId };

                if (id) {
                    updates.push({ id, ...payload });
                } else {
                    inserts.push(payload);
                }
            }

            const currentIds = updates.map(u => u.id);
            const idsToDelete = existingIds.filter(id => !currentIds.includes(id));

            if (idsToDelete.length > 0) {
                const { error: delError } = await supabase.from("act_personnel").delete().in("id", idsToDelete);
                if (delError) throw delError;
            }

            if (updates.length > 0) {
                const { error: updateError } = await supabase.from("act_personnel").upsert(updates, { onConflict: "id" });
                if (updateError) throw updateError;
            }

            if (inserts.length > 0) {
                const { error: insertError } = await supabase.from("act_personnel").insert(inserts);
                if (insertError) throw insertError;
            }

            if (!silent) alert("Firmas actualizadas");
            await fetchPersonnel(); // Refresh state
            if (onSaved) onSaved();

        } catch (error: any) {
            console.error("Save error:", error);
            if (!silent) alert("Error: " + error.message);
        }
    };

    useImperativeHandle(ref, () => ({ save: () => saveData(true) }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!projectId) return;
        setLoading(true);
        await saveData(false);
        setLoading(false);
    };

    if (!mounted) return null;

    return (
        <div suppressHydrationWarning className="w-full px-4 space-y-6">
            <div className="sticky top-16 z-40 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md pt-6 pb-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                <h2 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                    <Users className="text-primary" size={24} />
                    <span>2. Firmas ACT</span>
                </h2>
                <div className="flex gap-2 w-full sm:w-auto">
                    {/* Los botones ahora son flotantes para mayor accesibilidad */}
                </div>
            </div>

            <FloatingFormActions
                actions={[
                    {
                        label: "Exportar JSON",
                        icon: <Download />,
                        onClick: () => exportSectionToJSON("personnel", personnel),
                        description: "Exportar lista de firmas actuales a un archivo JSON",
                        variant: 'info' as const,
                        disabled: loading
                    },
                    {
                        label: "Importar JSON",
                        icon: <Upload />,
                        onClick: () => document.getElementById('import-personnel-json')?.click(),
                        description: "Cargar lista de firmas desde un archivo JSON",
                        variant: 'secondary' as const,
                        disabled: loading
                    },
                    {
                        label: "Añadir Persona",
                        icon: <Plus />,
                        onClick: addItem,
                        description: "Incluir un nuevo funcionario de la ACT al registro de firmas del proyecto",
                        variant: 'secondary' as const
                    },
                    {
                        label: loading ? "Guardando..." : "Guardar cambios",
                        icon: <Save />,
                        onClick: () => saveData(false),
                        description: "Actualizar y sincronizar el registro oficial de firmas autorizadas de la ACT",
                        variant: 'primary' as const,
                        disabled: loading
                    }
                ]}
            />
            <input id="import-personnel-json" type="file" accept=".json" className="hidden" onChange={handleImport} />


            {numAct && (
                <div className="flex items-center gap-2 -mt-4 mb-6">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Proyecto:</span>
                    <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-primary text-[10px] font-bold rounded border border-blue-100 dark:border-blue-800">
                        ACT-{numAct}
                    </span>
                </div>
            )}

            <div className="card overflow-x-auto p-0 border-none shadow-sm custom-scrollbar">
                <table suppressHydrationWarning className="w-full text-left border-collapse min-w-[1500px]">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 uppercase text-[10px] font-extrabold border-b border-slate-100 dark:border-slate-800">
                        <tr>
                            <th className="px-4 py-3 min-w-[200px] text-center">Periodo (Firma)</th>
                            <th className="px-4 py-3 min-w-[250px]">Rol / Puesto</th>
                            <th className="px-4 py-3 min-w-[300px]">Nombre Completo</th>
                            <th className="px-4 py-3 min-w-[150px] text-center">Cambio?</th>
                            <th className="px-4 py-3 min-w-[180px] text-center">Oficina</th>
                            <th className="px-4 py-3 min-w-[180px] text-center">Celular</th>
                            <th className="px-4 py-3 min-w-[250px]">Email</th>
                            <th className="px-4 py-3 min-w-[60px] text-center"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                        {personnel.map((p, idx) => {
                            const isNoContact = ROLES_WITHOUT_CONTACT_INFO.includes(p.role || STAFF_ROLES[0]);
                            return (
                                <tr key={idx} className={`hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors ${p.active_to ? 'opacity-60 bg-slate-100/30' : ''}`}>
                                    <td className="px-2 py-1.5">
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="date"
                                                className="input-field text-[10px] min-h-[30px] !py-0.5 w-full text-center"
                                                value={p.active_from || ""}
                                                onChange={(e) => updateItem(idx, 'active_from', e.target.value)}
                                            />
                                            <span className="text-[10px] font-bold text-slate-400">al</span>
                                            <input
                                                type="date"
                                                className="input-field text-[10px] min-h-[30px] !py-0.5 w-full text-center"
                                                value={p.active_to || ""}
                                                onChange={(e) => updateItem(idx, 'active_to', e.target.value)}
                                                placeholder="Actual..."
                                            />
                                        </div>
                                    </td>
                                    <td className="px-2 py-1.5">
                                        <select
                                            className="input-field text-xs font-bold min-h-[38px] !py-1.5"
                                            style={{ backgroundColor: '#EEF2FF' }}
                                            value={p.role || STAFF_ROLES[0]}
                                            onChange={(e) => updateItem(idx, 'role', e.target.value)}
                                        >
                                            {STAFF_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                                        </select>
                                    </td>
                                    <td className="px-2 py-1.5">
                                        <input
                                            type="text"
                                            className="input-field text-xs min-h-[38px] !py-1.5 font-bold"
                                            style={{ backgroundColor: '#66FF99' }}
                                            value={p.name || ""}
                                            placeholder="Nombre del funcionario"
                                            onChange={(e) => updateItem(idx, 'name', e.target.value)}
                                        />
                                    </td>
                                    <td className="px-2 py-1.5 text-center">
                                        {!p.active_to && (
                                            <div className="flex flex-col items-center gap-1 group">
                                                <label className="relative flex items-center justify-center w-8 h-8 rounded-full border-2 border-slate-200 cursor-pointer hover:border-primary transition-all has-[:checked]:bg-primary has-[:checked]:border-primary">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only"
                                                        checked={!!p.show_successor}
                                                        onChange={(e) => updateItem(idx, 'show_successor', e.target.checked)}
                                                    />
                                                    <Plus size={16} className={`text-slate-400 group-hover:text-primary ${p.show_successor ? 'text-white rotate-45' : ''} transition-all`} />
                                                </label>
                                                <span className="text-[8px] font-bold text-slate-400 uppercase">Cambio</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-2 py-1.5">
                                        {!isNoContact && (
                                            <input
                                                type="tel"
                                                className="input-field text-xs min-h-[38px] !py-1.5 text-center font-bold"
                                                style={{ backgroundColor: '#66FF99' }}
                                                placeholder="(000) 000-0000"
                                                value={p.phone_office || ""}
                                                onChange={(e) => updateItem(idx, 'phone_office', formatPhoneNumber(e.target.value))}
                                            />
                                        )}
                                    </td>
                                    <td className="px-2 py-1.5">
                                        {!isNoContact && (
                                            <input
                                                type="tel"
                                                className="input-field text-xs min-h-[38px] !py-1.5 text-center font-bold"
                                                style={{ backgroundColor: '#66FF99' }}
                                                placeholder="(000) 000-0000"
                                                value={p.phone_mobile || ""}
                                                onChange={(e) => updateItem(idx, 'phone_mobile', formatPhoneNumber(e.target.value))}
                                            />
                                        )}
                                    </td>
                                    <td className="px-2 py-1.5">
                                        {!isNoContact && (
                                            <input
                                                type="email"
                                                className="input-field text-xs min-h-[38px] !py-1.5 font-bold"
                                                style={{ backgroundColor: '#66FF99' }}
                                                placeholder="correo@ejemplo.com"
                                                value={p.email || ""}
                                                onChange={(e) => updateItem(idx, 'email', e.target.value)}
                                            />
                                        )}
                                    </td>
                                    <td className="px-2 py-1.5 text-center">
                                        <button
                                            type="button"
                                            onClick={() => removeItem(idx)}
                                            className="text-slate-300 hover:text-red-500 transition-colors"
                                            title="Eliminar registro"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {personnel.map((p, idx) => {
                            if (!p.show_successor) return null;
                            return (
                                <tr key={`suc-${idx}`} className="bg-emerald-50/20 border-l-4 border-emerald-500">
                                    <td className="px-2 py-3" colSpan={2}>
                                        <div className="flex flex-col items-center">
                                            <span className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Nueva Fecha Inicio</span>
                                            <input
                                                type="date"
                                                className="input-field text-xs min-h-[34px] !py-1 text-center font-black"
                                                style={{ borderColor: '#10B981' }}
                                                value={p.new_start_date || ""}
                                                onChange={(e) => {
                                                    updateItem(idx, 'new_start_date', e.target.value);
                                                    updateItem(idx, 'active_to', e.target.value); // El saliente termina cuando empieza el nuevo
                                                }}
                                            />
                                        </div>
                                    </td>
                                    <td className="px-2 py-3">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Nombre de Sucesor</span>
                                            <input
                                                type="text"
                                                className="input-field text-xs min-h-[34px] !py-1 font-black"
                                                style={{ borderColor: '#10B981' }}
                                                value={p.new_name || ""}
                                                placeholder="Nombre del nuevo funcionario..."
                                                onChange={(e) => updateItem(idx, 'new_name', e.target.value)}
                                                onBlur={(e) => {
                                                    // Auto-crear el nuevo registro al salir si hay nombre
                                                    if (e.target.value.trim() !== "" && p.new_start_date) {
                                                        const newP = { 
                                                            role: p.role, 
                                                            name: e.target.value, 
                                                            active_from: p.new_start_date,
                                                            phone_office: p.phone_office,
                                                            phone_mobile: p.phone_mobile,
                                                            email: p.email
                                                        };
                                                        setPersonnel([newP, ...personnel.map((item, i) => i === idx ? { ...item, show_successor: false } : item)]);
                                                    }
                                                }}
                                            />
                                        </div>
                                    </td>
                                    <td className="px-2 py-3" colSpan={5}>
                                        <div className="text-[10px] text-slate-400 italic mt-4">
                                            Se creará un nuevo registro histórico y el actual se marcará como finalizado.
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        <tr>
                            <td colSpan={8} className="px-4 py-3 border-t border-slate-100 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={addItem}
                                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                                >
                                    <Plus size={14} />
                                    Añadir Persona
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
                {personnel.length === 0 && (
                    <div className="py-12 text-center text-slate-400 italic text-sm font-medium">
                        No hay personal de ACT registrado. <br />
                        Haz clic en "Añadir Persona" para comenzar.
                    </div>
                )}
            </div>
        </div>
    );
});

export default PersonnelForm;
