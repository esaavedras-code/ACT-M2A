import ExcelJS from 'exceljs';
import { formatDate } from './utils';

const translateDescription = (text: string) => {
    if (!text) return "";
    let t = text.toUpperCase();
    const map: Record<string, string> = {
        "REHABILITACION": "REHABILITATION",
        "CARRETERA": "ROAD",
        "CTRA": "ROAD",
        "PAVIMENTACION": "PAVING",
        "PUENTE": "BRIDGE",
        "MEJORAS": "IMPROVEMENTS",
        "CONSTRUCCION": "CONSTRUCTION",
        "MANTENIMIENTO": "MAINTENANCE"
    };
    let words = t.split(/\s+/);
    return words.map(w => map[w] || w).join(" ");
};

export async function generateCCMLReport(
    project: any,
    chosList: any[],
    agreementFunds: any[],
    personnel: any[],
    contrData: any,
    certs: any[],
    ccmlMods: any[],
    selectedChoId?: string
): Promise<Blob> {
    try {
        const response = await fetch('/New Contract Modification Log amarillo.xlsx');
        if (!response.ok) throw new Error(`No se encontró la plantilla CCML.`);
        const templateBuf = await response.arrayBuffer();

        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(templateBuf);
        const ws = wb.getWorksheet('CML Report');
        if (!ws) throw new Error('No se encontró la hoja "CML Report".');

        // --- ULTIMATE GLOBAL FIX: Flatten all Formulas to Static Values ---
        // This is a prerequisite for stability in this brittle template.
        // It prevents the "master must exist" crashes (like H76) by converting
        // all formulas to their last known calculated static value.
        ws.views = [];
        wb.calcProperties.fullCalcOnLoad = false;

        ws.eachRow({ includeEmpty: true }, (row) => {
            row.eachCell({ includeEmpty: true }, (cell) => {
                if (cell.type === ExcelJS.ValueType.Formula) {
                    const result = cell.result;
                    const fallback = cell.value;

                    cell.value = null; // Clear current formula/state
                    // @ts-ignore
                    cell._formula = null;
                    // @ts-ignore
                    cell._sharedFormula = null;

                    // Restore as static value. Prefer result from the last save of the template.
                    cell.value = (result !== undefined) ? result : fallback;
                }
            });
        });

        // Setup Filtering
        let chosToInclude = [...(chosList || [])];
        let reportDate = new Date();
        if (selectedChoId) {
            chosToInclude.sort((a, b) => new Date(a.cho_date).getTime() - new Date(b.cho_date).getTime());
            const targetIdx = chosToInclude.findIndex((c: any) => c.id === selectedChoId);
            if (targetIdx !== -1) {
                reportDate = new Date(chosToInclude[targetIdx].cho_date);
                chosToInclude = chosToInclude.slice(0, targetIdx + 1);
            }
        }

        const ewoList = chosToInclude.filter((c: any) => c.cho_num === null || c.amendment_letter?.includes('EWO'));
        const trueChoList = chosToInclude.filter((c: any) => c.cho_num !== null && !c.amendment_letter?.includes('EWO'));
        const manager = personnel?.find((p: any) => p.role === 'Project Manager')?.name || '';
        const defaultFedPct = project.federal_share_pct != null ? parseFloat(project.federal_share_pct) : 80.25;

        // --- Helpers ---
        const setVal = (addr: string, val: any) => {
            const cell = ws.getCell(addr);
            cell.value = val;
            return cell;
        };

        // --- Header Info & Metrics Calculations (A1-V29) ---
        const cleanManager = (project.project_manager_name || project.admin_name || manager || '').replace(/^(Ing\.|Eng\.|Arq\.)\s+/i, '');
        const englishTitle = translateDescription(project.name);

        // General Info (E Column)
        setVal('E8', project.num_act || '');
        setVal('E9', project.num_federal || '');
        setVal('E10', project.num_oracle || '');
        setVal('E11', project.name ? `${project.name}${englishTitle ? (" / " + englishTitle) : ""}` : "");
        setVal('E12', contrData?.name || project.contractor_name || '');
        setVal('E13', cleanManager);
        setVal('E14', reportDate);
        setVal('E15', project.no_cuenta || '');
        setVal('E16', project.num_contrato || '');
        setVal('I28', project.eligible_toll_credits ? 'YES' : 'NO');
        setVal('E17', trueChoList.filter((c: any) => c.cho_num !== undefined).length || 0);
        setVal('E18', ewoList.length || 0);
        setVal('E18', ewoList.length || 0);

        // Performance Metrics (T Column)
        const startDate = project.date_project_start ? new Date(project.date_project_start + "T00:00:00") : null;
        const origEndDate = project.date_orig_completion ? new Date(project.date_orig_completion + "T23:59:59") : null;
        const subEndDate = project.date_substantial_completion ? new Date(project.date_substantial_completion + "T23:59:59") : null;
        const revEndDateVal = project.date_rev_completion ? new Date(project.date_rev_completion + "T23:59:59") : null;

        let totalDays = 0;
        if (startDate && origEndDate) {
            totalDays = Math.ceil((origEndDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
        }

        const approvedDays = trueChoList.reduce((acc: number, c: any) => acc + (c.time_extension_days || 0), 0);
        const revisedDays = totalDays + approvedDays;

        // usedDays logic from Summary Dashboard
        let timeEndDate = new Date();
        if (project.date_substantial_completion) {
            timeEndDate = new Date(project.date_substantial_completion + "T23:59:59");
        } else if (project.date_real_completion) {
            timeEndDate = new Date(project.date_real_completion + "T23:59:59");
        }

        let usedDays = 0;
        if (startDate) {
            usedDays = Math.ceil((timeEndDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
        }
        if (usedDays < 0) usedDays = 0;
        const balanceDays = revisedDays - usedDays;

        // Revised End Date (Calculated if not present)
        const revEnd = revEndDateVal || (origEndDate ? new Date(origEndDate.getTime() + approvedDays * 86400000) : null);

        // Admin End Date (+2 years from revised)
        let adminEnd = null;
        if (revEnd) {
            adminEnd = new Date(revEnd.getTime());
            adminEnd.setFullYear(adminEnd.getFullYear() + 2);
        }

        // Cost Metrics for % Work
        const originalCost = parseFloat(project.cost_original) || 0;
        const totalMods = trueChoList.reduce((acc: number, c: any) => acc + (parseFloat(c.proposed_change) || 0), 0);
        const totalRevisedCost = originalCost + totalMods;
        const totalCertified = certs.reduce((acc: number, c: any) => {
            const certItems = Array.isArray(c.items) ? c.items : (c.items?.list || []);
            return acc + certItems.reduce((s: number, it: any) => s + (parseFloat(it.quantity) * parseFloat(it.unit_price) || 0), 0);
        }, 0);

        const roundedAmt = (num: number, dec: number) => Math.round(num * Math.pow(10, dec)) / Math.pow(10, dec);

        const percentChangeDays = totalDays > 0 ? (approvedDays / totalDays) : 0;
        const percentTime = revisedDays > 0 ? (usedDays / revisedDays) : 0;
        const percentChangeCost = originalCost > 0 ? (totalMods / originalCost) : 0;
        const percentWork = totalRevisedCost > 0 ? (totalCertified / totalRevisedCost) : 0;

        if (startDate) setVal('T8', startDate);
        setVal('T9', totalDays > 0 ? totalDays : 0);
        if (origEndDate) setVal('T10', origEndDate);
        setVal('T11', approvedDays);
        if (revEnd) setVal('T12', revEnd);
        setVal('T13', roundedAmt(percentChangeDays * 100, 2) / 100);
        setVal('T14', roundedAmt(percentTime * 100, 2) / 100);
        setVal('T15', roundedAmt(percentChangeCost * 100, 2) / 100);
        setVal('T16', roundedAmt(percentWork * 100, 2) / 100);
        // T17: Estimated Completion (uses date_est_completion or fallback)
        const estimatedCompletion = project.date_est_completion ? new Date(project.date_est_completion + "T23:59:59") : (subEndDate || revEnd);
        if (estimatedCompletion) setVal('T17', estimatedCompletion);
        if (adminEnd) setVal('T18', adminEnd);

        // --- Original Funds (31-63) ---
        let originalTotal = 0;
        let originalFederal = 0;
        let sumF = 0, sumG = 0, sumH = 0, sumJ = 0, sumQ = 0, sumR = 0, sumS = 0, sumT = 0, sumU = 0, sumV = 0, sumW = 0, sumX = 0, sumY = 0;
        let rowF = 35;
        (agreementFunds || []).forEach((fund: any) => {
            if (rowF > 44) return;
            const participating = parseFloat(fund.participating) || 0;
            const contParticipating = parseFloat(fund.contingencies_participating) || 0;
            const payroll = parseFloat(fund.payroll_mileage_diets) || 0;
            const faRequested = parseFloat(fund.fa_funds_requested) || 0;
            const notParticipating = parseFloat(fund.not_participating_state) || 0;
            const countNotPart = parseFloat(fund.contingencies_not_participating) || 0;
            const payrollState = parseFloat(fund.payroll_mileage_diets_state) || 0;
            const federalCont = parseFloat(fund.contingencies_federal) || 0;
            let tollCredits = parseFloat(fund.calc_toll_credits) || 0;
            let tollCont = parseFloat(fund.contingencies_toll) || 0;
            let stateShareFed = parseFloat(fund.state_share_federal) || 0;
            let stateCont = parseFloat(fund.contingencies_state_share) || 0;

            // Skip rows with no financial data at all
            if (participating === 0 && contParticipating === 0 && payroll === 0 && 
                faRequested === 0 && notParticipating === 0 && countNotPart === 0 && 
                payrollState === 0 && federalCont === 0 &&
                tollCredits === 0 && tollCont === 0 && stateShareFed === 0 && stateCont === 0) {
                return;
            }

            // Step 1: Fed Share % Calculation (matching template logic roughly)
            const totalInitial = participating + contParticipating + payroll;
            // Template: IF(K35>0,(K35)/(E35+G35+I35),"N/A")
            // where K is fa_funds_requested, E is participating, G is cont part, I is payroll.
            const fedPct = (participating + contParticipating + payroll) > 0
                ? (faRequested / (participating + contParticipating + payroll))
                : 0;

            // Section 1: Input (E to J)
            setVal(`E${rowF}`, participating).numFmt = '"$"#,##0.00';
            setVal(`F${rowF}`, participating).numFmt = '"$"#,##0.00';
            setVal(`G${rowF}`, contParticipating).numFmt = '"$"#,##0.00';
            setVal(`H${rowF}`, contParticipating).numFmt = '"$"#,##0.00';
            setVal(`I${rowF}`, payroll).numFmt = '"$"#,##0.00';
            setVal(`J${rowF}`, payroll).numFmt = '"$"#,##0.00';

            // Middle: Colored (K to P) - CALCULATED
            setVal(`B${rowF}`, fund.unit_name);
            setVal(`C${rowF}`, fedPct).numFmt = '0.00%';
            setVal(`D${rowF}`, fedPct).numFmt = '0.00%';

            // K: F.A. Funds Requested (Set from Input)
            setVal(`K${rowF}`, faRequested).numFmt = '"$"#,##0.00';

            // L: Contingencies (Federal Funds) = ROUND(G35 * C35, 2)
            const fedCont = Math.round((contParticipating * fedPct) * 100) / 100;
            setVal(`L${rowF}`, fedCont).numFmt = '"$"#,##0.00';

            // M/N: Toll Credits IF Eligible ELSE 0 (ROUND(E35 * (1-C35), 2))
            const isToll = project.eligible_toll_credits === true;
            tollCredits = isToll ? Math.round((participating * (1 - fedPct)) * 100) / 100 : 0;
            tollCont = isToll ? Math.round((contParticipating * (1 - fedPct)) * 100) / 100 : 0;
            setVal(`M${rowF}`, tollCredits).numFmt = '"$"#,##0.00';
            setVal(`N${rowF}`, tollCont).numFmt = '"$"#,##0.00';

            // O/P: State Share (Same logic but if NOT Toll Credits usually? Or matching template logic)
            // Template O35: ROUND(IF($I$28="NO",IF(C35="N/A",0,(E35+G35+I35)*(1-C35)),0),2)
            stateShareFed = !isToll ? Math.round((totalInitial * (1 - fedPct)) * 100) / 100 : 0;
            stateCont = !isToll ? Math.round((contParticipating * (1 - fedPct)) * 100) / 100 : 0;
            setVal(`O${rowF}`, stateShareFed).numFmt = '"$"#,##0.00';
            setVal(`P${rowF}`, stateCont).numFmt = '"$"#,##0.00';

            // Section 2: State Funds Input (Q to U)
            setVal(`Q${rowF}`, notParticipating).numFmt = '"$"#,##0.00';
            setVal(`R${rowF}`, countNotPart).numFmt = '"$"#,##0.00';
            setVal(`S${rowF}`, countNotPart).numFmt = '"$"#,##0.00';
            setVal(`T${rowF}`, payrollState).numFmt = '"$"#,##0.00';
            setVal(`U${rowF}`, payrollState).numFmt = '"$"#,##0.00';

            // Totals V, W, X, Y
            setVal(`V${rowF}`, null); // Clear Col V as requested
            setVal(`W${rowF}`, tollCont).numFmt = '"$"#,##0.00';
            const totalStateLocal = stateShareFed + stateCont + notParticipating + countNotPart + payrollState;
            setVal(`X${rowF}`, totalStateLocal).numFmt = '"$"#,##0.00';
            setVal(`Y${rowF}`, totalStateLocal + tollCredits + tollCont).numFmt = '"$"#,##0.00';

            // Update running sums for row 61
            sumF += fedCont;
            sumG += participating; // For H61 actually
            sumH += totalInitial; // wait, let's keep it simple
            sumJ += faRequested;
            sumQ += stateShareFed;
            sumR += stateCont;
            sumS += notParticipating;
            sumT += countNotPart;
            sumU += payrollState;
            sumV += tollCredits;
            sumW += tollCont;
            sumX += totalStateLocal;
            sumY += (totalStateLocal + tollCredits + tollCont);

            originalTotal += participating;
            originalFederal += (faRequested + fedCont);

            rowF++;
        });

        // Sum row 61
        setVal('E61', (agreementFunds as any[]).reduce((a, b) => a + (parseFloat(b.participating) || 0), 0)).numFmt = '"$"#,##0.00';
        setVal('G61', (agreementFunds as any[]).reduce((a, b) => a + (parseFloat(b.contingencies_participating) || 0), 0)).numFmt = '"$"#,##0.00';
        setVal('I61', (agreementFunds as any[]).reduce((a, b) => a + (parseFloat(b.payroll_mileage_diets) || 0), 0)).numFmt = '"$"#,##0.00';
        setVal('K61', (agreementFunds as any[]).reduce((a, b) => a + (parseFloat(b.fa_funds_requested) || 0), 0)).numFmt = '"$"#,##0.00';
        setVal('L61', sumF).numFmt = '"$"#,##0.00';
        setVal('M61', sumV).numFmt = '"$"#,##0.00';
        setVal('N61', sumW).numFmt = '"$"#,##0.00';
        setVal('O61', sumQ).numFmt = '"$"#,##0.00';
        setVal('P61', sumR).numFmt = '"$"#,##0.00';
        setVal('Q61', sumS).numFmt = '"$"#,##0.00';
        setVal('R61', sumT).numFmt = '"$"#,##0.00';
        setVal('T61', sumU).numFmt = '"$"#,##0.00';
        setVal('X61', sumX).numFmt = '"$"#,##0.00';
        setVal('Y61', sumY).numFmt = '"$"#,##0.00';

        // Merge and Label Totals in Row 61 (B-D)
        try { ws.mergeCells('B61:D61'); } catch (e) { /* already merged */ }
        const totalsCell = ws.getCell('B61');
        totalsCell.value = 'Totals';
        totalsCell.alignment = { horizontal: 'center', vertical: 'middle' } as any;
        totalsCell.font = { ...totalsCell.font, bold: true };

        // --- Font size adjustment B31:U63 ---
        for (let r = 31; r <= 63; r++) {
            const row = ws.getRow(r);
            for (let c = 2; c <= 25; c++) { // B to Y
                const cell = row.getCell(c);
                if (!cell.font) cell.font = {};
                cell.font = { ...cell.font, size: 10 };
            }
        }

        // --- Modification List (70+) ---
        let modRow = 70;
        let totalModAmount = 0;
        let totalFedModShare = 0;

        for (let i = 0; i < chosToInclude.length && modRow < 220; i++) {
            const cho = chosToInclude[i];
            const amount = parseFloat(cho.proposed_change) || 0;
            const fedPct = (cho.federal_share_pct != null ? parseFloat(cho.federal_share_pct) : defaultFedPct) / 100;
            const fedAmt = amount * fedPct;

            totalModAmount += amount;
            totalFedModShare += fedAmt;

            const isEWO = cho.cho_num === null || cho.amendment_letter?.includes('EWO');
            if (isEWO) setVal(`C${modRow}`, cho.amendment_letter?.replace('EWO', '').trim() || 'EWO');
            else setVal(`B${modRow}`, parseFloat(cho.cho_num) || cho.cho_num);

            try { ws.mergeCells(`D${modRow}:F${modRow}`); } catch (e) { }
            setVal(`D${modRow}`, amount).numFmt = '"$"#,##0.00';
            setVal(`G${modRow}`, fedPct).numFmt = '0.00%';
            try { ws.mergeCells(`H${modRow}:J${modRow}`); } catch (e) { }
            setVal(`H${modRow}`, fedAmt).numFmt = '"$"#,##0.00';

            modRow++;
        }

        // Summary calculations
        const grandTotal = originalTotal + totalModAmount;
        const grandFederalTotal = originalFederal + totalFedModShare;
        const grandStateTotal = grandTotal - grandFederalTotal;

        // Row 223: Modification Totals
        // (Existing H223 already set below)

        // Row 225: Modification Total Amount (B225)
        setVal('E225', totalModAmount).numFmt = '"$"#,##0.00';

        // Row 227-229: Grand Totals
        setVal('E227', grandTotal).numFmt = '"$"#,##0.00';
        setVal('E228', grandFederalTotal).numFmt = '"$"#,##0.00';
        setVal('E229', grandStateTotal).numFmt = '"$"#,##0.00';

        // Row 223 Federals
        try { ws.mergeCells('H223:J223'); } catch (e) { }
        setVal('H223', totalFedModShare).numFmt = '"$"#,##0.00';

        // Wipe yellow cells
        ws.eachRow((row) => {
            row.eachCell({ includeEmpty: true }, (cell) => {
                const f = cell.fill;
                if (f && f.type === 'pattern' && f.fgColor && (f.fgColor.argb === 'FFFFFF00' || f.fgColor.argb === 'FFFF00')) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
                }
            });
        });

        const buffer = await wb.xlsx.writeBuffer();
        return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    } catch (err: any) {
        console.error("CCML Generation error:", err);
        throw err;
    }
}
