import { supabase } from "./supabase";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatDate, formatCurrency } from "./utils";

/**
 * Genera el reporte "Informe Diario de FA" (basado en el PDF de referencia)
 * Este reporte es por cada registro individual de Force Account.
 */
export async function generateFaInformeDiario(projectId: string, faId: string) {
    const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
    const { data: fa } = await supabase.from('force_accounts').select('*').eq('id', faId).single();
    const { data: laborRows } = await supabase.from('fa_labor').select('*').eq('force_account_id', faId);
    const { data: equipRows } = await supabase.from('fa_equipment').select('*').eq('force_account_id', faId);
    const { data: matRows } = await supabase.from('fa_materials').select('*').eq('force_account_id', faId);

    if (!project || !fa) {
        throw new Error("No se encontró el proyecto o el registro de Force Account.");
    }

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const page = pdfDoc.addPage([612, 792]); // Letter Portrait
    const { width, height } = page.getSize();
    let y = height - 40;

    // --- Helpers ---
    const drawText = (text: string, x: number, yPos: number, size = 9, isBold = false) => {
        page.drawText(String(text || ""), { x, y: yPos, size, font: isBold ? fontBold : font });
    };

    // --- Header ---
    drawText("PUERTO RICO HIGHWAY AND TRANSPORTATION AUTHORITY", 150, y, 11, true); y -= 15;
    drawText("INFORME DIARIO DE FUERZA CUENTA (FORCE ACCOUNT)", 165, y, 10, true); y -= 25;

    // --- Project Info Box ---
    page.drawRectangle({ x: 30, y: y - 50, width: width - 60, height: 60, borderWidth: 1 });
    drawText(`PROYECTO: ${project.name || ""}`, 40, y - 15, 9, true);
    drawText(`NÚMERO ACT: ${project.num_act || ""}`, 450, y - 15, 9, true);
    drawText(`CONTRATISTA: ${fa.contratista || project.contractor_name || ""}`, 40, y - 30, 9);
    drawText(`FA #: ${fa.fa_num || ""}`, 40, y - 45, 9, true);
    drawText(`FECHA: ${formatDate(fa.fecha_inicio)}`, 450, y - 45, 9);
    y -= 70;

    // --- Totales Math ---
    const d = fa.fa_details || {};
    const moTotal = laborRows?.reduce((acc, l) => acc + ((l.horas_normales || 0) * (l.tasa_normal || 0)) + ((l.horas_extra || 0) * (l.tasa_normal || 0) * 1.5), 0) || 0;
    
    let eqTotal = 0;
    equipRows?.forEach(eq => {
        eqTotal += (eq.horas_activo || 0) * (eq.tasa_activo || eq.renta_mensual || 0);
        eqTotal += (eq.horas_inactivo || 0) * (eq.tasa_inactivo || 0);
    });

    const matTotal = matRows?.reduce((acc, m) => acc + (m.total || 0), 0) || 0;
    const subtotal = moTotal + eqTotal + matTotal;
    const fianz = subtotal * ((d.fianzas_pct_mil || 0) / 1000);
    const totalGlobal = subtotal + fianz;

    // --- I. Mano de Obra ---
    drawText("I. MANO DE OBRA (LABOR)", 30, y, 10, true); y -= 15;
    const colsLabor = ["Fecha", "Nombre", "Clase", "Hrs", "Tasa", "Cantidad total"];
    colsLabor.forEach((c, i) => {
        const xPos = 35 + (i * 90);
        drawText(c, xPos, y, 8, true);
    }); y -= 12;

    laborRows?.forEach(l => {
        const rowTotal = (l.horas_normales || 0) * (l.tasa_normal || 0);
        drawText(formatDate(l.fecha), 35, y, 7);
        drawText(l.nombre?.substring(0, 15), 125, y, 7);
        drawText(l.clasificacion?.substring(0, 12), 215, y, 7);
        drawText(String(l.horas_normales || 0), 305, y, 7);
        drawText(formatCurrency(l.tasa_normal), 395, y, 7);
        drawText(formatCurrency(rowTotal), 485, y, 7);
        y -= 10;
        if (y < 50) { y = height - 50; pdfDoc.addPage(); }
    });
    y -= 15;

    // --- II. Equipo ---
    drawText("II. EQUIPO (EQUIPMENT)", 30, y, 10, true); y -= 15;
    const colsEq = ["ID/Modelo", "Descripción", "Act", "Idle", "Tasa", "Total"];
    colsEq.forEach((c, i) => drawText(c, 35 + (i * 95), y, 8, true)); y -= 12;

    equipRows?.forEach(eq => {
        const rowTotal = ((eq.horas_activo || 0) * (eq.tasa_activo || 0)) + ((eq.horas_inactivo || 0) * (eq.tasa_inactivo || 0));
        drawText(eq.num_equipo || eq.modelo, 35, y, 7);
        drawText(eq.descripcion?.substring(0, 20), 130, y, 7);
        drawText(String(eq.horas_activo || 0), 225, y, 7);
        drawText(String(eq.horas_inactivo || 0), 320, y, 7);
        drawText(formatCurrency(eq.tasa_activo), 415, y, 7);
        drawText(formatCurrency(rowTotal), 510, y, 7);
        y -= 10;
        if (y < 50) { y = height - 50; pdfDoc.addPage(); }
    });
    y -= 25;

    // --- Totales Finales ---
    drawText(`SUBTOTAL TRABAJO: ${formatCurrency(subtotal)}`, 400, y, 10, true); y -= 15;
    drawText(`FIANZAS (${d.fianzas_pct_mil || 0}/MIL): ${formatCurrency(fianz)}`, 400, y, 9); y -= 20;
    page.drawRectangle({ x: 380, y: y - 5, width: 220, height: 25, color: rgb(0.9, 0.95, 1) });
    drawText(`COSTO TOTAL: ${formatCurrency(totalGlobal)}`, 390, y, 12, true);

    // --- III. Insumos Especiales (Basado en Fotos) ---
    y -= 50;
    drawText("INSUMOS ESPECIALES (Cálculo según Evidencia Fotográfica)", 30, y, 9, true); y -= 15;
    drawText(`Cisterna: ${d.cisterna_qty || 0}`, 40, y, 8);
    drawText(`Camión Agua: ${d.camion_agua_qty || 0}`, 150, y, 8);
    drawText(`Camión Diesel: ${d.camion_diesel_qty || 0}`, 280, y, 8);

    // --- Firmas ---
    y = 80;
    page.drawLine({ start: { x: 40, y: y+15 }, end: { x: 200, y: y+15 } });
    page.drawLine({ start: { x: 350, y: y+15 }, end: { x: 550, y: y+15 } });
    drawText("Representante Contratista", 70, y, 8, true);
    drawText("Inspector Autorizado (HTA)", 380, y, 8, true);

    const pdfBytes = await pdfDoc.save();
    const buffer = Buffer.from(pdfBytes);
    return new Blob([buffer], { type: "application/pdf" });
}

/**
 * Genera el reporte "Relación de Equipo de FA"
 */
export async function generateFaRelacionEquipo(projectId: string) {
    const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
    const { data: faList } = await supabase.from('force_accounts').select('*').eq('project_id', projectId);

    if (!project || !faList) throw new Error("Datos insuficientes.");

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const page = pdfDoc.addPage([792, 612]); // Horizontal
    const { width, height } = page.getSize();

    page.drawText("RELACIÓN DE EQUIPO - FUERZA CUENTA", { x: width/2 - 100, y: height - 40, size: 14, font: fontBold });
    page.drawText(`PROYECTO: ${project.name}`, { x: 40, y: height - 70, size: 10, font: fontBold });

    const pdfBytes = await pdfDoc.save();
    const buffer = Buffer.from(pdfBytes);
    return new Blob([buffer], { type: "application/pdf" });
}
