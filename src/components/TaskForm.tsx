"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { getLocalStorageItem } from "@/lib/utils";
import {
    Save, X, Plus, Trash2, Link2, Paperclip, Upload, Loader2
} from "lucide-react";

const TASK_TYPES = ["Email", "Llamada", "Por contestar", "Reunión", "Seguimiento", "Documento", "Facturación", "Permiso", "RFI", "Submittal", "Otro"];
const TASK_STATUSES = ["Pendiente", "En Proceso", "Esperando Respuesta", "Completado", "Cancelado"];
const SUBPROJECT_OPTIONS = ["Diseño", "Construcción", "Facturación", "Utilities", "Permisos", "Semáforos", "Administrativo", "Legal", "Otro"];
const COMMON_TAGS = ["Cliente", "Facturación", "Utilidades", "Diseño", "Permisos", "Construcción", "Inspector", "Municipio", "ACT", "FHWA", "Subcontratista", "Contrato", "Reclamación"];
const REMINDER_OPTIONS = [
    { label: "El mismo día", value: "0" },
    { label: "1 día antes", value: "1" },
    { label: "3 días antes", value: "3" },
    { label: "1 semana antes", value: "7" },
    { label: "Fecha personalizada", value: "custom" },
];

type Project = { id: string; name: string; num_act: string };
type ReminderLink = { label: string; url: string };

type FormData = {
    title: string;
    description: string;
    project_id: string;
    subproject: string;
    urgency: number;
    type: string;
    status: string;
    due_date: string;
    due_time: string;
    reminder_option: string;
    reminder_custom_date: string;
    tags: string[];
    assignees: string[];
    links: ReminderLink[];
};

const emptyForm: FormData = {
    title: "", description: "", project_id: "", subproject: "",
    urgency: 2, type: "Seguimiento", status: "Pendiente",
    due_date: "", due_time: "", reminder_option: "1",
    reminder_custom_date: "", tags: [], assignees: [], links: [],
};

type Props = {
    reminderId?: string | null;
    onSaved: () => void;
    onCancel: () => void;
};

