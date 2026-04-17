"use client";

import React, { useState, useMemo, useRef, forwardRef, useImperativeHandle, useEffect } from "react";
import { 
  FileText, Truck, Users, ChevronRight, LayoutDashboard,
  Info, CheckCircle2, Clock, Plus, Trash2, DollarSign,
  Download, Upload, ShieldCheck, Briefcase, Calculator, ChevronLeft
} from 'lucide-react';
import { Project, AC49Report, LaborEntry, EquipmentEntry } from '../types/fa2';
import { EditableTable } from './EditableTable';
import { calculateLaborTotal, applyAC51Rules, calculateEquipmentRental } from '../lib/fa2Calculations';
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";

const AboutModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => (
  isOpen ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 text-center shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md">
        <div className="mb-6 mx-auto w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-3xl flex items-center justify-center text-blue-600">
          <Info className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black mb-2 text-slate-900 dark:text-white uppercase tracking-tight">Sobre el Sistema</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm font-medium leading-relaxed">
          Sistema Digital para la Administración y Liquidación de trabajos por Administración Delegada (Force Account 2). Cumple con las normativas de la ACT.
        </p>
        <div className="py-4 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Diseñador y Arquitecto</p>
          <p className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Ing. Enrique Saavedra Sada, PE</p>
        </div>
        <button 
          onClick={onClose}
          className="mt-8 w-full btn-primary"
        >
          Cerrar
        </button>
      </div>
    </div>
  ) : null
);

