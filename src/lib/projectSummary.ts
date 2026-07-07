// @UNIFICATION_RESUMEN_PACT
// Marca de unificación de reportes - Fuente de datos: Sección Resumen
// Creado por solicitud de Enrique Sada para consolidar y centralizar los cálculos del Dashboard.

import { supabase } from "./supabase";
import { roundedAmt, getFederalSharePct } from "./utils";

export interface ProjectSummaryMetrics {
    time: {
        total: number;
        used: number;
        revised: number;
        balance: number;
        percent: number;
    };
    dates: {
        start: string;
        original: string;
        revised: string;
        substantial: string;
        administrative: string;
        fmis: string;
    };
    retention: {
        fivePercent: number;
        lastRetentionAmount: number;
        extra: number;
        priceAdjustment: number;
        insuranceFines: number;
        otherPenalties: number;
        returned: number;
        total: number;
    };
    cost: {
        original: number;
        revisedTotal: number;
        certTotal: number;
        lastCertAmount: number;
        lastCertNum: number;
        lastCertDate: string;
        balance: number;
        percentObra: number;
        actTotal: number;
        fhwaTotal: number;
        actProjected: number;
        fhwaProjected: number;
        materialOnSite: number;
        mosBalances: { item_num: string, balance: number, mosPU?: number }[];
        mosTotalQty: number;
        priceAdjustment: number;
    };
    chos: {
        approvedTotal: number;
        approvedCount: number;
        approvedDays: number;
        pendingTotal: number;
        pendingCount: number;
        pendingDays: number;
        total: number;
        totalDays: number;
        percentChange: number;
        percentDays: number;
    };
    penalties: {
        liquidated: number;
        dlqReimbursement: number;
        security: number;
        others: number;
        total: number;
    };
    liquidation: {
        totalItems: number;
        adminSigned: number;
        contractorSigned: number;
        liquidatorSigned: number;
        percent: number;
        federalDocs: string[];
        adminSignedCount: number;
        contractorSignedCount: number;
        liquidatorSignedCount: number;
    };
}

