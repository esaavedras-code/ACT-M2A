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

        const workbook = new ExcelJS.Workbook();
        const bufferTemplate = Buffer.from(DOFAEI_TEMPLATE_BASE64, 'base64');
        await workbook.xlsx.load(bufferTemplate);
        
        const sheet = workbook.getWorksheet(1);
        if (!sheet) throw new Error("No se encontró la hoja en el Excel");

        // --- SECTION I: Project Information ---
        sheet.getCell('B17').value = projData.name || "";
        sheet.getCell('T17').value = projData.num_act || "";
        sheet.getCell('AK19').value = projData.num_federal || "";

        // Road Classif (Suponiendo coordenadas basadas en la estructura visual típica)
        const roadClassif = dofaei.road_classif || "NHS";
        sheet.getCell('B14').value = roadClassif === "Interstate" ? "X" : ""; // Ejemplo, ajustar si varía
        sheet.getCell('T14').value = roadClassif === "NHS" ? "X" : "";
        sheet.getCell('AK14').value = roadClassif === "Non NHS" ? "X" : "";

        // --- SECTION II & III: Modification Types ---
        const isCO = choData.is_change_of_contract !== false;
        sheet.getCell('D24').value = isCO ? "X" : "";
        sheet.getCell('D26').value = !isCO ? "X" : ""; // Extra Work Order

        sheet.getCell('S24').value = choData.is_new_item ? "X" : ""; // Additional Scope
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

        // --- SECTION V: Items Evaluated (Mapeo verificado) ---
        const items = Array.isArray(choData.items) ? choData.items : [];
        let startRow = 46;
        items.slice(0, 20).forEach((it, idx) => {
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
        const matrixCols = [12, 16, 20, 24, 28, 32, 36, 40, 44, 48]; // L, P, T, X, AB, AF, AJ, AN, AR, AV
        const criterionRows: Record<string, number> = {
            "1.1": 70, "1.2": 72, "1.3": 74, "1.4": 76, "1.5": 78, "1.6": 80,
            "2.1": 83, "2.2": 85,
            "3.1": 87,
            "4.1": 89, "4.2": 90
        };

        items.slice(0, 10).forEach((it, itemIdx) => {
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

        // Signatures
        sheet.getCell('I96').value = dofaei.prepared_by_name || "";
        sheet.getCell('I99').value = dofaei.prepared_by_position || "";
        sheet.getCell('W96').value = dofaei.prepared_by_date || "";

        const outBuffer = await workbook.xlsx.writeBuffer();
        return new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    } catch (err: any) {
        console.error("Error generating DOFAEI Excel:", err);
        throw err;
    }
}
