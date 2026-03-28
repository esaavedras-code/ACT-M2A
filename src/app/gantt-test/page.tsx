
"use client";

import { GanttChartExample } from "@/components/GanttChartExample";

export default function GanttTestPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 p-10">
      <h1 className="text-4xl font-black mb-8 text-primary uppercase tracking-tighter">
        Nueva Funcionalidad de Gantt
      </h1>
      <div className="w-full max-w-6xl">
        <GanttChartExample />
      </div>
      <p className="mt-8 text-slate-500 font-bold max-w-lg text-center">
        Esta librería (gantt-task-react) permite mostrar cronogramas interactivos directamente en la aplicación, con soporte para arrastrar barras y ver dependencias.
      </p>
    </div>
  );
}
