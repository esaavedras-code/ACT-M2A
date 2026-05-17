"use client";

import { useState, useEffect, forwardRef, useImperativeHandle, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Save, Plus, Trash2, Download, Upload, Printer } from "lucide-react";
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
            const sortedData = data.sort((a, b) => {
                const matchA = a.unit_name.match(/\d+/);
                const matchB = b.unit_name.match(/\d+/);
                const numA = matchA ? parseInt(matchA[0], 10) : 0;
                const numB = matchB ? parseInt(matchB[0], 10) : 0;
                if (numA !== numB) return numA - numB;
                return a.unit_name.localeCompare(b.unit_name);
            });
            setFunds(sortedData);
            fundsRef.current = sortedData;
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
        const nextFunds = [...(fundsRef.current.length > 0 ? fundsRef.current : funds)];
        (nextFunds[index] as any)[field] = value;
        
        // Recalcular Fed Share % automáticamente si cambian sus dependencias
        if (field === 'fa_funds_requested' || field === 'participating' || field === 'contingencies_participating') {
            const row = nextFunds[index];
            const fa = row.fa_funds_requested || 0;
            const part = row.participating || 0;
            const cont = row.contingencies_participating || 0;
            const total = part + cont;
            
            if (total > 0) {
                row.federal_share_pct = parseFloat(((fa / total) * 100).toFixed(2));
            } else {
                row.federal_share_pct = 0;
            }
        }

        setFunds(nextFunds);
        fundsRef.current = nextFunds;
    };

    const addUnit = () => {
        const currentFunds = fundsRef.current && fundsRef.current.length > 0 ? fundsRef.current : funds;
        
        // Encontrar el número más alto actual para sugerir el siguiente
        let maxNum = 0;
        currentFunds.forEach(f => {
            const match = f.unit_name.match(/(\d+)/);
            if (match) {
                const n = parseInt(match[0]);
                if (n > maxNum) maxNum = n;
            }
        });
        const nextNum = Math.max(currentFunds.length + 1, maxNum + 1);

        const newFunds = [...currentFunds, { 
            unit_name: `Unit ${nextNum}`, 
            federal_share_pct: 100, 
            participating: 0, contingencies_participating: 0, payroll_mileage_diets: 0, 
            fa_funds_requested: 0, contingencies_federal: 0, calc_toll_credits: 0, contingencies_toll: 0, 
            state_share_federal: 0, contingencies_state_share: 0, not_participating_state: 0, 
            contingencies_not_participating: 0, payroll_mileage_diets_state: 0 
        }];
        setFunds(newFunds);
        fundsRef.current = newFunds;
    };

    const reIndexUnits = () => {
        const currentFunds = fundsRef.current && fundsRef.current.length > 0 ? fundsRef.current : funds;
        const newFunds = currentFunds.map((f, i) => ({
            ...f,
            unit_name: `Unit ${i + 1}`
        }));
        setFunds(newFunds);
        fundsRef.current = newFunds;
    };

    const saveFunds = async (silent = false) => {
        if (!projectId) {
            console.warn("No se puede guardar fondos: projectId es nulo o indefinido");
            return { success: false };
        }

        setLoading(true);
        const currentFunds = fundsRef.current && fundsRef.current.length > 0 ? fundsRef.current : funds;
        
        try {
            // Sanitizar datos para asegurar que son números válidos y tienen el project_id correcto
            const dataToUpsert = currentFunds.map(f => {
                const row = { ...f, project_id: projectId };
                
                // Si el ID está vacío o es null, lo eliminamos para que Supabase genere uno nuevo
                if (!row.id || row.id === "") {
                    delete row.id;
                }

                // Asegurar que todos los campos numéricos sean números (no strings o NaN)
                Object.keys(row).forEach(key => {
                    const val = (row as any)[key];
                    if (key !== 'id' && key !== 'project_id' && key !== 'unit_name' && key !== 'created_at') {
                        const parsed = parseFloat(val);
                        (row as any)[key] = isNaN(parsed) ? 0 : parsed;
                    }
                });
                return row;
            });

            console.log("DEBUG: Payload a enviar a Supabase:", JSON.stringify(dataToUpsert, null, 2));

            const { data, error } = await supabase
                .from('project_agreement_funds')
                .upsert(dataToUpsert, { onConflict: 'project_id, unit_name' })
                .select();

            if (error) {
                console.error("Supabase upsert error (raw):", error);
                const detailedError = JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
                console.error("Supabase upsert error (detailed):", detailedError);
                throw new Error(detailedError);
            }
            
            if (data) {
                setFunds(data);
                fundsRef.current = data;
            }

            if(!silent) alert("Información del Project Agreement guardada con éxito.");
            return { success: true };
        } catch (err: any) {
            console.error("Error capturado en saveFunds:", err);
            const errorInfo = err instanceof Error ? {
                message: err.message,
                stack: err.stack,
                ...err
            } : err;
            
            const errorMsg = JSON.stringify(errorInfo, Object.getOwnPropertyNames(errorInfo), 2);
            console.error("Error detallado (JSON):", errorMsg);
            
            if(!silent) alert("Error al guardar fondos (Detalle): " + (err.message || errorMsg));
            throw err;
        } finally {
            setLoading(false);
        }
    };



    return (
        <div className="space-y-4">
            <div className="sticky top-16 z-40 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md pt-6 pb-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">Fondos Originales (Project Agreement)</h3>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button type="button" onClick={reIndexUnits} className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full py-2 px-4 text-[9px] font-bold uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center justify-center gap-2 text-slate-500">
                        Consecutivos (1, 2, 3...)
                    </button>
                    <button type="button" onClick={addUnit} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full py-2 px-4 text-[10px] font-black uppercase tracking-widest shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 text-slate-600 dark:text-slate-300">
                        <Plus size={14} className="text-blue-500" /> Añadir Unidad
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl">
                <table className="min-w-full text-[10px] border-collapse bg-white dark:bg-slate-900">
                    <thead>
                        {/* Grouped Headers */}
                        <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase tracking-tighter font-black">
                            <th className="border-b border-r p-2" rowSpan={2}>Units</th>
                            <th className="border-b border-r p-2" rowSpan={2} style={{ backgroundColor: '#FFF5EB' }}>Fed Share %</th>
                            <th className="border-b border-r p-2 text-center bg-slate-100/50 dark:bg-slate-800" colSpan={3}>INPUT PROJECT AGREEMENT</th>
                            <th className="border-b border-r p-2 text-center bg-orange-50/50 dark:bg-orange-900/10" colSpan={1}>FEDERAL FUNDS</th>
                            <th className="border-b border-r p-2 text-center bg-yellow-50/50 dark:bg-yellow-900/10" colSpan={3}>STATE FUNDS</th>
                            <th className="border-b p-2" rowSpan={2}>Acciones</th>
                        </tr>
                        <tr className="bg-slate-50 dark:bg-slate-800/30 text-slate-400 dark:text-slate-500 text-[9px]">
                            {/* Input Project Agreement */}
                            <th className="border-b border-r p-2">Participating</th>
                            <th className="border-b border-r p-2">Contingencies (Part.)</th>
                            <th className="border-b border-r p-2">Payroll/Mileage/Diets</th>
                            {/* Federal Funds */}
                            <th className="border-b border-r p-2">F.A. Fund Requested</th>
                            {/* State Funds */}
                            <th className="border-b border-r p-2">Not Participating</th>
                            <th className="border-b border-r p-2">Contingencies (No Part.)</th>
                            <th className="border-b border-r p-2">Payroll/Mileage/Diets</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {funds.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                {/* Unit name */}
                                <td className="border-r p-1">
                                    <input 
                                        type="text" 
                                        className="w-full bg-transparent border-none p-1 font-bold text-slate-700 dark:text-slate-200 min-w-[100px]" 
                                        value={row.unit_name} 
                                        onChange={(e) => handleChange(idx, 'unit_name', e.target.value)} 
                                    />
                                </td>
                                {/* Fed Share % (Calculado) */}
                                <td className="border-r p-1 text-center" style={{ backgroundColor: '#FFF5EB' }}>
                                    <input 
                                        type="text" 
                                        readOnly
                                        className="w-full bg-transparent border-none p-1 text-center font-black text-orange-600 cursor-default focus:outline-none" 
                                        value={`${row.federal_share_pct.toFixed(2)}%`}
                                    />
                                </td>
                                
                                {/* INPUT PROJECT AGREEMENT */}
                                <MoneyCell fieldKey={`participating_${idx}`} rowIdx={idx} field="participating" funds={funds} editingField={editingField} setEditingField={setEditingField} handleChange={handleChange} className="border-r font-bold text-slate-900 dark:text-white" style={{ backgroundColor: '#66FF99' }} />
                                <MoneyCell fieldKey={`cont_part_${idx}`} rowIdx={idx} field="contingencies_participating" funds={funds} editingField={editingField} setEditingField={setEditingField} handleChange={handleChange} className="border-r text-slate-700" style={{ backgroundColor: '#66FF99' }} />
                                <MoneyCell fieldKey={`payroll_${idx}`} rowIdx={idx} field="payroll_mileage_diets" funds={funds} editingField={editingField} setEditingField={setEditingField} handleChange={handleChange} className="border-r text-slate-700" style={{ backgroundColor: '#66FF99' }} />
                                
                                {/* FEDERAL FUNDS */}
                                <MoneyCell fieldKey={`fa_req_${idx}`} rowIdx={idx} field="fa_funds_requested" funds={funds} editingField={editingField} setEditingField={setEditingField} handleChange={handleChange} className="border-r font-black text-blue-700 bg-blue-50/30" style={{ backgroundColor: '#66FF99' }} />
                                
                                {/* STATE FUNDS */}
                                <MoneyCell fieldKey={`not_participating_${idx}`} rowIdx={idx} field="not_participating_state" funds={funds} editingField={editingField} setEditingField={setEditingField} handleChange={handleChange} className="border-r font-bold text-emerald-800" style={{ backgroundColor: '#66FF99' }} />
                                <MoneyCell fieldKey={`cont_nop_${idx}`} rowIdx={idx} field="contingencies_not_participating" funds={funds} editingField={editingField} setEditingField={setEditingField} handleChange={handleChange} className="border-r text-emerald-800" style={{ backgroundColor: '#66FF99' }} />
                                <MoneyCell fieldKey={`payroll_mileage_diets_state_${idx}`} rowIdx={idx} field="payroll_mileage_diets_state" funds={funds} editingField={editingField} setEditingField={setEditingField} handleChange={handleChange} className="border-r text-slate-700" style={{ backgroundColor: '#66FF99' }} />
                                
                                {/* Acciones */}
                                <td className="p-1 text-center">
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            const currentFunds = fundsRef.current && fundsRef.current.length > 0 ? fundsRef.current : funds;
                                            const newList = currentFunds.filter((_, i) => i !== idx);
                                            setFunds(newList);
                                            fundsRef.current = newList;
                                        }} 
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-red-400 hover:bg-red-50 hover:text-red-600 transition-all"
                                    >
                                        <Trash2 size={14} />
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
                            label: "Imprimir",
                            icon: <Printer />,
                            onClick: () => window.print(),
                            description: "Imprimir esta tabla de fondos originales",
                            variant: 'secondary' as const,
                            size: 'small' as const
                        },
                        {
                            label: loading ? "Guardando..." : "Guardar cambios",
                            icon: <Save />,
                            onClick: () => saveFunds(),
                            description: "Actualizar la tabla de fondos originales del Project Agreement",
                            variant: 'primary' as const,
                            disabled: loading
                        }
                    ]}
                />
            )}
        </div>
    );
});

export default ProjectAgreementForm;

