"use client";

import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { Save, Plus, Trash2, AlertCircle, Info, CheckCircle2, Calendar, ShieldCheck, X, FileCheck, Paperclip, Loader2 } from "lucide-react";
import FloatingFormActions from "./FloatingFormActions";
import type { FormRef } from "./ProjectForm";
import { formatDate } from "@/lib/utils";

const InitialCertificationForm = forwardRef<FormRef, { projectId?: string, numAct?: string, onDirty?: () => void, onSaved?: () => void }>(function InitialCertificationForm({ projectId, numAct, onDirty, onSaved }, ref) {
    const [certs, setCerts] = useState<any[]>([]);
    const [paymentCerts, setPaymentCerts] = useState<any[]>([]);
    const [contractItems, setContractItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState<number | null>(null);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        setMounted(true);
        if (projectId) {
            fetchInitialCerts();
            fetchPaymentCerts();
            fetchContractItems();
        }
    }, [projectId]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
        const file = e.target.files?.[0];
        if (!file || !projectId) return;

        setUploading(idx);
        try {
            const dateStr = new Date().toISOString().split('T')[0];
            const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
            // Usar exactamente "Initial Certification" como subdirectorio según pidió Enrique
            const storagePath = `${projectId}/Initial Certification/${dateStr}/${Date.now()}_${safeName}`;
            
            const { error: uploadError } = await supabase.storage
                .from("project-documents")
                .upload(storagePath, file);

            if (uploadError) throw uploadError;

            // Registrar en project_documents
            await supabase.from("project_documents").insert([{
                project_id: projectId,
                file_name: file.name,
                doc_type: "application/pdf",
                section: "icc", // Corresponde al ID que pusimos en ProjectFilesExplorer
                storage_path: storagePath
            }]);

            updateCert(idx, 'storage_path', storagePath);
            if (onDirty) onDirty();
        } catch (err: any) {
            alert("Error al subir ICC: " + err.message);
        } finally {
            setUploading(null);
        }
    };

    const fetchInitialCerts = async () => {
        const { data, error } = await supabase
            .from("initial_certifications")
            .select("*, initial_certification_items(*)")
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
            multiple_items: false,
            initial_certification_items: []
        }]);
        if (!silent && onDirty) onDirty();
    };

    const updateCert = (idx: number, field: string, value: any) => {
        const newList = [...certs];
        newList[idx][field] = value;
        setCerts(newList);
        if (onDirty) onDirty();
    };

    const addChildItem = (certIdx: number) => {
        const newList = [...certs];
        const items = newList[certIdx].initial_certification_items || [];
        newList[certIdx].initial_certification_items = [...items, { item_id: null, quantity: 0 }];
        setCerts(newList);
        if (onDirty) onDirty();
    };

    const updateChildItem = (certIdx: number, itemIdx: number, field: string, value: any) => {
        const newList = [...certs];
        newList[certIdx].initial_certification_items[itemIdx][field] = value;
        setCerts(newList);
        if (onDirty) onDirty();
    };

    const removeChildItem = (certIdx: number, itemIdx: number) => {
        const newList = [...certs];
        newList[certIdx].initial_certification_items = newList[certIdx].initial_certification_items.filter((_: any, i: number) => i !== itemIdx);
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
            // Obtener IDs existentes para limpieza
            const { data: existingICCs } = await supabase.from("initial_certifications").select("id").eq("project_id", projectId);
            const existingIds = existingICCs?.map(r => r.id) || [];
            
            // Separar actualizaciones e inserciones
            const currentICCPayloads = certs.map(c => {
                const { id, created_at, initial_certification_items, ...rest } = c;
                return { id, ...rest, project_id: projectId };
            });

            const updates = currentICCPayloads.filter(p => p.id);
            // CORRECCIÓN: Permitir grabar si tiene descripción O si es múltiple
            const inserts = currentICCPayloads.filter(p => !p.id && (p.material_description?.trim() || p.multiple_items));

            // Borrar lo que ya no está
            const idsToKeep = updates.map(u => u.id);
            const idsToDelete = existingIds.filter(id => !idsToKeep.includes(id));
            if (idsToDelete.length > 0) await supabase.from("initial_certifications").delete().in("id", idsToDelete);

            // Guardar certificaciones principales
            if (updates.length > 0) await supabase.from("initial_certifications").upsert(updates);
            
            // Para inserciones, vamos a insertar una por una para capturar sus IDs correctamente y no depender de material_description
            const finalCertsList = [...certs];
            for (let i = 0; i < finalCertsList.length; i++) {
                const c = finalCertsList[i];
                if (!c.id) {
                    const payload = { 
                        ...c, 
                        project_id: projectId,
                        material_description: c.material_description || (c.multiple_items ? "Certificación Múltiple" : "")
                    };
                    delete (payload as any).id;
                    delete (payload as any).initial_certification_items;
                    delete (payload as any).created_at;

                    const { data: insData, error: insErr } = await supabase.from("initial_certifications").insert([payload]).select().single();
                    if (insErr) throw insErr;
                    finalCertsList[i].id = insData.id; // Actualizar con ID real
                }
            }

            // Mapear los hijos para guardar usando los IDs actualizados
            const childItemsToUpsert: any[] = [];
            finalCertsList.forEach((c) => {
                if (c.id && c.multiple_items && c.initial_certification_items) {
                    c.initial_certification_items.forEach((child: any) => {
                        if (child.item_id) {
                            childItemsToUpsert.push({
                                item_id: child.item_id,
                                quantity: child.quantity || 0,
                                icc_id: c.id
                            });
                        }
                    });
                }
            });

            // Sincronizar tabla hija (Borrado y Upsert para los ICCs actuales)
            const allIccIds = finalCertsList.map(i => i.id).filter(Boolean);
            if (allIccIds.length > 0) {
                await supabase.from("initial_certification_items").delete().in("icc_id", allIccIds);
            }
            if (childItemsToUpsert.length > 0) {
                await supabase.from("initial_certification_items").insert(childItemsToUpsert);
            }

            if (!silent) alert("Certificaciones iniciales y partidas múltiples guardadas");
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

    const calculateExpiration = (icc: any) => {
        let certToUse = paymentCerts.find(c => c.id === icc.payment_cert_id);
        
        // Si no hay vinculación manual o queremos la regla de "la más próxima después"
        if (!certToUse && icc.cert_date) {
            const potentialCerts = paymentCerts.filter(p => p.cert_date >= icc.cert_date);
            if (potentialCerts.length > 0) {
                // Tomar la de menor número de certificación (la más próxima después)
                certToUse = potentialCerts.reduce((prev, curr) => prev.cert_num < curr.cert_num ? prev : curr);
            }
        }

        if (!certToUse || !certToUse.resident_engineer_date) return null;
        
        const baseDate = new Date(`${certToUse.resident_engineer_date}T00:00:00`);
        baseDate.setDate(baseDate.getDate() + 60);
        return { expiration: baseDate, linkedCert: certToUse };
    };

if (!mounted) return null;

    return (
        <div className="w-full px-4 flex flex-col space-y-6">
            <div className="sticky top-0 z-40 bg-[#F8FAFC]/95 dark:bg-[#020617]/95 backdrop-blur-md pt-6 pb-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <ShieldCheck className="text-primary" /> 14. Initial Certification
                </h2>
                <div className="flex-1 max-w-md mx-6 hidden md:block">
                    <div className="relative group">
                        <input 
                            type="text"
                            placeholder="Buscar por desc., ítem o cert. de pago..."
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex gap-2">
                    {certs.some(c => {
                        const res = calculateExpiration(c);
                        if (!res) return false;
                        const diff = (res.expiration.getTime() - new Date().getTime()) / (1000 * 3600 * 24);
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

            <div className="flex flex-col space-y-4">
                <div className="md:hidden px-4 mb-2">
                    <input 
                        type="text"
                        placeholder="Buscar por desc., ítem o cert. de pago..."
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                {certs.map((c, originalIdx) => ({ c, originalIdx })).filter(({ c }) => {
                    if (!searchTerm) return true;
                    const term = searchTerm.toLowerCase();
                    if (c.material_description?.toLowerCase().includes(term)) return true;
                    if (c.manufacturer_name?.toLowerCase().includes(term)) return true;
                    
                    const pCert = paymentCerts.find(pc => pc.id === c.payment_cert_id);
                    if (pCert && pCert.cert_num?.toString().includes(term)) return true;
                    
                    if (c.multiple_items && c.initial_certification_items) {
                        return c.initial_certification_items.some((child: any) => {
                            const it = contractItems.find(i => i.id === child.item_id);
                            return it && (it.item_num?.toLowerCase().includes(term) || it.description?.toLowerCase().includes(term));
                        });
                    } else if (c.item_id) {
                        const it = contractItems.find(i => i.id === c.item_id);
                        return it && (it.item_num?.toLowerCase().includes(term) || it.description?.toLowerCase().includes(term));
                    }
                    return false;
                }).map(({ c, originalIdx: idx }) => {
                    const res = calculateExpiration(c);
                    const expiration = res?.expiration || null;
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const isExpired = expiration && expiration < today;
                    const daysLeft = expiration ? Math.ceil((expiration.getTime() - today.getTime()) / (1000 * 3600 * 24)) : null;
                    const isNearExpiration = daysLeft !== null && daysLeft > 0 && daysLeft <= 10;
                    
                    const selectedItem = contractItems.find(it => it.id === c.item_id);

                    return (
                        <div key={idx} className={`p-5 rounded-[2rem] border-2 shadow-sm transition-all ${isExpired ? 'bg-red-50/50 border-red-200/50 dark:bg-red-900/10 dark:border-red-900/30 shadow-red-500/5' : isNearExpiration ? 'bg-amber-50/50 border-amber-200/50 dark:bg-amber-900/10 dark:border-amber-900/30' : 'bg-white dark:bg-slate-900/50 border-slate-100 dark:border-slate-800'}`}>
                            <div className="flex items-center gap-4">
                                {/* Item Selector / Badge (Single or Status) */}
                                <div className="flex flex-col items-start gap-1 ml-2">
                                    <div className="relative group">
                                        {!c.multiple_items ? (
                                            <>
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
                                            </>
                                        ) : (
                                            <div className="bg-slate-800 text-white px-6 py-3 rounded-full flex items-center gap-3 font-black text-sm min-w-[280px] border border-slate-700">
                                                <FileCheck size={16} className="text-emerald-400" />
                                                <span className="truncate uppercase tracking-tighter italic">
                                                    {(c.initial_certification_items?.length || 0)} ÍTEMS SELECCIONADOS
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Multiple Items Checkbox */}
                                    <label className="flex items-center gap-2 ml-4 cursor-pointer group">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 rounded border-slate-300 text-[#1E5128] focus:ring-[#1E5128]/20"
                                            checked={!!c.multiple_items}
                                            onChange={e => {
                                                updateCert(idx, 'multiple_items', e.target.checked);
                                                if (e.target.checked && (!c.initial_certification_items || c.initial_certification_items.length === 0)) {
                                                    // Si activa múltiples y no hay ninguno, añadir el actual si existe
                                                    const currentItems = [];
                                                    if (c.item_id) currentItems.push({ item_id: c.item_id, quantity: c.quantity });
                                                    else currentItems.push({ item_id: null, quantity: 0 });
                                                    updateCert(idx, 'initial_certification_items', currentItems);
                                                }
                                            }}
                                        />
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter group-hover:text-slate-600 transition-colors underline decoration-slate-200">Multiple Items</span>
                                    </label>
                                </div>

                                {/* Unit Badge */}
                                <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-xl text-[10px] font-black text-slate-500 min-w-[50px] text-center uppercase">
                                    {!c.multiple_items ? (selectedItem?.unit || "SQM") : "MULT"}
                                </div>

                                {/* Notarized Checkbox (NUEVO) */}
                                <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800 transition-all hover:bg-white dark:hover:bg-slate-700">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div className="relative flex items-center justify-center">
                                            <input 
                                                type="checkbox" 
                                                className="peer appearance-none w-5 h-5 rounded-lg border-2 border-slate-300 checked:border-emerald-500 checked:bg-emerald-500 transition-all cursor-pointer"
                                                checked={!!c.notarized}
                                                onChange={e => updateCert(idx, 'notarized', e.target.checked)}
                                            />
                                            <ShieldCheck size={12} className="absolute text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                                        </div>
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-emerald-600 transition-colors">Notarized</span>
                                    </label>
                                </div>

                                {/* Quantity Input */}
                                <div className="w-24">
                                    <input 
                                        type="number"
                                        step="0.01"
                                        className={`w-full bg-slate-50 dark:bg-slate-800/50 border rounded-2xl py-3 px-4 text-center text-sm font-black ${c.quantity ? 'text-emerald-700 dark:text-emerald-400 border-emerald-500/50' : 'text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                                        value={c.quantity || 0}
                                        onChange={e => updateCert(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                    />
                                </div>

                                {/* Date Badge - Arreglado para máxima interactividad */}
                                <div 
                                    className={`relative group ${isExpired ? 'bg-red-100 text-red-600' : isNearExpiration ? 'bg-amber-100 text-amber-600' : 'bg-[#A7FFC3] text-[#1D3A20]'} px-6 py-3 rounded-full flex items-center gap-2 font-black text-sm hover:scale-[1.02] active:scale-95 transition-all cursor-pointer shadow-sm hover:shadow-md border border-black/5 min-w-[160px] justify-center`}
                                    onClick={(e) => {
                                        const input = e.currentTarget.querySelector('input');
                                        if (input && input.showPicker) {
                                            input.showPicker();
                                        }
                                    }}
                                >
                                    <input 
                                        type="date"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        value={c.cert_date || ""}
                                        onChange={e => {
                                            updateCert(idx, 'cert_date', e.target.value);
                                        }}
                                    />
                                    <Calendar size={14} className="opacity-60 shrink-0" />
                                    <span className="whitespace-nowrap">{c.cert_date ? formatDate(c.cert_date) : "Seleccionar Fecha"}</span>
                                    {c.cert_date === new Date().toISOString().split('T')[0] && (
                                        <span className="text-[10px] bg-white/50 px-1.5 rounded-md font-black uppercase tracking-tighter shrink-0">HOY</span>
                                    )}
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

                                {/* File Upload Clip (NUEVO) */}
                                <div className="relative group">
                                    <label className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-center ${c.storage_path ? 'bg-blue-50 border-blue-100 text-blue-500' : 'bg-slate-50 border-slate-100 text-slate-300 hover:text-slate-500 hover:border-slate-300'}`}>
                                        {uploading === idx ? (
                                            <Loader2 size={18} className="animate-spin" />
                                        ) : (
                                            <Paperclip size={18} />
                                        )}
                                        <input 
                                            type="file" 
                                            className="hidden" 
                                            onChange={e => handleFileUpload(e, idx)}
                                            accept=".pdf,image/*"
                                        />
                                    </label>
                                    {c.storage_path && (
                                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white"></div>
                                    )}
                                </div>

                                {/* Delete Button */}
                                <button 
                                    onClick={() => removeCert(idx)}
                                    className="p-3 text-red-100 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all border border-transparent hover:border-red-100"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>

                            {/* Sub-formulario para múltiples ítems */}
                            {c.multiple_items && (
                                <div className="mt-4 mb-2 mx-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 flex flex-col gap-3">
                                    <div className="flex items-center justify-between mb-1 px-2">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Partidas Incluidas en este ICC</span>
                                        <button 
                                            onClick={() => addChildItem(idx)}
                                            className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full text-[9px] font-black text-emerald-600 hover:bg-emerald-50 transition-colors shadow-sm"
                                        >
                                            <Plus size={10} /> Añadir Partida
                                        </button>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 gap-2">
                                        {(c.initial_certification_items || []).map((child: any, cIdx: number) => {
                                            const childItem = contractItems.find(it => it.id === child.item_id);
                                            return (
                                                <div key={cIdx} className="flex items-center gap-3 bg-white dark:bg-slate-900 p-2 pl-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                                                    <div className="relative flex-1 group">
                                                        <select 
                                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                            value={child.item_id || ""}
                                                            onChange={e => updateChildItem(idx, cIdx, 'item_id', e.target.value)}
                                                        >
                                                            <option value="">Seleccionar...</option>
                                                            {contractItems.map(it => (
                                                                <option key={it.id} value={it.id}>Pt. {it.item_num}: {it.description}</option>
                                                            ))}
                                                        </select>
                                                        <div className="text-xs font-bold text-slate-600 truncate">
                                                            {childItem ? `Pt. ${childItem.item_num}: ${childItem.description}` : "Escoger Partida..."}
                                                        </div>
                                                    </div>
                                                    <div className="text-[9px] font-black text-slate-400 bg-slate-50 px-2 py-1 rounded-md shrink-0">
                                                        {childItem?.unit || "UNIT"}
                                                    </div>
                                                    <div className="w-20 shrink-0">
                                                        <input 
                                                            type="number"
                                                            step="0.01"
                                                            placeholder="Cant."
                                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1 px-2 text-center text-[11px] font-bold text-emerald-700"
                                                            value={child.quantity || 0}
                                                            onChange={e => updateChildItem(idx, cIdx, 'quantity', parseFloat(e.target.value) || 0)}
                                                        />
                                                    </div>
                                                    <button 
                                                        onClick={() => removeChildItem(idx, cIdx)}
                                                        className="p-1 px-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Status Area (Optional Detail) */}
                            {c.payment_cert_id && (
                                <div className="mt-1 px-8 pb-3 flex items-center justify-between">
                                    <div className="flex gap-4 items-center">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <Calendar size={12} /> Expiración: 
                                            <span className={`font-black ${isExpired ? 'text-red-500' : isNearExpiration ? 'text-amber-500' : 'text-emerald-500'}`}>
                                                {expiration ? formatDate(expiration.toISOString()) : "Esperando Pago..."}
                                            </span>
                                            {res?.linkedCert && (
                                                <span className="text-[8px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md ml-2 border border-slate-200 dark:border-slate-700">
                                                    Contando desde CP #{res.linkedCert.cert_num}
                                                </span>
                                            )}
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