export function calculateSummaryMetrics(proj: any, items: any[], chos: any[], certs: any[]): ProjectSummaryMetrics {
    const allReferenceItems: any[] = [...(items || [])];
    const approvedCHOs = chos?.filter(c => c.doc_status === 'Aprobado') || [];
    approvedCHOs.forEach(cho => {
        if (Array.isArray(cho.items)) {
            cho.items.forEach((it: any) => {
                const exists = allReferenceItems.find(r => r.item_num === it.item_num);
                if (!exists) allReferenceItems.push(it);
            });
        }
    });

    const totalItemsCount = items?.length || 0;
    // Soportamos tanto 'En tramite' como 'En trámite'
    const pendingCHOs = chos?.filter(c => c.doc_status === 'En tramite' || c.doc_status === 'En trámite') || [];

    const originalCost = proj?.cost_original || items?.reduce((acc, item) => roundedAmt(acc + roundedAmt(item.quantity * item.unit_price, 2), 2), 0) || 0;

    const approvedCHO = approvedCHOs.reduce((acc, c) => roundedAmt(acc + parseFloat(c.proposed_change || '0'), 2), 0);
    const pendingCHO = pendingCHOs.reduce((acc, c) => roundedAmt(acc + parseFloat(c.proposed_change || '0'), 2), 0);
    const approvedDays = approvedCHOs.reduce((acc, c) => acc + (c.time_extension_days || 0), 0);
    const pendingDays = pendingCHOs.reduce((acc, c) => acc + (c.time_extension_days || 0), 0);

    const getCHOQtyForItem = (itemNum: string) =>
        approvedCHOs.reduce((total, cho) => {
            if (!Array.isArray(cho.items)) return total;
            return cho.items.reduce((sum: number, it: any) =>
                it.item_num === itemNum ? roundedAmt(sum + (parseFloat(it.quantity) || 0), 2) : sum
            , total);
        }, 0);

    const revisedContractTotal = (items || []).reduce((sum, item) => {
        const choQty = getCHOQtyForItem(item.item_num);
        const totalQty = (parseFloat(item.quantity) || 0) + choQty;
        return roundedAmt(sum + roundedAmt(totalQty * (parseFloat(item.unit_price) || 0), 2), 2);
    }, 0);

    let actTotal = 0;
    let fhwaTotal = 0;
    let actProjected = 0;
    let fhwaProjected = 0;

    items?.forEach((item: any) => {
        const amount = roundedAmt((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0), 2);
        const fedPct = getFederalSharePct(proj, item);
        const fhwaShare = roundedAmt(amount * (fedPct / 100), 2);
        const actShare = roundedAmt(amount - fhwaShare, 2);
        
        actProjected = roundedAmt(actProjected + actShare, 2);
        fhwaProjected = roundedAmt(fhwaProjected + fhwaShare, 2);
    });

    chos?.forEach((cho: any) => {
        if (cho.items && Array.isArray(cho.items)) {
            cho.items.forEach((item: any) => {
                const amount = roundedAmt((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0), 2);
                const fedPct = getFederalSharePct(proj, item);
                const fhwaShare = roundedAmt(amount * (fedPct / 100), 2);
                const actShare = roundedAmt(amount - fhwaShare, 2);
                
                actProjected = roundedAmt(actProjected + actShare, 2);
                fhwaProjected = roundedAmt(fhwaProjected + fhwaShare, 2);
            });
        }
    });

    let lastCertAmount = 0;
    let lastCertRetention = 0;
    let lastCertNum = 0;
    let lastCertDate = "";
    let totalRetentionDeducted = 0;
    let totalRetentionReturned = 0;
    let totalExtraRetention = 0;
    let totalPriceAdjustment = 0;
    let totalInsuranceFines = 0;
    let totalOtherPenalties = 0;
    let totalRefund = 0;
    let totalLiquidatedDamagesCerts = 0;
    let totalCertDirecto = 0;

    const getInvoicePU = (certsList: any[], itemNum: string, currentCertIdx: number) => {
        for (let i = currentCertIdx; i >= 0; i--) {
            if (!certsList[i]) continue;
            if (certsList[i].excluded) continue;
            const its = Array.isArray(certsList[i].items) ? certsList[i].items : (certsList[i].items?.list || []);
            const match = its.find((itx: any) => itx.item_num === itemNum && itx.has_material_on_site && parseFloat(itx.mos_unit_price) > 0);
            if (match) return parseFloat(match.mos_unit_price);
        }
        return 0;
    };

    const perItemMosBalance: Record<string, number> = {};

    certs?.forEach((cert: any, cIdx: number) => {
        if (cert.excluded) return;

        const certItems = Array.isArray(cert.items) ? cert.items : (cert.items?.list || []);
        let certAmount = 0;

        certItems.forEach((item: any) => {
            const itemNum = item.item_num;
            if (!itemNum) return;

            const qty = parseFloat(item.quantity) || 0;
            const up = parseFloat(item.unit_price) || 0;
            const amount = roundedAmt(qty * up, 2);

            const fedPct = getFederalSharePct(proj, item);
            const fhwaShare = roundedAmt(amount * (fedPct / 100), 2);
            const actShare = roundedAmt(amount - fhwaShare, 2);
            
            fhwaTotal = roundedAmt(fhwaTotal + fhwaShare, 2);
            actTotal = roundedAmt(actTotal + actShare, 2);
            certAmount = roundedAmt(certAmount + amount, 2);
            totalCertDirecto = roundedAmt(totalCertDirecto + amount, 2);

            const manualDeductionQty = parseFloat(item.qty_from_mos) || 0;
            const hasAddition = !!item.has_material_on_site || (item.mos_invoice_total && parseFloat(item.mos_invoice_total) > 0);
            
            const currentBalance = perItemMosBalance[itemNum] || 0;
            const mosPU = getInvoicePU(certs, itemNum, cIdx);
            const price = mosPU > 0 ? mosPU : up;

            // Incluir la adición de esta misma cert al balance disponible para deducción
            const additionCostThisCert = hasAddition ? (parseFloat(item.mos_invoice_total) || 0) : 0;
            const balanceForDeduction = currentBalance + additionCostThisCert;
            
            let deductionQty = 0;
            if (balanceForDeduction > 0.01) {
                const availableQty = balanceForDeduction / (price || 1);
                if (manualDeductionQty > 0) {
                    deductionQty = Math.min(manualDeductionQty, availableQty);
                } else if (qty > 0) {
                    deductionQty = Math.min(qty, availableQty);
                }
            }

            if (hasAddition) {
                const cost = parseFloat(item.mos_invoice_total) || 0;
                perItemMosBalance[itemNum] = roundedAmt(currentBalance + cost, 2);
            }

            if (deductionQty > 0) {
                const cost = roundedAmt(deductionQty * price, 2);
                const newBal = roundedAmt((perItemMosBalance[itemNum] || 0) - cost, 2);
                perItemMosBalance[itemNum] = Math.max(0, newBal);
            }
        });

        let certRetentionAmount = 0;
        if (!cert.skip_retention) {
            certItems.forEach((item: any) => {
                if (item.skip_retention !== true && item.skip_retention !== 'true') {
                    const itemAmt = roundedAmt((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0), 2);
                    const retItem = roundedAmt(itemAmt * 0.05, 2);
                    certRetentionAmount = roundedAmt(certRetentionAmount + retItem, 2);
                    totalRetentionDeducted = roundedAmt(totalRetentionDeducted + retItem, 2);
                }
            });
        }

        if ((cert.cert_num || 0) > lastCertNum) {
            lastCertNum = cert.cert_num;
            lastCertAmount = certAmount;
            lastCertDate = cert.cert_date || "";
            lastCertRetention = certRetentionAmount;
        }
        if (cert.show_retention_return && cert.retention_return_amount) {
            totalRetentionReturned = roundedAmt(totalRetentionReturned + (parseFloat(cert.retention_return_amount) || 0), 2);
        }

        totalExtraRetention = roundedAmt(totalExtraRetention + (parseFloat(String(cert.extra_retention ?? '').replace(/,/g, '')) || 0), 2);
        totalPriceAdjustment = roundedAmt(totalPriceAdjustment + (parseFloat(cert.price_adjustment) || 0), 2);
        totalInsuranceFines = roundedAmt(totalInsuranceFines + (parseFloat(cert.insurance_fines) || 0), 2);
        totalOtherPenalties = roundedAmt(totalOtherPenalties + (parseFloat(cert.other_penalties) || 0), 2);
        totalRefund = roundedAmt(totalRefund + (parseFloat(String(cert.refund ?? '').replace(/,/g, '')) || 0), 2);
        totalLiquidatedDamagesCerts = roundedAmt(totalLiquidatedDamagesCerts + (parseFloat(String(cert.liquidated_damages ?? '').replace(/,/g, '')) || 0), 2);
    });

    const mosEntries = Object.entries(perItemMosBalance)
        .filter(([_, balance]) => balance > 0.01)
        .map(([item_num, balance]) => {
            // Buscar el PU de MOS para este item
            let lastPU = 0;
            const safeCerts = certs || [];
            for (let i = safeCerts.length - 1; i >= 0; i--) {
                if (safeCerts[i].excluded) continue;
                const its = Array.isArray(safeCerts[i].items) ? safeCerts[i].items : (safeCerts[i].items?.list || []);
                const match = its.find((itx: any) => itx.item_num === item_num && itx.has_material_on_site && parseFloat(itx.mos_unit_price) > 0);
                if (match) {
                    lastPU = parseFloat(match.mos_unit_price);
                    break;
                }
            }
            return { item_num, balance, mosPU: lastPU };
        });
    const mosTotal = roundedAmt(mosEntries.reduce((acc, e) => roundedAmt(acc + e.balance, 2), 0), 2);
    const mosTotalQty = mosEntries.reduce((acc, e) => {
        const it = allReferenceItems.find(r => r.item_num === e.item_num);
        const pu = e.mosPU || it?.unit_price || 1;
        return acc + (e.balance / pu);
    }, 0);

    const certified = totalCertDirecto;
    actTotal = roundedAmt(certified - fhwaTotal, 2);
    const startDate = proj?.date_project_start ? new Date(proj.date_project_start + "T00:00:00") : null;
    const origEndDate = proj?.date_orig_completion ? new Date(proj.date_orig_completion + "T00:00:00") : null;
    
    let totalDays = 0;
    if (startDate && origEndDate && !isNaN(startDate.getTime()) && !isNaN(origEndDate.getTime())) {
        totalDays = Math.round((origEndDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1;
    }

    let timeEndDate = new Date();
    timeEndDate.setHours(0, 0, 0, 0);
    if (proj?.date_substantial_completion) {
        timeEndDate = new Date(proj.date_substantial_completion + "T00:00:00");
    } else if (proj?.date_real_completion) {
        timeEndDate = new Date(proj.date_real_completion + "T00:00:00");
    }

    let usedDays = 0;
    if (startDate && !isNaN(startDate.getTime()) && !isNaN(timeEndDate.getTime())) {
        usedDays = Math.round((timeEndDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1;
    }
    if (usedDays < 0) usedDays = 0;
    
    const revisedDays = (totalDays || 0) + (approvedDays || 0);

    // Calcular fecha revisada = fecha de comienzo + dias revisados (originales + CHO)
    let revisedDateStr = "";
    if (startDate && !isNaN(startDate.getTime()) && revisedDays > 0) {
        const revCalc = new Date(startDate.getTime());
        revCalc.setDate(revCalc.getDate() + revisedDays - 1);
        revisedDateStr = revCalc.toISOString().split("T")[0];
    }

    let adminDateStr = "";
    const baseAdminDate = revisedDateStr || proj?.date_orig_completion;
    if (baseAdminDate) {
        const revDate = new Date(baseAdminDate + "T23:59:59");
        if (!isNaN(revDate.getTime())) {
            revDate.setFullYear(revDate.getFullYear() + 2);
            adminDateStr = revDate.toISOString().split("T")[0];
        }
    }

    const damAmt = parseFloat(proj?.liquidated_damages_amount || "500");
    const liqDamages = Math.max(0, ((usedDays || 0) - (revisedDays || 0)) * damAmt);

    const adminCount = proj?.liquidation_data?.admin_signed_count || 0;
    const contractorCount = proj?.liquidation_data?.contractor_signed_count || 0;
    const liquidatorCount = proj?.liquidation_data?.liquidator_signed_count || 0;
    const totalSigned = adminCount + contractorCount + liquidatorCount;
    const liqPercent = totalItemsCount > 0 ? Math.round((totalSigned / (totalItemsCount * 3)) * 100) : 0;

    return {
        time: {
            total: totalDays || 0,
            used: usedDays || 0,
            revised: revisedDays || 0,
            balance: (revisedDays || 0) - (usedDays || 0),
            percent: revisedDays > 0 ? roundedAmt((usedDays / revisedDays) * 100, 2) : 0
        },
        dates: {
            start: proj?.date_project_start || "",
            original: proj?.date_orig_completion || "",
            revised: revisedDateStr || "",
            substantial: proj?.date_substantial_completion || "",
            administrative: adminDateStr || "",
            fmis: proj?.fmis_end_date || ""
        },
        retention: {
            fivePercent: totalRetentionDeducted || 0,
            lastRetentionAmount: lastCertRetention || 0,
            extra: totalExtraRetention || 0,
            priceAdjustment: totalPriceAdjustment || 0,
            insuranceFines: totalInsuranceFines || 0,
            otherPenalties: totalOtherPenalties || 0,
            returned: totalRetentionReturned || 0,
            total: roundedAmt(totalRetentionDeducted - totalRetentionReturned + totalExtraRetention + totalInsuranceFines + totalOtherPenalties - totalPriceAdjustment - totalRefund + liqDamages + totalLiquidatedDamagesCerts, 2)
        },
        cost: {
            original: originalCost || 0,
            revisedTotal: revisedContractTotal || 0,
            certTotal: certified || 0,
            lastCertAmount: lastCertAmount || 0,
            lastCertNum: lastCertNum || 0,
            lastCertDate: lastCertDate || "",
            balance: roundedAmt(((originalCost || 0) + (approvedCHO || 0)) - (certified || 0), 2),
            percentObra: ((originalCost || 0) + (approvedCHO || 0)) > 0 ? roundedAmt(((certified || 0) / ((originalCost || 0) + (approvedCHO || 0))) * 100, 2) : 0,
            actTotal: actTotal || 0,
            fhwaTotal: fhwaTotal || 0,
            actProjected: actProjected || 0,
            fhwaProjected: fhwaProjected || 0,
            materialOnSite: mosTotal,
            mosBalances: mosEntries,
            mosTotalQty: mosTotalQty,
            priceAdjustment: totalPriceAdjustment || 0,
        },
        chos: {
            approvedTotal: approvedCHO || 0,
            approvedCount: approvedCHOs?.length || 0,
            approvedDays: approvedDays || 0,
            pendingTotal: pendingCHO || 0,
            pendingCount: pendingCHOs?.length || 0,
            pendingDays: pendingDays || 0,
            total: roundedAmt((approvedCHO || 0) + (pendingCHO || 0), 2),
            totalDays: (approvedDays || 0) + (pendingDays || 0),
            percentChange: (originalCost || 0) > 0 ? Math.round(((approvedCHO || 0) / (originalCost || 0)) * 100) : 0,
            percentDays: (totalDays || 0) > 0 ? Math.round(((approvedDays || 0) / (totalDays || 0)) * 100) : 0,
        },
        penalties: {
            liquidated: liqDamages + totalLiquidatedDamagesCerts,
            dlqReimbursement: totalRefund || 0,
            security: totalInsuranceFines || 0,
            others: totalOtherPenalties || 0,
            total: roundedAmt(liqDamages + totalLiquidatedDamagesCerts + totalInsuranceFines + totalOtherPenalties, 2)
        },
        liquidation: {
            totalItems: totalItemsCount,
            adminSigned: adminCount,
            contractorSigned: contractorCount,
            liquidatorSigned: liquidatorCount,
            percent: liqPercent,
            federalDocs: proj?.liquidation_data?.federal_docs || [],
            adminSignedCount: adminCount,
            contractorSignedCount: contractorCount,
            liquidatorSignedCount: liquidatorCount
        }
    };
}

export async function fetchProjectSummary(projectId: string): Promise<{ project: any, metrics: ProjectSummaryMetrics }> {
    const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).single();
    const { data: items } = await supabase.from("contract_items").select("*").eq("project_id", projectId);
    const { data: chos } = await supabase.from("chos").select("proposed_change, doc_status, time_extension_days, items").eq("project_id", projectId);
    const { data: certs } = await supabase
        .from("payment_certifications")
        .select("cert_num, cert_date, items, skip_retention, show_retention_return, retention_return_amount, extra_retention, price_adjustment, insurance_fines, other_penalties, refund, excluded, liquidated_damages")
        .eq("project_id", projectId)
        .order("cert_num", { ascending: true });

    const metrics = calculateSummaryMetrics(project, items || [], chos || [], certs || []);
    return { project, metrics };
}

// @UNIFICATION_RESUMEN_PACT_END
