import ExcelJS from 'exceljs';
import { supabase } from './supabase';
import { DOFAEI_TEMPLATE_BASE64 } from './dofaeiTemplate';

export async function generateDOFAEI(projectId: string, choId: string) {
    try {
        const { data: projData } = await supabase.from('projects').select('*').eq('id', projectId).single();
        const { data: choData } = await supabase.from('chos').select('*').eq('id', choId).single();
        
        if (!projData || !choData) throw new Error("Datos insuficientes");

        const dofaei = choData.dofaei_data || {};
        const determinations = dofaei.determination_conditions || {};
        const evaluations = dofaei.evaluations || {};
        const items = Array.isArray(choData.items) ? choData.items : [];

        // Para asegurar que cada página sea IDÉNTICA al original, 
        // vamos a crear un workbook final y añadir hojas copiando el contenido.
        // Pero dado que ExcelJS no copia estilos de forma nativa entre hojas de forma sencilla,
        // usaremos el enfoque de cargar el workbook original y trabajar sobre él.
        
        const finalWorkbook = new ExcelJS.Workbook();
        const bufferTemplate = Buffer.from(DOFAEI_TEMPLATE_BASE64, 'base64');

        const itemsPerPage = 5;
        const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));

        for (let p = 0; p < totalPages; p++) {
            // Cargamos un workbook temporal para cada página para tener el template limpio con estilos
            const tempWb = new ExcelJS.Workbook();
            await tempWb.xlsx.load(bufferTemplate);
            const sourceSheet = tempWb.getWorksheet(1);
            if (!sourceSheet) continue;

            fillSheet(sourceSheet, projData, choData, items, p, itemsPerPage, determinations, evaluations, dofaei);
            
            // Cambiamos el nombre de la hoja para diferenciar páginas
            sourceSheet.name = `Página ${p + 1}`;
            
            // Agregamos esta hoja al workbook final
            // ExcelJS no permite "mover" hojas, así que este enfoque requiere copiar.
            // MEJOR: Vamos a usar el workbook original y si necesitamos más de 5 ítems, 
            // avisamos o intentamos el duplicado manual de filas (que es muy complejo para celdas combinadas).
        }

        // DECISIÓN TÉCNICA: Para garantizar la perfección visual que exige Enrique, 
        // si hay más de 5 ítems, vamos a generar múltiples archivos o una hoja muy larga.
        // Pero Enrique pidió "paginas nuevas".
        
        // Voy a usar un enfoque de "Hojas" dentro del mismo Workbook.
        // Para que los estilos se mantengan, voy a cargar el template y llenar la hoja 1.
        // Si hay más de 5, cargaré otra hoja (si el template tuviera varias) o duplicaré.
        
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(bufferTemplate);
        
        // Llenamos la primera hoja con los primeros 5
        const firstSheet = workbook.getWorksheet(1);
        if (firstSheet) {
            fillSheet(firstSheet, projData, choData, items, 0, itemsPerPage, determinations, evaluations, dofaei);
            firstSheet.name = "Página 1";
        }

        // Si hay más ítems, creamos más hojas
        if (items.length > 5) {
            // Nota: Este es el límite de ExcelJS sin plugins de terceros para clonar hojas.
            // Voy a intentar rellenar hasta 15 ítems en la misma hoja si Enrique lo permite,
            // PERO la matriz se desordena. 
            // Así que voy a intentar clonar la hoja programáticamente celda a celda (lento pero seguro).
            
            for (let p = 1; p < totalPages; p++) {
                const newSheet = workbook.addWorksheet(`Página ${p + 1}`);
                // Clonar manualmente la hoja 1 a la hoja N (incluyendo celdas combinadas y estilos)
                // Esto es costoso pero es la única forma en ExcelJS de mantener la perfección.
                await cloneSheet(firstSheet!, newSheet);
                fillSheet(newSheet, projData, choData, items, p, itemsPerPage, determinations, evaluations, dofaei);
            }
        }

        const outBuffer = await workbook.xlsx.writeBuffer();
        return new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    } catch (err: any) {
        console.error("Error generating DOFAEI Excel:", err);
        throw err;
    }
}

async function cloneSheet(source: ExcelJS.Worksheet, target: ExcelJS.Worksheet) {
    // Copiar dimensiones de columnas
    source.columns.forEach((col, i) => {
        target.getColumn(i + 1).width = col.width;
    });

    // Copiar filas y celdas
    source.eachRow({ includeEmpty: true }, (row, rowNum) => {
        const newRow = target.getRow(rowNum);
        newRow.height = row.height;
        row.eachCell({ includeEmpty: true }, (cell, colNum) => {
            const newCell = newRow.getCell(colNum);
            newCell.value = cell.value;
            newCell.style = JSON.parse(JSON.stringify(cell.style)); // Copiar estilos
        });
    });

    // Copiar celdas combinadas (CRITICO para el formato de Enrique)
    // @ts-ignore
    const merges = source._merges || {};
    Object.values(merges).forEach((m: any) => {
        target.mergeCells(m.tl, m.br);
    });
}

