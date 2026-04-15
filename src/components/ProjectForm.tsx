"use client";

import { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Save, FolderOpen, Trash2, Upload, CheckCircle, FileText, Plus, ShieldCheck, Building2, Loader2, BrainCircuit } from "lucide-react";
import FloatingFormActions from "./FloatingFormActions";
import { formatCurrency, getLocalStorageItem, formatProjectNumber } from "@/lib/utils";
import { exportProjectToFile } from "@/lib/projectFileSystem";
import ProjectAgreementForm from "./ProjectAgreementForm";
import mfgItemsData from "@/lib/mfgItems.json";

export interface FormRef { save: () => Promise<void>; }

const DOC_TYPES = ["Orden de comienzo", "Project Agreement", "Proposal", "Contrato"];

const TodayButton = ({ onSelect }: { onSelect: (date: string) => void }) => (
    <button 
        type="button" 
        onClick={() => onSelect(new Date().toISOString().split('T')[0])}
        className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-white/50 hover:bg-white text-[10px] font-bold text-primary rounded border border-primary/20 transition-all z-10"
    >
        HOY
    </button>
);

const ProjectForm = forwardRef<FormRef, { projectId?: string, userRole?: string, onDirty?: () => void, onSaved?: (newId?: string) => void }>(function ProjectForm({ projectId, userRole, onDirty, onSaved }, ref) {
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
        admin_title: "",  // e.g. "Ing.", "Lcda.", "Arq."
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
        regional_director: "",
        chief_project_control: "",
        dir_construction: "",
        project_origin: "ACT",
    });
    const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
    const [fieldStatus, setFieldStatus] = useState<Record<string, { reviewed: boolean, updated: boolean }>>({});
    const formDataRef = useRef(formData);
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
    const agreementRef = useRef<{ save: () => Promise<void> }>(null);

    // Memorizar funciones de carga para evitar re-ejecuciones de efectos innecesarias
    const fetchDocuments = useCallback(async () => {
        if (!projectId) return;
        const { data, error } = await supabase.from("project_documents")
            .select("*")
            .eq("project_id", projectId);
        if (data) setDocuments(data);
    }, [projectId]);

    const fetchProject = useCallback(async () => {
        if (!projectId) return;
        const { data, error } = await supabase.from("projects")
            .select("*")
            .eq("id", projectId)
            .single();
        if (data) {
            const fetchedData = {
                ...data,
                municipios: data.municipios ? data.municipios.join(", ") : "",
                carreteras: data.carreteras ? data.carreteras.join(", ") : "",
            };
            setFormData(fetchedData);
            formDataRef.current = fetchedData;
        }
    }, [projectId]);

    useEffect(() => {
        setMounted(true);
        const loadUserRole = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data: userData } = await supabase.from("users").select("role_global").eq("id", session.user.id).single();
                setIsGlobalAdmin(userData?.role_global === "A");
                if (userData?.role_global === 'F' && !projectId) {
                    setFormData(prev => ({ ...prev, project_origin: "Contratista" }));
                }
            }
        };
        loadUserRole();
        if (projectId) {
            fetchProject();
            fetchDocuments();
        }
    }, [projectId, fetchProject, fetchDocuments]);

    const handleFileUpload = async (file: File) => {
        if (!projectId) {
            alert("Debe guardar el proyecto primero antes de subir documentos.");
            return;
        }

        setUploadingDoc(true);
        try {
            // Normalizar tildes/acentos para Supabase Storage
            const safeName = file.name
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-zA-Z0-9._-]/g, '_');
            const dateFolder = new Date().toISOString().split('T')[0];
            const timestamp = Date.now();
            const storagePath = `${projectId}/project/${dateFolder}/${timestamp}_${safeName}`;
            
            const { error: storageErr } = await supabase.storage.from('project-documents').upload(storagePath, file);

            const { error: dbErr } = await supabase.from("project_documents").insert({
                project_id: projectId,
                doc_type: selectedDocType,
                section: "project",
                file_name: file.name,
                storage_path: storageErr ? null : storagePath
            });

            if (dbErr) throw dbErr;
            await fetchDocuments();
            alert(`Documento "${selectedDocType}" subido correctamente.`);
            
        } catch (err: any) {
            console.error("Error upload:", err);
            alert("Error al subir el documento: " + err.message);
        } finally {
            setUploadingDoc(false);
        }
    };

    const handleAiAnalysis = async () => {
        if (!projectId) return;
        setLoading(true);
        setAiResponse("Iniciando análisis integral de documentos con ACT-GPT...");

        try {
            // 1. Obtener todos los documentos críticos
            const { data: docs } = await supabase.from("project_documents")
                .select("*")
                .eq("project_id", projectId)
                .in("doc_type", DOC_TYPES);

            if (!docs || docs.length === 0) {
                alert("No hay documentos guardados para analizar. Suba el Contrato, Proposal, etc. primero.");
                setLoading(false);
                return;
            }

            let fullPrompt = `Actúa como un analista de datos experto en proyectos de construcción de la ACT (Puerto Rico). 
            Tengo varios documentos y necesito que extraigas información estructurada EXACTA. 
            Devuelve un objeto JSON con las siguientes claves (si no encuentras algo, deja null o []):
            
            - "general": { "num_act": string, "num_federal": string, "name": string, "num_oracle": string, "num_contrato": string, "admin_name": string, "cost_original": number, "liquidated_damages_amount": number }
            - "contractor": { "name": string, "representative": string, "ss_patronal": string, "phone_office": string, "phone_mobile": string, "email": string }
            - "dates": { "date_contract_sign": "YYYY-MM-DD", "date_project_start": "YYYY-MM-DD", "date_orig_completion": "YYYY-MM-DD" }
            - "items": Array of { "item_num": string(3 digits), "specification": string, "description": string, "quantity": number, "unit": string, "unit_price": number, "fund_source": string }
            - "agreement_funds": Array of { "fund_type": string, "amount": number } (de la tabla de Fondos Originales)
            - "scope": string (alcance detallado del proyecto)
            
             Analiza y extrae ÚNICAMENTE la información que pertenezca al proyecto con el Número AC: "${formData.num_act}" o Número Federal: "${formData.num_federal}". Si los documentos contienen varios proyectos, ignora los demás y enfócate solo en este.

             Analiza según el tipo de documento:
            1. Contrato: Datos generales, costo original, información crítica del contratista (Contractor).
            2. Proposal: Scope (alcance del proyecto), TODAS las partidas del contrato con sus especificaciones, descripción, cantidad original, unidad, precio unitario, y la distribución de fondos ("fund_source") de la sección de TODAS las partidas.
            3. Orden de comienzo: Llena las fechas que se obtengan (inicio, terminación).
            4. Project Agreement: Obtener los espacios de la tabla "Fondos Originales (Project Agreement)" en la clave "agreement_funds".`;

            let extractedText = "";
            
            for (const doc of docs) {
                setAiResponse(`Leyendo ${doc.doc_type}: ${doc.file_name}...`);
                if (!doc.storage_path) continue;
                
                const { data: blob } = await supabase.storage.from("project-documents").download(doc.storage_path);
                if (blob) {
                    const base64 = await blobToBase64(blob);
                    const res = await parsePdf(base64);
                    if (res.success) {
                        extractedText += `\n\n--- DOCUMENTO: ${doc.doc_type} ---\n${res.text}`;
                    }
                }
            }

            setAiResponse("ACT-GPT está procesando el JSON final...");
            const win = (window as any);
            const payload = { text: extractedText, prompt: fullPrompt };
            let aiResult: any;

            if (win.electronAPI?.analyzeDocument) {
                const aiResponse = await win.electronAPI.analyzeDocument(payload);
                aiResult = aiResponse.success ? aiResponse.result : null;
            } else {
                const response = await fetch('/api/analyze-document', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await response.json();
                aiResult = data.result;
            }

            if (aiResult) {
                // Limpiar JSON si viene con markdown o texto adicional
                let cleanedJson = aiResult.trim();
                const jsonMatch = aiResult.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    cleanedJson = jsonMatch[0];
                }

                let parsed: any;
                try {
                    parsed = JSON.parse(cleanedJson);
                } catch (jsonErr) {
                    console.error("JSON Parse Error:", jsonErr, "Original text:", aiResult);
                    throw new Error("La IA no devolvió un formato válido. Por favor, intente de nuevo.");
                }

                // 2. Actualizar formulario (General, Datos, Scope) y rastrear cambios visuales
                const newStatus: any = {};
                const updates: any = {};
                
                const processObject = (obj: any) => {
                    if (!obj) return;
                    Object.keys(obj).forEach(k => {
                        let val = obj[k];
                        if (val !== undefined && val !== null) {
                            // Map special keys if needed
                            const fieldKey = (k === 'num_act' || k === 'num_federal' || k === 'name' || k === 'num_oracle' || k === 'num_contrato' || k === 'admin_name' || k === 'cost_original' || k === 'liquidated_damages_amount' || k === 'date_contract_sign' || k === 'date_project_start' || k === 'date_orig_completion' || k === 'scope') ? k : null;
                            
                            if (fieldKey) {
                                if (fieldKey === 'num_act' && typeof val === 'string' && val.length > 0 && !val.includes('AC-')) {
                                    val = `AC-${val}`;
                                }
                                
                                const oldVal = (formData as any)[fieldKey];
                                const isDifferent = String(oldVal) !== String(val);
                                
                                newStatus[fieldKey] = { reviewed: true, updated: isDifferent };
                                updates[fieldKey] = val;
                            }
                        }
                    });
                };

                processObject(parsed.general);
                processObject(parsed.dates);
                if (parsed.scope) {
                    const isDifferent = String(formData.scope) !== String(parsed.scope);
                    newStatus.scope = { reviewed: true, updated: isDifferent };
                    updates.scope = parsed.scope;
                }
                
                setFieldStatus(newStatus);
                
                if (parsed.contractor && parsed.contractor.name) {
                    const oldContractor = formData.contractor_name;
                    newStatus.contractor_name = { reviewed: true, updated: oldContractor !== parsed.contractor.name };
                    
                    updates.contractor_name = parsed.contractor.name;
                    await supabase.from("contractors").upsert({
                        ...parsed.contractor,
                        project_id: projectId
                    }, { onConflict: 'project_id' });
                }
                
                setFormData(prev => {
                    const nextData = { ...prev, ...updates };
                    formDataRef.current = nextData;
                    return nextData;
                });

                // 3. Insertar partidas si hay
                if (parsed.items && parsed.items.length > 0) {
                    setAiResponse(`Guardando ${parsed.items.length} partidas en la base de datos...`);
                    const finalItems = parsed.items.map((it: any) => ({
                        project_id: projectId,
                        item_num: it.item_num?.toString().padStart(3, '0'),
                        specification: it.specification,
                        description: it.description,
                        quantity: parseFloat(it.quantity) || 0,
                        unit: it.unit,
                        unit_price: parseFloat(it.unit_price) || 0,
                        fund_source: it.fund_source || "ACT:100%" // Default
                    }));
                    await supabase.from("contract_items").upsert(finalItems, { onConflict: 'project_id, item_num' });
                }

                // 4. Insertar fondos del Project Agreement
                if (parsed.agreement_funds && parsed.agreement_funds.length > 0) {
                    setAiResponse("Actualizando fondos en Project Agreement...");
                    const finalFunds = parsed.agreement_funds.map((f: any) => ({
                        project_id: projectId,
                        fund_source: f.fund_type,
                        original_amount: parseFloat(f.amount) || 0
                    }));
                    await supabase.from("project_agreement_funds").upsert(finalFunds, { onConflict: 'project_id, fund_source' });
                }

                alert("✓ Análisis de ACT-GPT completado con éxito. Se han poblado los datos generales, partidas y fondos.");
            }

        } catch (err: any) {
            console.error("AI Analysis Error:", err);
            alert("Error en el análisis de IA: " + err.message);
        } finally {
            setLoading(false);
            setAiResponse("");
        }
    };

    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
    };

    const parsePdf = async (base64: string): Promise<{ success: boolean; text?: string }> => {
        if (!base64) return { success: false };
        try {
            // Using existing parsePdf logic if available via API or fetch
            const win = (window as any);
            if (win.electronAPI?.parsePdf) {
                return await win.electronAPI.parsePdf(base64);
            } else {
                const res = await fetch('/api/parse-pdf', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pdfBase64: base64 })
                });
                return await res.json();
            }
        } catch (e) {
            console.error(e);
            return { success: false };
        }
    };

    const handleDeleteDocument = async (docId: string, storagePath: string) => {
        if (!window.confirm("¿Está seguro que desea eliminar este documento?")) return;
        
        try {
            setUploadingDoc(true);
            // 1. Delete from Storage
            if (storagePath) {
                await supabase.storage.from("project-documents").remove([storagePath]);
            }
            
            // 2. Delete from DB
            const { error } = await supabase.from("project_documents").delete().eq("id", docId);
            if (error) throw error;
            
            fetchDocuments();
            alert("Documento eliminado correctamente.");
        } catch (err: any) {
            console.error("Error deleting doc:", err);
            alert("Error al eliminar documento: " + err.message);
        } finally {
            setUploadingDoc(false);
        }
    };

    // Auto calculate "Terminación administrativa" (+2 years)
    const getTerminacionAdministrativa = () => {
        if (!formData.date_rev_completion) return "";
        const revDate = new Date(formData.date_rev_completion);
        if (isNaN(revDate.getTime())) return "";
        revDate.setDate(revDate.getDate() + 730);
        return revDate.toISOString().split("T")[0];
    };

    const calculateLiquidatedDamages = (cost: number) => {
        if (cost <= 0) return 0;
        if (cost <= 100000) return 350;
        if (cost <= 500000) return 450;
        if (cost <= 1000000) return 600;
        if (cost <= 2000000) return 750;
        if (cost <= 5000000) return 900;
        if (cost <= 10000000) return 1100;
        return 1400;
    };

    const terminacionAdministrativa = getTerminacionAdministrativa();

    const handleChange = (field: string, value: any) => {
        setFormData(prev => {
            let nextData = { ...prev, [field]: value };
            
            // Si cambia el costo original, recalcular LD automáticamente
            if (field === 'cost_original') {
                const newCost = parseFloat(value) || 0;
                nextData.liquidated_damages_amount = calculateLiquidatedDamages(newCost);
            }

            formDataRef.current = nextData;
            return nextData;
        });
        // Limpiar status visual si el usuario cambia el dato manualmente
        setFieldStatus(prev => ({ ...prev, [field]: { reviewed: false, updated: false } }));
        if (onDirty) onDirty();
    };

    const getFieldStyle = (field: string) => {
        const s = fieldStatus[field];
        return {
            color: s?.reviewed ? '#0000FF' : undefined, // Azul para revisado
            backgroundColor: s?.updated ? '#FFFF00' : '#66FF99', // Amarillo para actualizado, verde base
            fontWeight: s?.reviewed ? 'bold' : undefined
        };
    };

    const saveData = async (silent = false) => {
        try {
            // Evaluamos la info más reciente
            const currentData = formDataRef.current;
            
            // Validar formato del número de proyecto (AC-XXXXXX o similares)
            // Ampliamos para ser más flexibles con proyectos existentes
            const numActRegex = /^(AC-|ACT-)[0-9A-Z]{2,12}[A-Z]?$|^[0-9A-Z-]{4,15}$/i;
            const currentNumAct = (currentData.num_act || "").trim();
        
            if (!currentNumAct || currentNumAct.length < 3) {
                if (!silent) alert("El número de proyecto estatal no puede estar vacío.");
                setLoading(false);
                return;
            }

            setLoading(true);
            let finalNumAct = formatProjectNumber(currentNumAct);
            
            // 1. Colisión ACT vs Contratista (Mismo número, diferente origen)
            if (!projectId) {
                const { data: existing } = await supabase
                    .from("projects")
                    .select("id, project_origin")
                    .eq("num_act", finalNumAct)
                    .maybeSingle();

                if (existing && existing.project_origin !== currentData.project_origin) {
                    const suffix = currentData.project_origin === 'Contratista' ? 'C' : 'A';
                    finalNumAct = finalNumAct + suffix;
                }
            }
            
            // 2. Colisión General (Si el número final ya existe, buscamos la siguiente letra disponible automáticamente)
            if (!projectId) {
                let isDuplicate = true;
                let attempt = 0;
                const baseNum = finalNumAct.substring(0, 9); // e.g. "AC-123456"
                
                while (isDuplicate && attempt < 10) {
                    const { data } = await supabase.from("projects").select("id").eq("num_act", finalNumAct).maybeSingle();
                    if (!data) {
                        isDuplicate = false;
                    } else {
                        attempt++;
                        // Si ya tiene sufijo (A/C/etc), probamos la siguiente letra del abecedario
                        // Pero respetando la restricción de longitud. 
                        // Simplemente añadimos letras B, D, E... si A/C ya están ocupadas
                        const nextLetter = String.fromCharCode(64 + attempt + (attempt > 2 ? 1 : 0)); // Evitar confusión si queremos
                        finalNumAct = baseNum + nextLetter;
                    }
                }
            }
            
            const finalNumActUpper = finalNumAct.toUpperCase();

            const { id, created_at, updated_at, ...restData } = currentData as any;
            const dataToSave = {
                ...restData,
                num_act: finalNumActUpper,
                municipios: currentData.municipios ? currentData.municipios.split(",").map((s: string) => s.trim()).filter((s: string) => s !== "") : [],
                carreteras: currentData.carreteras ? currentData.carreteras.split(",").map((s: string) => s.trim()).filter((s: string) => s !== "") : [],
                date_contract_sign: (typeof currentData.date_contract_sign === 'string' && currentData.date_contract_sign.trim() !== "") ? currentData.date_contract_sign : null,
                date_project_start: (typeof currentData.date_project_start === 'string' && currentData.date_project_start.trim() !== "") ? currentData.date_project_start : null,
                date_orig_completion: (typeof currentData.date_orig_completion === 'string' && currentData.date_orig_completion.trim() !== "") ? currentData.date_orig_completion : null,
                date_rev_completion: (typeof currentData.date_rev_completion === 'string' && currentData.date_rev_completion.trim() !== "") ? currentData.date_rev_completion : null,
                date_est_completion: (typeof currentData.date_est_completion === 'string' && currentData.date_est_completion.trim() !== "") ? currentData.date_est_completion : null,
                date_real_completion: (typeof currentData.date_real_completion === 'string' && currentData.date_real_completion.trim() !== "") ? currentData.date_real_completion : null,
                date_substantial_completion: (typeof currentData.date_substantial_completion === 'string' && currentData.date_substantial_completion.trim() !== "") ? currentData.date_substantial_completion : null,
                date_final_inspection: (typeof currentData.date_final_inspection === 'string' && currentData.date_final_inspection.trim() !== "") ? currentData.date_final_inspection : null,
                date_admin_term: terminacionAdministrativa || null,
                fmis_end_date: (typeof currentData.fmis_end_date === 'string' && currentData.fmis_end_date.trim() !== "") ? currentData.fmis_end_date : null,
                created_by_email: currentData.created_by_email || null,
                reached_substantial_completion: currentData.reached_substantial_completion,
                eligible_toll_credits: currentData.eligible_toll_credits,
                pay_items_er_funds: currentData.pay_items_er_funds,
                project_manager_name: currentData.project_manager_name || null,
                admin_name: currentData.admin_name || null,
                admin_title: (currentData as any).admin_title || null,
                contractor_name: currentData.contractor_name || null,
                liquidador_name: currentData.liquidador_name || null,
                regional_director: currentData.regional_director || null,
                chief_project_control: currentData.chief_project_control || null,
                dir_construction: currentData.dir_construction || null,
                project_origin: currentData.project_origin || "ACT",
            };

            console.log("Saving project data:", dataToSave);

            let result: any;
            if (projectId) {
                console.log("Executing update for projectId:", projectId);
                const { data, error } = await supabase.from("projects").update(dataToSave).eq("id", projectId).select();
                result = { data, error };
                
                if (error) {
                    console.error("Supabase update error detail:", error);
                    // El error se mostrará más abajo, evitar doble alert
                } else {
                    console.log("Project update successful. Data returned:", data);
                }
                
                // Guardar también la sección de fondos si existe
                if (agreementRef.current) {
                    console.log("Calling agreementRef.current.save()...");
                    await agreementRef.current.save();
                }
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
                const errMsg = "Error guardando proyecto: " + error.message;
                if (!silent) alert(errMsg);
                setLoading(false);
                throw new Error(errMsg);
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

        if (!isGlobalAdmin && formDataRef.current.created_by_email && currentUserEmail !== formDataRef.current.created_by_email) {
            alert(`Acceso denegado: Solo el creador del proyecto (${formDataRef.current.created_by_email}) o un administrador pueden eliminarlo.`);
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
                    setFormData(prev => {
                        const nextData = { ...prev, folder_path: path };
                        formDataRef.current = nextData;
                        return nextData;
                    });
                    setTempPath(path);
                }
            } else if ('showDirectoryPicker' in window) {
                // @ts-ignore
                const handle = await window.showDirectoryPicker();
                const nextData = { ...formDataRef.current, folder_path: handle.name };
                setFormData(nextData);
                formDataRef.current = nextData;
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

            <div className="sticky top-16 z-40 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md pt-6 pb-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-start gap-4 mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-3 shrink-0">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <FileText className="text-primary" size={24} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Información General</span>
                        <span>Información del Proyecto</span>
                    </div>
                </h2>
                
                {projectId && userRole === 'A' && (
                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={loading}
                        className="ml-auto hidden lg:flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm hover:shadow-red-200 disabled:opacity-50 disabled:grayscale"
                    >
                        <Trash2 size={14} />
                        Eliminar Proyecto
                    </button>
                )}

                <div className="flex gap-3 w-full sm:ml-auto sm:w-auto lg:hidden justify-end">
                    {projectId && (
                         <button
                            type="button"
                            onClick={handleDelete}
                            disabled={loading}
                            className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-[10px] font-bold uppercase transition-all"
                        >
                            <Trash2 size={14} />
                            Eliminar
                        </button>
                    )}
                </div>
            </div>

            {/* El botón de guardar ha sido eliminado por solicitud del usuario */}

            {formData.num_act && (
                <div className="flex items-center gap-2 -mt-4 mb-4">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Proyecto:</span>
                    <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-primary text-[10px] font-bold rounded border border-blue-100 dark:border-blue-800">
                        {formatProjectNumber(formData.num_act, true)}
                    </span>
                </div>
            )}

            {/* Sección de Documentación Crítica - WOW Glassmorphism */}
            <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-8 rounded-[2rem] border border-slate-200/50 dark:border-slate-800/50 mb-10 shadow-lg shadow-slate-200/20 dark:shadow-none transition-all hover:shadow-xl">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
                    <div className="space-y-5 flex-1 w-full">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-primary/10 rounded-xl">
                                <Upload className="text-primary" size={24} />
                            </div>
                            <div className="flex flex-col">
                                <h3 className="text-base font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
                                    Documentación Crítica del Proyecto
                                </h3>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold italic opacity-70">Asocie los documentos legales y contractuales base para el control del proyecto.</p>
                            </div>
                        </div>
                        
                        {isGlobalAdmin && (
                            <div className="flex flex-col sm:flex-row items-end gap-4 pt-2">
                                <div className="space-y-1.5 flex-1 w-full max-w-md">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                        Tipo de Documento
                                    </label>
                                    <select 
                                        className="w-full px-4 py-3 h-12 text-sm font-bold bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer shadow-sm"
                                        value={selectedDocType}
                                        onChange={(e) => setSelectedDocType(e.target.value)}
                                        disabled={!projectId || uploadingDoc}
                                    >
                                        {DOC_TYPES.map(t => <option key={t} value={t} className="font-bold">{t}</option>)}
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
                                        accept=".pdf,image/*"
                                        disabled={!projectId || uploadingDoc}
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleFileUpload(file);
                                            e.target.value = '';
                                        }}
                                    />
                                </label>
                            </div>
                        )}

                        {/* Banner AI - Modernizado sin chat manual */}
                        {(projectId && isGlobalAdmin) && (
                            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden group border border-white/10">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32 group-hover:bg-white/20 transition-all duration-700"></div>
                                <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/10 rounded-full blur-3xl -ml-24 -mb-24"></div>
                                
                                <div className="relative z-10 flex flex-col items-center text-center gap-6">
                                    <div className="w-20 h-20 bg-white/20 backdrop-blur-xl rounded-[2rem] flex items-center justify-center border border-white/30 shadow-2xl">
                                        <FileText size={40} className="text-white" />
                                    </div>
                                    
                                    <div className="max-w-xl">
                                        <h4 className="text-2xl font-black uppercase tracking-tight mb-2">Análisis de Documentos ACT-GPT</h4>
                                        <p className="text-indigo-100 text-sm font-medium leading-relaxed opacity-90">
                                            Extrae automáticamente datos críticos, partidas del contrato, fechas y fondos del Project Agreement a partir de los PDFs subidos (Contrato, Proposal, etc).
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        disabled={loading}
                                        onClick={handleAiAnalysis}
                                        className="mt-2 px-10 py-4 bg-white text-indigo-600 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl hover:shadow-indigo-400/30 active:scale-95 transition-all flex items-center gap-3 group/btn"
                                    >
                                        {loading ? (
                                            <div className="w-5 h-5 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                                        ) : (
                                            <Plus size={20} className="group-hover/btn:rotate-90 transition-transform duration-300" />
                                        )}
                                        {loading ? "Procesando documentos..." : "Iniciar Análisis Integral ACT-GPT"}
                                    </button>

                                    {aiResponse && (
                                        <div className="w-full bg-indigo-900/40 backdrop-blur-md rounded-2xl p-5 border border-indigo-400/30 text-indigo-50 mt-2 animate-in fade-in slide-in-from-bottom-4">
                                            <div className="flex items-center gap-3 mb-3 opacity-80 border-b border-indigo-400/20 pb-3">
                                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">ACT-GPT Status</span>
                                            </div>
                                            <p className="text-sm font-bold leading-relaxed">{aiResponse}</p>
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
                                    <div key={type} className={`group relative px-3 py-2.5 rounded-xl border flex items-center gap-3 transition-all ${doc ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400" : "bg-slate-50 border-slate-100 dark:bg-slate-800/30 dark:border-slate-800 text-slate-400 opacity-60"}`}>
                                        <div className={`p-1.5 rounded-lg ${doc ? "bg-emerald-100 dark:bg-emerald-900/50" : "bg-slate-100 dark:bg-slate-700/50"}`}>
                                            {doc ? <CheckCircle size={14} /> : <FileText size={14} />}
                                        </div>
                                        <div className="flex flex-col flex-1">
                                            <span className="text-[10px] font-bold leading-tight">{type}</span>
                                            <span className="text-[9px] opacity-70 leading-tight">
                                                {doc ? `Subido: ${new Date(doc.uploaded_at).toLocaleDateString()}` : "Pendiente"}
                                            </span>
                                        </div>
                                        {doc && isGlobalAdmin && (
                                            <button 
                                                type="button"
                                                onClick={() => handleDeleteDocument(doc.id, doc.storage_path)}
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                title="Borrar documento"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Origen del Proyecto - Differentiates between ACT Admin and Contractor data */}
            {userRole === 'A' && (
                <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-8 rounded-[2rem] border border-slate-200/50 dark:border-slate-800/50 mb-10 shadow-lg shadow-slate-200/20 dark:shadow-none transition-all hover:shadow-xl">
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />
                            Fuente de los Datos del Proyecto
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={() => handleChange("project_origin", "ACT")}
                                className={`flex items-center gap-4 p-5 rounded-[1.5rem] border-2 transition-all group ${formData.project_origin === 'ACT' 
                                    ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-lg shadow-blue-500/10' 
                                    : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-50'}`}
                            >
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${formData.project_origin === 'ACT' ? 'bg-blue-500 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
                                    <ShieldCheck size={24} />
                                </div>
                                <div className="text-left">
                                    <span className="block font-black uppercase tracking-tight text-sm">ACT / Administrador</span>
                                    <span className="block text-[10px] font-bold opacity-70">Datos oficiales de administración</span>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleChange("project_origin", "Contratista")}
                                className={`flex items-center gap-4 p-5 rounded-[1.5rem] border-2 transition-all group ${formData.project_origin === 'Contratista' 
                                    ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-lg shadow-rose-500/10' 
                                    : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-50'}`}
                            >
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${formData.project_origin === 'Contratista' ? 'bg-rose-500 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
                                    <Building2 size={24} />
                                </div>
                                <div className="text-left">
                                    <span className="block font-black uppercase tracking-tight text-sm">Contratista Externo</span>
                                    <span className="block text-[10px] font-bold opacity-70">Datos proporcionados por el contratista</span>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <form suppressHydrationWarning className="card grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 bg-white dark:bg-slate-900 border-none shadow-sm">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Núm. AC</label>
                    <input
                        type="text"
                        maxLength={13}
                        className="input-field"
                        style={getFieldStyle('num_act')}
                        placeholder="AC-000000"
                        value={formData.num_act || ""}
                        onChange={(e) => {
                            let val = e.target.value.toUpperCase();
                            if (!val.startsWith("AC-")) {
                                val = "AC-" + val.replace(/[^0-9A-Z]/g, "");
                            } else {
                                const digits = val.substring(3).replace(/[^0-9A-Z]/g, "");
                                val = "AC-" + digits.substring(0, 10);
                            }
                            handleChange('num_act', val);
                        }}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Núm. Federal</label>
                    <input
                        type="text"
                        maxLength={50}
                        className="input-field"
                        style={getFieldStyle('num_federal')}
                        value={formData.num_federal || ""}
                        onChange={(e) => handleChange('num_federal', e.target.value)}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nombre del Proyecto</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            maxLength={255}
                            className="input-field flex-1"
                            style={getFieldStyle('name')}
                            value={formData.name || ""}
                            onChange={(e) => handleChange('name', e.target.value)}
                        />

                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Núm. Oracle</label>
                    <input
                        type="text"
                        maxLength={50}
                        className="input-field"
                        style={getFieldStyle('num_oracle')}
                        value={formData.num_oracle || ""}
                        onChange={(e) => handleChange('num_oracle', e.target.value)}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Núm. Contrato</label>
                    <input
                        type="text"
                        maxLength={20}
                        className="input-field"
                        style={getFieldStyle('num_contrato')}
                        value={formData.num_contrato || ""}
                        onChange={(e) => handleChange('num_contrato', e.target.value.replace(/[^0-9]/g, ""))}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">No. Cuenta</label>
                    <input
                        type="text"
                        maxLength={50}
                        className="input-field"
                        style={getFieldStyle('no_cuenta')}
                        value={formData.no_cuenta || ""}
                        onChange={(e) => handleChange('no_cuenta', e.target.value)}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">Costo Original ($)</label>
                    <div className="relative">
                        <input
                            type={isCostFocused ? "text" : "text"}
                            className="input-field border-emerald-100 focus:ring-emerald-500 font-bold"
                            style={getFieldStyle('cost_original')}
                            value={isCostFocused
                                ? (formData.cost_original === 0 ? "" : formData.cost_original.toString())
                                : formatCurrency(formData.cost_original)}
                            onFocus={(e) => {
                                setIsCostFocused(true);
                            }}
                            onBlur={(e) => {
                                setIsCostFocused(false);
                                const val = parseFloat(e.target.value);
                                handleChange('cost_original', isNaN(val) ? 0 : val);
                            }}
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
                        style={getFieldStyle('region')}
                        value={formData.region || "Norte"}
                        onChange={(e) => handleChange('region', e.target.value)}
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
                    <div className="relative group">
                        <input
                            type={isDlqFocused ? "text" : "text"}
                            className="input-field border-red-100 focus:ring-red-500 font-bold pr-20"
                            style={getFieldStyle('liquidated_damages_amount')}
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
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[9px] text-slate-400 font-medium italic">Editable</span>
                        </div>
                    </div>
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
                            style={getFieldStyle('folder_path')}
                            placeholder="Ej. C:\Proyectos\ACT-2024-001"
                            value={formData.folder_path || ""}
                            onChange={(e) => handleChange('folder_path', e.target.value)}
                        />
                        <button
                            type="button"
                            onClick={async () => {
                                try {
                                    // @ts-ignore
                                    if (window.electronAPI && window.electronAPI.selectFolder) {
                                        // @ts-ignore
                                        const pathSelected = await window.electronAPI.selectFolder();
                                        if (pathSelected) {
                                            handleChange('folder_path', pathSelected);
                                        }
                                    }
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
                        style={getFieldStyle('num_ocpr')}
                        value={formData.num_ocpr || ""}
                        onChange={(e) => handleChange('num_ocpr', e.target.value)}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Diseñador</label>
                    <input
                        type="text"
                        maxLength={100}
                        className="input-field"
                        style={getFieldStyle('designer')}
                        value={formData.designer || ""}
                        onChange={(e) => handleChange('designer', e.target.value)}
                    />
                </div>
                <div className="space-y-1 md:col-span-2 lg:col-span-1 border-b md:border-none pb-4 md:pb-0">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Municipios</label>
                    <input
                        type="text"
                        maxLength={255}
                        placeholder="Ej. San Juan, Guaynabo"
                        className="input-field"
                        style={getFieldStyle('municipios')}
                        value={formData.municipios || ""}
                        onChange={(e) => handleChange('municipios', e.target.value)}
                    />
                </div>
                <div className="space-y-1 md:col-span-2 lg:col-span-2 border-b md:border-none pb-4 md:pb-0">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Carreteras</label>
                    <input
                        type="text"
                        maxLength={255}
                        placeholder="Ej. PR-1, PR-2"
                        className="input-field"
                        style={getFieldStyle('carreteras')}
                        value={formData.carreteras || ""}
                        onChange={(e) => handleChange('carreteras', e.target.value)}
                    />
                </div>
                <div className="space-y-1 md:col-span-2 lg:col-span-3">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Alcance Proy. (SCOPE)</label>
                    <textarea
                        rows={6}
                        maxLength={50000}
                        className="input-field"
                        style={getFieldStyle('scope')}
                        value={formData.scope || ""}
                        onChange={(e) => handleChange('scope', e.target.value)}
                    ></textarea>
                </div>


                <div className="md:col-span-2 lg:col-span-3 mt-4">
                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 border-b pb-2 mb-4">Fechas Relevantes</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hoy (Automática)</label>
                            <input
                                type="text"
                                className="input-field bg-slate-50 dark:bg-slate-800 text-slate-500 cursor-not-allowed font-medium"
                                value={new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                                disabled
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Firma Contrato</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    className="input-field pr-12"
                                    style={getFieldStyle('date_contract_sign')}
                                    value={formData.date_contract_sign || ""}
                                    onChange={(e) => {
                                        handleChange('date_contract_sign', e.target.value);
                                    }}
                                />
                                <TodayButton onSelect={(d) => handleChange('date_contract_sign', d)} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Comienzo Proyecto</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    className="input-field pr-12"
                                    style={getFieldStyle('date_project_start')}
                                    value={formData.date_project_start || ""}
                                    onChange={(e) => {
                                        handleChange('date_project_start', e.target.value);
                                    }}
                                />
                                <TodayButton onSelect={(d) => handleChange('date_project_start', d)} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Terminación Original</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    className="input-field pr-12"
                                    style={getFieldStyle('date_orig_completion')}
                                    value={formData.date_orig_completion || ""}
                                    onChange={(e) => {
                                        handleChange('date_orig_completion', e.target.value);
                                    }}
                                />
                                <TodayButton onSelect={(d) => handleChange('date_orig_completion', d)} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Terminación Revisada</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    className="input-field pr-12"
                                    style={getFieldStyle('date_rev_completion')}
                                    value={formData.date_rev_completion || ""}
                                    onChange={(e) => {
                                        handleChange('date_rev_completion', e.target.value);
                                    }}
                                />
                                <TodayButton onSelect={(d) => handleChange('date_rev_completion', d)} />
                            </div>
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
                            <div className="relative">
                                <input
                                    type="date"
                                    className="input-field pr-12"
                                    style={getFieldStyle('date_est_completion')}
                                    value={formData.date_est_completion || ""}
                                    onChange={(e) => {
                                        handleChange('date_est_completion', e.target.value);
                                    }}
                                />
                                <TodayButton onSelect={(d) => handleChange('date_est_completion', d)} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Terminación Real</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    className="input-field pr-12"
                                    style={getFieldStyle('date_real_completion')}
                                    value={formData.date_real_completion || ""}
                                    onChange={(e) => {
                                        handleChange('date_real_completion', e.target.value);
                                    }}
                                />
                                <TodayButton onSelect={(d) => handleChange('date_real_completion', d)} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Terminación Sustancial</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    className="input-field pr-12"
                                    style={getFieldStyle('date_substantial_completion')}
                                    value={formData.date_substantial_completion || ""}
                                    onChange={(e) => {
                                        handleChange('date_substantial_completion', e.target.value);
                                    }}
                                />
                                <TodayButton onSelect={(d) => handleChange('date_substantial_completion', d)} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Inspección Final</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    className="input-field pr-12"
                                    style={getFieldStyle('date_final_inspection')}
                                    value={formData.date_final_inspection || ""}
                                    onChange={(e) => {
                                        handleChange('date_final_inspection', e.target.value);
                                    }}
                                />
                                <TodayButton onSelect={(d) => handleChange('date_final_inspection', d)} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                FMIS END DATE
                            </label>
                            <div className="relative">
                                <input
                                    type="date"
                                    className="input-field border-emerald-200 dark:border-emerald-800 focus:ring-emerald-500 pr-12"
                                    style={getFieldStyle('fmis_end_date')}
                                    value={formData.fmis_end_date || ""}
                                    onChange={(e) => {
                                        handleChange('fmis_end_date', e.target.value);
                                    }}
                                />
                                <TodayButton onSelect={(d) => handleChange('fmis_end_date', d)} />
                            </div>
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
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nombre del Administrador</label>
                            <input
                                type="text"
                                className="input-field"
                                style={getFieldStyle('admin_name')}
                                placeholder="Ej. Juan Pérez"
                                value={formData.admin_name || ""}
                                onChange={(e) => handleChange('admin_name', e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Título del Administrador (Ej: Ing.)</label>
                            <input
                                type="text"
                                className="input-field"
                                style={getFieldStyle('admin_title')}
                                placeholder="Ej. Ing., Arq., Lcdo."
                                value={(formData as any).admin_title || ""}
                                onChange={(e) => handleChange('admin_title', e.target.value)}
                            />
                        </div>
                    </div>



                    {projectId && (
                        <div className="mt-12 border-t pt-8">
                            <ProjectAgreementForm ref={agreementRef} projectId={projectId} hideActions={true} />
                        </div>
                    )}
                </div>
            </form>
            <FloatingFormActions 
                actions={[
                    {
                        label: loading ? "Guardando..." : "Guardar Proyecto",
                        icon: loading ? <Loader2 className="animate-spin" /> : <Save />,
                        onClick: () => saveData(false),
                        description: "Guardar los cambios en la información básica del proyecto",
                        variant: 'primary',
                        disabled: loading
                    }
                ]}
            />
        </div >
    );
});

export default ProjectForm;
