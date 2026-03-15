"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Save, Plus, Trash2 } from "lucide-react";

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
    if (value === 0 || isNaN(value)) return "$ 0.00";
    return "$ " + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ProjectAgreementForm({ projectId }: { projectId: string }) {
    const [funds, setFunds] = useState<FundRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingField, setEditingField] = useState<string | null>(null);

    useEffect(() => {
        if (projectId) fetchFunds();
    }, [projectId]);

    const fetchFunds = async () => {
        const { data } = await supabase
            .from('project_agreement_funds')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: true });
        
        if (data && data.length > 0) {
            setFunds(data);
        } else {
            setFunds([
                { unit_name: "Unit 1", federal_share_pct: 100, participating: 0, contingencies_participating: 0, payroll_mileage_diets: 0, fa_funds_requested: 0, contingencies_federal: 0, calc_toll_credits: 0, contingencies_toll: 0, state_share_federal: 0, contingencies_state_share: 0, not_participating_state: 0, contingencies_not_participating: 0, payroll_mileage_diets_state: 0 },
                { unit_name: "Unit 2", federal_share_pct: 100, participating: 0, contingencies_participating: 0, payroll_mileage_diets: 0, fa_funds_requested: 0, contingencies_federal: 0, calc_toll_credits: 0, contingencies_toll: 0, state_share_federal: 0, contingencies_state_share: 0, not_participating_state: 0, contingencies_not_participating: 0, payroll_mileage_diets_state: 0 }
            ]);
        }
    };

    const handleChange = (index: number, field: keyof FundRow, value: any) => {
        const newFunds = [...funds];
        (newFunds[index] as any)[field] = value;
        setFunds(newFunds);
    };

    const addUnit = () => {
        setFunds([...funds, { 
            unit_name: `Unit ${funds.length + 1}`, 
            federal_share_pct: 100, 
            participating: 0, contingencies_participating: 0, payroll_mileage_diets: 0, 
            fa_funds_requested: 0, contingencies_federal: 0, calc_toll_credits: 0, contingencies_toll: 0, 
            state_share_federal: 0, contingencies_state_share: 0, not_participating_state: 0, 
            contingencies_not_participating: 0, payroll_mileage_diets_state: 0 
        }]);
    };

    const saveFunds = async () => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('project_agreement_funds')
                .upsert(funds.map(f => ({ ...f, project_id: projectId })));

            if (error) throw error;
            alert("Información del Project Agreement guardada con éxito.");
        } catch (err: any) {
            alert("Error al guardar: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    /** Celda editable con formato monetario al perder el foco */
    const MoneyCell = ({
        fieldKey,
        rowIdx,
        field,
        className = "",
    }: {
        fieldKey: string;
        rowIdx: number;
        field: keyof FundRow;
        className?: string;
    }) => {
        const isEditing = editingField === fieldKey;
        const numVal = (funds[rowIdx] as any)[field] as number;
        return (
            <td className={`border p-0.5 ${className}`}>
                <input
                    type={isEditing ? "number" : "text"}
                    className="w-full bg-transparent border-none p-0.5 text-right min-w-[90px]"
                    value={isEditing ? numVal : formatMoney(numVal)}
                    onFocus={() => setEditingField(fieldKey)}
                    onBlur={() => setEditingField(null)}
                    onChange={(e) => handleChange(rowIdx, field, parseFloat(e.target.value) || 0)}
                    step="0.01"
                />
            </td>
        );
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">Original Project Funds Information (Project Agreement)</h3>
                <div className="flex gap-2">
                    <button onClick={addUnit} className="btn-secondary py-1 px-3 text-xs flex items-center gap-1">
                        <Plus size={14} /> Añadir Unidad
                    </button>
                    <button onClick={saveFunds} disabled={loading} className="btn-primary py-1 px-4 text-xs flex items-center gap-1">
                        <Save size={14} /> {loading ? "Guardando..." : "Guardar Fondos"}
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full text-[10px] border-collapse bg-white dark:bg-slate-900">
                    <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            <th className="border p-1">Units</th>
                            <th className="border p-1">Fed Share %</th>
                            <th className="border p-1">Participating</th>
                            <th className="border p-1">Contingencies</th>
                            <th className="border p-1">Payroll/Mileage</th>
                            <th className="border p-1">F.A. Requested</th>
                            <th className="border p-1 bg-blue-50 dark:bg-blue-900/20">Fed Cont.</th>
                            <th className="border p-1 bg-blue-50 dark:bg-blue-900/20">Toll Credits</th>
                            <th className="border p-1 bg-green-50 dark:bg-green-900/20">State Share</th>
                            <th className="border p-1 bg-green-50 dark:bg-green-900/20">Contingencias (No Part.)</th>
                            <th className="border p-1">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {funds.map((row, idx) => (
                            <tr key={idx}>
                                {/* Unit name */}
                                <td className="border p-0.5">
                                    <input type="text" className="w-full bg-transparent border-none p-0.5" value={row.unit_name} onChange={(e) => handleChange(idx, 'unit_name', e.target.value)} />
                                </td>
                                {/* Fed Share % — se deja como número porque es porcentaje */}
                                <td className="border p-0.5">
                                    <input type="number" className="w-full bg-transparent border-none p-0.5 text-right" value={row.federal_share_pct} onChange={(e) => handleChange(idx, 'federal_share_pct', parseFloat(e.target.value))} />
                                </td>
                                {/* Celdas monetarias */}
                                <MoneyCell fieldKey={`participating_${idx}`} rowIdx={idx} field="participating" />
                                <MoneyCell fieldKey={`cont_part_${idx}`} rowIdx={idx} field="contingencies_participating" />
                                <MoneyCell fieldKey={`payroll_${idx}`} rowIdx={idx} field="payroll_mileage_diets" />
                                {/* F.A. Requested — editable, fondo amarillo */}
                                <MoneyCell fieldKey={`fa_req_${idx}`} rowIdx={idx} field="fa_funds_requested" className="bg-yellow-50 dark:bg-yellow-900/10 font-bold" />
                                <MoneyCell fieldKey={`fed_cont_${idx}`} rowIdx={idx} field="contingencies_federal" className="bg-blue-50/50 dark:bg-blue-900/10" />
                                <MoneyCell fieldKey={`toll_${idx}`} rowIdx={idx} field="calc_toll_credits" className="bg-blue-50/50 dark:bg-blue-900/10" />
                                <MoneyCell fieldKey={`state_share_${idx}`} rowIdx={idx} field="state_share_federal" className="bg-green-50/50 dark:bg-green-900/10" />
                                <MoneyCell fieldKey={`cont_nop_${idx}`} rowIdx={idx} field="contingencies_not_participating" className="bg-green-50/50 dark:bg-green-900/10" />
                                {/* Acciones */}
                                <td className="border p-0.5 text-center">
                                    <button onClick={() => setFunds(funds.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700">
                                        <Trash2 size={12} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
