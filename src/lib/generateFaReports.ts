import { supabase } from "./supabase";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatDate, formatCurrency } from "./utils";

/**
 * AC-49: Informe Diario de FA
 * Genera el reporte para un día específico combinando labor, equipo y materiales.
 */
export async function generateFaInformeDiario(projectId: string, date: string) {
    const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
    
    // Fetch all records for this project and this date
    const { data: faList } = await supabase.from('force_accounts').select('id, fa_num, contratista').eq('project_id', projectId);
    const faIds = faList?.map(f => f.id) || [];
    
    const { data: laborRows } = await supabase.from('fa_labor').select('*').in('force_account_id', faIds).eq('fecha', date);
    const { data: equipRows } = await supabase.from('fa_equipment').select('*').in('force_account_id', faIds).eq('fecha', date);
    const { data: matRows } = await supabase.from('fa_materials').select('*').in('force_account_id', faIds).eq('fecha', date);

    if (!project) throw new Error("No se encontró el proyecto.");

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const page = pdfDoc.addPage([612, 792]);
    const { width, height } = page.getSize();
    let y = height - 40;

    const drawText = (text: string, x: number, yPos: number, size = 9, isBold = false) => {
        page.drawText(String(text || ""), { x, y: yPos, size, font: isBold ? fontBold : font });
    };

    drawText("PUERTO RICO HIGHWAY AND TRANSPORTATION AUTHORITY", 150, y, 11, true); y -= 15;
    drawText("AC-49 INFORME DIARIO DE FUERZA CUENTA", 185, y, 10, true); y -= 25;

    page.drawRectangle({ x: 30, y: y - 50, width: width - 60, height: 60, borderWidth: 1 });
    drawText(`PROYECTO: ${project.name || ""}`, 40, y - 15, 9, true);
    drawText(`NÚMERO ACT: ${project.num_act || ""}`, 450, y - 15, 9, true);
    drawText(`CONTRATISTA: ${project.contractor_name || ""}`, 40, y - 30, 9);
    drawText(`FECHA DEL REPORTE: ${formatDate(date)}`, 450, y - 45, 9, true);
    y -= 70;

    // Mano de Obra
    drawText("I. MANO DE OBRA (LABOR)", 30, y, 10, true); y -= 15;
    const colsLabor = ["Nombre", "Clasificación", "Horas", "Tasa", "Total"];
    colsLabor.forEach((c, i) => drawText(c, 35 + (i * 110), y, 8, true)); y -= 12;
    
    let moTotal = 0;
    laborRows?.forEach(l => {
        const rowTotal = (l.horas_normales || 0) * (l.tasa_normal || 0) + (l.horas_extra || 0) * (l.tasa_extra || 0);
        moTotal += rowTotal;
        drawText(l.nombre?.substring(0, 20), 35, y, 7);
        drawText(l.clasificacion?.substring(0, 20), 145, y, 7);
        drawText(String((l.horas_normales || 0) + (l.horas_extra || 0)), 255, y, 7);
        drawText(formatCurrency(l.tasa_normal), 365, y, 7);
        drawText(formatCurrency(rowTotal), 475, y, 7);
        y -= 10;
        if (y < 60) { y = height - 50; pdfDoc.addPage(); }
    });
    y -= 15;

    // Equipo
    drawText("II. EQUIPO (EQUIPMENT)", 30, y, 10, true); y -= 15;
    const colsEq = ["ID/Modelo", "Descripción", "Activas", "Tasa", "Total"];
    colsEq.forEach((c, i) => drawText(c, 35 + (i * 110), y, 8, true)); y -= 12;

    let eqTotal = 0;
    equipRows?.forEach(eq => {
        const rowTotal = (eq.horas_activo || 0) * (eq.tasa_activo || 0);
        eqTotal += rowTotal;
        drawText(eq.num_equipo || eq.modelo, 35, y, 7);
        drawText(eq.descripcion?.substring(0, 25), 145, y, 7);
        drawText(String(eq.horas_activo || 0), 255, y, 7);
        drawText(formatCurrency(eq.tasa_activo), 365, y, 7);
        drawText(formatCurrency(rowTotal), 475, y, 7);
        y -= 10;
        if (y < 60) { y = height - 50; pdfDoc.addPage(); }
    });
    y -= 15;

    // Materiales
    drawText("III. MATERIALES (MATERIALS)", 30, y, 10, true); y -= 15;
    const colsMat = ["Descripción", "Unidad", "Cant.", "Precio U.", "Total"];
    colsMat.forEach((c, i) => drawText(c, 35 + (i * 110), y, 8, true)); y -= 12;

    let matTotal = 0;
    matRows?.forEach(m => {
        const rowTotal = (m.cantidad || 0) * (m.precio_unitario || 0);
        matTotal += rowTotal;
        drawText(m.descripcion?.substring(0, 25), 35, y, 7);
        drawText(m.unidad, 145, y, 7);
        drawText(String(m.cantidad || 0), 255, y, 7);
        drawText(formatCurrency(m.precio_unitario), 365, y, 7);
        drawText(formatCurrency(rowTotal), 475, y, 7);
        y -= 10;
        if (y < 60) { y = height - 50; pdfDoc.addPage(); }
    });
    y -= 30;

    const grandTotal = moTotal + eqTotal + matTotal;
    drawText(`RESUMEN DE COSTOS DEL DÍA:`, 350, y, 10, true); y -= 15;
    drawText(`MANO DE OBRA: ${formatCurrency(moTotal)}`, 360, y, 9); y -= 10;
    drawText(`EQUIPO: ${formatCurrency(eqTotal)}`, 360, y, 9); y -= 10;
    drawText(`MATERIALES: ${formatCurrency(matTotal)}`, 360, y, 9); y -= 15;
    page.drawRectangle({ x: 350, y: y - 5, width: 220, height: 20, color: rgb(0.9, 0.95, 1) });
    drawText(`TOTAL DEL DÍA: ${formatCurrency(grandTotal)}`, 360, y, 11, true);

    const pdfBytes = await pdfDoc.save();
    return new Blob([Buffer.from(pdfBytes)], { type: "application/pdf" });
}

