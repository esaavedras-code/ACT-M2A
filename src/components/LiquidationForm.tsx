"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { Save, FileCheck2, UserCheck } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { FormRef } from "./ProjectForm";

const LiquidationForm = forwardRef<FormRef, { projectId?: string, onDirty?: () => void, onSaved?: () => void }>(function LiquidationForm({ projectId, onDirty, onSaved }, ref) {
    const [formData, setFormData] = useState({
        total_items_value: 0,
        signed_by_admin: false,
        signed_by_contractor: false,
        signed_by_liquidator: false,
        notes: ""
    });
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        if (projectId) fetchLiquidation();
    }, [projectId]);

    const fetchLiquidation = async () => {
        // We store liquidation data in 'projects' table for now or a meta table
        // For this simple version, we'll fetch from projects table
        const { data } = await supabase.from("projects").select("liquidation_data").eq("id", projectId).single();
        if (data && data.liquidation_data) setFormData(data.liquidation_data);
    };

    const saveData = async (silent = false) => {
        if (!projectId) return;
        const { error } = await supabase.from("projects").update({
            liquidation_data: formData
        }).eq('id', projectId);
        if (error && !silent) alert("Error: " + error.message);
        else if (!error) {
            if (!silent) alert("Liquidación sincronizada");
            if (onSaved) onSaved();
        }
    };

    useImperativeHandle(ref, () => ({ save: () => saveData(true) }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!projectId) return;
        await saveData(false);
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <FileCheck2 className="text-primary" />
                    10. Liquidación
                </h2>
                <button
                    onClick={handleSubmit}
                    className="btn-primary flex items-center gap-2"
                >
                    <Save size={18} />
                    Guardar Liquidación
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="card space-y-4 border-none shadow-sm">
                    <h3 className="font-bold text-slate-700 dark:text-slate-300 border-b pb-2 text-sm uppercase tracking-wider">Información General</h3>
                    <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-tighter">Total Partidas ($)</label>
                        <input
                            type={isFocused ? "number" : "text"}
                            step="0.01"
                            className="input-field font-black text-primary text-lg"
                            value={isFocused ? (formData.total_items_value ?? "") : formatCurrency(formData.total_items_value)}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            onChange={(e) => {
                                setFormData({ ...formData, total_items_value: e.target.value === "" ? 0 : parseFloat(e.target.value) });
                                if (onDirty) onDirty();
                            }}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-tighter">Notas de Liquidación</label>
                        <textarea
                            rows={4}
                            className="input-field text-sm"
                            value={formData.notes}
                            onChange={(e) => {
                                setFormData({ ...formData, notes: e.target.value });
                                if (onDirty) onDirty();
                            }}
                        ></textarea>
                    </div>
                </div>

                <div className="card space-y-6 border-none shadow-sm">
                    <h3 className="font-bold text-slate-700 dark:text-slate-300 border-b pb-2 flex items-center gap-2 text-sm uppercase tracking-wider">
                        <UserCheck size={18} className="text-emerald-600" />
                        Firmas Requeridas
                    </h3>
                    <div className="space-y-4">
                        <label className="flex items-center gap-3 cursor-pointer p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-emerald-200 transition-all">
                            <input
                                type="checkbox"
                                className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary"
                                checked={formData.signed_by_admin}
                                onChange={(e) => {
                                    setFormData({ ...formData, signed_by_admin: e.target.checked });
                                    if (onDirty) onDirty();
                                }}
                            />
                            <span className="text-slate-700 dark:text-slate-300 font-bold uppercase tracking-widest text-xs">Administrador</span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-emerald-200 transition-all">
                            <input
                                type="checkbox"
                                className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary"
                                checked={formData.signed_by_contractor}
                                onChange={(e) => {
                                    setFormData({ ...formData, signed_by_contractor: e.target.checked });
                                    if (onDirty) onDirty();
                                }}
                            />
                            <span className="text-slate-700 dark:text-slate-300 font-bold uppercase tracking-widest text-xs">Contratista</span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-emerald-200 transition-all">
                            <input
                                type="checkbox"
                                className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary"
                                checked={formData.signed_by_liquidator}
                                onChange={(e) => {
                                    setFormData({ ...formData, signed_by_liquidator: e.target.checked });
                                    if (onDirty) onDirty();
                                }}
                            />
                            <span className="text-slate-700 dark:text-slate-300 font-bold uppercase tracking-widest text-xs">Liquidador</span>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default LiquidationForm;
