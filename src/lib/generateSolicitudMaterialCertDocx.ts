import { Document, Paragraph, TextRun, Packer, Numbering, LevelFormat, AlignmentType } from "docx";
import { fetchAllReportData } from "./reportLogic";
import { formatDate } from "./utils";

export const generateSolicitudMaterialCertDocx = async (projectId: string): Promise<Blob | null> => {
    const { project, items, certs, chos, mfgCerts } = await fetchAllReportData(projectId);
    
    if (!project) return null;

    // 1. Partidas no ejecutadas
    const executedQtys = new Map<string, number>();
    certs?.forEach(cert => {
        const certItems = Array.isArray(cert.items) ? cert.items : (cert.items?.list || []);
        certItems.forEach((it: any) => {
            const current = executedQtys.get(it.item_num) || 0;
            executedQtys.set(it.item_num, current + (parseFloat(it.quantity) || 0));
        });
    });

    const unexecutedItems = items?.filter(item => {
        const qty = executedQtys.get(item.item_num) || 0;
        return qty <= 0;
    }) || [];

    const unexecutedText = unexecutedItems.length > 0 
        ? unexecutedItems.map(i => `Partida ${i.item_num}: ${i.description}`).join('\n')
        : "Ninguna";

    // 2. Partidas con certificados de manufactura (CM)
    const mfgItemsSet = new Set<string>();
    mfgCerts?.forEach(m => {
        if (m.item_num) mfgItemsSet.add(m.item_num);
    });
    
    const mfgText = mfgItemsSet.size > 0
        ? Array.from(mfgItemsSet).map(num => {
            const it = items?.find(i => i.item_num === num);
            return `Partida ${num}: ${it?.description || 'N/A'}`;
        }).join('\n')
        : "Ninguna";

    // 3. Materiales con descuento
    const discountItems = new Set<string>();
    certs?.forEach(cert => {
        if (parseFloat(cert.price_adjustment) > 0) {
            discountItems.add(`Certificación #${cert.cert_num} tiene ajuste de precio: $${cert.price_adjustment}`);
        }
    });
    const discountText = discountItems.size > 0 
        ? Array.from(discountItems).join('\n') 
        : "Ninguno";

    // 4. Materiales rechazados
    // Generalmente no se lleva track directo como campo booleano simple, se deja manual o se indica "Ninguno registrado"
    const rejectedText = "Ninguno registrado";

    // 5. Partidas con trabajos adicionales (Extra work / CHOs)
    const extraWorkItems: string[] = [];
    chos?.forEach(cho => {
        const choLabel = `CHO ${cho.cho_num}${cho.amendment_letter || ''}`;
        cho.items?.forEach((it: any) => {
            extraWorkItems.push(`Partida ${it.item_num} (${choLabel}): ${it.description}`);
        });
    });
    const extraWorkText = extraWorkItems.length > 0
        ? extraWorkItems.join('\n')
        : "Ninguna";

    const createTextParagraph = (text: string) => {
        return text.split('\n').map(line => new Paragraph({
            children: [new TextRun({ text: `  ${line}`, size: 22 })], // 11pt
            spacing: { after: 120 }
        }));
    };

    const doc = new Document({
        sections: [{
            properties: {},
            children: [
                new Paragraph({
                    children: [
                        new TextRun({ text: "Solicitud del “", bold: true, size: 24 }),
                        new TextRun({ text: "Material certification", bold: true, italics: true, size: 24 }),
                        new TextRun({ text: "”:", bold: true, size: 24 }),
                    ],
                    spacing: { after: 240 }
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: "Proyecto: ", bold: true, size: 24 }),
                        new TextRun({ text: project.name || "N/A", size: 24 })
                    ],
                    spacing: { after: 120 }
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: "# Federal: ", bold: true, size: 24 }),
                        new TextRun({ text: project.fed_num || "N/A", size: 24 })
                    ],
                    spacing: { after: 120 }
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: "Contrato: ", bold: true, size: 24 }),
                        new TextRun({ text: project.contract_number || "N/A", size: 24 })
                    ],
                    spacing: { after: 120 }
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: "Fecha de comienzo: ", bold: true, size: 24 }),
                        new TextRun({ text: formatDate(project.date_project_start), size: 24 })
                    ],
                    spacing: { after: 120 }
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: "Fecha de terminación real: ", bold: true, size: 24 }),
                        new TextRun({ text: formatDate(project.date_real_completion), size: 24 })
                    ],
                    spacing: { after: 240 }
                }),

                // List Items
                new Paragraph({
                    children: [new TextRun({ text: "1. Partidas no ejecutadas:", bold: true, size: 24 })],
                    spacing: { before: 120, after: 120 }
                }),
                ...createTextParagraph(unexecutedText),

                new Paragraph({
                    children: [new TextRun({ text: "2. Partidas con certificados de manufactura (CM):", bold: true, size: 24 })],
                    spacing: { before: 120, after: 120 }
                }),
                ...createTextParagraph(mfgText),

                new Paragraph({
                    children: [new TextRun({ text: "3. Materiales con descuento:", bold: true, size: 24 })],
                    spacing: { before: 120, after: 120 }
                }),
                ...createTextParagraph(discountText),

                new Paragraph({
                    children: [new TextRun({ text: "4. Materiales rechazados:", bold: true, size: 24 })],
                    spacing: { before: 120, after: 120 }
                }),
                ...createTextParagraph(rejectedText),

                new Paragraph({
                    children: [new TextRun({ text: "5. Partidas con trabajos adicionales:", bold: true, size: 24 })],
                    spacing: { before: 120, after: 120 }
                }),
                ...createTextParagraph(extraWorkText),
            ]
        }]
    });

    return await Packer.toBlob(doc);
};
