"use client";

import React, { useState, useMemo, useRef, forwardRef, useImperativeHandle, useEffect } from "react";
import { 
  FileText, Truck, Users, ChevronRight, LayoutDashboard,
  Info, CheckCircle2, Clock, Plus, Trash2, DollarSign,
  Download, Upload, ShieldCheck, Briefcase, Calculator, ChevronLeft,
  Search, X, Camera, Save, Split, Calendar
} from 'lucide-react';
import { Project, AC49Report, LaborEntry, EquipmentEntry, MaterialEntry } from '../types/fa2';
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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const initialLoadRef = useRef(true);

  // Warn on browser close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

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
  const [isSingleDayFilter, setIsSingleDayFilter] = useState(false);

  // AC-51 Monthly Filter
  const [ac51Month, setAc51Month] = useState(new Date().toISOString().slice(0, 7));

  const ac51Data = useMemo(() => {
    const monthReports = reports.filter(r => r.date && r.date.startsWith(ac51Month));
    const dateGroups: Record<string, any[]> = {};
    monthReports.forEach(r => {
      if (!dateGroups[r.date]) dateGroups[r.date] = [];
      dateGroups[r.date].push(r);
    });

    return Object.keys(dateGroups).map(date => {
      const dayReports = dateGroups[date];
      let labor = 0, equip = 0, mats = 0;

      dayReports.forEach(r => {
        const rd = (r.data || {}) as any;
        labor += (rd.labor || []).reduce((acc: number, l: any) => acc + calculateLaborTotal(l), 0);
        equip += (rd.equipment || []).reduce((acc: number, e: any) => {
          if (e.aa_rentaMensual) {
            const bb = (e.aa_rentaMensual || 0) / 176;
            const ee = bb * (e.cc_factorAnos || 1) * (e.dd_factorZona || 1);
            const gg = ee * (e.ff_horasInactivas || 0);
            const ll = ee + (e.kk_costoOperacion || 0);
            const mm = (e.hours || 0) * ll;
            return acc + gg + mm;
          }
          return acc + ((Number(e.hours) || 0) * (Number(e.dailyRate) || 0));
        }, 0);
        mats += (rd.materials || []).reduce((acc: number, m: any) => acc + ((Number(m.quantity) || 0) * (Number(m.unitCost) || 0)), 0);
      });

      return { date, labor, equip, mats, total: labor + equip + mats };
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [reports, ac51Month]);

  const ac50DailyDetail = useMemo(() => {
    const monthReports = reports.filter(r => r.date && r.date.startsWith(ac51Month));
    const [year, month] = ac51Month.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    
    // Agrupar por equipo y luego por día
    const equipmentRows: Record<string, { equipment: any, days: number[] }> = {};

    monthReports.forEach(r => {
      const day = parseInt(r.date.split('-')[2]);
      const rd = (r.data || {}) as any;
      (rd.equipment || []).forEach((eq: any) => {
        const key = `${eq.description}-${eq.model}`.toUpperCase();
        if (!equipmentRows[key]) {
          equipmentRows[key] = {
            equipment: eq,
            days: Array(32).fill(0)
          };
        }
        equipmentRows[key].days[day] += (Number(eq.hours) || 0);
      });
    });

    return Object.values(equipmentRows);
  }, [reports, ac51Month]);

  const daysInMonth = useMemo(() => {
    if (!ac51Month) return [];
    try {
      const [year, month] = ac51Month.split('-').map(Number);
      const lastDay = new Date(year, month, 0).getDate();
      return Array.from({ length: lastDay }, (_, i) => {
        const day = i + 1;
        const d = new Date(year, month - 1, day);
        const sem = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"][d.getDay()];
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayData = ac51Data.find(r => r.date === isoDate);
        return { day, sem, amount: dayData?.total || 0, labor: dayData?.labor || 0, equip: dayData?.equip || 0, mats: dayData?.mats || 0, isWeekend };
      });
    } catch (e) { return []; }
  }, [ac51Month, ac51Data]);

  // AC-50 Consolidated Equipment State (Parte B)
  const ac50Equipment = useMemo(() => {
    const monthReports = reports.filter(r => r.date && r.date.startsWith(ac51Month));
    const equipmentMap: Record<string, any> = {};

    monthReports.forEach(r => {
      const rd = (r.data || {}) as any;
      (rd.equipment || []).forEach((eq: any) => {
        const key = `${eq.description?.trim()}-${eq.model?.trim()}`.toUpperCase();
        if (!equipmentMap[key]) {
          equipmentMap[key] = { 
            id: eq.id, 
            description: eq.description, 
            model: eq.model, 
            hours: 0,
            aa_rentaMensual: eq.aa_rentaMensual ?? 0,
            cc_factorAnos: eq.cc_factorAnos ?? 1,
            dd_factorZona: eq.dd_factorZona ?? 1,
            ff_horasInactivas: eq.ff_horasInactivas ?? 0,
            kk_costoOperacion: eq.kk_costoOperacion ?? 0
          };
        }
        equipmentMap[key].hours += (Number(eq.hours) || 0);
      });
    });

    return Object.values(equipmentMap).map((eq: any) => {
      const aa = eq.aa_rentaMensual;
      const bb = aa / 176;
      const cc = eq.cc_factorAnos;
      const dd = eq.dd_factorZona;
      const ee = bb * cc * dd;
      const ff = eq.ff_horasInactivas;
      const gg = ee * ff;
      const jj = eq.hours;
      const hh = ff + jj;
      const ii = ee * hh;
      const kk = eq.kk_costoOperacion;
      const ll = ee + kk;
      const mm = jj * ll;
      const nn = gg + mm;

      return { ...eq, aa, bb, cc, dd, ee, ff, gg, hh, ii, jj, kk, ll, mm, nn };
    });
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

  // Monitor report changes to set dirty state — MUST be after ac49Report declaration
  useEffect(() => {
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      return;
    }
    if (selectedReportId) {
      setHasUnsavedChanges(true);
      if (onDirty) onDirty();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ac49Report.labor, ac49Report.equipment, ac49Report.materials, ac49Report.workDescription, ac49Report.photos]);

  const updateEquipmentConfig = (key: string, field: string, val: number) => {
    const newEq = ac49Report.equipment.map(e => {
      const itemKey = `${e.description?.trim()}-${e.model?.trim()}`.toUpperCase();
      if (itemKey === key) return { ...e, [field]: val };
      return e;
    });
    setAc49Report({ ...ac49Report, equipment: newEq });
  };

  const visibleLabor = useMemo(() => {
    if (!laborFilterStart && (!laborFilterEnd && !isSingleDayFilter)) return ac49Report.labor;
    return ac49Report.labor.filter(l => {
      const rowDate = l.date || ac49Report.date;
      if (isSingleDayFilter) return rowDate === laborFilterStart;
      return (!laborFilterStart || rowDate >= laborFilterStart) && 
             (!laborFilterEnd || rowDate <= laborFilterEnd);
    });
  }, [ac49Report.labor, laborFilterStart, laborFilterEnd, isSingleDayFilter, ac49Report.date]);

  const visibleMaterials = useMemo(() => {
    if (!laborFilterStart && (!laborFilterEnd && !isSingleDayFilter)) return ac49Report.materials;
    return ac49Report.materials.filter(m => {
      const rowDate = m.date || ac49Report.date;
      if (isSingleDayFilter) return rowDate === laborFilterStart;
      return (!laborFilterStart || rowDate >= laborFilterStart) && 
             (!laborFilterEnd || rowDate <= laborFilterEnd);
    });
  }, [ac49Report.materials, laborFilterStart, laborFilterEnd, isSingleDayFilter, ac49Report.date]);

  const visibleEquipment = useMemo(() => {
    if (!laborFilterStart && (!laborFilterEnd && !isSingleDayFilter)) return ac49Report.equipment;
    return ac49Report.equipment.filter(e => {
      const rowDate = e.date || ac49Report.date;
      if (isSingleDayFilter) return rowDate === laborFilterStart;
      return (!laborFilterStart || rowDate >= laborFilterStart) && 
             (!laborFilterEnd || rowDate <= laborFilterEnd);
    });
  }, [ac49Report.equipment, laborFilterStart, laborFilterEnd, isSingleDayFilter, ac49Report.date]);


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
    const materialsDB: Record<string, any> = {};
    
    reports.forEach(r => {
      r.data?.labor?.forEach((l: any) => {
        if (l.employeeName?.trim()) {
          const key = l.employeeName.trim().toLowerCase();
          laborDB[key] = {
            employeeName: l.employeeName.trim(),
            ssLast4: l.ssLast4,
            classification: l.classification,
            hourlyRate: l.hourlyRate
          };
        }
      });
      r.data?.equipment?.forEach((e: any) => {
        if (e.description?.trim()) {
          const key = e.description.trim().toLowerCase();
          equipmentDB[key] = {
            description: e.description.trim(),
            model: e.model,
            year: e.year,
            capacity: e.capacity,
            fuelType: e.fuelType,
            ownership: e.ownership,
            dailyRate: e.dailyRate
          };
        }
      });
      r.data?.materials?.forEach((m: any) => {
        if (m.description?.trim()) {
          const key = m.description.trim().toLowerCase();
          materialsDB[key] = {
            description: m.description.trim(),
            supplier: m.supplier,
            unitCost: m.unitCost,
            type: m.type
          };
        }
      });
    });
    
    return { labor: laborDB, equipment: equipmentDB, materials: materialsDB };
  }, [reports]);

  const fetchProjectAndReports = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const { data: pData } = await supabase.from("projects").select("name, num_act, contractor_name").eq("id", projectId).single();
      if (pData) {
        setProject(prev => ({
          ...prev,
          name: pData.name,
          number: pData.num_act,
          contractor: pData.contractor_name || "M2A Group"
        }));
      }

      const { data: rData } = await supabase
        .from("fa2_reports")
        .select("*")
        .eq("project_id", projectId)
        .order("date", { ascending: false });
      
      if (rData) setReports(rData);

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
    initialLoadRef.current = true; // Mark as initial load to avoid setting dirty immediately
    setHasUnsavedChanges(false);
    setAc49Report({
      id: report.id,
      projectId: report.project_id,
      date: report.date || new Date().toISOString().split('T')[0],
      reportNo: report.report_no || '',
      totalPages: 1,
      workDescription: report.description || '',
      labor: report.data?.labor || [],
      equipment: report.data?.equipment || [],
      materials: report.data?.materials || [],
      photos: report.data?.photos || [],
      groupName: report.data?.groupName || '',
      subGroupName: report.data?.subGroupName || '',
      relatedItemNo: report.data?.relatedItemNo || '',
      relatedItemDescription: report.data?.relatedItemDescription || '',
      relatedItemUnitCost: report.data?.relatedItemUnitCost || 0,
      relatedItemAmount: report.data?.relatedItemAmount || 0,
      signatures: report.data?.signatures || { contractor: false, projectChief: false },
      laborDetails: report.data?.laborDetails || {}
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

    const faNum = prompt("Número del Force Account (ej: FA-1, FA-2):", "FA-1");
    if (!faNum?.trim()) return;

    const monthInput = prompt("Mes y año del reporte (formato AAAA-MM, ej: 2023-09):", new Date().toISOString().slice(0, 7));
    if (!monthInput?.trim() || !/^\d{4}-\d{2}$/.test(monthInput.trim())) {
      alert("Formato inválido. Use AAAA-MM (ej: 2023-09).");
      return;
    }

    const [year, month] = monthInput.trim().split('-');
    const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const monthName = monthNames[parseInt(month) - 1];
    const faClean = faNum.trim().toUpperCase();
    const groupName = faClean;
    const subGroupName = `${faClean}-${monthName}-${year}`;
    const reportNo = `${faClean}-${monthName.substring(0,3).toUpperCase()}-${year}`;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("fa2_reports")
        .insert([{
          project_id: projectId,
          report_no: reportNo,
          date: `${monthInput.trim()}-01`,
          description: `${faClean} — ${monthName} ${year}`,
          data: {
            labor: [], equipment: [], materials: [],
            laborDetails: {},
            groupName,
            subGroupName,
            signatures: { contractor: false, projectChief: false }
          }
        }])
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setReports([data, ...reports]);
        handleSelectReport(data);
        setActiveTab('ac49');
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
    const allItems = [
      ...ac49Report.labor.map(l => ({ date: l.date || ac49Report.date, type: 'labor' as const, item: l })),
      ...ac49Report.equipment.map(e => ({ date: e.date || ac49Report.date, type: 'equip' as const, item: e })),
      ...ac49Report.materials.map(m => ({ date: m.date || ac49Report.date, type: 'mat' as const, item: m }))
    ];

    if (!allItems.length) return;
    const dates = [...new Set(allItems.map(i => i.date))];
    if (dates.length <= 1) {
       alert("No se detectaron múltiples fechas en la lista de items.");
       return;
    }

    if (!confirm(`Se crearán ${dates.length} reportes nuevos (uno por cada día detectado). El reporte actual se mantendrá intacto. ¿Continuar?`)) return;

    setLoading(true);
    try {
      for (const d of dates) {
        const laborForDay = ac49Report.labor.filter(l => (l.date || ac49Report.date) === d);
        const equipForDay = ac49Report.equipment.filter(e => (e.date || ac49Report.date) === d);
        const matsForDay = ac49Report.materials.filter(m => (m.date || ac49Report.date) === d);
        const newNo = `${ac49Report.reportNo}-${d.split('-').pop()}`;
        
        const { error } = await supabase
          .from('fa2_reports')
          .insert([{
            project_id: projectId,
            date: d,
            report_no: newNo,
            description: `${ac49Report.workDescription} (Día ${d})`,
            data: { 
              labor: laborForDay, 
              equipment: equipForDay, 
              materials: matsForDay,
              laborDetails: ac49Report.laborDetails
            }
          }]);
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
            signatures: ac49Report.signatures,
            photos: ac49Report.photos,
            laborDetails: ac49Report.laborDetails,
            groupName: ac49Report.groupName,
            subGroupName: ac49Report.subGroupName
          }
        })
        .eq("id", selectedReportId);

      if (error) throw error;
      setHasUnsavedChanges(false);
      if (!silent) alert("✅ Force Account guardado exitosamente.");
      
      const updatedData = {
        labor: ac49Report.labor,
        equipment: ac49Report.equipment,
        materials: ac49Report.materials,
        relatedItemNo: ac49Report.relatedItemNo,
        relatedItemDescription: ac49Report.relatedItemDescription,
        relatedItemUnitCost: ac49Report.relatedItemUnitCost,
        relatedItemAmount: ac49Report.relatedItemAmount,
        signatures: ac49Report.signatures,
        laborDetails: ac49Report.laborDetails,
        photos: ac49Report.photos,
        groupName: ac49Report.groupName,
        subGroupName: ac49Report.subGroupName
      };

      setReports(reports.map(r => r.id === selectedReportId ? { 
        ...r, 
        report_no: ac49Report.reportNo, 
        date: ac49Report.date, 
        description: ac49Report.workDescription,
        data: updatedData
      } : r));
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
            reportToImport = content.ac49Report;
          } else if (content.fa_num || content.labor || content.equipment) {
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

            if (data) {
              setReports([data, ...reports]);
              handleSelectReport(data);
              alert("✅ Datos migrados y guardados exitosamente.");
            }
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
      laborDetails: { ...(prev.laborDetails || {}), [key]: val }
    }));
  };

  const summary = useMemo(() => {
    const rawLabor = ac49Report.labor.reduce((acc, curr) => acc + calculateLaborTotal(curr), 0);
    const rawEq = ac49Report.equipment.reduce((acc, curr) => acc + calculateEquipmentRental(curr.hours, curr.dailyRate || 0), 0);
    const rawMatM = ac49Report.materials.filter(m => m.type?.toUpperCase() !== 'S').reduce((acc, curr) => acc + ((curr.quantity || 0) * (curr.unitCost || 0)), 0);
    const rawMatS = ac49Report.materials.filter(m => m.type?.toUpperCase() === 'S').reduce((acc, curr) => acc + ((curr.quantity || 0) * (curr.unitCost || 0)), 0);
    
    const baseSummary = applyAC51Rules(rawLabor, rawEq, rawMatM + rawMatS);
    
    const auto_mo_op = ac49Report.labor
      .filter(l => (l.classification || "").toLowerCase().match(/oper|chof|driver|heavy|mechanic/))
      .reduce((acc, curr) => acc + calculateLaborTotal(curr), 0);
    const auto_mo_ca = ac49Report.labor
      .filter(l => (l.classification || "").toLowerCase().includes('carp'))
      .reduce((acc, curr) => acc + calculateLaborTotal(curr), 0);
    const auto_mo_ad = ac49Report.labor
      .filter(l => {
        const c = (l.classification || "").toLowerCase();
        return !c.match(/oper|chof|driver|heavy|mechanic/) && !c.includes('carp');
      })
      .reduce((acc, curr) => acc + calculateLaborTotal(curr), 0);

    const dets = ac49Report.laborDetails || {};
    const mo_op = dets.mo_operadores ?? auto_mo_op;
    const mo_ca = dets.mo_carpinteros ?? auto_mo_ca;
    const mo_ad = dets.mo_adicional ?? auto_mo_ad;

    const g = (mo_op * (1 + (dets.mo_operadores_pct || 0)/100)) +
              (mo_ca * (1 + (dets.mo_carpinteros_pct || 0)/100)) +
              (mo_ad * (1 + (dets.mo_adicional_pct || 0)/100));
    
    const h_subtotal = rawLabor;
    const mo_sin_union = h_subtotal * ((dets.mo_sin_union_pct || 0)/100);
    const k = g + h_subtotal + mo_sin_union + (Number(dets.mo_gastos_viaje) || 0);
    const l = k * ((dets.mo_beneficio_ind_pct || 20)/100);
    const m_val = l + k;
    
    const n = h_subtotal * ((dets.mo_fondo_estado_pct || 0)/100);
    const o = h_subtotal * ((dets.mo_seguro_social_pct || 7.65)/100);
    const p = h_subtotal * (((dets.mo_desempleo_est_pct ?? 5.4) + (dets.mo_desempleo_fed_pct ?? 0.8))/100);
    const q = h_subtotal * ((dets.mo_resp_publica_pct || 0)/100);
    const r = h_subtotal * ((dets.mo_incapacidad_pct || 0)/100);
    const s = n + o + p + q + r;
    const t = m_val * ((dets.mo_beneficio_ind_final_pct || 10)/100);
    const detailedLaborTotal = m_val + s + t;

    return {
      ...baseSummary,
      detailedLabor: { mo_op, mo_ca, mo_ad, g, h_subtotal, k, l, m_val, n, o, p, q, r, s, t, total: detailedLaborTotal },
      detailedMaterials: { subtotalM: rawMatM, subtotalS: rawMatS, biM: rawMatM * 0.15, biS: rawMatS * 0.15, total: (rawMatM + rawMatS) * 1.15 },
      detailedEquipment: { subtotalReq: rawEq, bi: rawEq * 0.15, total: rawEq * 1.15 },
      grandTotal: detailedLaborTotal + (rawEq * 1.15) + ((rawMatM + rawMatS) * 1.15),
      rentTotal: rawEq
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
      <div className="flex flex-col lg:flex-row gap-4 items-start w-full">
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
          </div>
        </div>

        <div className="flex-1 w-full min-w-0 overflow-x-hidden p-1">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div className="flex items-center gap-2">
              {activeTab !== 'dashboard' && (
                <button 
                  onClick={() => {
                    if (hasUnsavedChanges) {
                      if (!confirm("⚠️ Tienes cambios sin guardar. ¿Deseas salir al resumen de todos modos?\n( Se podrían perder los datos ingresados )")) return;
                    }
                    setActiveTab('dashboard');
                    setHasUnsavedChanges(false);
                  }} 
                  className="group flex items-center gap-2 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 hover:text-blue-600 transition-all shadow-sm"
                >
                  <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-widest pr-2 hidden sm:inline">Back</span>
                </button>
              )}
              <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                {sidebarItems.find(i => i.id === activeTab)?.label}
              </h2>
            </div>
            {selectedReportId && (
              <div className="flex items-center gap-3">
                <button 
                  onClick={exportData}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg transition-all"
                >
                  <Download size={14} /> Exportar JSON
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all"
                >
                  <Upload size={14} /> Importar JSON
                </button>
              </div>
            )}
          </div>

          <div className="animate-fade-in">
            {activeTab === 'dashboard' && (
              <div className="space-y-8">
                {selectedReportId ? (
                   <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 animate-in slide-in-from-top duration-500">
                    {[
                      { title: 'Total Liquidar', value: formatCurrency(summary.grandTotal), icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/10' },
                      { title: 'Mano de Obra (A)', value: formatCurrency(summary.detailedLabor?.total || summary.labor.total), icon: Users, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/10' },
                      { title: 'Materiales (B)', value: formatCurrency(summary.detailedMaterials?.total || summary.materials.total), icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/10' },
                      { title: 'Equipo (C)', value: formatCurrency(summary.detailedEquipment?.total || summary.equipment.total), icon: Truck, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/10' },
                    ].map((stat, i) => (
                      <div key={i} className="card relative overflow-hidden group border-b-4 border-b-blue-500">
                        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10">
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
                  <div className="bg-blue-600 p-8 rounded-[3rem] text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
                     <div className="space-y-2">
                        <h3 className="text-2xl font-black uppercase tracking-tighter">Bienvenido a Force Account 2</h3>
                        <p className="text-blue-100 font-bold text-xs uppercase tracking-widest">Selecciona un registro de la lista o crea uno nuevo para empezar.</p>
                     </div>
                     <button onClick={handleCreateNew} className="px-10 py-5 bg-white text-blue-600 font-black uppercase text-xs tracking-widest rounded-3xl shadow-2xl">
                        <Plus size={18} /> Crear Nuevo Reporte
                     </button>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-center justify-between px-4">
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Briefcase size={12} /> Gestión de Ciclos de Force Account
                    </h4>
                  </div>
                  
                  {selectedReportId && (
                    <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                        <div className="space-y-2">
                          <label className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide block">PARTIDA #</label>
                          <input type="text" list="contract-items-list" placeholder="Ej: 28" value={ac49Report.relatedItemNo} onChange={(e) => handleItemLookup(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500" />
                          <datalist id="contract-items-list">
                            {contractItems.map(i => <option key={i.id} value={i.item_num}>{i.description}</option>)}
                          </datalist>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide block">EWO #</label>
                          <input type="text" value={ac49Report.relatedEWO || ''} onChange={(e) => setAc49Report({...ac49Report, relatedEWO: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide block">Grupo Principal (Ej: AC-200023- FA1)</label>
                          <input type="text" value={ac49Report.groupName || ''} onChange={(e) => setAc49Report({...ac49Report, groupName: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 font-bold" placeholder="AC-200023- FA1" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide block">Subgrupo / Mes (Ej: FA1-septiembre)</label>
                          <input type="text" value={ac49Report.subGroupName || ''} onChange={(e) => setAc49Report({...ac49Report, subGroupName: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 font-bold" placeholder="FA1-septiembre" />
                        </div>
                        <div className="col-span-full h-px bg-slate-200 dark:bg-slate-800 my-2"></div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide block">FECHA INICIO FA</label>
                          <input type="date" value={ac49Report.startDate || ''} onChange={(e) => setAc49Report({...ac49Report, startDate: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide block">FECHA FIN FA</label>
                          <input type="date" value={ac49Report.endDate || ''} onChange={(e) => setAc49Report({...ac49Report, endDate: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end p-6 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem]">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2 flex items-center gap-2"><Search size={12} /> Buscar</label>
                       <input type="text" placeholder="Ej: MAR-01..." value={reportSearch} onChange={(e) => setReportSearch(e.target.value)} className="w-full bg-white dark:bg-slate-800 border-none ring-1 ring-slate-200 dark:ring-slate-700 p-3 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Desde</label>
                       <input type="date" value={startDateFilter} onChange={(e) => setStartDateFilter(e.target.value)} className="w-full bg-white dark:bg-slate-800 ring-1 ring-slate-200 p-3 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="space-y-2 text-right">
                       <button onClick={() => { setReportSearch(""); setStartDateFilter(""); setEndDateFilter(""); }} className="text-[10px] font-black text-red-500 uppercase flex items-center gap-2 ml-auto mb-2"><X size={12}/> Limpiar filtros</button>
                    </div>
                  </div>

                  <div className="space-y-12">
                    {(() => {
                      const groups: Record<string, Record<string, any[]>> = {};
                      filteredReports.forEach(r => {
                        const gn = r.data?.groupName?.trim() || 'Sin Clasificar (Grupo)';
                        const sgn = r.data?.subGroupName?.trim() || 'Sin Clasificar (Mes)';
                        if (!groups[gn]) groups[gn] = {};
                        if (!groups[gn][sgn]) groups[gn][sgn] = [];
                        groups[gn][sgn].push(r);
                      });

                      const sortedGroupNames = Object.keys(groups).sort();

                      return sortedGroupNames.map(gn => (
                        <div key={gn} className="space-y-6">
                           <div className="flex items-center gap-4 border-b-2 border-slate-100 dark:border-slate-800 pb-4">
                              <div className="w-1.5 h-8 bg-blue-600 rounded-full"></div>
                              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter flex items-center gap-3">
                                <Briefcase className="text-blue-600" size={20} /> {gn}
                              </h3>
                           </div>
                           
                           <div className="space-y-8 pl-6">
                              {Object.keys(groups[gn]).sort().map(sgn => (
                                <div key={sgn} className="space-y-4">
                                   <div className="flex items-center gap-3 text-slate-400">
                                      <Calendar size={14} className="text-emerald-500" />
                                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em]">{sgn}</h4>
                                   </div>
                                   
                                   <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                      {groups[gn][sgn].sort((a,b) => b.date.localeCompare(a.date)).map(r => (
                                        <div key={r.id} onClick={() => handleSelectReport(r)} className={`group p-6 rounded-[2.5rem] border-2 transition-all cursor-pointer relative overflow-hidden ${selectedReportId === r.id ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-blue-200 shadow-sm'}`}>
                                           <div className="flex justify-between items-start relative z-10">
                                              <div className="space-y-1">
                                                 <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${selectedReportId === r.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 font-bold'}`}>{r.report_no}</span>
                                                    <span className="text-[10px] text-slate-400 font-bold">{r.date}</span>
                                                 </div>
                                                 <h5 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight line-clamp-1">{r.description || 'Sin descripción'}</h5>
                                              </div>
                                              {selectedReportId === r.id && <CheckCircle2 className="text-blue-600" size={18} />}
                                           </div>
                                        </div>
                                      ))}
                                   </div>
                                </div>
                              ))}
                           </div>
                        </div>
                      ));
                    })()}
                    {filteredReports.length === 0 && (
                      <div className="col-span-full py-40 text-center bg-slate-50 dark:bg-slate-900/50 rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                         <Search size={48} className="mx-auto text-slate-200 mb-6" />
                         <p className="text-slate-400 font-bold tracking-widest uppercase text-xs italic">No se encontraron reportes con los filtros actuales.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {selectedReportId && (
              <>
                {activeTab === 'ac49' && (
                  <div className="card space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 bg-slate-50 dark:bg-slate-900 rounded-[2.5rem] border border-slate-100">
                      <div className="space-y-2">
                        <label className="label-field flex items-center gap-2"><Clock size={12} className="text-blue-600" /> Fecha del Informe</label>
                        <input type="date" value={ac49Report.date} onChange={(e) => setAc49Report({...ac49Report, date: e.target.value})} className="input-field" />
                      </div>
                      <div className="space-y-2">
                        <label className="label-field">Número de Referencia</label>
                        <input type="text" value={ac49Report.reportNo} onChange={(e) => setAc49Report({...ac49Report, reportNo: e.target.value})} className="input-field font-black uppercase" placeholder="Ej: MAR-01" />
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="flex flex-col md:flex-row items-center gap-6 p-6 bg-blue-50/50 dark:bg-blue-900/5 rounded-[2rem] border border-blue-100">
                        <div className="flex items-center gap-4 text-blue-600">
                          <Clock size={16} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Filtrar por días:</span>
                          <div className="flex items-center gap-2 ml-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-blue-100">
                             <input type="checkbox" id="singleDay" checked={isSingleDayFilter} onChange={e => setIsSingleDayFilter(e.target.checked)} className="rounded border-slate-300 text-blue-600" />
                             <label htmlFor="singleDay" className="text-[9px] font-black uppercase cursor-pointer">Día único</label>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 flex-1">
                          <input type="date" value={laborFilterStart} onChange={(e) => setLaborFilterStart(e.target.value)} className="flex-1 bg-white dark:bg-slate-800 p-2 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" />
                          {!isSingleDayFilter && <input type="date" value={laborFilterEnd} onChange={(e) => setLaborFilterEnd(e.target.value)} className="flex-1 bg-white dark:bg-slate-800 p-2 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" />}
                          {(laborFilterStart || laborFilterEnd) && <button onClick={() => { setLaborFilterStart(""); setLaborFilterEnd(""); }} className="p-2 text-red-500 bg-white dark:bg-slate-800 rounded-xl hover:bg-red-50 transition-colors"><X size={14}/></button>}
                        </div>
                      </div>

                      <div className="w-full overflow-x-auto custom-scrollbar pb-2">
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
                            const lastDate = ac49Report.labor.length > 0 ? (ac49Report.labor[ac49Report.labor.length - 1].date || ac49Report.date) : (laborFilterStart || ac49Report.date);
                            setAc49Report({...ac49Report, labor: [...ac49Report.labor, { id: Date.now().toString(), employeeName: '', date: lastDate, ssLast4: '', classification: '', hoursReg: 0, hours15: 0, hours20: 0, hourlyRate: 0 }]});
                          }}
                          onRemove={(idx) => setAc49Report({...ac49Report, labor: ac49Report.labor.filter(l => l.id !== visibleLabor[idx].id)})}
                          onChange={(idx, key, val) => {
                            const targetItem = visibleLabor[idx];
                            const realIdx = ac49Report.labor.findIndex(l => l.id === targetItem.id);
                            if (realIdx === -1) return;
                            const newLabor = [...ac49Report.labor];
                            (newLabor[realIdx] as any)[key] = val;
                            if (key === 'employeeName' && val) {
                              const suggested = (suggestionsDB as any).labor[String(val).trim().toLowerCase()];
                              if (suggested) {
                                if (!newLabor[realIdx].ssLast4) newLabor[realIdx].ssLast4 = suggested.ssLast4;
                                if (!newLabor[realIdx].classification) newLabor[realIdx].classification = suggested.classification;
                                if (!newLabor[realIdx].hourlyRate) newLabor[realIdx].hourlyRate = suggested.hourlyRate;
                                newLabor[realIdx].employeeName = suggested.employeeName;
                              }
                            }
                            setAc49Report({...ac49Report, labor: newLabor});
                          }}
                        />
                      </div>

                      <div className="w-full overflow-x-auto custom-scrollbar pb-2">
                        <EditableTable<MaterialEntry>
                          title="B. MATERIALES Y/O SERVICIOS"
                          columns={[
                            { header: 'Fecha', key: 'date', type: 'date' },
                            { header: 'Tipo (M) mat. (S) Serv.', key: 'type', type: 'select', options: ['M', 'S', ''] },
                            { header: 'Materiales Usados y/o Servicios Prestados', key: 'description', type: 'text' },
                            { header: 'Vendedor', key: 'supplier', type: 'text' },
                            { header: 'Número de Factura o Conduce', key: 'invoiceNo', type: 'text' },
                            { header: 'Cantidad', key: 'quantity', type: 'number' },
                            { header: '$ Unitario', key: 'unitCost', type: 'number' },
                            { header: 'Monto', key: 'amount', type: 'computed', compute: (row: any) => (parseFloat(row.quantity) || 0) * (parseFloat(row.unitCost) || 0) },
                          ]}
                          data={visibleMaterials}
                          onAdd={() => {
                            const lastDate = ac49Report.materials.length > 0 ? (ac49Report.materials[ac49Report.materials.length - 1].date || ac49Report.date) : (laborFilterStart || ac49Report.date);
                            setAc49Report({...ac49Report, materials: [...ac49Report.materials, { id: Date.now().toString(), date: lastDate, type: '', description: '', supplier: '', invoiceNo: '', quantity: 0, unitCost: 0, amount: 0 }]});
                          }}
                          onRemove={(idx) => setAc49Report({...ac49Report, materials: ac49Report.materials.filter(m => m.id !== visibleMaterials[idx].id)})}
                          onChange={(idx, key, val) => {
                            const targetItem = visibleMaterials[idx];
                            const realIdx = ac49Report.materials.findIndex(m => m.id === targetItem.id);
                            if (realIdx === -1) return;
                            const newMat = [...ac49Report.materials];
                            (newMat[realIdx] as any)[key] = val;
                            if (key === 'description' && val) {
                              const suggested = (suggestionsDB as any).materials?.[String(val).trim().toLowerCase()];
                              if (suggested) {
                                if (!newMat[realIdx].supplier) newMat[realIdx].supplier = suggested.supplier;
                                if (!newMat[realIdx].unitCost) newMat[newMat.length - 1].unitCost = suggested.unitCost;
                                if (!newMat[realIdx].type) newMat[realIdx].type = suggested.type;
                                newMat[realIdx].description = suggested.description;
                              }
                            }
                            setAc49Report({...ac49Report, materials: newMat});
                          }}
                        />
                      </div>

                      <div className="w-full overflow-x-auto custom-scrollbar pb-2">
                        <EditableTable<EquipmentEntry>
                          title="C. EQUIPO EN USO"
                          columns={[
                            { header: 'Fecha', key: 'date', type: 'date' },
                            { header: 'Descripción', key: 'description', type: 'text' },
                            { header: 'Modelo', key: 'model', type: 'text' },
                            { header: 'Año', key: 'year', type: 'text' },
                            { header: 'Capacidad', key: 'capacity', type: 'text' },
                            { header: 'Combustible', key: 'fuelType', type: 'select', options: ['Gasolina', 'Diesel', ''] },
                            { header: 'Propiedad', key: 'ownership', type: 'select', options: ['Alquilado', 'Propio', ''] },
                            { header: 'H. Activas', key: 'hoursActive', type: 'number' },
                            { header: 'H. Inactivas', key: 'hoursInactive', type: 'number' },
                            { header: 'H. Reparación', key: 'hoursRepair', type: 'number' },
                            { header: 'Tarifa', key: 'dailyRate', type: 'number' },
                            { header: 'Total $', key: 'total', type: 'computed', compute: (row: any) => (parseFloat(row.hoursActive) || 0) * (parseFloat(row.dailyRate) || 0) },
                          ]}
                          data={visibleEquipment}
                          onAdd={() => {
                            const lastDate = ac49Report.equipment.length > 0 ? (ac49Report.equipment[ac49Report.equipment.length - 1].date || ac49Report.date) : (laborFilterStart || ac49Report.date);
                            setAc49Report({...ac49Report, equipment: [...ac49Report.equipment, { id: Date.now().toString(), date: lastDate, description: '', model: '', year: '', capacity: '', fuelType: '', ownership: '', isRented: false, hours: 0, hoursActive: 0, hoursInactive: 0, hoursRepair: 0, dailyRate: 0 }]});
                          }}
                          onRemove={(idx) => setAc49Report({...ac49Report, equipment: ac49Report.equipment.filter(e => e.id !== visibleEquipment[idx].id)})}
                          onChange={(idx, key, val) => {
                            const targetItem = visibleEquipment[idx];
                            const realIdx = ac49Report.equipment.findIndex(e => e.id === targetItem.id);
                            if (realIdx === -1) return;
                            const newEq = [...ac49Report.equipment];
                            (newEq[realIdx] as any)[key] = val;
                            
                            // Sync internal hours for compatibility with other report totals
                            if (key === 'hoursActive') {
                              newEq[realIdx].hours = Number(val);
                            }

                            if (key === 'description' && val) {
                              const suggested = (suggestionsDB as any).equipment[String(val).trim().toLowerCase()];
                              if (suggested) {
                                if (!newEq[realIdx].model) newEq[realIdx].model = suggested.model;
                                if (!newEq[realIdx].year) newEq[realIdx].year = suggested.year;
                                if (!newEq[realIdx].capacity) newEq[realIdx].capacity = suggested.capacity;
                                if (!newEq[realIdx].fuelType) newEq[realIdx].fuelType = suggested.fuelType;
                                if (!newEq[realIdx].ownership) newEq[realIdx].ownership = suggested.ownership;
                                if (!newEq[realIdx].dailyRate) newEq[realIdx].dailyRate = suggested.dailyRate;
                                newEq[realIdx].description = suggested.description;
                              }
                            }
                            setAc49Report({...ac49Report, equipment: newEq});
                          }}
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="label-field">Descripción del Trabajo</label>
                        <textarea value={ac49Report.workDescription} onChange={(e) => setAc49Report({...ac49Report, workDescription: e.target.value})} className="input-field min-h-[150px] font-bold p-6" />
                      </div>

                      <div className="fixed bottom-10 right-10 z-50 flex flex-col gap-3">
                        {hasUnsavedChanges && (
                          <div className="bg-amber-100 text-amber-800 px-6 py-2 rounded-2xl text-[9px] font-black uppercase shadow-xl animate-pulse text-center">
                            Cambios sin guardar
                          </div>
                        )}
                        <button 
                           onClick={() => saveData()}
                           className="flex items-center gap-3 px-10 py-5 bg-blue-600 text-white rounded-full text-xs font-black uppercase hover:bg-blue-700 shadow-[0_20px_50px_rgba(37,99,235,0.4)] transition-all active:scale-95 group"
                        >
                          <Save className="group-hover:rotate-12 transition-transform" />
                          Guardar Reporte Diario (AC-49)
                        </button>
                      </div>

                      <div className="space-y-8 pb-32"></div>
                    </div>
                  </div>
                )}

                {activeTab === 'ac50' && (
                  <div className="space-y-10 animate-in fade-in duration-700">
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[3rem] p-10 shadow-xl overflow-hidden">
                       <div className="text-center mb-10">
                          <h2 className="text-xs font-black uppercase tracking-[0.4em] text-slate-400 mb-2">Autoridad de Carreteras y Transportación</h2>
                          <h1 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Relación de Equipo del Trabajo por Administración Delegada (AC-50)</h1>
                       </div>

                       {/* Parte A: Detalle del Tiempo Trabajado */}
                       <div className="mb-10 overflow-x-auto">
                          <div className="flex justify-between items-end mb-4">
                             <h4 className="text-[10px] font-black uppercase bg-slate-900 text-white px-4 py-2 inline-block rounded-t-xl mb-0">Parte A: Detalle del Tiempo Trabajado</h4>
                             <p className="text-[9px] text-slate-400 font-bold uppercase italic">Reporte basado en horas activas de AC-49</p>
                          </div>
                          <table className="w-full border-collapse border border-slate-900 text-[9px]">
                             <thead>
                                <tr className="bg-slate-50">
                                    <th className="border border-slate-900 p-1 w-8 font-black bg-slate-100 italic">A</th>
                                    <th className="border border-slate-900 p-1 min-w-[200px] uppercase font-black text-center bg-slate-100">Día de la semana</th>
                                    {Array.from({length: 31}, (_, i) => {
                                      const [year, month] = ac51Month.split('-').map(Number);
                                      const d = new Date(year, month - 1, i + 1);
                                      const weekDay = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'][d.getDay()];
                                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                      return (
                                        <th key={i} className={`border border-slate-900 p-1 text-center font-black w-[26px] text-[7px] ${isWeekend ? 'bg-slate-200 text-slate-600' : 'bg-white'}`}>
                                          {weekDay}
                                        </th>
                                      );
                                    })}
                                    <th rowSpan={2} className="border border-slate-900 p-1 text-center bg-blue-600 text-white font-black min-w-[40px]">Total</th>
                                 </tr>
                                 <tr className="bg-slate-50 text-[8px]">
                                    <th className="border border-slate-900 p-1 font-black bg-slate-200 italic">#</th>
                                    <th className="border border-slate-900 p-1 uppercase font-black text-center bg-slate-100">Día del mes</th>
                                    {Array.from({length: 31}, (_, i) => (
                                      <th key={i} className="border border-slate-900 p-1 text-center font-black w-[26px] bg-slate-50">
                                        {i + 1}
                                      </th>
                                    ))}
                                </tr>
                             </thead>
                              <tbody>
                                 {ac50DailyDetail.length === 0 ? (
                                    <tr>
                                       <td colSpan={34} className="border border-slate-900 p-10 text-center text-slate-300 font-bold uppercase italic bg-slate-50/20">
                                          No se ha registrado uso de equipo en los reportes diarios de este mes.
                                       </td>
                                    </tr>
                                 ) : ac50DailyDetail.map((row, idx) => {
                                   let totalAct = row.days.slice(1).reduce((a:number, b:number) => a+b, 0);
                                   return (
                                     <tr key={idx} className="hover:bg-blue-50/40 transition-all group">
                                        <td className="border border-slate-900 p-1 text-center font-black bg-slate-100 group-hover:bg-blue-100/50 text-[8px]">{idx + 1}</td>
                                        <td className="border border-slate-900 p-1.5 uppercase font-black text-[8px] leading-tight text-left">
                                           <div className="flex flex-col">
                                              <span className="text-slate-900">{row.equipment.description}</span>
                                              <span className="text-blue-600 text-[6px] font-bold mt-0.5 opacity-80">{row.equipment.model}</span>
                                           </div>
                                        </td>
                                        {Array.from({length: 31}, (_, i) => {
                                          const hasHours = row.days[i+1] > 0;
                                          return (
                                            <td key={i} className={`border border-slate-900 p-1 text-center font-black transition-all ${hasHours ? 'text-blue-700 bg-blue-100/60' : 'text-slate-300'}`}>
                                              {row.days[i+1] || ""}
                                            </td>
                                          );
                                        })}
                                        <td className="border border-slate-900 p-1 text-center font-black bg-blue-50 text-blue-700 group-hover:bg-blue-100 shadow-inner">{totalAct}</td>
                                     </tr>
                                   );
                                 })}
                              </tbody>
                          </table>
                       </div>

                       {/* Parte B: Cálculos */}
                       <div className="overflow-x-auto">
                          <h4 className="text-[10px] font-black uppercase bg-slate-900 text-white px-4 py-2 inline-block rounded-t-xl mb-0">Parte B: Resumen de Costos (Operación aa a nn)</h4>
                          <table className="w-full border-collapse border border-slate-900 text-[9px]">
                             <thead>
                                <tr className="bg-slate-800 text-white font-black text-center">
                                   <th className="border border-slate-900 p-2">aa</th>
                                   <th className="border border-slate-900 p-2">bb</th>
                                   <th className="border border-slate-900 p-2">cc</th>
                                   <th className="border border-slate-900 p-2">dd</th>
                                   <th className="border border-slate-900 p-2">ee</th>
                                   <th className="border border-slate-900 p-2">ff</th>
                                   <th className="border border-slate-900 p-2">gg</th>
                                   <th className="border border-slate-900 p-2">hh</th>
                                   <th className="border border-slate-900 p-2">ii</th>
                                   <th className="border border-slate-900 p-2">jj</th>
                                   <th className="border border-slate-900 p-2">kk</th>
                                   <th className="border border-slate-900 p-2">ll</th>
                                   <th className="border border-slate-900 p-2">mm</th>
                                   <th className="border border-slate-900 p-2 bg-blue-600">nn</th>
                                </tr>
                                <tr className="bg-slate-100 text-[7px] uppercase font-black text-center">
                                   <th className="border border-slate-900 p-1 w-20">Renta Mensual</th>
                                   <th className="border border-slate-900 p-1 w-20">Renta / Hora</th>
                                   <th className="border border-slate-900 p-1 w-12">Factor Años</th>
                                   <th className="border border-slate-900 p-1 w-12">Factor Zona</th>
                                   <th className="border border-slate-900 p-1 w-20">Rent/Hr (ee)</th>
                                   <th className="border border-slate-900 p-1 w-12">Hrs Ina</th>
                                   <th className="border border-slate-900 p-1 w-20">Rent. Ina</th>
                                   <th className="border border-slate-900 p-1 w-12">Hrs Tot</th>
                                   <th className="border border-slate-900 p-1 w-20">Rent. Tot</th>
                                   <th className="border border-slate-900 p-1 w-12">Hrs Act</th>
                                   <th className="border border-slate-900 p-1 w-20">Cost Ops</th>
                                   <th className="border border-slate-900 p-1 w-20">Rent Act H</th>
                                   <th className="border border-slate-900 p-1 w-20">Rent Act M</th>
                                   <th className="border border-slate-900 p-1 w-24 bg-blue-50 text-blue-800">Tot Renta Eq</th>
                                </tr>
                             </thead>
                             <tbody>
                                {ac50Equipment.map((eq, idx) => (
                                  <tr key={idx} className="font-bold hover:bg-slate-50 transition-colors">
                                     <td className="border border-slate-900 p-1.5 text-right font-black">
                                         <input 
                                           type="number" 
                                           value={eq.aa_rentaMensual || ''} 
                                           onChange={(e) => updateEquipmentConfig(`${eq.description}-${eq.model}`.toUpperCase(), 'aa_rentaMensual', Number(e.target.value))}
                                           className="w-full bg-transparent border-none text-right font-black text-blue-600 outline-none p-0"
                                           placeholder="0.00"
                                         />
                                     </td>
                                     <td className="border border-slate-900 p-1.5 text-right bg-slate-50/50">{formatCurrency(eq.bb)}</td>
                                     <td className="border border-slate-900 p-1.5 text-center">
                                         <input 
                                           type="number" 
                                           value={eq.cc || ''} 
                                           onChange={(e) => updateEquipmentConfig(`${eq.description}-${eq.model}`.toUpperCase(), 'cc_factorAnos', Number(e.target.value))}
                                           className="w-full bg-transparent border-none text-center font-bold text-slate-700 outline-none p-0"
                                           placeholder="1"
                                         />
                                     </td>
                                     <td className="border border-slate-900 p-1.5 text-center">
                                         <input 
                                           type="number" 
                                           value={eq.dd || ''} 
                                           onChange={(e) => updateEquipmentConfig(`${eq.description}-${eq.model}`.toUpperCase(), 'dd_factorZona', Number(e.target.value))}
                                           className="w-full bg-transparent border-none text-center font-bold text-slate-700 outline-none p-0"
                                           placeholder="1"
                                         />
                                     </td>
                                     <td className="border border-slate-900 p-1.5 text-right font-bold bg-slate-50">{formatCurrency(eq.ee)}</td>
                                     <td className="border border-slate-900 p-1.5 text-center">
                                         <input 
                                           type="number" 
                                           value={eq.ff || ''} 
                                           onChange={(e) => updateEquipmentConfig(`${eq.description}-${eq.model}`.toUpperCase(), 'ff_horasInactivas', Number(e.target.value))}
                                           className="w-full bg-transparent border-none text-center font-bold text-blue-600 outline-none p-0"
                                           placeholder="0"
                                         />
                                     </td>
                                     <td className="border border-slate-900 p-1.5 text-right italic text-slate-500">{formatCurrency(eq.gg)}</td>
                                     <td className="border border-slate-900 p-1.5 text-center bg-slate-50/50">{eq.hh}</td>
                                     <td className="border border-slate-900 p-1.5 text-right text-slate-500">{formatCurrency(eq.ii)}</td>
                                     <td className="border border-slate-900 p-1.5 text-center font-black bg-blue-50/30 text-blue-600">{eq.jj}</td>
                                     <td className="border border-slate-900 p-1.5 text-right">
                                         <input 
                                           type="number" 
                                           value={eq.kk || ''} 
                                           onChange={(e) => updateEquipmentConfig(`${eq.description}-${eq.model}`.toUpperCase(), 'kk_costoOperacion', Number(e.target.value))}
                                           className="w-full bg-transparent border-none text-right font-bold text-blue-600 outline-none p-0"
                                           placeholder="0.00"
                                         />
                                     </td>
                                     <td className="border border-slate-900 p-1.5 text-right font-bold">{formatCurrency(eq.ll)}</td>
                                     <td className="border border-slate-900 p-1.5 text-right font-bold">{formatCurrency(eq.mm)}</td>
                                     <td className="border border-slate-900 p-1.5 text-right bg-blue-600 text-white font-black shadow-inner">{formatCurrency(eq.nn)}</td>
                                  </tr>
                                ))}
                             </tbody>
                             <tfoot className="bg-slate-900 text-white font-black text-[10px]">
                                <tr>
                                   <td colSpan={13} className="border border-slate-900 p-3 text-right uppercase italic tracking-widest">Total Consolidado AC-50</td>
                                   <td className="border border-slate-900 p-3 text-right text-emerald-400 text-xs">
                                     {formatCurrency(ac50Equipment.reduce((a, b) => a + b.nn, 0))}
                                   </td>
                                </tr>
                             </tfoot>
                          </table>
                       </div>
                    </div>
                  </div>
                )}

                {activeTab === 'ac51' && (
                  <div className="space-y-16 animate-in fade-in duration-1000">
                    <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-slate-100 dark:border-slate-800 pb-12">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                           <div className="w-4 h-12 bg-blue-600 rounded-full"></div>
                           <h3 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">Liquidación Mensual (AC-51)</h3>
                        </div>
                        <p className="text-slate-400 text-xs font-black uppercase tracking-[0.4em] ml-6 opacity-60">Consolidación de Recursos y Beneficios</p>
                      </div>
                      <div className="flex items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl min-w-[300px]">
                        <Calendar className="text-blue-600" size={24} />
                        <div className="flex-1">
                           <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Periodo de Liquidación</p>
                           <input type="month" value={ac51Month} onChange={(e) => setAc51Month(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-2 text-sm font-black outline-none border border-slate-100 dark:border-slate-700" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-20">
                       {[
                         { label: 'A) MANO DE OBRA', key: 'labor' as const, color: 'blue' },
                         { label: 'B) MATERIALES Y SERVICIOS', key: 'mats' as const, color: 'emerald' },
                         { label: 'C) EQUIPO', key: 'equip' as const, color: 'amber' }
                       ].map((section) => {
                         const [year, month] = ac51Month.split('-').map(Number);
                         const lastDay = new Date(year, month, 0).getDate();
                         
                         const getDayData = (day: number) => {
                           const dateStr = `${ac51Month}-${String(day).padStart(2, '0')}`;
                           const dayReport = ac51Data.find(r => r.date === dateStr);
                           const d = new Date(year, month - 1, day);
                           const weekDays = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
                           return { day, weekDay: weekDays[d.getDay()], amount: dayReport ? (dayReport as any)[section.key] : 0 };
                         };

                         const renderTableBlock = (start: number, end: number) => {
                           const subtotal = Array.from({length: end - start + 1}, (_, i) => getDayData(start + i).amount).reduce((a, b) => a + b, 0);
                           return (
                             <div className="flex-1 min-w-[280px] space-y-4">
                               <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                                 <table className="w-full text-[10px] uppercase font-bold">
                                   <thead>
                                     <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-400 border-b border-slate-100 dark:border-slate-700">
                                       <th className="px-5 py-4 text-left border-r dark:border-slate-700">Día Sem.</th>
                                       <th className="px-5 py-4 text-center border-r dark:border-slate-700">Día Mes</th>
                                       <th className="px-5 py-4 text-right">Monto</th>
                                     </tr>
                                   </thead>
                                   <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                                     {Array.from({ length: end - start + 1 }, (_, i) => {
                                       const d = start + i;
                                       if (d > lastDay) return null;
                                       const data = getDayData(d);
                                       return (
                                         <tr key={d} className="hover:bg-blue-50/20 transition-colors">
                                           <td className="px-5 py-3 border-r dark:border-slate-700 text-slate-400 font-black">{data.weekDay}</td>
                                           <td className="px-5 py-3 border-r dark:border-slate-700 font-black text-center text-slate-700 dark:text-slate-300">{data.day}</td>
                                           <td className={`px-5 py-3 text-right font-black ${data.amount > 0 ? 'text-blue-600' : 'text-slate-200'}`}>{formatCurrency(data.amount)}</td>
                                         </tr>
                                       );
                                     })}
                                   </tbody>
                                 </table>
                               </div>
                               <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-3xl flex justify-between items-center border border-slate-100 dark:border-slate-700 shadow-inner">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Subtotal ({start}-{end})</span>
                                  <b className="text-sm font-black text-slate-900 dark:text-white">{formatCurrency(subtotal)}</b>
                               </div>
                             </div>
                           );
                         };

                         return (
                           <div key={section.key} className="space-y-8">
                              <div className="flex items-center gap-4 ml-4">
                                 <div className={`w-3 h-8 rounded-full ${section.color === 'blue' ? 'bg-blue-600' : section.color === 'emerald' ? 'bg-emerald-600' : 'bg-amber-500'}`}></div>
                                 <h4 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{section.label}</h4>
                              </div>
                              
                              <div className="flex flex-col xl:flex-row gap-8">
                                 {renderTableBlock(1, 10)}
                                 {renderTableBlock(11, 20)}
                                 {renderTableBlock(21, 31)}
                              </div>

                              {section.key === 'labor' && (
                                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[3.5rem] p-12 shadow-2xl mt-12">
                                    <h5 className="text-[11px] font-black text-blue-600 uppercase tracking-[0.4em] mb-10 flex items-center gap-3">
                                       <Users size={18} /> Resumen de Costos de Mano de Obra
                                    </h5>
                                    <div className="space-y-1">
                                       {[
                                         { id: 'a', label: 'a) Subtotal Operadores (Unión Equipo Pesado)', value: summary.detailedLabor?.mo_op },
                                         { id: 'b', label: `b) Beneficios Marginales ${ac49Report.laborDetails?.mo_operadores_pct || 0}% de (a)`, value: (summary.detailedLabor?.mo_op || 0) * ((ac49Report.laborDetails?.mo_operadores_pct || 0)/100) },
                                         { id: 'c', label: 'c) Subtotal Carpinteros (Unión de Carpinteros)', value: summary.detailedLabor?.mo_ca },
                                         { id: 'd', label: `d) Beneficios Marginales ${ac49Report.laborDetails?.mo_carpinteros_pct || 0}% de (c)`, value: (summary.detailedLabor?.mo_ca || 0) * ((ac49Report.laborDetails?.mo_carpinteros_pct || 0)/100) },
                                         { id: 'e', label: 'e) Subtotal Personal Adicional', value: summary.detailedLabor?.mo_ad },
                                         { id: 'f', label: `f) Beneficios Marginales ${ac49Report.laborDetails?.mo_adicional_pct || 0}% de (e)`, value: (summary.detailedLabor?.mo_ad || 0) * ((ac49Report.laborDetails?.mo_adicional_pct || 0)/100) },
                                         { id: 'g', label: 'g) Suma de (a, b, c, d, e, f)', value: summary.detailedLabor?.g, highlight: true },
                                         { id: 'h', label: 'h) Subtotal Mano de Obra (Sin Unión)', value: summary.detailedLabor?.h_subtotal },
                                         { id: 'i', label: `i) Beneficios Marginales ${ac49Report.laborDetails?.mo_sin_union_pct || 0}% de (h)`, value: (summary.detailedLabor?.h_subtotal || 0) * ((ac49Report.laborDetails?.mo_sin_union_pct || 0)/100) },
                                         { id: 'j', label: 'j) Gastos de Viaje y Dietas', value: ac49Report.laborDetails?.mo_gastos_viaje || 0 },
                                         { id: 'k', label: 'k) Suma Base (g+j) ó (h+i+j)', value: summary.detailedLabor?.k, highlight: true },
                                         { id: 'l', label: `l) Beneficio Industrial ${ac49Report.laborDetails?.mo_beneficio_ind_pct || 20}% de (k)`, value: summary.detailedLabor?.l },
                                         { id: 'm', label: 'm) Suma de (k+l)', value: summary.detailedLabor?.m_val, highlight: true },
                                         { id: 'n', label: `n) Fondo Seguro Estado ${ac49Report.laborDetails?.mo_fondo_estado_pct || 0}% de (h)`, value: summary.detailedLabor?.n },
                                         { id: 'o', label: `o) Seguro Social ${ac49Report.laborDetails?.mo_seguro_social_pct || 7.65}% de (h)`, value: summary.detailedLabor?.o },
                                         { id: 'p', label: `p) Seguro Desempleo (6.2%) de (h)`, value: summary.detailedLabor?.p },
                                         { id: 'q', label: `q) Seg. Resp. Pública ${ac49Report.laborDetails?.mo_resp_publica_pct || 0}% de (h)`, value: summary.detailedLabor?.q },
                                         { id: 'r', label: `r) Seguro Incapacidad ${ac49Report.laborDetails?.mo_incapacidad_pct || 0}% de (h)`, value: summary.detailedLabor?.r },
                                         { id: 's', label: 's) Suma de (n, o, p, q, r)', value: summary.detailedLabor?.s, highlight: true },
                                         { id: 't', label: `t) Beneficio Industrial ${ac49Report.laborDetails?.mo_beneficio_ind_final_pct || 10}% de (s)`, value: summary.detailedLabor?.t },
                                         { id: 'mo_total', label: '(1) TOTAL DE MANO DE OBRA (m+s+t)', value: summary.detailedLabor?.total, total: true }
                                       ].map((row) => (
                                         <div key={row.id} className={`flex justify-between items-center px-8 py-1.5 rounded-2xl ${row.total ? 'bg-blue-600 text-white shadow-2xl' : row.highlight ? 'bg-slate-50 dark:bg-slate-800 ring-1 ring-slate-100 dark:ring-slate-700 transition-all hover:bg-slate-100 dark:hover:bg-slate-700' : ''}`}>
                                            <span className={`text-[10px] uppercase tracking-wide ${row.total || row.highlight ? 'font-black' : 'font-bold text-slate-500'}`}>{row.label}</span>
                                            <b className={`${row.total ? 'text-lg' : 'text-sm'} font-black text-right min-w-[120px]`}>{formatCurrency(row.value || 0)}</b>
                                         </div>
                                       ))}
                                    </div>
                                </div>
                              )}
                           </div>
                         );
                       })}

                       {/* Gran Total Mensual (Efecto Premium) */}
                       <div className="bg-white dark:bg-slate-900 p-16 rounded-[4rem] border border-slate-100 dark:border-slate-800 shadow-[0_50px_100px_rgba(0,0,0,0.05)] relative overflow-hidden group">
                          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] -mr-64 -mt-64 transition-transform group-hover:scale-110 duration-1000"></div>
                          <div className="relative z-10 space-y-16">
                            <div className="flex flex-col md:flex-row justify-between items-center gap-12 text-center md:text-left">
                                <div className="space-y-4">
                                   <div className="flex items-center justify-center md:justify-start gap-4">
                                      <div className="w-3 h-12 bg-emerald-500 rounded-full"></div>
                                      <h3 className="text-6xl font-black uppercase tracking-tighter text-slate-900 dark:text-white italic">Gran Total</h3>
                                   </div>
                                   <p className="text-slate-400 text-xs font-black uppercase tracking-[0.5em] ml-2 opacity-60">Certificación Final Consolidada</p>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800/80 p-12 rounded-[4rem] border border-slate-100 dark:border-slate-700 shadow-inner flex flex-col items-center md:items-end gap-2 px-16">
                                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.6em] mb-2">Liquidación Mensual</div>
                                   <div className="text-7xl font-black text-emerald-600 tracking-tighter flex items-center gap-6">
                                      <DollarSign size={54} className="text-emerald-500/20" />
                                      {formatCurrency(summary.grandTotal)}
                                   </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                                {[
                                  { label: 'Mano de Obra', value: summary.detailedLabor?.total, color: 'blue' },
                                  { label: 'Materiales', value: summary.detailedMaterials?.total, color: 'emerald' },
                                  { label: 'Equipo', value: summary.detailedEquipment?.total, color: 'amber' }
                                ].map((item, idx) => (
                                  <div key={idx} className="bg-white dark:bg-slate-800/30 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-700 shadow-xl transition-all hover:shadow-2xl hover:-translate-y-1 group/card">
                                     <div className="flex flex-col items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${item.color === 'blue' ? 'bg-blue-600' : item.color === 'emerald' ? 'bg-emerald-600' : 'bg-amber-500'}`}>
                                           {item.color === 'blue' ? <Users size={24}/> : item.color === 'emerald' ? <Calculator size={24}/> : <Truck size={24}/>}
                                        </div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.label}</p>
                                        <b className={`text-2xl font-black ${item.color === 'blue' ? 'text-blue-600' : item.color === 'emerald' ? 'text-emerald-600' : 'text-amber-500'}`}>
                                           {formatCurrency(item.value || 0)}
                                        </b>
                                     </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                       </div>
                    </div>

                    <div className="flex justify-end gap-6 pt-10">
                       <button 
                         onClick={exportData}
                         className="px-12 py-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-3xl transition-all shadow-2xl shadow-emerald-500/20 active:scale-95 flex items-center gap-4 uppercase tracking-widest text-xs"
                       >
                         <Download size={20} /> Exportar Reporte Mensual (AC-51)
                       </button>
                    </div>
                  </div>
                )}
