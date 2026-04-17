"use client";

import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { Save, Plus, Trash2, Calculator, Users, Truck, Package, FileText, ChevronRight, ChevronLeft, LayoutDashboard, Download, Upload } from "lucide-react";
import FloatingFormActions from "./FloatingFormActions";
import { exportSectionToJSON, importSectionFromJSON } from "@/lib/sectionIO";
import type { FormRef } from "./ProjectForm";
import { formatCurrency } from "@/lib/utils";

const TodayButton = ({ onSelect }: { onSelect: (date: string) => void }) => (
    <button 
        type="button" 
        onClick={() => onSelect(new Date().toISOString().split('T')[0])}
        className="absolute right-1 top-1/2 -translate-y-1/2 px-1.5 py-0.5 bg-white/80 hover:bg-white text-[9px] font-bold text-primary rounded border border-primary/20 transition-all z-10"
    >
        HOY
    </button>
);

const defaultFaDetails = {
    // Calculables manuales de MO
    mo_operadores: 0, mo_operadores_pct: 0,
    mo_carpinteros: 0, mo_carpinteros_pct: 0,
    mo_adicional: 0, mo_adicional_pct: 0,
    mo_sin_union_pct: 0, mo_gastos_viaje: 0,
    mo_beneficio_ind_pct: 20,
    mo_fondo_estado_pct: 0, mo_seguro_social_pct: 7.65, 
    mo_desempleo_est_pct: 5.4, mo_desempleo_fed_pct: 0.8,
    mo_resp_publica_pct: 0, mo_incapacidad_pct: 0,
    mo_beneficio_ind_final_pct: 10,
    
    // Calculables manuales de Materiales
    mat_beneficio_pct: 15, serv_beneficio_pct: 15,
    diario_mat: {} as Record<string, {m: number, s: number}>, // {"1": { m: 100, s: 50 }}
    
    // Calculables Equipos
    eq_beneficio_pct: 15,

    // Fotos y Otros (Cisterna, Camión, etc)
    fotos_data: [] as any[],
    cisterna_qty: 0, camion_agua_qty: 0, camion_diesel_qty: 0,
    
    // Total final
    fianzas_pct_mil: 0
};

