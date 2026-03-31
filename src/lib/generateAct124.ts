import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { supabase } from './supabase';
import { formatDate } from './utils';

const PW = 612; // 8.5"
const PH = 792; // 11"

const drawText = (p: any, txt: any, x: number, y: number, font: any, size = 8, center = false, right = false) => {
    if (txt === undefined || txt === null) return;
    const s = txt.toString();
    const textWidth = font.widthOfTextAtSize(s, size);
    let finalX = x;
    if (center) finalX = x - (textWidth / 2);
    else if (right) finalX = x - textWidth;
    p.drawText(s, { x: finalX, y: PH - y, size, font, color: rgb(0, 0, 0) });
};

const drawLine = (p: any, x1: number, y1: number, x2: number, y2: number, thickness = 0.5) => {
    p.drawLine({ start: { x: x1, y: PH - y1 }, end: { x: x2, y: PH - y2 }, thickness, color: rgb(0, 0, 0) });
};

const drawRect = (p: any, x: number, y: number, w: number, h: number, fill = false, color = rgb(0.9, 0.9, 0.9)) => {
    if (fill) { p.drawRectangle({ x, y: PH - y - h, width: w, height: h, color }); }
    else { p.drawRectangle({ x, y: PH - y - h, width: w, height: h, borderColor: rgb(0, 0, 0), borderWidth: 0.5 }); }
};

interface ChecklistItem {
    side: string;
    description: string;
    included: boolean;
}

