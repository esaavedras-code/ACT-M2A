"use client";

import React, { useState, useMemo, useRef, forwardRef, useImperativeHandle, useEffect } from "react";
import { 
  FileText, Truck, Users, ChevronRight, LayoutDashboard,
  Info, CheckCircle2, Clock, Plus, Trash2, DollarSign,
  Download, Upload, ShieldCheck, Briefcase, Calculator, ChevronLeft,
  Search, X
} from 'lucide-react';
import { Project, AC49Report, LaborEntry, EquipmentEntry } from '../types/fa2';
import { EditableTable } from './EditableTable';
import { calculateLaborTotal, applyAC51Rules, calculateEquipmentRental } from '../lib/fa2Calculations';
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";

const PREDEFINED_EQUIPMENT_RATES = [
  { name: 'Pickup Truck (4x4)', model: 'Standard / Lariat', daily: 75, weekly: 350, monthly: 1200 },
  { name: 'Backhoe Loader', model: 'John Deere 310 / Case 580', daily: 350, weekly: 1400, monthly: 4200 },
  { name: 'Excavator (Large)', model: 'Cat 320 / Komatsu PC210', daily: 600, weekly: 2400, monthly: 7000 },
  { name: 'Bulldozer', model: 'Cat D6 / John Deere 750', daily: 550, weekly: 2200, monthly: 6500 },
  { name: 'Dump Truck', model: '10-12 Cubic Yards', daily: 250, weekly: 1000, monthly: 3200 },
  { name: 'Air Compressor', model: '185 CFM Diesel', daily: 100, weekly: 400, monthly: 1200 },
  { name: 'Generator (Power)', model: '50 kW Silence Pack', daily: 150, weekly: 600, monthly: 1800 },
  { name: 'Compact Roller', model: 'Double Drum Vibratory', daily: 200, weekly: 800, monthly: 2400 },
  { name: 'Concrete Mixer', model: 'Mobile 1-Bag Unit', daily: 80, weekly: 320, monthly: 1000 },
  { name: 'Light Tower', model: '4-Bulb Diesel Mobile', daily: 60, weekly: 240, monthly: 750 },
  { name: 'Skid Steer', model: 'Cat 262 / Bobcat S650', daily: 250, weekly: 1000, monthly: 3000 },
  { name: 'Man Lift / Scissor Lift', model: '40ft Electric/Diesel', daily: 180, weekly: 700, monthly: 1800 },
  { name: 'Motor Grader', model: 'Cat 140M / Case 865', daily: 450, weekly: 1800, monthly: 5500 },
  { name: 'Vibratory Plate', model: 'Walk-behind Gasoline', daily: 45, weekly: 180, monthly: 550 }
];



