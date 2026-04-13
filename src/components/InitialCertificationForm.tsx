"use client";

import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { Save, Plus, Trash2, AlertCircle, Info, CheckCircle2, Calendar, ShieldCheck, X, FileCheck } from "lucide-react";
import FloatingFormActions from "./FloatingFormActions";
import type { FormRef } from "./ProjectForm";
import { formatDate } from "@/lib/utils";

const InitialCertificationForm = forwardRef<FormRef, { projectId?: string, numAct?: string, onDirty?: () => void, onSaved?: () => void }>(function InitialCertificationForm({ projectId, numAct, onDirty, onSaved }, ref) {
    const [certs, setCerts] = useState<any[]>([]);
    const [paymentCerts, setPaymentCerts] = useState<any[]>([]);
    const [contractItems, setContractItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (projectId) {
            fetchInitialCerts();
            fetchPaymentCerts();
            fetchContractItems();
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

    const fetchContractItems = async () => {
        const { data } = await supabase
            .from("contract_items")
            .select("id, item_num, description, unit")
            .eq("project_id", projectId)
            .order("item_num", { ascending: true });
        if (data) setContractItems(data);
    };

    const addCert = (silent = false) => {
        setCerts(prev => [...prev, {
            project_id: projectId,
            item_id: null,
            material_description: "",
            manufacturer_name: "",
            notarized: false,
            cert_date: new Date().toISOString().split('T')[0],
            payment_cert_id: null,
            valid_days: 60,
            quantity: 0,
            multiple_items: false
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
                else if (c.material_description?.trim() || c.item_id) inserts.push(payload);
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
        
        const baseDate = new Date(`${cert.resident_engineer_date}T00:00:00`);
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
                <div className="flex gap-2">
                    {certs.some(c => {
                        const exp = c.payment_cert_id ? calculateExpiration(c.payment_cert_id) : null;
                        if (!exp) return false;
                        const diff = (exp.getTime() - new Date().getTime()) / (1000 * 3600 * 24);
                        return diff > 0 && diff <= 10;
                    }) && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full border border-amber-200 dark:border-amber-800 text-xs font-black animate-pulse">
                            <AlertCircle size={14} /> CERTIFICADOS PRÓXIMOS A VENCER (10 DÍAS)
                        </div>
                    )}
                </div>
            </div>

            <FloatingFormActions actions={[
                { label: "Añadir ICC", description: "Nuevo Initial Certification", icon: <Plus />, onClick: addCert, variant: 'secondary' },
                { label: loading ? "Guardando..." : "Guardar cambios", description: "Grabar al servidor", icon: <Save />, onClick: () => saveData(false), variant: 'primary', disabled: loading }
            ]} />

            <div className="flex flex-col space-y-3">
                {certs.map((c, idx) => {
                    const expiration = c.payment_cert_id ? calculateExpiration(c.payment_cert_id) : null;
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const isExpired = expiration && expiration < today;
                    const daysLeft = expiration ? Math.ceil((expiration.getTime() - today.getTime()) / (1000 * 3600 * 24)) : null;
                    const isNearExpiration = daysLeft !== null && daysLeft > 0 && daysLeft <= 10;
                    
                    const selectedItem = contractItems.find(it => it.id === c.item_id);

                    return (
                        <div key={idx} className="flex flex-col bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all p-2 pr-6">
                            <div className="flex items-center gap-4">
                                {/* Item Selector / Badge */}
                                <div className="flex flex-col items-start gap-1 ml-2">
                                    <div className="relative group">
                                        <select 
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                            value={c.item_id || ""}
                                            onChange={e => updateCert(idx, 'item_id', e.target.value)}
                                        >
                                            <option value="">Seleccionar Partida...</option>
                                            {contractItems.map(it => (
                                                <option key={it.id} value={it.id}>Pt. {it.item_num}: {it.description}</option>
                                            ))}
                                        </select>
                                        <div className="bg-[#A7FFC3] dark:bg-[#1E5128] text-[#1D3A20] dark:text-[#A7FFC3] px-6 py-3 rounded-full flex items-center gap-3 font-black text-sm min-w-[280px] border border-[#7DFFB3]">
                                            <span className="truncate">
                                                {selectedItem ? `Pt. ${selectedItem.item_num}: ${selectedItem.description}` : "Seleccionar Partida"}
                                            </span>
                                            {c.item_id && <X size={14} className="ml-auto cursor-pointer hover:scale-110" onClick={() => updateCert(idx, 'item_id', null)} />}
                                        </div>
                                    </div>
                                    
                                    {/* Multiple Items Checkbox */}
                                    <label className="flex items-center gap-2 ml-4 cursor-pointer group">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 rounded border-slate-300 text-[#1E5128] focus:ring-[#1E5128]/20"
                                            checked={!!c.multiple_items}
                                            onChange={e => updateCert(idx, 'multiple_items', e.target.checked)}
                                        />
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter group-hover:text-slate-600 transition-colors">Multiple Items</span>
                                    </label>
                                </div>

                                {/* Unit Badge */}
                                <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-xl text-[10px] font-black text-slate-500 min-w-[50px] text-center uppercase">
                                    {selectedItem?.unit || "SQM"}
                                </div>

                                {/* Description Input */}
                                <div className="flex-1">
                                    <input 
                                        className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl py-3 px-6 text-sm font-bold placeholder:text-slate-300"
                                        placeholder="Descripción o comentario..."
                                        value={c.material_description || ""}
                                        onChange={e => updateCert(idx, 'material_description', e.target.value)}
                                    />
                                </div>

                                {/* Quantity Input */}
                                <div className="w-24">
                                    <input 
                                        type="number"
                                        step="0.01"
                                        className="w-full bg-[#A7FFC3]/20 dark:bg-[#1E5128]/20 border border-[#A7FFC3]/50 rounded-2xl py-3 px-4 text-center text-sm font-black text-emerald-700 dark:text-emerald-400"
                                        value={c.quantity || 0}
                                        onChange={e => updateCert(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                    />
                                </div>

                                {/* Date Badge */}
                                <div className={`relative group ${isExpired ? 'bg-red-100 text-red-600' : isNearExpiration ? 'bg-amber-100 text-amber-600' : 'bg-[#A7FFC3] text-[#1D3A20]'} px-6 py-3 rounded-full flex items-center gap-2 font-black text-sm`}>
                                    <input 
                                        type="date"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        value={c.cert_date || ""}
                                        onChange={e => updateCert(idx, 'cert_date', e.target.value)}
                                    />
                                    <span>{c.cert_date ? formatDate(c.cert_date) : "Fecha"}</span>
                                    <span className="text-[10px] bg-white/50 px-1.5 rounded-md">HOY</span>
                                </div>

                                {/* Payment Cert Link */}
                                <div className="relative group">
                                    <select 
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        value={c.payment_cert_id || ""}
                                        onChange={e => updateCert(idx, 'payment_cert_id', e.target.value || null)}
                                    >
                                        <option value="">Vincular Pago...</option>
                                        {paymentCerts.map(pc => (
                                            <option key={pc.id} value={pc.id}>CP #{pc.cert_num}</option>
                                        ))}
                                    </select>
                                    <div className={`p-3 rounded-2xl border transition-all ${c.payment_cert_id ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-slate-50 border-slate-100 text-slate-300'}`}>
                                        <FileCheck size={18} />
                                    </div>
                                </div>

                                {/* Delete Button */}
                                <button 
                                    onClick={() => removeCert(idx)}
                                    className="p-3 text-red-200 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all border border-transparent hover:border-red-100"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>

                            {/* Status Area (Optional Detail) */}
                            {c.payment_cert_id && (
                                <div className="mt-1 px-8 pb-3 flex items-center justify-between">
                                    <div className="flex gap-4 items-center">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <Calendar size={12} /> Expiración: 
                                            <span className={`font-black ${isExpired ? 'text-red-500' : isNearExpiration ? 'text-amber-500' : 'text-emerald-500'}`}>
                                                {expiration ? formatDate(expiration.toISOString()) : "Pendiente de firma"}
                                            </span>
                                        </div>
                                        {isNearExpiration && (
                                            <div className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter animate-pulse">
                                                Pronto a vencer ({daysLeft} días)
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
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
