"use client";

import { useState, useEffect, useRef } from "react";
import { HelpCircle, X, ChevronRight, BookOpen, ShieldCheck, Mail, Search, BookMarked, ArrowLeft } from "lucide-react";

const abbreviations = [
    { sigla: "ACT", significado: "Autoridad de Carreteras y Transportación de Puerto Rico" },
    { sigla: "ACT-117", significado: "Formulario oficial de pagos al contratista por partidas completadas" },
    { sigla: "ACT-122", significado: "Formulario oficial de autorización de Órdenes de Cambio (CHO)" },
    { sigla: "ARRA", significado: "American Recovery and Reinvestment Act — Ley de Recuperación y Reinversión" },
    { sigla: "CCML", significado: "Contractor's Certified Monthly Labor — Nómina Certificada del Contratista" },
    { sigla: "CE", significado: "Categorical Exclusion — Exclusión Categórica ambiental" },
    { sigla: "CHO", significado: "Change Order — Orden de Cambio de contrato" },
    { sigla: "CNI", significado: "Construction — Fase de Construcción del proyecto" },
    { sigla: "CPM", significado: "Critical Path Method — Método de la Ruta Crítica (cronograma)" },
    { sigla: "CY", significado: "Cubic Yards — Yardas Cúbicas (unidad de medida)" },
    { sigla: "DBE", significado: "Disadvantaged Business Enterprise — Empresa de Negocio en Desventaja" },
    { sigla: "EA", significado: "Environmental Assessment — Evaluación Ambiental" },
    { sigla: "EACH / EA", significado: "Each — Cada uno (unidad de cuenta individual)" },
    { sigla: "EIS", significado: "Environmental Impact Statement — Declaración de Impacto Ambiental" },
    { sigla: "FHWA", significado: "Federal Highway Administration — Administración Federal de Carreteras" },
    { sigla: "GAL", significado: "Galones (unidad de volumen para materiales líquidos)" },
    { sigla: "ITS", significado: "Intelligent Transportation System — Sistema de Transporte Inteligente" },
    { sigla: "LB", significado: "Lump Bid — Suma Global (tipo de partida de pago)" },
    { sigla: "LF", significado: "Linear Feet — Pies Lineales" },
    { sigla: "LS", significado: "Lump Sum — Suma Global de pago fija" },
    { sigla: "M2A", significado: "M2A Group — Empresa consultora de gestión de proyectos ACT" },
    { sigla: "MOS", significado: "Monthly Overrun Summary — Resumen Mensual de Sobretiempo" },
    { sigla: "MOT", significado: "Maintenance of Traffic — Plan de Mantenimiento de Tránsito" },
    { sigla: "NEC", significado: "Numero de Expediente de Contrato" },
    { sigla: "NOI", significado: "Notice of Intent — Aviso de Intención" },
    { sigla: "NPDES", significado: "National Pollutant Discharge Elimination System — Permiso de descarga de aguas" },
    { sigla: "NTF", significado: "Notice to Finish — Notificación de Finalización" },
    { sigla: "NTP", significado: "Notice to Proceed — Notificación de Inicio de Obra" },
    { sigla: "Num ACT", significado: "Número de proyecto interno asignado por la Autoridad de Carreteras" },
    { sigla: "OHE", significado: "Overhead — Gastos Generales del contratista" },
    { sigla: "OSHA", significado: "Occupational Safety and Health Administration — Agencia de Seguridad Ocupacional" },
    { sigla: "PACT", significado: "Plataforma de Administración y Control de Obras (sistema interno ACT)" },
    { sigla: "PE", significado: "Preliminary Engineering — Ingeniería Preliminar" },
    { sigla: "PI", significado: "Project Inspector — Inspector del Proyecto asignado a obra" },
    { sigla: "PM", significado: "Project Manager — Gerente de Proyecto" },
    { sigla: "QA", significado: "Quality Assurance — Aseguramiento de Calidad" },
    { sigla: "QC", significado: "Quality Control — Control de Calidad" },
    { sigla: "RE", significado: "Resident Engineer — Ingeniero Residente de la ACT" },
    { sigla: "ROA", significado: "Right of Way Acquisition — Adquisición de Derecho de Paso" },
    { sigla: "Rol A", significado: "Administrador Global — Acceso total al sistema y gestión de usuarios" },
    { sigla: "Rol B", significado: "Administrador de Proyecto — Gestión completa del proyecto asignado" },
    { sigla: "Rol C", significado: "Data Entry — Entrada de datos y edición de formularios" },
    { sigla: "Rol D", significado: "Solo Lectura — Visualización sin capacidad de editar" },
    { sigla: "Rol E", significado: "Inspector - Acceso a reportes autorizados de obra" },
    { sigla: "ROW", significado: "Right of Way — Derecho de Paso" },
    { sigla: "SSRP", significado: "Storm Sewer Rehabilitation Program — Programa de Rehabilitación de Alcantarillas" },
    { sigla: "STIP", significado: "Statewide Transportation Improvement Program — Programa de Mejoras de Transporte" },
    { sigla: "STP", significado: "Surface Transportation Program — Programa de Transportación de Superficie" },
    { sigla: "SY", significado: "Square Yards — Yardas Cuadradas" },
    { sigla: "TON", significado: "Tonelada métrica (unidad de medida en materiales)" },
];

