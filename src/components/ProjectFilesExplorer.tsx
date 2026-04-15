"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
    FolderOpen, Folder, FileText, Download, Upload, Trash2,
    Search, ChevronRight, ChevronDown, RefreshCw, File,
    Image as ImageIcon, Music, Video, Archive, AlertCircle, Info,
    Eye, X, ExternalLink, Loader2
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
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    const handleUpload = async (files: FileList | null) => {
        if (!files || !projectId) return;
        setUploading(true);
        let uploaded = 0;

        for (const file of Array.from(files)) {
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
                    uploaded++;
                    setExpandedSections(prev => new Set([...prev, selectedSection]));
                }
            } catch (err: any) {
                console.error("Upload error:", err);
            }
        }

        if (uploaded > 0) {
            alert(`Archivos subidos correctamente`);
            await fetchDocs();
        }
        setUploading(false);
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

    const totalFiles = docs.length;
    const availableSections = userRole === 'F' 
        ? PROJECT_SECTIONS.filter(s => !["general", "presentations", "logs", "inspection", "force", "liquidation", "ccml", "update-tables", "personnel"].includes(s.id)) 
        : userRole === 'E'
        ? PROJECT_SECTIONS.filter(s => s.id === "photos" || s.id === "logs")
        : PROJECT_SECTIONS;

    const isPreviewable = (fileName: string) => {
        if (!fileName) return false;
        const ext = fileName.split(".").pop()?.toLowerCase() || "";
        return ["pdf", "jpg", "jpeg", "png", "webp", "gif"].includes(ext);
    };

    if (!projectId) return <div className="p-10 font-bold">Guarde el proyecto.</div>;

    return (
        <div className="w-full">
            <div className="sticky top-0 z-40 bg-white dark:bg-slate-900 pt-6 pb-4 border-b mb-6">
                <div className="flex items-center justify-between flex-wrap gap-4 px-4 md:px-0">
                    <div className="flex items-center gap-3">
                        <FolderOpen size={26} />
                        <div>
                            <h2 className="text-2xl font-bold">Explorador de Archivos</h2>
                            <p className="text-xs text-slate-400">{totalFiles} archivos</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <select value={selectedSection} onChange={e => setSelectedSection(e.target.value)} className="input-field text-xs">
                            {availableSections.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                        <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-primary text-xs">
                             {uploading ? "Subiendo..." : "Subir"}
                        </button>
                        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => handleUpload(e.target.files)} />
                        <button onClick={fetchDocs} disabled={loading} className="p-2 border rounded-xl">
                            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                        </button>
                    </div>
                </div>
                <div className="mt-4 px-4 md:px-0">
                    <input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="input-field" />
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {selectedDoc && (
                    <div className="w-full lg:w-[60%] border rounded-3xl overflow-hidden h-[700px] flex flex-col">
                        <div className="px-6 py-4 bg-slate-50 border-b flex justify-between">
                            <span className="font-bold truncate">{selectedDoc.file_name}</span>
                            <button onClick={() => setSelectedDoc(null)}><X size={18} /></button>
                        </div>
                        <div className="flex-1 bg-slate-100 flex items-center justify-center overflow-auto">
                            {previewLoading ? <Loader2 className="animate-spin" /> : 
                             previewUrl && isPreviewable(selectedDoc.file_name) ? (
                                selectedDoc.file_name.toLowerCase().endsWith('.pdf') ? 
                                <iframe src={previewUrl} className="w-full h-full" /> : 
                                <img src={previewUrl} className="max-w-full max-h-full" />
                             ) : <div>Sin vista previa</div>
                            }
                        </div>
                    </div>
                )}
                <div className="flex-1">
                    {availableSections.map(section => {
                        const sectionDocs = getDocsForSection(section.id);
                        if (!searchTerm && sectionDocs.length === 0) return null;
                        return (
                            <div key={section.id} className="border rounded-2xl mb-4">
                                <button onClick={() => toggleSection(section.id)} className="w-full p-4 flex justify-between font-bold">
                                    <span>{section.label}</span>
                                    <span>{sectionDocs.length}</span>
                                </button>
                                {expandedSections.has(section.id) && (
                                    <div className="border-t">
                                        {sectionDocs.map(doc => (
                                            <div key={doc.id} onClick={() => setSelectedDoc(doc)} className="p-3 border-b hover:bg-slate-50 cursor-pointer flex justify-between">
                                                <span>{doc.file_name}</span>
                                                <div className="flex gap-2">
                                                    <button onClick={(e) => { e.stopPropagation(); handleDownload(doc); }}><Download size={14}/></button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(doc); }}><Trash2 size={14}/></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
