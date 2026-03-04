"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { Save, Factory, Plus, Trash2 } from "lucide-react";
import type { FormRef } from "./ProjectForm";

const MfgCertForm = forwardRef<FormRef, { projectId?: string, onDirty?: () => void, onSaved?: () => void }>(function MfgCertForm({ projectId, onDirty, onSaved }, ref) {
    const [certs, setCerts] = useState<any[]>([]);
    const [contractItems, setContractItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);

    useEffect(() => {
        if (projectId) {
            fetchItems();
            fetchCerts();
        }
    }, [projectId]);

    const fetchItems = async () => {
        const { data } = await supabase.from("contract_items").select("*").eq("project_id", projectId);
        if (data) setContractItems(data);
    };

    const fetchCerts = async () => {
        const { data, error } = await supabase.from("manufacturing_certificates").select("*").eq("project_id", projectId);
        if (error) {
            console.error("Error fetching mfg certs:", error.message);
            return;
        }
        if (data && data.length > 0) {
            setCerts(data);
        } else {
            addCert();
        }
        setHasLoaded(true);
    };

    const addCert = () => {
        setCerts(prev => [...prev, {
            project_id: projectId,
            item_id: "",
            quantity: 0,
            cert_date: new Date().toISOString().split('T')[0],
        }]);
        if (onDirty) onDirty();
    };

    const updateCert = (idx: number, field: string, value: any) => {
        const newList = [...certs];
        newList[idx][field] = value;
        setCerts(newList);
        if (onDirty) onDirty();
    };

    const removeCert = (idx: number) => {
        setCerts(certs.filter((_, i) => i !== idx));
        if (onDirty) onDirty();
    };

    const saveData = async (silent = false) => {
        if (!projectId || !hasLoaded) return;

        // Filter valid certs (those with an item_id)
        const certsToSave = certs
            .filter(c => c.item_id)
            .map(c => {
                const { id, created_at, ...rest } = c;
                return {
                    ...rest,
                    project_id: projectId,
                    item_id: rest.item_id,
                    cert_date: rest.cert_date || null
                };
            });

        // Confirmation if everything will be deleted
        if (certsToSave.length === 0 && certs.length > 0 && !silent) {
            const proceed = window.confirm("No has seleccionado ninguna partida para los certificados. Si guardas, se borrarán todos los certificados anteriores. ¿Deseas continuar?");
            if (!proceed) return;
        }

        const { error: delError } = await supabase.from("manufacturing_certificates").delete().eq("project_id", projectId);
        if (delError) {
            if (!silent) alert("Error al limpiar datos previos: " + delError.message);
            return;
        }

        if (certsToSave.length > 0) {
            const { error } = await supabase.from("manufacturing_certificates").insert(certsToSave);
            if (error) {
                if (!silent) alert("Error al guardar certificados: " + error.message);
                return;
            }
        }

        if (!silent) alert("Certificados de Manufactura actualizados");
        if (onSaved) onSaved();
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
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Factory className="text-primary" />
                    7. Certificados de Manufactura
                </h2>
                <div className="flex gap-2">
                    <button onClick={addCert} className="bg-slate-100 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 text-slate-700">
                        <Plus size={16} /> Nuevo Certificado
                    </button>
                    <button onClick={handleSubmit} disabled={loading} className="btn-primary flex items-center gap-2">
                        <Save size={18} />
                        {loading ? "Sincronizando..." : "Guardar Certificados"}
                    </button>
                </div>
            </div>

            <div className="card overflow-x-auto p-0 border-none shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 uppercase text-[10px] font-extrabold border-b border-slate-100 dark:border-slate-800">
                        <tr>
                            <th className="px-4 py-4 w-10 text-center">#</th>
                            <th className="px-4 py-4">Partida Vinculada</th>
                            <th className="px-4 py-4 w-40 text-center">Cantidad</th>
                            <th className="px-4 py-4 w-48 text-center">Fecha del Certificado</th>
                            <th className="px-4 py-4 w-16"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                        {certs.map((c, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                                <td className="px-4 py-2 text-center text-xs font-bold text-slate-400 w-10">{idx + 1}</td>
                                <td className="px-4 py-2">
                                    <select
                                        className="input-field text-xs font-bold h-9"
                                        style={{ backgroundColor: '#66FF99' }}
                                        value={c.item_id || ""}
                                        onChange={(e) => {
                                            const selectedId = e.target.value;
                                            const match = contractItems.find(it => it.id === selectedId);
                                            const newList = [...certs];
                                            newList[idx].item_id = selectedId;
                                            if (match) {
                                                newList[idx].item_num = match.item_num;
                                                newList[idx].specification = match.specification;
                                            }
                                            setCerts(newList);
                                            if (onDirty) onDirty();
                                        }}
                                    >
                                        <option value="">Seleccionar Partida...</option>
                                        {contractItems.filter(item => item.requires_mfg_cert).map(item => (
                                            <option key={item.id} value={item.id}>Partida {item.item_num}: {item.description}</option>
                                        ))}
                                    </select>
                                </td>
                                <td className="px-4 py-2">
                                    <input
                                        type="number"
                                        className="input-field text-xs text-center h-9 font-bold"
                                        style={{ backgroundColor: '#66FF99' }}
                                        value={isNaN(c.quantity) ? "" : c.quantity}
                                        onChange={(e) => updateCert(idx, 'quantity', e.target.value === "" ? NaN : parseFloat(e.target.value))}
                                    />
                                </td>
                                <td className="px-4 py-2">
                                    <input
                                        type="date"
                                        className="input-field text-xs font-bold h-9 text-center"
                                        style={{ backgroundColor: '#66FF99' }}
                                        value={c.cert_date || ""}
                                        onChange={(e) => updateCert(idx, 'cert_date', e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Tab' && !e.shiftKey && idx === certs.length - 1) {
                                                addCert();
                                            }
                                        }}
                                    />
                                </td>
                                <td className="px-4 py-2 text-center">
                                    <button
                                        type="button"
                                        onClick={() => removeCert(idx)}
                                        className="text-slate-300 hover:text-red-500 transition-colors"
                                        title="Eliminar certificado"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {certs.length === 0 && (
                    <div className="py-12 text-center text-slate-400 italic text-sm font-medium">
                        No hay certificados de manufactura registrados. <br />
                        Haz clic en "Nuevo Certificado" para comenzar.
                    </div>
                )}
            </div>
        </div>
    );
});

export default MfgCertForm;