function fillSheet(sheet: ExcelJS.Worksheet, projData: any, choData: any, allItems: any[], pageIdx: number, itemsPerPage: number, determinations: any, evaluations: any, dofaei: any) {
    const p = pageIdx;
    const startIdx = p * itemsPerPage;
    const pageItems = allItems.slice(startIdx, startIdx + itemsPerPage);

    // --- SECTION I: Project Information ---
    sheet.getCell('B17').value = projData.name || "";
    sheet.getCell('T17').value = projData.num_act || "";
    sheet.getCell('AK19').value = projData.num_federal || "";

    const roadClassif = dofaei.road_classif || "NHS";
    sheet.getCell('B14').value = roadClassif === "Interstate" ? "X" : "";
    sheet.getCell('T14').value = roadClassif === "NHS" ? "X" : "";
    sheet.getCell('AK14').value = roadClassif === "Non NHS" ? "X" : "";

    // --- SECTION II & III: Modification Types ---
    const isCO = choData.is_change_of_contract !== false;
    sheet.getCell('D24').value = isCO ? "X" : "";
    sheet.getCell('D26').value = !isCO ? "X" : ""; 

    sheet.getCell('S24').value = choData.is_new_item ? "X" : ""; 
    sheet.getCell('S26').value = choData.is_time_extension ? "X" : "";
    
    const isOverrun = (parseFloat(choData.proposed_change) || 0) > 0 && !choData.is_new_item;
    sheet.getCell('AH26').value = isOverrun ? "X" : "";
    sheet.getCell('AH24').value = choData.is_spec_change ? "X" : "";

    // --- SECTION IV: Determination Conditions ---
    sheet.getCell('D31').value = determinations.deductive_items ? "X" : "";
    sheet.getCell('D33').value = determinations.safety_items ? "X" : "";
    sheet.getCell('L31').value = determinations.rideability_bonus ? "X" : "";
    sheet.getCell('L33').value = determinations.sub_estimated_items ? "X" : "";
    sheet.getCell('V31').value = determinations.minor_change ? "X" : "";
    sheet.getCell('V33').value = determinations.known_non_participating ? "X" : "";
    sheet.getCell('AA31').value = determinations.other ? "X" : "";
    sheet.getCell('AC31').value = determinations.other || "";

    // --- SECTION V: Items Evaluated ---
    let startRow = 46;
    // Limpiamos los 15 espacios posibles del template
    for(let i=0; i<15; i++) {
        const row = sheet.getRow(startRow + i);
        row.eachCell({ includeEmpty: true }, c => c.value = null);
    }

    pageItems.forEach((it, idx) => {
        const row = sheet.getRow(startRow + idx);
        const isFed = (it.fund_source || "").includes("FHWA");
        const ratio = isFed ? ((it.fund_source || "").includes("80.25") ? "80.25%" : "100%") : "0%";
        
        row.getCell(2).value = it.item_num;       // B
        row.getCell(5).value = it.specification;  // E
        row.getCell(11).value = it.description;   // K
        row.getCell(32).value = parseFloat(it.quantity) || 0; // AF
        row.getCell(37).value = it.unit;          // AK
        row.getCell(41).value = parseFloat(it.unit_price) || 0; // AO
        row.getCell(46).value = (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0); // AT
        row.getCell(56).value = isFed ? "Yes" : "No"; // BD
        row.getCell(61).value = ratio;            // BI
    });

    // --- SECTION VI: Evaluation Matrix ---
    const matrixCols = [12, 16, 20, 24, 28]; // L, P, T, X, AB
    const criterionRows: Record<string, number> = {
        "1.1": 70, "1.2": 72, "1.3": 74, "1.4": 76, "1.5": 78, "1.6": 80,
        "2.1": 83, "2.2": 85,
        "3.1": 87,
        "4.1": 89, "4.2": 90
    };

    // Limpiar matriz
    matrixCols.forEach(colIdx => {
        sheet.getCell(68, colIdx).value = null;
        Object.values(criterionRows).forEach(rowIdx => {
            sheet.getCell(rowIdx, colIdx - 1).value = null;
            sheet.getCell(rowIdx, colIdx).value = null;
        });
    });

    pageItems.forEach((it, itemIdx) => {
        const colIdx = matrixCols[itemIdx];
        if (!colIdx) return;

        sheet.getCell(68, colIdx).value = `#${it.item_num}`;

        Object.entries(criterionRows).forEach(([critId, rowIdx]) => {
            const val = evaluations[it.item_num]?.[critId];
            if (val === "NF") {
                sheet.getCell(rowIdx, colIdx - 1).value = "X";
            } else if (val === "YT") {
                sheet.getCell(rowIdx, colIdx).value = "X";
            }
        });
    });

    // --- SECTION VII: Impact ---
    sheet.getCell('F94').value = choData.time_extension_days || 0;
    sheet.getCell('N94').value = Math.abs(parseFloat(choData.proposed_change) || 0);

    sheet.getCell('I96').value = dofaei.prepared_by_name || "";
    sheet.getCell('I99').value = dofaei.prepared_by_position || "";
    sheet.getCell('W96').value = dofaei.prepared_by_date || "";
}
