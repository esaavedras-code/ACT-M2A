"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { getLocalStorageItem } from "@/lib/utils";
import {
    Save, X, Plus, Trash2, Link2, Paperclip, Upload, Loader2, ChevronDown, Check
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
    project_ids: string[];
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
    title: "", description: "", project_id: "", project_ids: [], subproject: "",
    urgency: 2, type: "Seguimiento", status: "Pendiente",
    due_date: "", due_time: "", reminder_option: "1",
    reminder_custom_date: "", tags: [], assignees: [], links: [],
};

type Props = {
    reminderId?: string | null;
    onSaved: () => void;
    onCancel: () => void;
};

export function parseAssignee(assigneeStr: string): { name: string; email: string } {
    if (!assigneeStr) return { name: "", email: "" };
    const match = assigneeStr.match(/^(.*?)\s*<([^>]+)>$/);
    if (match) {
        return { name: match[1].trim(), email: match[2].trim() };
    }
    return { name: assigneeStr.trim(), email: "" };
}

export default function TaskForm({ reminderId, onSaved, onCancel }: Props) {
    const [form, setForm] = useState<FormData>(emptyForm);
    const [projects, setProjects] = useState<Project[]>([]);
    const [projectUsers, setProjectUsers] = useState<{ name: string; email: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [newTag, setNewTag] = useState("");
    const [newAssigneeName, setNewAssigneeName] = useState("");
    const [newAssigneeEmail, setNewAssigneeEmail] = useState("");
    const [newLink, setNewLink] = useState<ReminderLink>({ label: "", url: "" });
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState("");
    const [attachments, setAttachments] = useState<any[]>([]);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);

    const toggleProjectSelect = (pId: string) => {
        setForm(prev => {
            const exists = prev.project_ids.includes(pId);
            const updated = exists ? prev.project_ids.filter(id => id !== pId) : [...prev.project_ids, pId];
            return {
                ...prev,
                project_ids: updated,
                project_id: updated[0] || "",
            };
        });
    };

    const clearProjectSelect = () => {
        setForm(prev => ({
            ...prev,
            project_ids: [],
            project_id: "",
        }));
    };

    // Cargar proyectos
    useEffect(() => {
        const fetchProjects = async () => {
            const { data } = await supabase.from("projects").select("id, name, num_act").order("name");
            if (data) setProjects(data);
        };
        fetchProjects();
    }, []);

    // Cargar usuarios con acceso al proyecto seleccionado o todos los usuarios registrados
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                if (form.project_id) {
                    const { data: memData } = await supabase
                        .from("memberships")
                        .select("user_id, public.users(name, email)")
                        .eq("project_id", form.project_id)
                        .is("revoked_at", null);

                    const list: { name: string; email: string }[] = [];
                    if (memData && memData.length > 0) {
                        memData.forEach((m: any) => {
                            const u = m.public_users || m.users;
                            if (u && u.email) {
                                list.push({
                                    name: u.name || u.email.split("@")[0],
                                    email: u.email,
                                });
                            }
                        });
                    }

                    if (list.length > 0) {
                        setProjectUsers(list);
                        return;
                    }
                }

                // Cargar todos los usuarios registrados en la tabla 'users'
                const { data: allUsers } = await supabase
                    .from("users")
                    .select("name, email")
                    .order("name");

                if (allUsers && allUsers.length > 0) {
                    const list = allUsers
                        .filter((u: any) => u.email)
                        .map((u: any) => ({
                            name: u.name || u.email.split("@")[0],
                            email: u.email,
                        }));
                    setProjectUsers(list);
                } else {
                    setProjectUsers([]);
                }
            } catch (err) {
                console.error("Error al cargar usuarios:", err);
            }
        };
        fetchUsers();
    }, [form.project_id]);

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
                const loadedProjectIds: string[] = Array.isArray(r.project_ids) && r.project_ids.length > 0
                    ? r.project_ids
                    : (r.project_id ? [r.project_id] : []);
                setForm({
                    title: r.title || "",
                    description: r.description || "",
                    project_id: loadedProjectIds[0] || r.project_id || "",
                    project_ids: loadedProjectIds,
                    subproject: r.subproject || "",
                    urgency: r.urgency || 2,
                    type: r.type || "Seguimiento",
                    status: r.status || "Pendiente",
                    due_date: dueDate ? dueDate.toISOString().split("T")[0] : "",
                    due_time: dueDate ? dueDate.toTimeString().slice(0, 5) : "",
                    reminder_option: "1",
                    reminder_custom_date: "",
                    tags: (r.tags || []).filter((t: string) => !t.startsWith("Resp: ")),
                    assignees: (() => {
                        const fromTable = (aRes.data || []).map((a: any) => {
                            if (a.assignee_email && a.assignee_name && !a.assignee_name.includes("<")) {
                                return `${a.assignee_name} <${a.assignee_email}>`;
                            }
                            return a.assignee_name || a.assignee_email || "";
                        }).filter(Boolean);
                        
                        const fromTags: string[] = [];
                        (r.tags || []).forEach((t: string) => {
                            if (t.startsWith("Resp: ")) {
                                fromTags.push(t.replace("Resp: ", "").trim());
                            }
                        });
                        
                        return Array.from(new Set([...fromTable, ...fromTags]));
                    })(),
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

    const ensureUserCredentials = async (name: string, email: string, projectId?: string) => {
        const cleanEmail = (email || "").trim().toLowerCase();
        const cleanName = (name || "").trim() || (cleanEmail ? cleanEmail.split("@")[0] : "");
        if (!cleanEmail && !cleanName) return;

        try {
            let userId: string | null = null;

            if (cleanEmail) {
                const { data: existingUser } = await supabase
                    .from("users")
                    .select("id, name")
                    .eq("email", cleanEmail)
                    .maybeSingle();

                if (existingUser) {
                    userId = existingUser.id;
                    if (cleanName && (!existingUser.name || existingUser.name === cleanEmail || existingUser.name.includes("@"))) {
                        await supabase.from("users").update({ name: cleanName }).eq("id", userId);
                    }
                } else {
                    const { data: newUser, error: insErr } = await supabase.from("users").insert({
                        name: cleanName,
                        email: cleanEmail,
                        is_active: true,
                    }).select("id").maybeSingle();

                    if (!insErr && newUser) {
                        userId = newUser.id;
                    } else if (insErr) {
                        console.warn("Aviso guardando usuario en 'users':", insErr);
                    }
                }
            } else if (cleanName) {
                const { data: existingUser } = await supabase
                    .from("users")
                    .select("id")
                    .eq("name", cleanName)
                    .maybeSingle();

                if (existingUser) {
                    userId = existingUser.id;
                } else {
                    const { data: newUser } = await supabase.from("users").insert({
                        name: cleanName,
                        is_active: true,
                    }).select("id").maybeSingle();

                    if (newUser) userId = newUser.id;
                }
            }

            if (projectId && userId) {
                const { data: existingMem } = await supabase
                    .from("memberships")
                    .select("id")
                    .eq("project_id", projectId)
                    .eq("user_id", userId)
                    .maybeSingle();

                if (!existingMem) {
                    await supabase.from("memberships").insert({
                        project_id: projectId,
                        user_id: userId,
                        role: 'USER',
                    });
                }
            }

            // Actualizar lista local de usuarios registrados para el selector
            if (cleanEmail || cleanName) {
                const targetEmail = cleanEmail || cleanName;
                setProjectUsers(prev => {
                    if (!prev.some(u => u.email === targetEmail || (cleanEmail && u.email === cleanEmail))) {
                        return [...prev, { name: cleanName, email: targetEmail }].sort((a, b) => a.name.localeCompare(b.name));
                    }
                    return prev;
                });
            }
        } catch (err) {
            console.error("Error registrando credenciales de responsable:", err);
        }
    };

    const addAssigneeObj = (name: string, email: string) => {
        const cleanName = name.trim();
        const cleanEmail = email.trim();
        if (!cleanName && !cleanEmail) return;
        
        const formattedStr = cleanEmail ? `${cleanName || cleanEmail} <${cleanEmail}>` : cleanName;
        
        if (!form.assignees.includes(formattedStr)) {
            setField("assignees", [...form.assignees, formattedStr]);
        }
    };

    const handleAddManualAssignee = async () => {
        if (!newAssigneeName.trim() && !newAssigneeEmail.trim()) return;
        const name = newAssigneeName.trim();
        const email = newAssigneeEmail.trim();

        addAssigneeObj(name, email);
        await ensureUserCredentials(name, email, form.project_id);

        setNewAssigneeName("");
        setNewAssigneeEmail("");
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
        
        // Auto-agregar responsable si se ingresó texto en los campos manuales sin presionar '+'
        let finalAssignees = [...form.assignees];
        if (newAssigneeName.trim() || newAssigneeEmail.trim()) {
            const cleanName = newAssigneeName.trim();
            const cleanEmail = newAssigneeEmail.trim();
            const formattedStr = cleanEmail ? `${cleanName || cleanEmail} <${cleanEmail}>` : cleanName;
            if (!finalAssignees.includes(formattedStr)) {
                finalAssignees.push(formattedStr);
                setField("assignees", finalAssignees);
            }
            setNewAssigneeName("");
            setNewAssigneeEmail("");
        }

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

            if (!userEmail) {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user?.email) {
                    userEmail = session.user.email;
                    if (userName === "Usuario" && session.user.user_metadata?.name) {
                        userName = session.user.user_metadata.name;
                    }
                }
            }

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

            const primaryProjectId = form.project_ids.length > 0 ? form.project_ids[0] : (form.project_id || null);
            const payload: any = {
                title: form.title.trim(),
                description: form.description.trim(),
                project_id: primaryProjectId,
                project_ids: form.project_ids,
                subproject: form.subproject || null,
                urgency: form.urgency,
                type: form.type,
                status: form.status,
                due_date,
                reminder_date,
                tags: form.tags,
                created_by: userName,
                user_email: userEmail || null,
                email_sent: false,
                updated_at: new Date().toISOString(),
            };

            let rid = reminderId;
            if (rid) {
                let { error: updateErr } = await supabase.from("reminders").update(payload).eq("id", rid);
                if (updateErr && (updateErr.message?.includes("user_email") || updateErr.code === "PGRST204")) {
                    delete payload.user_email;
                    delete payload.email_sent;
                    const res = await supabase.from("reminders").update(payload).eq("id", rid);
                    updateErr = res.error;
                }
                if (updateErr) throw updateErr;

                // Limpiar y re-insertar relacionados
                await Promise.all([
                    supabase.from("reminder_assignees").delete().eq("reminder_id", rid),
                    supabase.from("reminder_links").delete().eq("reminder_id", rid),
                ]);
            } else {
                let { data: newR, error: insertErr } = await supabase.from("reminders").insert(payload).select().single();
                if (insertErr && (insertErr.message?.includes("user_email") || insertErr.code === "PGRST204")) {
                    delete payload.user_email;
                    delete payload.email_sent;
                    const res = await supabase.from("reminders").insert(payload).select().single();
                    newR = res.data;
                    insertErr = res.error;
                }
                if (insertErr) throw insertErr;
                rid = newR?.id;
            }

            if (rid) {
                if (finalAssignees.length > 0) {
                    // Guardar credenciales de responsables no registrados en la tabla users / memberships para uso futuro
                    for (const aStr of finalAssignees) {
                        const parsed = parseAssignee(aStr);
                        await ensureUserCredentials(parsed.name, parsed.email, form.project_id);
                    }

                    const assigneesPayload = finalAssignees.map(aStr => ({
                        reminder_id: rid,
                        assignee_name: aStr,
                    }));
                    
                    const { error: assErr } = await supabase.from("reminder_assignees").insert(assigneesPayload);
                    if (assErr) {
                        console.warn("Aviso en reminder_assignees (RLS o esquema):", assErr);
                        // Respaldar asignados en etiquetas del pendiente para superar bloqueo de RLS
                        const respTags = finalAssignees.map(a => `Resp: ${a}`);
                        const cleanTags = form.tags.filter(t => !t.startsWith("Resp: "));
                        const combinedTags = Array.from(new Set([...cleanTags, ...respTags]));
                        await supabase.from("reminders").update({ tags: combinedTags }).eq("id", rid);
                    }
                }
                if (form.links.length > 0) {
                    const { error: linkErr } = await supabase.from("reminder_links").insert(form.links.map(l => ({ reminder_id: rid, label: l.label, url: l.url })));
                    if (linkErr) console.error("Error al guardar enlaces:", linkErr);
                }

                // Notificar por correo electrónico de inmediato a los responsables asignados
                if (finalAssignees.length > 0) {
                    const recipients: string[] = [];
                    finalAssignees.forEach(aStr => {
                        const parsed = parseAssignee(aStr);
                        if (parsed.email) recipients.push(parsed.email);
                    });

                    const uniqueRecipients = Array.from(new Set(recipients));
                    const urgencyLabel = form.urgency === 1 ? '🔴 Alta' : form.urgency === 2 ? '🟡 Media' : '🔵 Baja';
                    const appOrigin = typeof window !== "undefined" && window.location.origin ? window.location.origin : "https://act-m2-a.vercel.app";
                    const directTaskUrl = `${appOrigin}/?openTask=${rid}`;

                    for (const recipient of uniqueRecipients) {
                        const emailData = {
                            to: recipient,
                            subject: `📌 NUEVO PENDIENTE ASIGNADO: ${form.title}`,
                            text: `Hola,\n\nSe te ha asignado un pendiente en el Programa ACT por ${userName}:\n\n- Pendiente: ${form.title}\n- Urgencia: ${urgencyLabel}\n- Fecha de Vencimiento: ${form.due_date || 'Sin fecha'}\n- Estado: ${form.status}\n\nPara revisar o responder este pendiente en PACT, ingresa al siguiente enlace:\n${directTaskUrl}`,
                            html: `
                                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                                    <div style="background-color: #2563eb; padding: 20px; text-align: center;">
                                        <h2 style="color: white; margin: 0;">📌 Asignación de Pendiente / Recordatorio</h2>
                                    </div>
                                    <div style="padding: 30px;">
                                        <p>Hola,</p>
                                        <p>Se te ha asignado un pendiente en el sistema <strong>Programa ACT</strong> por <strong>${userName}</strong>.</p>
                                        <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0;">
                                            <p style="margin: 0 0 5px 0;"><strong>Pendiente:</strong> ${form.title}</p>
                                            <p style="margin: 0 0 5px 0;"><strong>Creado por:</strong> ${userName}</p>
                                            <p style="margin: 0 0 5px 0;"><strong>Urgencia:</strong> ${form.urgency === 1 ? '🔴 Alta' : form.urgency === 2 ? '🟡 Media' : '🔵 Baja'}</p>
                                            <p style="margin: 0 0 5px 0;"><strong>Fecha de Vencimiento:</strong> ${form.due_date || 'Sin fecha'}</p>
                                            <p style="margin: 0; color: #475569;"><strong>Estado:</strong> ${form.status}</p>
                                        </div>
                                        <div style="text-align: center; margin: 25px 0;">
                                            <a href="${directTaskUrl}" target="_blank" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
                                                🔗 Ver Pendiente en PACT
                                            </a>
                                        </div>
                                        <p style="font-size: 12px; color: #64748b; text-align: center;">Si el botón no funciona, copia y pega esta dirección en tu navegador:<br><a href="${directTaskUrl}">${directTaskUrl}</a></p>
                                    </div>
                                </div>
                            `,
                        };

                        try {
                            const api = typeof window !== "undefined" ? (window as any).electronAPI : null;
                            if (api?.sendEmail) {
                                await api.sendEmail(emailData);
                            } else {
                                await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-email`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(emailData)
                                });
                            }
                        } catch (err) {
                            console.error(`Fallo al enviar correo a ${recipient}:`, err);
                        }
                    }
                }
            }
            alert("Pendiente guardado exitosamente");
            onSaved();
        } catch (err: any) {
            console.error("Error guardando pendiente:", err);
            alert("Error al guardar pendiente: " + (err.message || JSON.stringify(err)));
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

    const urgencyColor = form.urgency === 1 ? "bg-red-500" : form.urgency === 2 ? "bg-amber-400" : "bg-sky-500";

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
                <div className="relative">
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Proyecto (1 o más)</label>
                    <button
                        type="button"
                        onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                        className="w-full text-left px-3 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-blue-500 outline-none text-sm flex items-center justify-between transition-colors"
                    >
                        <span className="truncate">
                            {form.project_ids.length === 0
                                ? "General / No asociado"
                                : form.project_ids.length === 1
                                    ? (() => {
                                        const p = projects.find(proj => proj.id === form.project_ids[0]);
                                        return p ? `${p.num_act} – ${p.name}` : "1 Proyecto seleccionado";
                                    })()
                                    : `${form.project_ids.length} Proyectos (${projects.filter(p => form.project_ids.includes(p.id)).map(p => p.num_act).join(", ")})`
                            }
                        </span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 ml-2 flex-shrink-0 transition-transform ${isProjectDropdownOpen ? "rotate-180" : ""}`} />
                    </button>

                    {isProjectDropdownOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsProjectDropdownOpen(false)} />
                            <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto p-1.5">
                                <div
                                    onClick={() => { clearProjectSelect(); setIsProjectDropdownOpen(false); }}
                                    className={`px-3 py-2 text-sm rounded-lg cursor-pointer flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 ${form.project_ids.length === 0 ? "font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/40" : "text-slate-700 dark:text-slate-300"}`}
                                >
                                    <span>General / No asociado</span>
                                    {form.project_ids.length === 0 && <Check className="w-4 h-4 text-blue-600" />}
                                </div>
                                <div className="my-1 border-t border-slate-200 dark:border-slate-800" />
                                {projects.map(p => {
                                    const isSelected = form.project_ids.includes(p.id);
                                    return (
                                        <div
                                            key={p.id}
                                            onClick={() => toggleProjectSelect(p.id)}
                                            className={`px-3 py-2 text-sm rounded-lg cursor-pointer flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 mb-0.5 ${isSelected ? "font-semibold text-blue-600 bg-blue-50 dark:bg-blue-950/40" : "text-slate-700 dark:text-slate-300"}`}
                                        >
                                            <span className="truncate">{p.num_act} – {p.name}</span>
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => {}}
                                                className="w-4 h-4 accent-blue-600 rounded cursor-pointer ml-2 flex-shrink-0"
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
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
                        { val: 3, label: "Baja", color: "bg-sky-500 text-white", ring: "ring-sky-500" },
                    ].map(u => (
                        <button
                            key={u.val}
                            type="button"
                            onClick={() => setField("urgency", u.val)}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${u.color} ${form.urgency === u.val ? `ring-2 ring-offset-2 ${u.ring} scale-105` : "opacity-40 hover:opacity-70"}`}
                        >
                            {u.val === 1 ? "🔴" : u.val === 2 ? "🟡" : "🔵"} {u.label}
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
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">
                    Responsables
                </label>
                
                {/* Desplegable de usuarios registrados */}
                <div className="mb-3">
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        Seleccionar usuario registrado (con acceso al proyecto o sistema):
                    </label>
                    <select
                        className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none text-sm focus:border-blue-500"
                        onChange={(e) => {
                            const val = e.target.value;
                            if (!val) return;
                            const u = projectUsers.find(x => x.email === val);
                            if (u) {
                                addAssigneeObj(u.name, u.email);
                            }
                            e.target.value = "";
                        }}
                    >
                        <option value="">
                            {projectUsers.length > 0 
                                ? (form.project_id ? "-- Seleccionar usuario del proyecto --" : "-- Seleccionar usuario registrado --")
                                : "-- No hay usuarios registrados o cargando... --"}
                        </option>
                        {projectUsers.map((u, idx) => (
                            <option key={idx} value={u.email}>
                                👤 {u.name} ({u.email})
                            </option>
                        ))}
                    </select>
                </div>

                {/* Campos para ingresar responsable manualmente (Nombre e Email) */}
                <div className="space-y-2 mb-2">
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
                        O agregar responsable (Registrado o Externo):
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                            type="text"
                            placeholder="Nombre del responsable..."
                            className="px-3 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none text-sm focus:border-blue-500"
                            value={newAssigneeName}
                            onChange={e => setNewAssigneeName(e.target.value)}
                        />
                        <input
                            type="email"
                            placeholder="Email (para enviarle notificación)..."
                            className="px-3 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none text-sm focus:border-blue-500"
                            value={newAssigneeEmail}
                            onChange={e => setNewAssigneeEmail(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleAddManualAssignee())}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={handleAddManualAssignee}
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5"
                    >
                        <Plus size={16} /> Agregar Responsable
                    </button>
                </div>

                {/* Lista de asignados seleccionados */}
                {form.assignees.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                        {form.assignees.map((aStr, idx) => {
                            const parsed = parseAssignee(aStr);
                            return (
                                <span key={idx} className="flex items-center gap-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-xs font-semibold px-3 py-1.5 rounded-full border border-blue-200 dark:border-blue-800">
                                    <span>👤 {parsed.name}</span>
                                    {parsed.email && <span className="text-[10px] opacity-75">&lt;{parsed.email}&gt;</span>}
                                    <button type="button" onClick={() => removeAssignee(aStr)} className="ml-1 text-slate-400 hover:text-red-500 transition-colors">
                                        <X size={12} />
                                    </button>
                                </span>
                            );
                        })}
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