const ForceAccountForm = forwardRef<FormRef, { projectId?: string, numAct?: string, onDirty?: () => void, onSaved?: () => void }>(function ForceAccountForm({ projectId, numAct, onDirty, onSaved }, ref) {
    const [activeSubTab, setActiveSubTab] = useState("list"); // list, edit
    const [forceAccounts, setForceAccounts] = useState<any[]>([]);
    const [currentFA, setCurrentFA] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [editTab, setEditTab] = useState("general"); 

    useEffect(() => {
        if (projectId) fetchForceAccounts();
    }, [projectId]);

    const fetchForceAccounts = async () => {
        setLoading(true);
        const { data } = await supabase.from("force_accounts")
            .select("*")
            .eq("project_id", projectId)
            .order("fecha_inicio", { ascending: true })
            .order("created_at", { ascending: true });
        if (data) setForceAccounts(data);
        setLoading(false);
    };

    const handleCreateNew = async () => {
        setLoading(true);
        // Intentar obtener datos del proyecto para autocompletar
        let projectData: any = {};
        let adminName = "";
        let liquidadorName = "";

        if (projectId) {
            const { data } = await supabase.from("projects").select("name, contractor_name").eq("id", projectId).single();
            if (data) projectData = data;

            // Extraer Administrador del Proyecto de act_personnel
            const { data: adminData } = await supabase.from("act_personnel")
                .select("name")
                .eq("project_id", projectId)
                .eq("role", "Administrador del Proyecto")
                .order("created_at", { ascending: false })
                .limit(1)
                .single();
            if (adminData) adminName = adminData.name;

            // Extraer Oficial de Liquidación de act_personnel
            const { data: liqData } = await supabase.from("act_personnel")
                .select("name")
                .eq("project_id", projectId)
                .eq("role", "Oficial de Liquidación")
                .order("created_at", { ascending: false })
                .limit(1)
                .single();
            if (liqData) liquidadorName = liqData.name;
        }

        setCurrentFA({
            project_id: projectId,
            fa_num: `FA-${forceAccounts.length + 1}`,
            descripcion: projectData.name || "",
            fecha_inicio: new Date().toISOString().split("T")[0],
            fecha_fin: "",
            partida_num: "", ewo_num: "", con_union: false,
            admin: adminName, 
            contratista: projectData.contractor_name || "", 
            liquidador: liquidadorName,
            fa_details: defaultFaDetails,
            labor: [], equipment: [], materials: []
        });
        setActiveSubTab("edit");
        setEditTab("general");
        setLoading(false);
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
            fa_details: { ...defaultFaDetails, ...(fa.fa_details || {}) },
            labor: (laborRes.data || []).sort((a: any, b: any) => (a.fecha || "").localeCompare(b.fecha || "")),
            equipment: equipRes.data || [],
            materials: matRes.data || []
        });
        setActiveSubTab("edit");
        setLoading(false);
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if(!confirm("¿Desea borrar irrevocablemente este Force Account?")) return;
        setLoading(true);
        await supabase.from("force_accounts").delete().eq("id", id);
        fetchForceAccounts();
    }

    const saveData = async (silent = false) => {
        if (!currentFA || !projectId) return;
        setLoading(true);
        try {
            const { labor, equipment, materials, ...faData } = currentFA;
            const faDataToSave = {
                ...faData,
                fecha_inicio: faData.fecha_inicio || null,
                fecha_fin: faData.fecha_fin || null,
            };

            let faId = currentFA.id;
            if (faId && !faId.includes('-temp-')) { // Check if it's a real ID
                await supabase.from("force_accounts").update(faDataToSave).eq("id", faId);
            } else {
                const { id: _, ...insertData } = faDataToSave;
                const { data, error } = await supabase.from("force_accounts").insert([insertData]).select().single();
                if (error) throw error;
                faId = data.id;
                setCurrentFA((prev: any) => ({ ...prev, id: faId }));
            }

            const processChildTable = async (table: string, items: any[]) => {
                const itemsWithFAId = (items || []).map(item => {
                    const { id, created_at, ...rest } = item;
                    if (rest.fecha === "") rest.fecha = null;
                    return { ...rest, force_account_id: faId };
                });
                await supabase.from(table).delete().eq("force_account_id", faId);
                if (itemsWithFAId.length > 0) await supabase.from(table).insert(itemsWithFAId);
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

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const result = await importSectionFromJSON(file);
        if (result.success) {
            const data = result.data;
            if (activeSubTab === "edit") {
                // Si estamos editando un FA, importamos los componentes (labor, equipment, etc) a este FA
                const { labor, equipment, materials, fa_details } = data;
                setCurrentFA((prev: any) => ({
                    ...prev,
                    labor: labor || prev.labor || [],
                    equipment: equipment || prev.equipment || [],
                    materials: materials || prev.materials || [],
                    fa_details: { ...prev.fa_details, ...(fa_details || {}) }
                }));
                alert("Datos importados al Force Account actual. Guarde para confirmar.");
            } else {
                // Si estamos en la lista, importamos como un nuevo FA completo
                const { labor, equipment, materials, ...faHeader } = data;
                const newFA = {
                    ...faHeader,
                    id: `new-temp-${Date.now()}`, // Temporary ID
                    project_id: projectId,
                    labor: labor || [],
                    equipment: equipment || [],
                    materials: materials || []
                };
                setCurrentFA(newFA);
                setActiveSubTab("edit");
                alert("Nuevos datos de Force Account cargados. Guarde para finalizar la importación.");
            }
        } else {
            alert("Error al importar: " + (result.error || "Formato inválido"));
        }
        e.target.value = "";
    };

    useImperativeHandle(ref, () => ({ save: () => saveData(true) }));

    const updateDetail = (key: string, val: number) => {
        setCurrentFA((prev: any) => ({
            ...prev, fa_details: { ...prev.fa_details, [key]: val }
        }));
    };

    const calcularTotalesGlobales = () => {
        if(!currentFA) return { tManoObra: 0, tMateriales: 0, tEquipo: 0, tGlobal: 0, fianz: 0, sum123: 0, h_subtotal: 0, g: 0, k: 0, m: 0, s: 0, t: 0, matSer_a: 0, subMat: 0, subSer: 0, matSer_b: 0, b_eq: 0, activo: 0, inactivo: 0 };
        const d = currentFA.fa_details || defaultFaDetails;
        
        // MO Math
        const sumaOP = d.mo_operadores + (d.mo_operadores * (d.mo_operadores_pct/100));
        const sumaCA = d.mo_carpinteros + (d.mo_carpinteros * (d.mo_carpinteros_pct/100));
        const sumaAD = d.mo_adicional + (d.mo_adicional * (d.mo_adicional_pct/100));
        const g = sumaOP + sumaCA + sumaAD; // manual
        
        // raw labor sum from table rows
        const hrsNormales = currentFA.labor?.reduce((acc: number, c: any) => acc + ((c.horas_normales||0)*parseFloat(c.tasa_normal||0)), 0) || 0;
        const h_subtotal = hrsNormales; 
        const I_beneficios = h_subtotal * (d.mo_sin_union_pct/100);
        const k = currentFA.con_union ? (g + d.mo_gastos_viaje) : (h_subtotal + I_beneficios + d.mo_gastos_viaje);
        const l_benef = k * (d.mo_beneficio_ind_pct/100);
        const m = k + l_benef;
        
        const n_ss_state = h_subtotal * (d.mo_fondo_estado_pct/100);
        const o_ss = h_subtotal * (d.mo_seguro_social_pct/100);
        const p_ss_desempleo = h_subtotal * ((d.mo_desempleo_est_pct + d.mo_desempleo_fed_pct)/100);
        const q_resp = h_subtotal * (d.mo_resp_publica_pct/100);
        const r_incap = h_subtotal * (d.mo_incapacidad_pct/100);
        const s = n_ss_state + o_ss + p_ss_desempleo + q_resp + r_incap;
        const t = s * (d.mo_beneficio_ind_final_pct/100);
        
        const tManoObra = m + s + t;

        // Materias Math
        let subMat = 0, subSer = 0;
        if (d.diario_mat) {
            Object.values(d.diario_mat as Record<string,any>).forEach(x => {
                subMat += x.m || 0; subSer += x.s || 0;
            });
        }
        const matSer_a = subMat + subSer;
        const matSer_b = (subMat * (d.mat_beneficio_pct/100)) + (subSer * (d.serv_beneficio_pct/100));
        const tMateriales = matSer_a + matSer_b;

        // Equipment Math
        // c) Activo sum (renta y factor zona omitidos as per instructions sum, but usually calculated)
        // From table: Renta_mensual o tase_act
        let activo = 0; let inactivo = 0;
        currentFA.equipment?.forEach((eq:any) => {
            activo += eq.horas_activo * (eq.tasa_activo||eq.renta_mensual); // Simplification 
            inactivo += eq.horas_inactivo * eq.tasa_inactivo;
        })
        const a_eq = activo + inactivo;
        const b_eq = a_eq * (d.eq_beneficio_pct/100);
        const tEquipo = a_eq + b_eq;

        const sum123 = tManoObra + tMateriales + tEquipo;
        const fianz = sum123 * (d.fianzas_pct_mil / 1000);
        const tGlobal = sum123 + fianz;

        return { tManoObra, tMateriales, tEquipo, sum123, fianz, tGlobal, h_subtotal, g, k, m, s, t, matSer_a, subMat, subSer, matSer_b, b_eq, activo, inactivo };
    };

    if (activeSubTab === "list") {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Calculator className="text-primary" /> Force Account
                    </h2>
                    <button onClick={handleCreateNew} className="btn-primary flex items-center gap-2"><Plus size={18} /> Nuevo FA</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {forceAccounts.map(fa => (
                        <div key={fa.id} className="card hover:shadow-md transition-all cursor-pointer border-l-4 border-primary relative" onClick={() => handleEdit(fa)}>
                            <div className="flex justify-between items-start mb-4">
                                <span className="text-xs font-black text-primary uppercase tracking-widest bg-primary/10 px-2 py-1 rounded-lg">{fa.fa_num}</span>
                                <span className="text-[10px] text-slate-400 font-bold">{new Date(fa.fecha_inicio).toLocaleDateString()}</span>
                            </div>
                            <h3 className="font-bold text-slate-800 dark:text-white mb-2 line-clamp-1">{fa.descripcion || "Sin descripción"}</h3>
                            <div className="flex justify-between items-center text-primary font-black text-lg pt-4 border-t border-slate-100 dark:border-slate-800">
                                <button onClick={(e) => handleDelete(e, fa.id)} className="text-red-400 hover:text-red-600 bg-red-50 p-1.5 rounded-lg"><Trash2 size={16} /></button>
                                <ChevronRight size={20} />
                            </div>
                        </div>
                    ))}
                    {forceAccounts.length === 0 && <div className="col-span-full py-20 text-center text-slate-400 italic">No hay registros de Force Account.</div>}
                </div>
            </div>
        );
    }

    const { tManoObra, tMateriales, tEquipo, tGlobal, h_subtotal, g, sum123, fianz, k, m, s, t, matSer_a, subMat, subSer, matSer_b, activo, inactivo, b_eq } = calcularTotalesGlobales();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <button onClick={() => setActiveSubTab("list")} className="flex items-center gap-2 text-slate-500 font-bold text-sm">
                    <ChevronLeft size={18} /> Volver
                </button>
            </div>

            <FloatingFormActions actions={[
                {
                    label: "Exportar JSON", position: "middle-right" as const, size: "small" as const,
                    icon: <Download />,
                    onClick: () => exportSectionToJSON(`fa_${currentFA?.fa_num || 'draft'}`, currentFA),
                    description: "Exportar todos los datos de este Force Account (MO, Materiales, Equipo)",
                    variant: 'export' as const,
                    disabled: loading
                },
                {
                    label: "Importar JSON", position: "middle-right" as const, size: "small" as const,
                    icon: <Upload />,
                    onClick: () => document.getElementById('import-fa-json')?.click(),
                    description: "Cargar datos de Force Account desde un archivo JSON",
                    variant: 'import' as const,
                    disabled: loading
                },
                { label: loading ? "Guardando..." : "Guardar cambios", description: "Grabar datos al servidor", icon: <Save />, onClick: () => saveData(false), variant: 'primary', disabled: loading }
            ]} />
            <input id="import-fa-json" type="file" accept=".json" className="hidden" onChange={handleImport} />


            <div className="card p-0 overflow-hidden bg-white dark:bg-slate-900 shadow-xl rounded-[2rem]">
                <div className="bg-slate-50 dark:bg-slate-800/50 flex flex-wrap border-b border-slate-100">
                    <TabBtn id="general" active={editTab} set={setEditTab} label="General" />
                    <TabBtn id="labor" active={editTab} set={setEditTab} label="Mano de Obra" />
                    <TabBtn id="photos" active={editTab} set={setEditTab} label="Evidencias/Fotos" />
                    <TabBtn id="material" active={editTab} set={setEditTab} label="Materiales" />
                    <TabBtn id="equipment" active={editTab} set={setEditTab} label="Equipo" />
                    <TabBtn id="summary" active={editTab} set={setEditTab} label="Totales" />
                </div>

                <div className="p-8 pb-32">
                    {/* ===== GENERAL ===== */}
                    {editTab === "general" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4 md:col-span-2">
                                <label className="flex items-center space-x-2 bg-primary/5 p-4 rounded-xl border border-primary/20 w-max cursor-pointer">
                                    <input type="checkbox" checked={currentFA.con_union} onChange={(e) => setCurrentFA({...currentFA, con_union: e.target.checked})} className="form-checkbox text-primary rounded-lg w-5 h-5"/>
                                    <span className="font-bold text-slate-700">Force Account con Unión</span>
                                </label>
                            </div>
                            <div className="space-y-1"><label className="text-[10px] uppercase font-black">Proyecto # (Manual)</label><input className="input-field" value={currentFA.fa_details?.proyecto_manual || ""} onChange={e => updateDetail('proyecto_manual', e.target.value)} placeholder="Para forzar en reporte"/></div>
                            <div className="space-y-1"><label className="text-[10px] uppercase font-black">Nombre del Proyecto</label><input className="input-field" value={currentFA.descripcion} onChange={e => setCurrentFA({...currentFA, descripcion: e.target.value})} /></div>
                            <div className="space-y-1"><label className="text-[10px] uppercase font-black">Administrador / DTR</label><input className="input-field" value={currentFA.admin || ""} onChange={e => setCurrentFA({...currentFA, admin: e.target.value})} /></div>
                            <div className="space-y-1"><label className="text-[10px] uppercase font-black">Contratista</label><input className="input-field" value={currentFA.contratista || ""} onChange={e => setCurrentFA({...currentFA, contratista: e.target.value})} /></div>
                            <div className="space-y-1"><label className="text-[10px] uppercase font-black">Liquidador Oficial</label><input className="input-field" value={currentFA.liquidador || ""} onChange={e => setCurrentFA({...currentFA, liquidador: e.target.value})} /></div>
                            <div className="space-y-1"><label className="text-[10px] uppercase font-black">Force Account #</label><input className="input-field" value={currentFA.fa_num} onChange={e => setCurrentFA({...currentFA, fa_num: e.target.value})} /></div>
                            <div className="space-y-1"><label className="text-[10px] uppercase font-black">Partida #</label><input className="input-field" value={currentFA.partida_num || ""} onChange={e => setCurrentFA({...currentFA, partida_num: e.target.value})} /></div>
                            <div className="space-y-1"><label className="text-[10px] uppercase font-black">EWO #</label><input className="input-field" value={currentFA.ewo_num || ""} onChange={e => setCurrentFA({...currentFA, ewo_num: e.target.value})} /></div>
                            
                            <hr className="md:col-span-2 my-4" />
                            <div className="space-y-1 relative">
                                <label className="text-[10px] uppercase font-black">Fecha Incio FA</label>
                                <div className="relative">
                                    <input type="date" className="input-field pr-12" value={currentFA.fecha_inicio||""} onChange={e=>setCurrentFA({...currentFA, fecha_inicio: e.target.value})}/>
                                    <TodayButton onSelect={(date) => setCurrentFA({...currentFA, fecha_inicio: date})} />
                                </div>
                            </div>
                            <div className="space-y-1 relative">
                                <label className="text-[10px] uppercase font-black">Fecha Fín FA</label>
                                <div className="relative">
                                    <input type="date" className="input-field pr-12" value={currentFA.fecha_fin||""} onChange={e=>setCurrentFA({...currentFA, fecha_fin: e.target.value})}/>
                                    <TodayButton onSelect={(date) => setCurrentFA({...currentFA, fecha_fin: date})} />
                                </div>
                            </div>
                        </div>
                    )}
                                     {/* ===== MANO DE OBRA ===== */}
                    {editTab === "labor" && (
                        <div className="space-y-8">
                            <TableEditor 
                                items={currentFA.labor} 
                                setItems={(items: any) => setCurrentFA({...currentFA, labor: items})}
                                columns={[
                                    { key: 'fecha', label: 'Fecha', type: 'date' },
                                    { key: 'nombre', label: 'Nombre/Apellidos', type: 'text' },
                                    { key: 'seguro_social', label: 'Seg. Social', type: 'text' },
                                    { key: 'clasificacion', label: 'Clasificación', type: 'text' },
                                    { key: 'tasa_normal', label: 'Salario/hora', type: 'number' },
                                    { key: 'union_name', label: 'Unión', type: 'text' },
                                    { key: 'horas_normales', label: 'Hrs', type: 'number' },
                                    { key: 'cantidad_total', label: 'Cantidad total', type: 'readonly_calc', calc: (it: any) => (it.horas_normales||0)*(it.tasa_normal||0) }
                                ]}
                            />
                            
                            {(() => {
                                const laborItems = currentFA.labor || [];
                                const byMonth: Record<string, number> = {};
                                let globalTotal = 0;
                                laborItems.forEach((it: any) => {
                                    if (it.fecha) {
                                        const dateObj = new Date(it.fecha);
                                        // Ajuste de zona horaria local para evitar que brinque al mes anterior
                                        const localDate = new Date(dateObj.getTime() + dateObj.getTimezoneOffset() * 60000);
                                        const monthFormatter = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });
                                        const monthStr = monthFormatter.format(localDate).toUpperCase();
                                        
                                        if (!byMonth[monthStr]) byMonth[monthStr] = 0;
                                        const sum = (it.horas_normales || 0) * (it.tasa_normal || 0);
                                        byMonth[monthStr] += sum;
                                        globalTotal += sum;
                                    }
                                });
                                const months = Object.keys(byMonth);
                                if (months.length === 0) return null;
                                return (
                                    <div className="bg-white rounded-xl border p-4 shadow-sm mb-4">
                                        <h4 className="font-bold mb-3 uppercase text-[10px] tracking-widest text-slate-500">Subtotales por Mes (Cantidad Total)</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                            {months.map(m => (
                                                <div key={m} className="p-3 bg-slate-50 rounded-lg border flex justify-between items-center text-xs">
                                                    <span className="font-bold text-slate-600">{m}</span>
                                                    <span className="text-primary font-black">{formatCurrency(byMonth[m])}</span>
                                                </div>
                                            ))}
                                            <div className="p-3 bg-primary/10 rounded-lg border border-primary/20 flex justify-between items-center text-xs lg:col-start-4">
                                                <span className="font-black text-primary">TOTAL MO:</span>
                                                <span className="text-primary font-black text-sm">{formatCurrency(globalTotal)}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl border p-6">
                                <h4 className="font-bold mb-4 uppercase text-xs tracking-widest text-slate-500">Resumen y Cálculo de Mano de Obra</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-xs">
                                    <div className="flex items-center justify-between py-2 border-b"><span className="w-48">a) Subtot Operadores (Unión)</span> $<input className="w-24 text-right bg-white border outline-none" type="number" step="any" value={currentFA.fa_details.mo_operadores} onChange={e=>updateDetail('mo_operadores', +e.target.value)}/></div>
                                    <div className="flex items-center justify-between py-2 border-b"><span className="w-48">b) Beneficios Oper. <input className="w-12 text-center border mr-1 text-xs" type="number" step="any" value={currentFA.fa_details.mo_operadores_pct} onChange={e=>updateDetail('mo_operadores_pct', +e.target.value)}/>%</span> <b>{formatCurrency(currentFA.fa_details.mo_operadores * (currentFA.fa_details.mo_operadores_pct/100))}</b></div>
                                    <div className="flex items-center justify-between py-2 border-b"><span className="w-48">c) Subtot Carpinteros</span> $<input className="w-24 text-right bg-white border outline-none" type="number" step="any" value={currentFA.fa_details.mo_carpinteros} onChange={e=>updateDetail('mo_carpinteros', +e.target.value)}/></div>
                                    <div className="flex items-center justify-between py-2 border-b"><span className="w-48">d) Beneficios Carp. <input className="w-12 text-center border mr-1 text-xs" type="number" step="any" value={currentFA.fa_details.mo_carpinteros_pct} onChange={e=>updateDetail('mo_carpinteros_pct', +e.target.value)}/>%</span> <b>{formatCurrency(currentFA.fa_details.mo_carpinteros * (currentFA.fa_details.mo_carpinteros_pct/100))}</b></div>
                                    <div className="flex items-center justify-between py-2 border-b"><span className="w-48">e) Subtot Adicional</span> $<input className="w-24 text-right bg-white border outline-none" type="number" step="any" value={currentFA.fa_details.mo_adicional} onChange={e=>updateDetail('mo_adicional', +e.target.value)}/></div>
                                    <div className="flex items-center justify-between py-2 border-b"><span className="w-48">f) Beneficios Adic. <input className="w-12 text-center border mr-1 text-xs" type="number" step="any" value={currentFA.fa_details.mo_adicional_pct} onChange={e=>updateDetail('mo_adicional_pct', +e.target.value)}/>%</span> <b>{formatCurrency(currentFA.fa_details.mo_adicional * (currentFA.fa_details.mo_adicional_pct/100))}</b></div>
                                    <div className="flex items-center justify-between py-2 border-b"><span className="font-bold text-primary">g) Suma Unión (a..f)</span> <b>{formatCurrency(g)}</b></div>
                                    <div className="flex items-center justify-between py-2 border-b"></div>

                                    <div className="flex items-center justify-between py-2 border-b"><span className="w-48">h) Subtotal Mano Obra Reg/Ext</span> <b>{formatCurrency(h_subtotal)}</b></div>
                                    <div className="flex items-center justify-between py-2 border-b"><span className="w-48">i) Beneficios marginales <input className="w-12 text-center border mr-1 text-xs" type="number" step="any" value={currentFA.fa_details.mo_sin_union_pct} onChange={e=>updateDetail('mo_sin_union_pct', +e.target.value)}/>%</span>  <b>{formatCurrency(h_subtotal * (currentFA.fa_details.mo_sin_union_pct/100))}</b></div>
                                    
                                    <div className="col-span-1 md:col-span-2 mt-4 space-y-2">
                                        <div className="flex justify-between items-center bg-white p-2 border"><span className="w-48 font-bold">j) Gastos Viaje/Dietas</span> $<input className="w-32 text-right bg-slate-50 border p-1" type="number" step="any" value={currentFA.fa_details.mo_gastos_viaje} onChange={e=>updateDetail('mo_gastos_viaje', +e.target.value)}/></div>
                                        <div className="flex justify-between items-center p-2"><span className="w-64 font-bold">k) Suma Base (Unión ó Sin Unión + Viajes)</span> <b>{formatCurrency(k)}</b></div>
                                        <div className="flex justify-between items-center p-2"><span className="w-64 font-bold">l) Beneficio Industrial <input className="w-12 text-center border" type="number" step="any" value={currentFA.fa_details.mo_beneficio_ind_pct} onChange={e=>updateDetail('mo_beneficio_ind_pct', +e.target.value)}/>% de k</span> <b>{formatCurrency(k * (currentFA.fa_details.mo_beneficio_ind_pct/100))}</b></div>
                                        <div className="flex justify-between items-center p-2 border-b-2 border-slate-300 bg-slate-100"><span className="font-black">m) SUMA L+K</span> <b className="text-lg">{formatCurrency(m)}</b></div>

                                        <div className="flex justify-between py-1 pt-4 text-[11px]"><span className="w-64">n) Fondo Seguro Estado <input className="w-10 border text-center" type="number" step="any" value={currentFA.fa_details.mo_fondo_estado_pct} onChange={e=>updateDetail('mo_fondo_estado_pct', +e.target.value)}/>%</span> <b>{formatCurrency(h_subtotal * (currentFA.fa_details.mo_fondo_estado_pct/100))}</b></div>
                                        <div className="flex justify-between py-1 text-[11px]"><span className="w-64">o) Seguro Social <input className="w-10 border text-center" type="number" step="any" value={currentFA.fa_details.mo_seguro_social_pct} onChange={e=>updateDetail('mo_seguro_social_pct', +e.target.value)}/>%</span> <b>{formatCurrency(h_subtotal * (currentFA.fa_details.mo_seguro_social_pct/100))}</b></div>
                                        <div className="flex justify-between py-1 text-[11px]"><span className="w-64">p) Desempleo Est. <input className="w-8 border" type="number" step="any" value={currentFA.fa_details.mo_desempleo_est_pct} onChange={e=>updateDetail('mo_desempleo_est_pct', +e.target.value)}/>% + Fed. <input className="w-8 border" type="number" step="any" value={currentFA.fa_details.mo_desempleo_fed_pct} onChange={e=>updateDetail('mo_desempleo_fed_pct', +e.target.value)}/>%</span> <b>{formatCurrency(h_subtotal * ((currentFA.fa_details.mo_desempleo_est_pct + currentFA.fa_details.mo_desempleo_fed_pct)/100))}</b></div>
                                        <div className="flex justify-between py-1 text-[11px]"><span className="w-64">q) Seg. Resp. Pública <input className="w-10 border text-center" type="number" step="any" value={currentFA.fa_details.mo_resp_publica_pct} onChange={e=>updateDetail('mo_resp_publica_pct', +e.target.value)}/>%</span> <b>{formatCurrency(h_subtotal * (currentFA.fa_details.mo_resp_publica_pct/100))}</b></div>
                                        <div className="flex justify-between py-1 text-[11px] border-b"><span className="w-64">r) Incapacidad <input className="w-10 border text-center" type="number" step="any" value={currentFA.fa_details.mo_incapacidad_pct} onChange={e=>updateDetail('mo_incapacidad_pct', +e.target.value)}/>%</span> <b>{formatCurrency(h_subtotal * (currentFA.fa_details.mo_incapacidad_pct/100))}</b></div>

                                        <div className="flex justify-between p-2"><span className="font-bold">s) Suma (n+o+p+q+r)</span> <b>{formatCurrency(s)}</b></div>
                                        <div className="flex justify-between p-2"><span className="font-bold">t) Beneficio Industrial final <input className="w-10 border text-center font-normal" type="number" step="any" value={currentFA.fa_details.mo_beneficio_ind_final_pct} onChange={e=>updateDetail('mo_beneficio_ind_final_pct', +e.target.value)}/>%</span> <b>{formatCurrency(t)}</b></div>

                                        <div className="flex justify-between p-4 bg-green-50 text-green-900 border border-green-200 mt-4"><span className="font-black text-lg">(1) TOTAL DE MANO DE OBRA (m+s+t)</span> <b className="text-xl">{formatCurrency(tManoObra)}</b></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ===== FOTOS / EVIDENCIAS ===== */}
                    {editTab === "photos" && (
                        <div className="space-y-6">
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-3xl border border-blue-100 dark:border-blue-800">
                                <h3 className="text-lg font-bold text-blue-800 dark:text-blue-300 mb-2">Evidencia Fotográfica</h3>
                                <p className="text-xs text-blue-600 dark:text-blue-400 mb-6">Suba las fotos correspondientes a los trabajos realizados para este Force Account.</p>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {(currentFA.fa_details.fotos_data || []).map((foto: any, idx: number) => (
                                        <div key={idx} className="relative group aspect-video bg-slate-200 dark:bg-slate-800 rounded-2xl overflow-hidden shadow-sm">
                                            <img src={foto.url} alt={`Evidencia ${idx}`} className="w-full h-full object-cover" />
                                            <button 
                                                onClick={() => {
                                                    const newPhotos = [...currentFA.fa_details.fotos_data];
                                                    newPhotos.splice(idx, 1);
                                                    updateDetail('fotos_data', newPhotos as any);
                                                }}
                                                className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                    <label className="flex flex-col items-center justify-center aspect-video border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-all">
                                        <Plus className="text-slate-400 mb-2" size={32} />
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">Añadir Foto</span>
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            className="hidden" 
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onload = (ev) => {
                                                        const newPhoto = { url: ev.target?.result, name: file.name, date: new Date().toISOString() };
                                                        const photos = [...(currentFA.fa_details.fotos_data || []), newPhoto];
                                                        updateDetail('fotos_data', photos as any);
                                                    };
                                                    reader.readAsDataURL(file);
                                                }
                                            }}
                                        />
                                    </label>
                                </div>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-6">Insumos Especiales (Basado en Fotos)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase">Cisterna (Qty)</label>
                                        <input type="number" className="input-field" value={currentFA.fa_details.cisterna_qty || 0} onChange={e => updateDetail('cisterna_qty', +e.target.value)} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase">Camión Agua (Qty)</label>
                                        <input type="number" className="input-field" value={currentFA.fa_details.camion_agua_qty || 0} onChange={e => updateDetail('camion_agua_qty', +e.target.value)} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase">Camión Diesel (Qty)</label>
                                        <input type="number" className="input-field" value={currentFA.fa_details.camion_diesel_qty || 0} onChange={e => updateDetail('camion_diesel_qty', +e.target.value)} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ===== MATERIALES Y SERVICIOS ===== */}
                    {editTab === "material" && (
                        <div className="space-y-6">
                            <p className="text-sm font-bold opacity-50">Informe Diario (del día 1 al 31 del mes)</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {[0, 10, 20].map(offset => (
                                    <table key={offset} className="w-full text-xs text-center border">
                                        <thead className="bg-slate-100 font-bold border-b">
                                            <tr><th className="p-2 border-r">Día Mes</th><th className="p-2">Materiales</th><th className="p-2 border-l">Servicios</th></tr>
                                        </thead>
                                        <tbody>
                                            {Array.from({length: offset === 20 ? 11 : 10}).map((_, i) => {
                                                const d = String(offset + i + 1);
                                                const valD = currentFA.fa_details.diario_mat?.[d] || {m:0, s:0};
                                                return <tr key={d} className="border-b">
                                                    <td className="p-1 border-r font-bold text-slate-500 bg-slate-50">{d}</td>
                                                    <td className="p-1"><input type="number" className="w-full border-b outline-none text-center h-6" value={valD.m||""} onChange={e=>{
                                                        const newVal = {...currentFA.fa_details.diario_mat, [d]: {...valD, m: +e.target.value}};
                                                        updateDetail('diario_mat', newVal);
                                                    }}/></td>
                                                    <td className="p-1 border-l"><input type="number" className="w-full border-b outline-none text-center h-6" value={valD.s||""} onChange={e=>{
                                                        const newVal = {...currentFA.fa_details.diario_mat, [d]: {...valD, s: +e.target.value}};
                                                        updateDetail('diario_mat', newVal);
                                                    }}/></td>
                                                </tr>
                                            })}
                                        </tbody>
                                    </table>
                                ))}
                            </div>
                            
                            <div className="bg-slate-50 rounded-2xl border p-6 text-sm">
                                <div className="flex justify-between py-2 border-b"><span className="w-64 font-bold">a) Subtotal Materiales y/o Serv.</span> <b>{formatCurrency(matSer_a)}</b></div>
                                <div className="flex justify-between py-2 border-b items-center"><span className="w-64 font-bold">b) Beneficio Ind. <input className="w-10 text-center border mx-1" value={currentFA.fa_details.mat_beneficio_pct} onChange={e=>updateDetail('mat_beneficio_pct', +e.target.value)}/>% Mat, <input className="w-10 text-center border mx-1" value={currentFA.fa_details.serv_beneficio_pct} onChange={e=>updateDetail('serv_beneficio_pct', +e.target.value)}/>% Serv</span> <b>{formatCurrency(matSer_b)}</b></div>
                                <div className="flex justify-between p-4 bg-orange-50 text-orange-900 border border-orange-200 mt-2"><span className="font-black text-lg">(2) TOTAL DE MATERIALES Y/O SERVICIOS (a+b)</span> <b className="text-xl">{formatCurrency(tMateriales)}</b></div>
                            </div>
                        </div>
                    )}

                    {/* ===== EQUIPO ===== */}
                    {editTab === "equipment" && (
                        <div className="space-y-6">
                            <TableEditor 
                                items={currentFA.equipment} 
                                setItems={(items: any) => setCurrentFA({...currentFA, equipment: items})}
                                columns={[
                                    { key: 'num_equipo', label: 'ID Num.', type: 'text' },
                                    { key: 'descripcion', label: 'Descripción', type: 'text' },
                                    { key: 'modelo', label: 'Modelo', type: 'text' },
                                    { key: 'anio', label: 'Año', type: 'text' },
                                    { key: 'capacidad', label: 'Capacidad', type: 'text' },
                                    { key: 'combustible', label: 'Dielsel/Gas', type: 'text' },
                                    { key: 'propiedad', label: 'Alquilado/Propio', type: 'text' },
                                    { key: 'renta_mensual', label: 'Renta Mensual', type: 'number' },
                                    { key: 'horas_activo', label: 'Hrs Act', type: 'number' },
                                    { key: 'horas_inactivo', label: 'Hrs Idle', type: 'number' },
                                    { key: 'tasa_activo', label: 'Costo Op.', type: 'number' },
                                ]}
                            />

                            <div className="bg-slate-50 rounded-2xl border p-6 text-sm">
                                <h4 className="font-bold mb-4 uppercase text-xs tracking-widest text-slate-500">Resumen y Cálculo de Equipo</h4>
                                <div className="flex justify-between py-2 border-b"><span className="w-96 font-bold">a) Subtotal Renta Activo + Inactivo (sin op cost)</span> <b>{formatCurrency(activo+inactivo)}</b></div>
                                <div className="flex justify-between py-2 border-b"><span className="w-96 font-bold">b) Beneficio Ind. <input className="w-12 text-center border mx-1" value={currentFA.fa_details.eq_beneficio_pct} onChange={e=>updateDetail('eq_beneficio_pct', +e.target.value)}/>% de (a)</span> <b>{formatCurrency(b_eq)}</b></div>
                                <div className="flex justify-between py-2 border-b"><span className="w-96 font-bold">c) Subtotal Activo</span> <span className="text-slate-500">{formatCurrency(activo)}</span></div>
                                <div className="flex justify-between py-2 border-b"><span className="w-96 font-bold">d) Subtotal Inactivo</span> <span className="text-slate-500">{formatCurrency(inactivo)}</span></div>
                                <div className="flex justify-between p-4 bg-yellow-50 text-yellow-900 border border-yellow-200 mt-2"><span className="font-black text-lg">(3) TOTAL DE EQUIPO (b + c + d)</span> <b className="text-xl">{formatCurrency(tEquipo)}</b></div>
                            </div>
                        </div>
                    )}

                    {/* ===== TOTALES ===== */}
                    {editTab === "summary" && (
                        <div className="space-y-6">
                           <div className="bg-white rounded-3xl border-2 border-slate-100 p-8">
                                <table className="w-full text-left text-sm">
                                    <tbody>
                                        <tr><td className="py-4 font-bold uppercase tracking-widest border-b text-slate-500 w-2/3">1) Total Mano De Obra</td><td className="py-4 font-black text-right border-b text-lg">{formatCurrency(tManoObra)}</td></tr>
                                        <tr><td className="py-4 font-bold uppercase tracking-widest border-b text-slate-500">2) Total Materiales y/o Servicios</td><td className="py-4 font-black text-right border-b text-lg">{formatCurrency(tMateriales)}</td></tr>
                                        <tr><td className="py-4 font-bold uppercase tracking-widest border-b text-slate-500">3) Total De Equipo</td><td className="py-4 font-black text-right border-b text-lg">{formatCurrency(tEquipo)}</td></tr>
                                        <tr className="bg-slate-50"><td className="py-4 px-4 font-black uppercase border-b text-lg text-primary">4) TOTAL (1+2+3)</td><td className="py-4 font-black text-right border-b text-xl px-4 text-primary">{formatCurrency(sum123)}</td></tr>
                                        <tr><td className="py-4 font-bold tracking-widest border-b text-slate-500 items-center flex gap-2">5) FIANZAS DE EJECUCION <input className="w-16 border rounded text-center px-1 font-normal text-black" value={currentFA.fa_details.fianzas_pct_mil} onChange={e=>updateDetail('fianzas_pct_mil', +e.target.value)}/> % POR MIL DE (4)</td><td className="py-4 font-black text-right border-b text-lg text-black">{formatCurrency(fianz)}</td></tr>
                                        <tr className="bg-primary text-white"><td className="py-6 px-4 font-black text-xl rounded-l-2xl">6) COSTO TOTAL DEL TRABAJO POR ADMINISTRACIÓN. (4+5)</td><td className="py-6 font-black text-right text-3xl px-6 rounded-r-2xl text-yellow-300">{formatCurrency(tGlobal)}</td></tr>
                                    </tbody>
                                </table>
                           </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

