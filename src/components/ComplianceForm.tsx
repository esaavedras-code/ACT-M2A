"use client";

import { useState, useEffect, useRef, forwardRef, useImperativeHandle, Fragment } from "react";
import { supabase } from "@/lib/supabase";
import { Save, ShieldCheck, Plus, Trash2 } from "lucide-react";
import type { FormRef } from "./ProjectForm";

const COMPLIANCE_DOCS = [
    "Póliza del Fondo del Seguro del Estado",
    "Póliza de Responsabilidad Pública",
    "Resolución Corporativa",
    "Nómina Certificada",
    "Acuerdo de Reducción Período Tomar Alimentos",
    "Carteles en la Oficina",
    "Permiso Único Incidental",
    "Registro Único de Licitadores",
    "Subcontratos",
];

const COMPLIANCE_STATUSES = ["Aprobado", "Deficiente", "No requerido"];

type ComplianceRecord = {
    id?: string;
    project_id?: string;
    doc_type: string;
    date_received: string;
    date_expiry: string;
    date_validated: string;
    status: string;
    subcontractor_name?: string;
    is_sub_doc?: boolean; // New flag for hierarchical logic
};

function isExpired(date_expiry: string): boolean {
    if (!date_expiry) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(date_expiry + "T00:00:00");
    return expiry < today;
}

