import ExcelJS from 'exceljs';
import { formatDate, getFederalSharePct, sortItemsNaturally, uniqueSortItems, formatItemNum } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

/**
 * Genera el reporte ACT-122B utilizando las instrucciones MAESTRAS de Enrique Saavedra Sada, PE.
 * Mapeo de celdas según la tabla oficial Rev 12/2024 proporcionada por el usuario.
 */
export async function generateAct122B(
    projectId: string,
    choId: string,
    isFinal?: boolean
): Promise<Blob> {
    try {
        const { data: projData } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (!projData) throw new Error("Proyecto no encontrado");
        
        const { data: contrData } = await supabase.from('contractors').select('*').eq('project_id', projectId).single();
        const { data: choData } = await supabase.from('chos').select('*').eq('id', choId).single();
        const { data: allChos } = await supabase.from('chos').select('*').eq('project_id', projectId).order('cho_num', { ascending: true });
        
        const { data: personnel } = await supabase.from('act_personnel').select('*').eq('project_id', projectId);
        const personnelMap: Record<string, string> = {};
        personnel?.forEach(p => { personnelMap[p.role] = p.name; });

        if (!choId || !choData) throw new Error("CHO no encontrado");

        // Usar la plantilla nueva copiada (Rev 12-2024)
        const response = await fetch('/ACT-122B_Template.xlsx');
        if (!response.ok) throw new Error(`Plantilla ACT-122B no encontrada`);
        const templateBuf = await response.arrayBuffer();

        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(templateBuf);
        const templateWs = wb.getWorksheet('ACT-122');
        if (!templateWs) throw new Error('No se encontró la hoja "ACT-122" en la plantilla');

        // --- CÁLCULOS ---
        const roundedAmt = (val: number, dec: number) => Math.round(val * Math.pow(10, dec)) / Math.pow(10, dec);
        let prevExtDays = 0;
        let prevCostMods = 0;
        const currentChoNum = parseFloat(choData.cho_num);
        if (allChos) {
            for (const c of allChos) {
                const loopNum = parseFloat(c.cho_num);
                if (loopNum < currentChoNum) {
                    prevExtDays += (parseInt(c.time_extension_days) || 0);
                    prevCostMods += (parseFloat(c.proposed_change) || 0);
                }
            }
        }

        const originalCost = parseFloat(projData.cost_original) || 0;
        const actualContractAmount = originalCost + prevCostMods;
        
        let contractChoItems: any[] = [];
        let extraWorkItems: any[] = [];

        if (isFinal) {
            // 1. Obtener todas las certificaciones de pago del proyecto
            const { data: certs } = await supabase.from('payment_certifications').select('items').eq('project_id', projectId);
            
            // 2. Obtener las partidas de contrato originales
            const { data: contractItems } = await supabase.from('contract_items').select('*').eq('project_id', projectId);
            
            // Map para acumular cantidades certificadas
            const certQtyMap = new Map<string, number>();
            certs?.forEach(cert => {
                const cItems = Array.isArray(cert.items) ? cert.items : (cert.items?.list || []);
                cItems.forEach((it: any) => {
                    if (it.item_num) {
                        const qty = parseFloat(it.quantity) || 0;
                        certQtyMap.set(it.item_num, (certQtyMap.get(it.item_num) || 0) + qty);
                    }
                });
            });

            // Map para recopilar los datos básicos de todas las partidas posibles (originales + Extra Work de CHOs anteriores)
            const itemsMap = new Map<string, { item_num: string, specification: string, description: string, unit: string, unit_price: number, is_new: boolean }>();
            
            contractItems?.forEach(it => {
                itemsMap.set(it.item_num, {
                    item_num: it.item_num,
                    specification: it.specification || '',
                    description: it.description || '',
                    unit: it.unit || '',
                    unit_price: parseFloat(it.unit_price) || 0,
                    is_new: false
                });
            });

            // Agregar Extra Work creados en cualquier CHO anterior a este CHO Final
            allChos?.forEach(c => {
                const loopNum = parseFloat(c.cho_num);
                if (loopNum < currentChoNum) {
                    const cItems = Array.isArray(c.items) ? c.items : [];
                    cItems.forEach((it: any) => {
                        if (it.item_num && it.is_new) {
                            itemsMap.set(it.item_num, {
                                item_num: it.item_num,
                                specification: it.specification || '',
                                description: it.description || '',
                                unit: it.unit || '',
                                unit_price: parseFloat(it.unit_price) || 0,
                                is_new: true
                            });
                        }
                    });
                }
            });

            // Map para calcular la cantidad autorizada previa (Original + CHOs anteriores)
            const authQtyMap = new Map<string, number>();
            contractItems?.forEach(it => {
                authQtyMap.set(it.item_num, parseFloat(it.quantity) || 0);
            });

            allChos?.forEach(c => {
                const loopNum = parseFloat(c.cho_num);
                if (loopNum < currentChoNum) {
                    const cItems = Array.isArray(c.items) ? c.items : [];
                    cItems.forEach((it: any) => {
                        if (it.item_num) {
                            const change = parseFloat(it.proposed_change !== undefined ? it.proposed_change : it.quantity) || 0;
                            authQtyMap.set(it.item_num, (authQtyMap.get(it.item_num) || 0) + change);
                        }
                    });
                }
            });

            // Crear los items de ajuste del CHO Final
            const finalChoItems: any[] = [];
            itemsMap.forEach((it, itemNum) => {
                const qtyAuthPrev = authQtyMap.get(itemNum) || 0;
                const qtyCert = certQtyMap.get(itemNum) || 0;
                const adjustment = roundedAmt(qtyCert - qtyAuthPrev, 4);

                if (Math.abs(adjustment) > 0.0001) {
                    finalChoItems.push({
                        ...it,
                        proposed_change: adjustment,
                        quantity: qtyAuthPrev
                    });
                }
            });

            // Ordenar los items
            const sortedFinalItems = uniqueSortItems(finalChoItems);
            contractChoItems = sortedFinalItems.filter((it: any) => !it.is_new);
            extraWorkItems = sortedFinalItems.filter((it: any) => it.is_new);
        } else {
            const allItemsRaw = Array.isArray(choData.items) ? choData.items : [];
            const allItems = uniqueSortItems([...allItemsRaw]);
            contractChoItems = allItems.filter((it: any) => !it.is_new);
            extraWorkItems = allItems.filter((it: any) => it.is_new);
        }

        let currentChoAmount = parseFloat(choData.proposed_change) || 0;
        if (isFinal) {
            let tempAmt = 0;
            contractChoItems.forEach(it => { tempAmt += (it.proposed_change || 0) * (it.unit_price || 0); });
            extraWorkItems.forEach(it => { tempAmt += (it.proposed_change || 0) * (it.unit_price || 0); });
            currentChoAmount = roundedAmt(tempAmt, 2);
        }
        
        const newContractAmount = actualContractAmount + currentChoAmount;

        const origEnd = projData.date_orig_completion ? new Date(projData.date_orig_completion + "T00:00:00") : null;
        const dateRevisedBox10 = origEnd ? new Date(origEnd.getTime() + prevExtDays * 86400000) : null;
        const timeExt = parseInt(choData.time_extension_days) || 0;
        const dateNewBox12 = dateRevisedBox10 ? new Date(dateRevisedBox10.getTime() + timeExt * 86400000) : null;
        
        const adminDate = projData.date_rev_completion ? new Date(projData.date_rev_completion + "T00:00:00") : dateNewBox12;
        let adminEnd = adminDate ? new Date(adminDate) : null;
        if (adminEnd) {
            adminEnd = new Date(adminEnd.getTime() + 730 * 86400000); 
        }

        // Determinamos cuántas páginas necesitamos. 
        // Cada página tiene espacio para 5 ítems de contrato y 3 ítems extra.
        const totalPages = Math.max(
            Math.ceil(contractChoItems.length / 5), 
            Math.ceil(extraWorkItems.length / 3), 
            1
        );

        // --- FUNCIONES DE AYUDA ---
        const setVal = (ws: ExcelJS.Worksheet, addr: string, val: any, options: { bold?: boolean, center?: boolean, shrink?: boolean, fontSize?: number, color?: string } = {}) => {
            const cell = ws.getCell(addr);
            cell.value = val;
            
            let newFont = cell.font ? { ...cell.font } : {};
            if (options.fontSize) {
                newFont.size = options.fontSize;
            } else if (options.shrink && typeof val === 'string' && val.length > 25) {
                newFont.size = val.length > 45 ? 6 : 8;
            }
            
            if (typeof val === 'number' && val < 0) {
                newFont.color = { argb: 'FFFF0000' };
            }

            if (options.bold) {
                newFont.bold = true;
            }

            if (options.color) {
                newFont.color = { argb: options.color };
            }

            cell.font = newFont;
            
            let newAlignment = cell.alignment ? { ...cell.alignment } : {};
            if (options.center) {
                newAlignment.vertical = 'middle';
                newAlignment.horizontal = 'center';
                newAlignment.wrapText = true;
            } else if (options.shrink) {
                newAlignment.wrapText = true;
                newAlignment.vertical = 'middle';
            }
            if(Object.keys(newAlignment).length > 0) cell.alignment = newAlignment;

            return cell;
        };

        // Función para clonar el formato de la hoja maestra de forma segura
        const cloneSheetFormat = (source: ExcelJS.Worksheet, target: ExcelJS.Worksheet) => {
            // Copiar dimensiones de columnas
            source.columns.forEach((col, i) => {
                if (col.width) target.getColumn(i + 1).width = col.width;
            });

            // Copiar filas y estilos
            source.eachRow({ includeEmpty: true }, (row, rowNum) => {
                const newRow = target.getRow(rowNum);
                newRow.height = row.height;
                row.eachCell({ includeEmpty: true }, (cell, colNum) => {
                    const newCell = newRow.getCell(colNum);
                    // Copia profunda del estilo para asegurar que se traslada sin referencias mutables
                    newCell.style = JSON.parse(JSON.stringify(cell.style));
                    newCell.value = cell.value;
                });
            });

            // Copiar celdas combinadas usando el modelo oficial
            const sourceModel = (source as any).model;
            if (sourceModel && sourceModel.merges) {
                sourceModel.merges.forEach((mergeRange: string) => {
                    try { target.mergeCells(mergeRange); } catch(e) {}
                });
            }
        };

        const fillPage = (ws: ExcelJS.Worksheet, pageIndex: number, isLast: boolean) => {
            try { ws.unprotect(); } catch(e) {}

            // 1. Identificación y Proyecto
            setVal(ws, 'J8', projData.name || '', { shrink: true });
            setVal(ws, 'J9', contrData?.name || projData.contractor_name || '', { shrink: true });
            setVal(ws, 'J10', projData.num_act || '');
            setVal(ws, 'J11', projData.num_federal || 'N/A');
            setVal(ws, 'J12', projData.num_oracle || '');
            setVal(ws, 'J13', projData.num_contrato || '');
            setVal(ws, 'J14', choData.amendment_letter || '0', { color: 'FF000000' });
            setVal(ws, 'J15', choData.cho_num || '', { color: 'FF000000' });

            // 2. Tiempo
            const safeDate = (d: any) => (d instanceof Date && !isNaN(d.getTime())) ? d : null;

            setVal(ws, 'BA7', safeDate(choData.cho_date ? new Date(choData.cho_date + "T00:00:00") : null));
            setVal(ws, 'BA8', safeDate(projData.date_project_start ? new Date(projData.date_project_start + "T00:00:00") : null));
            setVal(ws, 'BA9', safeDate(dateRevisedBox10));
            setVal(ws, 'BA10', timeExt || 0);
            setVal(ws, 'BA11', choData.compensable_days !== undefined ? choData.compensable_days : 'N/A');
            // Encasillados 12 y 13 son fórmulas automáticas en Excel, por lo que NO escribimos en BA12 ni BA13.
            setVal(ws, 'BA14', safeDate(projData.fmis_end_date ? new Date(projData.fmis_end_date + "T00:00:00") : null));

            // 3. Checkboxes de Tipo (Sección 15)
            if (contractChoItems.length > 0) setVal(ws, 'B19', 'X', { center: true });
            if (extraWorkItems.length > 0) setVal(ws, 'V19', 'X', { center: true });
            if (timeExt > 0) setVal(ws, 'AN19', 'X', { center: true });

            // 4. Descripción / Scope del CHO (Sección 16)
            if (pageIndex === 0) {
                setVal(ws, 'B22', choData.description || projData.scope || '', { shrink: true, color: 'FF000000' });
            } else {
                setVal(ws, 'B22', '');
            }

            // 5. ÍTEMS
            const cStart = pageIndex * 5;
            const eStart = pageIndex * 3;
            
            // Items de Contrato (Filas 35-39)
            const pageContractItems = contractChoItems.slice(cStart, cStart + 5);
            for (let i = 0; i < 5; i++) {
                const it = pageContractItems[i];
                const currentRow = 35 + i;
                if (it) {
                    const qty = parseFloat(it.proposed_change !== undefined ? it.proposed_change : it.quantity) || 0;
                    const up = parseFloat(it.unit_price) || 0;
                    setVal(ws, `B${currentRow}`, formatItemNum(it.item_num));
                    setVal(ws, `E${currentRow}`, it.specification);
                    setVal(ws, `H${currentRow}`, it.description, { shrink: true });
                    setVal(ws, `AJ${currentRow}`, it.unit);
                    setVal(ws, `AN${currentRow}`, qty);
                    setVal(ws, `AT${currentRow}`, up);
                    setVal(ws, `AZ${currentRow}`, qty * up);
                    setVal(ws, `BF${currentRow}`, (getFederalSharePct(projData, it) / 100));
                } else {
                    ['B','E','H','AJ','AN','AT','AZ','BF'].forEach(col => setVal(ws, `${col}${currentRow}`, null));
                }
            }

            // Items Extra (Filas 42-44)
            const pageExtraItems = extraWorkItems.slice(eStart, eStart + 3);
            for (let i = 0; i < 3; i++) {
                const it = pageExtraItems[i];
                const currentRow = 42 + i;
                if (it) {
                    const qty = parseFloat(it.proposed_change !== undefined ? it.proposed_change : it.quantity) || 0;
                    const up = parseFloat(it.unit_price) || 0;
                    setVal(ws, `B${currentRow}`, formatItemNum(it.item_num));
                    setVal(ws, `E${currentRow}`, it.specification);
                    setVal(ws, `H${currentRow}`, it.description, { shrink: true });
                    setVal(ws, `AJ${currentRow}`, it.unit);
                    setVal(ws, `AN${currentRow}`, qty);
                    setVal(ws, `AT${currentRow}`, up);
                    setVal(ws, `AZ${currentRow}`, qty * up);
                    setVal(ws, `BF${currentRow}`, (getFederalSharePct(projData, it) / 100));
                } else {
                    ['B','E','H','AJ','AN','AT','AZ','BF'].forEach(col => setVal(ws, `${col}${currentRow}`, null));
                }
            }

            // 6. RESUMEN FINANCIERO
            // #26: Subtotales por página — suma solo de los ítems de ESTA página
            let pageContractSubtotal = 0;
            pageContractItems.forEach((it: any) => {
                const qty = parseFloat(it.proposed_change !== undefined ? it.proposed_change : it.quantity) || 0;
                const up = parseFloat(it.unit_price) || 0;
                pageContractSubtotal += qty * up;
            });
            let pageExtraSubtotal = 0;
            pageExtraItems.forEach((it: any) => {
                const qty = parseFloat(it.proposed_change !== undefined ? it.proposed_change : it.quantity) || 0;
                const up = parseFloat(it.unit_price) || 0;
                pageExtraSubtotal += qty * up;
            });

            setVal(ws, 'AZ40', pageContractSubtotal || 0);
            setVal(ws, 'AZ46', pageExtraSubtotal || 0);

            // #28, #29, #30: Totales finales del DOCUMENTO — en TODAS las páginas
            let grandTotalContract = 0;
            contractChoItems.forEach((it: any) => {
                const qty = parseFloat(it.proposed_change !== undefined ? it.proposed_change : it.quantity) || 0;
                const up = parseFloat(it.unit_price) || 0;
                grandTotalContract += qty * up;
            });
            let grandTotalExtra = 0;
            extraWorkItems.forEach((it: any) => {
                const qty = parseFloat(it.proposed_change !== undefined ? it.proposed_change : it.quantity) || 0;
                const up = parseFloat(it.unit_price) || 0;
                grandTotalExtra += qty * up;
            });

            setVal(ws, 'BA48', (grandTotalContract + grandTotalExtra) || 0);
            setVal(ws, 'BA49', actualContractAmount || 0);
            setVal(ws, 'BA50', newContractAmount || 0);

            // 7. FIRMAS (En todas las páginas para consistencia)
            setVal(ws, 'M48', personnelMap["Administrador del Proyecto"] || projData.resident_engineer_name || '', { shrink: true });
            setVal(ws, 'M50', contrData?.representative || contrData?.name || projData.contractor_name || '', { shrink: true });
            setVal(ws, 'M52', personnelMap["Supervisor de Área"] || projData.project_manager_name || '', { shrink: true });
            setVal(ws, 'M54', personnelMap["Director Regional"] || '', { shrink: true });
            setVal(ws, 'AL52', personnelMap["Director Oficina Construccion"] || '', { shrink: true });
            setVal(ws, 'M56', 'Ing. Edwin González Montalvo', { shrink: true }); // Director Ejecutivo o FHWA

            // 8. PÁGINA 2 (BACK)
            setVal(ws, 'K63', projData.name || '', { shrink: true });
            setVal(ws, 'K64', projData.num_act || '');
            setVal(ws, 'BC64', choData.amendment_letter || '0', { center: true });
            setVal(ws, 'AZ64', choData.cho_num || '', { center: true });

            // Restaurar visualmente los Radio Buttons de la fila 68 (que exceljs pierde)
            setVal(ws, 'H68', '○ Design');
            setVal(ws, 'R68', '○ Construction');
            setVal(ws, 'AB68', '○ Contract');
            setVal(ws, 'AL68', '○ Utilities');
            setVal(ws, 'AV68', '○ Other');

            // Numeración de página (59 y 117) en las celdas originales del template
            setVal(ws, 'Z59', ''); // Limpiar si es que habíamos escrito en la Z
            setVal(ws, 'Z117', '');
            
            // Fila 59
            setVal(ws, 'AA59', 'Page');
            setVal(ws, 'AE59', pageIndex + 1);
            setVal(ws, 'AG59', 'of');
            setVal(ws, 'AI59', totalPages);
            
            // Fila 117
            setVal(ws, 'AA117', 'Page');
            setVal(ws, 'AE117', pageIndex + 1);
            setVal(ws, 'AG117', 'of');
            setVal(ws, 'AI117', totalPages);
        };

        // Llenar página 1 (ya existe en el workbook como 'ACT-122')
        fillPage(templateWs, 0, totalPages === 1);

        // Crear y llenar páginas adicionales si es necesario
        for (let i = 1; i < totalPages; i++) {
            const newWs = wb.addWorksheet(`Sheet ${i + 1}`);
            cloneSheetFormat(templateWs, newWs);
            fillPage(newWs, i, i === totalPages - 1);
        }

        const buffer = await wb.xlsx.writeBuffer();
        return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    } catch (err: any) {
        console.error("ACT-122B Export error:", err);
        throw err;
    }
}



