"use client";
import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { Save, Plus, Trash2, Loader2, FileSearch, Cloud, Users, ClipboardList, ChevronLeft, ChevronRight, UserCheck, MessageSquare } from "lucide-react";
import FloatingFormActions from "./FloatingFormActions";
import type { FormRef } from "./ProjectForm";

interface VisitaRow { idaNo: string; contratistaSub: string; }
interface ACT96Data {
  fecha: string; diaSemana: string; numProyecto: string; nombreProyecto: string; municipio: string;
  contratista: string; paginaNo: string; numerControl: string;
  horarioTrabajo: string; climaAM: string; climaPM: string;
  tiempoPerdidoHoras: string; razonesTP: string;
  visitas: VisitaRow[];
  reuniones: string;
  laborRealizada: string;
  trabajoEjecutado: string;
  asuntosDiscutidos: string;
  otrasActividades: string;
  aspectosSeguridad: string;
  observaciones: string;
  nombreAdministrador: string; puesto: string; firma: string; fechaFirma: string;
}

const DIAS = ["L","M","W","J","V","S","D"];
const CLIMAS = ["Soleado","Nublado","Lluvia Ligera","Lluvia Fuerte","Ventoso"];

const ACT96Form = forwardRef<FormRef, { projectId?: string; numAct?: string; onDirty?: () => void; onSaved?: () => void; }>(
  function ACT96Form({ projectId, numAct, onDirty, onSaved }, ref) {
    const [tab, setTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [d, setD] = useState<ACT96Data>({
      fecha: new Date().toISOString().split("T")[0],
      diaSemana: DIAS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1],
      numProyecto: numAct || "", nombreProyecto: "", municipio: "", contratista: "",
      paginaNo: "1", numerControl: "",
      horarioTrabajo: "", climaAM: "Soleado", climaPM: "Soleado",
      tiempoPerdidoHoras: "", razonesTP: "",
      visitas: [],
      reuniones: "", laborRealizada: "", trabajoEjecutado: "",
      asuntosDiscutidos: "", otrasActividades: "",
      aspectosSeguridad: "", observaciones: "",
      nombreAdministrador: "", puesto: "", firma: "", fechaFirma: "",
    });

    useEffect(() => { if (projectId) load(); }, [projectId]);

    const load = async () => {
      const { data } = await supabase.from("projects").select("name, contract_number, municipality, act96_last_report").eq("id", projectId!).single();
      if (data) setD(p => ({ ...p, ...(data.act96_last_report || {}), numProyecto: numAct || p.numProyecto, nombreProyecto: data.name || p.nombreProyecto, municipio: data.municipality || p.municipio, fecha: new Date().toISOString().split("T")[0] }));
    };

    const save = async (silent = false) => {
      if (!projectId) return;
      setLoading(true);
      const { error } = await supabase.from("projects").update({ act96_last_report: d }).eq("id", projectId);
      setLoading(false);
      if (!error) { if (!silent) alert("ACT-96 guardado."); onSaved?.(); } else if (!silent) alert("Error: " + error.message);
    };
    useImperativeHandle(ref, () => ({ save: () => save(true) }));

    const upD = (k: keyof ACT96Data, v: any) => { setD(p => ({ ...p, [k]: v })); onDirty?.(); };

    const addVisita = () => { setD(p => ({ ...p, visitas: [...p.visitas, { idaNo:"", contratistaSub:"" }] })); };
    const rmVisita = (i: number) => { const a = [...d.visitas]; a.splice(i,1); upD("visitas", a); };
    const upVisita = (i: number, k: keyof VisitaRow, v: string) => { const a = [...d.visitas]; a[i][k] = v; upD("visitas", a); };

    const tabs = [
      { label: "Encabezado & Clima", icon: <Cloud size={16}/> },
      { label: "Labor & Visitas", icon: <ClipboardList size={16}/> },
      { label: "Notas & Discusiones", icon: <MessageSquare size={16}/> },
      { label: "Administrador", icon: <UserCheck size={16}/> },
    ];

    const inp = "w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 border-none";
    const lbl = "text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-1 block";
    const card = "bg-white dark:bg-slate-900 rounded-[28px] p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4";

    return (
      <div className="w-full space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 rounded-2xl"><FileSearch className="text-blue-600" size={22}/></div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">ACT-96 — Informe Diario de Inspección</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Gobierno de Puerto Rico · ACT · Área de Construcción · Rev. 6/09</p>
            </div>
          </div>
          <button onClick={() => save(false)} disabled={loading} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-2xl font-black text-xs hover:bg-blue-700 transition-all">
            {loading ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} GUARDAR
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {tabs.map((t, i) => (
            <button key={i} onClick={() => setTab(i)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border ${tab===i ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200" : "bg-white dark:bg-slate-900 text-slate-400 border-slate-100 dark:border-slate-800"}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-[400px] pb-20 animate-in fade-in duration-300">

          {/* TAB 0: ENCABEZADO */}
          {tab === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={card}>
                <h3 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-2">Datos del Informe</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>5. Fecha</label><input type="date" className={inp} value={d.fecha} onChange={e => upD("fecha", e.target.value)}/></div>
                  <div><label className={lbl}>6. Día de Semana</label>
                    <div className="flex gap-1 flex-wrap">{DIAS.map(d2 => <button key={d2} onClick={() => upD("diaSemana", d2)} className={`px-2 py-1 rounded-lg text-[10px] font-black border transition-all ${d.diaSemana===d2?"bg-blue-600 text-white border-blue-600":"bg-slate-50 text-slate-500 border-slate-100"}`}>{d2}</button>)}</div>
                  </div>
                </div>
                <div><label className={lbl}>1. Núm. de Proyecto</label><input className={`${inp} bg-slate-100`} value={d.numProyecto} readOnly/></div>
                <div><label className={lbl}>2. Nombre de Proyecto</label><input className={inp} value={d.nombreProyecto} onChange={e => upD("nombreProyecto", e.target.value)}/></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>3. Municipio</label><input className={`${inp} bg-slate-100`} value={d.municipio} readOnly/></div>
                  <div><label className={lbl}>8. Número de Control</label><input className={inp} value={d.numerControl} onChange={e => upD("numerControl", e.target.value)} placeholder="001"/></div>
                </div>
                <div><label className={lbl}>4. Contratista y/o Subcontratista</label><input className={inp} value={d.contratista} onChange={e => upD("contratista", e.target.value)}/></div>
                <div><label className={lbl}>12. Horario de Trabajo</label><input className={inp} value={d.horarioTrabajo} onChange={e => upD("horarioTrabajo", e.target.value)} placeholder="7:00 AM - 3:30 PM"/></div>
              </div>
              <div className={card}>
                <h3 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-2">9. Clima</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>AM</label>
                    <select className={inp} value={d.climaAM} onChange={e => upD("climaAM", e.target.value)}>
                      {CLIMAS.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div><label className={lbl}>PM</label>
                    <select className={inp} value={d.climaPM} onChange={e => upD("climaPM", e.target.value)}>
                      {CLIMAS.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>10. Tiempo Perdido (Horas)</label><input type="number" className={inp} value={d.tiempoPerdidoHoras} onChange={e => upD("tiempoPerdidoHoras", e.target.value)}/></div>
                </div>
                <div><label className={lbl}>11. Razones del Tiempo Perdido</label><textarea className={`${inp} min-h-[80px] resize-none py-2`} value={d.razonesTP} onChange={e => upD("razonesTP", e.target.value)} placeholder="Ej. Lluvia, cambio de cheques..."/></div>
              </div>
            </div>
          )}

          {/* TAB 1: LABOR & VISITAS */}
          {tab === 1 && (
            <div className="space-y-6">
              <div className={card}>
                <h3 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-2">16. Trabajo Ejecutado — Actividad</h3>
                <textarea className={`${inp} min-h-[100px] resize-none py-2`} value={d.trabajoEjecutado} onChange={e => upD("trabajoEjecutado", e.target.value)} placeholder="Descripción del trabajo inspeccionado del día..."/>
              </div>
              <div className={card}>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-black text-xs uppercase tracking-widest text-slate-500">17. Visitas</h3>
                  <button onClick={addVisita} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-blue-700"><Plus size={12}/> Añadir Visita</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-separate border-spacing-y-1.5">
                    <thead><tr className="text-[8px] font-black uppercase text-slate-400 tracking-widest">
                      <th className="px-3 w-28">15. Número IDA</th><th className="px-3">Contratista, Subcontratista y Otras Agencias</th><th className="w-8"></th>
                    </tr></thead>
                    <tbody>
                      {d.visitas.map((r, i) => (
                        <tr key={i} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                          <td className="p-1.5"><input className="bg-transparent w-full text-xs font-bold border-none focus:ring-0" value={r.idaNo} onChange={e => upVisita(i,"idaNo",e.target.value)} placeholder="IDA-001"/></td>
                          <td className="p-1.5"><input className="bg-transparent w-full text-xs font-bold border-none focus:ring-0" value={r.contratistaSub} onChange={e => upVisita(i,"contratistaSub",e.target.value)}/></td>
                          <td className="p-1.5"><button onClick={() => rmVisita(i)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14}/></button></td>
                        </tr>
                      ))}
                      {d.visitas.length === 0 && <tr><td colSpan={3} className="py-8 text-center text-xs text-slate-300 font-black uppercase tracking-widest">No hay visitas registradas</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className={card}>
                <h3 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-2">18. Reuniones</h3>
                <textarea className={`${inp} min-h-[100px] resize-none py-2`} value={d.reuniones} onChange={e => upD("reuniones", e.target.value)} placeholder="Reuniones realizadas durante el día. Anotar asuntos discutidos..."/>
              </div>
              <div className={card}>
                <h3 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-2">19. Labor Realizada (Llamadas, Correos, Escritos, Visitas)</h3>
                <textarea className={`${inp} min-h-[120px] resize-none py-2`} value={d.laborRealizada} onChange={e => upD("laborRealizada", e.target.value)} placeholder="Anotar todas las visitas a otras oficinas, escritos, llamadas telefónicas, correos electrónicos..."/>
              </div>
            </div>
          )}

          {/* TAB 2: NOTAS & DISCUSIONES */}
          {tab === 2 && (
            <div className="space-y-6">
              <div className={card}>
                <h3 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-2">20. Asuntos Discutidos con el Contratista, Diseñador, ACT, Colindantes, Otras Agencias</h3>
                <textarea className={`${inp} min-h-[120px] resize-none py-2`} value={d.asuntosDiscutidos} onChange={e => upD("asuntosDiscutidos", e.target.value)} placeholder="Instrucciones o discusiones con el Contratista, dentro o fuera de la oficina..."/>
              </div>
              <div className={card}>
                <h3 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-2">21. Otras Posibles Actividades</h3>
                <textarea className={`${inp} min-h-[100px] resize-none py-2`} value={d.otrasActividades} onChange={e => upD("otrasActividades", e.target.value)} placeholder="Actividades que el Contratista puede llevar a cabo simultáneamente..."/>
              </div>
              <div className={card}>
                <h3 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-2">22. Aspectos de Seguridad</h3>
                <textarea className={`${inp} min-h-[100px] resize-none py-2`} value={d.aspectosSeguridad} onChange={e => upD("aspectosSeguridad", e.target.value)} placeholder="Comentarios y observaciones en torno a seguridad..."/>
              </div>
              <div className={card}>
                <h3 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-2">23. Observaciones</h3>
                <textarea className={`${inp} min-h-[120px] resize-none py-2`} value={d.observaciones} onChange={e => upD("observaciones", e.target.value)} placeholder="Cualquier comentario u observación en torno al proyecto..."/>
              </div>
            </div>
          )}

          {/* TAB 3: ADMINISTRADOR */}
          {tab === 3 && (
            <div className={card}>
              <h3 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-4">Administrador de Proyecto</h3>
              <div><label className={lbl}>24. Nombre del Administrador</label><input className={inp} value={d.nombreAdministrador} onChange={e => upD("nombreAdministrador", e.target.value)} placeholder="Nombre completo"/></div>
              <div><label className={lbl}>25. Puesto</label><input className={inp} value={d.puesto} onChange={e => upD("puesto", e.target.value)} placeholder="Ej. Ingeniero Residente"/></div>
              <div><label className={lbl}>26. Firma</label><input className={`${inp} italic`} value={d.firma} onChange={e => upD("firma", e.target.value)} placeholder="Nombre como firma digital"/></div>
              <div><label className={lbl}>Fecha</label><input type="date" className={inp} value={d.fechaFirma} onChange={e => upD("fechaFirma", e.target.value)}/></div>

              <div className="mt-6 p-5 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100">
                <p className="text-[9px] font-bold text-blue-600 leading-relaxed italic">
                  Este documento es el Informe Diario de Inspección según el formulario oficial ACT-96 (Rev. 6/09) de la Autoridad de Carreteras y Transportación de Puerto Rico.
                </p>
              </div>
            </div>
          )}
        </div>

        <FloatingFormActions actions={[
          { label:"Anterior", icon:<ChevronLeft/>, onClick:() => tab>0 && setTab(tab-1), variant:'secondary' as const, size:'small' as const, disabled:tab===0 },
          { label: tab<3?"Siguiente":"Guardar", icon:tab<3?<ChevronRight/>:<Save/>, onClick:() => tab<3?setTab(tab+1):save(false), variant:tab<3?'secondary':'primary' }
        ]}/>

      </div>
    );
  }
);
export default ACT96Form;
