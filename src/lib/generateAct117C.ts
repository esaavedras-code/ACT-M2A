import { PDFDocument, rgb } from 'pdf-lib';
import { supabase } from './supabase';

export async function generateAct117C(projectId: string, certId: string, certNum: number, certDate: string) {
    // 1. Fetch Project data
    const { data: projData } = await supabase.from('projects').select('*').eq('id', projectId).single();
    if (!projData) throw new Error("Proyecto no encontrado");

    // 2. Fetch Contractor data
    const { data: contrData } = await supabase.from('contractors').select('*').eq('project_id', projectId).single();

    // 3. Fetch Certification data (to check skip_retention)
    const { data: currentCert } = await supabase.from('payment_certifications').select('*').eq('id', certId).single();

    // 4. Fetch Items
    const { data: items } = await supabase.from('contract_items').select('*').eq('project_id', projectId).order('item_num', { ascending: true });

    // 4. Fetch Personnel for signatures
    const { data: personnel } = await supabase.from('act_personnel').select('*').eq('project_id', projectId);

    // 5. Fetch Materials on Site
    const { data: mats } = await supabase.from('materials_on_site').select('invoice_total').eq('project_id', projectId);
    const materialValue = mats?.reduce((acc, m) => acc + (m.invoice_total || 0), 0) || 0;

    // 6. Load raw PDF from public folder
    const url = '/ACT-117C_Reporte.pdf';
    const existingPdfBytes = await fetch(url).then(res => res.arrayBuffer());

    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const page = pdfDoc.getPages()[0];

    // Standard factor for pdf2json coordinates (1 unit approx 16 points)
    const factor = 16.0;
    const pageHeight = 792; // Letter size

    const drawText = (text: string, x: number, y: number, size = 9) => {
        if (text === undefined || text === null || text === '') return;
        page.drawText(text.toString(), {
            x: x * factor,
            y: pageHeight - (y * factor) - 15, // Adjusted from -10 to -15 to lower the text even further
            size,
            color: rgb(0, 0, 0),
        });
    };

    const formatCurrency = (val: number, decimals = 2) => {
        return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: decimals });
    }

    // Header Details
    // 1. To: (label at 3.75, 5.21)
    drawText(projData.region ? `Director Regional - Región ${projData.region}` : '', 5.5, 5.21);

    // 9. Date: (label at 21.44, 5.21)
    drawText(new Date().toLocaleDateString('en-US'), 25.5, 5.21);

    // 2. Project Name: (label at 3.75, 6.25)
    drawText(projData.name || '', 8.0, 6.25);

    // 10. Cert. Num.: (label at 21.45, 6.25)
    drawText(certNum.toString(), 25.5, 6.25);

    // 3. Contractor: (label at 3.75, 7.24)
    drawText(contrData?.name || '', 8.0, 7.24);

    // 11. Work Performed up to: (label at 21.45, 7.24)
    drawText(certDate, 27.5, 7.24);

    // 4. Project Num.: (label at 3.75, 8.18)
    drawText(projData.num_act || '', 8.0, 8.18);

    // 12. Contract Beginning Date:
    drawText(projData.date_project_start || '', 27.5, 8.18);

    // 5. Federal Num.: (label at 3.75, 8.93)
    drawText(projData.num_federal || '', 8.0, 8.93);

    // 13. Contract Completion Date: (label at 19.40, 8.93)
    drawText(projData.date_orig_completion || '', 27.5, 8.93);

    // 6. Oracle Num.: (label at 3.75, 9.68)
    drawText(projData.num_oracle || '', 8.0, 9.68);

    // 14. Revised Completion Date: (label at 19.40, 9.68)
    drawText(projData.date_rev_completion || '', 27.5, 9.68);

    // 7. Contract Num.: (label at 3.75, 10.43)
    drawText(projData.num_contrato || '', 8.0, 10.43);

    // 15. Project Original Amount: (label at 19.40, 10.43)
    const calcOriginalAmount = (items || []).reduce((acc: number, it: any) => acc + ((it.quantity || 0) * (it.unit_price || 0)), 0);
    drawText(`$ ${formatCurrency(calcOriginalAmount)}`, 31.5, 10.43);

    // 8. Municipality: (label at 3.75, 11.18)
    drawText(projData.municipios?.join(", ") || '', 8.0, 11.18);

    // 16. Project Revised Amount: (label at 19.39, 11.18)
    const { data: chos } = await supabase.from("chos").select("proposed_change").eq("project_id", projectId).eq("doc_status", "Aprobado");
    const totalCho = (chos || []).reduce((sum, c) => sum + (c.proposed_change || 0), 0);
    drawText(`$ ${formatCurrency(calcOriginalAmount + totalCho)}`, 31.5, 11.18);

    // Grid - Starts at y=15.21
    let startY = 15.21;
    let stepY = 0.75;

    // Drawing items
    let curWorkPerformed = 0;
    if (items) {
        items.slice(0, 15).forEach((item, index) => {
            let y = startY + (index * stepY);
            drawText(item.item_num || '', 4.0, y, 7);
            drawText(item.specification || '', 7.6, y, 7);
            drawText(item.fund_source || '', 10.2, y, 6);
            drawText((item.description || '').substring(0, 40), 12.0, y, 7);
            drawText(item.unit || '', 22.0, y, 7);
            drawText(item.quantity?.toString() || '0', 24.5, y, 7);
            drawText(formatCurrency(item.unit_price || 0, 4), 28.0, y, 7);

            const amt = (item.quantity || 0) * (item.unit_price || 0);
            drawText(formatCurrency(amt), 31.5, y, 7);

            curWorkPerformed += amt;
        });
    }

    // Summary calculations
    const workPerformedValue = curWorkPerformed;
    const retentionValue = currentCert?.skip_retention ? 0 : (workPerformedValue * 0.05);
    const subTotalValue = workPerformedValue - retentionValue;

    const reimbursementWP = 0;
    const lqdValue = 0;
    const lqdReimbursement = 0;
    const extraRetainage = 0;
    const priceAdjustment = 0;
    const safetyPenalties = 0;
    const otherAdjustments = 0;

    const netPaymentValue = subTotalValue + materialValue + reimbursementWP - lqdValue + lqdReimbursement + extraRetainage + priceAdjustment - safetyPenalties + otherAdjustments;

    // Financial Fields (Section 26-38)
    const summaryX = 31.5;
    drawText(`$ ${formatCurrency(workPerformedValue)}`, summaryX, 28.90, 8); // 26. Work Performed (WP)
    drawText(`$ ${formatCurrency(retentionValue)}`, summaryX, 29.85, 8);    // 27. 5% Retained (WP)
    drawText(`$ ${formatCurrency(reimbursementWP)}`, summaryX, 30.80, 8);  // 28. Reimbursement (WP)(+)
    drawText(`$ ${formatCurrency(subTotalValue)}`, summaryX, 31.76, 8);     // 29. Sub Total
    drawText(`$ ${formatCurrency(materialValue)}`, summaryX, 32.71, 8);      // 30. Material on Site (+/-)
    drawText(`$ ${formatCurrency(lqdValue)}`, summaryX, 33.66, 8);          // 31. Liquidated Damages (LQD)(-)
    drawText(`$ ${formatCurrency(lqdReimbursement)}`, summaryX, 34.94, 8);  // 32. Reimbursement (LqD)(+)
    drawText(`$ ${formatCurrency(extraRetainage)}`, summaryX, 35.89, 8);    // 33. Extra Retainage (+/-)
    drawText(`$ ${formatCurrency(priceAdjustment)}`, summaryX, 36.84, 8);   // 34. Price Adjustment Clause (+/-)
    drawText(`$ ${formatCurrency(safetyPenalties)}`, summaryX, 37.79, 8);   // 35. Safety Penalties - Spec 638(-)
    drawText(`$ ${formatCurrency(otherAdjustments)}`, summaryX, 38.74, 8);  // 36. Other (+/-)
    drawText(`$ ${formatCurrency(netPaymentValue)}`, summaryX, 40.65, 9);    // 37. Net Payment
    drawText(`$ ${formatCurrency(workPerformedValue)}`, summaryX, 41.59, 9); // 38. Total to Date (WP)

    // Percentages
    const totalProjectAmount = calcOriginalAmount + totalCho;
    const percentWP = totalProjectAmount > 0 ? (workPerformedValue / totalProjectAmount) * 100 : 0;
    drawText(`${percentWP.toFixed(2)} %`, 10.0, 43.51, 9); // 45. Percent Work Performed

    if (projData.date_project_start) {
        const start = new Date(projData.date_project_start);
        const end = new Date(projData.date_rev_completion || projData.date_orig_completion);
        const today = new Date();
        if (start.getTime() && end.getTime()) {
            const totalTime = end.getTime() - start.getTime();
            const usedTime = today.getTime() - start.getTime();
            const percentTime = Math.min(100, Math.max(0, (usedTime / totalTime) * 100));
            drawText(`${percentTime.toFixed(2)} %`, 10.0, 45.41, 9); // 46. Percent Time
        }
    }

    // 39-44 Signatures (Personnel)
    if (personnel) {
        const contractorRep = personnel.find(p => p.role === 'Representante del Contratista')?.name || contrData?.representative || '';
        const projectAdmin = personnel.find(p => p.role === 'Administrador del Proyecto')?.name || '';
        const areaSuper = personnel.find(p => p.role === 'Supervisor de Área')?.name || '';
        const regDirector = personnel.find(p => p.role === 'Director Regional')?.name || '';
        const financeDirector = personnel.find(p => p.role === 'Director Finanzas')?.name || '';

        drawText(contractorRep, 9.6, 29.85, 8); // 39. Prepared by (Representante del Contratista)
        drawText(projectAdmin, 9.6, 31.76, 8); // 40. Concurred by (Administrador del Proyecto)
        drawText(areaSuper, 9.6, 35.89, 8);    // 42. Submitted for Review (Supervisor de Área)
        drawText(regDirector, 9.6, 37.79, 8);  // 43. Approved by (Director Regional)
        drawText(financeDirector, 9.6, 40.65, 8); // 44. Approved for Payment by (Director Finanzas)
    }

    // Wrap up processing and return Blob
    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes as any], { type: 'application/pdf' });
}
