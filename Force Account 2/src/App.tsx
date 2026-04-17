import React, { useState, useMemo, useRef } from 'react';
import { 
  FileText, 
  Settings, 
  Users, 
  Truck, 
  Package, 
  ChevronRight, 
  LayoutDashboard,
  Info,
  CheckCircle2,
  Clock,
  ExternalLink,
  Plus,
  Trash2,
  DollarSign,
  Briefcase,
  Calendar,
  Layers,
  Download,
  Upload,
  Save,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Project, AC49Report, LaborEntry, EquipmentEntry, MaterialEntry } from './types';
import { EditableTable } from './components/EditableTable';
import { calculateLaborTotal, applyAC51Rules, calculateEquipmentRental } from './lib/calculations';

const AboutModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-md p-8 glass-accent rounded-2xl text-center shadow-2xl shadow-blue-500/10 border border-white/10"
        >
          <div className="mb-6 mx-auto w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center border border-blue-500/30">
            <Info className="w-10 h-10 text-blue-400" />
          </div>
          <h2 className="text-3xl font-bold mb-2 text-white">Sobre el Sistema</h2>
          <p className="text-slate-400 mb-8 leading-relaxed">
            Sistema Digital para la Administración y Liquidación de trabajos por Administración Delegada (Force Account). Cumple estrictamente con las normativas de la ACT.
          </p>
          <div className="py-4 border-t border-white/10 text-center">
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Diseñador y Arquitecto</p>
            <p className="text-xl font-bold text-white">Ing. Enrique Saavedra Sada, PE</p>
          </div>
          <button 
            onClick={onClose}
            className="mt-8 w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all font-bold shadow-lg shadow-blue-900/40"
          >
            Cerrar
          </button>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Data State
  const [project, setProject] = useState<Project>({
    id: '1',
    number: 'PR-2024-ACT-001',
    name: 'Reparación Puente Rio Grande',
    municipality: 'San Juan',
    contractor: 'Saavedra Construction Corp',
    itemNumber: '201.1',
    forceAccountNo: 'FA-01'
  });

  const [ac49Report, setAc49Report] = useState<AC49Report>({
    id: 'r1',
    projectId: '1',
    date: new Date().toISOString().split('T')[0],
    reportNo: '001',
    totalPages: 1,
    labor: [],
    equipment: [],
    materials: [],
    workDescription: '',
    signatures: { contractor: false, projectChief: false }
  });

  // Export Data Function
  const exportData = () => {
    const dataStr = JSON.stringify({ project, ac49Report }, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `ForceAccount_${project.number}_${ac49Report.reportNo}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // Import Data Function
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

  // Derived Values for AC-51 and AC-50
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
    <div className="flex h-screen bg-brand-dark overflow-hidden font-sans">
      {/* Hidden Input for Import */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={importData} 
        className="hidden" 
        accept=".json"
      />

      {/* Sidebar */}
      <aside className="w-72 glass border-r border-white/5 flex flex-col p-6 m-4 rounded-3xl z-10">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/40">
            <Briefcase className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight text-white">ForceAccount</h1>
            <p className="text-[10px] text-blue-400 uppercase font-bold tracking-widest -mt-1">ACT System v1.0</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'about') setIsAboutOpen(true);
                else setActiveTab(item.id);
              }}
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group ${
                activeTab === item.id 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-white' : 'group-hover:text-blue-400'}`} />
              <span className="font-medium text-sm">{item.label}</span>
              {activeTab === item.id && (
                <motion.div layoutId="active" className="ml-auto">
                  <ChevronRight className="w-4 h-4" />
                </motion.div>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-auto p-5 rounded-2xl bg-gradient-to-br from-blue-500/10 to-emerald-500/10 border border-white/5">
          <p className="text-[10px] text-slate-500 font-bold mb-1 uppercase tracking-widest">Proyecto Activo</p>
          <p className="text-sm font-bold text-white truncate mb-1">{project.name}</p>
          <p className="text-[11px] text-blue-400 font-medium">#{project.number}</p>
          <div className="mt-4 flex items-center gap-2 text-[10px] text-emerald-400 font-bold uppercase tracking-tighter">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Sincronizado ACT
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-10 relative">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-4xl font-bold text-white tracking-tight capitalize">
              {sidebarItems.find(i => i.id === activeTab)?.label || 'Sistema'}
            </h2>
            <p className="text-slate-400 mt-1 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              Gestión Gubernamental de Obra Pública
            </p>
          </div>
          <div className="flex gap-4">
            {/* Import/Export Action Buttons */}
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-5 py-3 glass rounded-2xl border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 transition-all shadow-xl font-bold text-sm"
              title="Importar Datos de Force Account"
            >
              <Upload className="w-4 h-4" />
              IMPORTAR
            </button>
            <button 
              onClick={exportData}
              className="flex items-center gap-2 px-5 py-3 glass-accent rounded-2xl border border-blue-500/30 text-blue-400 hover:text-white hover:bg-blue-600 transition-all shadow-xl font-bold text-sm"
              title="Exportar Datos actuales a JSON"
            >
              <Download className="w-4 h-4" />
              EXPORTAR
            </button>
            <div className="px-5 py-3 glass rounded-2xl border border-white/5 flex items-center gap-3 shadow-xl">
              <div className="w-8 h-8 rounded-full bg-blue-500 animate-pulse border-2 border-white/20" />
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Inspector</p>
                <p className="text-sm font-bold text-white">Enrique Saavedra</p>
              </div>
            </div>
          </div>
        </header>

        <div className="page-transition">
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[
                  { title: 'Total Acumulado FA', value: `$${summary.grandTotal.toLocaleString()}`, icon: DollarSign, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                  { title: 'Inversión en Equipo', value: `$${summary.equipment.total.toLocaleString()}`, icon: Truck, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                  { title: 'Mano de Obra (Hoy)', value: `${ac49Report.labor.length} Empleados`, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                ].map((stat, i) => (
                  <div key={i} className="glass p-8 rounded-[32px] group hover:border-blue-500/30 transition-all cursor-pointer relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                      <stat.icon className="w-20 h-20" />
                    </div>
                    <div className={`w-14 h-14 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center mb-6 border border-white/5`}>
                      <stat.icon className="w-7 h-7" />
                    </div>
                    <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider">{stat.title}</p>
                    <p className="text-3xl font-bold text-white mt-1">{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Quick Actions Panel */}
              <div className="glass p-10 rounded-[40px] border-white/5 flex items-center justify-between gap-10">
                 <div className="flex gap-6 items-center">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-3xl flex items-center justify-center border border-blue-500/20">
                       <ShieldCheck className="w-8 h-8 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-white">Control de Datos</h4>
                      <p className="text-slate-400 text-sm">Respalda tus informes diarios o importa previos para seguimiento.</p>
                    </div>
                 </div>
                 <div className="flex gap-4">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="px-8 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl border border-white/10 transition-all"
                    >
                      Cargar Archivo .JSON
                    </button>
                    <button 
                      onClick={exportData}
                      className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-xl shadow-blue-900/40 transition-all"
                    >
                      Descargar Backup
                    </button>
                 </div>
              </div>
            </div>
          )}

          {activeTab === 'ac49' && (
            <div className="space-y-8 max-w-6xl pb-20">
              <section className="glass p-10 rounded-[40px] shadow-2xl relative border-white/5">
                <div className="absolute top-0 right-0 p-10 select-none pointer-events-none opacity-[0.02] font-bold text-9xl">AC-49</div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <Clock className="w-3 h-3 text-blue-500" /> Fecha del Informe
                    </label>
                    <input 
                      type="date" 
                      value={ac49Report.date}
                      onChange={(e) => setAc49Report({...ac49Report, date: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Informe No.</label>
                    <input 
                      type="text" 
                      value={ac49Report.reportNo}
                      onChange={(e) => setAc49Report({...ac49Report, reportNo: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all font-bold placeholder:text-slate-700"
                      placeholder="000"
                    />
                  </div>
                </div>

                <div className="space-y-10">
                  <EditableTable<LaborEntry>
                    title="A. PERSONAL (Mano de Obra)"
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
                    title="B. EQUIPO (Rental Book)"
                    columns={[
                      { header: 'Descripción / Máquina', key: 'description', type: 'text' },
                      { header: 'Modelo', key: 'model', type: 'text' },
                      { header: 'Tarifa Diario ($)', key: 'dailyRate', type: 'number' },
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

                  <div className="space-y-4">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                       <FileText className="w-3 h-3 text-blue-500" /> Detalle del Trabajo Ejecutado
                    </label>
                    <textarea 
                      value={ac49Report.workDescription}
                      onChange={(e) => setAc49Report({...ac49Report, workDescription: e.target.value})}
                      placeholder="Narrativa detallada de los trabajos realizados, localización y justificación..."
                      className="w-full h-40 bg-white/5 border border-white/10 rounded-3xl p-8 text-slate-300 focus:ring-2 focus:ring-blue-500/50 outline-none resize-none transition-all placeholder:text-slate-700 leading-relaxed font-medium"
                    />
                  </div>

                  <div className="flex flex-col md:flex-row justify-between items-center gap-6 mt-10 p-8 rounded-3xl bg-blue-500/5 border border-blue-500/10">
                    <div className="flex gap-4">
                      <button 
                        onClick={() => setAc49Report({...ac49Report, signatures: {...ac49Report.signatures, contractor: !ac49Report.signatures.contractor}})}
                        className={`flex items-center gap-3 px-6 py-3 rounded-2xl transition-all font-bold ${ac49Report.signatures.contractor ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-900/40' : 'bg-white/5 text-slate-500 border border-white/5 hover:bg-white/10'}`}
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        Rep. Contratista
                      </button>
                      <button 
                        onClick={() => setAc49Report({...ac49Report, signatures: {...ac49Report.signatures, projectChief: !ac49Report.signatures.projectChief}})}
                        className={`flex items-center gap-3 px-6 py-3 rounded-2xl transition-all font-bold ${ac49Report.signatures.projectChief ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-900/40' : 'bg-white/5 text-slate-500 border border-white/5 hover:bg-white/10'}`}
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        Jefe del Proyecto (ACT)
                      </button>
                    </div>
                    <button className="w-full md:w-auto px-12 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-2xl shadow-blue-900/60 transition-all transform hover:scale-105 active:scale-95">
                      CERTIFICAR E IMPRIMIR
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'ac50' && (
            <div className="space-y-8 max-w-6xl pb-20">
              <section className="glass p-12 rounded-[40px] shadow-2xl relative border-white/5 overflow-hidden">
                <div className="absolute top-0 right-0 p-10 opacity-[0.03] font-bold text-9xl">AC-50</div>
                <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                  <Truck className="w-8 h-8 text-amber-500" />
                  Resumen Mensual de Renta de Equipo
                </h3>
                <p className="text-slate-400 mb-10 max-w-2xl">Este módulo resume el uso diario acumulado y aplica las tarifas según el periodo de posesión en obra (diario/semanal/mensual).</p>

                <div className="overflow-x-auto rounded-3xl border border-white/10 bg-white/5">
                   <table className="w-full text-left">
                     <thead>
                       <tr className="bg-white/5 text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] border-b border-white/5">
                         <th className="px-8 py-5">Descripción del Equipo</th>
                         <th className="px-8 py-5">Modelo</th>
                         <th className="px-8 py-5 text-center">Horas Totales</th>
                         <th className="px-8 py-5 text-center">Tarifa Aplicada</th>
                         <th className="px-8 py-5 text-right">Monto Estimado</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-white/5">
                       {ac49Report.equipment.length > 0 ? ac49Report.equipment.map((eq) => (
                         <tr key={eq.id} className="hover:bg-white/5 transition-colors">
                           <td className="px-8 py-6 text-white font-medium">{eq.description}</td>
                           <td className="px-8 py-6 text-slate-400">{eq.model}</td>
                           <td className="px-8 py-6 text-center text-white font-bold">{eq.hours} hrs</td>
                           <td className="px-8 py-6 text-center">
                              <span className="px-3 py-1 bg-amber-500/10 text-amber-400 text-[10px] font-bold rounded-full border border-amber-500/20 uppercase">Diaria</span>
                           </td>
                           <td className="px-8 py-6 text-right text-emerald-400 font-bold">
                             ${calculateEquipmentRental(eq.hours, eq.dailyRate || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                           </td>
                         </tr>
                       )) : (
                         <tr>
                           <td colSpan={5} className="px-8 py-20 text-center text-slate-500">No hay equipos registrados en el informe AC-49 activo.</td>
                         </tr>
                       )}
                     </tbody>
                     <tfoot className="bg-white/5">
                        <tr>
                           <td colSpan={4} className="px-8 py-6 text-right text-slate-500 font-bold uppercase tracking-widest text-[10px]">Subtotal Renta Equipo (AC-50 Parte B)</td>
                           <td className="px-8 py-6 text-right text-white font-bold text-xl">${summary.equipment.subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        </tr>
                     </tfoot>
                   </table>
                </div>

                <div className="mt-10 flex justify-end gap-4">
                   <button className="px-8 py-3 glass rounded-xl text-slate-300 font-bold hover:bg-white/10 transition-all flex items-center gap-2">
                     <Layers className="w-4 h-4" /> Comparar Periodos
                   </button>
                   <button className="px-8 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow-xl shadow-amber-900/40 transition-all flex items-center gap-2">
                     <FileText className="w-4 h-4" /> Exportar AC-50
                   </button>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'ac51' && (
            <div className="space-y-8 max-w-5xl pb-20">
              <section className="glass p-12 rounded-[40px] shadow-2xl border-white/10 relative">
                <div className="absolute top-0 right-0 p-10 opacity-[0.03] font-bold text-9xl">AC-51</div>
                <h3 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
                  <span className="w-1.5 h-8 bg-blue-500 rounded-full"></span>
                  Liquidación General de Force Account
                </h3>

                <div className="grid grid-cols-1 gap-6">
                  {/* Mano de Obra Section */}
                  <div className="p-8 rounded-3xl bg-white/5 border border-white/5">
                    <div className="flex justify-between items-center mb-6">
                      <p className="font-bold text-blue-400 uppercase tracking-widest text-xs">I. Mano de Obra</p>
                      <span className="text-xs text-slate-500 font-bold bg-white/5 px-3 py-1 rounded-full uppercase">Regla de Liquidación ACT</span>
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between text-slate-400">
                        <span>Subtotal de Salarios Directos</span>
                        <span className="text-white font-bold">${summary.labor.subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </div>
                      <div className="flex justify-between text-slate-400 italic">
                        <span>(+) 20% Costos Indirectos</span>
                        <span className="text-white font-medium">${(summary.labor.plus20 - summary.labor.subtotal).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </div>
                      <div className="flex justify-between text-slate-400 italic">
                        <span>(+) 6% Beneficio Industrial s/ Mano de Obra</span>
                        <span className="text-blue-400 font-medium">${summary.labor.bi.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </div>
                      <div className="pt-4 border-t border-white/5 flex justify-between text-white font-bold text-lg">
                        <span>Total Mano de Obra</span>
                        <span className="text-emerald-400">${summary.labor.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </div>
                    </div>
                  </div>

                  {/* Equipo / Materiales Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-8 rounded-3xl bg-white/5 border border-white/5">
                      <p className="font-bold text-amber-400 uppercase tracking-widest text-xs mb-6 px-1">II. Renta de Equipo</p>
                      <div className="space-y-3">
                        <div className="flex justify-between text-slate-400 text-sm font-medium">
                          <span>Subtotal Equipo (AC-50)</span>
                          <span className="text-white font-bold">${summary.equipment.subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                        <div className="flex justify-between text-slate-400 text-sm">
                          <span>(+) 15% Ben. Ind.</span>
                          <span className="text-white font-medium">${summary.equipment.bi.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                        <div className="pt-4 border-t border-white/5 flex justify-between text-white font-bold text-xl">
                          <span>Total Equipo</span>
                          <span className="text-amber-400">${summary.equipment.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                      </div>
                    </div>
                    <div className="p-8 rounded-3xl bg-white/5 border border-white/5">
                      <p className="font-bold text-emerald-400 uppercase tracking-widest text-xs mb-6 px-1">III. Materiales</p>
                      <div className="space-y-3">
                        <div className="flex justify-between text-slate-400 text-sm font-medium">
                          <span>Subtotal Facturas</span>
                          <span className="text-white font-bold">${summary.materials.subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                        <div className="flex justify-between text-slate-400 text-sm">
                          <span>(+) 15% Ben. Ind.</span>
                          <span className="text-white font-medium">${summary.materials.bi.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                        <div className="pt-4 border-t border-white/5 flex justify-between text-white font-bold text-xl">
                          <span>Total Mat.</span>
                          <span className="text-emerald-400">${summary.materials.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Grand Final Total */}
                  <div className="mt-6 p-12 rounded-[40px] bg-gradient-to-br from-blue-600 to-blue-800 shadow-2xl shadow-blue-900/40 border border-blue-400/20 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                      <div className="absolute top-10 left-10 w-40 h-40 bg-white rounded-full blur-3xl animate-pulse"></div>
                      <div className="absolute bottom-10 right-10 w-40 h-40 bg-emerald-400 rounded-full blur-3xl"></div>
                    </div>
                    <p className="text-blue-100 font-bold uppercase tracking-[0.5em] text-xs mb-4">Monto total a liquidar</p>
                    <p className="text-7xl font-black text-white tracking-tighter drop-shadow-2xl">
                      ${summary.grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </p>
                    <div className="mt-10 flex flex-col md:flex-row justify-center gap-6">
                      <button className="px-10 py-4 bg-white text-blue-900 font-bold rounded-2xl hover:bg-slate-100 transition-all transform hover:scale-105 shadow-xl">
                        GENERAR PDF OFICIAL AC-51
                      </button>
                      <button className="px-10 py-4 bg-blue-500/30 text-white font-bold rounded-2xl backdrop-blur-md border border-white/20 hover:bg-blue-500/40 transition-all">
                        AUDITAR CÁLCULOS
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>

      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </div>
  );
}

export default App;
