"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
    FolderOpen, Folder, FileText, Download, Upload, Trash2,
    Search, ChevronRight, ChevronDown, RefreshCw, File,
    Image as ImageIcon, Music, Video, Archive, AlertCircle, Info,
    Eye, X, ExternalLink, Loader2, FolderPlus
} from "lucide-react";

// --- Secciones del proyecto ----------------------------------------
const PROJECT_SECTIONS = [
    { id: "project",    label: "Datos del Proyecto",    bucket: "project-documents" },
    { id: "personnel",  label: "Firmas ACT",            bucket: "project-documents" },
    { id: "items",      label: "Partidas",              bucket: "project-documents" },
    { id: "materials",  label: "Materiales (MOS)",      bucket: "project-documents" },
    { id: "compliance", label: "Cumplimiento",          bucket: "project-documents" },
    { id: "cho",        label: "Change Orders",         bucket: "project-documents" },
    { id: "payment",    label: "Certificaciones Pago",  bucket: "project-documents" },
    { id: "mfg",        label: "Certificados CM",       bucket: "project-documents" },
    { id: "minutes",    label: "Minutas",               bucket: "project-documents" },
    { id: "logs",       label: "Informes de Actividades", bucket: "project-documents" },
    { id: "inspection", label: "Inspeccion",           bucket: "project-documents" },
    { id: "force",      label: "Force Account",        bucket: "project-documents" },
    { id: "liquidation",label: "Liquidacion",          bucket: "project-documents" },
    { id: "icc",        label: "Initial Certification", bucket: "project-documents" },
    { id: "presentations", label: "Presentaciones",      bucket: "project-documents" },
    { id: "tables",     label: "Tablas",               bucket: "project-documents" },
    { id: "general",    label: "General / Sin clasificar", bucket: "project-documents" },
    { id: "photos",     label: "Galeria de Fotos",       bucket: "project-documents" },
];

interface DocRecord {
    id: string;
    project_id: string;
    file_name: string;
    doc_type: string;
    section: string;
    storage_path: string | null;
    uploaded_at: string;
}

function getFileIcon(name: string) {
    const ext = (name.split(".").pop() || "").toLowerCase();
    if (["jpg","jpeg","png","gif","webp","svg"].includes(ext)) return <ImageIcon size={16} className="text-emerald-500" />;
    if (["mp3","wav","aac","ogg"].includes(ext)) return <Music size={16} className="text-purple-500" />;
    if (["mp4","mov","avi","mkv"].includes(ext)) return <Video size={16} className="text-blue-500" />;
    if (["zip","rar","7z","tar"].includes(ext)) return <Archive size={16} className="text-amber-500" />;
    if (["pdf"].includes(ext)) return <FileText size={16} className="text-red-500" />;
    return <File size={16} className="text-slate-400" />;
}

function formatDate(str: string) {
    try {
        return new Date(str).toLocaleDateString("es-PR", { year: "numeric", month: "short", day: "numeric" });
    } catch { return str; }
}

// --- Props --------------------------------------------------------
interface Props {
    projectId?: string;
    userRole?: string;
}