const ForceAccount2Form = forwardRef(function ForceAccount2Form({ projectId, onDirty }: { projectId?: string, onDirty?: () => void }, ref) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Active Report State
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  
  // Equipment Search State
  const [eqSearch, setEqSearch] = useState("");
  const [showEqSearcher, setShowEqSearcher] = useState(false);

  // Contract Items for lookup
  const [contractItems, setContractItems] = useState<any[]>([]);

  const [project, setProject] = useState<Project>({
    id: projectId || '1',
    number: '...',
    name: 'Cargando...',
    municipality: '',
    contractor: '',
    itemNumber: '',
    forceAccountNo: ''
  });

  const [ac49Report, setAc49Report] = useState<AC49Report>({
    id: 'draft',
    projectId: projectId || '1',
    date: new Date().toISOString().split('T')[0],
    reportNo: '',
    totalPages: 1,
    labor: [],
    equipment: [],
    materials: [],
    workDescription: '',
    relatedItemNo: '',
    relatedItemDescription: '',
    relatedItemUnitCost: 0,
    relatedItemAmount: 0,
    signatures: { contractor: false, projectChief: false }
  });

  const fetchProjectAndReports = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      // Fetch Project Info
      const { data: pData } = await supabase.from("projects").select("name, num_act, contractor_name").eq("id", projectId).single();
      if (pData) {
        setProject(prev => ({
          ...prev,
          name: pData.name,
          number: pData.num_act,
          contractor: pData.contractor_name || "M2A Group"
        }));
      }

      // Fetch FA2 Reports
      const { data: rData } = await supabase
        .from("fa2_reports")
        .select("*")
        .eq("project_id", projectId)
        .order("date", { ascending: false });
      
      if (rData) setReports(rData);

      // Fetch Contract Items
      const { data: cData } = await supabase.from("contract_items").select("*").eq("project_id", projectId);
      if (cData) setContractItems(cData);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectAndReports();
  }, [projectId]);

  const handleSelectReport = (report: any) => {
    setSelectedReportId(report.id);
    setAc49Report({
      id: report.id,
      projectId: report.project_id,
      date: report.date,
      reportNo: report.report_no,
      totalPages: 1,
      workDescription: report.description || '',
      labor: report.data?.labor || [],
      equipment: report.data?.equipment || [],
      materials: report.data?.materials || [],
      relatedItemNo: report.data?.relatedItemNo || '',
      relatedItemDescription: report.data?.relatedItemDescription || '',
      relatedItemUnitCost: report.data?.relatedItemUnitCost || 0,
      relatedItemAmount: report.data?.relatedItemAmount || 0,
      signatures: report.data?.signatures || { contractor: false, projectChief: false }
    });
    setActiveTab('ac49');
  };

  const handleItemLookup = (itemNo: string) => {
    const item = contractItems.find(i => i.item_num === itemNo);
    if (item) {
      setAc49Report(prev => ({
        ...prev,
        relatedItemNo: item.item_num,
        relatedItemDescription: item.description,
        relatedItemUnitCost: item.unit_price,
        relatedItemAmount: (item.quantity || 0) * (item.unit_price || 0)
      }));
    } else {
      setAc49Report(prev => ({
        ...prev,
        relatedItemNo: itemNo,
        relatedItemDescription: '',
        relatedItemUnitCost: 0,
        relatedItemAmount: 0
      }));
    }
  };

  const handleCreateNew = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const newNo = (reports.length + 1).toString().padStart(3, '0');
      const { data, error } = await supabase
        .from("fa2_reports")
        .insert([{
          project_id: projectId,
          report_no: `FA2-${newNo}`,
          date: new Date().toISOString().split('T')[0],
          description: `Nuevo Force Account ${newNo}`,
          data: { labor: [], equipment: [], materials: [] }
        }])
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setReports([data, ...reports]);
        handleSelectReport(data);
      }
    } catch (error: any) {
      alert("Error al crear: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("¿Desea eliminar permanentemente este Force Account?")) return;
    setLoading(true);
    try {
      await supabase.from("fa2_reports").delete().eq("id", id);
      setReports(reports.filter(r => r.id !== id));
      if (selectedReportId === id) setSelectedReportId(null);
    } catch (error) {
      alert("Error al eliminar.");
    } finally {
      setLoading(false);
    }
  };

  const saveData = async (silent = false) => {
    if (!selectedReportId || !projectId) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("fa2_reports")
        .update({
          report_no: ac49Report.reportNo,
          date: ac49Report.date,
          description: ac49Report.workDescription || 'Sin descripción',
          data: {
            labor: ac49Report.labor,
            equipment: ac49Report.equipment,
            materials: ac49Report.materials,
            relatedItemNo: ac49Report.relatedItemNo,
            relatedItemDescription: ac49Report.relatedItemDescription,
            relatedItemUnitCost: ac49Report.relatedItemUnitCost,
            relatedItemAmount: ac49Report.relatedItemAmount,
            signatures: ac49Report.signatures
          }
        })
        .eq("id", selectedReportId);

      if (error) throw error;
      if (!silent) alert("✅ Force Account guardado exitosamente.");
      
      // Update local list
      setReports(reports.map(r => r.id === selectedReportId ? { ...r, report_no: ac49Report.reportNo, date: ac49Report.date, description: ac49Report.workDescription } : r));
    } catch (error: any) {
      alert("Error al guardar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    save: () => saveData(true)
  }));

  const exportData = () => {
    const dataStr = JSON.stringify({ project, ac49Report, isFa2: true }, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `FA2_${project.number}_${ac49Report.reportNo}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const importData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const files = event.target.files;
    if (files && files[0]) {
      fileReader.readAsText(files[0], "UTF-8");
      fileReader.onload = async e => {
        try {
          const content = JSON.parse(e.target?.result as string);
          
          let reportToImport = null;

          if (content.ac49Report) {
            // Estructura FA-2 estándar
            reportToImport = content.ac49Report;
          } else if (content.fa_num || content.labor || content.equipment) {
            // Detectada estructura de Force Account Original (FA-1)
            // Realizar mapeo de campos al formato FA-2
            reportToImport = {
              reportNo: content.fa_num || "IM-01",
              workDescription: content.descripcion || "Migrado de Force Account original",
              date: content.fecha_inicio || new Date().toISOString().split('T')[0],
              labor: (content.labor || []).map((l: any) => ({
                id: Date.now().toString() + Math.random(),
                employeeName: l.empleado || "",
                ssLast4: l.ss_last4 || "",
                classification: l.clasificacion || "",
                hoursReg: parseFloat(l.horas_normales || 0),
                hours15: parseFloat(l.horas_extras_15 || 0),
                hours20: parseFloat(l.horas_extras_20 || 0),
                hourlyRate: parseFloat(l.tasa_normal || 0)
              })),
              equipment: (content.equipment || []).map((e: any) => ({
                id: Date.now().toString() + Math.random(),
                description: e.descripcion || "",
                model: e.modelo || "",
                hours: parseFloat(e.horas || 0),
                dailyRate: parseFloat(e.tarifa_diaria || 0)
              })),
              materials: (content.materials || []).map((m: any) => ({
                id: Date.now().toString() + Math.random(),
                description: m.descripcion || "",
                supplier: m.suplidor || "",
                invoiceNo: m.factura_num || "",
                quantity: parseFloat(m.cantidad || 0),
                amount: parseFloat(m.costo_total || 0)
              }))
            };
          }

          if (reportToImport) {
            setLoading(true);
            const { data, error } = await supabase
              .from("fa2_reports")
              .insert([{
                project_id: projectId,
                report_no: reportToImport.reportNo + " (Cargado)",
                date: reportToImport.date || new Date().toISOString().split('T')[0],
                description: reportToImport.workDescription || 'Carga externa',
                data: {
                  labor: reportToImport.labor || [],
                  equipment: reportToImport.equipment || [],
                  materials: reportToImport.materials || [],
                  relatedItemNo: reportToImport.relatedItemNo || '',
                  relatedItemDescription: reportToImport.relatedItemDescription || '',
                  relatedItemUnitCost: reportToImport.relatedItemUnitCost || 0,
                  relatedItemAmount: reportToImport.relatedItemAmount || 0,
                  signatures: reportToImport.signatures || { contractor: false, projectChief: false }
                }
              }])
              .select()
              .single();

            if (error) throw error;
            if (data) {
              setReports([data, ...reports]);
              handleSelectReport(data);
              alert("✅ Datos migrados y guardados exitosamente en Force Account 2.");
            }
            if (onDirty) onDirty();
          } else {
            throw new Error("Formato de archivo no reconocido");
          }
        } catch (error) {
          alert("❌ Error: Archivo no válido para FA-2.");
        } finally {
          setLoading(false);
          if (event.target) event.target.value = '';
        }
      };
    }
  };

  const summary = useMemo(() => {
    const rawLabor = ac49Report.labor.reduce((acc, curr) => acc + calculateLaborTotal(curr), 0);
    const rawEq = ac49Report.equipment.reduce((acc, curr) => acc + calculateEquipmentRental(curr.hours, curr.dailyRate || 0), 0);
    const rawMat = ac49Report.materials.reduce((acc, curr) => acc + curr.amount, 0);
    return applyAC51Rules(rawLabor, rawEq, rawMat);
  }, [ac49Report]);

  const sidebarItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Resumen' },
    { id: 'ac49', icon: Clock, label: 'AC-49 (Diario)' },
    { id: 'ac50', icon: Truck, label: 'AC-50 (Equipo)' },
    { id: 'ac51', icon: FileText, label: 'AC-51 (Resumen)' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row gap-8 items-start relative">
        {/* Navigation Sidebar */}
        <div className="w-full lg:w-60 lg:sticky lg:top-4 overflow-y-auto custom-scrollbar">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-[2.5rem] shadow-md border border-slate-100 dark:border-slate-800 space-y-2">
            <div className="px-4 py-3 border-b border-slate-50 dark:border-slate-800/50 mb-2 text-center md:text-left">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600">Force Account 2</h4>
              <p className="text-[9px] text-slate-400 font-bold">M2A System v2.0</p>
            </div>
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (!selectedReportId && item.id !== 'dashboard') {
                    alert('Por favor, seleccione o cree un Force Account en el Resumen.');
                    return;
                  }
                  setActiveTab(item.id);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all group ${
                  activeTab === item.id 
                  ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' 
                  : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-blue-600'
                } ${(!selectedReportId && item.id !== 'dashboard') ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <item.icon className="w-4 h-4" size={16} />
                <span className="font-black text-[10px] uppercase tracking-widest">{item.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-6 p-6 rounded-[2rem] bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
            <p className="text-[9px] text-slate-400 font-bold mb-1 uppercase tracking-widest italic">Selección Actual</p>
            <p className="text-[11px] font-black text-slate-800 dark:text-white truncate uppercase">
               {selectedReportId ? ac49Report.reportNo : "Ninguno seleccionado"}
            </p>
            {selectedReportId && (
              <div className="mt-3 flex items-center gap-2 text-[9px] text-emerald-600 font-black uppercase bg-emerald-50 dark:bg-emerald-900/10 px-2 py-1 rounded-lg w-fit">
                <ShieldCheck className="w-3 h-3" /> Editando
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 w-full min-w-0">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2">
                 {activeTab !== 'dashboard' && (
                   <button onClick={() => setActiveTab('dashboard')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                     <ChevronLeft size={18} />
                   </button>
                 )}
                 <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                  {sidebarItems.find(i => i.id === activeTab)?.label}
                </h2>
              </div>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-1 ml-10">ACT PR • GESTIÓN DE REPORTES</p>
            </div>
            
            {selectedReportId && (
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-all shadow-sm"
                >
                  <Upload size={14} /> Refuerzo JSON
                </button>
                <button 
                  onClick={saveData}
                  className="btn-primary"
                  disabled={loading}
                >
                  <ShieldCheck size={14} /> {loading ? "..." : "Guardar"}
                </button>
              </div>
            )}
          </div>

          <div className="animate-fade-in">
            {activeTab === 'dashboard' && (
              <div className="space-y-8">
                {/* Statistics of selected report IF selected */}
                {selectedReportId ? (
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-top duration-500">
                   {[
                     { title: 'Total Liquidar', value: formatCurrency(summary.grandTotal), icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/10' },
                     { title: 'Renta Equipo', value: formatCurrency(summary.equipment.total), icon: Truck, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/10' },
                     { title: 'Mano de Obra', value: formatCurrency(summary.labor.total), icon: Users, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/10' },
                   ].map((stat, i) => (
                     <div key={i} className="card relative overflow-hidden group border-b-4 border-b-blue-500">
                       <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                         <stat.icon className="w-20 h-20" />
                       </div>
                       <div className={`w-12 h-12 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center mb-6`}>
                         <stat.icon size={24} />
                       </div>
                       <p className="label-field mb-0">{stat.title}</p>
                       <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">{stat.value}</p>
                     </div>
                   ))}
                 </div>
                ) : (
                  <div className="bg-blue-600 p-8 rounded-[3rem] text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-blue-500/20">
                     <div className="space-y-2">
                        <h3 className="text-2xl font-black uppercase tracking-tighter">Bienvenido a Force Account 2</h3>
                        <p className="text-blue-100 font-bold text-xs uppercase tracking-widest">Selecciona un registro de la lista o crea uno nuevo para empezar.</p>
                     </div>
                     <button onClick={handleCreateNew} className="px-10 py-5 bg-white text-blue-600 font-black uppercase text-xs tracking-widest rounded-3xl hover:bg-slate-100 transition-all flex items-center gap-2 shadow-2xl">
                        <Plus size={18} /> Crear Nuevo Reporte
                     </button>
                  </div>
                )}

                {/* List of Reports */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-4">
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Briefcase size={12} /> Gestión de Ciclos de Force Account
                    </h4>
                    {!selectedReportId && (
                       <button onClick={() => fileInputRef.current?.click()} className="text-[10px] font-black text-blue-600 uppercase hover:underline">
                          Importar de Respaldo
                       </button>
                    )}
                  </div>
                  
                  {/* Item Lookup Panel in Dashboard when selected */}
                  {selectedReportId && (
                    <div className="p-8 bg-blue-50 dark:bg-blue-900/10 rounded-[2.5rem] border border-blue-100 dark:border-blue-800 shadow-sm animate-in zoom-in-95 duration-300">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-blue-600 rounded-xl text-white">
                          <Calculator size={16} />
                        </div>
                        <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">Partida del Contrato Vinculada</h4>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-2"># de Item (Partida)</label>
                          <input 
                            type="text" 
                            list="contract-items-list"
                            placeholder="Ej: 0627-2001"
                            value={ac49Report.relatedItemNo}
                            onChange={(e) => handleItemLookup(e.target.value)}
                            className="input-field font-mono font-black border-blue-200"
                          />
                          <datalist id="contract-items-list">
                            {contractItems.map(i => (
                              <option key={i.id} value={i.item_num}>{i.description}</option>
                            ))}
                          </datalist>
                        </div>
                        <div className="md:col-span-2 space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-2">Descripción de la Partida</label>
                          <input 
                            type="text" 
                            disabled
                            value={ac49Report.relatedItemDescription}
                            className="input-field bg-slate-100 dark:bg-slate-800/50 cursor-not-allowed opacity-80"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-2">Costo Unitario ($)</label>
                          <input 
                            type="text" 
                            disabled
                            value={formatCurrency(ac49Report.relatedItemUnitCost || 0)}
                            className="input-field bg-slate-100 dark:bg-slate-800/50 cursor-not-allowed text-right font-black"
                          />
                        </div>
                      </div>

                      {ac49Report.relatedItemNo && (
                        <div className="mt-6 pt-6 border-t border-blue-100 dark:border-blue-800/50 flex justify-between items-center">
                          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest italic">Monto Total de Partida en Contrato:</span>
                          <span className="text-lg font-black text-blue-700 dark:text-blue-400 tracking-tighter">{formatCurrency(ac49Report.relatedItemAmount || 0)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {reports.length > 0 ? reports.map(r => (
                      <div 
                        key={r.id} 
                        onClick={() => handleSelectReport(r)}
                        className={`group p-6 rounded-[2.5rem] border-2 transition-all cursor-pointer relative overflow-hidden ${
                          selectedReportId === r.id 
                          ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200' 
                          : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-blue-200'
                        }`}
                      >
                         <div className="flex justify-between items-start">
                            <div className="space-y-1">
                               <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${selectedReportId === r.id ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                    {r.report_no}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-bold">{new Date(r.date).toLocaleDateString('es-ES', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                               </div>
                               <h5 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight line-clamp-1">{r.description || 'Sin descripción'}</h5>
                            </div>
                            <button 
                              onClick={(e) => handleDelete(e, r.id)}
                              className="p-3 bg-red-50 text-red-500 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white"
                            >
                              <Trash2 size={16} />
                            </button>
                         </div>
                         <div className="mt-6 flex justify-between items-center opacity-70">
                            <div className="flex -space-x-2">
                               <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[10px] font-black">FA</div>
                               <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[10px] font-black text-blue-600">02</div>
                            </div>
                            <ChevronRight size={18} className={`transition-transform ${selectedReportId === r.id ? 'translate-x-1 text-blue-600' : 'group-hover:translate-x-1'}`} />
                         </div>
                      </div>
                    )) : (
                      <div className="col-span-full py-20 text-center space-y-4 bg-slate-50/50 dark:bg-slate-900/50 rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                         <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-3xl mx-auto flex items-center justify-center text-slate-300">
                           <Briefcase size={32} />
                         </div>
                         <p className="text-slate-400 font-bold italic text-sm">No hay reportes de Force Account 2 creados.</p>
                         <button onClick={handleCreateNew} className="text-blue-600 font-black uppercase text-[10px] tracking-widest hover:underline">+ Crear primer registro</button>
                      </div>
                    )}
                  </div>
                </div>

                {selectedReportId && (
                  <div className="card bg-slate-900 text-white p-10 border-none shadow-xl rounded-[3rem] relative overflow-hidden group">
                     <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-[80px] -mr-32 -mt-32"></div>
                     <div className="flex flex-col md:flex-row items-center justify-between gap-10 relative z-10">
                        <div className="space-y-2 text-center md:text-left">
                          <h4 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
                            Respaldo del Ciclo Actual
                            <ShieldCheck className="text-blue-500" />
                          </h4>
                          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Descargue los datos de "{ac49Report.reportNo}" por seguridad.</p>
                        </div>
                        <div className="flex gap-4">
                          <button 
                            onClick={exportData}
                            className="px-8 py-4 bg-white text-slate-900 font-black text-[11px] uppercase tracking-widest rounded-2xl hover:scale-105 transition-all shadow-lg"
                          >
                            <Download size={14} className="inline mr-2" /> Exportar JSON
                          </button>
                        </div>
                     </div>
                  </div>
                )}
              </div>
            )}

            {!selectedReportId && activeTab != 'dashboard' ? (
              <div className="card py-32 text-center animate-in zoom-in duration-300">
                 <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase mb-4">Acceso Restringido</h3>
                 <p className="text-slate-400 font-bold text-sm mb-8 italic">Primero debe seleccionar un reporte del listado en el Dashboard.</p>
                 <button onClick={() => setActiveTab('dashboard')} className="btn-primary">Ir al Dashboard</button>
              </div>
            ) : (
              <>
                {activeTab === 'ac49' && (
                  <div className="card space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 bg-slate-50 dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800">
                      <div className="space-y-2">
                        <label className="label-field flex items-center gap-2"><Clock size={12} className="text-blue-600" /> Fecha del Informe</label>
                        <input 
                          type="date" 
                          value={ac49Report.date}
                          onChange={(e) => setAc49Report({...ac49Report, date: e.target.value})}
                          className="input-field"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="label-field">Número de Referencia</label>
                        <input 
                          type="text" 
                          value={ac49Report.reportNo}
                          onChange={(e) => setAc49Report({...ac49Report, reportNo: e.target.value})}
                          className="input-field font-black uppercase"
                          placeholder="Ej: MAR-01"
                        />
                      </div>
                    </div>

                    <div className="space-y-12">
                      <EditableTable<LaborEntry>
                        title="A. PERSONAL (Mano de Obra Directa)"
                        columns={[
                          { header: 'Empleado', key: 'employeeName', type: 'text' },
                          { header: 'SS (Últ. 4)', key: 'ssLast4', type: 'text' },
                          { header: 'Clasificación', key: 'classification', type: 'text' },
                          { header: 'H. Reg', key: 'hoursReg', type: 'number' },
                          { header: 'H. 1.5', key: 'hours15', type: 'number' },
                          { header: 'H. 2.0', key: 'hours20', type: 'number' },
                          { header: '$ / Hora', key: 'hourlyRate', type: 'number' },
                        ]}
                        data={ac49Report.labor}
                        onAdd={() => setAc49Report({...ac49Report, labor: [...ac49Report.labor, { id: Date.now().toString(), employeeName: '', ssLast4: '', classification: '', hoursReg: 0, hours15: 0, hours20: 0, hourlyRate: 0 }]})}
                        onRemove={(idx) => setAc49Report({...ac49Report, labor: ac49Report.labor.filter((_, i) => i !== idx)})}
                        onChange={(idx, key, val) => {
                          const newLabor = [...ac49Report.labor];
                          (newLabor[idx] as any)[key] = val;
                          setAc49Report({...ac49Report, labor: newLabor});
                        }}
                      />

                      <EditableTable<EquipmentEntry>
                        title="B. EQUIPO EN USO"
                        columns={[
                          { header: 'Descripción / Máquina', key: 'description', type: 'text' },
                          { header: 'Modelo', key: 'model', type: 'text' },
                          { header: 'Tarifa Diaria ($)', key: 'dailyRate', type: 'number' },
                          { header: 'Horas', key: 'hours', type: 'number' },
                        ]}
                        data={ac49Report.equipment}
                        onAdd={() => setAc49Report({...ac49Report, equipment: [...ac49Report.equipment, { id: Date.now().toString(), description: '', model: '', capacity: '', isRented: false, hours: 0, dailyRate: 0 }]})}
                        onRemove={(idx) => setAc49Report({...ac49Report, equipment: ac49Report.equipment.filter((_, i) => i !== idx)})}
                        onChange={(idx, key, val) => {
                          const newEq = [...ac49Report.equipment];
                          (newEq[idx] as any)[key] = val;
                          setAc49Report({...ac49Report, equipment: newEq});
                        }}
                      />

                      <div className="space-y-3">
                        <label className="label-field">Descripción Detallada del Trabajo</label>
                        <textarea 
                          value={ac49Report.workDescription}
                          onChange={(e) => setAc49Report({...ac49Report, workDescription: e.target.value})}
                          placeholder="Indique los trabajos específicos realizados..."
                          className="input-field min-h-[150px] font-bold text-slate-800 dark:text-white p-6"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'ac50' && (
                  <div className="card space-y-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
                      <div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                          <Truck className="text-amber-500" /> AC-50: Resumen de Renta
                        </h3>
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Acumulado del ciclo {ac49Report.reportNo}</p>
                      </div>
                      <div className="flex items-center gap-3">
                         <button 
                           onClick={() => setShowEqSearcher(!showEqSearcher)}
                           className={`btn-secondary text-[9px] px-4 py-2 border-2 ${showEqSearcher ? 'bg-amber-50 border-amber-200 text-amber-600' : ''}`}
                         >
                           {showEqSearcher ? 'OCULTAR BUSCADOR' : 'BUSCADOR DE TARIFAS'}
                         </button>
                         <div className="text-right ml-4">
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Total Renta Estimado</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">{formatCurrency(summary.equipment.subtotal)}</p>
                         </div>
                      </div>
                    </div>

                    {showEqSearcher && (
                      <div className="p-8 bg-amber-50/50 dark:bg-amber-900/10 rounded-[2.5rem] border-2 border-amber-100/50 dark:border-amber-800/30 animate-in slide-in-from-top duration-300">
                        <div className="flex flex-col md:flex-row gap-6 items-end mb-8">
                          <div className="flex-1 space-y-2">
                            <label className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest block px-2">¿Qué equipo buscas?</label>
                            <div className="relative group">
                              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-400 group-hover:text-amber-600 transition-colors" size={16} />
                              <input 
                                type="text" 
                                placeholder="Escribe el nombre del equipo (ej: Excavadora, Pickup...)" 
                                value={eqSearch}
                                onChange={(e) => setEqSearch(e.target.value)}
                                className="input-field pl-12 bg-white dark:bg-slate-900 border-amber-100 dark:border-amber-800/50 focus:border-amber-400 focus:ring-amber-400/20"
                              />
                            </div>
                          </div>
                          {eqSearch && (
                             <button onClick={() => setEqSearch("")} className="btn-secondary py-3 text-xs bg-white dark:bg-slate-900">Limpiar</button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                           {PREDEFINED_EQUIPMENT_RATES
                             .filter(item => 
                               item.name.toLowerCase().includes(eqSearch.toLowerCase()) || 
                               item.model.toLowerCase().includes(eqSearch.toLowerCase())
                             )
                             .map((item, idx) => (
                               <div key={idx} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-amber-100 dark:border-amber-800 hover:shadow-xl hover:shadow-amber-500/5 transition-all group relative overflow-hidden">
                                  <div className="absolute top-0 right-0 w-16 h-16 bg-amber-50 dark:bg-amber-900/10 rounded-bl-[2rem] flex items-center justify-center">
                                    <DollarSign size={16} className="text-amber-500" />
                                  </div>
                                  <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight pr-8">{item.name}</h4>
                                  <p className="text-[10px] text-slate-400 font-bold mb-6 italic truncate">{item.model}</p>
                                  
                                  <div className="space-y-3">
                                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl">
                                      <span className="text-[9px] font-black text-slate-400 uppercase">Tarifa Diaria</span>
                                      <span className="text-xs font-black text-amber-600">{formatCurrency(item.daily)}/d</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3">
                                      <span className="text-[8px] font-bold text-slate-400 uppercase italic">Estimado Semanal</span>
                                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{formatCurrency(item.weekly)}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3">
                                      <span className="text-[8px] font-bold text-slate-400 uppercase italic">Estimado Mensual</span>
                                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{formatCurrency(item.monthly)}</span>
                                    </div>
                                  </div>
                                  
                                  <button 
                                    className="w-full mt-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all shadow-lg shadow-amber-500/10 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0"
                                    onClick={() => {
                                      // Optional: Auto-add logic could go here
                                      alert(`Tarifa diaria sugerida para ${item.name}: ${formatCurrency(item.daily)}. Úselo como referencia en la pestaña AC-49.`);
                                    }}
                                  >
                                    Ver Detalles
                                  </button>
                               </div>
                             ))}
                        </div>
                        
                        <p className="text-[9px] text-slate-400 font-bold italic mt-8 text-center uppercase tracking-widest">
                          * Precios estimados basados en promedios de mercado 2024. Sujeto a cambios y negociación.
                        </p>
                      </div>
                    )}

                    <div className="overflow-x-auto rounded-[2.5rem] border border-slate-100 dark:border-slate-800 bg-slate-50/30">
                       <table className="w-full text-left">
                         <thead>
                           <tr className="bg-white dark:bg-slate-900 text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800">
                             <th className="px-8 py-5">Equipo / Maquinaria</th>
                             <th className="px-8 py-5">Modelo</th>
                             <th className="px-8 py-5 text-center">Horas</th>
                             <th className="px-8 py-5 text-right">Monto</th>
                           </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                           {ac49Report.equipment.length > 0 ? ac49Report.equipment.map((eq) => (
                             <tr key={eq.id} className="hover:bg-white dark:hover:bg-slate-800/50 transition-colors">
                               <td className="px-8 py-6 text-slate-900 dark:text-white font-black text-[11px] uppercase">{eq.description}</td>
                               <td className="px-8 py-6 text-slate-400 font-bold text-[10px]">{eq.model}</td>
                               <td className="px-8 py-6 text-center text-slate-900 dark:text-white font-black">{eq.hours}</td>
                               <td className="px-8 py-6 text-right text-emerald-600 font-black text-sm">
                                 {formatCurrency(calculateEquipmentRental(eq.hours, eq.dailyRate || 0))}
                               </td>
                             </tr>
                           )) : (
                             <tr>
                               <td colSpan={4} className="px-8 py-20 text-center text-slate-300 italic font-bold">Inicie añadiendo equipos en la pestaña AC-49.</td>
                             </tr>
                           )}
                         </tbody>
                       </table>
                    </div>
                  </div>
                )}

                {activeTab === 'ac51' && (
                  <div className="space-y-10">
                    <div className="card border-none shadow-none bg-transparent p-0">
                      <div className="grid grid-cols-1 gap-8">
                        {/* Mano de Obra Details */}
                        <div className="p-10 rounded-[3rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xl relative overflow-hidden">
                           <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full -mr-16 -mt-16 group-hover:bg-blue-600/10 transition-colors"></div>
                           <div className="flex items-center gap-3 mb-10">
                             <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-blue-600">
                               <Users size={20} />
                             </div>
                             <div>
                               <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">I. Resumen de Mano de Obra</h4>
                               <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Incluye beneficios ACT</p>
                             </div>
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                              <div className="space-y-1">
                                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Salarios Directos</p>
                                 <p className="text-xl font-black text-slate-900 dark:text-white">{formatCurrency(summary.labor.subtotal)}</p>
                              </div>
                              <div className="space-y-1">
                                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">(+) 20% Margen</p>
                                 <p className="text-xl font-black text-slate-400 italic">+{formatCurrency(summary.labor.plus20 - summary.labor.subtotal)}</p>
                              </div>
                              <div className="space-y-1 pt-4 md:pt-0">
                                 <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">TOTAL MO LIQUIDABLE</p>
                                 <p className="text-2xl font-black text-blue-600 drop-shadow-sm">{formatCurrency(summary.labor.total)}</p>
                              </div>
                           </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {/* Equipo Summary */}
                          <div className="p-10 rounded-[3rem] bg-amber-50/30 dark:bg-amber-900/5 border border-amber-100 dark:border-amber-900/20 shadow-lg">
                            <div className="flex items-center gap-3 mb-8">
                               <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-600">
                                 <Truck size={20} />
                               </div>
                               <h4 className="text-sm font-black text-amber-900 dark:text-amber-100 uppercase tracking-tight">II. Maquinaria</h4>
                            </div>
                            <div className="space-y-6">
                              <div className="flex justify-between items-center text-[10px] font-bold text-amber-800/60 uppercase">
                                <span>Renta Base AC-50</span>
                                <span>{formatCurrency(summary.equipment.subtotal)}</span>
                              </div>
                              <div className="flex justify-between items-center text-[10px] font-bold text-amber-600 uppercase italic">
                                <span>(+) 15% Ben. Ind.</span>
                                <span>{formatCurrency(summary.equipment.bi)}</span>
                              </div>
                              <div className="pt-4 border-t border-amber-200/50 flex justify-between items-center">
                                <span className="font-black text-amber-900 dark:text-amber-100 text-xs uppercase tracking-widest">Total Equipo</span>
                                <span className="text-2xl font-black text-amber-600">{formatCurrency(summary.equipment.total)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Materiales Summary */}
                          <div className="p-10 rounded-[3rem] bg-emerald-50/30 dark:bg-emerald-900/5 border border-emerald-100 dark:border-emerald-900/20 shadow-lg">
                            <div className="flex items-center gap-3 mb-8">
                               <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600">
                                 <ShieldCheck size={20} />
                               </div>
                               <h4 className="text-sm font-black text-emerald-900 dark:text-emerald-100 uppercase tracking-tight">III. Materiales</h4>
                            </div>
                            <div className="space-y-6">
                              <div className="flex justify-between items-center text-[10px] font-bold text-emerald-800/60 uppercase">
                                <span>Costo Materiales</span>
                                <span>{formatCurrency(summary.materials.subtotal)}</span>
                              </div>
                              <div className="flex justify-between items-center text-[10px] font-bold text-emerald-600 uppercase italic">
                                <span>(+) 15% Ben. Ind.</span>
                                <span>{formatCurrency(summary.materials.bi)}</span>
                              </div>
                              <div className="pt-4 border-t border-emerald-200/50 flex justify-between items-center">
                                <span className="font-black text-emerald-900 dark:text-emerald-100 text-xs uppercase tracking-widest">Total Materiales</span>
                                <span className="text-2xl font-black text-emerald-600">{formatCurrency(summary.materials.total)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Grand Total Call to Action */}
                        <div className="mt-6 p-12 rounded-[4rem] bg-blue-600 text-white text-center shadow-2xl shadow-blue-500/30 relative overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700"></div>
                          <div className="relative z-10">
                            <p className="text-blue-100 font-black uppercase tracking-[0.5em] text-[10px] mb-6">Monto Certificable Final - ACT PR</p>
                            <p className="text-7xl font-black text-white tracking-tighter drop-shadow-2xl">
                              {formatCurrency(summary.grandTotal)}
                            </p>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12">
                               <button className="px-12 py-5 bg-white text-blue-600 font-black uppercase text-xs tracking-widest rounded-[2rem] hover:bg-slate-50 transition-all shadow-2xl hover:scale-105 active:scale-95">
                                 Generar AC-51 (PDF)
                               </button>
                               <button onClick={exportData} className="px-10 py-5 bg-blue-500/20 text-white border border-white/20 font-black uppercase text-xs tracking-widest rounded-[2rem] hover:bg-white/10 transition-all">
                                 Exportar Respaldo
                               </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <input ref={fileInputRef} id="import-fa2-json" type="file" accept=".json" className="hidden" onChange={importData} />
    </div>
  );
});

export default ForceAccount2Form;
