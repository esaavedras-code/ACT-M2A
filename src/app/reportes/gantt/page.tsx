
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { ProfessionalGantt } from "@/components/ProfessionalGantt";
import { ArrowLeft, Download, FileText } from "lucide-react";
import Link from "next/link";

function GanttViewContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const projectId = searchParams.get("id");
    const choId = searchParams.get("choId");

    if (!projectId || !choId) {
        return (
            <div className="p-20 text-center">
                <h2 className="text-2xl font-bold text-red-500">Error: Falta ID de Proyecto o CHO</h2>
                <button onClick={() => router.back()} className="mt-4 text-primary font-bold underline">Volver</button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 md:p-12 font-geist">
            <div className="max-w-7xl mx-auto">
                
                {/* Header Navigation */}
                <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <Link 
                        href={`/reportes?id=${projectId}`}
                        className="flex items-center gap-2 text-slate-500 hover:text-primary transition-colors font-black uppercase tracking-widest text-xs group"
                    >
                        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                        Volver a Reportes
                    </Link>

                    <div className="flex items-center gap-3">
                        <button 
                            onClick={async () => {
                                const { generateTimeExtensionChartLogic } = await import("@/lib/reportLogic");
                                await generateTimeExtensionChartLogic(projectId, choId);
                            }}
                            className="bg-primary text-white px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                        >
                            <Download size={18} /> Descargar PDF Oficial
                        </button>
                    </div>
                </div>

                {/* Main Gantt Component */}
                <ProfessionalGantt projectId={projectId} choId={choId} />

                {/* Info Card */}
                <div className="mt-12 p-8 rounded-[40px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xl">
                    <div className="flex gap-4 items-start">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
                            <FileText className="text-blue-500" size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Sobre este Análisis</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed mt-2 max-w-3xl">
                                Este cronograma se genera automáticamente analizando el texto de la <strong>justificación de la Orden de Cambio</strong>. 
                                Identifica las fases de aprobación, fabricación e instalación mencionadas en el documento y las proyecta visualmente 
                                sobre la línea de tiempo del contrato vigente.
                            </p>
                        </div>
                    </div>
                </div>
                
            </div>
        </div>
    );
}

export default function GanttViewPage() {
    return (
        <Suspense fallback={<div className="p-20 text-center font-black animate-pulse uppercase tracking-[0.5em] text-slate-300">Cargando Entorno...</div>}>
            <GanttViewContent />
        </Suspense>
    );
}