/**
 * AC-50: Relación de Equipo de FA
 * Genera el reporte de equipo utilizado en un mes específico.
 */
export async function generateFaRelacionEquipo(projectId: string, month: string) {
    const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
    const { data: faList } = await supabase.from('force_accounts').select('id').eq('project_id', projectId);
    const faIds = faList?.map(f => f.id) || [];
    
    // Convert month index to SQL range
    const year = new Date().getFullYear();
    const startDate = `${year}-${(parseInt(month) + 1).toString().padStart(2, '0')}-01`;
    const endDate = `${year}-${(parseInt(month) + 1).toString().padStart(2, '0')}-31`; // Simplified

    const { data: equipRows } = await supabase.from('fa_equipment')
        .select('*')
        .in('force_account_id', faIds)
        .gte('fecha', startDate)
        .lte('fecha', endDate)
        .order('fecha', { ascending: true });

    if (!project) throw new Error("Proyecto no encontrado.");

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const page = pdfDoc.addPage([792, 612]); // Landscape
    const { width, height } = page.getSize();
    let y = height - 40;

    const drawText = (text: string, x: number, yPos: number, size = 9, isBold = false) => {
        page.drawText(String(text || ""), { x, y: yPos, size, font: isBold ? fontBold : font });
    };

    drawText("PUERTO RICO HIGHWAY AND TRANSPORTATION AUTHORITY", width/2 - 150, y, 11, true); y -= 15;
    drawText("AC-50 RELACIÓN DE EQUIPO UTILIZADO (FORCE ACCOUNT)", width/2 - 140, y, 10, true); y -= 25;

    drawText(`PROYECTO: ${project.name}`, 40, y, 10, true);
    drawText(`NÚMERO ACT: ${project.num_act}`, 600, y, 10, true); y -= 15;
    drawText(`MES: ${new Intl.DateTimeFormat('es-PR', { month: 'long' }).format(new Date(2000, parseInt(month)))} ${year}`, 40, y, 10);
    y -= 30;

    const cols = ["Fecha", "ID/Modelo", "Descripción", "Capacidad", "Hrs Act.", "Tasa", "Total"];
    cols.forEach((c, i) => drawText(c, 40 + (i * 105), y, 9, true)); y -= 15;

    let totalMes = 0;
    equipRows?.forEach(eq => {
        const rowTotal = (eq.horas_activo || 0) * (eq.tasa_activo || 0);
        totalMes += rowTotal;
        drawText(formatDate(eq.fecha), 40, y, 8);
        drawText(eq.num_equipo || eq.modelo || "", 145, y, 8);
        drawText(eq.descripcion?.substring(0, 25), 250, y, 8);
        drawText(eq.capacidad || "N/A", 355, y, 8);
        drawText(String(eq.horas_activo), 460, y, 8);
        drawText(formatCurrency(eq.tasa_activo), 565, y, 8);
        drawText(formatCurrency(rowTotal), 670, y, 8);
        y -= 12;
        if (y < 50) { y = height - 50; pdfDoc.addPage(); }
    });

    y -= 20;
    page.drawLine({ start: { x: 40, y: y+5 }, end: { x: width - 40, y: y+5 } });
    drawText(`TOTAL MENSUAL DE EQUIPO: ${formatCurrency(totalMes)}`, 550, y - 10, 11, true);

    const pdfBytes = await pdfDoc.save();
    return new Blob([Buffer.from(pdfBytes)], { type: "application/pdf" });
}

