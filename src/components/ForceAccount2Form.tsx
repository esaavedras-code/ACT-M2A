"use client";

import React, { useState, useMemo, useRef, forwardRef, useImperativeHandle, useEffect } from "react";
import { 
  FileText, Truck, Users, ChevronRight, LayoutDashboard,
  Info, CheckCircle2, Clock, Plus, Trash2, DollarSign,
  Download, Upload, ShieldCheck, Briefcase, Calculator, ChevronLeft,
  Search, X, Camera, Save, Split
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
  
  // Report Search & Filter State
  const [reportSearch, setReportSearch] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");

  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      const matchesSearch = r.report_no?.toLowerCase().includes(reportSearch.toLowerCase()) || 
                           r.description?.toLowerCase().includes(reportSearch.toLowerCase());
      const dateMatch = (!startDateFilter || r.date >= startDateFilter) && 
                       (!endDateFilter || r.date <= endDateFilter);
      return matchesSearch && dateMatch;
    });
  }, [reports, reportSearch, startDateFilter, endDateFilter]);

  // Equipment Search State
  const [eqSearch, setEqSearch] = useState("");
  const [showEqSearcher, setShowEqSearcher] = useState(false);

  // Labor Period Filter State
  const [laborFilterStart, setLaborFilterStart] = useState("");
  const [laborFilterEnd, setLaborFilterEnd] = useState("");

  // AC-51 Monthly Filter
  const [ac51Month, setAc51Month] = useState(new Date().toISOString().slice(0, 7));

  const ac51Data = useMemo(() => {
    // Agrupar reportes del mes seleccionado
    const monthReports = reports.filter(r => r.date.startsWith(ac51Month));
    
    return monthReports.map(r => {
      const rd = (r.data || {}) as any;
      const labor = (rd.labor || []).reduce((acc: number, l: any) => {
        const reg = (l.hoursReg || 0) * (l.hourlyRate || 0);
        const ot15 = (l.hours15 || 0) * (l.hourlyRate || 0) * 1.5;
        const ot20 = (l.hours20 || 0) * (l.hourlyRate || 0) * 2.0;
        return acc + reg + ot15 + ot20;
      }, 0);
      
      const equip = (rd.equipment || []).reduce((acc: number, e: any) => {
        return acc + ((e.hours || 0) * (e.dailyRate || 0));
      }, 0);

      const mats = (rd.materials || []).reduce((acc: number, m: any) => {
        return acc + ((m.quantity || 0) * (m.unitCost || 0));
      }, 0);

      return {
        id: r.id,
        date: r.date,
        reportNo: r.report_no,
        labor,
        equip,
        mats,
        total: labor + equip + mats
      };
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [reports, ac51Month]);

  // Contract Items for lookup
  const [contractItems, setContractItems] = useState<any[]>([]);

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

  const visibleLabor = useMemo(() => {
    if (!laborFilterStart && !laborFilterEnd) return ac49Report.labor;
    return ac49Report.labor.filter(l => {
      const rowDate = l.date || ac49Report.date;
      return (!laborFilterStart || rowDate >= laborFilterStart) && 
             (!laborFilterEnd || rowDate <= laborFilterEnd);
    });
  }, [ac49Report.labor, laborFilterStart, laborFilterEnd, ac49Report.date]);

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

  // Database for suggestions
  const suggestionsDB = useMemo(() => {
    const laborDB: Record<string, any> = {};
    const equipmentDB: Record<string, any> = {};
    
    reports.forEach(r => {
      r.labor?.forEach((l: any) => {
        if (l.employeeName?.trim()) {
          laborDB[l.employeeName.trim()] = {
            ssLast4: l.ssLast4,
            classification: l.classification,
            hourlyRate: l.hourlyRate
          };
        }
      });
      r.equipment?.forEach((e: any) => {
        if (e.description?.trim()) {
          equipmentDB[e.description.trim()] = {
            model: e.model,
            capacity: e.capacity,
            dailyRate: e.dailyRate
          };
        }
      });
    });
    
    return { labor: laborDB, equipment: equipmentDB };
  }, [reports]);


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

  const splitIntoDays = async () => {
    if (!ac49Report.labor.length) return;
    
    // Identificar fechas únicas (usando la fecha del reporte si el trabajador no tiene una específica)
    const dates = [...new Set(ac49Report.labor.map(l => l.date || ac49Report.date))];
    if (dates.length <= 1) {
       alert("No se detectaron múltiples fechas en la lista de trabajadores.");
       return;
    }

    if (!confirm(`Se crearán ${dates.length} reportes nuevos (uno por cada día detectado). El reporte actual se mantendrá intacto. ¿Continuar?`)) return;

    setLoading(true);
    try {
      for (const d of dates) {
        const laborForDay = ac49Report.labor.filter(l => (l.date || ac49Report.date) === d);
        const newNo = `${ac49Report.reportNo}-${d.split('-').pop()}`;
        
        const { data, error } = await supabase
          .from('fa2_reports')
          .insert([{
            project_id: projectId,
            date: d,
            report_no: newNo,
            description: `${ac49Report.workDescription} (Día ${d})`,
            data: { 
              labor: laborForDay, 
              equipment: ac49Report.equipment, 
              materials: ac49Report.materials,
              laborDetails: ac49Report.laborDetails
            }
          }])
          .select()
          .single();
          
        if (error) throw error;
      }
      
      alert("Reportes divididos exitosamente. Revise el Dashboard.");
      await fetchProjectAndReports();
      setActiveTab('dashboard');
    } catch (err: any) {
      console.error(err);
      alert("Error al dividir reportes: " + err.message);
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
                employeeName: l.nombre || l.empleado || "",
                ssLast4: l.seguro_social || l.ss_last4 || "",
                classification: l.clasificacion || "",
                hoursReg: parseFloat(l.horas_normales || 0),
                hours15: parseFloat(l.horas_extra || l.horas_extras_15 || 0),
                hours20: parseFloat(l.horas_extras_20 || 0),
                hourlyRate: parseFloat(l.tasa_normal || 0),
                date: l.fecha || l.date || l.fecha_trabajo || content.fecha_inicio || ""
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

  const updateLaborDetail = (key: keyof NonNullable<AC49Report['laborDetails']>, val: number) => {
    setAc49Report(prev => ({
      ...prev,
      laborDetails: {
        ...(prev.laborDetails || {}),
        [key]: val
      }
    }));
  };

  const summary = useMemo(() => {
    const rawLabor = ac49Report.labor.reduce((acc, curr) => acc + calculateLaborTotal(curr), 0);
    const rawEq = ac49Report.equipment.reduce((acc, curr) => acc + calculateEquipmentRental(curr.hours, curr.dailyRate || 0), 0);
    const rawMatM = ac49Report.materials.filter(m => m.type?.toUpperCase() !== 'S').reduce((acc, curr) => acc + ((curr.quantity || 0) * (curr.unitCost || 0)), 0);
    const rawMatS = ac49Report.materials.filter(m => m.type?.toUpperCase() === 'S').reduce((acc, curr) => acc + ((curr.quantity || 0) * (curr.unitCost || 0)), 0);
    const rawMat = rawMatM + rawMatS;
    
    const baseSummary = applyAC51Rules(rawLabor, rawEq, rawMat);
    
    // Override labor calculations with the detailed labor config if requested
    const auto_mo_op = ac49Report.labor
      .filter(l => {
        const c = (l.classification || "").toLowerCase();
        return c.includes('oper') || c.includes('chof') || c.includes('driver') || c.includes('heavy') || c.includes('mechanic');
      })
      .reduce((acc, curr) => acc + calculateLaborTotal(curr), 0);
      
    const auto_mo_ca = ac49Report.labor
      .filter(l => {
        const c = (l.classification || "").toLowerCase();
        return c.includes('carp');
      })
      .reduce((acc, curr) => acc + calculateLaborTotal(curr), 0);
      
    const auto_mo_ad = ac49Report.labor
      .filter(l => {
        const c = (l.classification || "").toLowerCase();
        const isOp = c.includes('oper') || c.includes('chof') || c.includes('driver') || c.includes('heavy') || c.includes('mechanic');
        const isCa = c.includes('carp');
        return !isOp && !isCa;
      })
      .reduce((acc, curr) => acc + calculateLaborTotal(curr), 0);

    const dets = ac49Report.laborDetails || {};
    const mo_op = dets.mo_operadores || auto_mo_op;
    const mo_ca = dets.mo_carpinteros || auto_mo_ca;
    const mo_ad = dets.mo_adicional || auto_mo_ad;

    const g = (mo_op * (1 + (dets.mo_operadores_pct || 0)/100)) +
              (mo_ca * (1 + (dets.mo_carpinteros_pct || 0)/100)) +
              (mo_ad * (1 + (dets.mo_adicional_pct || 0)/100));
    
    const h_subtotal = rawLabor;
    const mo_sin_union = h_subtotal * ((dets.mo_sin_union_pct || 0)/100);
    const k = g + h_subtotal + mo_sin_union + (dets.mo_gastos_viaje || 0);
    const l = k * ((dets.mo_beneficio_ind_pct || 20)/100);
    const m_val = l + k;
    
    const n = h_subtotal * ((dets.mo_fondo_estado_pct || 0)/100);
    const o = h_subtotal * ((dets.mo_seguro_social_pct || 7.65)/100);
    const p = h_subtotal * (((dets.mo_desempleo_est_pct || 0) + (dets.mo_desempleo_fed_pct || 0))/100);
    const q = h_subtotal * ((dets.mo_resp_publica_pct || 0)/100);
    const r = h_subtotal * ((dets.mo_incapacidad_pct || 0)/100);
    const s = n + o + p + q + r;
    const t = m_val * ((dets.mo_beneficio_ind_final_pct || 10)/100);
    
    const detailedLaborTotal = m_val + s + t;

    return {
      ...baseSummary,
      detailedLabor: {
        mo_op, mo_ca, mo_ad, g, h_subtotal, k, l, m_val, n, o, p, q, r, s, t,
        total: detailedLaborTotal
      },
      detailedMaterials: {
        subtotalM: rawMatM,
        subtotalS: rawMatS,
        biM: rawMatM * 0.15,
        biS: rawMatS * 0.15,
        total: (rawMatM + rawMatS) * 1.15
      },
      detailedEquipment: {
        subtotalReq: rawEq,
        bi: rawEq * 0.15,
        total: rawEq * 1.15
      },
      grandTotal: detailedLaborTotal + (rawEq * 1.15) + ((rawMatM + rawMatS) * 1.15)
    };
  }, [ac49Report]);


  const sidebarItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Resumen' },
    { id: 'ac49', icon: Clock, label: 'AC-49 (Diario)' },
    { id: 'ac50', icon: Truck, label: 'AC-50 (Equipo)' },
    { id: 'ac51', icon: FileText, label: 'AC-51 (Resumen)' },
    { id: 'fotos', icon: Camera, label: 'Evidencias (Fotos)' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row gap-2 items-start relative lg:-ml-6">
        {/* Navigation Sidebar */}
        <div className="w-full lg:w-44 lg:sticky lg:top-4 overflow-y-auto custom-scrollbar shrink-0">
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
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-2xl transition-all group ${
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
                    <button 
                      onClick={() => setActiveTab('dashboard')} 
                      className="group flex items-center gap-2 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 hover:text-blue-600 hover:border-blue-100 transition-all shadow-sm active:scale-95"
                    >
                      <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                      <span className="text-[10px] font-black uppercase tracking-widest pr-2 hidden sm:inline">Back</span>
                    </button>
                  )}
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                   {sidebarItems.find(i => i.id === activeTab)?.label}
                 </h2>
               </div>
               <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-1 ml-1 sm:ml-2">ACT PR • GESTIÓN DE REPORTES</p>
            </div>
            
            {selectedReportId && (
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-all shadow-sm"
                >
                  <Upload size={14} /> Importar JSON
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
                   <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 animate-in slide-in-from-top duration-500">
                   {[
                     { title: 'Total Liquidar', value: formatCurrency(summary.grandTotal), icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/10' },
                     { title: 'Mano de Obra (A)', value: formatCurrency(summary.detailedLabor?.total || summary.labor.total), icon: Users, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/10' },
                     { title: 'Materiales (B)', value: formatCurrency(summary.detailedMaterials?.total || summary.materials.total), icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/10' },
                     { title: 'Equipo (C)', value: formatCurrency(summary.detailedEquipment?.total || summary.equipment.total), icon: Truck, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/10' },
                   ].map((stat, i) => (
                     <div key={i} className="card relative overflow-hidden group border-b-4 border-b-blue-500">
                       <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                         <stat.icon className="w-20 h-20" />
                       </div>
                       <div className={`w-12 h-12 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center mb-6`}>
                         <stat.icon size={24} />
                       </div>
                       <p className="label-field mb-0 font-black">{stat.title}</p>
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
                    <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm font-sans">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                        {/* Fila 1 */}
                        <div className="space-y-2">
                          <label className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide block">PARTIDA #</label>
                          <input 
                            type="text" 
                            list="contract-items-list"
                            placeholder="Ej: 28"
                            value={ac49Report.relatedItemNo}
                            onChange={(e) => handleItemLookup(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <datalist id="contract-items-list">
                            {contractItems.map(i => (
                              <option key={i.id} value={i.item_num}>{i.description}</option>
                            ))}
                          </datalist>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide block">EWO #</label>
                          <input 
                            type="text" 
                            value={ac49Report.relatedEWO || ''}
                            onChange={(e) => setAc49Report({...ac49Report, relatedEWO: e.target.value})}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        {/* Separador */}
                        <div className="col-span-full h-px bg-slate-200 dark:bg-slate-800 my-2"></div>

                        {/* Fila 2 */}
                        <div className="space-y-2">
                          <label className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide block">FECHA INICIO FA</label>
                          <input 
                            type="date" 
                            value={ac49Report.startDate || ''}
                            onChange={(e) => setAc49Report({...ac49Report, startDate: e.target.value})}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide block">FECHA FIN FA</label>
                          <input 
                            type="date" 
                            value={ac49Report.endDate || ''}
                            onChange={(e) => setAc49Report({...ac49Report, endDate: e.target.value})}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      {/* Info adicional opcional */}
                      {ac49Report.relatedItemDescription && (
                         <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-500 flex justify-between">
                            <span><b>Desc:</b> {ac49Report.relatedItemDescription}</span>
                            <span><b>Costo Unit:</b> {formatCurrency(ac49Report.relatedItemUnitCost || 0)}</span>
                         </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end p-6 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] shadow-sm">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2 flex items-center gap-2">
                        <Search size={12} /> Buscar por # o descripción
                       </label>
                       <input 
                         type="text" 
                         placeholder="Ej: MAR-01..."
                         value={reportSearch}
                         onChange={(e) => setReportSearch(e.target.value)}
                         className="w-full bg-white dark:bg-slate-800 border-none ring-1 ring-slate-200 dark:ring-slate-700 p-3 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Desde (Fecha)</label>
                       <input 
                         type="date" 
                         value={startDateFilter}
                         onChange={(e) => setStartDateFilter(e.target.value)}
                         className="w-full bg-white dark:bg-slate-800 border-none ring-1 ring-slate-200 dark:ring-slate-700 p-3 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Hasta (Fecha)</label>
                       <div className="flex gap-2">
                         <input 
                           type="date" 
                           value={endDateFilter}
                           onChange={(e) => setEndDateFilter(e.target.value)}
                           className="flex-1 bg-white dark:bg-slate-800 border-none ring-1 ring-slate-200 dark:ring-slate-700 p-3 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                         />
                         {(reportSearch || startDateFilter || endDateFilter) && (
                           <button onClick={() => { setReportSearch(""); setStartDateFilter(""); setEndDateFilter(""); }} className="p-3 bg-white dark:bg-slate-800 text-slate-400 rounded-2xl hover:text-red-500 transition-colors ring-1 ring-slate-200">
                             <X size={16} />
                           </button>
                         )}
                       </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredReports.length > 0 ? filteredReports.map(r => (
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

                    <div className="space-y-6">
                      <div className="flex flex-col md:flex-row items-center gap-4 p-6 bg-blue-50/50 dark:bg-blue-900/5 rounded-[2rem] border border-blue-100 dark:border-blue-900/20">
                        <div className="flex items-center gap-2 text-blue-600">
                          <Clock size={16} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Filtrar lista de personal por:</span>
                        </div>
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex-1 space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Desde</label>
                            <input 
                              type="date" 
                              value={laborFilterStart}
                              onChange={(e) => setLaborFilterStart(e.target.value)}
                              className="w-full bg-white dark:bg-slate-800 border-none ring-1 ring-slate-200 dark:ring-slate-700 p-2 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="flex-1 space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Hasta</label>
                            <input 
                              type="date" 
                              value={laborFilterEnd}
                              onChange={(e) => setLaborFilterEnd(e.target.value)}
                              className="w-full bg-white dark:bg-slate-800 border-none ring-1 ring-slate-200 dark:ring-slate-700 p-2 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          {(laborFilterStart || laborFilterEnd) && (
                            <button 
                              onClick={() => { setLaborFilterStart(""); setLaborFilterEnd(""); }}
                              className="mt-5 p-2 text-red-500 bg-white dark:bg-slate-800 rounded-xl ring-1 ring-slate-200 hover:bg-red-50 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      <EditableTable<LaborEntry>
                        title="A. PERSONAL"
                        columns={[
                          { header: 'Fecha', key: 'date', type: 'date' },
                          { header: 'Empleado', key: 'employeeName', type: 'text' },
                          { header: 'SS (Últ. 4)', key: 'ssLast4', type: 'text' },
                          { header: 'Clasificación', key: 'classification', type: 'text' },
                          { header: 'H. Reg', key: 'hoursReg', type: 'number' },
                          { header: 'H. 1.5', key: 'hours15', type: 'number' },
                          { header: 'H. 2.0', key: 'hours20', type: 'number' },
                          { header: '$ / Hora', key: 'hourlyRate', type: 'number' },
                          { header: 'Total', key: 'total', type: 'computed', compute: (row: any) => {
                            const reg = (parseFloat(row.hoursReg) || 0) * (parseFloat(row.hourlyRate) || 0);
                            const ot15 = (parseFloat(row.hours15) || 0) * (parseFloat(row.hourlyRate) || 0) * 1.5;
                            const ot20 = (parseFloat(row.hours20) || 0) * (parseFloat(row.hourlyRate) || 0) * 2.0;
                            return reg + ot15 + ot20;
                          }},
                        ]}
                        data={visibleLabor}
                        onAdd={() => {
                          const newDate = laborFilterStart || ac49Report.date;
                          setAc49Report({...ac49Report, labor: [...ac49Report.labor, { id: Date.now().toString(), employeeName: '', date: newDate, ssLast4: '', classification: '', hoursReg: 0, hours15: 0, hours20: 0, hourlyRate: 0 }]});
                        }}
                        onRemove={(idx) => {
                          const itemToRemove = visibleLabor[idx];
                          setAc49Report({...ac49Report, labor: ac49Report.labor.filter(l => l.id !== itemToRemove.id)});
                        }}
                        onChange={(idx, key, val) => {
                          const targetItem = visibleLabor[idx];
                          const realIdx = ac49Report.labor.findIndex(l => l.id === targetItem.id);
                          if (realIdx === -1) return;

                          const newLabor = [...ac49Report.labor];
                          (newLabor[realIdx] as any)[key] = val;
                          
                          // Sugerencia Auto-relleno Personal
                          if (key === 'employeeName' && val) {
                            const term = String(val).trim();
                            const suggested = suggestionsDB.labor[term];
                            if (suggested) {
                              if (!newLabor[realIdx].ssLast4) newLabor[realIdx].ssLast4 = suggested.ssLast4;
                              if (!newLabor[realIdx].classification) newLabor[realIdx].classification = suggested.classification;
                              if (!newLabor[realIdx].hourlyRate) newLabor[realIdx].hourlyRate = suggested.hourlyRate;
                            }
                          }
                          
                          setAc49Report({...ac49Report, labor: newLabor});
                        }}
                      />

                      <EditableTable<MaterialEntry>
                        title="B. MATERIALES Y/O SERVICIOS"
                        columns={[
                          { header: 'Tipo (M) mat. (S) Serv.', key: 'type', type: 'text' },
                          { header: 'Materiales Usados y/o Servicios Prestados', key: 'description', type: 'text' },
                          { header: 'Vendedor', key: 'supplier', type: 'text' },
                          { header: 'Número de Factura', key: 'invoiceNo', type: 'text' },
                          { header: 'Cantidad', key: 'quantity', type: 'number' },
                          { header: '$ Unitario', key: 'unitCost', type: 'number' },
                          { header: 'Monto', key: 'amount', type: 'computed', compute: (row: any) => (parseFloat(row.quantity) || 0) * (parseFloat(row.unitCost) || 0) },
                        ]}
                        data={ac49Report.materials}
                        onAdd={() => setAc49Report({...ac49Report, materials: [...ac49Report.materials, { id: Date.now().toString(), type: '', description: '', supplier: '', invoiceNo: '', quantity: 0, unitCost: 0, amount: 0 }]})}
                        onRemove={(idx) => setAc49Report({...ac49Report, materials: ac49Report.materials.filter((_, i) => i !== idx)})}
                        onChange={(idx, key, val) => {
                          const newMat = [...ac49Report.materials];
                          (newMat[idx] as any)[key] = val;
                          setAc49Report({...ac49Report, materials: newMat});
                        }}
                      />

                      <EditableTable<EquipmentEntry>
                        title="C. EQUIPO EN USO"
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
                          
                          // Sugerencia Auto-relleno Equipo
                          if (key === 'description' && val) {
                            const term = String(val).trim();
                            const suggested = suggestionsDB.equipment[term];
                            if (suggested) {
                              if (!newEq[idx].model) newEq[idx].model = suggested.model;
                              if (!newEq[idx].dailyRate) newEq[idx].dailyRate = suggested.dailyRate;
                            }
                          }
                          
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

                      <div className="flex flex-col md:flex-row items-center gap-4 mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
                        <button 
                          onClick={() => saveData()}
                          disabled={loading}
                          className="w-full md:w-auto px-12 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-3xl transition-all shadow-xl shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
                        >
                          {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={18} />}
                          {selectedReportId ? "Actualizar Reporte" : "Guardar Nuevo Reporte"}
                        </button>
                        
                        <button 
                          onClick={splitIntoDays}
                          disabled={loading || !ac49Report.labor.length}
                          className="w-full md:w-auto px-8 py-4 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-3xl transition-all shadow-xl shadow-amber-500/20 active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
                        >
                          <Split size={18} />
                          Dividir por Días
                        </button>
                        
                        {selectedReportId && (
                          <button 
                            onClick={() => setSelectedReportId(null)}
                            className="w-full md:w-auto px-8 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black rounded-3xl transition-all hover:bg-slate-200 active:scale-95 uppercase tracking-widest text-xs"
                          >
                            Nuevo Reporte
                          </button>
                        )}
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
                              <input 
                                type="text" 
                                placeholder="Escribe el nombre del equipo (ej: Excavadora, Pickup...)" 
                                value={eqSearch}
                                onChange={(e) => setEqSearch(e.target.value)}
                                className="input-field pl-6 bg-white dark:bg-slate-900 border-amber-100 dark:border-amber-800/50 focus:border-amber-400 focus:ring-amber-400/20"
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
                        {/* Mano de Obra Details (Detailed Form) */}
                        <div className="p-10 rounded-[3rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden">
                           <div className="flex items-center justify-between mb-8 pb-4 border-b-2 border-blue-50 dark:border-slate-800">
                             <div className="flex items-center gap-3">
                               <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                                 <Users size={20} />
                               </div>
                               <div>
                                 <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">A. Resumen de Mano de Obra</h4>
                                 <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">({ac49Report.date || 'Sin Fecha'})</p>
                               </div>
                             </div>
                             <div className="bg-blue-600 text-white px-6 py-2 rounded-2xl font-black text-xs shadow-lg shadow-blue-500/20">TOTAL MES: {formatCurrency(summary.detailedLabor?.total || 0)}</div>
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 text-xs">
                             <div className="flex items-center justify-between py-2 border-b dark:border-slate-800">
                               <span className="w-64 font-bold text-slate-600 dark:text-slate-300">a) Subtot Operadores (Unión)</span> 
                               <div className="flex items-center">
                                 <span className="text-slate-400 mr-2">$</span>
                                 <input className="w-24 text-right bg-slate-50 dark:bg-slate-800 border-none rounded p-1 font-bold outline-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-blue-500" type="number" step="any" value={summary.detailedLabor?.mo_op} onChange={e => updateLaborDetail('mo_operadores', +e.target.value)}/>
                               </div>
                             </div>
                             <div className="flex items-center justify-between py-2 border-b dark:border-slate-800">
                               <span className="w-64 flex items-center gap-2 text-slate-500">b) Beneficios Oper. <input className="w-12 text-center bg-slate-50 dark:bg-slate-800 rounded ring-1 ring-slate-200 border-none p-1 text-xs" type="number" step="any" value={ac49Report.laborDetails?.mo_operadores_pct || 0} onChange={e => updateLaborDetail('mo_operadores_pct', +e.target.value)}/>%</span> 
                               <b className="text-slate-900 dark:text-white">{formatCurrency((summary.detailedLabor?.mo_op || 0) * ((ac49Report.laborDetails?.mo_operadores_pct || 0)/100))}</b>
                             </div>
                             
                             <div className="flex items-center justify-between py-2 border-b dark:border-slate-800">
                               <span className="w-64 font-bold text-slate-600 dark:text-slate-300">c) Subtot Carpinteros</span> 
                               <div className="flex items-center">
                                 <span className="text-slate-400 mr-2">$</span>
                                 <input className="w-24 text-right bg-slate-50 dark:bg-slate-800 border-none rounded p-1 font-bold outline-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-blue-500" type="number" step="any" value={summary.detailedLabor?.mo_ca} onChange={e => updateLaborDetail('mo_carpinteros', +e.target.value)}/>
                               </div>
                             </div>
                             <div className="flex items-center justify-between py-2 border-b dark:border-slate-800">
                               <span className="w-64 flex items-center gap-2 text-slate-500">d) Beneficios Carp. <input className="w-12 text-center bg-slate-50 dark:bg-slate-800 rounded ring-1 ring-slate-200 border-none p-1 text-xs" type="number" step="any" value={ac49Report.laborDetails?.mo_carpinteros_pct || 0} onChange={e => updateLaborDetail('mo_carpinteros_pct', +e.target.value)}/>%</span> 
                               <b className="text-slate-900 dark:text-white">{formatCurrency((summary.detailedLabor?.mo_ca || 0) * ((ac49Report.laborDetails?.mo_carpinteros_pct || 0)/100))}</b>
                             </div>
                             
                             <div className="flex items-center justify-between py-2 border-b dark:border-slate-800">
                               <span className="w-64 font-bold text-slate-600 dark:text-slate-300">e) Subtot Adicional</span> 
                               <div className="flex items-center">
                                 <span className="text-slate-400 mr-2">$</span>
                                 <input className="w-24 text-right bg-slate-50 dark:bg-slate-800 border-none rounded p-1 font-bold outline-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-blue-500" type="number" step="any" value={summary.detailedLabor?.mo_ad} onChange={e => updateLaborDetail('mo_adicional', +e.target.value)}/>
                               </div>
                             </div>
                             <div className="flex items-center justify-between py-2 border-b dark:border-slate-800">
                               <span className="w-64 flex items-center gap-2 text-slate-500">f) Beneficios Adic. <input className="w-12 text-center bg-slate-50 dark:bg-slate-800 rounded ring-1 ring-slate-200 border-none p-1 text-xs" type="number" step="any" value={ac49Report.laborDetails?.mo_adicional_pct || 0} onChange={e => updateLaborDetail('mo_adicional_pct', +e.target.value)}/>%</span> 
                               <b className="text-slate-900 dark:text-white">{formatCurrency((summary.detailedLabor?.mo_ad || 0) * ((ac49Report.laborDetails?.mo_adicional_pct || 0)/100))}</b>
                             </div>
                             
                             <div className="flex items-center justify-between py-2 border-b dark:border-slate-800"><span className="font-black text-blue-600">g) Suma Unión (a..f)</span> <b className="text-blue-700 dark:text-blue-400 font-black">{formatCurrency(summary.detailedLabor?.g || 0)}</b></div>
                             <div className="flex items-center justify-between py-2 border-b dark:border-slate-800"></div>

                             <div className="flex items-center justify-between py-3 border-b dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 px-3 rounded-lg"><span className="w-64 font-black">h) Subtotal Mano Obra Reg/Ext</span> <b className="font-black text-sm">{formatCurrency(summary.detailedLabor?.h_subtotal || 0)}</b></div>
                             <div className="flex items-center justify-between py-3 border-b dark:border-slate-800"><span className="w-64 flex items-center gap-2 text-slate-500">i) Beneficios marginales <input className="w-12 text-center bg-slate-50 dark:bg-slate-800 rounded ring-1 ring-slate-200 border-none p-1 text-xs" type="number" step="any" value={ac49Report.laborDetails?.mo_sin_union_pct || 0} onChange={e => updateLaborDetail('mo_sin_union_pct', +e.target.value)}/>%</span>  <b className="text-slate-900 dark:text-white">{formatCurrency((summary.detailedLabor?.h_subtotal || 0) * ((ac49Report.laborDetails?.mo_sin_union_pct || 0)/100))}</b></div>
                             
                             <div className="col-span-1 md:col-span-2 mt-6 space-y-4">
                               <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-4 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm"><span className="w-64 font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest text-[10px]">j) Gastos Viaje/Dietas</span> 
                                 <div className="flex items-center">
                                   <span className="text-slate-400 mr-2">$</span>
                                   <input className="w-32 text-right bg-white dark:bg-slate-900 border-none ring-1 ring-slate-200 dark:ring-slate-700 p-2 rounded-lg font-black outline-none focus:ring-blue-500" type="number" step="any" value={summary.detailedLabor?.mo_gastos_viaje || ac49Report.laborDetails?.mo_gastos_viaje || 0} onChange={e => updateLaborDetail('mo_gastos_viaje', +e.target.value)}/>
                                 </div>
                               </div>
                               
                               <div className="space-y-3 pt-6">
                                   <div className="flex justify-between items-center px-4 py-2"><span className="w-80 font-bold text-slate-500 text-[11px] uppercase">k) Suma Base (Unión ó Sin Unión + Viajes)</span> <b className="text-slate-900 dark:text-white font-black">{formatCurrency(summary.detailedLabor?.k || 0)}</b></div>
                                   <div className="flex justify-between items-center px-4 py-2"><span className="w-80 font-bold text-slate-500 flex items-center gap-3">l) Beneficio Industrial <input className="w-14 text-center bg-slate-50 dark:bg-slate-800 rounded ring-1 ring-slate-200 p-1 font-bold" type="number" step="any" value={ac49Report.laborDetails?.mo_beneficio_ind_pct ?? 20} onChange={e => updateLaborDetail('mo_beneficio_ind_pct', +e.target.value)}/>% de k</span> <b className="text-slate-900 dark:text-white font-black">{formatCurrency(summary.detailedLabor?.l || 0)}</b></div>
                                   <div className="flex justify-between items-center p-5 border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 rounded-2xl shadow-inner mt-4"><span className="font-black uppercase text-[11px] tracking-[0.2em] text-slate-700 dark:text-slate-300">m) SUMA L+K</span> <b className="text-lg text-slate-900 dark:text-white tracking-tighter">{formatCurrency(summary.detailedLabor?.m_val || 0)}</b></div>

                                   <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2 pt-6 pl-4 text-slate-600 dark:text-slate-400">
                                       <div className="flex items-center justify-between py-1 text-[10px]"><span className="w-48 flex items-center justify-between">n) Fondo Seguro Estado <input className="w-12 bg-white dark:bg-slate-900 rounded ring-1 ring-slate-200 border-none text-center p-1" type="number" step="any" value={ac49Report.laborDetails?.mo_fondo_estado_pct || 0} onChange={e => updateLaborDetail('mo_fondo_estado_pct', +e.target.value)}/>%</span> <b className="text-slate-900 dark:text-white">{formatCurrency(summary.detailedLabor?.n || 0)}</b></div>
                                       <div className="flex items-center justify-between py-1 text-[10px]"><span className="w-48 flex items-center justify-between">o) Seguro Social <input className="w-12 bg-white dark:bg-slate-900 rounded ring-1 ring-slate-200 border-none text-center p-1" type="number" step="any" value={ac49Report.laborDetails?.mo_seguro_social_pct ?? 7.65} onChange={e => updateLaborDetail('mo_seguro_social_pct', +e.target.value)}/>%</span> <b className="text-slate-900 dark:text-white">{formatCurrency(summary.detailedLabor?.o || 0)}</b></div>
                                       <div className="flex items-center justify-between py-1 text-[10px]"><span className="w-48">p) Desempleo Est. + Fed.</span> <b className="text-slate-900 dark:text-white">{formatCurrency(summary.detailedLabor?.p || 0)}</b></div>
                                       <div className="flex items-center justify-between py-1 text-[10px]"><span className="w-48 flex items-center justify-between">q) Seg. Resp. Pública <input className="w-12 bg-white dark:bg-slate-900 rounded ring-1 ring-slate-200 border-none text-center p-1" type="number" step="any" value={ac49Report.laborDetails?.mo_resp_publica_pct || 0} onChange={e => updateLaborDetail('mo_resp_publica_pct', +e.target.value)}/>%</span> <b className="text-slate-900 dark:text-white">{formatCurrency(summary.detailedLabor?.q || 0)}</b></div>
                                       <div className="flex items-center justify-between py-1 text-[10px]"><span className="w-48 flex items-center justify-between">r) Incapacidad <input className="w-12 bg-white dark:bg-slate-900 rounded ring-1 ring-slate-200 border-none text-center p-1" type="number" step="any" value={ac49Report.laborDetails?.mo_incapacidad_pct || 0} onChange={e => updateLaborDetail('mo_incapacidad_pct', +e.target.value)}/>%</span> <b className="text-slate-900 dark:text-white">{formatCurrency(summary.detailedLabor?.r || 0)}</b></div>
                                   </div>

                                   <div className="flex justify-between items-center px-4 pt-6 mt-4 border-t dark:border-slate-800"><span className="font-bold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-widest">s) Suma (n+o+p+q+r)</span> <b className="text-slate-900 dark:text-white font-black">{formatCurrency(summary.detailedLabor?.s || 0)}</b></div>
                                   <div className="flex justify-between items-center px-4 pb-6"><span className="font-bold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-widest flex items-center gap-3">t) Beneficio Industrial final <input className="w-14 bg-white dark:bg-slate-900 rounded ring-1 ring-slate-200 border-none text-center p-1 font-bold" type="number" step="any" value={ac49Report.laborDetails?.mo_beneficio_ind_final_pct ?? 10} onChange={e => updateLaborDetail('mo_beneficio_ind_final_pct', +e.target.value)}/>%</span> <b className="text-slate-900 dark:text-white font-black">{formatCurrency(summary.detailedLabor?.t || 0)}</b></div>
                               </div>

                               <div className="flex justify-between p-6 bg-blue-600 text-white rounded-[2rem] shadow-xl shadow-blue-500/20 mt-8">
                                 <span className="font-black text-sm uppercase tracking-widest mt-1">TOTAL MANO DE OBRA ({ac49Report.date || 'MES'})</span> 
                                 <b className="text-3xl tracking-tighter drop-shadow-md">{formatCurrency(summary.detailedLabor?.total || 0)}</b>
                               </div>
                             </div>
                                    {activeTab === 'ac51' && (
                  <div className="card space-y-8 animate-in fade-in duration-500">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-100 dark:border-slate-800 pb-8">
                      <div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter flex items-center gap-3">
                          <FileText className="text-blue-600" /> AC-51: Resumen Mensual de Liquidación
                        </h3>
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-2">Consolidado de costos por día</p>
                      </div>
                      <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-700">
                        <span className="text-[10px] font-black uppercase text-slate-400">Mes de Reporte:</span>
                        <input 
                          type="month" 
                          value={ac51Month}
                          onChange={(e) => setAc51Month(e.target.value)}
                          className="bg-white dark:bg-slate-900 border-none ring-1 ring-slate-200 dark:ring-slate-700 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800/50">
                            <th className="px-6 py-5 text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">Fecha</th>
                            <th className="px-6 py-5 text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">Reporte №</th>
                            <th className="px-6 py-5 text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 text-right">Mano de Obra</th>
                            <th className="px-6 py-5 text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 text-right">Equipo</th>
                            <th className="px-6 py-5 text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 text-right">Materiales</th>
                            <th className="px-6 py-5 text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 text-right">Total Diario</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                          {ac51Data.length > 0 ? ac51Data.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="px-6 py-4 text-xs font-bold text-slate-600 dark:text-slate-400">{row.date}</td>
                              <td className="px-6 py-4 text-xs font-black text-blue-600 dark:text-blue-400 uppercase">{row.reportNo}</td>
                              <td className="px-6 py-4 text-xs font-bold text-slate-700 dark:text-slate-200 text-right">{formatCurrency(row.labor)}</td>
                              <td className="px-6 py-4 text-xs font-bold text-slate-700 dark:text-slate-200 text-right">{formatCurrency(row.equip)}</td>
                              <td className="px-6 py-4 text-xs font-bold text-slate-700 dark:text-slate-200 text-right">{formatCurrency(row.mats)}</td>
                              <td className="px-6 py-4 text-xs font-black text-slate-900 dark:text-white text-right bg-slate-50/30 dark:bg-slate-800/20">{formatCurrency(row.total)}</td>
                            </tr>
                          )) : (
                            <tr>
                              <td colSpan={6} className="px-6 py-20 text-center">
                                <div className="flex flex-col items-center gap-3">
                                  <Calendar className="text-slate-200" size={48} />
                                  <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No hay reportes registrados para este mes</p>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                        {ac51Data.length > 0 && (
                          <tfoot>
                            <tr className="bg-blue-600 text-white font-black">
                              <td colSpan={2} className="px-6 py-6 text-xs uppercase tracking-[0.2em]">Totales del Mes</td>
                              <td className="px-6 py-6 text-xs text-right">{formatCurrency(ac51Data.reduce((acc, r) => acc + r.labor, 0))}</td>
                              <td className="px-6 py-6 text-xs text-right">{formatCurrency(ac51Data.reduce((acc, r) => acc + r.equip, 0))}</td>
                              <td className="px-6 py-6 text-xs text-right">{formatCurrency(ac51Data.reduce((acc, r) => acc + r.mats, 0))}</td>
                              <td className="px-6 py-6 text-sm text-right bg-blue-700">{formatCurrency(ac51Data.reduce((acc, r) => acc + r.total, 0))}</td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>

                    <div className="flex justify-end gap-4 mt-10">
                       <button 
                         className="px-10 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl transition-all shadow-xl shadow-emerald-500/20 active:scale-95 flex items-center gap-3 uppercase tracking-widest text-[10px]"
                       >
                         <Download size={18} /> Exportar Reporte Mensual (AC-51)
                       </button>
                    </div>
                  </div>
                )}

                {activeTab === 'fotos' && (
                  <div className="space-y-8 animate-in slide-in-from-right duration-500">
                    <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                        <div>
                          <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Registro de Evidencia Fotográfica</h3>
                          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Soporte visual para el ciclo {ac49Report.reportNo}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = 'image/*';
                              input.multiple = true;
                              input.onchange = (e: any) => {
                                const files = Array.from(e.target.files);
                                files.forEach((file: any) => {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    const base64String = reader.result as string;
                                    setAc49Report(prev => ({
                                      ...prev,
                                      photos: [...(prev.photos || []), base64String]
                                    }));
                                  };
                                  reader.readAsDataURL(file);
                                });
                              };
                              input.click();
                            }}
                            className="flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg hover:scale-105"
                          >
                            <Plus size={16} /> Subir de Galería
                          </button>
                          <button 
                             onClick={() => {
                               const input = document.createElement('input');
                               input.type = 'file';
                               input.accept = 'image/*';
                               input.capture = 'environment';
                               input.onchange = (e: any) => {
                                 const file = e.target.files[0];
                                 if (file) {
                                   const reader = new FileReader();
                                   reader.onloadend = () => {
                                     const base64String = reader.result as string;
                                     setAc49Report(prev => ({
                                       ...prev,
                                       photos: [...(prev.photos || []), base64String]
                                     }));
                                   };
                                   reader.readAsDataURL(file);
                                 }
                               };
                               input.click();
                             }}
                            className="flex items-center gap-2 px-8 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg hover:scale-105"
                          >
                            <Camera size={16} /> Abrir Cámara
                          </button>
                        </div>
                      </div>

                      {(!ac49Report.photos || ac49Report.photos.length === 0) ? (
                        <div className="border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-20 text-center">
                          <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-6 text-slate-300">
                            <Camera size={40} />
                          </div>
                          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No hay fotos registradas aún</p>
                          <p className="text-[10px] text-slate-300 mt-2 italic">Capture o suba evidencia de los trabajos realizados</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                          {ac49Report.photos.map((photo, idx) => (
                            <div key={idx} className="group relative aspect-square rounded-[2rem] overflow-hidden border border-slate-100 dark:border-slate-800 shadow-md hover:shadow-xl transition-all">
                              <img src={photo} alt={`Evidencia ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <button 
                                  onClick={() => {
                                    setAc49Report(prev => ({
                                      ...prev,
                                      photos: (prev.photos || []).filter((_, i) => i !== idx)
                                    }));
                                  }}
                                  className="w-12 h-12 bg-red-600 text-white rounded-full flex items-center justify-center hover:bg-red-700 transition-colors shadow-lg transform hover:scale-110"
                                >
                                  <Trash2 size={20} />
                                </button>
                              </div>
                              <div className="absolute bottom-4 left-4 right-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-3 rounded-xl text-center">
                                <p className="text-[9px] font-black uppercase text-slate-600 dark:text-slate-300">Foto #{idx + 1}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className="mt-12 p-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-2xl flex items-center gap-4">
                        <Info className="text-amber-600 shrink-0" size={20} />
                        <p className="text-[10px] font-bold text-amber-800 uppercase leading-relaxed tracking-tight">
                          Las fotos se guardarán dentro del archivo de respaldo JSON para mantener toda la evidencia consolidada en un solo lugar.
                        </p>
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
