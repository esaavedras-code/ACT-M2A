"use client";

import { useState, useEffect, forwardRef, useImperativeHandle, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Save, Plus, Trash2, Download, Upload } from "lucide-react";
import FloatingFormActions from "./FloatingFormActions";
import { exportSectionToJSON, importSectionFromJSON } from "@/lib/sectionIO";

interface FundRow {
    id?: string;
    unit_name: string;
    federal_share_pct: number;
    participating: number;
    contingencies_participating: number;
    payroll_mileage_diets: number;
    fa_funds_requested: number;
    contingencies_federal: number;
    calc_toll_credits: number;
    contingencies_toll: number;
    state_share_federal: number;
    contingencies_state_share: number;
    not_participating_state: number;
    contingencies_not_participating: number;
    payroll_mileage_diets_state: number;
}

/** Formato monetario: $ 1,234.56 */
function formatMoney(value: number): string {
    if (value === null || value === undefined || value === 0 || isNaN(value)) return "$ 0.00";
    return "$ " + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Celda editable con formato monetario al perder el foco */
const MoneyCell = ({
    fieldKey,
    rowIdx,
    field,
    funds,
    editingField,
    setEditingField,
    handleChange,
    className = "",
    style,
}: {
    fieldKey: string;
    rowIdx: number;
    field: keyof FundRow;
    funds: FundRow[];
    editingField: string | null;
    setEditingField: (val: string | null) => void;
    handleChange: (index: number, field: keyof FundRow, value: any) => void;
    className?: string;
    style?: React.CSSProperties;
}) => {
    const isEditing = editingField === fieldKey;
    const numVal = (funds[rowIdx] as any)[field] as number;
    
    // Estado local temporal para permitir escribir libremente (puntos decimales, etc.)
    const [tempValue, setTempValue] = useState<string>((numVal ?? 0).toString());

    useEffect(() => {
        if (!isEditing) {
            setTempValue((numVal ?? 0).toString());
        }
    }, [numVal, isEditing]);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        setEditingField(fieldKey);
        // Si el valor es 0, lo borramos para facilitar la escritura
        if (numVal === 0 || numVal === null || numVal === undefined) {
            setTempValue("");
        } else {
            setTempValue(numVal.toString());
        }
    };

    const handleBlur = () => {
        setEditingField(null);
        const parsed = parseFloat(tempValue);
        handleChange(rowIdx, field, isNaN(parsed) ? 0 : parsed);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value;
        // Si el valor era 0 y se escribe algo, quitamos el 0 si estaba al inicio (comportamiento solicitado)
        if (tempValue === "0" && val !== "0" && val.length > 1) {
            if (val.startsWith("0")) val = val.substring(1);
        }
        setTempValue(val);
    };

    return (
        <td className={`border p-0.5 ${className}`} style={style}>
            <input
                type="text"
                suppressHydrationWarning
                className="w-full bg-transparent border-none p-0.5 text-right min-w-[120px]"
                value={isEditing ? tempValue : formatMoney(numVal)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onChange={handleInputChange}
                placeholder="0.00"
            />
        </td>
    );
};

const ProjectAgreementForm = forwardRef(function ProjectAgreementForm({ projectId, hideActions = false }: { projectId: string, hideActions?: boolean }, ref) {
    const [funds, setFunds] = useState<FundRow[]>([]);
    const fundsRef = useRef<FundRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingField, setEditingField] = useState<string | null>(null);

    useEffect(() => {
        if (projectId) fetchFunds();
    }, [projectId]);

    useImperativeHandle(ref, () => ({
        save: () => saveFunds(true)
    }));

    const fetchFunds = async () => {
        const { data } = await supabase
            .from('project_agreement_funds')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: true });
        
        if (data && data.length > 0) {
            setFunds(data);
            fundsRef.current = data;
        } else {
            const initialFunds = [
                { unit_name: "Unit 1", federal_share_pct: 100, participating: 0, contingencies_participating: 0, payroll_mileage_diets: 0, fa_funds_requested: 0, contingencies_federal: 0, calc_toll_credits: 0, contingencies_toll: 0, state_share_federal: 0, contingencies_state_share: 0, not_participating_state: 0, contingencies_not_participating: 0, payroll_mileage_diets_state: 0 },
                { unit_name: "Unit 2", federal_share_pct: 100, participating: 0, contingencies_participating: 0, payroll_mileage_diets: 0, fa_funds_requested: 0, contingencies_federal: 0, calc_toll_credits: 0, contingencies_toll: 0, state_share_federal: 0, contingencies_state_share: 0, not_participating_state: 0, contingencies_not_participating: 0, payroll_mileage_diets_state: 0 }
            ];
            setFunds(initialFunds);
            fundsRef.current = initialFunds;
        }
    };

    const handleChange = (index: number, field: keyof FundRow, value: any) => {
        const newFunds = [...(fundsRef.current && fundsRef.current.length > 0 ? fundsRef.current : funds)];
        (newFunds[index] as any)[field] = value;
        setFunds(newFunds);
        fundsRef.current = newFunds;
    };

    const addUnit = () => {
        const currentFunds = fundsRef.current && fundsRef.current.length > 0 ? fundsRef.current : funds;
        const newFunds = [...currentFunds, { 
            unit_name: `Unit ${currentFunds.length + 1}`, 
            federal_share_pct: 100, 
            participating: 0, contingencies_participating: 0, payroll_mileage_diets: 0, 
            fa_funds_requested: 0, contingencies_federal: 0, calc_toll_credits: 0, contingencies_toll: 0, 
            state_share_federal: 0, contingencies_state_share: 0, not_participating_state: 0, 
            contingencies_not_participating: 0, payroll_mileage_diets_state: 0 
        }];
        setFunds(newFunds);
        fundsRef.current = newFunds;
    };

    const saveFunds = async (silent = false) => {
        setLoading(true);
        // Evitamos guardar con un ref.current vacío si no se montó completamente antes de la acción rápida
        const currentFunds = fundsRef.current && fundsRef.current.length > 0 ? fundsRef.current : funds;
        try {
            const { error } = await supabase
                .from('project_agreement_funds')
                .upsert(currentFunds.map(f => ({ ...f, project_id: projectId })));

            if (error) throw error;
            if(!silent) alert("Información del Project Agreement guardada con éxito.");
            return { success: true };
        } catch (err: any) {
            console.error("Error saving funds:", err);
            if(!silent) alert("Error al guardar fondos: " + err.message);
            // Re-lanzamos el error para que ProjectForm pueda capturarlo si es llamado desde allí
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const result = await importSectionFromJSON(file);
        if (result.success && Array.isArray(result.data)) {
            // Limpiar IDs anteriores para que se generen nuevos al hacer upsert o se vinculen a este proyecto
            const cleanedData = result.data.map((f: any) => {
                const { id, project_id, created_at, ...rest } = f;
                return { ...rest, project_id: projectId };
            });
            setFunds(cleanedData);
            fundsRef.current = cleanedData;
            alert("Datos importados correctamente. No olvide Guardar para confirmar los cambios.");
        } else {
            alert("Error al importar: " + (result.error || "Formato no válido"));
        }
        e.target.value = "";
    };


    return (
        <div className="space-y-4">
            <div className="sticky top-16 z-40 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md pt-6 pb-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">Fondos Originales (Project Agreement)</h3>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button type="button" onClick={addUnit} className="btn-secondary flex-1 sm:flex-none py-1.5 px-3 text-[10px] flex items-center justify-center gap-1">
                        <Plus size={14} /> Añadir Unidad
                    </button>
                    {/* El botón de guardar ahora es flotante */}
                </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
                <table className="min-w-full text-[10px] border-collapse bg-white dark:bg-slate-900">
                    <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            <th className="border p-1">Units</th>
                            <th className="border p-1" style={{ backgroundColor: '#66FF99' }}>Fed Share %</th>
                            <th className="border p-1" style={{ backgroundColor: '#66FF99' }}>Participating</th>
                            <th className="border p-1" style={{ backgroundColor: '#66FF99' }}>Contingencies (Participating)</th>
                            <th className="border p-1">Payroll/Mileage and Diets</th>
                            <th className="border p-1" style={{ backgroundColor: '#66FF99' }}>F.A. Fund Requested</th>
                            <th className="border p-1 bg-blue-50 dark:bg-blue-900/20">Fed Cont.</th>
                            <th className="border p-1 bg-blue-50 dark:bg-blue-900/20">Toll Credits</th>
                            <th className="border p-1 bg-blue-50 dark:bg-blue-900/20">Contingencies (Toll Credits)</th>
                            <th className="border p-1 bg-green-50 dark:bg-green-900/20">State Share of Federal Funds</th>
                            <th className="border p-1 bg-green-50 dark:bg-green-900/20">Contingencies (State Share)</th>
                            <th className="border p-1" style={{ backgroundColor: '#66FF99' }}>Not Participating (State Funds)</th>
                            <th className="border p-1" style={{ backgroundColor: '#66FF99' }}>Contingencies (No Part.)</th>
                            <th className="border p-1 bg-gray-50 dark:bg-gray-900/20">Payroll, Millage and Diets</th>
                            <th className="border p-1">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {funds.map((row, idx) => (
                            <tr key={idx}>
                                {/* Unit name */}
                                <td className="border p-0.5">
                                    <input type="text" className="w-full bg-transparent border-none p-0.5 min-w-[120px]" value={row.unit_name} onChange={(e) => handleChange(idx, 'unit_name', e.target.value)} />
                                </td>
                                {/* Fed Share % */}
                                <td className="border p-0.5" style={{ backgroundColor: '#66FF99' }}>
                                    <input type="number" className="w-full bg-transparent border-none p-0.5 text-right min-w-[100px]" value={row.federal_share_pct} onChange={(e) => handleChange(idx, 'federal_share_pct', parseFloat(e.target.value))} />
                                </td>
                                {/* Celdas monetarias */}
                                <MoneyCell fieldKey={`participating_${idx}`} rowIdx={idx} field="participating" funds={funds} editingField={editingField} setEditingField={setEditingField} handleChange={handleChange} className="font-bold" style={{ backgroundColor: '#66FF99' }} />
                                <MoneyCell fieldKey={`cont_part_${idx}`} rowIdx={idx} field="contingencies_participating" funds={funds} editingField={editingField} setEditingField={setEditingField} handleChange={handleChange} className="font-bold" style={{ backgroundColor: '#66FF99' }} />
                                <MoneyCell fieldKey={`payroll_${idx}`} rowIdx={idx} field="payroll_mileage_diets" funds={funds} editingField={editingField} setEditingField={setEditingField} handleChange={handleChange} />
                                {/* F.A. Requested — verde */}
                                <MoneyCell fieldKey={`fa_req_${idx}`} rowIdx={idx} field="fa_funds_requested" funds={funds} editingField={editingField} setEditingField={setEditingField} handleChange={handleChange} className="font-bold" style={{ backgroundColor: '#66FF99' }} />
                                <MoneyCell fieldKey={`fed_cont_${idx}`} rowIdx={idx} field="contingencies_federal" funds={funds} editingField={editingField} setEditingField={setEditingField} handleChange={handleChange} className="bg-blue-50/50 dark:bg-blue-900/10" />
                                <MoneyCell fieldKey={`toll_${idx}`} rowIdx={idx} field="calc_toll_credits" funds={funds} editingField={editingField} setEditingField={setEditingField} handleChange={handleChange} className="bg-blue-50/50 dark:bg-blue-900/10" />
                                <MoneyCell fieldKey={`cont_toll_${idx}`} rowIdx={idx} field="contingencies_toll" funds={funds} editingField={editingField} setEditingField={setEditingField} handleChange={handleChange} className="bg-blue-50/50 dark:bg-blue-900/10" />
                                <MoneyCell fieldKey={`state_share_${idx}`} rowIdx={idx} field="state_share_federal" funds={funds} editingField={editingField} setEditingField={setEditingField} handleChange={handleChange} className="bg-green-50/50 dark:bg-green-900/10" />
                                <MoneyCell fieldKey={`cont_state_share_${idx}`} rowIdx={idx} field="contingencies_state_share" funds={funds} editingField={editingField} setEditingField={setEditingField} handleChange={handleChange} className="bg-green-50/50 dark:bg-green-900/10" />
                                {/* Not Participating (State Funds) — verde */}
                                <td className="border p-0.5" style={{ backgroundColor: '#66FF99' }}>
                                    <MoneyCell fieldKey={`not_participating_${idx}`} rowIdx={idx} field="not_participating_state" funds={funds} editingField={editingField} setEditingField={setEditingField} handleChange={handleChange} className="font-bold" />
                                </td>
                                {/* Contingencies (No Part.) — verde */}
                                <td className="border p-0.5" style={{ backgroundColor: '#66FF99' }}>
                                    <MoneyCell fieldKey={`cont_nop_${idx}`} rowIdx={idx} field="contingencies_not_participating" funds={funds} editingField={editingField} setEditingField={setEditingField} handleChange={handleChange} className="font-bold" />
                                </td>
                                <MoneyCell fieldKey={`payroll_mileage_diets_state_${idx}`} rowIdx={idx} field="payroll_mileage_diets_state" funds={funds} editingField={editingField} setEditingField={setEditingField} handleChange={handleChange} className="bg-gray-50/50 dark:bg-gray-900/10" />
                                {/* Acciones */}
                                <td className="border p-0.5 text-center">
                                    <button type="button" onClick={() => {
                                        const currentFunds = fundsRef.current && fundsRef.current.length > 0 ? fundsRef.current : funds;
                                        const newList = currentFunds.filter((_, i) => i !== idx);
                                        setFunds(newList);
                                        fundsRef.current = newList;
                                    }} className="text-red-500 hover:text-red-700">
                                        <Trash2 size={12} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {!hideActions && (
                <FloatingFormActions
                    actions={[
                        {
                            label: "Exportar Datos", position: "middle-right" as const, size: "small" as const,
                            icon: <Download />,
                            onClick: () => exportSectionToJSON("project_agreement", funds),
                            description: "Descargar los datos de esta tabla en formato JSON",
                            variant: 'info' as const,
                            disabled: loading,

                        },
                        {
                            label: "Importar Datos", position: "middle-right" as const, size: "small" as const,
                            icon: <Upload />,
                            onClick: () => document.getElementById('import-funds-json')?.click(),
                            description: "Cargar datos desde un archivo JSON previamente exportado",
                            variant: 'secondary' as const,
                            disabled: loading,

                        },
                        {
                            label: loading ? "Guardando..." : "Guardar cambios",
                            icon: <Save />,
                            onClick: () => saveFunds(),
                            description: "Actualizar la tabla de fondos originales y créditos de peaje del Project Agreement",
                            variant: 'primary' as const,
                            disabled: loading
                        }
                    ]}
                />
            )}
            <input 
                id="import-funds-json"
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImport}
            />
        </div>
    );
});

export default ProjectAgreementForm;

