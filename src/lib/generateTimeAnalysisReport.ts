import { supabase } from './supabase';
import { formatDate as utilsFormatDate, formatCurrency as utilsFormatCurrency } from './utils';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Genera el reporte "ANÁLISIS DE TIEMPO" (AC-457b)
 * Dividido en dos páginas según instrucciones del usuario.
 */
export async function generateTimeAnalysisReportLogic(projectId: string) {
    try {
        // 1. Fetch Data
        const { data: proj } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (!proj) throw new Error("Proyecto no encontrado");

        const { data: chos } = await supabase.from('chos')
            .select('*')
            .eq('project_id', projectId)
            .eq('doc_status', 'Aprobado')
            .order('cho_num', { ascending: true });

        const { data: items } = await supabase.from('contract_items')
            .select('*')
            .eq('project_id', projectId);

        // -- Cálculos Preliminares --
        const totalExecuted = (items || []).reduce((acc, it) => acc + ((parseFloat(it.executed_quantity as any) || 0) * (parseFloat(it.unit_price as any) || 0)), 0);
        const originalValue = parseFloat(proj.cost_original as any) || 0;
        const valA = totalExecuted - originalValue;

        const regularCHOs = chos?.filter(c => !c.description?.toUpperCase().includes('EXTRA WORK') && !c.description?.toUpperCase().includes('EWO')) || [];
        const extraWorkOrders = chos?.filter(c => c.description?.toUpperCase().includes('EXTRA WORK') || c.description?.toUpperCase().includes('EWO')) || [];

        const valCHO = regularCHOs.reduce((acc, c) => acc + (parseFloat(c.amount_impact as any) || 0), 0);
        const valEWO = extraWorkOrders.reduce((acc, c) => acc + (parseFloat(c.amount_impact as any) || 0), 0);
        const valB = valCHO + valEWO;
        const valD = valA - valB;

        const daysOriginal = parseInt(proj.orig_working_days as any) || 0;
        const daysCHO = regularCHOs.reduce((acc, c) => acc + (parseInt(c.time_extension as any) || 0), 0);
        const daysEWO = extraWorkOrders.reduce((acc, c) => acc + (parseInt(c.time_extension as any) || 0), 0);
        
        let daysOverrun = 0;
        if (valA > valB && originalValue > 0) {
            daysOverrun = Math.round((valD * daysOriginal) / originalValue);
        }

        const daysSpecials = 0; 
        const totalDaysAuth = daysOverrun + daysOriginal + daysCHO + daysEWO + daysSpecials;

        // Fechas
        const dateStartStr = proj.date_project_start;
        const dateStart = dateStartStr ? new Date(dateStartStr) : null;
        const dateOrigEnd = proj.date_orig_completion ? new Date(proj.date_orig_completion) : null;
        const dateRevEnd = proj.date_rev_completion ? new Date(proj.date_rev_completion) : dateOrigEnd;
        const dateFinished = proj.date_real_completion ? new Date(proj.date_real_completion) : null;
        const dateInspection = proj.date_acceptance ? new Date(proj.date_acceptance) : null;

        const getDaysDiff = (d1: Date | null, d2: Date | null) => {
            if (!d1 || !d2) return 0;
            const diffTime = d2.getTime() - d1.getTime();
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        };

        const duration12_14 = getDaysDiff(dateStart, dateFinished);
        const val18 = totalDaysAuth - duration12_14;

        // Página 2 Calculations
        const duration20 = getDaysDiff(dateStart, dateRevEnd);
        const excess_22 = duration12_14 - totalDaysAuth; 
        const diff23 = getDaysDiff(dateFinished, dateInspection);
        
        let val24 = Math.max(0, diff23 - 10);
        let val25 = Math.max(0, excess_22 - val24);

        const ldRate = parseFloat(proj.liquidated_damages_rate as any) || 5000;
        const totalLD = val25 * ldRate;

        // 2. Document Setup
        const pdfDoc = await PDFDocument.create();
        const fR = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const PW = 612, PH = 792;
        const BK = rgb(0, 0, 0);

        const TXT = (p: any, txt: any, x: number, y: number, sz: number, bold = false, align: 'left' | 'center' | 'right' = 'left') => {
            if (txt === undefined || txt === null) return;
            const s = txt.toString();
            const font = bold ? fB : fR;
            let px = x;
            if (align === 'center') px = x - font.widthOfTextAtSize(s, sz) / 2;
            if (align === 'right') px = x - font.widthOfTextAtSize(s, sz);
            p.drawText(s, { x: px, y: PH - y, size: sz, font, color: BK });
        };

        const LINE = (p: any, x1: number, y1: number, x2: number, y2: number, thick = 0.5) => {
            p.drawLine({ start: { x: x1, y: PH - y1 }, end: { x: x2, y: PH - y2 }, thickness: thick, color: BK });
        };

        const drawHeader = (p: any) => {
            TXT(p, "AC-457b", 50, 40, 8, true);
            TXT(p, "Estado Libre Asociado de Puerto Rico", PW / 2, 40, 9, true, 'center');
            TXT(p, "AUTORIDAD DE CARRETERAS Y TRANSPORTACION", PW / 2, 52, 10, true, 'center');
            TXT(p, "Área de Construcción", PW / 2, 64, 9, false, 'center');

            const actNumber = proj.num_act?.startsWith('AC-') ? proj.num_act : `AC-${proj.num_act || '---'}`;
            
            const labelX = 50;
            const valueX = 140;
            let curH = 90;

            TXT(p, "Proyecto:", labelX, curH, 8, true);
            TXT(p, proj.name || '---', valueX, curH, 8);
            LINE(p, valueX - 2, curH + 2, PW - 50, curH + 2);
            curH += 15;

            TXT(p, "Núm. Proyecto:", labelX, curH, 8, true);
            TXT(p, actNumber, valueX, curH, 8);
            LINE(p, valueX - 2, curH + 2, valueX + 150, curH + 2);
            
            TXT(p, "Contrato:", valueX + 160, curH, 8, true);
            TXT(p, proj.num_contrato || '---', valueX + 210, curH, 8);
            LINE(p, valueX + 208, curH + 2, PW - 50, curH + 2);
            curH += 15;

            TXT(p, "Municipio:", labelX, curH, 8, true);
            const mun = Array.isArray(proj.municipios) ? proj.municipios.join(', ') : (proj.municipios || proj.location || '---');
            TXT(p, mun, valueX, curH, 8);
            LINE(p, valueX - 2, curH + 2, valueX + 150, curH + 2);

            TXT(p, "Federal:", valueX + 160, curH, 8, true);
            TXT(p, proj.num_federal || '---', valueX + 210, curH, 8);
            LINE(p, valueX + 208, curH + 2, PW - 50, curH + 2);
            curH += 15;

            // Extra rows for missing info
            TXT(p, "Región:", labelX, curH, 8, true);
            TXT(p, proj.region || '---', valueX, curH, 8);
            LINE(p, valueX - 2, curH + 2, valueX + 150, curH + 2);

            TXT(p, "Contratista:", valueX + 160, curH, 8, true);
            TXT(p, proj.contractor_name || '---', valueX + 210, curH, 8);
            LINE(p, valueX + 208, curH + 2, PW - 50, curH + 2);
            curH += 15;

            TXT(p, "Administrador:", labelX, curH, 8, true);
            TXT(p, proj.admin_name || '---', valueX, curH, 8);
            LINE(p, valueX - 2, curH + 2, valueX + 150, curH + 2);

            TXT(p, "PM ACT:", valueX + 160, curH, 8, true);
            TXT(p, proj.project_manager_name || '---', valueX + 210, curH, 8);
            LINE(p, valueX + 208, curH + 2, PW - 50, curH + 2);
        };

        // --- PAGE 1 ---
        const page1 = pdfDoc.addPage([PW, PH]);
        drawHeader(page1);

        let Y = 155;
        const L1 = 60, R2 = 550, R1 = 380;
        
        // Summary Box
        LINE(page1, L1, Y, R2, Y, 1);
        LINE(page1, L1, Y + 40, R2, Y + 40, 1);
        LINE(page1, L1, Y, L1, Y + 40, 1);
        LINE(page1, R2, Y, R2, Y + 40, 1);
        LINE(page1, PW / 2, Y, PW / 2, Y + 40, 0.8);
        TXT(page1, "VALOR DEL CONTRATO", L1 + (PW / 2 - L1) / 2, Y + 12, 8, true, 'center');
        TXT(page1, "TIEMPO DEL CONTRATO", PW / 2 + (R2 - PW / 2) / 2, Y + 12, 8, true, 'center');
        TXT(page1, `Original: ${utilsFormatCurrency(originalValue)}`, L1 + 5, Y + 28, 8);
        TXT(page1, `Revisado: ${utilsFormatCurrency(originalValue + valCHO + valEWO)}`, L1 + 140, Y + 28, 8);
        TXT(page1, `Original: ${daysOriginal} días`, PW / 2 + 5, Y + 28, 8);
        TXT(page1, `Revisado: ${daysOriginal + daysCHO + daysEWO} días`, PW / 2 + 120, Y + 28, 8);

        Y = 220;
        TXT(page1, "ANÁLISIS DE TIEMPO", PW / 2, Y, 12, true, 'center');
        Y += 15;
        TXT(page1, "(BORRADOR)", PW / 2, Y, 11, true, 'center');
        Y += 15;

        TXT(page1, "1. Net Overrun (Final Report)", L1, Y, 9);
        TXT(page1, "A =", R1 - 30, Y, 9, true);
        TXT(page1, utilsFormatCurrency(valA), R2, Y, 9, true, 'right');
        LINE(page1, R1, Y + 2, R2, Y + 2);

        Y += 15;
        TXT(page1, "2. Valor total de los Change Orders", L1, Y, 9);
        TXT(page1, "=", R1 - 30, Y, 9);
        TXT(page1, utilsFormatCurrency(valCHO), R1 + 100, Y, 9, false, 'right');
        Y += 15;
        TXT(page1, "3. Valor total de los EWO", L1, Y, 9);
        TXT(page1, "=", R1 - 30, Y, 9);
        TXT(page1, utilsFormatCurrency(valEWO), R1 + 100, Y, 9, false, 'right');
        Y += 15;
        TXT(page1, "4. Total (2) + (3)", L1, Y, 9);
        TXT(page1, "B =", R1 - 30, Y, 9, true);
        TXT(page1, utilsFormatCurrency(valB), R1 + 100, Y, 9, true, 'right');
        LINE(page1, R1, Y + 2, R1 + 100, Y + 2);

        Y += 15;
        TXT(page1, "5. A - B", L1, Y, 9);
        TXT(page1, "D =", R1 + 20, Y, 9, true);
        TXT(page1, utilsFormatCurrency(valD), R2, Y, 9, true, 'right');
        LINE(page1, R1 + 40, Y + 2, R2, Y + 2);

        Y += 25;
        TXT(page1, "Nota: I. Si A es mayor que B, tiempo por Overrun (6) = (D x Tiempo Original) / Valor Original", L1, Y, 8, true);
        Y += 12;
        TXT(page1, "      II. Si A es menor que B, úsese cero en (6).", L1, Y, 8);

        Y += 30;
        const labelsPage1 = [
            { n: "6", l: "Tiempo calculado por Overrun", v: daysOverrun },
            { n: "7", l: "Días autorizados por contrato original", v: daysOriginal },
            { n: "8", l: "Días autorizados por Change Orders", v: daysCHO },
            { n: "9", l: "Días autorizados por E.W.O", v: daysEWO },
            { n: "10", l: "Autorizaciones especiales:", v: daysSpecials }
        ];
        labelsPage1.forEach(item => {
            TXT(page1, `${item.n}. ${item.l}`, L1, Y, 9);
            TXT(page1, `${item.v} días`, R2, Y, 9, true, 'right');
            LINE(page1, R1, Y + 2, R2 - 40, Y + 2);
            Y += 15;
        });

        Y += 10;
        TXT(page1, "11. Total días autorizados (6 al 10)", L1, Y, 9, true);
        TXT(page1, "=", R1 - 30, Y, 9);
        TXT(page1, `${totalDaysAuth} días`, R2, Y, 9, true, 'right');
        LINE(page1, R1, Y + 2, R2 - 40, Y + 2);

        Y += 30;
        const datesPage1 = [
            { n: "12", l: "Fecha oficial de comienzo", v: utilsFormatDate(proj.date_project_start) },
            { n: "13", l: "Fecha que debió terminar", v: utilsFormatDate(proj.date_orig_completion) },
            { n: "14", l: "Fecha que terminó", v: utilsFormatDate(proj.date_real_completion) },
            { n: "15", l: "Fecha de la Inspección Final", v: utilsFormatDate(proj.date_acceptance) }
        ];
        datesPage1.forEach(item => {
            TXT(page1, `${item.n}. ${item.l}`, L1, Y, 9);
            TXT(page1, item.v || '---', R2, Y, 9, true, 'right');
            LINE(page1, R1, Y + 2, R2, Y + 2);
            Y += 15;
        });

        Y += 30;
        TXT(page1, "16. Duración del proyecto (Días entre 12 y 14)", L1, Y, 9);
        TXT(page1, `${duration12_14} días`, R2, Y, 9, true, 'right');
        LINE(page1, R1, Y + 2, R2 - 40, Y + 2);

        Y += 15;
        TXT(page1, "17. Menos número total autorizados (11)", L1, Y, 9);
        TXT(page1, `${totalDaysAuth} días`, R2, Y, 9, true, 'right');
        LINE(page1, R1, Y + 2, R2 - 40, Y + 2);

        Y += 15;
        TXT(page1, "18. Tiempo en sobrante (11 - 16)", L1, Y, 10, true);
        TXT(page1, `${val18} días`, R2, Y, 10, true, 'right');
        LINE(page1, R1, Y + 2, R2 - 40, Y + 2);

        // --- PAGE 2 ---
        const page2 = pdfDoc.addPage([PW, PH]);
        drawHeader(page2);
        Y = 135;

        TXT(page2, "19. Nueva fecha de terminación", L1, Y, 9);
        TXT(page2, utilsFormatDate(dateRevEnd), R2, Y, 9, true, 'right');
        LINE(page2, R1, Y + 2, R2, Y + 2);

        Y += 15;
        TXT(page2, "20. Duración del proyecto enmendada. Días entre (19) y (12)", L1, Y, 9);
        TXT(page2, `${duration20} días`, R2, Y, 9, true, 'right');
        LINE(page2, R1, Y + 2, R2 - 40, Y + 2);

        Y += 15;
        TXT(page2, "21. Menos número total autorizados (11)", L1, Y, 9);
        TXT(page2, `${totalDaysAuth} días`, R2, Y, 9, true, 'right');
        LINE(page2, R1, Y + 2, R2 - 40, Y + 2);

        Y += 15;
        TXT(page2, "22. Tiempo en exceso ..................................................... =", L1, Y, 10);
        TXT(page2, `${Math.max(0, excess_22)}`, R2 - 50, Y, 10, true, 'right');
        TXT(page2, "días", R2, Y, 10);
        LINE(page2, R1, Y + 2, R2 - 40, Y + 2);

        Y += 15;
        TXT(page2, "23. Diferencia en días entre (15) y (14) ............................. =", L1, Y, 9);
        TXT(page2, `${diff23}`, R2 - 50, Y, 9, true, 'right');
        TXT(page2, "días", R2, Y, 9);
        LINE(page2, R1, Y + 2, R2 - 40, Y + 2);

        Y += 25;
        TXT(page2, "Nota:", L1, Y, 8, true);
        TXT(page2, "(a) Si (23) es 10 días o menos, úsese el (22) para calcular", L1 + 40, Y, 8);
        Y += 10;
        TXT(page2, "    daños líquidos.", L1 + 40, Y, 8);
        Y += 12;
        TXT(page2, "(b) Si (23) es más de 10 días, eso quiere decir que la Autoridad", L1 + 40, Y, 8);
        Y += 10;
        TXT(page2, "    tardó más de 10 días en hacer la primera inspección final y", L1 + 40, Y, 8);
        Y += 10;
        TXT(page2, "    hay que darle crédito al contratista por la diferencia. Por lo tanto:", L1 + 40, Y, 8);

        Y += 35;
        TXT(page2, "24. (23) - 10 días ................................................................ =", L1, Y, 9);
        TXT(page2, `${val24}`, R2 - 50, Y, 9, true, 'right');
        TXT(page2, "días", R2, Y, 9);
        LINE(page2, R1, Y + 2, R2 - 40, Y + 2);

        Y += 15;
        TXT(page2, "25. Tiempo en exceso a usar en daños (22) - (24) ...... =", L1, Y, 9);
        TXT(page2, `${val25}`, R2 - 50, Y, 9, true, 'right');
        TXT(page2, "días", R2, Y, 9);
        LINE(page2, R1, Y + 2, R2 - 40, Y + 2);

        Y += 35;
        TXT(page2, "26. Daños líquidos:", L1, Y, 10, true);
        Y += 15;
        TXT(page2, "= Días x Razón diaria", L1 + 100, Y, 9);
        Y += 15;
        TXT(page2, "=", L1 + 100, Y, 9);
        TXT(page2, `${val25}`, L1 + 180, Y, 9, true, 'center');
        LINE(page2, L1 + 160, Y + 2, L1 + 200, Y + 2);
        TXT(page2, `a $`, L1 + 215, Y, 9);
        TXT(page2, `${utilsFormatCurrency(ldRate)}`, L1 + 300, Y, 9, true, 'right');
        LINE(page2, L1 + 240, Y + 2, L1 + 320, Y + 2);

        Y += 45;
        TXT(page2, "27. Daños líquidos totales ........................................... $", L1, Y, 11, true);
        TXT(page2, formatC(totalLD), R2, Y, 11, true, 'right');
        LINE(page2, R1, Y + 3, R2, Y + 3, 1.5);

        // Footer common
        [page1, page2].forEach((p, idx) => {
            TXT(p, `Página ${idx + 1} de 2`, PW / 2, PH - 20, 8, false, 'center');
        });

        // Save
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
        return blob;

    } catch (err: any) {
        console.error("Error generating Time Analysis Report:", err);
        throw err;
    }
}

function formatC(val: number) {
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
