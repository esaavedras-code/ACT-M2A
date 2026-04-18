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
    // Agrupar reportes del mes seleccionado
    const monthReports = reports.filter(r => r.date && r.date.startsWith(ac51Month));
    
    return monthReports.map(r => {
      const rd = (r.data || {}) as any;
      const labor = (rd.labor || []).reduce((acc: number, l: any) => {
        const reg = (Number(l.hoursReg) || 0) * (Number(l.hourlyRate) || 0);
        const ot15 = (Number(l.hours15) || 0) * (Number(l.hourlyRate) || 0) * 1.5;
        const ot20 = (Number(l.hours20) || 0) * (Number(l.hourlyRate) || 0) * 2.0;
        return acc + reg + ot15 + ot20;
      }, 0);
      
      const equip = (rd.equipment || []).reduce((acc: number, e: any) => {
        // Usar lógica de renta si están los campos, sino básica
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

      const mats = (rd.materials || []).reduce((acc: number, m: any) => {
        return acc + ((Number(m.quantity) || 0) * (Number(m.unitCost) || 0));
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
        const amount = ac51Data.find(r => r.date === isoDate)?.total || 0;
        return { day, sem, amount, isWeekend };
      });
    } catch (e) {
      return [];
    }
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

  const updateEquipmentConfig = (key: string, field: string, val: number) => {
    // Para simplificar, actualizamos los campos en el reporte actual si coincide el equipo
    // Esto se propagará al resumen ya que ac50Equipment depende de `reports`
    const newEq = ac49Report.equipment.map(e => {
        const itemKey = `${e.description?.trim()}-${e.model?.trim()}`.toUpperCase();
        if (itemKey === key) return { ...e, [field]: val };
        return e;
    });
    setAc49Report({ ...ac49Report, equipment: newEq });
  };

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
            laborDetails: ac49Report.laborDetails
          }
        })
        .eq("id", selectedReportId);

      if (error) throw error;
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
        photos: ac49Report.photos
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
                <button onClick={() => setActiveTab('dashboard')} className="group flex items-center gap-2 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 hover:text-blue-600 transition-all shadow-sm">
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
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                  <Upload size={14} /> Importar JSON
                </button>
                <button onClick={() => saveData()} className="btn-primary" disabled={loading}>
                  <ShieldCheck size={14} /> {loading ? "..." : "Guardar"}
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredReports.length > 0 ? filteredReports.map(r => (
                      <div key={r.id} onClick={() => handleSelectReport(r)} className={`group p-6 rounded-[2.5rem] border-2 transition-all cursor-pointer ${selectedReportId === r.id ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-blue-200'}`}>
                         <div className="flex justify-between items-start">
                            <div className="space-y-1">
                               <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${selectedReportId === r.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{r.report_no}</span>
                                  <span className="text-[10px] text-slate-400 font-bold">{r.date}</span>
                               </div>
                               <h5 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight line-clamp-1">{r.description || 'Sin descripción'}</h5>
                            </div>
                         </div>
                      </div>
                    )) : <div className="col-span-full py-20 text-center text-slate-400 italic font-bold">No hay reportes de Force Account 2.</div>}
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

                      <div className="flex flex-col md:flex-row items-center gap-4 mt-8 pt-8 border-t border-slate-100">
                        <button onClick={() => saveData()} disabled={loading} className="w-full md:w-auto px-12 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-3xl transition-all shadow-xl shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest text-xs">
                          {loading ? "..." : <Save size={18} />}Guardar Reporte
                        </button>
                        <button onClick={splitIntoDays} disabled={loading || !ac49Report.labor.length} className="w-full md:w-auto px-8 py-4 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-3xl active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest text-xs">
                          <Split size={18} />Dividir por Días
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'ac50' && (
                  <div className="card space-y-8">
                    <div className="bg-blue-600/5 dark:bg-blue-600/10 p-8 rounded-[2.5rem] border border-blue-100 dark:border-blue-900/30 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                          <Truck size={32} />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Resumen de Renta Mensual</h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Consolidado basado en reportes AC-49</p>
                        </div>
                      </div>
                      <div className="text-right">
                         <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Total Renta Estimado</p>
                         <p className="text-3xl font-black text-blue-600 dark:text-blue-400 tracking-tighter">{formatCurrency(summary.rentTotal)}</p>
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-[2.5rem] border bg-slate-50/30">
                       <h4 className="px-8 py-4 bg-white dark:bg-slate-900 border-b text-[10px] font-black uppercase tracking-widest text-emerald-600">Parte B: Relación de Equipo (Cálculo Mensual)</h4>
                       <table className="min-w-[1200px] w-full text-left">
                         <thead>
                           <tr className="bg-slate-50 dark:bg-slate-900 text-[8px] text-slate-400 font-black uppercase tracking-tight border-b">
                             <th className="px-4 py-3 border-r">Descripción</th>
                             <th className="px-4 py-3 text-center border-r">aa. Renta Mensual</th>
                             <th className="px-4 py-3 text-center border-r">bb. Renta Hora</th>
                             <th className="px-4 py-3 text-center border-r">cc. Factor Años</th>
                             <th className="px-4 py-3 text-center border-r">dd. Factor Zona</th>
                             <th className="px-4 py-3 text-center border-r">ee. Renta Hora (bb*cc*dd)</th>
                             <th className="px-4 py-3 text-center border-r">ff. H. Inact.</th>
                             <th className="px-4 py-3 text-center border-r">gg. Rent. Inac. (ee*ff)</th>
                             <th className="px-4 py-3 text-center border-r">jj. H. Activas</th>
                             <th className="px-4 py-3 text-center border-r">hh. H. Totales</th>
                             <th className="px-4 py-3 text-center border-r">ii. Rent. Tot. (ee*hh)</th>
                             <th className="px-4 py-3 text-center border-r">kk. Costo Op.</th>
                             <th className="px-4 py-3 text-center border-r">ll. Rent. Act. H.</th>
                             <th className="px-4 py-3 text-center border-r">mm. Rent. Act. M.</th>
                             <th className="px-4 py-3 text-right">nn. Total Renta</th>
                           </tr>
                         </thead>
                         <tbody className="divide-y text-[9px] font-bold">
                           {ac50Equipment.map((eq: any) => {
                             const key = `${eq.description?.trim()}-${eq.model?.trim()}`.toUpperCase();
                             return (
                               <tr key={key} className="hover:bg-slate-100/50">
                                 <td className="px-4 py-3 border-r bg-white dark:bg-slate-900">{eq.description}</td>
                                 <td className="px-4 py-3 border-r text-center">
                                    <input type="number" step="any" value={eq.aa || ''} onChange={(e) => updateEquipmentConfig(key, 'aa_rentaMensual', Number(e.target.value))} className="w-20 bg-slate-50 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 rounded px-2 py-1 text-center font-bold text-blue-600 outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" />
                                 </td>
                                 <td className="px-4 py-3 border-r text-center bg-slate-50/50">{eq.bb.toFixed(2)}</td>
                                 <td className="px-4 py-3 border-r text-center">
                                    <input type="number" step="any" value={eq.cc || ''} onChange={(e) => updateEquipmentConfig(key, 'cc_factorAnos', Number(e.target.value))} className="w-12 bg-slate-50 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 rounded px-1 py-1 text-center font-bold text-blue-600 outline-none focus:ring-2 focus:ring-blue-500" placeholder="1" />
                                 </td>
                                 <td className="px-4 py-3 border-r text-center">
                                    <input type="number" step="any" value={eq.dd || ''} onChange={(e) => updateEquipmentConfig(key, 'dd_factorZona', Number(e.target.value))} className="w-12 bg-slate-50 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 rounded px-1 py-1 text-center font-bold text-blue-600 outline-none focus:ring-2 focus:ring-blue-500" placeholder="1" />
                                 </td>
                                 <td className="px-4 py-3 border-r text-center bg-slate-50/50">{eq.ee.toFixed(2)}</td>
                                 <td className="px-4 py-3 border-r text-center">
                                    <input type="number" step="any" value={eq.ff || ''} onChange={(e) => updateEquipmentConfig(key, 'ff_horasInactivas', Number(e.target.value))} className="w-12 bg-slate-50 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 rounded px-1 py-1 text-center font-bold text-blue-600 outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" />
                                 </td>
                                 <td className="px-4 py-3 border-r text-center bg-blue-50/30">{eq.gg.toFixed(2)}</td>
                                 <td className="px-4 py-3 border-r text-center font-black">{eq.jj}</td>
                                 <td className="px-4 py-3 border-r text-center bg-slate-50/50">{eq.hh}</td>
                                 <td className="px-4 py-3 border-r text-center">{eq.ii.toFixed(2)}</td>
                                 <td className="px-4 py-3 border-r text-center">
                                    <input type="number" step="any" value={eq.kk || ''} onChange={(e) => updateEquipmentConfig(key, 'kk_costoOperacion', Number(e.target.value))} className="w-16 bg-slate-50 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 rounded px-2 py-1 text-center font-bold text-blue-600 outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" />
                                 </td>
                                 <td className="px-4 py-3 border-r text-center bg-slate-50/50">{eq.ll.toFixed(2)}</td>
                                 <td className="px-4 py-3 border-r text-center">{eq.mm.toFixed(2)}</td>
                                 <td className="px-4 py-3 text-right font-black text-blue-600">{formatCurrency(eq.nn)}</td>
                               </tr>
                             );
                           })}
                         </tbody>
                         <tfoot>
                            <tr className="bg-slate-900 text-white font-black text-[10px]">
                               <td colSpan={7} className="px-4 py-4 text-right">TOTAL RENTA AC-50</td>
                               <td className="px-4 py-4 text-center">{formatCurrency(ac50Equipment.reduce((a, b) => a + b.gg, 0))}</td>
                               <td colSpan={2}></td>
                               <td className="px-4 py-4 text-center">{formatCurrency(ac50Equipment.reduce((a,b) => a + b.ii, 0))}</td>
                               <td colSpan={2}></td>
                               <td className="px-4 py-4 text-center">{formatCurrency(ac50Equipment.reduce((a, b) => a + b.mm, 0))}</td>
                               <td className="px-4 py-4 text-right text-emerald-400">{formatCurrency(ac50Equipment.reduce((a, b) => a + b.nn, 0))}</td>
                            </tr>
                         </tfoot>
                       </table>
                    </div>
                  </div>
                )}

                {activeTab === 'ac51' && (
                  <div className="space-y-10 animate-in fade-in duration-700">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-100 dark:border-slate-800 pb-8">
                      <div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter flex items-center gap-3">
                          <FileText className="text-blue-600" /> AC-51: Resumen Mensual
                        </h3>
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-2">Resumen consolidado por mes</p>
                      </div>
                      <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-700">
                        <span className="text-[10px] font-black uppercase text-slate-400">Mes:</span>
                        <input type="month" value={ac51Month} onChange={(e) => setAc51Month(e.target.value)} className="bg-white dark:bg-slate-900 rounded-xl px-4 py-2 text-sm font-bold outline-none" />
                      </div>
                    </div>

                    <div className="space-y-8">
                       {[
                         { label: 'A) MANO DE OBRA', key: 'labor' as const, subtotal: ac51Data.reduce((acc, r) => acc + r.labor, 0) },
                         { label: 'B) MATERIALES Y SERVICIOS', key: 'mats' as const, subtotal: ac51Data.reduce((acc, r) => acc + r.mats, 0) },
                         { label: 'C) EQUIPO', key: 'equip' as const, subtotal: ac51Data.reduce((acc, r) => acc + r.equip, 0) }
                       ].map((section) => {
                         const [year, month] = ac51Month.split('-').map(Number);
                         const daysInMonth = new Date(year, month, 0).getDate();
                         
                         const getDayData = (day: number) => {
                           const dateStr = `${ac51Month}-${String(day).padStart(2, '0')}`;
                           const dayReport = ac51Data.find(r => r.date === dateStr);
                           const d = new Date(year, month - 1, day);
                           const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                           return { day, weekDay: weekDays[d.getDay()], amount: dayReport ? (dayReport as any)[section.key] : 0 };
                         };

                         const renderTableBlock = (start: number, end: number) => (
                           <div className="flex-1 min-w-[200px] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                             <table className="w-full text-[9px] uppercase font-black">
                               <thead>
                                 <tr className="bg-slate-50 dark:bg-slate-800 border-b text-slate-400">
                                   <th className="px-2 py-2 border-r">Día Sem.</th>
                                   <th className="px-2 py-2 border-r">Día Mes</th>
                                   <th className="px-2 py-2 text-right">Monto</th>
                                 </tr>
                               </thead>
                               <tbody>
                                 {Array.from({ length: end - start + 1 }, (_, i) => {
                                   const d = start + i;
                                   if (d > daysInMonth) return null;
                                   const data = getDayData(d);
                                   return (
                                     <tr key={d} className="border-b last:border-0 hover:bg-blue-50/20 transition-colors">
                                       <td className="px-2 py-2 border-r text-slate-400">{data.weekDay}</td>
                                       <td className="px-2 py-2 border-r font-bold">{data.day}</td>
                                       <td className={`px-2 py-2 text-right font-bold ${data.amount > 0 ? 'text-blue-600' : 'text-slate-300'}`}>{formatCurrency(data.amount)}</td>
                                     </tr>
                                   );
                                 })}
                               </tbody>
                             </table>
                           </div>
                         );

                         return (
                           <div key={section.key} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-8 shadow-xl">
                             <div className="flex items-center justify-between mb-6">
                               <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-3">
                                 <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
                                 {section.label}
                               </h4>
                               <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-xl">
                                 {section.key === 'equip' ? 'Resumen Parte B' : 'Informe Diario'}
                               </div>
                             </div>

                             {section.key !== 'equip' && (
                               <div className="flex flex-col xl:flex-row gap-6">
                                 {renderTableBlock(1, 10)}
                                 {renderTableBlock(11, 20)}
                                 {renderTableBlock(21, 31)}
                               </div>
                             )}

                             {section.key === 'equip' && (
                               <div className="bg-slate-50 dark:bg-slate-800/30 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 mb-6 font-bold text-slate-400 text-[10px] italic text-center">
                                 Para llenar los subtotales de equipo, refiérase a la hoja de Relación de Equipo del Trabajo por Administración Delegada, parte B.
                               </div>
                             )}

                             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                               {section.key !== 'equip' && (
                                 <>
                                   <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl flex justify-between items-center border border-slate-100 dark:border-slate-700">
                                     <span className="text-[9px] font-black text-slate-400 uppercase">Subtotal (1-10)</span>
                                     <b className="text-xs font-black">{formatCurrency(Array.from({length: 10}, (_, i) => getDayData(i+1).amount).reduce((a,b) => a+b, 0))}</b>
                                   </div>
                                   <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl flex justify-between items-center border border-slate-100 dark:border-slate-700">
                                     <span className="text-[9px] font-black text-slate-400 uppercase">Subtotal (11-20)</span>
                                     <b className="text-xs font-black">{formatCurrency(Array.from({length: 10}, (_, i) => getDayData(i+11).amount).reduce((a,b) => a+b, 0))}</b>
                                   </div>
                                   <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl flex justify-between items-center border border-slate-100 dark:border-slate-700">
                                     <span className="text-[9px] font-black text-slate-400 uppercase">Subtotal (21-31)</span>
                                     <b className="text-xs font-black">{formatCurrency(Array.from({length: 11}, (_, i) => getDayData(i+21).amount).reduce((a,b) => a+b, 0))}</b>
                                   </div>
                                 </>
                               )}
                             </div>
                             
                             {section.key === 'labor' && (
                                <div className="mt-10 pt-10 border-t border-slate-100 dark:border-slate-800">
                                   <h5 className="text-[11px] font-black text-blue-600 uppercase tracking-[0.2em] mb-8">Resumen de Costo de Mano de Obra</h5>
                                   <div className="space-y-3">
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
                                        <div key={row.id} className={`flex justify-between items-center px-6 py-1.5 rounded-xl ${row.total ? 'bg-blue-600 text-white shadow-lg' : row.highlight ? 'bg-slate-50 dark:bg-slate-800 ring-1 ring-slate-100 dark:ring-slate-700 border border-slate-100 dark:border-slate-800' : ''}`}>
                                           <span className={`text-[9px] uppercase ${row.total || row.highlight ? 'font-black' : 'font-bold text-slate-500'}`}>{row.label}</span>
                                           <b className={`${row.total ? 'text-sm' : 'text-xs'} font-black`}>{formatCurrency(row.value || 0)}</b>
                                        </div>
                                      ))}
                                   </div>
                                </div>
                             )}

                             {section.key === 'mats' && (
                                <div className="mt-10 pt-10 border-t border-slate-100 dark:border-slate-800">
                                   <h5 className="text-[11px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-8">Resumen de Costo de Materiales y/o Servicios</h5>
                                   <div className="space-y-3">
                                      <div className="flex justify-between items-center px-6 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800">
                                         <span className="text-[10px] font-black uppercase text-slate-500">a) Subtotal de Materiales y/o Servicios</span>
                                         <b className="text-xs font-black">{formatCurrency((summary.detailedMaterials?.subtotalM || 0) + (summary.detailedMaterials?.subtotalS || 0))}</b>
                                      </div>
                                      <div className="flex justify-between items-center px-6 py-3 rounded-xl">
                                         <span className="text-[10px] font-bold uppercase text-slate-500">b) Beneficio Industrial 15%</span>
                                         <b className="text-xs font-black">{formatCurrency((summary.detailedMaterials?.biM || 0) + (summary.detailedMaterials?.biS || 0))}</b>
                                      </div>
                                      <div className="flex justify-between items-center px-6 py-4 rounded-xl bg-emerald-600 text-white shadow-lg">
                                         <span className="text-[10px] font-black uppercase tracking-widest">(2) TOTAL DE MATERIALES Y/O SERVICIOS (A+B)</span>
                                         <b className="text-sm font-black">{formatCurrency(summary.detailedMaterials?.total || 0)}</b>
                                      </div>
                                   </div>
                                </div>
                             )}

                             {section.key === 'equip' && (
                                <div className="mt-10 pt-10 border-t border-slate-100 dark:border-slate-800">
                                   <h5 className="text-[11px] font-black text-amber-600 uppercase tracking-[0.2em] mb-8">Resumen de Costo de Equipo</h5>
                                   <div className="space-y-3">
                                      <div className="flex justify-between items-center px-6 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800">
                                         <span className="text-[10px] font-black uppercase text-slate-500">a) Subtotal Renta de Equipo (Activo+Inactivo)</span>
                                         <b className="text-xs font-black">{formatCurrency(summary.rentTotal)}</b>
                                      </div>
                                      <div className="flex justify-between items-center px-6 py-3 rounded-xl">
                                         <span className="text-[10px] font-bold uppercase text-slate-500">b) Beneficio Industrial 15% de (a)</span>
                                         <b className="text-xs font-black">{formatCurrency(summary.rentTotal * 0.15)}</b>
                                      </div>
                                      <div className="flex justify-between items-center px-6 py-4 rounded-xl bg-amber-500 text-white shadow-lg">
                                         <span className="text-[10px] font-black uppercase tracking-widest">(3) TOTAL DE EQUIPO (a+b)</span>
                                         <b className="text-sm font-black">{formatCurrency(summary.rentTotal * 1.15)}</b>
                                      </div>
                                   </div>
                                </div>
                             )}

                             <div className="mt-8 flex justify-between items-center px-6 py-4 bg-slate-100 dark:bg-slate-800/80 rounded-2xl text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700">
                               <span className="text-[10px] font-black uppercase tracking-widest italic opacity-80">Subtotal Neto Mensual {section.label}</span>
                               <b className="text-lg font-black tracking-tighter">{formatCurrency(section.subtotal)}</b>
                             </div>
                           </div>
                         );
                       })}

                       <div className="bg-slate-900 text-white p-12 rounded-[4rem] shadow-2xl relative overflow-hidden group">
                          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] -mr-48 -mt-48"></div>
                          <div className="relative z-10 space-y-12">
                            <div className="flex flex-col md:flex-row justify-between items-start gap-8">
                               <div className="space-y-3">
                                  <h3 className="text-4xl font-black uppercase tracking-tighter italic">Total Mensual</h3>
                                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                    <Info size={12} className="text-blue-500" />
                                    Suma consolidada de todos los recursos del periodo.
                                  </p>
                               </div>
                               <div className="flex flex-col items-end gap-2">
                                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Resumen Final</div>
                                  <div className="text-5xl font-black text-emerald-400 tracking-tighter flex items-center gap-4">
                                     <DollarSign size={40} className="text-emerald-500/50" />
                                     {formatCurrency(
                                       ac51Data.reduce((acc, r) => acc + r.total, 0)
                                     )}
                                  </div>
                               </div>
                            </div>

                            {/* Daily Breakdown Tables */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
                                {[0, 10, 20].map((start, idx) => (
                                  <div key={idx} className="bg-slate-900/40 rounded-[2rem] border border-slate-800 overflow-hidden shadow-2xl">
                                    <table className="w-full text-[10px]">
                                      <thead>
                                        <tr className="bg-slate-800/80 text-blue-400 font-black uppercase tracking-widest border-b border-slate-700">
                                          <th className="px-4 py-3 text-left">DÍA SEM.</th>
                                          <th className="px-4 py-3 text-center">DÍA MES</th>
                                          <th className="px-4 py-3 text-right">MONTO</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-800">
                                        {daysInMonth.slice(start, start + (idx === 2 ? 11 : 10)).map((d, i) => (
                                          <tr key={i} className={`hover:bg-slate-800/50 transition-colors ${d.isWeekend ? 'bg-slate-800/20' : ''}`}>
                                            <td className={`px-4 py-3 font-black ${d.isWeekend ? 'text-slate-500' : 'text-slate-400'}`}>{d.sem}</td>
                                            <td className="px-4 py-3 text-center font-black text-slate-200 border-x border-slate-800/50">{d.day}</td>
                                            <td className={`px-4 py-3 text-right font-black ${d.amount > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                                              {d.amount > 0 ? formatCurrency(d.amount) : "$0.00"}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ))}
                             </div>
                            
                            <div className="pt-8 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-12">
                               <div className="space-y-4">
                                  <h6 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-4">Comentarios del Liquidador</h6>
                                  <textarea className="w-full bg-slate-800/50 border border-slate-700 rounded-3xl p-6 text-xs text-slate-300 outline-none focus:ring-2 focus:ring-blue-500/50 min-h-[120px]" placeholder="Indique notas adicionales para este periodo..." />
                               </div>
                               <div className="space-y-4">
                                  <h6 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-4">Costo Total AC-51</h6>
                                  <div className="bg-slate-800/80 p-6 rounded-[2rem] border border-slate-700/50">
                                     <div className="flex justify-between items-center mb-3 text-slate-400">
                                        <span className="text-[9px] font-bold uppercase">Mano de Obra (1)</span>
                                        <b className="text-xs font-black">{formatCurrency(ac51Data.reduce((acc, r) => acc + r.labor, 0))}</b>
                                     </div>
                                     <div className="flex justify-between items-center mb-3 text-slate-400">
                                        <span className="text-[9px] font-bold uppercase">Materiales (2)</span>
                                        <b className="text-xs font-black">{formatCurrency(ac51Data.reduce((acc, r) => acc + r.mats, 0))}</b>
                                     </div>
                                     <div className="flex justify-between items-center mb-3 text-slate-400">
                                        <span className="text-[9px] font-bold uppercase">Equipo (3)</span>
                                        <b className="text-xs font-black">{formatCurrency(ac51Data.reduce((acc, r) => acc + r.equip, 0))}</b>
                                     </div>
                                     <div className="flex justify-between items-center py-4 border-t border-slate-700/50">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-2">Fianzas de Ejecución y Pago <input className="w-12 bg-slate-900/50 rounded ring-1 ring-slate-700 border-none text-center p-1 font-bold text-blue-400" type="number" step="any" defaultValue={0}/>% por mil</span>
                                        <b className="text-xs font-black text-emerald-400">{formatCurrency(0)}</b>
                                     </div>
                                  </div>
                               </div>
                            </div>
                          </div>
                       </div>
                    </div>

                    <div className="flex justify-end gap-4 mt-10">
                       <button className="px-10 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl transition-all shadow-xl shadow-emerald-500/20 active:scale-95 flex items-center gap-3 uppercase tracking-widest text-[10px]">
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
                            className="flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase hover:bg-blue-700 shadow-lg"
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
                            className="flex items-center gap-2 px-8 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase hover:bg-emerald-700 shadow-lg"
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
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                          {ac49Report.photos.map((photo, idx) => (
                            <div key={idx} className="group relative aspect-square rounded-[2rem] overflow-hidden border shadow-md">
                              <img src={photo} alt={`Evidencia ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <button 
                                  onClick={() => {
                                    setAc49Report(prev => ({
                                      ...prev,
                                      photos: (prev.photos || []).filter((_, i) => i !== idx)
                                    }));
                                  }}
                                  className="w-12 h-12 bg-red-600 text-white rounded-full flex items-center justify-center hover:bg-red-700 shadow-lg"
                                >
                                  <Trash2 size={20} />
                                </button>
                              </div>
                              <div className="absolute bottom-4 left-4 right-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-3 rounded-xl text-center">
                                <p className="text-[9px] font-black uppercase text-slate-600">Foto #{idx + 1}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className="mt-12 p-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 rounded-2xl flex items-center gap-4">
                        <Info className="text-amber-600 shrink-0" size={20} />
                        <p className="text-[10px] font-bold text-amber-800 uppercase tracking-tight">Las fotos se guardarán dentro del archivo de respaldo JSON.</p>
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

      {/* About Section mandated by User Rules */}
      <div className="mt-20 pt-10 border-t border-slate-100 dark:border-slate-800 text-center pb-10">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Suite de Soluciones Saavedra</p>
        <p className="text-[11px] font-bold text-slate-500 mt-2">Diseñador: Ing. Enrique Saavedra Sada, PE</p>
      </div>
    </div>
  );
});

export default ForceAccount2Form;