/**
 * AC-51: Resumen Anual del Trabajo del FA
 * Genera el resumen consolidado de todo el proyecto.
 */
export async function generateFaResumenAnual(projectId: string) {
    const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
    const { data: faList } = await supabase.from('force_accounts').select('id').eq('project_id', projectId);
    const faIds = faList?.map(f => f.id) || [];

    const { data: laborRows } = await supabase.from('fa_labor').select('*').in('force_account_id', faIds);
    const { data: equipRows } = await supabase.from('fa_equipment').select('*').in('force_account_id', faIds);
    const { data: matRows } = await supabase.from('fa_materials').select('*').in('force_account_id', faIds);

    if (!project) throw new Error("Proyecto no encontrado.");

    const pdfDoc = await PDFDocument.create();
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const page = pdfDoc.addPage([612, 792]);
    const { width, height } = page.getSize();
    let y = height - 40;

    const drawText = (text: string, x: number, yPos: number, size = 9, isBold = false) => {
        page.drawText(String(text || ""), { x, y: yPos, size, font: fontBold });
    };

    drawText("PUERTO RICO HIGHWAY AND TRANSPORTATION AUTHORITY", 150, y, 11, true); y -= 15;
    drawText("AC-51 RESUMEN DEL TRABAJO DEL FA (ANUAL/FINAL)", 160, y, 10, true); y -= 30;

    drawText(`PROYECTO: ${project.name}`, 40, y, 10);
    drawText(`NÚMERO ACT: ${project.num_act}`, 450, y, 10); y -= 40;

    const moTotal = laborRows?.reduce((acc, l) => acc + ((l.horas_normales || 0) * (l.tasa_normal || 0) + (l.horas_extra || 0) * (l.tasa_extra || 0)), 0) || 0;
    const eqTotal = equipRows?.reduce((acc, eq) => acc + ((eq.horas_activo || 0) * (eq.tasa_activo || 0)), 0) || 0;
    const matTotal = matRows?.reduce((acc, m) => acc + ((m.cantidad || 0) * (m.precio_unitario || 0)), 0) || 0;

    const rows = [
        ["CONCEPTO", "TOTAL ACUMULADO"],
        ["I. MANO DE OBRA", formatCurrency(moTotal)],
        ["II. EQUIPO", formatCurrency(eqTotal)],
        ["III. MATERIALES", formatCurrency(matTotal)],
        ["", ""],
        ["COSTO TOTAL ACUMULADO", formatCurrency(moTotal + eqTotal + matTotal)]
    ];

    rows.forEach((row, i) => {
        drawText(row[0], 100, y, 11, i === 0 || i === rows.length - 1);
        drawText(row[1], 400, y, 11, i === 0 || i === rows.length - 1);
        y -= 25;
    });

    const pdfBytes = await pdfDoc.save();
    return new Blob([Buffer.from(pdfBytes)], { type: "application/pdf" });
}

/**
 * Mantiene compatibilidad con el reporte mensual anterior si fuera necesario.
 */
export async function generateFaResumenMensual(projectId: string) {
    // Redirigir a una versión simplificada o la nueva mensual
    return generateFaRelacionEquipo(projectId, new Date().getMonth().toString());
}