export default function TaskForm({ reminderId, onSaved, onCancel }: Props) {
    const [form, setForm] = useState<FormData>(emptyForm);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [newTag, setNewTag] = useState("");
    const [newAssignee, setNewAssignee] = useState("");
    const [newLink, setNewLink] = useState<ReminderLink>({ label: "", url: "" });
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState("");
    const [attachments, setAttachments] = useState<any[]>([]);
    const [uploadingFile, setUploadingFile] = useState(false);

    // Cargar proyectos
    useEffect(() => {
        const fetchProjects = async () => {
            const { data } = await supabase.from("projects").select("id, name, num_act").order("name");
            if (data) setProjects(data);
        };
        fetchProjects();
    }, []);

    // Si viene un reminderId, cargar sus datos
    useEffect(() => {
        if (!reminderId) { setForm(emptyForm); return; }
        const load = async () => {
            setLoading(true);
            const [rRes, aRes, lRes, cRes, attRes] = await Promise.all([
                supabase.from("reminders").select("*").eq("id", reminderId).single(),
                supabase.from("reminder_assignees").select("*").eq("reminder_id", reminderId),
                supabase.from("reminder_links").select("*").eq("reminder_id", reminderId),
                supabase.from("reminder_comments").select("*").eq("reminder_id", reminderId).order("created_at"),
                supabase.from("reminder_attachments").select("*").eq("reminder_id", reminderId).order("created_at"),
            ]);
            if (rRes.data) {
                const r = rRes.data;
                const dueDate = r.due_date ? new Date(r.due_date) : null;
                setForm({
                    title: r.title || "",
                    description: r.description || "",
                    project_id: r.project_id || "",
                    subproject: r.subproject || "",
                    urgency: r.urgency || 2,
                    type: r.type || "Seguimiento",
                    status: r.status || "Pendiente",
                    due_date: dueDate ? dueDate.toISOString().split("T")[0] : "",
                    due_time: dueDate ? dueDate.toTimeString().slice(0, 5) : "",
                    reminder_option: "1",
                    reminder_custom_date: "",
                    tags: r.tags || [],
                    assignees: (aRes.data || []).map((a: any) => a.assignee_name),
                    links: (lRes.data || []).map((l: any) => ({ label: l.label, url: l.url })),
                });
                setComments(cRes.data || []);
                setAttachments(attRes.data || []);
            }
            setLoading(false);
        };
        load();
    }, [reminderId]);

    const setField = (field: keyof FormData, value: any) => setForm(prev => ({ ...prev, [field]: value }));

    const addTag = (tag: string) => {
        const t = tag.trim();
        if (t && !form.tags.includes(t)) setField("tags", [...form.tags, t]);
        setNewTag("");
    };
    const removeTag = (t: string) => setField("tags", form.tags.filter(x => x !== t));

    const addAssignee = () => {
        const a = newAssignee.trim();
        if (a && !form.assignees.includes(a)) setField("assignees", [...form.assignees, a]);
        setNewAssignee("");
    };
    const removeAssignee = (a: string) => setField("assignees", form.assignees.filter(x => x !== a));

    const addLink = () => {
        if (newLink.url.trim()) {
            setField("links", [...form.links, { label: newLink.label || newLink.url, url: newLink.url }]);
            setNewLink({ label: "", url: "" });
        }
    };
    const removeLink = (i: number) => setField("links", form.links.filter((_, idx) => idx !== i));

    const handleSave = async () => {
        if (!form.title.trim()) { alert("El título del pendiente es requerido."); return; }
        setSaving(true);
        try {
            const registrationStr = getLocalStorageItem("pact_registration");
            let userName = "Usuario";
            let userEmail = "";
            try { 
                const parsed = JSON.parse(registrationStr || "{}");
                userName = parsed.name || "Usuario";
                userEmail = parsed.email || "";
            } catch {}

            // Calcular due_date
            let due_date: string | null = null;
            if (form.due_date) {
                const d = form.due_time ? `${form.due_date}T${form.due_time}:00` : `${form.due_date}T23:59:59`;
                due_date = new Date(d).toISOString();
            }

            // Calcular reminder_date
            let reminder_date: string | null = null;
            if (due_date && form.reminder_option !== "custom") {
                const rd = new Date(due_date);
                rd.setDate(rd.getDate() - parseInt(form.reminder_option));
                reminder_date = rd.toISOString();
            } else if (form.reminder_custom_date) {
                reminder_date = new Date(form.reminder_custom_date + "T08:00:00").toISOString();
            }

            const payload: any = {
                title: form.title.trim(),
                description: form.description.trim(),
                project_id: form.project_id || null,
                subproject: form.subproject || null,
                urgency: form.urgency,
                type: form.type,
                status: form.status,
                due_date,
                reminder_date,
                tags: form.tags,
                created_by: userName,
                user_email: userEmail,
                updated_at: new Date().toISOString(),
            };

            let rid = reminderId;
            if (rid) {
                await supabase.from("reminders").update(payload).eq("id", rid);
                // Limpiar y re-insertar relacionados
                await Promise.all([
                    supabase.from("reminder_assignees").delete().eq("reminder_id", rid),
                    supabase.from("reminder_links").delete().eq("reminder_id", rid),
                ]);
            } else {
                const { data: newR } = await supabase.from("reminders").insert({ ...payload, created_by: userName }).select().single();
                rid = newR?.id;
            }

            if (rid) {
                if (form.assignees.length > 0) {
                    await supabase.from("reminder_assignees").insert(form.assignees.map(a => ({ reminder_id: rid, assignee_name: a })));
                }
                if (form.links.length > 0) {
                    await supabase.from("reminder_links").insert(form.links.map(l => ({ reminder_id: rid, label: l.label, url: l.url })));
                }
            }
            onSaved();
        } catch (err: any) {
            console.error("Error guardando pendiente:", err);
            alert("Error al guardar: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleAddComment = async () => {
        if (!newComment.trim() || !reminderId) return;
        const registrationStr = getLocalStorageItem("pact_registration");
        let userName = "Usuario";
        try { userName = JSON.parse(registrationStr || "{}").name || "Usuario"; } catch {}
        const { data } = await supabase.from("reminder_comments").insert({
            reminder_id: reminderId,
            user_name: userName,
            comment: newComment.trim(),
        }).select().single();
        if (data) setComments(prev => [...prev, data]);
        setNewComment("");
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !reminderId) return;
        setUploadingFile(true);
        try {
            const registrationStr = getLocalStorageItem("pact_registration");
            let userName = "Usuario";
            try { userName = JSON.parse(registrationStr || "{}").name || "Usuario"; } catch {}
            const timestamp = Date.now();
            const safeName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
            const storagePath = `${reminderId}/${timestamp}_${safeName}`;
            const { error: upErr } = await supabase.storage.from("reminders-documents").upload(storagePath, file);
            if (upErr) throw upErr;
            const { data: urlData } = supabase.storage.from("reminders-documents").getPublicUrl(storagePath);
            const { data: att } = await supabase.from("reminder_attachments").insert({
                reminder_id: reminderId,
                file_name: file.name,
                file_url: urlData.publicUrl,
                storage_path: storagePath,
                uploaded_by: userName,
            }).select().single();
            if (att) setAttachments(prev => [...prev, att]);
        } catch (err: any) {
            alert("Error al subir archivo: " + err.message);
        } finally {
            setUploadingFile(false);
            e.target.value = "";
        }
    };

    const urgencyColor = form.urgency === 1 ? "bg-red-500" : form.urgency === 2 ? "bg-amber-400" : "bg-green-500";

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;

    return (
        <div className="space-y-6 pb-20">
            {/* Título */}
            <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Pendiente *</label>
                <input
                    type="text"
                    placeholder="Describe la acción requerida..."
                    className="w-full px-4 py-3 text-base font-semibold rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-blue-500 outline-none transition-colors"
                    value={form.title}
                    onChange={e => setField("title", e.target.value)}
                />
            </div>

            {/* Descripción */}
            <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Descripción Detallada</label>
                <textarea
                    rows={4}
                    placeholder="Contexto, detalles, historial..."
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-blue-500 outline-none transition-colors resize-none text-sm"
                    value={form.description}
                    onChange={e => setField("description", e.target.value)}
                />
            </div>

            {/* Fila: Proyecto + Área */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Proyecto</label>
                    <select
                        className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-blue-500 outline-none text-sm"
                        value={form.project_id}
                        onChange={e => setField("project_id", e.target.value)}
                    >
                        <option value="">General / No asociado</option>
                        {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.num_act} – {p.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Subproyecto / Área</label>
                    <select
                        className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-blue-500 outline-none text-sm"
                        value={form.subproject}
                        onChange={e => setField("subproject", e.target.value)}
                    >
                        <option value="">— Ninguna —</option>
                        {SUBPROJECT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                </div>
            </div>

            {/* Fila: Tipo + Estado */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Tipo</label>
                    <select
                        className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-blue-500 outline-none text-sm"
                        value={form.type}
                        onChange={e => setField("type", e.target.value)}
                    >
                        {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Estado</label>
                    <select
                        className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-blue-500 outline-none text-sm"
                        value={form.status}
                        onChange={e => setField("status", e.target.value)}
                    >
                        {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            {/* Urgencia */}
            <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Urgencia</label>
                <div className="flex gap-3">
                    {[
                        { val: 1, label: "Alta", color: "bg-red-500 text-white", ring: "ring-red-500" },
                        { val: 2, label: "Media", color: "bg-amber-400 text-white", ring: "ring-amber-400" },
                        { val: 3, label: "Baja", color: "bg-green-500 text-white", ring: "ring-green-500" },
                    ].map(u => (
                        <button
                            key={u.val}
                            type="button"
                            onClick={() => setField("urgency", u.val)}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${u.color} ${form.urgency === u.val ? `ring-2 ring-offset-2 ${u.ring} scale-105` : "opacity-40 hover:opacity-70"}`}
                        >
                            {u.val === 1 ? "🔴" : u.val === 2 ? "🟡" : "🟢"} {u.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Fecha y Hora de Vencimiento */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Fecha de Vencimiento</label>
                    <input
                        type="date"
                        className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-blue-500 outline-none text-sm"
                        value={form.due_date}
                        onChange={e => setField("due_date", e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Hora (Opcional)</label>
                    <input
                        type="time"
                        className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-blue-500 outline-none text-sm"
                        value={form.due_time}
                        onChange={e => setField("due_time", e.target.value)}
                    />
                </div>
            </div>

            {/* Recordatorio */}
            <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Recordatorio</label>
                <select
                    className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-blue-500 outline-none text-sm"
                    value={form.reminder_option}
                    onChange={e => setField("reminder_option", e.target.value)}
                >
                    {REMINDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {form.reminder_option === "custom" && (
                    <input
                        type="date"
                        className="mt-2 w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-blue-500 outline-none text-sm"
                        value={form.reminder_custom_date}
                        onChange={e => setField("reminder_custom_date", e.target.value)}
                    />
                )}
            </div>

            {/* Responsables */}
            <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Responsables</label>
                <div className="flex gap-2 mb-2">
                    <input
                        type="text"
                        placeholder="Nombre del responsable..."
                        className="flex-1 px-3 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none text-sm focus:border-blue-500"
                        value={newAssignee}
                        onChange={e => setNewAssignee(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addAssignee())}
                    />
                    <button type="button" onClick={addAssignee} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors">
                        <Plus size={16} />
                    </button>
                </div>
                {form.assignees.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {form.assignees.map(a => (
                            <span key={a} className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-xs font-semibold px-3 py-1.5 rounded-full">
                                👤 {a}
                                <button type="button" onClick={() => removeAssignee(a)} className="ml-1 hover:text-red-500"><X size={12} /></button>
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Etiquetas */}
            <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Etiquetas</label>
                <div className="flex flex-wrap gap-2 mb-2">
                    {COMMON_TAGS.map(tag => (
                        <button
                            key={tag}
                            type="button"
                            onClick={() => form.tags.includes(tag) ? removeTag(tag) : addTag(tag)}
                            className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold transition-colors ${form.tags.includes(tag) ? "bg-blue-600 text-white border-blue-600" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400"}`}
                        >
                            {tag}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Etiqueta personalizada..."
                        className="flex-1 px-3 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none text-sm focus:border-blue-500"
                        value={newTag}
                        onChange={e => setNewTag(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag(newTag))}
                    />
                    <button type="button" onClick={() => addTag(newTag)} className="px-4 py-2 bg-slate-600 text-white rounded-xl text-sm font-bold hover:bg-slate-700 transition-colors">
                        <Plus size={16} />
                    </button>
                </div>
                {form.tags.filter(t => !COMMON_TAGS.includes(t)).length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {form.tags.filter(t => !COMMON_TAGS.includes(t)).map(tag => (
                            <span key={tag} className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-300 dark:border-slate-600">
                                #{tag}
                                <button type="button" onClick={() => removeTag(tag)} className="ml-1 hover:text-red-500"><X size={12} /></button>
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Enlaces */}
            <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">
                    <Link2 size={12} className="inline mr-1" />
                    Enlaces Relacionados
                </label>
                <div className="space-y-2 mb-2">
                    <input
                        type="text"
                        placeholder="Etiqueta (ej: SharePoint del Proyecto)"
                        className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none text-sm focus:border-blue-500"
                        value={newLink.label}
                        onChange={e => setNewLink(prev => ({ ...prev, label: e.target.value }))}
                    />
                    <div className="flex gap-2">
                        <input
                            type="url"
                            placeholder="https://..."
                            className="flex-1 px-3 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none text-sm focus:border-blue-500"
                            value={newLink.url}
                            onChange={e => setNewLink(prev => ({ ...prev, url: e.target.value }))}
                        />
                        <button type="button" onClick={addLink} className="px-4 py-2 bg-slate-600 text-white rounded-xl text-sm font-bold hover:bg-slate-700 transition-colors flex items-center gap-1">
                            <Plus size={16} />
                        </button>
                    </div>
                </div>
                {form.links.map((l, i) => (
                    <div key={i} className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-3 py-2 mb-1">
                        <Link2 size={14} className="text-blue-500 shrink-0" />
                        <a href={l.url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline truncate flex-1">{l.label || l.url}</a>
                        <button type="button" onClick={() => removeLink(i)} className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                ))}
            </div>

            {/* Archivos Adjuntos (solo si hay reminderId) */}
            {reminderId && (
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">
                        <Paperclip size={12} className="inline mr-1" />
                        Archivos Adjuntos
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer w-full border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4 hover:border-blue-400 hover:bg-blue-50/30 transition-colors text-sm text-slate-500">
                        {uploadingFile ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        {uploadingFile ? "Subiendo archivo..." : "Clic aquí para adjuntar (PDF, Word, Excel, imágenes...)"}
                        <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip" />
                    </label>
                    {attachments.map(att => (
                        <div key={att.id} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2 mt-2 border border-slate-200 dark:border-slate-700">
                            <Paperclip size={14} className="text-slate-400 shrink-0" />
                            <a href={att.file_url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline truncate flex-1">{att.file_name}</a>
                            <span className="text-[10px] text-slate-400">{new Date(att.created_at).toLocaleDateString()}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Comentarios y Seguimiento (solo si hay reminderId) */}
            {reminderId && (
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Seguimiento y Comentarios</label>
                    <div className="space-y-3 mb-3">
                        {comments.map(c => (
                            <div key={c.id} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">👤 {c.user_name}</span>
                                    <span className="text-[10px] text-slate-400">{new Date(c.created_at).toLocaleString()}</span>
                                </div>
                                <p className="text-sm text-slate-700 dark:text-slate-300">{c.comment}</p>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <textarea
                            rows={2}
                            placeholder="Agregar nota de seguimiento..."
                            className="flex-1 px-3 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none text-sm focus:border-blue-500 resize-none"
                            value={newComment}
                            onChange={e => setNewComment(e.target.value)}
                        />
                        <button type="button" onClick={handleAddComment} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors text-sm">
                            Agregar
                        </button>
                    </div>
                </div>
            )}

            {/* Botones de acción */}
            <div className="fixed bottom-0 right-0 w-full max-w-4xl bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 p-4 flex gap-3 z-10">
                <button type="button" onClick={onCancel} className="flex-1 py-3 rounded-xl border-2 border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                    Cancelar
                </button>
                <button type="button" onClick={handleSave} disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors disabled:opacity-60">
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {saving ? "Guardando..." : (reminderId ? "Actualizar Pendiente" : "Guardar Pendiente")}
                </button>
            </div>
        </div>
    );
}
