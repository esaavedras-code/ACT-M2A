import { Document, Paragraph, TextRun, Packer, Table, TableRow, TableCell, WidthType, BorderStyle } from "docx";
import { fetchAllReportData } from "./reportLogic";
import { formatDate, formatCurrency, sortItemsNaturally } from "./utils";

export const generateSolicitudMaterialCertDocx = async (projectId: string): Promise<Blob | null> => {
    const { project, items, certs, chos, mfgCerts } = await fetchAllReportData(projectId);
    if (!project || !items) return null;

    // 1. Gather Data

    // Section 1: Partidas no ejecutadas
    const certQtyMap = new Map<string, number>();
    (certs || []).forEach((c: any) => {
        const certItems = Array.isArray(c.items) ? c.items : (c.items?.list || []);
        certItems.forEach((it: any) => {
            if (it.item_num) {
                const prev = certQtyMap.get(it.item_num) || 0;
                certQtyMap.set(it.item_num, prev + (parseFloat(it.quantity) || 0));
            }
        });
    });

    const unexecutedData: any[] = [];
    items.forEach((i: any) => {
        const qty = certQtyMap.get(i.item_num) || 0;
        if (qty <= 0) {
            unexecutedData.push({
                item_num: i.item_num,
                description: i.description || i.specification || ''
            });
        }
    });
    (chos || []).forEach((c: any) => {
        const choItems = Array.isArray(c.items) ? c.items : [];
        choItems.forEach((ci: any) => {
            if (ci.item_num && !unexecutedData.find(u => u.item_num === ci.item_num)) {
                const qty = certQtyMap.get(ci.item_num) || 0;
                if (qty <= 0) {
                    unexecutedData.push({
                        item_num: ci.item_num,
                        description: ci.description || ci.specification || ''
                    });
                }
            }
        });
    });
    sortItemsNaturally(unexecutedData);

    // Section 2: Partidas con CM
    const cmData: any[] = [];
    const allKnownItems = [...items];
    (chos || []).forEach((c: any) => {
        const choItems = Array.isArray(c.items) ? c.items : [];
        choItems.forEach((ci: any) => {
            if (!allKnownItems.find(x => x.item_num === ci.item_num)) {
                allKnownItems.push(ci);
            }
        });
    });
    
    allKnownItems.forEach((i: any) => {
        if (i.requires_mfg_cert) {
            cmData.push({
                item_num: i.item_num,
                description: i.description || i.specification || ''
            });
        }
    });
    sortItemsNaturally(cmData);

    // Section 3: Materiales con descuento
    const discountData: any[] = [];
    (certs || []).forEach((c: any) => {
        if (c.extra_retention_breakdown && Array.isArray(c.extra_retention_breakdown)) {
            c.extra_retention_breakdown.forEach((b: any) => {
                discountData.push({
                    item_num: b.item_num,
                    description: b.description || '',
                    cert_num: String(c.cert_num),
                    amount: b.amount
                });
            });
        }
    });
    sortItemsNaturally(discountData);

    // Section 4: Materiales rechazados
    const rejectedData: any[] = [];

    // Section 5: Partidas con trabajos adicionales (888)
    const extraWorkData: any[] = [];
    (chos || []).forEach((c: any) => {
        const choItems = Array.isArray(c.items) ? c.items : [];
        choItems.forEach((ci: any) => {
            if (ci.specification && ci.specification.toString().includes('888')) {
                extraWorkData.push({
                    item_num: ci.item_num,
                    description: ci.description || '',
                    justification: c.justification || 'Sin justificación provista.'
                });
            }
        });
    });
    sortItemsNaturally(extraWorkData);

    // --- Helpers Docx ---
    const createHeaderRow = (headers: string[], widths: number[]) => {
        return new TableRow({
            children: headers.map((h, i) => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20 })] })], // 10pt
                width: { size: widths[i], type: WidthType.PERCENTAGE },
                shading: { fill: "F0F0F0" }
            }))
        });
    };

    const createDataRow = (dataRow: string[], widths: number[]) => {
        return new TableRow({
            children: dataRow.map((cell, i) => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: cell, size: 20 })] })], // 10pt
                width: { size: widths[i], type: WidthType.PERCENTAGE }
            }))
        });
    };

    const createTableSection = (title: string, headers: string[], widths: number[], data: string[][]) => {
        const elements: any[] = [
            new Paragraph({
                children: [new TextRun({ text: title, bold: true, size: 24 })], // 12pt
                spacing: { before: 240, after: 120 }
            })
        ];

        if (data.length === 0) {
            elements.push(new Paragraph({
                children: [new TextRun({ text: "N/A", size: 22 })], // 11pt
                spacing: { after: 120 }
            }));
        } else {
            const table = new Table({
                rows: [
                    createHeaderRow(headers, widths),
                    ...data.map(row => createDataRow(row, widths))
                ],
                width: { size: 100, type: WidthType.PERCENTAGE }
            });
            elements.push(table);
        }

        return elements;
    };


    const doc = new Document({
        sections: [{
            properties: {},
            children: [
                new Paragraph({
                    children: [
                        new TextRun({ text: "SOLICITUD DEL MATERIAL CERTIFICATION", bold: true, size: 28 }),
                    ],
                    alignment: "center",
                    spacing: { after: 360 }
                }),
                new Paragraph({ children: [new TextRun({ text: "Proyecto: ", bold: true, size: 24 }), new TextRun({ text: `${project.num_act || ''} - ${project.name || ''}`, size: 24 })], spacing: { after: 120 } }),
                new Paragraph({ children: [new TextRun({ text: "# Federal: ", bold: true, size: 24 }), new TextRun({ text: project.fed_num || "N/A", size: 24 })], spacing: { after: 120 } }),
                new Paragraph({ children: [new TextRun({ text: "Contrato: ", bold: true, size: 24 }), new TextRun({ text: project.contract_number || "N/A", size: 24 })], spacing: { after: 120 } }),
                new Paragraph({ children: [new TextRun({ text: "Fecha de comienzo: ", bold: true, size: 24 }), new TextRun({ text: formatDate(project.date_project_start), size: 24 })], spacing: { after: 120 } }),
                new Paragraph({ children: [new TextRun({ text: "Fecha de terminación real: ", bold: true, size: 24 }), new TextRun({ text: formatDate(project.date_real_completion), size: 24 })], spacing: { after: 240 } }),

                // Sections
                ...createTableSection(
                    `1. Partidas no ejecutadas (${unexecutedData.length})`, 
                    ['Item No.', 'Descripción del ítem'], 
                    [20, 80], 
                    unexecutedData.map(d => [d.item_num, d.description])
                ),
                ...createTableSection(
                    `2. Partidas con certificados de manufactura (CM) (${cmData.length})`, 
                    ['Item No.', 'Descripción del ítem'], 
                    [20, 80], 
                    cmData.map(d => [d.item_num, d.description])
                ),
                ...createTableSection(
                    `3. Materiales con descuento (${discountData.length})`, 
                    ['Item No.', 'Descripción', 'Certificación', 'Descuento'], 
                    [15, 55, 15, 15], 
                    discountData.map(d => [d.item_num, d.description, `Cert #${d.cert_num}`, formatCurrency(parseFloat(d.amount)||0)])
                ),
                ...createTableSection(
                    `4. Materiales rechazados (0)`, 
                    [], 
                    [], 
                    []
                ),
                ...createTableSection(
                    `5. Partidas con trabajos adicionales (${extraWorkData.length})`, 
                    ['Item No.', 'Descripción del ítem', 'Justificación (CHO)'], 
                    [15, 35, 50], 
                    extraWorkData.map(d => [d.item_num, d.description, d.justification])
                ),
            ]
        }]
    });

    return await Packer.toBlob(doc);
};
