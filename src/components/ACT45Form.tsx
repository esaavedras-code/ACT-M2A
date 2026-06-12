"use client";
import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { Save, Plus, Trash2, Loader2, FileText, Cloud, Users, Truck, ClipboardList, ChevronLeft, ChevronRight, UserCheck } from "lucide-react";
import FloatingFormActions from "./FloatingFormActions";
import type { FormRef } from "./ProjectForm";

interface TrabajoRow { partida: string; especificacion: string; descripcion: string; cantMedida: string; unidad: string; lineaLadoProg: string; cantVerificada: string; }
interface PersonalRow { nombre: string; clasificacion: string; horasTrabajadas: string; observaciones: string; }
interface EquipoRow { tipo: string; descripcion: string; horasActivo: string; horasInactivo: string; }

interface ACT45Data {
  fecha: string; diaSemana: string; numProyecto: string; nombreProyecto: string; municipio: string;
  contratista: string; inspector: string; idaNo: string; paginaNo: string;
  horarioTrabajo: string; climaAM: string; climaPM: string; horaLluvia: string;
  trabajoEjecutado: TrabajoRow[];
  descripcionTrabajoMaterial: string; muestrasTomadas: string;
  personal: PersonalRow[];
  equipo: EquipoRow[];
  materialesEquiposIncorporados: string; dibujosComputos: string;
  aspectosSeguridad: string;
  nombreInspector: string; firmaInspector: string; fechaFirmaInspector: string;
  revisadoPor: string; firmaRevisador: string; fechaRevision: string;
}

const DIAS = ["L","M","W","J","V","S","D"];
const CLIMAS = ["Soleado","Nublado","Lluvia Ligera","Lluvia Fuerte","Ventoso"];

