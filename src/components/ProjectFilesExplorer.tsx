"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
    FolderOpen, Folder, FileText, Download, Upload, Trash2,
    Search, ChevronRight, ChevronDown, RefreshCw, File,
    Image as ImageIcon, Music, Video, Archive, AlertCircle, Info
} from "lucide-react";

// ─── Secciones del proyecto ────────────────────────────────────────
const PROJECT_SECTIONS = [
    { id: "project",    label: "1. Datos del Proyecto",    bucket: "project-documents" },
    { id: "personnel",  label: "2. Firmas ACT",            bucket: "project-documents" },
    { id: "items",      label: "3. Partidas",              bucket: "project-documents" },
    { id: "materials",  label: "4. Materiales (MOS)",      bucket: "project-documents" },
    { id: "compliance", label: "5. Cumplimiento",          bucket: "project-documents" },
    { id: "cho",        label: "6. Change Orders",         bucket: "project-documents" },
    { id: "payment",    label: "7. Certificaciones Pago",  bucket: "project-documents" },
    { id: "mfg",        label: "8. Certificados CM",       bucket: "project-documents" },
    { id: "minutes",    label: "9. Minutas",               bucket: "project-documents" },
    { id: "logs",       label: "10. Informes de Actividades", bucket: "project-documents" },
    { id: "inspection", label: "11. Inspección",           bucket: "project-documents" },
    { id: "force",      label: "12. Force Account",        bucket: "project-documents" },
    { id: "liquidation",label: "13. Liquidación",          bucket: "project-documents" },
    { id: "presentations", label: "14. Presentaciones",      bucket: "project-documents" },
    { id: "general",    label: "General / Sin clasificar", bucket: "project-documents" },
    { id: "photos",     label: "📸 Galería de Fotos",       bucket: "project-documents" },
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

function formatFileSize(bytes?: number) {
    if (!bytes) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function formatDate(str: string) {
    try {
        return new Date(str).toLocaleDateString("es-PR", { year: "numeric", month: "short", day: "numeric" });
    } catch { return str; }
}

// ─── Props ────────────────────────────────────────────────────────
interface Props {
    projectId?: string;
}

export default function ProjectFilesExplorer({ projectId }: Props) {
    const [docs, setDocs] = useState<DocRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["photos", "project", "general"]));
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedSection, setSelectedSection] = useState("general");
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (projectId) fetchDocs();
    }, [projectId]);

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

    const handleUpload = async (files: FileList | null) => {
        if (!files || !projectId) return;
        setUploading(true);
        let uploaded = 0;

        for (const file of Array.from(files)) {
            try {
                const dateFolder = new Date().toISOString().split('T')[0];
                const timestamp = Date.now();
                // Normalizar tildes/acentos y limpiar para Supabase Storage (no acepta caracteres no-ASCII)
                const safeName = file.name
                    .normalize('NFD')                          // descompone tildes: é → e + ́
                    .replace(/[\u0300-\u036f]/g, '')           // elimina marcas diacríticas
                    .replace(/[^a-zA-Z0-9._-]/g, '_');         // reemplaza todo lo demás con _
                const storagePath = `${projectId}/${selectedSection}/${dateFolder}/${timestamp}_${safeName}`;

                // 1. Subir al bucket de storage
                const { error: storageErr } = await supabase.storage
                    .from("project-documents")
                    .upload(storagePath, file);

                // 2. Registrar en base de datos (aunque falle storage)
                const { error: dbErr } = await supabase.from("project_documents").insert({
                    project_id: projectId,
                    file_name: file.name,
                    doc_type: selectedSection,
                    section: selectedSection,
                    storage_path: storageErr ? null : storagePath,
                });

                if (!dbErr) {
                    uploaded++;
                    // Auto-expandir la sección donde se subió
                    setExpandedSections(prev => new Set([...prev, selectedSection]));
                } else {
                    console.error("DB error:", dbErr.message);
                }
            } catch (err: any) {
                console.error("Upload error:", err);
            }
        }

        if (uploaded > 0) {
            alert(`✓ ${uploaded} archivo(s) subido(s) a la sección "${PROJECT_SECTIONS.find(s => s.id === selectedSection)?.label}"`);
            await fetchDocs();
        } else {
            alert("No se pudo subir el archivo. Verifique su conexión.");
        }
        setUploading(false);
    };

    const handleDownload = async (doc: DocRecord) => {
        try {
            if (doc.storage_path) {
                // Descargar desde Supabase Storage
                const { data, error } = await supabase.storage
                    .from("project-documents")
                    .download(doc.storage_path);

                if (error || !data) {
                    alert("No se pudo descargar el archivo desde el servidor. Es posible que haya sido subido con una versión anterior del sistema.");
                    return;
                }

                const url = URL.createObjectURL(data);
                const a = document.createElement("a");
                a.href = url;
                a.download = doc.file_name;
                a.click();
                URL.revokeObjectURL(url);
            } else {
                alert(`El archivo "${doc.file_name}" fue registrado sin contenido descargable (subido con una versión anterior del sistema).`);
            }
        } catch (err: any) {
            alert("Error al descargar: " + err.message);
        }
    };

    const handleDelete = async (doc: DocRecord) => {
        if (!confirm(`¿Eliminar el archivo "${doc.file_name}"? Esta acción no se puede deshacer.`)) return;

        try {
            // Eliminar de storage si tiene ruta
            if (doc.storage_path) {
                await supabase.storage.from("project-documents").remove([doc.storage_path]);
            }
            // Eliminar de base de datos
            await supabase.from("project_documents").delete().eq("id", doc.id);
            setDocs(prev => prev.filter(d => d.id !== doc.id));
        } catch (err: any) {
            alert("Error al eliminar: " + err.message);
        }
    };

    // ─── Filtrar docs por búsqueda ───────────────────────────────
    const filtered = searchTerm
        ? docs.filter(d => d.file_name.toLowerCase().includes(searchTerm.toLowerCase()))
        : docs;

    const getDocsForSection = (sectionId: string) => {
        if (sectionId === "photos") {
            // Esta sección es una vista agregada de todas las fotos subidas en cualquier sección
            return filtered.filter(d => {
                const ext = (d.file_name.split(".").pop() || "").toLowerCase();
                return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
            });
        }
        return filtered.filter(d => (d.section || d.doc_type || "general") === sectionId);
    };

    const totalFiles = docs.length;
    const sectionsWithFiles = PROJECT_SECTIONS.filter(s => getDocsForSection(s.id).length > 0);

    if (!projectId) {
        return (
            <div className="flex items-center justify-center p-20 text-slate-400">
                <AlertCircle size={24} className="mr-2" />
                <span className="font-bold">Guarde el proyecto primero para gestionar archivos.</span>
            </div>
        );
    }

    return (
        <div className="w-full space-y-6">
            {/* ── Sticky Header ─────────────────────────────────── */}
            <div className="sticky top-0 z-40 bg-[#F8FAFC]/95 dark:bg-[#020617]/95 backdrop-blur-md pt-6 pb-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                        <FolderOpen className="text-amber-500" size={26} />
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Explorador de Archivos</h2>
                            <p className="text-xs text-slate-400">{totalFiles} archivo(s) en {sectionsWithFiles.length} sección(es)</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Selector de sección */}
                        <select
                            value={selectedSection}
                            onChange={e => setSelectedSection(e.target.value)}
                            className="input-field text-xs py-2 px-3 max-w-[200px]"
                        >
                            {PROJECT_SECTIONS.map(s => (
                                <option key={s.id} value={s.id}>{s.label}</option>
                            ))}
                        </select>

                        {/* Botón Subir */}
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="btn-primary text-xs py-2 px-4"
                        >
                            <Upload size={16} />
                            {uploading ? "Subiendo..." : "Subir Archivo(s)"}
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            className="hidden"
                            onChange={e => handleUpload(e.target.files)}
                            onClick={(e: any) => { e.target.value = null; }}
                        />

                        {/* Refrescar */}
                        <button
                            onClick={fetchDocs}
                            disabled={loading}
                            className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
                            title="Refrescar"
                        >
                            <RefreshCw size={16} className={`text-slate-500 ${loading ? "animate-spin" : ""}`} />
                        </button>
                    </div>
                </div>

                {/* Barra de búsqueda */}
                <div className="mt-4 relative">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar archivo por nombre..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="input-field pl-12 py-2.5 text-sm"
                    />
                </div>
            </div>

            {/* ── Árbol de secciones tipo Windows Explorer ─────── */}
            {loading ? (
                <div className="flex items-center justify-center p-16 text-slate-400">
                    <RefreshCw size={24} className="animate-spin mr-3" /> Cargando archivos...
                </div>
            ) : totalFiles === 0 && !searchTerm ? (
                <div className="flex flex-col items-center justify-center p-20 text-slate-400 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                    <FolderOpen size={48} className="mb-4 text-slate-300" />
                    <p className="font-bold text-lg">No hay archivos subidos aún</p>
                    <p className="text-sm mt-1">Seleccione una sección y haga clic en "Subir Archivo(s)"</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-4 rounded-2xl">
                        <p className="text-[11px] font-bold text-blue-700 dark:text-blue-300 flex items-center gap-2">
                            <Info size={14} /> 
                            <span>Para gestionar archivos: entra en la carpeta correspondiente. Puedes <b>descargar</b> (flecha azul) o <b>eliminar permanentemente</b> (papelera roja) cada documento.</span>
                        </p>
                    </div>
                    {PROJECT_SECTIONS.map(section => {
                        const sectionDocs = getDocsForSection(section.id);
                        const isExpanded = expandedSections.has(section.id);
                        const hasFiles = sectionDocs.length > 0;

                        // Mostrar todas las secciones si hay búsqueda, si no solo las que tienen archivos o están expandidas
                        if (!searchTerm && !hasFiles && !isExpanded) return null;

                        return (
                            <div key={section.id} className={`rounded-2xl border overflow-hidden transition-all ${hasFiles ? "border-slate-200 bg-white shadow-sm" : "border-dashed border-slate-200 bg-slate-50/50"}`}>
                                {/* ── Encabezado de sección ─── */}
                                <button
                                    onClick={() => toggleSection(section.id)}
                                    className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-all hover:bg-slate-50 ${hasFiles ? "font-bold" : "font-medium text-slate-400"}`}
                                >
                                    {isExpanded
                                        ? <ChevronDown size={16} className="text-slate-400 shrink-0" />
                                        : <ChevronRight size={16} className="text-slate-400 shrink-0" />
                                    }
                                    {hasFiles
                                        ? <FolderOpen size={18} className="text-amber-400 shrink-0" />
                                        : <Folder size={18} className="text-slate-300 shrink-0" />
                                    }
                                    <span className={`text-sm ${hasFiles ? "text-slate-700" : "text-slate-400"}`}>
                                        {section.label}
                                    </span>
                                    {hasFiles && (
                                        <span className="ml-auto bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-200">
                                            {sectionDocs.length} archivo{sectionDocs.length !== 1 ? "s" : ""}
                                        </span>
                                    )}
                                </button>

                                {/* ── Lista de archivos ─── */}
                                {isExpanded && (
                                    <div className="border-t border-slate-100">
                                        {sectionDocs.length === 0 ? (
                                            <p className="px-12 py-4 text-xs text-slate-400 italic">
                                                No hay archivos en esta sección. Selecciónela en el menú superior y haga clic en "Subir Archivo(s)".
                                            </p>
                                        ) : (
                                            <table className="w-full text-sm">
                                                <thead className="bg-slate-50 border-b border-slate-100">
                                                    <tr>
                                                        <th className="px-5 py-2 text-left text-[10px] font-black uppercase tracking-widest text-slate-400 pl-12">Archivo</th>
                                                        <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest text-slate-400 hidden md:table-cell">Fecha</th>
                                                        <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {sectionDocs.map(doc => (
                                                        <tr key={doc.id} className="hover:bg-blue-50/30 transition-colors group">
                                                            <td className="px-5 py-3 pl-12">
                                                                <div className="flex items-center gap-2.5">
                                                                    {getFileIcon(doc.file_name)}
                                                                    <span className="font-medium text-slate-700 truncate max-w-[300px]" title={doc.file_name}>
                                                                        {doc.file_name}
                                                                    </span>
                                                                    {!doc.storage_path && (
                                                                        <span className="text-[9px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-bold border border-amber-200">
                                                                            Sin contenido
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-3 text-xs text-slate-400 hidden md:table-cell whitespace-nowrap">
                                                                {formatDate(doc.uploaded_at)}
                                                            </td>
                                                            <td className="px-3 py-3 text-right">
                                                                <div className="flex items-center justify-end gap-1 opacity-100">
                                                                    <button
                                                                        onClick={() => handleDownload(doc)}
                                                                        disabled={!doc.storage_path}
                                                                        className="p-2 rounded-xl text-blue-500 hover:bg-blue-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                                                        title="Descargar"
                                                                    >
                                                                        <Download size={15} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDelete(doc)}
                                                                        className="p-2 rounded-xl text-red-400 hover:bg-red-50 transition-all"
                                                                        title="Eliminar"
                                                                    >
                                                                        <Trash2 size={15} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
