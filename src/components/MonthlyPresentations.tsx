"use client";

import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/lib/supabase";
import { 
    Presentation, Save, Plus, Trash2, Calendar, 
    FileText, AlertTriangle, ImageIcon, Camera, 
    Loader2, Download, ChevronLeft, ChevronRight, X
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { FormRef } from "./ProjectForm";

interface MonthlyPresentation {
    id?: string;
    project_id: string;
    presentation_date: string;
    activities: string;
    critical_points: string;
    photo1_path: string | null;
    photo2_path: string | null;
}

const PhotoPickerModal = ({ projectId, onSelect, onClose }: { projectId: string, onSelect: (url: string) => void, onClose: () => void }) => {
    const [photos, setPhotos] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchPhotos = async () => {
            setLoading(true);
            const { data } = await supabase
                .from("project_documents")
                .select("*")
                .eq("project_id", projectId)
                .eq("section", "photos");
            if (data) setPhotos(data);
            setLoading(false);
        };
        fetchPhotos();
    }, [projectId]);

    return (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 bg-primary text-white flex justify-between items-center">
                    <h3 className="font-black text-xs uppercase tracking-widest flex items-center gap-2">
                        <ImageIcon size={18} /> Galería de Fotos del Proyecto
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full"><X size={20} /></button>
                </div>
                <div className="flex-grow overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>
                    ) : photos.length === 0 ? (
                        <div className="text-center py-20 text-slate-400 font-bold uppercase text-[10px]">No hay fotos en la galería del proyecto</div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {photos.map(p => (
                                <button 
                                    key={p.id}
                                    onClick={() => {
                                        const { data: { publicUrl } } = supabase.storage.from("project-documents").getPublicUrl(p.storage_path);
                                        onSelect(publicUrl);
                                    }}
                                    className="group aspect-video relative rounded-xl overflow-hidden border border-slate-200 hover:border-primary transition-all hover:scale-105"
                                >
                                    <img src={supabase.storage.from("project-documents").getPublicUrl(p.storage_path).data.publicUrl} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Plus className="text-white" size={32} />
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/50 text-white text-[8px] font-bold truncate">
                                        {p.file_name}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <div className="p-4 border-t bg-slate-50 flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold text-[10px] uppercase">Cancelar</button>
                </div>
            </div>
        </div>
    );
};

const MonthlyPresentations = forwardRef<FormRef, { projectId?: string, numAct?: string, onDirty?: () => void, onSaved?: () => void }>(function MonthlyPresentations({ projectId, numAct, onDirty, onSaved }, ref) {
    const [presentations, setPresentations] = useState<MonthlyPresentation[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [formData, setFormData] = useState<MonthlyPresentation>({
        project_id: projectId || "",
        presentation_date: new Date().toISOString().split('T')[0],
        activities: "",
        critical_points: "",
        photo1_path: null,
        photo2_path: null
    });
    const [loading, setLoading] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [uploading, setUploading] = useState<string | null>(null);
    const [projectName, setProjectName] = useState("");
    const [showPicker, setShowPicker] = useState<'photo1_path' | 'photo2_path' | null>(null);

    useEffect(() => {
        if (projectId) {
            fetchPresentations();
            fetchProjectInfo();
        }
    }, [projectId]);

    const fetchProjectInfo = async () => {
        if (!projectId) return;
        const { data } = await supabase.from("projects").select("name").eq("id", projectId).single();
        if (data) setProjectName(data.name);
    };

    const fetchPresentations = async () => {
        if (!projectId) return;
        setLoading(true);
        const { data, error } = await supabase
            .from("monthly_presentations")
            .select("*")
            .eq("project_id", projectId)
            .order("presentation_date", { ascending: false });
        
        if (data) {
            setPresentations(data);
            if (data.length > 0 && !selectedId) {
                // Do not auto-select, let user choose or create new
            }
        }
        setLoading(false);
    };

    const handleSelect = (pres: MonthlyPresentation) => {
        setSelectedId(pres.id || null);
        setFormData(pres);
        setIsDirty(false);
    };

    const handleCreateNew = () => {
        setSelectedId(null);
        setFormData({
            project_id: projectId || "",
            presentation_date: new Date().toISOString().split('T')[0],
            activities: "",
            critical_points: "",
            photo1_path: null,
            photo2_path: null
        });
        setIsDirty(false);
    };

    const handleChange = (field: keyof MonthlyPresentation, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setIsDirty(true);
        if (onDirty) onDirty();
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'photo1_path' | 'photo2_path') => {
        const file = e.target.files?.[0];
        if (!file || !projectId) return;

        setUploading(field);
        try {
            const dateStr = new Date().toISOString().split('T')[0];
            const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
            const storagePath = `${projectId}/Presentaciones/${dateStr}/${Date.now()}_${safeName}`;
            
            const { error: uploadError } = await supabase.storage
                .from("project-documents")
                .upload(storagePath, file);

            if (uploadError) throw uploadError;

            // Register in project_documents so it shows in explorer
            await supabase.from("project_documents").insert([{
                project_id: projectId,
                file_name: file.name,
                doc_type: file.type,
                section: "presentations",
                storage_path: storagePath
            }]);

            const { data: { publicUrl } } = supabase.storage.from("project-documents").getPublicUrl(storagePath);

            setFormData(prev => ({ ...prev, [field]: publicUrl }));
            setIsDirty(true);
            if (onDirty) onDirty();
        } catch (err: any) {
            alert("Error al subir foto: " + err.message);
        } finally {
            setUploading(null);
        }
    };

    const saveData = async (silent = false) => {
        if (!projectId) return;
        setLoading(true);
        try {
            const payload = { ...formData, project_id: projectId };
            let error;

            if (selectedId) {
                const { error: err } = await supabase
                    .from("monthly_presentations")
                    .update(payload)
                    .eq("id", selectedId);
                error = err;
            } else {
                const { data, error: err } = await supabase
                    .from("monthly_presentations")
                    .insert([payload])
                    .select();
                if (data && data[0]) setSelectedId(data[0].id);
                error = err;
            }

            if (error) throw error;
            if (!silent) alert("Presentación mensual guardada");
            setIsDirty(false);
            fetchPresentations();
            if (onSaved) onSaved();
        } catch (err: any) {
            alert("Error al guardar: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    useImperativeHandle(ref, () => ({ save: () => saveData(true) }));

    const generatePDF = async () => {
        if (!formData.activities && !formData.critical_points) {
            alert("Por favor rellene la información antes de generar el reporte.");
            return;
        }

        setLoading(true);
        try {
            const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
            
            const { data: proj } = await supabase.from('projects').select('*').eq('id', projectId).single();
            const { data: certs } = await supabase.from('payment_certs').select('*').eq('project_id', projectId).order('date', { ascending: false });

            const pdfDoc = await PDFDocument.create();
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
            const fontBoldOblique = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);

            let headerLogo: any = null;
            try {
                const actResp = await fetch('/act_logo.png');
                if (actResp.ok) {
                    const bytes = await actResp.arrayBuffer();
                    headerLogo = await pdfDoc.embedPng(bytes).catch(() => pdfDoc.embedJpg(bytes));
                }
            } catch (e) {}

            // PAGE 1: PORTADA
            const page1 = pdfDoc.addPage([1024, 576]); // 16:9 
            const { width, height } = page1.getSize();
            page1.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 0.92, 0.85) });

            if (headerLogo) {
                const dims = headerLogo.scale(1);
                const tgtHeight = 80;
                const tgtWidth = (dims.width / dims.height) * tgtHeight;
                page1.drawImage(headerLogo, { x: 30, y: height - tgtHeight - 30, width: tgtWidth, height: tgtHeight });
            }

            const centerText = (text: string, pfont: any, psize: number, yPos: number, color: any) => {
                const w = pfont.widthOfTextAtSize(text, psize);
                page1.drawText(text, { x: (width - w) / 2, y: yPos, font: pfont, size: psize, color });
            };

            const darkBlue = rgb(0.2, 0.35, 0.6);
            centerText("PROYECTOS ACTIVOS", fontBold, 40, height / 2 + 60, darkBlue);
            centerText("DISTRITO METRO", fontBold, 40, height / 2 + 10, darkBlue);
            centerText("FECHA DEL INFORME", fontBold, 40, height / 2 - 40, darkBlue);
            centerText(new Date(formData.presentation_date).toLocaleDateString('es-PR'), fontBold, 40, height / 2 - 90, darkBlue);

            // PAGE 2: CONTENIDO
            const page2 = pdfDoc.addPage([1024, 576]);
            page2.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });
            page2.drawRectangle({ x: width - 80, y: 0, width: 80, height, color: rgb(0.9, 0.6, 0.4) });

            if (headerLogo) {
                const dims = headerLogo.scale(1);
                const tgtHeight = 60;
                const tgtWidth = (dims.width / dims.height) * tgtHeight;
                page2.drawImage(headerLogo, { x: 20, y: height - tgtHeight - 20, width: tgtWidth, height: tgtHeight });
            }

            const numAct = proj?.num_act || "AC-XXXXX";
            const numFed = proj?.num_federal || "ER-XXXXX";
            page2.drawRectangle({ x: 190, y: height - 55, width: 700, height: 40, color: rgb(1, 0.92, 0.85), borderColor: rgb(0,0,0), borderWidth: 1 });
            page2.drawText(`${numAct} / ${numFed}`, { x: 200, y: height - 43, font: fontBold, size: 28, color: rgb(0,0,0) });

            page2.drawText(proj?.name?.substring(0, 80) || "Nombre del Proyecto", { x: 190, y: height - 85, font: fontBold, size: 18, color: rgb(0,0,0) });

            const admin = proj?.admin_name || "N/A";
            const superv = proj?.project_manager_name || "N/A";
            const contr = proj?.contractor_name?.substring(0, 42) || "N/A";
            const date = new Date(formData.presentation_date).toLocaleDateString('es-ES', { month: 'long', day: 'numeric', year: 'numeric' });
            const origCost = proj?.cost_original || 0;
            const revCost = proj?.cost_revised || origCost;
            const certsSum = certs?.reduce((acc: any, c: any) => acc + c.amount, 0) || 0;
            
            const tableX = 15;
            const tableYTop = height - 100;
            const tableWidth = 360;
            const col1W = 160;
            let currentY = tableYTop;
            
            const drawRow = (label: string, value: string, rowH: number = 22, fontLabel = font, fontVal = fontBold) => {
                page2.drawRectangle({ x: tableX, y: currentY - rowH, width: col1W, height: rowH, borderColor: rgb(0,0,0), borderWidth: 1 });
                page2.drawRectangle({ x: tableX + col1W, y: currentY - rowH, width: tableWidth - col1W, height: rowH, borderColor: rgb(0,0,0), borderWidth: 1 });
                page2.drawText(label, { x: tableX + 5, y: currentY - (rowH / 2) - 4, font: fontLabel, size: 11 });
                page2.drawText(value, { x: tableX + col1W + 5, y: currentY - (rowH / 2) - 4, font: fontVal, size: 11 });
                currentY -= rowH;
            };

            page2.drawRectangle({ x: tableX, y: currentY - 140, width: tableWidth, height: 140, borderColor: rgb(0,0,0), borderWidth: 1 });
            page2.drawText("Descripción del Proyecto:", { x: tableX + 5, y: currentY - 20, font: fontBoldOblique, size: 12 });
            const desc = proj?.description || "Proyecto de mejoras y rehabilitación...";
            
            // Wrap text simplest approach
            const words = desc.split(' ');
            let line = '';
            let yText = currentY - 35;
            for(let w of words) {
                const test = line + w + ' ';
                if(font.widthOfTextAtSize(test, 10) > tableWidth - 10) {
                    page2.drawText(line, { x: tableX + 5, y: yText, font: font, size: 10 });
                    line = w + ' ';
                    yText -= 12;
                } else { line = test; }
            }
            if(line) page2.drawText(line, { x: tableX + 5, y: yText, font: font, size: 10 });
            currentY -= 140;

            drawRow("Administrador", admin);
            drawRow("Supervisor", superv);
            drawRow("Contratista", contr);
            drawRow("Fecha del Informe", date);
            drawRow("Costo Original", formatCurrency(origCost));
            drawRow("Costo Revisado", formatCurrency(revCost));
            drawRow("Incremento ($) Proyectado", formatCurrency(proj?.projected_increase || 0));

            page2.drawRectangle({ x: tableX, y: currentY - 44, width: 120, height: 44, borderColor: rgb(0,0,0), borderWidth: 1 });
            page2.drawText("Última", { x: tableX + 5, y: currentY - 18, font: fontBold, size: 10 });
            page2.drawText("certificación", { x: tableX + 5, y: currentY - 30, font: fontBold, size: 10 });
            
            page2.drawRectangle({ x: tableX + 120, y: currentY - 22, width: 40, height: 22, borderColor: rgb(0,0,0), borderWidth: 1 });
            page2.drawText("Fecha:", { x: tableX + 125, y: currentY - 15, font: font, size: 10 });
            page2.drawRectangle({ x: tableX + 160, y: currentY - 22, width: 200, height: 22, borderColor: rgb(0,0,0), borderWidth: 1 });
            page2.drawText(certs && certs.length > 0 ? formatDate(certs[0].date) : "N/A", { x: tableX + 165, y: currentY - 15, font: font, size: 10 });

            page2.drawRectangle({ x: tableX + 120, y: currentY - 44, width: 40, height: 22, borderColor: rgb(0,0,0), borderWidth: 1 });
            page2.drawText("Monto:", { x: tableX + 125, y: currentY - 37, font: font, size: 10 });
            page2.drawRectangle({ x: tableX + 160, y: currentY - 44, width: 200, height: 22, borderColor: rgb(0,0,0), borderWidth: 1 });
            page2.drawText(certs && certs.length > 0 ? formatCurrency(certs[0].amount) : "$0.00", { x: tableX + 165, y: currentY - 37, font: font, size: 10 });
            currentY -= 44;

            drawRow("Monto Certificado Acumulado", formatCurrency(certsSum));
            drawRow("Monto Ejecutado Acumulado", formatCurrency(certsSum)); 
            drawRow("Fecha de Comienzo", formatDate(proj?.start_date), 20);
            drawRow("Terminación Original (fecha)", formatDate(proj?.original_end_date), 20);
            drawRow("Terminación Revisada (fecha)", formatDate(proj?.revised_end_date), 20);
            drawRow("Terminación Proyectada (fecha)", formatDate(proj?.estimated_end_date), 20);
            
            const pctCert = revCost > 0 ? (certsSum / revCost) * 100 : 0;
            drawRow("% Obra Certificado", pctCert.toFixed(2) + "%", 20);
            drawRow("% Obra Ejecutado", pctCert.toFixed(2) + "%", 20);
            drawRow("% Tiempo", "0.00%", 20); 
            
            page2.drawRectangle({ x: tableX, y: currentY - 20, width: tableWidth/4, height: 20, borderColor: rgb(0,0,0), borderWidth: 1 });
            page2.drawText("Tipo de Fondo", { x: tableX + 2, y: currentY - 13, font: font, size: 9 });
            page2.drawRectangle({ x: tableX + tableWidth/4, y: currentY - 20, width: tableWidth/4, height: 20, borderColor: rgb(0,0,0), borderWidth: 1 });
            page2.drawText(proj?.fund_source || "Federal", { x: tableX + tableWidth/4 + 2, y: currentY - 13, font: fontBold, size: 9 });
            
            page2.drawRectangle({ x: tableX + tableWidth/2, y: currentY - 20, width: tableWidth/4, height: 20, borderColor: rgb(0,0,0), borderWidth: 1 });
            page2.drawText("Term. Sustanc.", { x: tableX + tableWidth/2 + 2, y: currentY - 13, font: font, size: 9 });
            page2.drawRectangle({ x: tableX + (tableWidth/4)*3, y: currentY - 20, width: tableWidth/4, height: 20, borderColor: rgb(0,0,0), borderWidth: 1 });
            page2.drawText("No", { x: tableX + (tableWidth/4)*3 + 2, y: currentY - 13, font: fontBold, size: 9 });

            // COLUMNA MEDIO (Actividades)
            const midX = 385;
            const midYTop = height - 100;
            const midWidth = 320;
            
            page2.drawRectangle({ x: midX, y: 220, width: midWidth, height: midYTop - 220, borderColor: rgb(0,0,0), borderWidth: 1 });
            page2.drawText("Actividades Realizándose:", { x: midX + 5, y: midYTop - 18, font: fontBoldOblique, size: 12 });
            let tLine = '';
            let tYText = midYTop - 35;
            for(let w of (formData.activities || "Ninguna").split(' ')) {
                const test = tLine + w + ' ';
                if(font.widthOfTextAtSize(test, 9) > midWidth - 20) {
                    page2.drawText(tLine, { x: midX + 15, y: tYText, font: font, size: 9 });
                    tLine = w + ' ';
                    tYText -= 12;
                } else { tLine = test; }
            }
            if(tLine) page2.drawText(tLine, { x: midX + 15, y: tYText, font: font, size: 9 });

            page2.drawRectangle({ x: midX, y: 15, width: midWidth, height: 195, borderColor: rgb(0,0,0), borderWidth: 1 });
            page2.drawText("Puntos críticos a atender:", { x: midX + 5, y: 190, font: fontBoldOblique, size: 12 });
            let tcLine = '';
            let tcYText = 170;
            for(let w of (formData.critical_points || "Ninguno al momento.").split(' ')) {
                const test = tcLine + w + ' ';
                if(font.widthOfTextAtSize(test, 9) > midWidth - 20) {
                    page2.drawText(tcLine, { x: midX + 15, y: tcYText, font: font, size: 9 });
                    tcLine = w + ' ';
                    tcYText -= 12;
                } else { tcLine = test; }
            }
            if(tcLine) page2.drawText(tcLine, { x: midX + 15, y: tcYText, font: font, size: 9 });

            // COLUMNA FOTOS
            const rightX = 715;
            const photoWidth = 210;
            const photoHeight = 220;

            const drawImageField = async (url: string | null, yPos: number) => {
                page2.drawRectangle({ x: rightX, y: yPos, width: photoWidth, height: photoHeight, borderColor: rgb(0,0,0), borderWidth: 3 });
                if (url) {
                    try {
                        const imgResp = await fetch(url);
                        if(imgResp.ok) {
                            const imgBytes = await imgResp.arrayBuffer();
                            let pdfImg;
                            if (url.toLowerCase().endsWith('.png') || url.includes('.png?')) {
                                pdfImg = await pdfDoc.embedPng(imgBytes);
                            } else {
                                pdfImg = await pdfDoc.embedJpg(imgBytes);
                            }
                            
                            const oW = pdfImg.width;
                            const oH = pdfImg.height;
                            let drawW = photoWidth - 4;
                            let drawH = (oH / oW) * drawW;
                            if (drawH > photoHeight - 4) {
                                drawH = photoHeight - 4;
                                drawW = (oW / oH) * drawH;
                            }
                            page2.drawImage(pdfImg, { x: rightX + 2 + (photoWidth - 4 - drawW) / 2, y: yPos + 2 + (photoHeight - 4 - drawH) / 2, width: drawW, height: drawH });
                        }
                    } catch(e) { console.error(e) }
                }
            };
            
            await drawImageField(formData.photo1_path, height - 100 - photoHeight);
            await drawImageField(formData.photo2_path, height - 100 - photoHeight * 2 - 10);

            // SAVE PDF
            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
            
            const fileName = `Presentacion_${numAct || "Proyecto"}_${formData.presentation_date}.pdf`;
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            if (projectId) {
                const dateStr = formData.presentation_date;
                const storagePath = `${projectId}/Presentaciones/${dateStr}/${Date.now()}_${fileName}`;
                await supabase.storage.from("project-documents").upload(storagePath, blob, { upsert: true });
                await supabase.from("project_documents").insert([{
                    project_id: projectId,
                    file_name: fileName,
                    doc_type: "application/pdf",
                    section: "presentations",
                    storage_path: storagePath
                }]);
            }
            alert("✓ Presentación PDF exportada correctamente");

        } catch (err: any) {
            alert("Error al generar PDF: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full space-y-6 pb-20">
            <div className="sticky top-0 z-40 bg-[#F8FAFC]/95 dark:bg-[#020617]/95 backdrop-blur-md pt-6 pb-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Presentation className="text-primary" />
                    Presentaciones Mensuales
                </h2>
                <div className="flex gap-2">
                    <button 
                        onClick={handleCreateNew}
                        className="btn-secondary px-4 py-2 text-xs flex items-center gap-2"
                    >
                        <Plus size={14} /> Nueva Presentación
                    </button>
                    <button 
                        onClick={generatePDF}
                        disabled={loading}
                        className="btn-primary bg-orange-600 hover:bg-orange-700 px-4 py-2 text-xs flex items-center gap-2 shadow-orange-200"
                    >
                        <Download size={14} /> Generar PDF
                    </button>
                    <button 
                        onClick={() => saveData(false)}
                        disabled={loading}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-4 py-2 text-xs flex items-center gap-2"
                    >
                        <Save size={14} /> Guardar
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Sidebar: Historico */}
                <div className="lg:col-span-1 space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">Histórico</label>
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                        {presentations.length === 0 ? (
                            <div className="p-4 text-center border-2 border-dashed border-slate-100 rounded-2xl text-[10px] text-slate-400 font-bold uppercase">
                                No hay presentaciones
                            </div>
                        ) : (
                            presentations.map(p => (
                                <button 
                                    key={p.id}
                                    onClick={() => handleSelect(p)}
                                    className={`w-full text-left p-3 rounded-2xl border transition-all ${selectedId === p.id ? 'bg-primary/5 border-primary shadow-sm' : 'bg-white border-slate-100 hover:border-slate-300'}`}
                                >
                                    <p className="text-xs font-black text-slate-700">
                                        {new Date(p.presentation_date).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-medium">{p.presentation_date}</p>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Formulario Principal */}
                <div className="lg:col-span-3 card bg-white dark:bg-slate-900 border-slate-200 p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Calendar size={12} className="text-primary" /> Fecha de Presentación
                            </label>
                            <input 
                                type="date" 
                                className="input-field text-sm"
                                value={formData.presentation_date}
                                onChange={e => handleChange('presentation_date', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <FileText size={12} className="text-primary" /> Actividades Realizándose
                            </label>
                            <textarea 
                                rows={6}
                                placeholder="Describa las actividades realizadas durante este mes..."
                                className="input-field text-sm resize-none"
                                value={formData.activities}
                                onChange={e => handleChange('activities', e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 text-rose-500">
                                <AlertTriangle size={12} /> Puntos Críticos a Atender
                            </label>
                            <textarea 
                                rows={4}
                                placeholder="Mencione los problemas o limitaciones críticas que requieren atención..."
                                className="input-field border-rose-100 focus:border-rose-400 focus:ring-rose-400/20 text-sm resize-none"
                                value={formData.critical_points}
                                onChange={e => handleChange('critical_points', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-100">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <ImageIcon size={12} className="text-primary" /> Fotografías de Progreso
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Photo 1 */}
                            <div className="space-y-3">
                                <div className="aspect-video bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center relative group">
                                    {formData.photo1_path ? (
                                        <>
                                            <img src={formData.photo1_path} alt="Foto 1" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                 <label className="p-2 bg-white rounded-full text-primary cursor-pointer hover:scale-110 transition-transform">
                                                    <Camera size={20} />
                                                    <input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'photo1_path')} />
                                                </label>
                                                <button onClick={() => setFormData(p => ({...p, photo1_path: null}))} className="p-2 bg-white rounded-full text-rose-500 hover:scale-110 transition-transform">
                                                    <Trash2 size={20} />
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center gap-3">
                                            {uploading === 'photo1_path' ? <Loader2 className="animate-spin text-primary" /> : <Plus size={32} className="text-slate-300" />}
                                            <div className="flex flex-col gap-2 w-full px-6">
                                                <label className="cursor-pointer bg-primary text-white py-2 rounded-xl text-[9px] font-black uppercase text-center hover:bg-blue-700 transition-colors">
                                                    Subir Foto 1
                                                    <input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'photo1_path')} />
                                                </label>
                                                <button 
                                                    onClick={() => setShowPicker('photo1_path')}
                                                    className="bg-emerald-500 text-white py-2 rounded-xl text-[9px] font-black uppercase hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <ImageIcon size={12} /> Galería PACT
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Photo 2 */}
                            <div className="space-y-3">
                                <div className="aspect-video bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center relative group">
                                    {formData.photo2_path ? (
                                        <>
                                            <img src={formData.photo2_path} alt="Foto 2" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                 <label className="p-2 bg-white rounded-full text-primary cursor-pointer hover:scale-110 transition-transform">
                                                    <Camera size={20} />
                                                    <input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'photo2_path')} />
                                                </label>
                                                <button onClick={() => setShowPicker('photo2_path')} className="p-2 bg-white rounded-full text-emerald-500 hover:scale-110 transition-transform">
                                                    <ImageIcon size={20} />
                                                </button>
                                                <button onClick={() => setFormData(p => ({...p, photo2_path: null}))} className="p-2 bg-white rounded-full text-rose-500 hover:scale-110 transition-transform">
                                                    <Trash2 size={20} />
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center gap-3">
                                            {uploading === 'photo2_path' ? <Loader2 className="animate-spin text-primary" /> : <Plus size={32} className="text-slate-300" />}
                                            <div className="flex flex-col gap-2 w-full px-6">
                                                <label className="cursor-pointer bg-primary text-white py-2 rounded-xl text-[9px] font-black uppercase text-center hover:bg-blue-700 transition-colors">
                                                    Subir Foto 2
                                                    <input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'photo2_path')} />
                                                </label>
                                                <button 
                                                    onClick={() => setShowPicker('photo2_path')}
                                                    className="bg-emerald-500 text-white py-2 rounded-xl text-[9px] font-black uppercase hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <ImageIcon size={12} /> Galería PACT
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="text-center text-[10px] text-slate-400 font-bold uppercase py-6 opacity-60">
                Asegúrate de guardar cambios antes de generar el reporte
            </div>

            {showPicker && (
                <PhotoPickerModal 
                    projectId={projectId || ""} 
                    onSelect={(url) => {
                        setFormData(p => ({ ...p, [showPicker]: url }));
                        setIsDirty(true);
                        setShowPicker(null);
                        if (onDirty) onDirty();
                    }}
                    onClose={() => setShowPicker(null)}
                />
            )}
        </div>
    );
});

export default MonthlyPresentations;