function TabBtn({ id, active, set, label }: any) {
    const isActive = active === id;
    return (
        <button 
            onClick={() => set(id)}
            className={`flex-1 py-4 px-2 text-[10px] md:text-xs font-black uppercase tracking-widest transition-all border-b-2 text-center break-words ${
                isActive ? 'bg-white dark:bg-slate-900 border-primary text-primary shadow-inner' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
        >
            {label}
        </button>
    );
}

function TableEditor({ items, setItems, columns }: any) {
    const handleAdd = () => {
        const newItem = columns.reduce((acc: any, col: any) => {
            if (col.type !== 'readonly_calc') {
                acc[col.key] = col.type === 'number' ? 0 : col.type === 'date' ? new Date().toISOString().split("T")[0] : "";
            }
            return acc;
        }, {});
        setItems([...items, newItem]);
    };
    return (
        <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-left bg-white">
                    <thead className="bg-slate-100">
                        <tr>
                            {columns.map((col: any) => <th key={col.key} className="px-2 py-2 text-[10px] font-black uppercase text-slate-500 whitespace-nowrap border-b border-r">{col.label}</th>)}
                            <th className="w-8 border-b"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item: any, idx: number) => (
                            <tr key={idx} className="border-b focus-within:bg-blue-50">
                                {columns.map((col: any) => (
                                    <td key={col.key} className="p-0 border-r min-w-[80px] relative">
                                        {col.type === 'readonly_calc' ? (
                                            <div className="w-full h-full flex justify-center items-center text-xs px-2 py-2.5 bg-slate-50 font-bold text-slate-600">
                                                {formatCurrency(col.calc(item))}
                                            </div>
                                        ) : (
                                            <>
                                                <input type={col.type==="number"?"text":col.type} className={`w-full outline-none text-xs px-2 py-2.5 bg-transparent ${col.type === "date" ? "pr-12" : ""}`} value={item[col.key]} onChange={e => {
                                                    const newItems = [...items];
                                                    newItems[idx][col.key] = col.type === 'number' ? (parseFloat(e.target.value) || 0) : e.target.value;
                                                    if (col.key === 'fecha') {
                                                        newItems.sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
                                                    }
                                                    setItems(newItems);
                                                }} />
                                                {col.type === "date" && (
                                                    <TodayButton onSelect={(date) => {
                                                        const newItems = [...items];
                                                        newItems[idx].fecha = date;
                                                        newItems.sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
                                                        setItems(newItems);
                                                    }} />
                                                )}
                                            </>
                                        )}
                                    </td>
                                ))}
                                <td className="px-2 text-center"><button onClick={() => setItems(items.filter((_:any,i:number)=>i!==idx))} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <button onClick={handleAdd} className="text-xs font-black text-primary uppercase"><Plus size={14} className="inline mr-1" /> Añadir Fila</button>
        </div>
    );
}

export default ForceAccountForm;