export default function QuickHelpModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [showAbbreviations, setShowAbbreviations] = useState(false);
    const [search, setSearch] = useState("");

    const sections = [
        {
            title: "🟢 Ingreso de Datos",
            text: "• Generalmente, se deben completar los campos marcados en verde..\n\n• Cuando se registra un ítem por primera vez, se completan automáticamente la descripción y la unidad. Si el ítem ya existe en el proyecto, basta con escribir su número y se carga automáticamente."
        },
        { title: "Navegación", text: "Dashboard (inicio), Proyectos (gestión) y Reportes (oficiales)." },
        { title: "Proyectos", text: "Gestiona contratista, personal ACT, partidas, materiales y cumplimiento." },
        { title: "Control Diario", text: "Registra minutas, actividades e informes de inspección con voz o texto." },
        { title: "Reportes", text: "Genera reportes como ACT-117 (Pagos/MOS), ACT-122 (CHO), balances y muchos mas en PDF/Excel. (ver Central de reportes)" },
        { title: "Archivos", text: "📂 Sube y descarga documentos por sección para el respaldo del proyecto." },
    ];

    const filteredAbbr = abbreviations.filter(a =>
        a.sigla.toLowerCase().includes(search.toLowerCase()) ||
        a.significado.toLowerCase().includes(search.toLowerCase())
    );

    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [hasMoved, setHasMoved] = useState(false);
    const posRef = useRef(position);
    const draggingRef = useRef(false);
    const dragStartRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const savedPos = localStorage.getItem("pact_help_pos");
        if (savedPos) {
            try {
                const parsed = JSON.parse(savedPos);
                setPosition(parsed);
                posRef.current = parsed;
            } catch (e) {
                console.error("Error loading help position", e);
            }
        }
    }, []);

    useEffect(() => {
        const handleMove = (e: MouseEvent | TouchEvent) => {
            if (!draggingRef.current) return;
            const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
            
            const newX = clientX - dragStartRef.current.x;
            const newY = clientY - dragStartRef.current.y;
            
            if (Math.abs(newX - posRef.current.x) > 3 || Math.abs(newY - posRef.current.y) > 3) {
                setHasMoved(true);
            }
            
            posRef.current = { x: newX, y: newY };
            setPosition({ x: newX, y: newY });
        };

        const handleEnd = () => {
            if(draggingRef.current) {
                draggingRef.current = false;
                localStorage.setItem("pact_help_pos", JSON.stringify(posRef.current));
            }
        };

        window.addEventListener('mousemove', handleMove, { passive: false });
        window.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('mouseup', handleEnd);
        window.addEventListener('touchend', handleEnd);

        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('mouseup', handleEnd);
            window.removeEventListener('touchend', handleEnd);
        };
    }, []);

    const handlePointerDown = (e: React.PointerEvent) => {
        draggingRef.current = true;
        setHasMoved(false);
        dragStartRef.current = { 
            x: e.clientX - posRef.current.x, 
            y: e.clientY - posRef.current.y 
        };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    if (!isOpen) {
        return (
            <button
                onPointerDown={handlePointerDown}
                onClick={(e) => {
                    if (!hasMoved) {
                        setIsOpen(true);
                    }
                }}
                className="fixed z-[2000] bg-primary text-white p-4 rounded-full shadow-2xl hover:bg-blue-700 transition-all hover:scale-110 group animate-bounce touch-none"
                style={{ 
                    top: 'calc(2in - 60px)', 
                    right: '40px',
                    transform: `translate(${position.x}px, ${position.y}px)`,
                    cursor: 'grab'
                }}
                title="Ayuda del Sistema (Arrastrar para mover)"
            >
                <HelpCircle size={28} />
                <span className="absolute left-full ml-4 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl">
                    Guía Rápida
                </span>
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-300">

                {/* Header */}
                <div className="bg-primary p-6 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-xl">
                            {showAbbreviations ? <BookMarked size={24} /> : <BookOpen size={24} />}
                        </div>
                        <div>
                            <h2 className="text-xl font-black uppercase tracking-widest">
                                {showAbbreviations ? "Siglas y Abreviaturas" : "Guía Elemental PACT"}
                            </h2>
                            <p className="text-[10px] text-blue-100 font-bold opacity-80 uppercase tracking-widest">
                                {showAbbreviations ? `${filteredAbbr.length} resultado(s)` : "Plataforma de Control de Obras"}
                            </p>
                        </div>
                    </div>
                    <button onClick={() => { setIsOpen(false); setShowAbbreviations(false); setSearch(""); }} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Abbreviations View */}
                {showAbbreviations ? (
                    <>
                        <div className="px-6 pt-5 pb-2">
                            <div className="relative group">
                                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" />
                                <input
                                    type="text"
                                    autoFocus
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Buscar sigla o significado..."
                                    className="w-full pl-12 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/30 font-medium"
                                />
                            </div>
                        </div>
                        <div className="px-6 pb-4 max-h-[52vh] overflow-y-auto space-y-1.5">
                            {filteredAbbr.length === 0 ? (
                                <p className="text-center text-slate-400 text-sm py-8">No se encontraron resultados.</p>
                            ) : filteredAbbr.map((a, i) => (
                                <div key={i} className="flex gap-3 items-start p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                                    <span className="shrink-0 bg-primary/10 text-primary font-black text-xs px-2.5 py-1 rounded-lg min-w-[56px] text-center leading-5">
                                        {a.sigla}
                                    </span>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{a.significado}</p>
                                </div>
                            ))}
                        </div>
                        <div className="p-5 bg-slate-50 dark:bg-slate-800/50 flex justify-between border-t border-slate-100 dark:border-slate-800">
                            <button
                                onClick={() => { setShowAbbreviations(false); setSearch(""); }}
                                className="flex items-center gap-2 text-slate-600 dark:text-slate-300 px-5 py-2.5 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                            >
                                <ArrowLeft size={14} /> Volver a la Guía
                            </button>
                            <button
                                onClick={() => { setIsOpen(false); setShowAbbreviations(false); setSearch(""); }}
                                className="bg-slate-900 text-white px-6 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all"
                            >
                                Cerrar
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Main Guide View */}
                        <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-1 gap-4">
                                {sections.map((s, i) => {
                                    const isDataEntry = s.title.includes("Ingreso de Datos");
                                    return (
                                        <div key={i} className={`flex gap-4 items-start p-4 rounded-2xl transition-colors border-l-4 ${
                                            isDataEntry
                                                ? "bg-green-50 dark:bg-green-900/10 border-green-400 hover:bg-green-100 dark:hover:bg-green-900/20"
                                                : "hover:bg-slate-50 dark:hover:bg-slate-800/50 border-primary/20 hover:border-primary"
                                        }`}>
                                            <div className={`mt-1 shrink-0 ${isDataEntry ? "text-green-600" : "text-primary"}`}>
                                                <ChevronRight size={16} />
                                            </div>
                                            <div>
                                                <h4 className={`font-black text-xs uppercase tracking-widest mb-1 ${isDataEntry ? "text-green-700 dark:text-green-400" : "text-slate-800 dark:text-white"}`}>{s.title}</h4>
                                                <p 
                                                    className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed whitespace-pre-line"
                                                    style={{ textAlign: 'justify' }}
                                                >
                                                    {s.text}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="bg-amber-50 dark:bg-amber-900/10 border-2 border-dashed border-amber-200 dark:border-amber-800 p-6 rounded-3xl text-center">
                                <p className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-2 flex items-center justify-center gap-2">
                                    <ShieldCheck size={16} /> Soporte Técnico
                                </p>
                                <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                                    Para dudas adicionales, capacitaciones o asistencia con el sistema, escriba a soporte.
                                </p>
                                <div className="mt-4 flex items-center justify-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest">
                                    <Mail size={14} /> esaavedra@m2a-group.com
                                </div>
                            </div>
                        </div>

                        <div className="p-5 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                            <button
                                onClick={() => setShowAbbreviations(true)}
                                className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-5 py-2.5 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-600 transition-all border border-slate-200 dark:border-slate-600"
                            >
                                <BookMarked size={14} /> Siglas y Abreviaturas
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="bg-slate-900 text-white px-6 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-xl"
                            >
                                Entendido
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
