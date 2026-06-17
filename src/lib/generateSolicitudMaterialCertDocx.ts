import { Document, Paragraph, TextRun, Packer } from "docx";
import { fetchAllReportData } from "./reportLogic";
import { formatDate, formatItemNum } from "./utils";

export const generateSolicitudMaterialCertDocx = async (projectId: string): Promise<Blob | null> => {
    const { project, items, certs, chos, mfgCerts } = await fetchAllReportData(projectId);
    
    if (!project || !items) return null;

    const createTextParagraph = (text: string) => {
        return text.split('\n').map(line => new Paragraph({
            children: [new TextRun({ text: `  ${line}`, size: 22 })], // 11pt
            spacing: { after: 120 }
        }));
    };

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
        ? unexecutedItems.map(i => formatItemNum(i.item_num)).join(', ')
        : "Ninguna";

    // 2. Partidas que requieren certificados de manufactura (CM)
    const itemsRequireMfg = items.filter(b => b.requires_mfg_cert);
    let mfgText = "";
    
    if (itemsRequireMfg.length === 0) {
        mfgText = "No hay partidas que requieran certificados de manufactura en este proyecto.";
    } else {
        const itemsWithCm: string[] = [];
        const itemsWithoutCm: string[] = [];

        itemsRequireMfg.forEach(b => {
            const itemMfgCerts = mfgCerts?.filter((c: any) => c.item_id === b.id) || [];
            const mfgQty = itemMfgCerts.reduce((acc: number, c: any) => acc + (parseFloat(c.quantity) || 0), 0);
            const certQty = executedQtys.get(b.item_num) || 0;
            const missing = certQty - mfgQty;
            
            if (missing >= 0.0001) {
                itemsWithoutCm.push(formatItemNum(b.item_num));
            } else {
                itemsWithCm.push(formatItemNum(b.item_num));
            }
        });

        const withCmText = itemsWithCm.length > 0 ? itemsWithCm.join(', ') : "Ninguna";
        const withoutCmText = itemsWithoutCm.length > 0 ? itemsWithoutCm.join(', ') : "Ninguna";
        mfgText = `Con certificado de manufactura:\n${withCmText}\n\nSin certificado de manufactura:\n${withoutCmText}`;
    }

    // 3. Materiales con descuento
    const discountLines: string[] = [];
    certs?.forEach(cert => {
        // Here we just identify if the cert has an overall discount/adjustment.
        // The user asked to format it to be filled manually.
        const adj = parseFloat(cert.price_adjustment) || 0;
        if (adj > 0) {
            discountLines.push(`Partida: ________________ - Descuento: ____% (Aplicado en Certificación #${cert.cert_num})\nNota: Se deberá enviar copia de la parte posterior de la certificación donde se aplicó el descuento.`);
        }
    });

    const discountText = discountLines.length > 0 
        ? discountLines.join('\n\n') 
        : "Partida: ________________ - Descuento: ____% (Certificación #____)\nNota: Se deberá enviar copia de la parte posterior de la certificación donde se aplicó el descuento.";

    // 4. Materiales rechazados
    const rejectedText = "Partida: ________________ - ¿Material fue removido?: [ ] Sí  [ ] No";

    // 5. Partidas con trabajos adicionales (CHO)
    const choItems = chos ? items.filter(i => chos.some((c: any) => c.item_id === i.id)) : [];
    let extraWorkLines: string[] = [];
    if (choItems.length > 0) {
        extraWorkLines = choItems.map(i => `Partida ${formatItemNum(i.item_num)}\n\n`);
    }
    const extraWorkText = extraWorkLines.length > 0
        ? extraWorkLines.join('\n')
        : "Ninguna.";

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
