"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { Save, Users, Plus, Trash2 } from "lucide-react";
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

const PersonnelForm = forwardRef<FormRef, { projectId?: string, onDirty?: () => void, onSaved?: () => void }>(function PersonnelForm({ projectId, onDirty, onSaved }, ref) {
    const [personnel, setPersonnel] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
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
        await supabase.from("act_personnel").delete().eq("project_id", projectId);
        const personnelToInsert = personnel.map(p => {
            const { id, created_at, ...rest } = p;
            return { ...rest, project_id: projectId };
        });
        const { error } = await supabase.from("act_personnel").insert(personnelToInsert);
        if (error && !silent) alert("Error: " + error.message);
        else if (!error) {
            if (!silent) alert("Firmas actualizadas");
            if (onSaved) onSaved();
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

    return (
        <div className="w-full px-4 space-y-6">
            <div className="sticky top-[133px] z-20 bg-slate-50/95 backdrop-blur-sm dark:bg-[#020617]/95 py-4 -mt-4 mb-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Users className="text-primary" />
                    3. Firmas ACT
                </h2>
                <div className="flex gap-2">
                    <button onClick={addItem} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
                        <Plus size={16} /> Añadir Persona
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Save size={18} />
                        {loading ? "Sincronizando..." : "Guardar Firmas"}
                    </button>
                </div>
            </div>

            <div className="card overflow-x-auto p-0 border-none shadow-sm">
                <table className="w-full text-left border-collapse min-w-[1250px]">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 uppercase text-[10px] font-extrabold border-b border-slate-100 dark:border-slate-800">
                        <tr>
                            <th className="px-4 py-4 min-w-[260px] w-1/4">Rol / Puesto</th>
                            <th className="px-4 py-4 min-w-[220px] w-1/4">Nombre Completo</th>
                            <th className="px-4 py-4 min-w-[180px] text-center">Oficina</th>
                            <th className="px-4 py-4 min-w-[180px] text-center">Celular</th>
                            <th className="px-4 py-4 min-w-[280px]">Email</th>
                            <th className="px-4 py-4 min-w-[60px] text-center"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                        {personnel.map((p, idx) => {
                            const isNoContact = ROLES_WITHOUT_CONTACT_INFO.includes(p.role || STAFF_ROLES[0]);
                            return (
                                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                                    <td className="px-4 py-3">
                                        <select
                                            className="input-field text-xs font-bold h-9 bg-white"
                                            style={{ backgroundColor: '#66FF99' }}
                                            value={p.role || STAFF_ROLES[0]}
                                            onChange={(e) => updateItem(idx, 'role', e.target.value)}
                                        >
                                            {STAFF_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                                        </select>
                                    </td>
                                    <td className="px-4 py-3">
                                        <input
                                            type="text"
                                            className="input-field text-xs h-9"
                                            style={{ backgroundColor: '#66FF99' }}
                                            value={p.name || ""}
                                            placeholder="Nombre del funcionario"
                                            onChange={(e) => updateItem(idx, 'name', e.target.value)}
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <input
                                            type="tel"
                                            className={`input-field text-xs h-9 text-center ${isNoContact ? 'bg-slate-50/50 text-slate-300 cursor-not-allowed border-dashed' : 'bg-white'}`}
                                            style={!isNoContact ? { backgroundColor: '#66FF99' } : {}}
                                            placeholder={isNoContact ? "N/A" : "(000) 000-0000"}
                                            value={p.phone_office || ""}
                                            disabled={isNoContact}
                                            onChange={(e) => updateItem(idx, 'phone_office', formatPhoneNumber(e.target.value))}
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <input
                                            type="tel"
                                            className={`input-field text-xs h-9 text-center ${isNoContact ? 'bg-slate-50/50 text-slate-300 cursor-not-allowed border-dashed' : 'bg-white'}`}
                                            style={!isNoContact ? { backgroundColor: '#66FF99' } : {}}
                                            placeholder={isNoContact ? "N/A" : "(000) 000-0000"}
                                            value={p.phone_mobile || ""}
                                            disabled={isNoContact}
                                            onChange={(e) => updateItem(idx, 'phone_mobile', formatPhoneNumber(e.target.value))}
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <input
                                            type="email"
                                            className={`input-field text-xs h-9 ${isNoContact ? 'bg-slate-50/50 text-slate-300 cursor-not-allowed border-dashed' : 'bg-white'}`}
                                            style={!isNoContact ? { backgroundColor: '#66FF99' } : {}}
                                            placeholder={isNoContact ? "N/A" : "correo@ejemplo.com"}
                                            value={p.email || ""}
                                            disabled={isNoContact}
                                            onChange={(e) => updateItem(idx, 'email', e.target.value)}
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-center">
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