export async function generateAct124(projectId: string, choId: string, selectedItems: string[]) {
    try {
        const { data: projData } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (!projData) throw new Error("Proyecto no encontrado");
        const { data: contrData } = await supabase.from('contractors').select('*').eq('project_id', projectId).single();
        const { data: choData } = await supabase.from('chos').select('*').eq('id', choId).single();
        const { data: personnel } = await supabase.from('act_personnel').select('*').eq('project_id', projectId);

        const personnelMap: Record<string, string> = {};
        personnel?.forEach(p => { personnelMap[p.role] = p.name; });

        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const fontItalicBold = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);

        const page = pdfDoc.addPage([PW, PH]);

        // Header - Subido 0.5cm adicionales (aprox 14pt)
        drawText(page, "Government of Puerto Rico", PW / 2, 21, font, 9, true);
        drawText(page, "Department of Transportation and Public Works", PW / 2, 36, font, 9, true);
        drawText(page, "HIGHWAY AND TRANSPORTATION AUTHORITY", PW / 2, 51, fontBold, 10, true);
        drawText(page, "Construction Area", PW / 2, 66, font, 9, true);

        drawText(page, "ACT-124", PW - 45, 21, font, 9, false, true);
        drawText(page, "Rev. 12/2024", PW - 45, 36, font, 9, false, true);

        // Subido 1cm (~28pt) de 115 a 85
        drawText(page, "Change Order Check List", PW / 2, 85, fontBold, 14, true);

        // Project Info - Subido 1.5cm (~42pt) de 150 a 105
        const infoY = 105;
        const infoGap = 16;
        const labelX = 35; // Más ancho (antes 45)
        const valueX = 125;
        const lineEndX = 450;

        const drawInfoLine = (label: string, value: string, y: number, endX: number) => {
            drawText(page, label, labelX, y, font, 10);
            drawLine(page, valueX, y + 2, endX, y + 2, 0.5);
            drawText(page, value || "", valueX + 5, y, font, 9);
        };

        drawInfoLine("Project Name", projData.name, infoY, lineEndX);
        drawInfoLine("Project Number", projData.num_act, infoY + infoGap, lineEndX);
        drawInfoLine("Contractor", contrData?.name, infoY + infoGap * 2, lineEndX);

        // Right side info
        const rightLabelX = 465;
        const rightValueX = rightLabelX + 65;
        const rightLineEndX = PW - 35;

        const drawRightInfoLine = (label: string, value: string, y: number) => {
            drawText(page, label, rightLabelX, y, font, 10);
            drawLine(page, rightValueX, y + 2, rightLineEndX, y + 2, 0.5);
            drawText(page, value || "", rightValueX + 5, y, font, 9);
        };

        drawRightInfoLine("Amendment", choData.amendment_letter, infoY);
        drawRightInfoLine("CHO Num.", choData.cho_num?.toString(), infoY + infoGap);
        drawRightInfoLine("CHO Date", formatDate(choData.cho_date), infoY + infoGap * 2);

        // Table - Subido 2.5cm (~71pt) de 225 a 154
        const tableY = 154;
        const col1W = 85;
        const col2W = 85;
        const col3W = PW - labelX - col1W - col2W - 35;
        
        // Header Table
        drawRect(page, labelX, tableY, col1W + col2W + col3W, 35, true, rgb(0.8, 0.8, 0.8));
        drawLine(page, labelX, tableY, PW - 35, tableY, 1.5);
        drawLine(page, labelX, tableY + 35, PW - 35, tableY + 35, 1.5);
        
        // Vertical lines for header
        drawLine(page, labelX, tableY, labelX, tableY + 35, 1.5);
        drawLine(page, labelX + col1W, tableY, labelX + col1W, tableY + 35, 1.5);
        drawLine(page, labelX + col1W + col2W, tableY, labelX + col1W + col2W, tableY + 35, 1.5);
        drawLine(page, PW - 35, tableY, PW - 35, tableY + 35, 1.5);

        drawText(page, "Folder Side", labelX + col1W / 2, tableY + 20, fontBold, 10, true);
        drawText(page, "Documents", labelX + col1W + col2W / 2, tableY + 13, fontBold, 10, true);
        drawText(page, "Included", labelX + col1W + col2W / 2, tableY + 25, fontBold, 10, true);
        drawText(page, "Description", labelX + col1W + col2W + col3W / 2, tableY + 20, fontBold, 10, true);

        const items: ChecklistItem[] = [
            { side: "Portada", description: "Routing Sheet", included: selectedItems.includes("routing_sheet") },
            { side: "1-A", description: "ACT-124 Change Order Check List (Rev 12/2024)", included: selectedItems.includes("act124_checklist") },
            { side: "1-A", description: "QA/QC FORM - PROJECT SUPERVISOR", included: selectedItems.includes("qa_qc_form") },
            { side: "1-B", description: "Construction Contract Modification Log (CCML)", included: selectedItems.includes("ccml") },
            { side: "1-B", description: "Certification of Funds (Construction Area will request to Budget Office)", included: selectedItems.includes("cert_funds") },
            { side: "1-B", description: "FHWA - Record of Authorization to Proceed with Contract Revision", included: selectedItems.includes("fhwa_auth") },
            { side: "1-B", description: "Determination of Federal Aid Eligible Items Form- DOFAEI", included: selectedItems.includes("dofaei") },
            { side: "1-B", description: "Project Agreement (for Federal Projects)", included: selectedItems.includes("project_agreement") },
            { side: "2-A", description: "ACT-122 - Change Order Form", included: selectedItems.includes("act122_form") },
            { side: "2-B", description: "ACT-123 - Suplementary Contract Form", included: selectedItems.includes("act123_form") },
            { side: "3-A", description: "ACT-32 Rev 12/2024 Comité para Evaluación de Órdenes de Cambio", included: selectedItems.includes("act32_committee") },
            { side: "3-A", description: "Technical Committee - Change Order - Case Presentation", included: selectedItems.includes("tech_committee") },
            { side: "3-A", description: "Supporting Documents (Contractor's Proposal, Computations, Cost Estimate, etc.)", included: selectedItems.includes("supporting_docs") },
            { side: "3-A", description: "Time Extension Memorandum and Graphic of Time Extension Analysis, when applicable", included: selectedItems.includes("time_extension") },
            { side: "3-B", description: "Elegibility Certificate (RUL (Registro Único de Licitadores))", included: selectedItems.includes("eligibility_cert") },
            { side: "3-B", description: "Corporate Resolution, when applicable", included: selectedItems.includes("corporate_res") },
            { side: "3-B", description: "Contract Amendments Registered in Comptroller Office", included: selectedItems.includes("contract_amendments") },
        ];

        let currentY = tableY + 35;
        const rowH = 22; // Reducido un poco para que quepan firmas mejor

        const form = pdfDoc.getForm();

        items.forEach((item, idx) => {
            // Draw borders
            drawLine(page, labelX, currentY, labelX, currentY + rowH, 1.5);
            drawLine(page, labelX + col1W, currentY, labelX + col1W, currentY + rowH, 1.5);
            drawLine(page, labelX + col1W + col2W, currentY, labelX + col1W + col2W, currentY + rowH, 1.5);
            drawLine(page, PW - 35, currentY, PW - 35, currentY + rowH, 1.5);
            drawLine(page, labelX, currentY + rowH, PW - 35, currentY + rowH, 1.5);

            // Side
            drawText(page, item.side, labelX + col1W / 2, currentY + 14, fontBold, 9, true);

            // Checkbox Interactiva (Form Field)
            const cbSize = 10;
            const cbX = labelX + col1W + (col2W - cbSize) / 2;
            const cbY = currentY + (rowH - cbSize) / 2;
            
            // Creamos el campo de checkbox en el PDF
            const checkBox = form.createCheckBox(`doc_included_${idx}`);
            checkBox.addToPage(page, { 
                x: cbX, 
                y: PH - cbY - cbSize, 
                width: cbSize, 
                height: cbSize,
            });

            // Si estaba seleccionado en la app, lo dejamos marcado por defecto
            if (item.included) {
                checkBox.check();
            }

            // Description
            const descX = labelX + col1W + col2W + 5;
            const maxDescW = col3W - 10;
            
            if (item.description === "Determination of Federal Aid Eligible Items Form- DOFAEI") {
                drawText(page, "Determination of Federal Aid Eligible Items Form- ", descX, currentY + 14, font, 8.5);
                const w1 = font.widthOfTextAtSize("Determination of Federal Aid Eligible Items Form- ", 8.5);
                drawText(page, "DOFAEI", descX + w1, currentY + 14, fontBold, 8.5);
            } else if (item.description === "Elegibility Certificate (RUL (Registro Único de Licitadores))") {
                 drawText(page, "Elegibility Certificate (RUL (", descX, currentY + 14, font, 8.5);
                 const w1 = font.widthOfTextAtSize("Elegibility Certificate (RUL (", 8.5);
                 drawText(page, "Registro Único de Licitadores", descX + w1, currentY + 14, fontItalicBold, 8.5);
                 const w2 = fontItalicBold.widthOfTextAtSize("Registro Único de Licitadores", 8.5);
                 drawText(page, "))", descX + w1 + w2, currentY + 14, font, 8.5);
            } else {
                // Ajuste para la 4ta línea de abajo hacia arriba (Time Extension)
                let fontSize = 8.5;
                if (font.widthOfTextAtSize(item.description, fontSize) > maxDescW) {
                    fontSize = 7.5; // Reducir fuente si es muy largo
                }
                drawText(page, item.description, descX, currentY + 14, font, fontSize);
            }

            currentY += rowH;
        });

        // Signatures
        const sigY = currentY + 40;
        const sigW = 200;
        const dateLineX = 330;
        const dateLineW = 70;

        const drawSignature = (label: string, y: number, name: string) => {
            drawLine(page, labelX, y, labelX + sigW, y, 0.8);
            drawText(page, label, labelX + sigW / 2, y + 12, font, 8, true);
            drawText(page, name || "", labelX + sigW / 2, y - 2, font, 9, true);

            drawLine(page, dateLineX, y, dateLineX + dateLineW, y, 0.8);
            drawText(page, "Date", dateLineX + dateLineW / 2, y + 12, font, 8, true);
        };

        drawSignature("Project Administrator/ Resident Engineer or Inspector", sigY, personnelMap["Administrador del Proyecto"]);
        drawSignature("Area Supervisor or Project Manager", sigY + 60, personnelMap["Supervisor de Área"]);
        drawSignature("Distric Director or Program Manager", sigY + 120, personnelMap["Director Regional"]);

        const pdfBytes = await pdfDoc.save();
        alert("Recordatorio: En el documento PDF generado, asegúrese de marcar los cuadritos que sean necesarios.");
        return new Blob([pdfBytes as any], { type: 'application/pdf' });
    } catch (err: any) {
        console.error("Error generating ACT-124:", err);
        throw err;
    }
}
