import { supabase } from './supabase';
import { formatDate as utilsFormatDate, formatCurrency as utilsFormatCurrency } from './utils';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Genera el reporte "ANÁLISIS DE TIEMPO" (AC-457b)
 * Basado en la imagen provista por el usuario.
 */
export async function generateTimeAnalysisReportLogic(projectId: string) {
    try {
        // 1. Fetch Data
        const { data: proj } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (!proj) throw new Error("Proyecto no encontrado");

        const { data: certs } = await supabase.from('payment_certifications')
            .select('*')
            .eq('project_id', projectId)
            .order('cert_num', { ascending: false });

        const { data: chos } = await supabase.from('chos')
            .select('*')
            .eq('project_id', projectId)
            .eq('doc_status', 'Aprobado')
            .order('cho_num', { ascending: true });

        const { data: items } = await supabase.from('contract_items')
            .select('*')
            .eq('project_id', projectId);

        // -- Cálculos Preliminares --

        // A. Net Overrun (Final Report)
        // Usualmente es lo ejecutado total menos lo original
        const totalExecuted = (items || []).reduce((acc, it) => acc + (it.executed_quantity * it.unit_price), 0);
        const originalValue = proj.cost_original || 0;
        const valA = totalExecuted - originalValue;

        // B. Valor total de CHOs y EWOs
        const regularCHOs = chos?.filter(c => !c.description?.toUpperCase().includes('EXTRA WORK') && !c.description?.toUpperCase().includes('EWO')) || [];
        const extraWorkOrders = chos?.filter(c => c.description?.toUpperCase().includes('EXTRA WORK') || c.description?.toUpperCase().includes('EWO')) || [];

        const valCHO = regularCHOs.reduce((acc, c) => acc + (c.amount_impact || 0), 0);
        const valEWO = extraWorkOrders.reduce((acc, c) => acc + (c.amount_impact || 0), 0);
        const valB = valCHO + valEWO;

        // D. A - B
        const valD = valA - valB;

        // 6. Tiempo calculado por Overrun
        let daysOverrun = 0;
        if (valA > valB && originalValue > 0) {
            // Tiempo por Overrun (6) = (D x Tiempo Contrato Original) / Valor del Contrato Original
            daysOverrun = Math.round((valD * (proj.orig_working_days || 0)) / originalValue);
        }

        // 7, 8, 9, 10
        const daysOriginal = proj.orig_working_days || 0;
        const daysCHO = regularCHOs.reduce((acc, c) => acc + (c.time_extension || 0), 0);
        const daysEWO = extraWorkOrders.reduce((acc, c) => acc + (c.time_extension || 0), 0);
        const daysSpecials = 0; // Podría venir de un campo específico si existe

        // 11. Total días autorizados
        const totalDaysAuth = daysOverrun + daysOriginal + daysCHO + daysEWO + daysSpecials;

        // Fechas
        const dateStart = proj.date_project_start ? new Date(proj.date_project_start) : null;
        const dateShouldEnd = proj.date_orig_completion ? new Date(proj.date_orig_completion) : null;
        const dateFinished = proj.date_real_completion ? new Date(proj.date_real_completion) : null;
        const dateInspection = proj.date_acceptance ? new Date(proj.date_acceptance) : null; // Asumimos esta para la 1ra Insp Final

        // Cálculos de duraciones (Diferencia en días)
        const getDaysDiff = (d1: Date | null, d2: Date | null) => {
            if (!d1 || !d2) return 0;
            const diffTime = Math.abs(d2.getTime() - d1.getTime());
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        };

        // 16. Duración del proyecto (12 y 14)
        const duration12_14 = getDaysDiff(dateStart, dateFinished);
        // 18. Tiempo en sobrante
        const val18 = totalDaysAuth - duration12_14;

        // 23. Diferencia entre (15) y (14)
        const diff15_14 = getDaysDiff(dateInspection, dateFinished);

        // 2. Document Setup (Portrait)
        const pdfDoc = await PDFDocument.create();
        const fR = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const fI = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
        const PW = 612, PH = 792;
        const pg = pdfDoc.addPage([PW, PH]);
        const BK = rgb(0, 0, 0);

        const TXT = (txt: any, x: number, y: number, sz: number, bold = false, align: 'left' | 'center' | 'right' = 'left') => {
            if (txt === undefined || txt === null) return;
            const s = txt.toString();
            const font = bold ? fB : fR;
            let px = x;
            if (align === 'center') px = x - font.widthOfTextAtSize(s, sz) / 2;
            if (align === 'right') px = x - font.widthOfTextAtSize(s, sz);
            pg.drawText(s, { x: px, y: PH - y, size: sz, font, color: BK });
        };

        const LINE = (x1: number, y1: number, x2: number, y2: number, thick = 0.5) => {
            pg.drawLine({ start: { x: x1, y: PH - y1 }, end: { x: x2, y: PH - y2 }, thickness: thick, color: BK });
        };

        // Header
        TXT("AC-457b", 50, 40, 8, true);
        TXT("Estado Libre Asociado de Puerto Rico", PW / 2, 40, 9, true, 'center');
        TXT("AUTORIDAD DE CARRETERAS", PW / 2, 52, 10, true, 'center');
        TXT("Área de Construcción", PW / 2, 64, 9, false, 'center');

        // Top Right Data
        const actNumber = proj.num_act?.startsWith('AC-') ? proj.num_act : `AC-${proj.num_act || '---'}`;
        const trData = [
            `Suministro e Instalación de ${proj.name?.substring(0, 40)}${proj.name?.length > 40 ? '...' : ''}`,
            `${actNumber}, O#: ${proj.num_contrato || '---'}, F#: ${proj.num_federal || '---'}`,
            `MP-${proj.num_federal || '---'}, C#${proj.num_act || '---'}`
        ];
        let trY = 80;
        trData.forEach(line => {
            TXT(line, PW - 50, trY, 8, false, 'right');
            trY += 12;
        });

        TXT("ANÁLISIS DE TIEMPO", PW / 2, 140, 11, true, 'center');

        // Section 1
        let Y = 170;
        const L1 = 100, R1 = 380, R2 = 550;

        TXT("1. Net Overrun (Final Report)", L1, Y, 9);
        TXT("A =", R1 - 20, Y, 9, true);
        TXT(utilsFormatCurrency(valA), R2, Y, 9, true, 'right');
        LINE(R1, Y + 2, R2, Y + 2);

        Y += 15;
        TXT("2. Valor total de los Change Orders", L1, Y, 9);
        TXT("=", R1 - 20, Y, 9);
        TXT(utilsFormatCurrency(valCHO), R1 + 100, Y, 9, false, 'right');
        Y += 15;
        TXT("3. Valor total de los EWO", L1, Y, 9);
        TXT("=", R1 - 20, Y, 9);
        TXT(utilsFormatCurrency(valEWO), R1 + 100, Y, 9, false, 'right');
        Y += 15;
        TXT("4. Total (2) + (3)", L1, Y, 9);
        TXT("B =", R1 - 20, Y, 9, true);
        TXT(utilsFormatCurrency(valB), R1 + 100, Y, 9, true, 'right');
        LINE(R1, Y + 2, R1 + 100, Y + 2);

        Y += 15;
        TXT("5. A - B", L1, Y, 9);
        TXT("D =", R1 + 20, Y, 9, true);
        TXT(utilsFormatCurrency(valD), R2, Y, 9, true, 'right');
        LINE(R1 + 40, Y + 2, R2, Y + 2);

        Y += 25;
        TXT("Nota:", L1, Y, 8, true);
        TXT("I  Si A es mayor que B, ello significa que hay que acreditar tiempo en", L1 + 40, Y, 8);
        Y += 10;
        TXT("proporción al trabajo adicional ejecutado. Ese tiempo adicional se", L1 + 50, Y, 8);
        Y += 10;
        TXT("Computa como sigue:", L1 + 50, Y, 8);
        Y += 15;
        TXT("Tiempo por Overrun (6) =", L1 + 50, Y, 8);
        // Fracción movida más a la derecha para evitar solapamiento
        const fractionCenterX = L1 + 260;
        TXT("D x Tiempo Contrato Original", fractionCenterX, Y - 5, 8, false, 'center');
        LINE(fractionCenterX - 70, Y - 2, fractionCenterX + 70, Y - 2);
        TXT("Valor del Contrato Original", fractionCenterX, Y + 8, 8, false, 'center');

        Y += 25;
        TXT("II  Si A es menor que B, úsese cero en el encasillado (6).", L1, Y, 8);

        // Section 2
        Y += 30;
        const labels2 = [
            { n: "6", l: "Tiempo calculado por Overrun", v: daysOverrun },
            { n: "7", l: "Días autorizados por contrato original", v: daysOriginal },
            { n: "8", l: "Días autorizados por Change Orders", v: daysCHO },
            { n: "9", l: "Días autorizados por E.W.O", v: daysEWO },
            { n: "10", l: "Autorizaciones especiales:", v: daysSpecials }
        ];

        labels2.forEach(item => {
            TXT(`${item.n}. ${item.l}`, L1, Y, 9);
            TXT(item.v, R2 - 50, Y, 9, true, 'right');
            LINE(R1, Y + 2, R2 - 30, Y + 2);
            TXT("Días", R2 - 25, Y, 9);
            Y += 15;
        });

        Y += 10;
        TXT("11. Total días autorizados", L1, Y, 9, true);
        TXT("=", R1 - 20, Y, 9);
        TXT(totalDaysAuth, R2 - 50, Y, 9, true, 'right');
        LINE(R1, Y + 2, R2 - 30, Y + 2);
        TXT("Días", R2 - 25, Y, 9);

        // Dates
        Y += 30;
        const datesL = [
            { n: "12", l: "Fecha oficial de comienzo", v: utilsFormatDate(proj.date_project_start) },
            { n: "13", l: "Fecha que debió terminar", v: utilsFormatDate(proj.date_orig_completion) },
            { n: "14", l: "Fecha que terminó", v: utilsFormatDate(proj.date_real_completion) },
            { n: "15", l: "Fecha de la 1ra Inspección Final", v: utilsFormatDate(proj.date_acceptance) }
        ];
        datesL.forEach(item => {
            TXT(`${item.n}. ${item.l}`, L1, Y, 9);
            TXT(item.v || '---', R2 - 50, Y, 9, true, 'right');
            LINE(R1, Y + 2, R2 - 30, Y + 2);
            Y += 15;
        });

        // Comparison 1
        Y += 30;
        TXT("16. Duración del proyecto. Días entre 12 y 14", L1, Y, 9);
        TXT(duration12_14, R2 - 50, Y, 9, true, 'right');
        LINE(R1, Y + 2, R2 - 30, Y + 2);
        TXT("Días", R2 - 25, Y, 9);

        Y += 15;
        TXT("17. Menos número total autorizados (11)........", L1, Y, 9);
        TXT(totalDaysAuth, R2 - 50, Y, 9, true, 'right');
        LINE(R1, Y + 2, R2 - 30, Y + 2);
        TXT("Días", R2 - 25, Y, 9);

        Y += 15;
        TXT("18. Tiempo en sobrante ....................", L1, Y, 9, true);
        TXT(val18, R2 - 50, Y, 9, true, 'right');
        LINE(R1, Y + 2, R2 - 30, Y + 2);
        TXT("Días", R2 - 25, Y, 9);

        // Section for Excess (22+)
        Y += 80;
        TXT("22. Tiempo en exceso ...................... =", L1, Y, 9, true);
        const excess = val18 < 0 ? Math.abs(val18) : 0;
        TXT(excess, R2 - 50, Y, 9, true, 'right');
        LINE(R1, Y + 2, R2 - 30, Y + 2);
        TXT("Días", R2 - 25, Y, 9);

        Y += 15;
        TXT("23. Diferencia en días entre (15) y (14)", L1, Y, 9);
        TXT(diff15_14, R2 - 50, Y, 9, true, 'right');
        LINE(R1, Y + 2, R2 - 30, Y + 2);
        TXT("Días", R2 - 25, Y, 9);

        Y += 30;
        // Liquidated Damages Calculation
        const ldRate = proj.liquidated_damages_rate || 5000;
        const totalLD = excess * ldRate;

        TXT("26. Daños líquidos:", L1, Y, 9, true);
        Y += 15;
        TXT("= Días x Razón diaria", L1 + 100, Y, 9);
        Y += 15;
        TXT("=", L1 + 100, Y, 9);
        TXT(excess, L1 + 130, Y, 9, true, 'center');
        LINE(L1 + 115, Y + 2, L1 + 150, Y + 2);
        TXT("a $", L1 + 160, Y, 9);
        TXT(utilsFormatCurrency(ldRate), L1 + 220, Y, 9, true, 'right');
        LINE(L1 + 175, Y + 2, L1 + 240, Y + 2);

        Y += 25;
        TXT("27. Daños líquidos totales ......................$", L1, Y, 10, true);
        TXT(utilsFormatCurrency(totalLD), R2, Y, 10, true, 'right');
        LINE(R1, Y + 3, R2, Y + 3, 1.5);

        // Save
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
        return blob;

    } catch (err: any) {
        console.error("Error generating Time Analysis Report:", err);
        throw err;
    }
}