const ForceAccount2Form = forwardRef(function ForceAccount2Form({ projectId }: { projectId?: string }, ref) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Data State
  const [project, setProject] = useState<Project>({
    id: projectId || '1',
    number: 'PR-2024-ACT-001',
    name: 'Cargando...',
    municipality: 'San Juan',
    contractor: 'Saavedra Construction Corp',
    itemNumber: '201.1',
    forceAccountNo: 'FA-01'
  });

  const [ac49Report, setAc49Report] = useState<AC49Report>({
    id: 'r1',
    projectId: projectId || '1',
    date: new Date().toISOString().split('T')[0],
    reportNo: '001',
    totalPages: 1,
    labor: [],
    equipment: [],
    materials: [],
    workDescription: '',
    signatures: { contractor: false, projectChief: false }
  });

  useEffect(() => {
     if (projectId) {
         const fetchProject = async () => {
             const { data } = await supabase.from("projects").select("name, num_act, contractor_name").eq("id", projectId).single();
             if (data) {
                 setProject(prev => ({
                     ...prev,
                     name: data.name,
                     number: data.num_act,
                     contractor: data.contractor_name || "M2A Group"
                 }));
             }
         };
         fetchProject();
     }
  }, [projectId]);

  useImperativeHandle(ref, () => ({
    save: async () => {
       console.log("Saving FA2 data...");
    }
  }));

  const exportData = () => {
    const dataStr = JSON.stringify({ project, ac49Report }, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `ForceAccount2_${project.number}_${ac49Report.reportNo}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const files = event.target.files;
    if (files && files[0]) {
      fileReader.readAsText(files[0], "UTF-8");
      fileReader.onload = e => {
        try {
          const content = JSON.parse(e.target?.result as string);
          if (content.project && content.ac49Report) {
            setProject(content.project);
            setAc49Report(content.ac49Report);
            alert("✅ Datos importados correctamente.");
          }
        } catch (error) {
          alert("❌ Error: Archivo no válido.");
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
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'ac49', icon: Clock, label: 'AC-49 (Diario)' },
    { id: 'ac50', icon: Truck, label: 'AC-50 (Equipo)' },
    { id: 'ac51', icon: FileText, label: 'AC-51 (Resumen)' },
    { id: 'about', icon: Info, label: 'Diseñador' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row gap-8 items-start relative">
        {/* Navigation Sidebar - Matching main app style */}
        <div className="w-full lg:w-60 lg:sticky lg:top-4 overflow-y-auto custom-scrollbar">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-[2.5rem] shadow-md border border-slate-100 dark:border-slate-800 space-y-2">
            <div className="px-4 py-3 border-b border-slate-50 dark:border-slate-800/50 mb-2">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600">Módulo FA-2</h4>
              <p className="text-[9px] text-slate-400 font-bold">Administración Delegada</p>
            </div>
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'about') setIsAboutOpen(true);
                  else setActiveTab(item.id);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all group ${
                  activeTab === item.id 
                  ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' 
                  : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-blue-600'
                }`}
              >
                <item.icon className="w-4 h-4" size={16} />
                <span className="font-black text-[10px] uppercase tracking-widest">{item.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-6 p-6 rounded-[2rem] bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
            <p className="text-[9px] text-slate-400 font-bold mb-1 uppercase tracking-widest">Proyecto Activo</p>
            <p className="text-[11px] font-black text-slate-800 dark:text-white truncate uppercase tracking-tight">{project.name}</p>
            <div className="mt-3 flex items-center gap-2 text-[9px] text-blue-600 font-black uppercase bg-blue-50 dark:bg-blue-900/10 px-2 py-1 rounded-lg w-fit">
              <ShieldCheck className="w-3 h-3" />
              Verificado ACT
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 w-full min-w-0">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
               <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                {sidebarItems.find(i => i.id === activeTab)?.label}
              </h2>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">FORCE ACCOUNT 2 • M2A SYSTEM</p>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-all shadow-sm"
              >
                <Upload size={14} /> Importar
              </button>
              <button 
                onClick={exportData}
                className="btn-primary"
              >
                <Download size={14} /> Exportar
              </button>
            </div>
          </div>

          <div className="animate-fade-in">
            {activeTab === 'dashboard' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[
                    { title: 'Total Liquidar', value: formatCurrency(summary.grandTotal), icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/10' },
                    { title: 'Renta Equipo', value: formatCurrency(summary.equipment.total), icon: Truck, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/10' },
                    { title: 'Mano de Obra', value: formatCurrency(summary.labor.total), icon: Users, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/10' },
                  ].map((stat, i) => (
                    <div key={i} className="card relative overflow-hidden group">
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

                <div className="card bg-blue-600 text-white p-10 border-none shadow-xl shadow-blue-500/20 rounded-[3rem] relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-[80px] -mr-32 -mt-32"></div>
                   <div className="flex flex-col md:flex-row items-center justify-between gap-10 relative z-10">
                      <div className="space-y-2 text-center md:text-left">
                        <h4 className="text-2xl font-black uppercase tracking-tight">Consolidación de Informes</h4>
                        <p className="text-blue-100/80 text-xs font-bold uppercase tracking-widest">Gestione sus copias de seguridad en formato JSON de forma local y segura.</p>
                      </div>
                      <div className="flex gap-4">
                        <button 
                          onClick={exportData}
                          className="px-8 py-4 bg-white text-blue-600 font-black text-[11px] uppercase tracking-widest rounded-2xl hover:bg-slate-50 transition-all shadow-lg shadow-black/10"
                        >
                          Crear Backup Ahora
                        </button>
                      </div>
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'ac49' && (
              <div className="card space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-4 bg-slate-50 dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800">
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
                    <label className="label-field">Informe No.</label>
                    <input 
                      type="text" 
                      value={ac49Report.reportNo}
                      onChange={(e) => setAc49Report({...ac49Report, reportNo: e.target.value})}
                      className="input-field font-black"
                      placeholder="Ej: 001"
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
                    title="B. EQUIPO (Rental Book Rules)"
                    columns={[
                      { header: 'Descripción / Máquina', key: 'description', type: 'text' },
                      { header: 'Modelo', key: 'model', type: 'text' },
                      { header: 'Reserva Diario ($)', key: 'dailyRate', type: 'number' },
                      { header: 'Horas Uso', key: 'hours', type: 'number' },
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
                    <label className="label-field">Detalle del Trabajo Ejecutado</label>
                    <textarea 
                      value={ac49Report.workDescription}
                      onChange={(e) => setAc49Report({...ac49Report, workDescription: e.target.value})}
                      placeholder="Describa los trabajos realizados hoy..."
                      className="input-field min-h-[150px] font-bold text-slate-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ac50' && (
              <div className="card space-y-8">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                    <Truck className="text-amber-500" /> AC-50: Resumen de Renta de Equipo
                  </h3>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Acumulado mensual para liquidación</p>
                </div>

                <div className="overflow-x-auto rounded-[2rem] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                   <table className="w-full text-left">
                     <thead>
                       <tr className="bg-white dark:bg-slate-900 text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800">
                         <th className="px-8 py-5">Descripción del Equipo</th>
                         <th className="px-8 py-5">Modelo</th>
                         <th className="px-8 py-5 text-center">Horas</th>
                         <th className="px-8 py-5 text-right">Monto Estimado</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                       {ac49Report.equipment.length > 0 ? ac49Report.equipment.map((eq) => (
                         <tr key={eq.id} className="hover:bg-white dark:hover:bg-slate-800/80 transition-colors">
                           <td className="px-8 py-6 text-slate-900 dark:text-white font-black text-[11px] uppercase tracking-wide">{eq.description}</td>
                           <td className="px-8 py-6 text-slate-400 font-bold text-[10px]">{eq.model}</td>
                           <td className="px-8 py-6 text-center text-slate-900 dark:text-white font-black">{eq.hours}</td>
                           <td className="px-8 py-6 text-right text-emerald-600 font-black text-sm">
                             {formatCurrency(calculateEquipmentRental(eq.hours, eq.dailyRate || 0))}
                           </td>
                         </tr>
                       )) : (
                         <tr>
                           <td colSpan={4} className="px-8 py-16 text-center text-slate-400 italic font-bold">Sin equipos registrados.</td>
                         </tr>
                       )}
                     </tbody>
                     <tfoot className="bg-slate-100/50 dark:bg-slate-800/50">
                        <tr>
                           <td colSpan={3} className="px-8 py-6 text-right text-slate-400 font-black uppercase text-[10px] tracking-widest">Subtotal Renta Equipo</td>
                           <td className="px-8 py-6 text-right text-slate-900 dark:text-white font-black text-xl">{formatCurrency(summary.equipment.subtotal)}</td>
                        </tr>
                     </tfoot>
                   </table>
                </div>
              </div>
            )}

            {activeTab === 'ac51' && (
              <div className="space-y-10">
                <div className="card">
                   <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2 mb-8">
                    <div className="w-1.5 h-8 bg-blue-600 rounded-full"></div>
                    Liquidación General de Force Account
                  </h3>

                  <div className="grid grid-cols-1 gap-6">
                    <div className="p-8 rounded-[2rem] bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mb-8">I. Mano de Obra</p>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center text-slate-500 font-bold text-[11px] uppercase tracking-widest">
                          <span>Salarios Directos</span>
                          <span className="text-slate-900 dark:text-white font-black">{formatCurrency(summary.labor.subtotal)}</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-400 font-bold text-[10px] uppercase tracking-widest italic">
                          <span>(+) 20% Costos Indirectos</span>
                          <span>{formatCurrency(summary.labor.plus20 - summary.labor.subtotal)}</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-400 font-bold text-[10px] uppercase tracking-widest italic">
                          <span>(+) 6% Beneficio Industrial</span>
                          <span className="text-blue-600">{formatCurrency(summary.labor.bi)}</span>
                        </div>
                        <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-slate-900 dark:text-white font-black text-2xl uppercase tracking-tighter">
                          <span>TOTAL MO</span>
                          <span className="text-emerald-600">{formatCurrency(summary.labor.total)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-8 rounded-[2rem] bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                        <p className="text-[10px] font-black text-amber-600 uppercase tracking-[0.3em] mb-8">II. Renta de Equipo</p>
                        <div className="space-y-4">
                          <div className="flex justify-between text-slate-500 font-bold text-[10px] uppercase tracking-widest">
                            <span>Subtotal AC-50</span>
                            <span className="text-slate-900 dark:text-white font-black">{formatCurrency(summary.equipment.subtotal)}</span>
                          </div>
                          <div className="flex justify-between text-slate-400 font-bold text-[9px] uppercase tracking-widest italic">
                            <span>(+) 15% Ben. Ind.</span>
                            <span className="text-amber-600">{formatCurrency(summary.equipment.bi)}</span>
                          </div>
                          <div className="pt-5 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-slate-900 dark:text-white font-black text-lg uppercase tracking-widest">
                            <span>TOTAL EQUIPO</span>
                            <span className="text-amber-600">{formatCurrency(summary.equipment.total)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="p-8 rounded-[2rem] bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.3em] mb-8">III. Materiales</p>
                        <div className="space-y-4">
                          <div className="flex justify-between text-slate-500 font-bold text-[10px] uppercase tracking-widest">
                            <span>Subtotal Materiales</span>
                            <span className="text-slate-900 dark:text-white font-black">{formatCurrency(summary.materials.subtotal)}</span>
                          </div>
                          <div className="flex justify-between text-slate-400 font-bold text-[9px] uppercase tracking-widest italic">
                            <span>(+) 15% Ben. Ind.</span>
                            <span className="text-emerald-600">{formatCurrency(summary.materials.bi)}</span>
                          </div>
                          <div className="pt-5 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-slate-900 dark:text-white font-black text-lg uppercase tracking-widest">
                            <span>TOTAL MAT.</span>
                            <span className="text-emerald-600">{formatCurrency(summary.materials.total)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 p-12 rounded-[3.5rem] bg-blue-600 text-white text-center shadow-2xl shadow-blue-500/30">
                      <p className="text-blue-100 font-black uppercase tracking-[0.4em] text-[10px] mb-4">Monto total a certificar por ACT</p>
                      <p className="text-6xl font-black text-white tracking-tighter bg-clip-text">
                        {formatCurrency(summary.grandTotal)}
                      </p>
                      <button className="mt-10 px-12 py-4 bg-white text-blue-600 font-black uppercase text-xs tracking-widest rounded-2xl hover:bg-slate-50 transition-all shadow-xl hover:scale-105 active:scale-95">
                        GENERAR CERTIFICACIÓN AC-51 (PDF)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <input id="import-fa2-json" type="file" accept=".json" className="hidden" onChange={importData} />
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </div>
  );
});

export default ForceAccount2Form;