export default function ProjectFilesExplorer({ projectId, userRole }: Props) {
    const [docs, setDocs] = useState<DocRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["photos", "project", "general"]));
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedSection, setSelectedSection] = useState(userRole === 'F' ? "project" : "general");
    const [selectedDoc, setSelectedDoc] = useState<DocRecord | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);
    const [showNewFolderModal, setShowNewFolderModal] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [uploadQueue, setUploadQueue] = useState<File[]>([]);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<Record<string, 'pending' | 'uploading' | 'done' | 'error'>>({});
    const [uploadSummary, setUploadSummary] = useState<{ ok: number; fail: number } | null>(null);

    useEffect(() => {
        if (projectId) fetchDocs();
        setSelectedDoc(null);
        setPreviewUrl(null);
    }, [projectId]);

    useEffect(() => {
        if (selectedDoc?.storage_path) {
            generatePreviewUrl(selectedDoc.storage_path);
        } else {
            setPreviewUrl(null);
        }
    }, [selectedDoc]);

    const generatePreviewUrl = async (path: string) => {
        setPreviewLoading(true);
        try {
            const { data, error } = await supabase.storage
                .from("project-documents")
                .createSignedUrl(path, 3600);
            if (error) throw error;
            setPreviewUrl(data.signedUrl);
        } catch (err) {
            console.error("Error generating preview URL:", err);
            setPreviewUrl(null);
        } finally {
            setPreviewLoading(false);
        }
    };

    const fetchDocs = async () => {
        if (!projectId) return;
        setLoading(true);
        const { data } = await supabase
            .from("project_documents")
            .select("*")
            .eq("project_id", projectId)
            .order("uploaded_at", { ascending: false });
        if (data) setDocs(data as DocRecord[]);
        setLoading(false);
    };

    const toggleSection = (id: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSelectFiles = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const fileArray = Array.from(files);
        setUploadQueue(fileArray);
        const initialProgress: Record<string, 'pending' | 'uploading' | 'done' | 'error'> = {};
        fileArray.forEach(f => { initialProgress[f.name + f.size] = 'pending'; });
        setUploadProgress(initialProgress);
        setUploadSummary(null);
        setShowUploadModal(true);
        // Resetear el input para que se puedan volver a seleccionar los mismos archivos
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleUpload = async () => {
        if (!uploadQueue.length || !projectId) return;
        setUploading(true);
        let ok = 0; let fail = 0;

        for (const file of uploadQueue) {
            const key = file.name + file.size;
            setUploadProgress(prev => ({ ...prev, [key]: 'uploading' }));
            try {
                const dateFolder = new Date().toISOString().split('T')[0];
                const timestamp = Date.now();
                const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
                const storagePath = `${projectId}/${selectedSection}/${dateFolder}/${timestamp}_${safeName}`;

                const { error: storageErr } = await supabase.storage.from("project-documents").upload(storagePath, file);
                const { error: dbErr } = await supabase.from("project_documents").insert({
                    project_id: projectId,
                    file_name: file.name,
                    doc_type: selectedSection,
                    section: selectedSection,
                    storage_path: storageErr ? null : storagePath,
                });

                if (!dbErr) {
                    ok++;
                    setUploadProgress(prev => ({ ...prev, [key]: 'done' }));
                    setExpandedSections(prev => new Set([...prev, selectedSection]));
                } else {
                    fail++;
                    setUploadProgress(prev => ({ ...prev, [key]: 'error' }));
                }
            } catch (err: any) {
                fail++;
                console.error("Upload error:", err);
                setUploadProgress(prev => ({ ...prev, [file.name + file.size]: 'error' }));
            }
        }

        setUploadSummary({ ok, fail });
        setUploading(false);
        if (ok > 0) await fetchDocs();
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Solo ocultar si el cursor sale del dropZone real
        if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
            setIsDragOver(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            handleSelectFiles(files);
        }
    };

    const handleDownload = async (doc: DocRecord) => {
        try {
            if (doc.storage_path) {
                const { data, error } = await supabase.storage.from("project-documents").download(doc.storage_path);
                if (error || !data) throw error;
                const url = URL.createObjectURL(data);
                const a = document.createElement("a");
                a.href = url;
                a.download = doc.file_name;
                a.click();
            }
        } catch (err: any) {
            alert("Error al descargar");
        }
    };

    const handleDelete = async (doc: DocRecord) => {
        if (!confirm(`Eliminar ${doc.file_name}?`)) return;
        try {
            if (doc.storage_path) await supabase.storage.from("project-documents").remove([doc.storage_path]);
            await supabase.from("project_documents").delete().eq("id", doc.id);
            await fetchDocs();
        } catch (err: any) {
            alert("Error al eliminar");
        }
    };

    const filtered = searchTerm ? docs.filter(d => d.file_name.toLowerCase().includes(searchTerm.toLowerCase())) : docs;

    const getDocsForSection = (sectionId: string) => {
        if (sectionId === "photos") {
            return filtered.filter(d => {
                const ext = (d.file_name.split(".").pop() || "").toLowerCase();
                return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
            });
        }
        return filtered.filter(d => (d.section || d.doc_type || "general") === sectionId);
    };

    const getSubfoldersForSection = (sectionId: string) => {
        if (sectionId === "photos") return [];
        const subfoldersSet = new Set<string>();
        docs.forEach(d => {
            const sec = d.section || d.doc_type || "general";
            if (sec.startsWith(sectionId + "/")) {
                const suffix = sec.substring(sectionId.length + 1);
                const firstPart = suffix.split("/")[0];
                if (firstPart) {
                    subfoldersSet.add(`${sectionId}/${firstPart}`);
                }
            }
        });
        return Array.from(subfoldersSet).map(path => {
            const parts = path.split("/");
            const name = parts[parts.length - 1];
            return { path, name };
        });
    };

    const handleDeleteSubfolder = async (subfolderPath: string) => {
        const parts = subfolderPath.split("/");
        const folderName = parts[parts.length - 1];
        if (!confirm(`¿Eliminar la carpeta "${folderName}" y todo su contenido? Esta acción no se puede deshacer.`)) return;
        
        setLoading(true);
        try {
            const docsToDelete = docs.filter(d => {
                const sec = d.section || d.doc_type || "general";
                return sec === subfolderPath || sec.startsWith(subfolderPath + "/");
            });

            const pathsToRemove = docsToDelete
                .map(d => d.storage_path)
                .filter((p): p is string => p !== null);
            
            if (pathsToRemove.length > 0) {
                const { error: storageErr } = await supabase.storage.from("project-documents").remove(pathsToRemove);
                if (storageErr) console.error("Error removing subfolder files from storage:", storageErr);
            }

            const idsToRemove = docsToDelete.map(d => d.id);
            if (idsToRemove.length > 0) {
                const { error: dbErr } = await supabase.from("project_documents").delete().in("id", idsToRemove);
                if (dbErr) throw dbErr;
            }

            await fetchDocs();
            setSelectedDoc(null);
            setPreviewUrl(null);
            
            if (selectedSection === subfolderPath || selectedSection.startsWith(subfolderPath + "/")) {
                const parentPath = subfolderPath.substring(0, subfolderPath.lastIndexOf("/"));
                setSelectedSection(parentPath || "general");
            }
        } catch (err: any) {
            console.error("Error deleting subfolder:", err);
            alert("Error al eliminar la carpeta");
        } finally {
            setLoading(false);
        }
    };

    const getSectionCount = (sectionId: string) => {
        if (sectionId === "photos") {
            return docs.filter(d => {
                const ext = (d.file_name.split(".").pop() || "").toLowerCase();
                return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
            }).length;
        }
        return docs.filter(d => {
            const sec = d.section || d.doc_type || "general";
            return (sec === sectionId || sec.startsWith(sectionId + "/")) && d.file_name !== ".keep";
        }).length;
    };

    const totalFiles = docs.length;
    
    const customSectionsFromDocs = Array.from(new Set(docs.map(d => d.section))).filter(s => s && !s.includes("/") && !PROJECT_SECTIONS.find(ps => ps.id === s));
    const allSections = [
        ...PROJECT_SECTIONS,
        ...customSectionsFromDocs.map(s => ({ id: s, label: s, bucket: "project-documents" }))
    ];
    
    const availableSections = userRole === 'F' 
        ? allSections.filter(s => !["general", "presentations", "logs", "inspection", "force", "liquidation", "ccml", "update-tables", "personnel"].includes(s.id)) 
        : userRole === 'E'
        ? allSections.filter(s => s.id === "photos" || s.id === "logs")
        : allSections;

    const isPreviewable = (fileName: string) => {
        if (!fileName) return false;
        const ext = fileName.split(".").pop()?.toLowerCase() || "";
        return ["pdf", "jpg", "jpeg", "png", "webp", "gif"].includes(ext);
    };

    if (!projectId) return <div className="p-10 font-bold">Guarde el proyecto.</div>;

    const currentSectionDocs = getDocsForSection(selectedSection).filter(d => d.file_name !== ".keep");

    const handleCreateFolder = async () => {
        const cleanName = newFolderName.trim().replace(/[/\\?%*:|"<>]/g, '-');
        if (!cleanName || !projectId) return;

        if (selectedSection === "photos") {
            alert("No se pueden crear subcarpetas dentro de la Galería de Fotos.");
            return;
        }

        const folderId = `${selectedSection}/${cleanName}`;
        
        // Validar si ya existe la subcarpeta en esta sección
        const alreadyExists = docs.some(d => {
            const sec = d.section || d.doc_type || "general";
            return sec.toLowerCase() === folderId.toLowerCase();
        });
        
        if (alreadyExists) {
            alert("Ya existe un folder con este nombre en la ubicación actual.");
            return;
        }

        try {
            const { error } = await supabase.from("project_documents").insert({
                project_id: projectId,
                file_name: ".keep",
                doc_type: folderId,
                section: folderId,
                storage_path: null,
            });
            if (error) throw error;
            await fetchDocs();
            setNewFolderName("");
            setShowNewFolderModal(false);
            setSelectedSection(folderId);
        } catch(err) {
            alert("Error creando folder");
        }
    };

    return (
        <div className="w-full flex flex-col h-[800px] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
            {/* Top Toolbar */}
            <div className="bg-[#F8FAFC] dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-3 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                        <button onClick={fetchDocs} disabled={loading} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-600 transition-colors" title="Actualizar">
                            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                        </button>
                        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1"></div>
                        <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex items-center gap-2 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 rounded-lg transition-colors font-bold text-xs">
                            <Upload size={16} />
                            {uploading ? "Subiendo..." : "Subir Archivos"}
                        </button>
                        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => handleSelectFiles(e.target.files)} />
                    </div>
                </div>
                
                <div className="flex-1 max-w-xl flex items-center gap-2">
                    <div className="flex-1 flex items-center px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-600 overflow-x-auto whitespace-nowrap">
                        <FolderOpen size={14} className="text-amber-500 mr-2 shrink-0" />
                        <span className="font-medium text-slate-400 shrink-0">Proyecto</span>
                        {(() => {
                            const parts = selectedSection.split("/");
                            let currentPath = "";
                            return parts.map((part, idx) => {
                                const isLast = idx === parts.length - 1;
                                if (idx === 0) {
                                    currentPath = part;
                                    const sectionObj = allSections.find(s => s.id === part);
                                    const label = sectionObj ? sectionObj.label : part;
                                    return (
                                        <React.Fragment key={currentPath}>
                                            <ChevronRight size={14} className="mx-1 text-slate-400 shrink-0" />
                                            {isLast ? (
                                                <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[150px]" title={label}>
                                                    {label}
                                                </span>
                                            ) : (
                                                <button 
                                                    onClick={() => {
                                                        setSelectedSection(part);
                                                        setSelectedDoc(null);
                                                        setPreviewUrl(null);
                                                    }}
                                                    className="font-medium text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[150px]"
                                                    title={label}
                                                >
                                                    {label}
                                                </button>
                                            )}
                                        </React.Fragment>
                                    );
                                } else {
                                    currentPath = `${currentPath}/${part}`;
                                    const label = part;
                                    const thisPath = currentPath;
                                    return (
                                        <React.Fragment key={thisPath}>
                                            <ChevronRight size={14} className="mx-1 text-slate-400 shrink-0" />
                                            {isLast ? (
                                                <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[150px]" title={label}>
                                                    {label}
                                                </span>
                                            ) : (
                                                <button 
                                                    onClick={() => {
                                                        setSelectedSection(thisPath);
                                                        setSelectedDoc(null);
                                                        setPreviewUrl(null);
                                                    }}
                                                    className="font-medium text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[150px]"
                                                    title={label}
                                                >
                                                    {label}
                                                </button>
                                            )}
                                        </React.Fragment>
                                    );
                                }
                            });
                        })()}
                    </div>
                    <div className="relative w-64 shrink-0">
                        <input 
                            type="text" 
                            placeholder="Buscar archivo..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className="w-full pl-8 pr-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                </div>
            </div>

            <div className="flex flex-1 min-h-0">
                {/* Left Sidebar */}
                <div className="w-64 bg-[#F8FAFC] dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-800 overflow-y-auto p-2">
                    <div className="space-y-0.5">
                        {availableSections.map(section => {
                            const count = getSectionCount(section.id);
                            const isSelected = selectedSection === section.id || selectedSection.startsWith(section.id + "/");
                            return (
                                <button 
                                    key={section.id} 
                                    onClick={() => {
                                        setSelectedSection(section.id);
                                        setSelectedDoc(null);
                                        setPreviewUrl(null);
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors text-left ${isSelected ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold' : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                                >
                                    <div className="flex items-center gap-2 truncate">
                                        <Folder size={16} className={isSelected ? "text-blue-500 fill-blue-500/20" : "text-amber-500 fill-amber-500"} />
                                        <span className="truncate">{section.label}</span>
                                    </div>
                                    {count > 0 && <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-200' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>{count}</span>}
                                </button>
                            );
                        })}
                    </div>
                    
                    {/* Add Folder Button */}
                    <div className="p-3 mt-2 border-t border-slate-200 dark:border-slate-800">
                        <button 
                            onClick={() => setShowNewFolderModal(true)}
                            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors font-semibold"
                        >
                            <FolderPlus size={16} className="text-emerald-500" />
                            Nuevo Folder
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div 
                    ref={dropZoneRef}
                    className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-950 relative"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <div className="flex-1 overflow-y-auto p-4">
                        {/* Drag & Drop Overlay */}
                        {isDragOver && (
                            <div className="absolute inset-0 z-50 bg-blue-500/10 border-4 border-dashed border-blue-400 rounded-xl flex flex-col items-center justify-center pointer-events-none backdrop-blur-[2px]">
                                <div className="bg-white dark:bg-slate-900 rounded-2xl px-8 py-6 shadow-2xl flex flex-col items-center gap-3 border border-blue-200 dark:border-blue-800">
                                    <Upload size={40} className="text-blue-500 animate-bounce" />
                                    <p className="text-lg font-black text-blue-600">Soltar archivos aquí</p>
                                    <p className="text-xs text-blue-400 font-medium">Se subirán a: <span className="font-black">{availableSections.find(s => s.id === selectedSection)?.label || "carpeta seleccionada"}</span></p>
                                </div>
                            </div>
                        )}
                        {(() => {
                            const currentSubfolders = getSubfoldersForSection(selectedSection);
                            const hasItems = currentSectionDocs.length > 0 || currentSubfolders.length > 0;

                            if (!hasItems) {
                                return (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                        <FolderOpen size={48} className="text-slate-200 dark:text-slate-800 mb-4" />
                                        <p className="text-sm font-bold">Esta carpeta está vacía</p>
                                        <p className="text-xs mt-1">Arrastre archivos aquí o use el botón Subir Archivos</p>
                                    </div>
                                );
                            }

                            return (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 content-start">
                                    {/* Renderizar Subcarpetas */}
                                    {currentSubfolders.map(sub => (
                                        <div 
                                            key={sub.path} 
                                            onDoubleClick={() => {
                                                setSelectedSection(sub.path);
                                                setSelectedDoc(null);
                                                setPreviewUrl(null);
                                            }}
                                            className="group relative flex flex-col items-center p-3 rounded-lg border-2 border-transparent cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700"
                                        >
                                            <div className="w-16 h-16 flex items-center justify-center mb-2 bg-amber-50 dark:bg-amber-950/20 rounded-xl group-hover:scale-105 transition-transform">
                                                <Folder size={32} className="text-amber-500 fill-amber-500/20" />
                                            </div>
                                            <span className="text-[11px] text-center font-bold text-slate-700 dark:text-slate-300 w-full truncate px-1" title={sub.name}>
                                                {sub.name}
                                            </span>
                                            <span className="text-[9px] text-slate-400 mt-1">Carpeta</span>
                                            
                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                                                <button onClick={(e) => { e.stopPropagation(); handleDeleteSubfolder(sub.path); }} className="p-1.5 bg-white dark:bg-slate-700 rounded-md shadow-sm text-slate-600 hover:text-red-500" title="Eliminar Carpeta">
                                                    <Trash2 size={12}/>
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Renderizar Archivos */}
                                    {currentSectionDocs.map(doc => {
                                        const isSelected = selectedDoc?.id === doc.id;
                                        return (
                                            <div 
                                                key={doc.id} 
                                                onClick={() => setSelectedDoc(doc)}
                                                onDoubleClick={() => {
                                                    if (!isPreviewable(doc.file_name)) {
                                                        handleDownload(doc);
                                                    }
                                                }}
                                                className={`group relative flex flex-col items-center p-3 rounded-lg border-2 border-transparent cursor-pointer transition-all ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50 shadow-sm' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700'}`}
                                            >
                                                <div className="w-16 h-16 flex items-center justify-center mb-2 bg-slate-100 dark:bg-slate-800 rounded-xl group-hover:scale-105 transition-transform">
                                                    {React.cloneElement(getFileIcon(doc.file_name) as React.ReactElement<any>, { size: 32 })}
                                                </div>
                                                <span className="text-[11px] text-center font-medium text-slate-700 dark:text-slate-300 w-full truncate px-1" title={doc.file_name}>
                                                    {doc.file_name}
                                                </span>
                                                <span className="text-[9px] text-slate-400 mt-1">{formatDate(doc.uploaded_at)}</span>
                                                
                                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                                                    <button onClick={(e) => { e.stopPropagation(); handleDownload(doc); }} className="p-1.5 bg-white dark:bg-slate-700 rounded-md shadow-sm text-slate-600 hover:text-blue-500" title="Descargar"><Download size={12}/></button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(doc); }} className="p-1.5 bg-white dark:bg-slate-700 rounded-md shadow-sm text-slate-600 hover:text-red-500" title="Eliminar"><Trash2 size={12}/></button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>
                </div>

                {/* Preview Panel (Right Side) */}
                {selectedDoc && (
                    <div className="w-80 bg-slate-50 dark:bg-slate-900/80 border-l border-slate-200 dark:border-slate-800 flex flex-col">
                        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
                            <h3 className="text-sm font-bold truncate pr-2">Detalles</h3>
                            <button onClick={() => setSelectedDoc(null)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full text-slate-500">
                                <X size={16} />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 flex flex-col">
                            <div className="w-full aspect-square bg-slate-200 dark:bg-slate-950 rounded-xl mb-4 overflow-hidden flex items-center justify-center relative shadow-inner border border-slate-300 dark:border-slate-800">
                                {previewLoading ? (
                                    <Loader2 className="animate-spin text-blue-500" size={24} />
                                ) : previewUrl && isPreviewable(selectedDoc.file_name) ? (
                                    selectedDoc.file_name.toLowerCase().endsWith('.pdf') ? 
                                    <iframe src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0`} className="w-full h-full border-0 pointer-events-none" /> : 
                                    <img src={previewUrl} className="w-full h-full object-cover" />
                                ) : (
                                    React.cloneElement(getFileIcon(selectedDoc.file_name) as React.ReactElement<any>, { size: 64, className: "opacity-20" })
                                )}
                                
                                {previewUrl && (
                                    <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="absolute bottom-2 right-2 p-2 bg-black/50 hover:bg-black/80 text-white rounded-lg backdrop-blur-sm transition-colors" title="Abrir en pestaña nueva">
                                        <ExternalLink size={14} />
                                    </a>
                                )}
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 break-words leading-tight">{selectedDoc.file_name}</h4>
                                </div>
                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
                                        <span className="text-slate-500 font-medium">Tipo</span>
                                        <span className="text-slate-800 dark:text-slate-300 font-bold uppercase">{selectedDoc.file_name.split(".").pop()}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
                                        <span className="text-slate-500 font-medium">Carpeta</span>
                                        <span className="text-slate-800 dark:text-slate-300 font-bold">{availableSections.find(s => s.id === selectedDoc.section)?.label || selectedDoc.section}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
                                        <span className="text-slate-500 font-medium">Subido</span>
                                        <span className="text-slate-800 dark:text-slate-300 font-bold">{formatDate(selectedDoc.uploaded_at)}</span>
                                    </div>
                                </div>

                                <div className="pt-4 flex gap-2">
                                    <button onClick={() => handleDownload(selectedDoc)} className="flex-1 btn-primary py-2 px-0 text-xs flex justify-center items-center gap-2">
                                        <Download size={14} /> Descargar
                                    </button>
                                    <button onClick={() => handleDelete(selectedDoc)} className="p-2 border border-red-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal for New Folder */}
            {showNewFolderModal && (
                <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] shadow-2xl p-6 border border-slate-100 dark:border-slate-800">
                        <h2 className="text-xl font-black mb-4 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                            <FolderPlus className="text-emerald-500" /> Nuevo Folder
                        </h2>
                        <input 
                            type="text" 
                            placeholder="Nombre del folder..." 
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6 font-medium text-slate-800 dark:text-slate-200"
                            autoFocus
                        />
                        <div className="flex gap-3">
                            <button onClick={() => setShowNewFolderModal(false)} className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-all">Cancelar</button>
                            <button onClick={handleCreateFolder} className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-md">Crear</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Carga Múltiple de Archivos */}
            {showUploadModal && (
                <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[80vh]">
                        {/* Header del modal */}
                        <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-50 dark:bg-blue-950 rounded-2xl flex items-center justify-center">
                                    <Upload size={20} className="text-blue-500" />
                                </div>
                                <div>
                                    <h2 className="text-base font-black text-slate-800 dark:text-slate-200">Subir Archivos</h2>
                                    <p className="text-xs text-slate-400 font-medium">{uploadQueue.length} archivo{uploadQueue.length !== 1 ? 's' : ''} seleccionado{uploadQueue.length !== 1 ? 's' : ''}</p>
                                </div>
                            </div>
                            {!uploading && (
                                <button onClick={() => { setShowUploadModal(false); setUploadQueue([]); setUploadSummary(null); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400">
                                    <X size={18} />
                                </button>
                            )}
                        </div>

                        {/* Lista de archivos con progreso */}
                        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
                            {uploadQueue.map((file) => {
                                const key = file.name + file.size;
                                const status = uploadProgress[key] || 'pending';
                                const ext = (file.name.split('.').pop() || '').toLowerCase();
                                const sizeKB = (file.size / 1024).toFixed(1);
                                return (
                                    <div key={key} className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${
                                        status === 'done'      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800' :
                                        status === 'error'     ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800' :
                                        status === 'uploading' ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800' :
                                        'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                                    }`}>
                                        <div className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
                                            {React.cloneElement(getFileIcon(file.name) as React.ReactElement<any>, { size: 18 })}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate" title={file.name}>{file.name}</p>
                                            <p className="text-[10px] text-slate-400">{sizeKB} KB · {ext.toUpperCase()}</p>
                                        </div>
                                        <div className="shrink-0">
                                            {status === 'pending'   && <span className="text-[10px] font-bold text-slate-400 uppercase">En espera</span>}
                                            {status === 'uploading' && <Loader2 size={16} className="animate-spin text-blue-500" />}
                                            {status === 'done'      && <span className="text-[10px] font-black text-emerald-600 uppercase">✓ Listo</span>}
                                            {status === 'error'     && <span className="text-[10px] font-black text-red-500 uppercase">✗ Error</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Resumen final */}
                        {uploadSummary && (
                            <div className={`mx-6 mb-4 p-3 rounded-2xl text-sm font-bold text-center ${uploadSummary.fail === 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'}`}>
                                {uploadSummary.fail === 0
                                    ? `✓ ${uploadSummary.ok} archivo${uploadSummary.ok !== 1 ? 's' : ''} subido${uploadSummary.ok !== 1 ? 's' : ''} correctamente`
                                    : `${uploadSummary.ok} subido${uploadSummary.ok !== 1 ? 's' : ''} · ${uploadSummary.fail} con error`
                                }
                            </div>
                        )}

                        {/* Botones de acción */}
                        <div className="px-6 pb-6 flex gap-3">
                            {!uploadSummary ? (
                                <>
                                    <button
                                        onClick={() => { setShowUploadModal(false); setUploadQueue([]); }}
                                        disabled={uploading}
                                        className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleUpload}
                                        disabled={uploading}
                                        className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-md disabled:opacity-60 flex items-center justify-center gap-2"
                                    >
                                        {uploading ? <><Loader2 size={16} className="animate-spin" /> Subiendo...</> : <><Upload size={16} /> Subir {uploadQueue.length} Archivo{uploadQueue.length !== 1 ? 's' : ''}</>}
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => { setShowUploadModal(false); setUploadQueue([]); setUploadSummary(null); }}
                                    className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-md"
                                >
                                    Cerrar
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
