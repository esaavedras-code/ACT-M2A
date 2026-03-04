"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { Save, FolderOpen, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { exportProjectToFile } from "@/lib/projectFileSystem";

export interface FormRef { save: () => Promise<void>; }

const ProjectForm = forwardRef<FormRef, { projectId?: string, onDirty?: () => void, onSaved?: (newId?: string) => void }>(function ProjectForm({ projectId, onDirty, onSaved }, ref) {
    const [formData, setFormData] = useState({
        num_act: "",
        num_federal: "",
        name: "",
        num_oracle: "",
        num_contrato: "",
        no_cuenta: "",
        region: "Norte",
        num_ocpr: "",
        scope: "",
        municipios: "",
        carreteras: "",
        designer: "",
        date_contract_sign: "",
        date_project_start: "",
        date_orig_completion: "",
        date_rev_completion: "",
        date_est_completion: "",
        date_real_completion: "",
        date_substantial_completion: "",
        date_final_inspection: "",
        fmis_end_date: "",
        cost_original: 0,
        folder_path: "",
    });
    const [loading, setLoading] = useState(false);
    const [isCostFocused, setIsCostFocused] = useState(false);
    const [showFolderModal, setShowFolderModal] = useState(false);
    const [tempPath, setTempPath] = useState("");

    useEffect(() => {
        if (projectId) fetchProject();
    }, [projectId]);

    const fetchProject = async () => {
        const { data, error } = await supabase.from("projects").select("*").eq("id", projectId).single();
        if (data) {
            setFormData({
                ...data,
                municipios: data.municipios ? data.municipios.join(", ") : "",
                carreteras: data.carreteras ? data.carreteras.join(", ") : "",
            });
        }
    };

    // Auto calculate "Terminación administrativa" (+2 years)
    const getTerminacionAdministrativa = () => {
        if (!formData.date_rev_completion) return "";
        const revDate = new Date(formData.date_rev_completion);
        if (isNaN(revDate.getTime())) return "";
        revDate.setFullYear(revDate.getFullYear() + 2);
        return revDate.toISOString().split("T")[0];
    };

    const terminacionAdministrativa = getTerminacionAdministrativa();

    const handleChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (onDirty) onDirty();
    };

    const saveData = async (silent = false) => {
        setLoading(true);
        const dataToSave = {
            ...formData,
            municipios: formData.municipios ? formData.municipios.split(",").map((s) => s.trim()).filter((s) => s !== "") : [],
            carreteras: formData.carreteras ? formData.carreteras.split(",").map((s) => s.trim()).filter((s) => s !== "") : [],
            date_contract_sign: formData.date_contract_sign || null,
            date_project_start: formData.date_project_start || null,
            date_orig_completion: formData.date_orig_completion || null,
            date_rev_completion: formData.date_rev_completion || null,
            date_est_completion: formData.date_est_completion || null,
            date_real_completion: formData.date_real_completion || null,
            date_substantial_completion: formData.date_substantial_completion || null,
            date_final_inspection: formData.date_final_inspection || null,
            fmis_end_date: formData.fmis_end_date || null,
        };

        let result;
        if (projectId) {
            result = await supabase.from("projects").update(dataToSave).eq("id", projectId).select();
        } else {
            // Si es un proyecto nuevo y no hay ruta de carpeta, activamos el modal
            if (!formData.folder_path) {
                setShowFolderModal(true);
                setLoading(false);
                return;
            }
            result = await supabase.from("projects").insert([dataToSave]).select();
        }

        const { data, error } = result;
        if (!error) {
            // EXPORTACIÓN LOCAL: Si hay ruta, grabamos el archivo independiente
            if (dataToSave.folder_path && (projectId || (data && data[0]?.id))) {
                const targetId = projectId || data[0].id;
                const exportResult = await exportProjectToFile(targetId, dataToSave.folder_path, dataToSave.name);

                if (!silent) {
                    if (exportResult.success) {
                        alert(`${projectId ? "Actualizado" : "Proyecto creado"} correctamente.\n\n✓ Respaldo local guardado en:\n${dataToSave.folder_path}`);
                    } else {
                        const webNote = !window.hasOwnProperty('electronAPI') ? "\n(Nota: Los archivos locales solo se crean en la versión instalada .EXE)" : "";
                        alert(`${projectId ? "Actualizado" : "Proyecto creado"} correctamente en la nube.${webNote}`);
                    }
                }
            } else if (!silent) {
                alert(projectId ? "Actualizado correctamente" : "Proyecto creado correctamente");
            }
            if (onSaved) {
                // Si es nuevo, pasamos el ID creado
                if (!projectId && data && data[0]) {
                    onSaved(data[0].id);
                } else {
                    onSaved();
                }
            }
        }
        setLoading(false);
    };

    useImperativeHandle(ref, () => ({ save: () => saveData(true) }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await saveData(false);
    };

    const handleDelete = async () => {
        if (!projectId) return;
        const confirmed = window.confirm("¿Estás seguro de que deseas eliminar este proyecto completamente? Esta acción no se puede deshacer y borrará toda la información relacionada.");
        if (!confirmed) return;

        setLoading(true);
        const { error } = await supabase.from("projects").delete().eq("id", projectId);

        if (error) {
            alert("Error al eliminar el proyecto: " + error.message);
            setLoading(false);
        } else {
            alert("Proyecto eliminado con éxito.");
            window.location.href = "/proyectos";
        }
    };

    const handleNativeFolderSelect = async () => {
        try {
            // @ts-ignore
            if (window.electronAPI && window.electronAPI.selectFolder) {
                // @ts-ignore
                const path = await window.electronAPI.selectFolder();
                if (path) {
                    setFormData(prev => ({ ...prev, folder_path: path }));
                    setTempPath(path);
                }
            } else if ('showDirectoryPicker' in window) {
                // @ts-ignore
                const handle = await window.showDirectoryPicker();
                setFormData(prev => ({ ...prev, folder_path: handle.name }));
                setTempPath(handle.name);
            }
        } catch (e) {
            console.error("Error selecting folder", e);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Modal de Selección de Carpeta */}
            {showFolderModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 bg-primary text-white">
                            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                                <FolderOpen size={24} />
                            </div>
                            <h3 className="text-xl font-bold">Ubicación del Proyecto</h3>
                            <p className="text-blue-100 text-sm mt-1 opacity-90">¿Dónde desea grabar los archivos independientes de este proyecto?</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ruta de Carpeta</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        className="input-field flex-1 text-sm"
                                        placeholder="Ingrese una ruta o use el botón..."
                                        value={formData.folder_path}
                                        onChange={(e) => setFormData({ ...formData, folder_path: e.target.value })}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleNativeFolderSelect}
                                        className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 transition-colors"
                                        title="Buscar Carpeta"
                                    >
                                        <FolderOpen size={18} className="text-primary" />
                                    </button>
                                </div>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800">
                                <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed font-medium">
                                    Esta carpeta contendrá un respaldo de toda la información ingresada en formato independiente para mayor seguridad.
                                </p>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowFolderModal(false);
                                    setLoading(false);
                                }}
                                className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    if (formData.folder_path) {
                                        setShowFolderModal(false);
                                        saveData(false);
                                    } else {
                                        alert("Por favor seleccione una carpeta o ingrese una ruta.");
                                    }
                                }}
                                className="px-6 py-2 bg-primary text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all hover:scale-105 active:scale-95"
                            >
                                Confirmar y Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="sticky top-[133px] z-20 bg-slate-50/95 backdrop-blur-sm dark:bg-[#020617]/95 py-4 -mt-4 mb-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-2xl font-bold">1. Información del Proyecto</h2>
                <div className="flex gap-3">
                    {/* Delete button was moved to the Project Name section */}
                    <button onClick={handleSubmit} disabled={loading} className="btn-primary flex items-center gap-2">
                        <Save size={18} />
                        {loading ? "Guardando..." : projectId ? "Actualizar" : "Guardar"}
                    </button>
                </div>
            </div>

            <form className="card grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-white dark:bg-slate-900 border-none shadow-sm">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Núm. AC</label>
                    <input
                        type="text"
                        maxLength={20}
                        className="input-field"
                        style={{ backgroundColor: '#66FF99' }}
                        placeholder="000000"
                        value={formData.num_act || ""}
                        onChange={(e) => {
                            setFormData({ ...formData, num_act: e.target.value.replace(/[^0-9a-zA-Z-]/g, "") });
                            if (onDirty) onDirty();
                        }}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Núm. Federal</label>
                    <input
                        type="text"
                        maxLength={50}
                        className="input-field"
                        style={{ backgroundColor: '#66FF99' }}
                        value={formData.num_federal || ""}
                        onChange={(e) => {
                            setFormData({ ...formData, num_federal: e.target.value });
                            if (onDirty) onDirty();
                        }}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nombre del Proyecto</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            maxLength={255}
                            className="input-field flex-1"
                            style={{ backgroundColor: '#66FF99' }}
                            value={formData.name || ""}
                            onChange={(e) => {
                                setFormData({ ...formData, name: e.target.value });
                                if (onDirty) onDirty();
                            }}
                        />
                        {projectId && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={loading}
                                className="px-3 bg-red-100/50 hover:bg-red-100 text-red-600 border border-transparent hover:border-red-200 rounded-lg transition-colors flex items-center justify-center shrink-0"
                                title="Borrar Proyecto"
                            >
                                <Trash2 size={18} />
                            </button>
                        )}
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Núm. Oracle</label>
                    <input
                        type="text"
                        maxLength={20}
                        className="input-field"
                        style={{ backgroundColor: '#66FF99' }}
                        value={formData.num_oracle || ""}
                        onChange={(e) => {
                            setFormData({ ...formData, num_oracle: e.target.value });
                            if (onDirty) onDirty();
                        }}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Núm. Contrato</label>
                    <input
                        type="text"
                        maxLength={20}
                        className="input-field"
                        style={{ backgroundColor: '#66FF99' }}
                        value={formData.num_contrato || ""}
                        onChange={(e) => {
                            setFormData({ ...formData, num_contrato: e.target.value.replace(/[^0-9]/g, "") });
                            if (onDirty) onDirty();
                        }}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">No. Cuenta</label>
                    <input
                        type="text"
                        maxLength={50}
                        className="input-field"
                        style={{ backgroundColor: '#66FF99' }}
                        value={formData.no_cuenta || ""}
                        onChange={(e) => {
                            setFormData({ ...formData, no_cuenta: e.target.value });
                            if (onDirty) onDirty();
                        }}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">Costo Original ($)</label>
                    <div className="relative">
                        <input
                            type={isCostFocused ? "number" : "text"}
                            step="0.01"
                            className="input-field border-emerald-100 focus:ring-emerald-500 font-bold"
                            style={{ backgroundColor: '#66FF99' }}
                            value={isCostFocused
                                ? (isNaN(formData.cost_original) ? "" : (formData.cost_original ?? ""))
                                : formatCurrency(formData.cost_original)}
                            onFocus={() => setIsCostFocused(true)}
                            onBlur={() => setIsCostFocused(false)}
                            onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                handleChange('cost_original', isNaN(val) ? 0 : val);
                            }}
                        />
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Región</label>
                    <select
                        className="input-field"
                        style={{ backgroundColor: '#66FF99' }}
                        value={formData.region || "Norte"}
                        onChange={(e) => {
                            setFormData({ ...formData, region: e.target.value });
                            if (onDirty) onDirty();
                        }}
                    >
                        <option>Norte</option>
                        <option>Sur</option>
                        <option>Este</option>
                        <option>Oeste</option>
                        <option>Metro</option>
                    </select>
                </div>
                <div className="space-y-1 md:col-span-2">
                    <label className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                        Ruta de Grabación (Carpeta)
                        <span className="text-[10px] lowercase font-normal text-slate-400">(Ubicación de archivos)</span>
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            className="input-field flex-1"
                            style={{ backgroundColor: '#66FF99' }}
                            placeholder="Ej. C:\Proyectos\ACT-2024-001"
                            value={formData.folder_path || ""}
                            onChange={(e) => {
                                setFormData({ ...formData, folder_path: e.target.value });
                                if (onDirty) onDirty();
                            }}
                        />
                        <button
                            type="button"
                            onClick={async () => {
                                try {
                                    // Primero intentamos usar la API de Electron si está disponible
                                    // @ts-ignore
                                    if (window.electronAPI && window.electronAPI.selectFolder) {
                                        // @ts-ignore
                                        const pathSelected = await window.electronAPI.selectFolder();
                                        if (pathSelected) {
                                            handleChange('folder_path', pathSelected);
                                        }
                                    }
                                    // Fallback para web o si Electron falla
                                    else if ('showDirectoryPicker' in window) {
                                        // @ts-ignore
                                        const handle = await window.showDirectoryPicker();
                                        handleChange('folder_path', handle.name);
                                    } else {
                                        const path = window.prompt("Ingrese la ruta de la carpeta:");
                                        if (path) handleChange('folder_path', path);
                                    }
                                } catch (e: any) {
                                    if (e.name !== 'AbortError') {
                                        console.error("Picker cancelled or error", e);
                                    }
                                }
                            }}
                            className="px-3 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            title="Seleccionar Carpeta"
                        >
                            <FolderOpen size={18} className="text-slate-500" />
                        </button>
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Núm. OCPR</label>
                    <input
                        type="text"
                        maxLength={20}
                        className="input-field"
                        style={{ backgroundColor: '#66FF99' }}
                        value={formData.num_ocpr || ""}
                        onChange={(e) => {
                            setFormData({ ...formData, num_ocpr: e.target.value });
                            if (onDirty) onDirty();
                        }}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Diseñador</label>
                    <input
                        type="text"
                        maxLength={100}
                        className="input-field"
                        style={{ backgroundColor: '#66FF99' }}
                        value={formData.designer || ""}
                        onChange={(e) => {
                            setFormData({ ...formData, designer: e.target.value });
                            if (onDirty) onDirty();
                        }}
                    />
                </div>
                <div className="space-y-1 md:col-span-2 lg:col-span-1 border-b md:border-none pb-4 md:pb-0">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Municipios</label>
                    <input
                        type="text"
                        maxLength={255}
                        placeholder="Ej. San Juan, Guaynabo"
                        className="input-field"
                        style={{ backgroundColor: '#66FF99' }}
                        value={formData.municipios || ""}
                        onChange={(e) => {
                            setFormData({ ...formData, municipios: e.target.value });
                            if (onDirty) onDirty();
                        }}
                    />
                </div>
                <div className="space-y-1 md:col-span-2 lg:col-span-2 border-b md:border-none pb-4 md:pb-0">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Carreteras</label>
                    <input
                        type="text"
                        maxLength={255}
                        placeholder="Ej. PR-1, PR-2"
                        className="input-field"
                        style={{ backgroundColor: '#66FF99' }}
                        value={formData.carreteras || ""}
                        onChange={(e) => {
                            setFormData({ ...formData, carreteras: e.target.value });
                            if (onDirty) onDirty();
                        }}
                    />
                </div>
                <div className="space-y-1 md:col-span-2 lg:col-span-3">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Alcance Proy. (SCOPE)</label>
                    <textarea
                        rows={3}
                        maxLength={500}
                        className="input-field"
                        style={{ backgroundColor: '#66FF99' }}
                        value={formData.scope || ""}
                        onChange={(e) => {
                            setFormData({ ...formData, scope: e.target.value });
                            if (onDirty) onDirty();
                        }}
                    ></textarea>
                </div>

                {/* Seccion  de Fechas */}
                <div className="md:col-span-2 lg:col-span-3 mt-4">
                    <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 border-b pb-2 mb-4">Fechas Relevantes</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hoy (Automática)</label>
                            <input
                                type="date"
                                className="input-field bg-slate-50 dark:bg-slate-800 text-slate-500 cursor-not-allowed"
                                value={new Date().toISOString().split("T")[0]}
                                disabled
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Firma Contrato</label>
                            <input
                                type="date"
                                className="input-field"
                                style={{ backgroundColor: '#66FF99' }}
                                value={formData.date_contract_sign || ""}
                                onChange={(e) => {
                                    setFormData({ ...formData, date_contract_sign: e.target.value });
                                    if (onDirty) onDirty();
                                }}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Comienzo Proyecto</label>
                            <input
                                type="date"
                                className="input-field"
                                style={{ backgroundColor: '#66FF99' }}
                                value={formData.date_project_start || ""}
                                onChange={(e) => {
                                    setFormData({ ...formData, date_project_start: e.target.value });
                                    if (onDirty) onDirty();
                                }}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Terminación Original</label>
                            <input
                                type="date"
                                className="input-field"
                                style={{ backgroundColor: '#66FF99' }}
                                value={formData.date_orig_completion || ""}
                                onChange={(e) => {
                                    setFormData({ ...formData, date_orig_completion: e.target.value });
                                    if (onDirty) onDirty();
                                }}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Terminación Revisada</label>
                            <input
                                type="date"
                                className="input-field"
                                style={{ backgroundColor: '#66FF99' }}
                                value={formData.date_rev_completion || ""}
                                onChange={(e) => {
                                    setFormData({ ...formData, date_rev_completion: e.target.value });
                                    if (onDirty) onDirty();
                                }}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider text-[10px] xl:text-xs">
                                Termin. Administrativa (+2 Años)
                            </label>
                            <input
                                type="date"
                                className="input-field bg-slate-50 dark:bg-slate-800 text-slate-500 cursor-not-allowed"
                                value={terminacionAdministrativa}
                                disabled
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Terminación Estimada</label>
                            <input
                                type="date"
                                className="input-field"
                                style={{ backgroundColor: '#66FF99' }}
                                value={formData.date_est_completion || ""}
                                onChange={(e) => {
                                    setFormData({ ...formData, date_est_completion: e.target.value });
                                    if (onDirty) onDirty();
                                }}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Terminación Real</label>
                            <input
                                type="date"
                                className="input-field"
                                style={{ backgroundColor: '#66FF99' }}
                                value={formData.date_real_completion || ""}
                                onChange={(e) => {
                                    setFormData({ ...formData, date_real_completion: e.target.value });
                                    if (onDirty) onDirty();
                                }}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Terminación Sustancial</label>
                            <input
                                type="date"
                                className="input-field"
                                style={{ backgroundColor: '#66FF99' }}
                                value={formData.date_substantial_completion || ""}
                                onChange={(e) => {
                                    setFormData({ ...formData, date_substantial_completion: e.target.value });
                                    if (onDirty) onDirty();
                                }}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Inspección Final</label>
                            <input
                                type="date"
                                className="input-field"
                                style={{ backgroundColor: '#66FF99' }}
                                value={formData.date_final_inspection || ""}
                                onChange={(e) => {
                                    setFormData({ ...formData, date_final_inspection: e.target.value });
                                    if (onDirty) onDirty();
                                }}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                FMIS END DATE
                            </label>
                            <input
                                type="date"
                                className="input-field border-emerald-200 dark:border-emerald-800 focus:ring-emerald-500"
                                style={{ backgroundColor: '#66FF99' }}
                                value={formData.fmis_end_date || ""}
                                onChange={(e) => {
                                    setFormData({ ...formData, fmis_end_date: e.target.value });
                                    if (onDirty) onDirty();
                                }}
                            />
                        </div>
                    </div>
                </div>
            </form>
        </div >
    );
});

export default ProjectForm;
