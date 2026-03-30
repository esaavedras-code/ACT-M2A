"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { Save, FolderOpen, Trash2, Upload, CheckCircle, FileText, Plus, FileSearch } from "lucide-react";
import FloatingFormActions from "./FloatingFormActions";
import { formatCurrency, getLocalStorageItem } from "@/lib/utils";
import { exportProjectToFile } from "@/lib/projectFileSystem";
import ProjectAgreementForm from "./ProjectAgreementForm";
import mfgItemsData from "@/lib/mfgItems.json";

export interface FormRef { save: () => Promise<void>; }

const DOC_TYPES = ["Orden de comienzo", "Project Agreement", "Proposal", "Contrato"];

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
        admin_name: "",
        contractor_name: "",
        liquidador_name: "",
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
        liquidated_damages_amount: 500.00,
        created_by_email: "",
        reached_substantial_completion: false,
        eligible_toll_credits: false,
        pay_items_er_funds: false,
        project_manager_name: "",
    });
    const [mounted, setMounted] = useState(false);
    const [todayDate, setTodayDate] = useState("");
    const [loading, setLoading] = useState(false);
    const [isCostFocused, setIsCostFocused] = useState(false);
    const [showFolderModal, setShowFolderModal] = useState(false);
    const [isDlqFocused, setIsDlqFocused] = useState(false);
    const [tempPath, setTempPath] = useState("");
    const [documents, setDocuments] = useState<any[]>([]);
    const [selectedDocType, setSelectedDocType] = useState(DOC_TYPES[0]);
    const [uploadingDoc, setUploadingDoc] = useState(false);
    const [aiPrompt, setAiPrompt] = useState("");
    const [aiResponse, setAiResponse] = useState("");

    useEffect(() => {
        setMounted(true);
        if (projectId) {
            fetchProject();
            fetchDocuments();
        }
    }, [projectId]);

    const fetchDocuments = async () => {
        if (!projectId) return;
        const { data, error } = await supabase.from("project_documents").select("*").eq("project_id", projectId);
        if (data) setDocuments(data);
    };

    const handleFileUpload = async (file: File) => {
        if (!projectId) {
            alert("Debe guardar el proyecto primero antes de subir documentos.");
            return;
        }

        setUploadingDoc(true);
        try {
            const dateFolder = new Date().toISOString().split('T')[0];
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            const storagePath = `${projectId}/${selectedDocType}/${dateFolder}/${Date.now()}_${safeName}`;
            const { error: storageErr } = await supabase.storage.from("project-documents").upload(storagePath, file);
            
            const { error: dbErr } = await supabase.from("project_documents").upsert({
                project_id: projectId,
                doc_type: selectedDocType,
                section: selectedDocType,
                file_name: file.name,
                storage_path: storageErr ? null : storagePath
            });

            if (dbErr) throw dbErr;
            
            fetchDocuments();
            alert(`Documento "${selectedDocType}" subido correctamente.`);
            
        } catch (err: any) {
            console.error("Error upload:", err);
            alert("Error al subir el documento: " + err.message);
        } finally {
            setUploadingDoc(false);
        }
    };

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
        // Validar formato del número de proyecto (AC-XXXXXX o AC-XXXXXXA)
        const numActRegex = /^AC-[0-9]{6}[A-Z]?$/;
        if (!numActRegex.test(formData.num_act)) {
            if (!silent) alert("El número de proyecto estatal debe tener el formato AC-XXXXXX (Exactamente 6 dígitos después del prefijo AC-, opcionalmente seguido de una letra).");
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            let finalNumAct = formData.num_act;
            
            // Check for duplicates if it's a new project
            if (!projectId && !silent) {
                const baseNumAct = finalNumAct.substring(0, 9); // e.g. "AC-123456"
                const { data: existing } = await supabase.from("projects").select("num_act").like("num_act", `${baseNumAct}%`);
                
                if (existing && existing.length > 0) {
                    const exactMatch = existing.find(p => p.num_act === finalNumAct);
                    if (exactMatch) {
                        // Find highest letter used
                        let maxCode = 64; // before 'A'
                        if (existing.some(p => p.num_act === baseNumAct)) {
                            maxCode = 65; // 'A' if base exists
                        }
                        
                        existing.forEach(p => {
                            if (p.num_act.length === 10) {
                                const code = p.num_act.charCodeAt(9);
                                if (code > maxCode) maxCode = code;
                            }
                        });
                        
                        // We will start offering at least 'B' (66)
                        const nextCode = Math.max(maxCode + 1, 66);
                        const nextLetter = String.fromCharCode(nextCode);
                        const suggestedNumAct = baseNumAct + nextLetter;
                        
                        const confirmDouble = window.confirm(`El proyecto ${finalNumAct} ya existe. ¿Desea crearlo de todos modos agregándole la letra ${nextLetter} (${suggestedNumAct})?`);
                        if (!confirmDouble) {
                            setLoading(false);
                            return;
                        }
                        
                        finalNumAct = suggestedNumAct;
                        setFormData(prev => ({ ...prev, num_act: finalNumAct }));
                    }
                }
            }

            const dataToSave = {
                ...formData,
                num_act: finalNumAct,
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
                created_by_email: formData.created_by_email || null,
                reached_substantial_completion: formData.reached_substantial_completion,
                eligible_toll_credits: formData.eligible_toll_credits,
                pay_items_er_funds: formData.pay_items_er_funds,
                project_manager_name: formData.project_manager_name || null,
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

                // Asignar el creador al proyecto nuevo
        const regStr = getLocalStorageItem("pact_registration");
                if (regStr) {
                    try {
                        const reg = JSON.parse(regStr);
                        if (reg) dataToSave.created_by_email = reg.email;
                    } catch (e) {
                        console.error("Error parsing registration", e);
                    }
                }

                result = await supabase.from("projects").insert([dataToSave]).select();
            }

            const { data, error } = result;

            if (error) {
                if (!silent) alert("Error guardando proyecto: " + error.message);
                setLoading(false);
                return;
            }

            const targetId = projectId || (data && data[0]?.id);

            // EXPORTACIÓN LOCAL: Si hay ruta, grabamos el archivo independiente
            if (dataToSave.folder_path && targetId) {
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

            // IMPORTANTE: Llamamos a onSaved() AL FINAL para iniciar la redirección 
            // solo después de que todo el trabajo y las alertas hayan concluido.
            if (onSaved && targetId) {
                if (!projectId) {
                    onSaved(targetId);
                } else {
                    onSaved();
                }
            }
        } catch (err: any) {
            console.error("Error en saveData:", err);
            if (!silent) alert("Error inesperado: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    useImperativeHandle(ref, () => ({ save: () => saveData(true) }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await saveData(false);
    };

    const handleDelete = async () => {
        if (!projectId) return;

        // Verificar si el usuario actual es el creador o un administrador global
        const regStr = getLocalStorageItem("pact_registration");
        const currentUserEmail = regStr ? JSON.parse(regStr).email : null;
        
        let isGlobalAdmin = false;
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            const { data: userData } = await supabase.from("users").select("role_global").eq("id", session.user.id).single();
            isGlobalAdmin = userData?.role_global === "A";
        }

        if (!isGlobalAdmin && formData.created_by_email && currentUserEmail !== formData.created_by_email) {
            alert(`Acceso denegado: Solo el creador del proyecto (${formData.created_by_email}) o un administrador pueden eliminarlo.`);
            return;
        }

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

    if (!mounted) return null;

    return (
        <div suppressHydrationWarning className="w-full px-4 flex flex-col space-y-6">
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

            <div className="sticky top-16 z-40 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md pt-6 pb-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <FileText className="text-primary" size={24} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Sección 1</span>
                        <span>Información del Proyecto</span>
                    </div>
                </h2>
                <div className="flex gap-3 w-full sm:w-auto">
                    {/* Los botones ahora son flotantes para mayor accesibilidad */}
                </div>
            </div>

            <FloatingFormActions
                actions={[
                    ...(projectId ? [{
                        label: "Eliminar Proyecto",
                        icon: <Trash2 />,
                        onClick: handleDelete,
                        description: "Borrar este proyecto permanentemente de la base de datos",
                        variant: 'danger' as const,
                        disabled: loading
                    }] : []),
                    {
                        label: loading ? "Guardando..." : "Guardar cambios",
                        icon: <Save />,
                        onClick: () => saveData(false),
                        description: "Guardar toda la información del proyecto y crear respaldo",
                        variant: 'primary' as const,
                        disabled: loading
                    }
                ]}
            />

            {formData.num_act && (
                <div className="flex items-center gap-2 -mt-4 mb-4">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Proyecto:</span>
                    <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-primary text-[10px] font-bold rounded border border-blue-100 dark:border-blue-800">
                        {formData.num_act}
                    </span>
                </div>
            )}

            {/* Nueva Sección de Documentación */}
            <div className="bg-white dark:bg-slate-900/50 p-5 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 mb-6 shadow-sm">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-4 flex-1 w-full">
                        <div className="flex items-center gap-2">
                            <Upload className="text-primary" size={20} />
                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Documentación Crítica del Proyecto</h3>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row items-end gap-3">
                            <div className="space-y-1 flex-1 min-w-[240px]">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Seleccionar Tipo de Documento</label>
                                <select 
                                    className="input-field py-2 h-11 text-sm bg-slate-50 dark:bg-slate-800/50 border-slate-200"
                                    value={selectedDocType}
                                    onChange={(e) => setSelectedDocType(e.target.value)}
                                    disabled={!projectId || uploadingDoc}
                                >
                                    {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <label className={`btn-primary py-2.5 px-6 text-sm flex items-center justify-center gap-2 cursor-pointer h-11 transition-all ${(!projectId || uploadingDoc) ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:scale-[1.02] active:scale-[0.98]'}`}>
                                {uploadingDoc ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Plus size={18} />
                                )}
                                <span>{uploadingDoc ? "Subiendo..." : "Subir Archivo"}</span>
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    disabled={!projectId || uploadingDoc}
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleFileUpload(file);
                                        e.target.value = '';
                                    }}
                                />
                            </label>
                        </div>

                        {/* Banner AI */}
                        {projectId && (
                            <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-xl shadow-indigo-200 dark:shadow-none relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-white/20 transition-all duration-500"></div>
                                <div className="relative z-10 flex flex-col w-full gap-4">
                                    <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                                        <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shrink-0">
                                            <FileSearch size={32} className="text-white" />
                                        </div>
                                        <div className="flex-1 text-center md:text-left w-full space-y-3">
                                            <div>
                                                <h4 className="text-lg font-black uppercase tracking-tight">Asistente AI</h4>
                                                <p className="text-indigo-100 text-sm font-medium mt-1">Extrae automáticamente datos del proyecto y partidas, o pregúntale lo que necesites buscar en los documentos subidos.</p>
                                            </div>
                                            <div className="flex flex-col sm:flex-row gap-2 w-full">
                                                <input 
                                                    type="text" 
                                                    value={aiPrompt}
                                                    onChange={(e) => setAiPrompt(e.target.value)}
                                                    placeholder="Opcional: Indica qué información necesitas extraer (ej. Nombres, fechas)..."
                                                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white/90 focus:bg-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-300 placeholder:text-slate-500 transition-colors"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            // @ts-ignore
                                                            document.getElementById('btn-analyze-ai')?.click();
                                                        }
                                                    }}
                                                />
                                                <button
                                                    id="btn-analyze-ai"
                                                    type="button"
                                                    disabled={loading}
                                                    onClick={async () => {
                                                        if (!projectId) return;
                                                        setLoading(true);
                                                        setAiResponse("Buscando documentos subidos...");
                                                        try {
                                                            const { data: dbDocs, error: dbErr } = await supabase.from('project_documents').select('file_name, storage_path').eq('project_id', projectId);
                                                            if (dbErr) throw dbErr;
                                                            if (!dbDocs?.length) { 
                                                                alert("No se encontraron documentos. Asegúrese de haber subido archivos en la sección superior."); 
                                                                setLoading(false); 
                                                                setAiResponse("");
                                                                return; 
                                                            }
                                                            const win = window as any;
                                                            const parsePdf = async (b64: string) => {
                                                                if (win.electronAPI?.parsePdfBase64) {
                                                                    return await win.electronAPI.parsePdfBase64(b64);
                                                                } else {
                                                                    try {
                                                                        const parseRes = await fetch('/api/parse-pdf', {
                                                                            method: 'POST',
                                                                            headers: { 'Content-Type': 'application/json' },
                                                                            body: JSON.stringify({ base64: b64 })
                                                                        });
                                                                        if (!parseRes.ok) {
                                                                            const errText = await parseRes.text();
                                                                            console.error("Error API Parse PDF:", parseRes.status, errText);
                                                                            return { success: false, error: `Error del servidor (${parseRes.status})` };
                                                                        }
                                                                        return await parseRes.json();
                                                                    } catch (err: any) {
                                                                        console.error("Fetch failure:", err);
                                                                        return { success: false, error: "Fallo de conexión al servidor" };
                                                                    }
                                                                }
                                                            };
                                                            
                                                            let count = 0, items = 0;
                                                            const updated = { ...formData };
                                                            const itemsToInsert: any[] = [];
                                                            let fullExtractedText = "";
                                                            
                                                            const blobToBase64 = (b: Blob): Promise<string> => new Promise(r => {
                                                                const rd = new FileReader(); rd.onloadend = () => r(rd.result as string); rd.readAsDataURL(b);
                                                            });
                                                            
                                                            for (const doc of dbDocs) {
                                                                if (!doc.storage_path || !doc.storage_path.toLowerCase().endsWith('.pdf')) continue;
                                                                
                                                                setAiResponse(`Extrayendo texto: ${doc.file_name}...`);
                                                                const { data: blob, error: downloadErr } = await supabase.storage.from('project-documents').download(doc.storage_path);
                                                                
                                                                if (downloadErr || !blob) {
                                                                    console.error("Download Error:", doc.file_name, downloadErr);
                                                                    continue;
                                                                }

                                                                if (blob.size > 4500000 && !win.electronAPI) {
                                                                    setAiResponse(`Error: ${doc.file_name} es muy grande (>4.5MB). Vercel no permite procesar archivos tan grandes en la versión web.`);
                                                                    console.warn("File too large for Vercel:", doc.file_name, blob.size);
                                                                    continue;
                                                                }

                                                                const res = await parsePdf(await blobToBase64(blob));
                                                                if (res.success && res.text) {
                                                                    fullExtractedText += "\n\n" + res.text;
                                                                    const txt = res.text.replace(/\s+/g, ' ');
                                                                    const act = txt.match(/AC-\d{6}[A-Z]?/i); if (act && !updated.num_act) { updated.num_act = act[0].toUpperCase(); count++; }
                                                                    const fed = txt.match(/(?:Federal(?: Aid)?(?:\s+Project)?(?: No| Number)?)\s*[:=]?\s*(PR-\d{4}\(\d{3}\)|PR-[A-Z0-9]+)/i); if (fed && !updated.num_federal) { updated.num_federal = fed[1]; count++; }
                                                                    const cost = txt.match(/(?:Total\s*Cost|Contract\s*Amount|Monto|Total\s*a\s*Pagar|Contract\s*Price)\s*[:=\$]*\s*\$?\s*([\d,]+\.\d{2})/i); if (cost && !updated.cost_original) { const v = parseFloat(cost[1].replace(/,/g, '')); if (!isNaN(v)) { updated.cost_original = v; count++; } }
                                                                    const lines = res.text.split("\n");
                                                                    const pat = /(?:^|\s)(\d{1,3})\s+([A-Z0-9-]{4,10})\s+(.+?)\s+([\d,]+\.?[\d]*)\s+(LS|LUMP\s*SUM|EA|EACH|LF|SF|SY|CY|TON|GAL|MGAL|HOUR|DAY|MONTH)\s+\$?\s*([\d,]+\.\d{2})/i;
                                                                    for (const l of lines) {
                                                                        const m = pat.exec(l);
                                                                        if (m) {
                                                                            const n = m[1].padStart(3, '0');
                                                                            if (!itemsToInsert.some(it => it.item_num === n)) {
                                                                                itemsToInsert.push({ project_id: projectId, item_num: n, specification: m[2].trim(), description: m[3].trim().substring(0, 200), quantity: parseFloat(m[4].replace(/,/g, '')), unit: m[5].toUpperCase().trim(), unit_price: parseFloat(m[6].replace(/,/g, '')), fund_source: "ACT:100%", requires_mfg_cert: !!(mfgItemsData as Record<string, boolean>)[m[2].trim()] });
                                                                                items++;
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                            if (itemsToInsert.length) await supabase.from("contract_items").upsert(itemsToInsert, { onConflict: 'project_id, item_num' });
                                                            setFormData(updated);

                                                            if (fullExtractedText.length === 0) {
                                                                setAiResponse("No se encontró texto procesable en los documentos.");
                                                                alert("No se pudo extraer texto de los documentos. Verifique que sean archivos PDF legibles.");
                                                            } else if (aiPrompt.trim().length > 0) {
                                                                setAiResponse("Consultando Asistente AI...");
                                                                try {
                                                                    const response = await fetch('/api/analyze-document', {
                                                                        method: 'POST',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({ text: fullExtractedText, prompt: aiPrompt })
                                                                    });
                                                                    if (!response.ok) {
                                                                        const errText = await response.text();
                                                                        console.error("Error API Analyze:", response.status, errText);
                                                                        setAiResponse(`Error del servidor AI (${response.status})`);
                                                                        return;
                                                                    }
                                                                    const aiData = await response.json();
                                                                    if (aiData.result) {
                                                                        setAiResponse(aiData.result);
                                                                    } else if (aiData.error) {
                                                                        setAiResponse("Error AI: " + aiData.error);
                                                                    }
                                                                } catch(err: any) {
                                                                    console.error("AI Fetch Failure:", err);
                                                                    setAiResponse("Error al consultar IA: " + err.message);
                                                                }
                                                            } else {
                                                                alert(`Extracción Finalizada: ${count} campos completados y ${items} partidas importadas.`);
                                                                setAiResponse("");
                                                            }
                                                        } catch (e: any) { 
                                                            console.error("AI Error:", e);
                                                            alert("Error durante el análisis: " + e.message);
                                                        }
                                                        setLoading(false);
                                                    }}
                                                    className="px-6 py-2 bg-white text-indigo-600 rounded-lg font-bold text-xs uppercase hover:bg-white/90 active:scale-95 transition-all shrink-0 h-[38px] flex items-center justify-center whitespace-nowrap"
                                                >
                                                    {loading ? "Procesando..." : "Analizar con IA"}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    {aiResponse && (
                                        <div className="w-full bg-indigo-900/50 rounded-xl p-4 border border-indigo-400/30 text-indigo-50 mt-2">
                                            <div className="flex items-center gap-2 mb-2 opacity-80 border-b border-indigo-400/20 pb-2">
                                                <FileSearch size={14} />
                                                <span className="text-[10px] font-bold uppercase tracking-wider">Respuesta de IA:</span>
                                            </div>
                                            <p className="whitespace-pre-wrap text-sm leading-relaxed">{aiResponse}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {!projectId && (
                            <p className="text-[10px] text-amber-600 font-medium bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg border border-amber-100 dark:border-amber-900/50">
                                * Guarde el proyecto para habilitar la subida de documentos y el asistente IA.
                            </p>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 w-full md:w-auto">
                        {DOC_TYPES.map(type => {
                            const doc = documents.find(d => d.doc_type === type);
                            return (
                                <div key={type} className={`px-3 py-2.5 rounded-xl border flex items-center gap-3 transition-all ${doc ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400" : "bg-slate-50 border-slate-100 dark:bg-slate-800/30 dark:border-slate-800 text-slate-400 opacity-60"}`}>
                                    <div className={`p-1.5 rounded-lg ${doc ? "bg-emerald-100 dark:bg-emerald-900/50" : "bg-slate-100 dark:bg-slate-700/50"}`}>
                                        {doc ? <CheckCircle size={14} /> : <FileText size={14} />}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold leading-tight">{type}</span>
                                        <span className="text-[9px] opacity-70 leading-tight">
                                            {doc ? `Subido: ${new Date(doc.uploaded_at).toLocaleDateString()}` : "Pendiente"}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <form suppressHydrationWarning className="card grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 bg-white dark:bg-slate-900 border-none shadow-sm">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Núm. AC</label>
                    <input
                        type="text"
                        maxLength={9}
                        className="input-field"
                        style={{ backgroundColor: '#66FF99' }}
                        placeholder="AC-000000"
                        value={formData.num_act || ""}
                        onChange={(e) => {
                            let val = e.target.value.toUpperCase();
                            if (!val.startsWith("AC-")) {
                                val = "AC-" + val.replace(/[^0-9A-Z]/g, "");
                            } else {
                                const digits = val.substring(3).replace(/[^0-9A-Z]/g, "");
                                val = "AC-" + digits.substring(0, 7);
                            }
                            setFormData({ ...formData, num_act: val });
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

                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Núm. Oracle</label>
                    <input
                        type="text"
                        maxLength={50}
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
                            type={isCostFocused ? "text" : "text"}
                            className="input-field border-emerald-100 focus:ring-emerald-500 font-bold"
                            style={{ backgroundColor: '#66FF99' }}
                            value={isCostFocused
                                ? (formData.cost_original === 0 ? "" : formData.cost_original.toString())
                                : formatCurrency(formData.cost_original)}
                            onFocus={(e) => {
                                setIsCostFocused(true);
                                // Si el valor es 0, el value será "" por la condición de arriba
                            }}
                            onBlur={(e) => {
                                setIsCostFocused(false);
                                const val = parseFloat(e.target.value);
                                handleChange('cost_original', isNaN(val) ? 0 : val);
                            }}
                            onChange={(e) => {
                                // Mantenemos el valor como número en el estado para consistencia, 
                                // pero la visualización controlada arriba se encarga del "" si es 0
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
                <div className="space-y-1">
                    <label className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Daños Líquidos Diarios ($)</label>
                    <input
                        type={isDlqFocused ? "text" : "text"}
                        className="input-field border-red-100 focus:ring-red-500 font-bold"
                        style={{ backgroundColor: '#66FF99' }}
                        value={isDlqFocused
                            ? (formData.liquidated_damages_amount === 0 ? "" : formData.liquidated_damages_amount.toString())
                            : formatCurrency(formData.liquidated_damages_amount)}
                        onFocus={() => setIsDlqFocused(true)}
                        onBlur={(e) => {
                            setIsDlqFocused(false);
                            const val = parseFloat(e.target.value);
                            handleChange('liquidated_damages_amount', isNaN(val) ? 0 : val);
                        }}
                        onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            handleChange('liquidated_damages_amount', isNaN(val) ? 0 : val);
                        }}
                    />
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
                        rows={6}
                        maxLength={50000}
                        className="input-field"
                        style={{ backgroundColor: '#66FF99' }}
                        value={formData.scope || ""}
                        onChange={(e) => {
                            setFormData({ ...formData, scope: e.target.value });
                            if (onDirty) onDirty();
                        }}
                    ></textarea>
                </div>


                <div className="md:col-span-2 lg:col-span-3 mt-4">
                    <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 border-b pb-2 mb-4">Fechas Relevantes</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hoy (Automática)</label>
                            <input
                                type="date"
                                className="input-field bg-slate-50 dark:bg-slate-800 text-slate-500 cursor-not-allowed"
                                value={todayDate}
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

                {/* Sección de Estatus y Project Manager */}
                <div className="md:col-span-2 lg:col-span-3 mt-4 space-y-4">
                    <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 border-b pb-2 mb-4">Información Adicional (CCML)</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">¿Subst. Completion?</label>
                            <div className="flex gap-2 p-1 border border-green-300 rounded-lg w-fit" style={{ backgroundColor: '#66FF99' }}>
                                <button type="button" onClick={() => handleChange('reached_substantial_completion', true)} className={`px-4 py-1 text-xs font-bold rounded-md transition-all ${formData.reached_substantial_completion ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-600'}`}>SÍ</button>
                                <button type="button" onClick={() => handleChange('reached_substantial_completion', false)} className={`px-4 py-1 text-xs font-bold rounded-md transition-all ${!formData.reached_substantial_completion ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-600'}`}>NO</button>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">¿Toll Credits?</label>
                            <div className="flex gap-2 p-1 border border-green-300 rounded-lg w-fit" style={{ backgroundColor: '#66FF99' }}>
                                <button type="button" onClick={() => handleChange('eligible_toll_credits', true)} className={`px-4 py-1 text-xs font-bold rounded-md transition-all ${formData.eligible_toll_credits ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-600'}`}>SÍ</button>
                                <button type="button" onClick={() => handleChange('eligible_toll_credits', false)} className={`px-4 py-1 text-xs font-bold rounded-md transition-all ${!formData.eligible_toll_credits ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-600'}`}>NO</button>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">¿ER Funds?</label>
                            <div className="flex gap-2 p-1 border border-green-300 rounded-lg w-fit" style={{ backgroundColor: '#66FF99' }}>
                                <button type="button" onClick={() => handleChange('pay_items_er_funds', true)} className={`px-4 py-1 text-xs font-bold rounded-md transition-all ${formData.pay_items_er_funds ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-600'}`}>SÍ</button>
                                <button type="button" onClick={() => handleChange('pay_items_er_funds', false)} className={`px-4 py-1 text-xs font-bold rounded-md transition-all ${!formData.pay_items_er_funds ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-600'}`}>NO</button>
                            </div>
                        </div>
                    </div>

                    {projectId && <ProjectAgreementForm projectId={projectId} />}
                </div>
            </form>
        </div >
    );
});

export default ProjectForm;
