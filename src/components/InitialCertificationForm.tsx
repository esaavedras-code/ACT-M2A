"use client";

import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { Save, FileCheck, Plus, Trash2, Loader2, AlertCircle, Info, CheckCircle2, Calendar, ShieldCheck } from "lucide-react";
import FloatingFormActions from "./FloatingFormActions";
import type { FormRef } from "./ProjectForm";
import { formatDate } from "@/lib/utils";

const InitialCertificationForm = forwardRef<FormRef, { projectId?: string, numAct?: string, onDirty?: () => void, onSaved?: () => void }>(function InitialCertificationForm({ projectId, numAct, onDirty, onSaved }, ref) {
    const [certs, setCerts] = useState<any[]>([]);
    const [paymentCerts, setPaymentCerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (projectId) {
            fetchInitialCerts();
            fetchPaymentCerts();
        }
    }, [projectId]);

    const fetchInitialCerts = async () => {
        const { data, error } = await supabase
            .from("initial_certifications")
            .select("*")
            .eq("project_id", projectId)
            .order("created_at", { ascending: true });

        if (error) {
            console.error("Error fetching initial certs:", error.message);
            return;
        }
        if (data && data.length > 0) {
            setCerts(data);
        } else {
            addCert(true);
        }
        setHasLoaded(true);
    };

    const fetchPaymentCerts = async () => {
        const { data } = await supabase
            .from("payment_certifications")
            .select("id, cert_num, cert_date, resident_engineer_date")
            .eq("project_id", projectId)
            .order("cert_num", { ascending: true });
        
        if (data) setPaymentCerts(data);
    };

    const addCert = (silent = false) => {
        setCerts(prev => [...prev, {
            project_id: projectId,
            material_description: "",
            manufacturer_name: "",
            notarized: false,
            cert_date: new Date().toISOString().split('T')[0],
            payment_cert_id: null,
            valid_days: 60
        }]);
        if (!silent && onDirty) onDirty();
    };

    const updateCert = (idx: number, field: string, value: any) => {
        const newList = [...certs];
        newList[idx][field] = value;
        setCerts(newList);
        if (onDirty) onDirty();
    };

    const removeCert = async (idx: number) => {
        const cert = certs[idx];
        if (cert.id) {
            const proceed = window.confirm("¿Estás seguro de que deseas eliminar esta certificación inicial?");
            if (!proceed) return;
            setLoading(true);
            await supabase.from("initial_certifications").delete().eq("id", cert.id);
            setLoading(false);
        }
        const newList = certs.filter((_, i) => i !== idx);
        setCerts(newList);
        if (newList.length === 0) addCert();
        if (onDirty) onDirty();
    };

    const saveData = async (silent = false) => {
        if (!projectId || !hasLoaded) return;
        setLoading(true);
        try {
            const { data: existing } = await supabase.from("initial_certifications").select("id").eq("project_id", projectId);
            const existingIds = existing?.map(r => r.id) || [];
            
            const updates = [], inserts = [];
            for (const c of certs) {
                const { id, created_at, ...rest } = c;
                const payload = { ...rest, project_id: projectId };
                if (id) updates.push({ id, ...payload });
                else if (c.material_description.trim()) inserts.push(payload);
            }

            const currentUpsertIds = updates.map(u => u.id);
            const idsToDelete = existingIds.filter(id => !currentUpsertIds.includes(id));
            
            if (idsToDelete.length > 0) await supabase.from("initial_certifications").delete().in("id", idsToDelete);
            if (updates.length > 0) await supabase.from("initial_certifications").upsert(updates);
            if (inserts.length > 0) await supabase.from("initial_certifications").insert(inserts);

            if (!silent) alert("Certificaciones iniciales guardadas");
            fetchInitialCerts();
            if (onSaved) onSaved();
        } catch (err: any) { 
            console.error(err); 
            if (!silent) alert("Error al guardar: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    useImperativeHandle(ref, () => ({ save: () => saveData(true) }));

    const calculateExpiration = (paymentCertId: string) => {
        const cert = paymentCerts.find(c => c.id === paymentCertId);
        if (!cert || !cert.resident_engineer_date) return null;
        
        const baseDate = new Date(cert.resident_engineer_date);
        baseDate.setDate(baseDate.getDate() + 60);
        return baseDate;
    };

    if (!mounted) return null;

    return (
        <div className="w-full px-4 flex flex-col space-y-6">
            <div className="sticky top-0 z-40 bg-[#F8FAFC]/95 dark:bg-[#020617]/95 backdrop-blur-md pt-6 pb-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <ShieldCheck className="text-primary" /> Initial Contract Certification (ICC)
                    </h2>
                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest mt-1">Válido por 60 días desde la firma del Ing. Residente en la Certificación de Pago</p>
                </div>
            </div>

            <FloatingFormActions actions={[
                { label: "Añadir ICC", description: "Nuevo Initial Certification", icon: <Plus />, onClick: addCert, variant: 'secondary' },
                { label: loading ? "Guardando..." : "Guardar cambios", description: "Grabar al servidor", icon: <Save />, onClick: () => saveData(false), variant: 'primary', disabled: loading }
            ]} />

            <div className="flex flex-col space-y-4">
                {certs.map((c, idx) => {
                    const expiration = c.payment_cert_id ? calculateExpiration(c.payment_cert_id) : null;
                    const isExpired = expiration && expiration < new Date();
                    const linkedCert = paymentCerts.find(p => p.id === c.payment_cert_id);

                    return (
                        <div key={idx} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden hover:shadow-md transition-all">
                            <div className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* Col 1: Material & Vendor */}
                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descripción del Material</label>
                                            <input 
                                                className="input-field py-2.5 px-4 font-bold text-sm bg-slate-50/50"
                                                placeholder='Ej: Tubería de Hormigón 24" ...'
                                                value={c.material_description || ""}
                                                onChange={e => updateCert(idx, 'material_description', e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fabricante / Suplidor</label>
                                            <input 
                                                className="input-field py-2.5 px-4 font-bold text-sm bg-slate-50/50"
                                                placeholder="Nombre de la empresa..."
                                                value={c.manufacturer_name || ""}
                                                onChange={e => updateCert(idx, 'manufacturer_name', e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {/* Col 2: Dates & Notary */}
                                    <div className="space-y-4">
                                        <div className="flex gap-4">
                                            <div className="flex-1 space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha Certificado</label>
                                                <input 
                                                    type="date"
                                                    className="input-field py-2.5 px-4 font-bold text-sm bg-slate-50/50"
                                                    value={c.cert_date || ""}
                                                    onChange={e => updateCert(idx, 'cert_date', e.target.value)}
                                                />
                                            </div>
                                            <div className="flex items-end pb-1">
                                                <label className="flex items-center gap-3 p-3 rounded-2xl border border-slate-100 bg-slate-50/30 cursor-pointer hover:bg-white transition-all">
                                                    <input 
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                                                        checked={!!c.notarized}
                                                        onChange={e => updateCert(idx, 'notarized', e.target.checked)}
                                                    />
                                                    <span className="text-[10px] font-black text-slate-600 uppercase">Notarizado</span>
                                                </label>
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Incluido en Cert. de Pago</label>
                                            <select 
                                                className="input-field py-2.5 px-4 font-bold text-sm bg-blue-50/50 border-blue-100 text-blue-900"
                                                value={c.payment_cert_id || ""}
                                                onChange={e => updateCert(idx, 'payment_cert_id', e.target.value || null)}
                                            >
                                                <option value="">Seleccionar Certificación...</option>
                                                {paymentCerts.map(pc => (
                                                    <option key={pc.id} value={pc.id}>
                                                        Cert #{pc.cert_num} ({pc.resident_engineer_date ? formatDate(pc.resident_engineer_date) : 'Sin firmar'})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Col 3: Status & Expiration */}
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-slate-100 dark:border-slate-800 flex flex-col justify-center gap-4">
                                        {!c.payment_cert_id ? (
                                            <div className="flex flex-col items-center text-center space-y-2 py-4">
                                                <Info size={24} className="text-slate-300" />
                                                <p className="text-[10px] font-black text-slate-400 uppercase">Vincule a una certificación de pago para calcular expiración</p>
                                            </div>
                                        ) : !linkedCert?.resident_engineer_date ? (
                                            <div className="flex flex-col items-center text-center space-y-2 py-4">
                                                <Calendar size={24} className="text-amber-400" />
                                                <p className="text-[10px] font-black text-amber-600 uppercase">Esperando firma del Ing. Residente en Cert #{linkedCert?.cert_num}</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase mb-1">Fecha de Expiración</span>
                                                    <span className={`text-xl font-black ${isExpired ? 'text-red-500' : 'text-emerald-500'}`}>
                                                        {formatDate(expiration!.toISOString())}
                                                    </span>
                                                </div>
                                                <div className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl border font-black text-[10px] uppercase tracking-widest ${isExpired ? 'bg-red-50 border-red-100 text-red-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
                                                    {isExpired ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                                                    {isExpired ? 'Certificado Expirado' : 'Certificado Válido'}
                                                </div>
                                            </div>
                                        )}
                                        
                                        <button 
                                            onClick={() => removeCert(idx)}
                                            className="mt-2 text-[10px] font-black text-red-400 hover:text-red-600 uppercase tracking-tighter flex items-center justify-center gap-1 transition-colors"
                                        >
                                            <Trash2 size={12} /> Eliminar Entrada
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            
            <div className="p-6 bg-blue-50/50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-800/50 flex gap-4">
                <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-sm text-blue-500 shrink-0">
                    <Info size={24} />
                </div>
                <div className="space-y-1">
                    <h4 className="text-sm font-black text-blue-900 dark:text-blue-300 uppercase tracking-widest">Información sobre el ICC</h4>
                    <p className="text-xs text-blue-700/70 dark:text-blue-400/70 font-medium leading-relaxed">
                        El Initial Contract Certification (ICC) tiene una validez de 60 días naturales a partir de la firma del Ingeniero Residente/Inspector en la Certificación de Pago donde se incluya el material. Transcurrido este tiempo, se debe contar con el Certificado de Manufactura final.
                    </p>
                </div>
            </div>
        </div>
    );
});

export default InitialCertificationForm;