const ACT45Form = forwardRef<FormRef, { projectId?: string; numAct?: string; onDirty?: () => void; onSaved?: () => void; }>(
  function ACT45Form({ projectId, numAct, onDirty, onSaved }, ref) {
    const [tab, setTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [projectItems, setProjectItems] = useState<any[]>([]);
    const [d, setD] = useState<ACT45Data>({
      fecha: new Date().toISOString().split("T")[0],
      diaSemana: DIAS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1],
      numProyecto: numAct || "", nombreProyecto: "", municipio: "", contratista: "",
      inspector: "", idaNo: "", paginaNo: "1",
      horarioTrabajo: "", climaAM: "Soleado", climaPM: "Soleado", horaLluvia: "",
      trabajoEjecutado: [],
      descripcionTrabajoMaterial: "", muestrasTomadas: "",
      personal: [],
      equipo: [],
      materialesEquiposIncorporados: "", dibujosComputos: "",
      aspectosSeguridad: "",
      nombreInspector: "", firmaInspector: "", fechaFirmaInspector: "",
      revisadoPor: "", firmaRevisador: "", fechaRevision: "",
    });

    useEffect(() => { if (projectId) load(); }, [projectId]);

    const load = async () => {
      const { data } = await supabase.from("projects").select("name, num_act, municipios, contractor_name, admin_name, act45_last_report").eq("id", projectId!).single();
      if (data) {
        const municipioStr = Array.isArray(data.municipios) ? data.municipios.join(", ") : "";
        setD(p => ({ 
          ...p, 
          ...(data.act45_last_report || {}), 
          numProyecto: data.num_act || p.numProyecto, 
          nombreProyecto: data.name || p.nombreProyecto, 
          municipio: municipioStr || p.municipio,
          contratista: data.contractor_name || p.contratista,
          nombreInspector: data.admin_name || p.nombreInspector,
          fecha: new Date().toISOString().split("T")[0] 
        }));
      }
      const { data: itemsData } = await supabase.from("contract_items").select("*").eq("project_id", projectId!);
      if (itemsData) setProjectItems(itemsData);
    };

    const save = async (silent = false) => {
      if (!projectId) return;
      setLoading(true);
      const { error } = await supabase.from("projects").update({ act45_last_report: d }).eq("id", projectId);
      setLoading(false);
      if (!error) { if (!silent) alert("ACT-45 guardado."); onSaved?.(); } else if (!silent) alert("Error: " + error.message);
    };
    useImperativeHandle(ref, () => ({ save: () => save(true) }));

    const upD = (k: keyof ACT45Data, v: any) => { setD(p => ({ ...p, [k]: v })); onDirty?.(); };

    const addTrabajo = () => { setD(p => ({ ...p, trabajoEjecutado: [...p.trabajoEjecutado, { partida:"", especificacion:"", descripcion:"", cantMedida:"", unidad:"", lineaLadoProg:"", cantVerificada:"" }] })); };
    const rmTrabajo = (i: number) => { const a = [...d.trabajoEjecutado]; a.splice(i,1); upD("trabajoEjecutado", a); };
    const upTrabajo = (i: number, k: keyof TrabajoRow, v: string) => { const a = [...d.trabajoEjecutado]; a[i][k] = v; upD("trabajoEjecutado", a); };
    const onPartidaSelect = (i: number, val: string) => {
      const a = [...d.trabajoEjecutado];
      a[i].partida = val;
      const item = projectItems.find(it => it.item_num === val);
      if (item) {
        a[i].especificacion = item.specification || "";
        a[i].descripcion = item.description || "";
        a[i].unidad = item.unit || "";
      }
      upD("trabajoEjecutado", a);
    };

    const addPersonal = () => { setD(p => ({ ...p, personal: [...p.personal, { nombre:"", clasificacion:"", horasTrabajadas:"", observaciones:"" }] })); };
    const rmPersonal = (i: number) => { const a = [...d.personal]; a.splice(i,1); upD("personal", a); };
    const upPersonal = (i: number, k: keyof PersonalRow, v: string) => { const a = [...d.personal]; a[i][k] = v; upD("personal", a); };

    const addEquipo = () => { setD(p => ({ ...p, equipo: [...p.equipo, { tipo:"", descripcion:"", horasActivo:"", horasInactivo:"" }] })); };
    const rmEquipo = (i: number) => { const a = [...d.equipo]; a.splice(i,1); upD("equipo", a); };
    const upEquipo = (i: number, k: keyof EquipoRow, v: string) => { const a = [...d.equipo]; a[i][k] = v; upD("equipo", a); };

    const tabs = [
      { label: "Encabezado & Clima", icon: <Cloud size={16}/> },
      { label: "Trabajo Ejecutado", icon: <ClipboardList size={16}/> },
      { label: "Personal", icon: <Users size={16}/> },
      { label: "Equipo & Notas", icon: <Truck size={16}/> },
      { label: "Firmas", icon: <UserCheck size={16}/> },
    ];

    const inp = "w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/20 border-none";
    const lbl = "text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-1 block";
    const card = "bg-white dark:bg-slate-900 rounded-[28px] p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4";

    return (
      <div className="w-full space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 rounded-2xl"><FileText className="text-emerald-600" size={22}/></div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">ACT-45 — Informe Diario de Actividades</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Gobierno de Puerto Rico · ACT · Área de Construcción</p>
            </div>
          </div>
          <button onClick={() => save(false)} disabled={loading} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-2xl font-black text-xs hover:bg-emerald-700 transition-all">
            {loading ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} GUARDAR
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {tabs.map((t, i) => (
            <button key={i} onClick={() => setTab(i)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border ${tab===i ? "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-200" : "bg-white dark:bg-slate-900 text-slate-400 border-slate-100 dark:border-slate-800"}`}>
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
                    <div className="flex gap-1 flex-wrap">{DIAS.map(d2 => <button key={d2} onClick={() => upD("diaSemana", d2)} className={`px-2 py-1 rounded-lg text-[10px] font-black border transition-all ${d.diaSemana===d2?"bg-emerald-600 text-white border-emerald-600":"bg-slate-50 text-slate-500 border-slate-100"}`}>{d2}</button>)}</div>
                  </div>
                </div>
                <div><label className={lbl}>1. Núm. de Proyecto</label><input className={`${inp} bg-slate-100`} value={d.numProyecto} readOnly/></div>
                <div><label className={lbl}>2. Nombre de Proyecto</label><input className={inp} value={d.nombreProyecto} onChange={e => upD("nombreProyecto", e.target.value)}/></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>3. Municipio</label><input className={`${inp} bg-slate-100`} value={d.municipio} readOnly/></div>
                  <div><label className={lbl}>9. IDA No.</label><input className={inp} value={d.idaNo} onChange={e => upD("idaNo", e.target.value)} placeholder="001"/></div>
                </div>
                <div><label className={lbl}>4. Contratista y/o Subcontratista</label><input className={inp} value={d.contratista} onChange={e => upD("contratista", e.target.value)}/></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>7. Inspector</label><input className={inp} value={d.inspector} onChange={e => upD("inspector", e.target.value)}/></div>
                  <div><label className={lbl}>12. Horario de Trabajo</label><input className={inp} value={d.horarioTrabajo} onChange={e => upD("horarioTrabajo", e.target.value)} placeholder="7:00 AM - 3:30 PM"/></div>
                </div>
              </div>
              <div className={card}>
                <h3 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-2">10. Clima</h3>
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
                <div><label className={lbl}>11. Hora de Lluvia</label><input className={inp} value={d.horaLluvia} onChange={e => upD("horaLluvia", e.target.value)} placeholder="Ej. 2:00 PM - 4:00 PM"/></div>
                <div><label className={lbl}>21. Muestras Tomadas</label><textarea className={`${inp} min-h-[80px] resize-none py-2`} value={d.muestrasTomadas} onChange={e => upD("muestrasTomadas", e.target.value)}/></div>
              </div>
            </div>
          )}

          {/* TAB 1: TRABAJO EJECUTADO */}
          {tab === 1 && (
            <div className={card}>
              <div className="flex justify-between items-center">
                <h3 className="font-black text-xs uppercase tracking-widest text-slate-500">19. Trabajo Ejecutado</h3>
                <button onClick={addTrabajo} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-emerald-700"><Plus size={12}/> Añadir Partida</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-separate border-spacing-y-1.5 min-w-[900px]">
                  <thead><tr className="text-[8px] font-black uppercase text-slate-400 tracking-widest">
                    <th className="px-2">13. Partida</th><th className="px-2">14. Especif.</th><th className="px-2 w-40">15. Descripción</th>
                    <th className="px-2">16. Cant. Medida</th><th className="px-2">17. Unidad</th>
                    <th className="px-2 w-28">18. Línea/Lado/Progresiva</th><th className="px-2 w-28">Cant. Verificada y Aprobada</th><th className="px-2 w-8"></th>
                  </tr></thead>
                  <tbody>
                    {d.trabajoEjecutado.map((r, i) => (
                      <tr key={i} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                        <td className="p-1">
                          <select className="bg-transparent w-full text-xs font-bold border-none focus:ring-0" value={r.partida} onChange={e => onPartidaSelect(i, e.target.value)}>
                            <option value="">Sel...</option>
                            {projectItems.map(it => <option key={it.id} value={it.item_num}>{it.item_num}</option>)}
                          </select>
                        </td>
                        <td className="p-1"><input className="bg-transparent w-full text-xs font-bold border-none focus:ring-0" value={r.especificacion} onChange={e => upTrabajo(i,"especificacion",e.target.value)}/></td>
                        <td className="p-1"><input className="bg-transparent w-full text-xs font-bold border-none focus:ring-0" value={r.descripcion} onChange={e => upTrabajo(i,"descripcion",e.target.value)}/></td>
                        <td className="p-1"><input className="bg-transparent w-full text-xs font-bold border-none focus:ring-0 text-center" value={r.cantMedida} onChange={e => upTrabajo(i,"cantMedida",e.target.value)}/></td>
                        <td className="p-1"><input className="bg-transparent w-full text-xs font-bold border-none focus:ring-0" value={r.unidad} onChange={e => upTrabajo(i,"unidad",e.target.value)}/></td>
                        <td className="p-1"><input className="bg-transparent w-full text-xs font-bold border-none focus:ring-0" value={r.lineaLadoProg} onChange={e => upTrabajo(i,"lineaLadoProg",e.target.value)}/></td>
                        <td className="p-1"><input className="bg-transparent w-full text-xs font-bold border-none focus:ring-0 text-center" value={r.cantVerificada} onChange={e => upTrabajo(i,"cantVerificada",e.target.value)}/></td>
                        <td className="p-1"><button onClick={() => rmTrabajo(i)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14}/></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div><label className={lbl}>20. Descripción del Trabajo y Material Usado, incluyendo Número de Partida y Localización</label>
                <textarea className={`${inp} min-h-[120px] resize-none py-2`} value={d.descripcionTrabajoMaterial} onChange={e => upD("descripcionTrabajoMaterial", e.target.value)}/>
              </div>
            </div>
          )}

          {/* TAB 2: PERSONAL */}
          {tab === 2 && (
            <div className={card}>
              <div className="flex justify-between items-center">
                <h3 className="font-black text-xs uppercase tracking-widest text-slate-500">25. Personal</h3>
                <button onClick={addPersonal} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-emerald-700"><Plus size={12}/> Añadir Empleado</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-separate border-spacing-y-1.5">
                  <thead><tr className="text-[8px] font-black uppercase text-slate-400 tracking-widest">
                    <th className="px-3">Nombre</th><th className="px-3">Clasificación</th><th className="px-3 w-28 text-center">Horas Trabajadas</th><th className="px-3">Observaciones</th><th className="w-8"></th>
                  </tr></thead>
                  <tbody>
                    {d.personal.map((r, i) => (
                      <tr key={i} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                        <td className="p-1.5"><input className="bg-transparent w-full text-xs font-bold border-none focus:ring-0" value={r.nombre} onChange={e => upPersonal(i,"nombre",e.target.value)} placeholder="Nombre completo"/></td>
                        <td className="p-1.5"><input className="bg-transparent w-full text-xs font-bold border-none focus:ring-0" value={r.clasificacion} onChange={e => upPersonal(i,"clasificacion",e.target.value)} placeholder="Ej. Operador"/></td>
                        <td className="p-1.5"><input type="number" className="bg-transparent w-full text-xs font-bold border-none focus:ring-0 text-center" value={r.horasTrabajadas} onChange={e => upPersonal(i,"horasTrabajadas",e.target.value)}/></td>
                        <td className="p-1.5"><input className="bg-transparent w-full text-xs font-bold border-none focus:ring-0" value={r.observaciones} onChange={e => upPersonal(i,"observaciones",e.target.value)}/></td>
                        <td className="p-1.5"><button onClick={() => rmPersonal(i)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14}/></button></td>
                      </tr>
                    ))}
                    {d.personal.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-xs text-slate-300 font-black uppercase tracking-widest">No hay personal registrado</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: EQUIPO & NOTAS */}
          {tab === 3 && (
            <div className="space-y-6">
              <div className={card}>
                <div className="flex justify-between items-center">
                  <h3 className="font-black text-xs uppercase tracking-widest text-slate-500">26-28. Equipo</h3>
                  <button onClick={addEquipo} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-emerald-700"><Plus size={12}/> Añadir Equipo</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-separate border-spacing-y-1.5">
                    <thead><tr className="text-[8px] font-black uppercase text-slate-400 tracking-widest">
                      <th className="px-3 w-32">Tipo</th><th className="px-3">Descripción (Marca, Modelo, Capacidad)</th><th className="px-3 w-24 text-center">Horas Activo</th><th className="px-3 w-24 text-center">Horas Inactivo</th><th className="w-8"></th>
                    </tr></thead>
                    <tbody>
                      {d.equipo.map((r, i) => (
                        <tr key={i} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                          <td className="p-1.5"><input className="bg-transparent w-full text-xs font-bold border-none focus:ring-0" value={r.tipo} onChange={e => upEquipo(i,"tipo",e.target.value)} placeholder="Retroexcavadora"/></td>
                          <td className="p-1.5"><input className="bg-transparent w-full text-xs font-bold border-none focus:ring-0" value={r.descripcion} onChange={e => upEquipo(i,"descripcion",e.target.value)}/></td>
                          <td className="p-1.5"><input type="number" className="bg-transparent w-full text-xs font-bold border-none focus:ring-0 text-center" value={r.horasActivo} onChange={e => upEquipo(i,"horasActivo",e.target.value)}/></td>
                          <td className="p-1.5"><input type="number" className="bg-transparent w-full text-xs font-bold border-none focus:ring-0 text-center" value={r.horasInactivo} onChange={e => upEquipo(i,"horasInactivo",e.target.value)}/></td>
                          <td className="p-1.5"><button onClick={() => rmEquipo(i)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14}/></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className={card}>
                <h3 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-2">Notas Adicionales</h3>
                <div><label className={lbl}>29. Materiales y/o Equipos Incorporados o Removidos del Proyecto</label><textarea className={`${inp} min-h-[80px] resize-none py-2`} value={d.materialesEquiposIncorporados} onChange={e => upD("materialesEquiposIncorporados", e.target.value)}/></div>
                <div><label className={lbl}>30. Dibujos, Cómputos y/o Referencias de las Partidas Ejecutadas</label><textarea className={`${inp} min-h-[80px] resize-none py-2`} value={d.dibujosComputos} onChange={e => upD("dibujosComputos", e.target.value)}/></div>
                <div><label className={lbl}>31. Aspectos de Seguridad y/o Comentarios Adicionales</label><textarea className={`${inp} min-h-[100px] resize-none py-2`} value={d.aspectosSeguridad} onChange={e => upD("aspectosSeguridad", e.target.value)}/></div>
              </div>
            </div>
          )}

          {/* TAB 4: FIRMAS */}
          {tab === 4 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={card}>
                <h3 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-2">Inspector</h3>
                <div><label className={lbl}>32. Nombre del Inspector</label><input className={inp} value={d.nombreInspector} onChange={e => upD("nombreInspector", e.target.value)}/></div>
                <div><label className={lbl}>33. Firma del Inspector</label><input className={`${inp} italic`} value={d.firmaInspector} onChange={e => upD("firmaInspector", e.target.value)} placeholder="Nombre como firma digital"/></div>
                <div><label className={lbl}>34. Fecha</label><input type="date" className={inp} value={d.fechaFirmaInspector} onChange={e => upD("fechaFirmaInspector", e.target.value)}/></div>
              </div>
              <div className={card}>
                <h3 className="font-black text-xs uppercase tracking-widest text-slate-500 mb-2">Revisión</h3>
                <div><label className={lbl}>35. Revisado Por</label><input className={inp} value={d.revisadoPor} onChange={e => upD("revisadoPor", e.target.value)}/></div>
                <div><label className={lbl}>36. Firma del Revisador</label><input className={`${inp} italic`} value={d.firmaRevisador} onChange={e => upD("firmaRevisador", e.target.value)} placeholder="Nombre como firma digital"/></div>
                <div><label className={lbl}>37. Fecha de Revisión</label><input type="date" className={inp} value={d.fechaRevision} onChange={e => upD("fechaRevision", e.target.value)}/></div>
              </div>
            </div>
          )}
        </div>

        <FloatingFormActions actions={[
          { label:"Anterior", icon:<ChevronLeft/>, onClick:() => tab>0 && setTab(tab-1), variant:'secondary' as const, size:'small' as const, disabled:tab===0 },
          { label: tab<4?"Siguiente":"Guardar", icon:tab<4?<ChevronRight/>:<Save/>, onClick:() => tab<4?setTab(tab+1):save(false), variant:tab<4?'secondary':'primary' }
        ]}/>

      </div>
    );
  }
);
export default ACT45Form;