const ComplianceForm = forwardRef<FormRef, { projectId?: string, onDirty?: () => void, onSaved?: () => void }>(function ComplianceForm({ projectId, onDirty, onSaved }, ref) {
    const [records, setRecords] = useState<ComplianceRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
    const lastRowRef = useRef<HTMLTableRowElement>(null);

    useEffect(() => {
        if (projectId) fetchCompliance();
    }, [projectId]);

    const fetchCompliance = async () => {
        const { data } = await supabase.from("labor_compliance").select("*").eq("project_id", projectId);
        if (data && data.length > 0) {
            setRecords(data.map(r => ({
                ...r,
                date_received: r.date_received || "",
                date_expiry: r.date_expiry || "",
                date_validated: r.date_validated || "",
            })));
        } else {
            addRecord([], true);
        }
    };

    const buildNewRecord = (docType?: string, subName?: string, isSub?: boolean): ComplianceRecord => ({
        project_id: projectId,
        doc_type: docType || COMPLIANCE_DOCS[0],
        date_received: "",
        date_expiry: "",
        date_validated: "",
        status: COMPLIANCE_STATUSES[0],
        subcontractor_name: subName || "",
        is_sub_doc: isSub || false,
    });

    const addRecord = (current?: ComplianceRecord[], silent?: boolean) => {
        const base = current ?? records;
        setRecords([...base, buildNewRecord()]);
        if (!silent && onDirty) onDirty();
    };

    const removeRecord = (idx: number) => {
        const newList = records.filter((_, i) => i !== idx);
        setRecords(newList);
        if (onDirty) onDirty();
    };

    const toggleExpand = (idx: number) => {
        setExpandedRows(prev => ({ ...prev, [idx]: !prev[idx] }));
    };

    const addSubcontractor = (parentIdx: number) => {
        const newList = [...records];
        // Insert sub-record right after the parent or after its existing children
        let insertPos = parentIdx + 1;
        while (insertPos < newList.length && newList[insertPos].is_sub_doc) {
            insertPos++;
        }
        newList.splice(insertPos, 0, buildNewRecord(COMPLIANCE_DOCS[0], "", true));
        setRecords(newList);
        setExpandedRows(prev => ({ ...prev, [parentIdx]: true }));
        if (onDirty) onDirty();
    };

    const updateRecord = (idx: number, field: string, value: any) => {
        const newList = [...records];
        (newList[idx] as any)[field] = value;
        setRecords(newList);
        if (onDirty) onDirty();
    };

    const saveData = async (silent = false) => {
        if (!projectId) return;
        await supabase.from("labor_compliance").delete().eq("project_id", projectId);
        const { error } = await supabase.from("labor_compliance").insert(
            records.map(r => ({
                ...r,
                id: undefined,
                project_id: projectId,
                date_received: r.date_received || null,
                date_expiry: r.date_expiry || null,
                date_validated: r.date_validated || null,
            }))
        );
        if (error && !silent) alert("Error: " + error.message);
        else if (!error) {
            if (!silent) alert("Cumplimiento actualizado");
            if (onSaved) onSaved();
        }
    };

    useImperativeHandle(ref, () => ({ save: () => saveData(true) }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!projectId) return;
        setLoading(true);
        await saveData(false);
        setLoading(false);
    };

    // Handle TAB on the last cell of each row → add new row
    const handleLastCellTab = (e: React.KeyboardEvent, idx: number) => {
        if (e.key === "Tab" && !e.shiftKey && idx === records.length - 1) {
            e.preventDefault();
            addRecord();
            setTimeout(() => {
                // Focus first input of new row
                if (lastRowRef.current) {
                    const firstSelect = lastRowRef.current.querySelector("select");
                    if (firstSelect) (firstSelect as HTMLElement).focus();
                }
            }, 50);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <ShieldCheck className="text-primary" />
                    9. Cumplimiento Laboral
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => addRecord()}
                        className="bg-slate-100 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 text-slate-700 hover:bg-slate-200 transition-colors"
                    >
                        <Plus size={16} /> Nuevo Registro
                    </button>
                    <button onClick={handleSubmit} disabled={loading} className="btn-primary flex items-center gap-2">
                        <Save size={18} />
                        {loading ? "Sincronizando..." : "Guardar Cumplimiento"}
                    </button>
                </div>
            </div>

            <div className="card border-none shadow-sm bg-white dark:bg-slate-900 p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                <th className="text-left px-4 py-3 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider w-8">#</th>
                                <th className="text-left px-4 py-3 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider w-48">Contratista / Empresa</th>
                                <th className="text-left px-4 py-3 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Tipo de Documento</th>
                                <th className="text-left px-4 py-3 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider w-40">Fecha Recibido</th>
                                <th className="text-left px-4 py-3 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider w-40">Fecha Vencimiento</th>
                                <th className="text-left px-4 py-3 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider w-36">Estatus</th>
                                <th className="text-center px-4 py-3 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider w-16">Estado</th>
                                <th className="w-10 px-2 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {records.map((r, idx) => {
                                if (r.is_sub_doc) return null; // Root items only here

                                const expired = isExpired(r.date_expiry);
                                const isLast = idx === records.length - 1;
                                const isSubcontracts = r.doc_type === "Subcontratos";
                                const isExpanded = expandedRows[idx];

                                return (
                                    <Fragment key={idx}>
                                        <tr
                                            ref={isLast ? lastRowRef : undefined}
                                            className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group ${isSubcontracts ? 'bg-slate-50/50 dark:bg-slate-800/30' : ''}`}
                                        >
                                            {/* Index */}
                                            <td className="px-4 py-2 text-slate-400 font-mono text-xs">{idx + 1}</td>

                                            {/* Contratista (Empty for main docs) */}
                                            <td className="px-4 py-2">
                                                {isSubcontracts && (
                                                    <span className="text-[10px] font-bold text-primary/60 uppercase">General / Subcontratos</span>
                                                )}
                                            </td>

                                            {/* Tipo de Documento */}
                                            <td className="px-4 py-2">
                                                <div className="flex items-center gap-2">
                                                    {isSubcontracts && (
                                                        <button
                                                            onClick={() => toggleExpand(idx)}
                                                            className="text-primary hover:bg-primary/10 p-1 rounded transition-colors"
                                                            title={isExpanded ? "Contraer" : "Expandir subcontratos"}
                                                        >
                                                            <Plus size={14} className={`transform transition-transform ${isExpanded ? 'rotate-45' : ''}`} />
                                                        </button>
                                                    )}
                                                    <select
                                                        className={`input-field text-sm font-semibold w-full ${isSubcontracts ? 'text-primary' : ''}`}
                                                        value={r.doc_type || ""}
                                                        onChange={(e) => updateRecord(idx, 'doc_type', e.target.value)}
                                                    >
                                                        {COMPLIANCE_DOCS.map(doc => (
                                                            <option key={doc} value={doc}>{doc}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </td>

                                            {/* Fecha Recibido */}
                                            <td className="px-4 py-2">
                                                {!isSubcontracts && (
                                                    <input
                                                        type="date"
                                                        className="input-field text-xs w-full"
                                                        value={r.date_received || ""}
                                                        onChange={(e) => updateRecord(idx, 'date_received', e.target.value)}
                                                    />
                                                )}
                                                {isSubcontracts && (
                                                    <button
                                                        onClick={() => addSubcontractor(idx)}
                                                        className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                                                    >
                                                        <Plus size={12} /> Añadir Subcontratista
                                                    </button>
                                                )}
                                            </td>

                                            {/* Fecha Vencimiento */}
                                            <td className="px-4 py-2">
                                                {!isSubcontracts && (
                                                    <input
                                                        type="date"
                                                        className="input-field text-xs w-full"
                                                        value={r.date_expiry || ""}
                                                        onChange={(e) => updateRecord(idx, 'date_expiry', e.target.value)}
                                                        onKeyDown={(e) => handleLastCellTab(e, idx)}
                                                    />
                                                )}
                                            </td>

                                            {/* Estatus */}
                                            <td className="px-4 py-2">
                                                {!isSubcontracts && (
                                                    <select
                                                        className="input-field text-xs w-full"
                                                        value={r.status || ""}
                                                        onChange={(e) => updateRecord(idx, 'status', e.target.value)}
                                                        onKeyDown={(e) => handleLastCellTab(e, idx)}
                                                    >
                                                        {COMPLIANCE_STATUSES.map(s => (
                                                            <option key={s} value={s}>{s}</option>
                                                        ))}
                                                    </select>
                                                )}
                                            </td>

                                            {/* Indicador de vencimiento */}
                                            <td className="px-4 py-2 text-center">
                                                {!isSubcontracts && (
                                                    <div className="flex items-center justify-center">
                                                        <div
                                                            title={expired ? "Documento vencido" : r.date_expiry ? "Vigente" : "Sin fecha de vencimiento"}
                                                            style={{
                                                                width: 18,
                                                                height: 18,
                                                                borderRadius: "50%",
                                                                backgroundColor: expired
                                                                    ? "#ef4444"
                                                                    : r.date_expiry
                                                                        ? "#22c55e"
                                                                        : "#d1d5db",
                                                                boxShadow: expired
                                                                    ? "0 0 6px 2px rgba(239,68,68,0.45)"
                                                                    : r.date_expiry
                                                                        ? "0 0 6px 2px rgba(34,197,94,0.35)"
                                                                        : "none",
                                                                transition: "background-color 0.3s, box-shadow 0.3s",
                                                                flexShrink: 0,
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </td>

                                            {/* Eliminar */}
                                            <td className="px-2 py-2 text-center">
                                                <button
                                                    onClick={() => removeRecord(idx)}
                                                    className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Eliminar fila"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </td>
                                        </tr>

                                        {/* Render children if expanded */}
                                        {isSubcontracts && isExpanded && records.map((sub, sidx) => {
                                            const isActualChild = sidx > idx && sub.is_sub_doc &&
                                                !records.slice(idx + 1, sidx).some(m => !m.is_sub_doc);

                                            if (!isActualChild) return null;

                                            const subExpired = isExpired(sub.date_expiry);
                                            return (
                                                <tr key={`sub-${sidx}`} className="bg-slate-50/30 dark:bg-slate-800/20 animate-in slide-in-from-top-1 duration-200">
                                                    <td className="px-4 py-2"></td>
                                                    {/* Nombre del Contratista */}
                                                    <td className="px-4 py-2">
                                                        <input
                                                            type="text"
                                                            placeholder="Empresa / Contratista"
                                                            className="input-field text-sm font-bold border-primary/20 bg-white"
                                                            value={sub.subcontractor_name || ""}
                                                            onChange={(e) => updateRecord(sidx, 'subcontractor_name', e.target.value)}
                                                        />
                                                    </td>
                                                    {/* Tipo de Documento */}
                                                    <td className="px-4 py-2">
                                                        <select
                                                            className="input-field text-xs font-semibold w-full bg-white border-slate-200"
                                                            value={sub.doc_type || ""}
                                                            onChange={(e) => updateRecord(sidx, 'doc_type', e.target.value)}
                                                        >
                                                            {COMPLIANCE_DOCS.filter(d => d !== "Subcontratos").map(doc => (
                                                                <option key={doc} value={doc}>{doc}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <input
                                                            type="date"
                                                            className="input-field text-xs w-full"
                                                            value={sub.date_received || ""}
                                                            onChange={(e) => updateRecord(sidx, 'date_received', e.target.value)}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <input
                                                            type="date"
                                                            className="input-field text-xs w-full"
                                                            value={sub.date_expiry || ""}
                                                            onChange={(e) => updateRecord(sidx, 'date_expiry', e.target.value)}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <select
                                                            className="input-field text-xs w-full"
                                                            value={sub.status || ""}
                                                            onChange={(e) => updateRecord(sidx, 'status', e.target.value)}
                                                        >
                                                            {COMPLIANCE_STATUSES.map(s => (
                                                                <option key={s} value={s}>{s}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                        <div className="flex items-center justify-center">
                                                            <div
                                                                style={{
                                                                    width: 14,
                                                                    height: 14,
                                                                    borderRadius: "50%",
                                                                    backgroundColor: subExpired ? "#ef4444" : sub.date_expiry ? "#22c55e" : "#d1d5db",
                                                                    boxShadow: subExpired ? "0 0 4px 1px rgba(239,68,68,0.4)" : "none"
                                                                }}
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="px-2 py-2 text-center">
                                                        <button
                                                            onClick={() => removeRecord(sidx)}
                                                            className="text-slate-300 hover:text-red-500 transition-colors"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Footer hint */}
                <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                    <p className="text-[11px] text-slate-400">
                        Presiona <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[10px] font-mono">Tab</kbd> en el último campo para añadir una nueva línea.
                        &nbsp;●&nbsp;<span className="text-green-500 font-semibold">Verde</span> = vigente &nbsp;●&nbsp;<span className="text-red-500 font-semibold">Rojo</span> = vencido &nbsp;●&nbsp;<span className="text-slate-400 font-semibold">Gris</span> = sin fecha
                    </p>
                </div>
            </div>
        </div>
    );
});

export default ComplianceForm;
