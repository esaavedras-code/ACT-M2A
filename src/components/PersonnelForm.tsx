"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { Save, Users, Plus, Trash2 } from "lucide-react";
import FloatingFormActions from "./FloatingFormActions";
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
        const { data } = await supabase.from("act_personnel").select("*").eq("project_id", projectId);
        if (data && data.length > 0) setPersonnel(data);
        else setPersonnel([{ role: STAFF_ROLES[0], name: "", phone_office: "", phone_mobile: "", email: "" }]);
    };

    const addItem = () => {
        setPersonnel([...personnel, { role: STAFF_ROLES[0], name: "", phone_office: "", phone_mobile: "", email: "" }]);
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

    const saveData = async (silent = false) => {
        if (!projectId) return;

        try {
            const { data: existingRecords, error: fetchError } = await supabase.from("act_personnel").select("id").eq("project_id", projectId);
            if (fetchError) throw fetchError;
            const existingIds = existingRecords?.map(r => r.id) || [];

            const updates = [];
            const inserts = [];

            // Ignore rows where no name has been typed to avoid creating junk rows
            const validPersonnel = personnel.filter(p => p.name?.trim() !== "");

            for (const p of validPersonnel) {
                const { id, created_at, ...rest } = p;
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
                            <th className="px-4 py-3 min-w-[300px]">Rol / Puesto</th>
                            <th className="px-4 py-3 min-w-[350px]">Nombre Completo</th>
                            <th className="px-4 py-3 min-w-[220px] text-center">Oficina</th>
                            <th className="px-4 py-3 min-w-[220px] text-center">Celular</th>
                            <th className="px-4 py-3 min-w-[320px]">Email</th>
                            <th className="px-4 py-3 min-w-[90px] text-center"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                        {personnel.map((p, idx) => {
                            const isNoContact = ROLES_WITHOUT_CONTACT_INFO.includes(p.role || STAFF_ROLES[0]);
                            return (
                                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                                    <td className="px-2 py-1.5">
                                        <select
                                            className="input-field text-xs font-bold min-h-[38px] !py-1.5"
                                            style={{ backgroundColor: '#66FF99' }}
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
                        <tr>
                            <td colSpan={6} className="px-4 py-3 border-t border-slate-100 dark:border-slate-800">
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
