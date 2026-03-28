import { supabase } from './supabase';
import { formatDate as utilsFormatDate } from './utils';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Genera el reporte "FINAL ACCEPTANCE CHECKLIST FOR FEDERAL-AID PROJECTS"
 * Réplica exacta de la imagen provista.
 */
export async function generateFinalAcceptanceReport(projectId: string) {
    try {
        // 1. Fetch Data
        const { data: proj } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (!proj) throw new Error("Proyecto no encontrado");

        const { data: certs } = await supabase.from('payment_certifications')
            .select('*')
            .eq('project_id', projectId)
            .order('cert_num', { ascending: false });

        const { data: compliance } = await supabase.from('labor_compliance')
            .select('*')
            .eq('project_id', projectId);

        // 2. Document Setup (Portrait Letter)
        const pdfDoc = await PDFDocument.create();
        const fR = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const fI = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

        const PW = 612, PH = 792;
        const ML = 35, MR = 35;
        const pg = pdfDoc.addPage([PW, PH]);

        const BK = rgb(0, 0, 0);

        // Helper functions
        const TXT = (txt: string | number | null | undefined, x: number, y: number, sz: number, bold = false, align: 'left' | 'center' | 'right' = 'left', maxW?: number) => {
            if (txt === undefined || txt === null) return;
            let s = txt.toString();
            const font = bold ? fB : fR;
            if (maxW) {
                while (s.length > 1 && font.widthOfTextAtSize(s, sz) > maxW - 2) {
                    s = s.slice(0, -1);
                }
            }
            let px = x;
            if (align === 'center') px = x - font.widthOfTextAtSize(s, sz) / 2;
            if (align === 'right') px = x - font.widthOfTextAtSize(s, sz);
            pg.drawText(s, { x: px, y: PH - y, size: sz, font, color: BK });
        };

        const LINE = (x1: number, y1: number, x2: number, y2: number, thick = 0.5) => {
            pg.drawLine({ start: { x: x1, y: PH - y1 }, end: { x: x2, y: PH - y2 }, thickness: thick, color: BK });
        };

        const RECT = (x: number, y: number, w: number, h: number, thick = 0.5) => {
            pg.drawRectangle({ x, y: PH - y - h, width: w, height: h, borderWidth: thick, borderColor: BK });
        };

        // 3. Header Section (Logos & Title)
        // Logo PRHTA (Right)
        try {
            const logoResp = await fetch(`${window.location.origin}/act_logo.png`);
            if (logoResp.ok) {
                const logoBytes = await logoResp.arrayBuffer();
                const logoImg = await pdfDoc.embedPng(logoBytes);
                const dims = logoImg.scale(1);
                const targetHeight = 45;
                const targetWidth = (dims.width / dims.height) * targetHeight;
                pg.drawImage(logoImg, {
                    x: PW - MR - targetWidth,
                    y: PH - 25 - targetHeight,
                    width: targetWidth,
                    height: targetHeight
                });
            }
        } catch (e) { console.warn("Logo PRHTA no cargado"); }

        // FHWA Text (Left)
        TXT("U.S. Department of", ML, 70, 7.5, false);
        TXT("Transportation", ML, 78, 7.5, false);
        TXT("Federal Highway", ML, 88, 9, true);
        TXT("Administration", ML, 98, 9, true);

        // Main Title (Center)
        TXT("FINAL ACCEPTANCE CHECKLIST", PW / 2, 50, 18, true, 'center');
        TXT("FOR FEDERAL-AID PROJECTS", PW / 2, 72, 18, true, 'center');

        // 4. Project Information Grid
        let Y = 130;
        TXT("Project Information:", ML, Y, 10, true);
        Y += 15;
        RECT(ML, Y, PW - ML - MR, 20); // State No / Federal No box
        LINE(PW / 2, Y, PW / 2, Y + 20);
        TXT("State No.", ML + 5, Y + 12, 8.5, true);
        TXT(proj.num_act, ML + 50, Y + 12, 9);
        TXT("Federal-Aid No.", PW / 2 + 5, Y + 12, 8.5, true);
        TXT(proj.num_federal || 'N/A', PW / 2 + 75, Y + 12, 9);

        Y += 20;
        RECT(ML, Y, PW - ML - MR, 40); // Description box
        TXT("Project Description:", ML + 5, Y + 12, 8.5, true);
        const desc = proj.description || proj.name || 'N/A';
        const wrappedDesc = desc.match(/.{1,100}/g) || [];
        wrappedDesc.slice(0, 2).forEach((line: string, i: number) => {
            TXT(line, ML + 5, Y + 25 + (i * 10), 9);
        });

        Y += 40;
        RECT(ML, Y, PW - ML - MR, 20); // Awarded / Approved
        LINE(PW / 2, Y, PW / 2, Y + 20);
        TXT("Date Awarded:", ML + 5, Y + 12, 8.5, true);
        TXT(utilsFormatDate(proj.date_awarded), ML + 70, Y + 12, 9);
        TXT("Approved Date:", PW / 2 + 5, Y + 12, 8.5, true);
        TXT(utilsFormatDate(proj.date_approved), PW / 2 + 75, Y + 12, 9);

        Y += 20;
        RECT(ML, Y, PW - ML - MR, 20); // Time Started / Work Started
        LINE(PW / 2, Y, PW / 2, Y + 20);
        TXT("Time Started:", ML + 5, Y + 12, 8.5, true);
        TXT(utilsFormatDate(proj.date_project_start), ML + 70, Y + 12, 9);
        TXT("Work Started:", PW / 2 + 5, Y + 12, 8.5, true);
        TXT(utilsFormatDate(proj.date_project_start), PW / 2 + 75, Y + 12, 9);

        Y += 20;
        RECT(ML, Y, PW - ML - MR, 20); // Contract Days / Working Days
        LINE(PW / 2, Y, PW / 2, Y + 20);
        TXT("Contract Days:", ML + 5, Y + 12, 8.5, true);
        TXT(proj.contract_days?.toString(), ML + 75, Y + 12, 9);
        TXT("Final No. Working Days:", PW / 2 + 5, Y + 12, 8.5, true);
        TXT(proj.final_working_days?.toString() || '---', PW / 2 + 105, Y + 12, 9);

        Y += 20;
        RECT(ML, Y, PW - ML - MR, 20); // Completion Date / Acceptance
        LINE(PW / 2, Y, PW / 2, Y + 20);
        TXT("Completion Date:", ML + 5, Y + 12, 8.5, true);
        TXT(utilsFormatDate(proj.date_rev_completion || proj.date_orig_completion), ML + 80, Y + 12, 9);
        TXT("State Acceptance Date:", PW / 2 + 5, Y + 12, 8.5, true);
        TXT(utilsFormatDate(proj.date_acceptance), PW / 2 + 105, Y + 12, 9);

        Y += 20;
        RECT(ML, Y, PW - ML - MR, 20); // Liquidated Damages
        TXT("Liquidated Damages (No. of days and total amount):", ML + 5, Y + 12, 8.5, true);
        TXT("--- days at $ ---. Total: $ ---", ML + 195, Y + 12, 9);

        // 5. Submittals Table
        Y += 30;
        const TBL_W = PW - ML - MR;
        const COL1 = 295, COL2 = 185;

        // Header
        RECT(ML, Y, TBL_W, 20);
        LINE(ML + COL1, Y, ML + COL1, Y + 20);
        LINE(ML + COL1 + COL2, Y, ML + COL1 + COL2, Y + 20);
        TXT("Submittals:", ML + COL1 / 2, Y + 13, 9, true, 'center');
        TXT("Submitted?", ML + COL1 + COL2 / 2, Y + 13, 9, true, 'center');
        TXT("Date:", ML + COL1 + COL2 + (TBL_W - COL1 - COL2) / 2, Y + 13, 9, true, 'center');

        const items = [
            "Material Certification & Summary of Exceptions (if any)",
            "Payroll Certification",
            "DBE Participation & Certification of DBE Utilization",
            "Final Inspection & Acceptance Letter",
            "Final Estimate",
            "Substantial Completion Letter",
            "Contractor\u0027s Written Statement of Claims (Submitted Separately)",
            "List of CCO\u0027s (CHO & EWO) & Summary Report",
            "Final Time Summary Report & List of Time Extensions",
            "Over and Under Run Report (bid items)",
            "Environmental Commitments Completed"
        ];

        const ROW_H = 26;
        items.forEach((item, i) => {
            const rY = Y + 20 + (i * ROW_H);
            RECT(ML, rY, TBL_W, ROW_H);
            LINE(ML + COL1, rY, ML + COL1, rY + ROW_H);
            LINE(ML + COL1 + COL2, rY, ML + COL1 + COL2, rY + ROW_H);

            // Item text
            let fs = 8.5;
            if (item.length > 55) fs = 7.5;
            TXT(item, ML + 5, rY + 12, fs);
            if (i === 7) TXT("(Participating and Non-Participating)", ML + 5, rY + 22, 6, false);
            if (i === 8) TXT("(Participating & Non-Participating)", ML + 5, rY + 22, 6, false);

            // Yes/No/N/A text
            const optX = ML + COL1 + 20;
            TXT("Yes", optX, rY + 13, 8, false);
            TXT("No", optX + 60, rY + 13, 8, false);
            TXT("N/A", optX + 115, rY + 13, 8, false);
        });

        // 6. Footer Notes
        Y = Y + 20 + (items.length * ROW_H) + 5;
        RECT(ML, Y, TBL_W, 20);
        TXT("(If available, status of environmental commitments if not completed):", ML + 5, Y + 12, 7.5, false);

        Y += 20;
        RECT(ML, Y, TBL_W, 20);
        TXT("Additional Information or changes:", ML + 5, Y + 12, 7.5, true);

        Y += 20;
        RECT(ML, Y, TBL_W, 25);
        TXT("Labor Compliance Issues (if any):", ML + 5, Y + 10, 7.5, true);
        if (compliance && compliance.length > 0) {
            TXT(`${compliance.length} issues noted in system.`, ML + 5, Y + 18, 7.5);
        }

        TXT("(Original -- Project File cc -- FHWA -- with Proposed Final Estimate)", ML, Y, 7.5, false);

        // 7. Page numbering
        const pages = pdfDoc.getPages();
        pages.forEach((p, i) => {
            p.drawText(`Page ${i + 1} of ${pages.length}`, {
                x: PW - MR - 60,
                y: 25,
                size: 8,
                font: fR,
                color: BK
            });
        });

        // 8. Save and Return
        const pdfBytes = await pdfDoc.save();
        return new Blob([pdfBytes as any], { type: 'application/pdf' });
    } catch (err: any) {
        console.error("Error generating Final Acceptance Checklist:", err);
        throw err;
    }
}
