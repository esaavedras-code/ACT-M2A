import { Document, Paragraph, TextRun, Packer, AlignmentType, HeadingLevel } from "docx";
import { supabase } from './supabase';
import { formatDate as utilsFormatDate } from './utils';

export const generateMinutesReportDocx = async (projectId: string, minuteData: any): Promise<Blob> => {
    const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
    if (!project) throw new Error('Proyecto no encontrado');

    const createHeading = (text: string, level: any = HeadingLevel.HEADING_1) => {
        return new Paragraph({
            text: text,
            heading: level,
            spacing: { before: 240, after: 120 },
        });
    };

    const createTextParagraph = (text: string, bold: boolean = false) => {
        return text.split('\n').map(line => new Paragraph({
            children: [new TextRun({ text: line, size: 22, bold: bold })], // 11pt
            spacing: { after: 120 }
        }));
    };

    const meetingNum = minuteData.meeting_number || 'N/A';
    const meetingDate = utilsFormatDate(minuteData.meeting_date || new Date().toISOString());
    const meetingTime = minuteData.meeting_time || 'N/A';
    const attendees = minuteData.attendees || 'No se registró lista de asistentes.';
    const summary = minuteData.summary || 'No hay resumen disponible.';
    const minutes = minuteData.minutes || 'No hay minutas disponibles.';

    const doc = new Document({
        sections: [{
            properties: {},
            children: [
                new Paragraph({
                    children: [
                        new TextRun({ text: "ACTA DE REUNIÓN DE PROGRESO", bold: true, size: 32, color: "0056B3" }),
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 240 }
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: (project.project_name || 'Nombre del Proyecto').toUpperCase(), bold: true, size: 28 }),
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 360 }
                }),
                
                new Paragraph({
                    children: [
                        new TextRun({ text: "Reunión Número: ", bold: true, size: 24 }),
                        new TextRun({ text: `${meetingNum}`, size: 24 }),
                    ],
                    spacing: { after: 120 }
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: "Fecha: ", bold: true, size: 24 }),
                        new TextRun({ text: `${meetingDate}`, size: 24 }),
                    ],
                    spacing: { after: 120 }
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: "Hora: ", bold: true, size: 24 }),
                        new TextRun({ text: `${meetingTime}`, size: 24 }),
                    ],
                    spacing: { after: 120 }
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: "Proyecto: ", bold: true, size: 24 }),
                        new TextRun({ text: `${project.project_name || project.num_act || 'N/A'}`, size: 24 }),
                    ],
                    spacing: { after: 240 }
                }),

                createHeading("ASISTENTES", HeadingLevel.HEADING_2),
                ...createTextParagraph(attendees),

                createHeading("1. Resumen Ejecutivo", HeadingLevel.HEADING_2),
                new Paragraph({
                    children: [new TextRun({ text: "PUNTOS PRINCIPALES DE LA REUNIÓN:", bold: true, size: 24 })],
                    spacing: { after: 120 }
                }),
                ...createTextParagraph(summary),

                createHeading("2. Minutas Detalladas", HeadingLevel.HEADING_2),
                ...createTextParagraph(minutes),
                
                new Paragraph({
                    children: [
                        new TextRun({ text: "\n\n\n\n\nCERTIFICACIÓN:", bold: true, size: 24 })
                    ],
                    spacing: { before: 400, after: 120 }
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: "Damos fe de que estos puntos fueron discutidos y acordados en la reunión citada.", size: 20 })
                    ],
                    spacing: { after: 600 }
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: "____________________________________\t\t\t____________________________________", size: 24 })
                    ],
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: "Administrador del Proyecto\t\t\t\t\tRepresentante del Contratista", bold: true, size: 16 })
                    ],
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: "ACT - Área de Construcción\t\t\t\t\t" + (project.contractor_name || 'Empresa Contratista'), size: 16 })
                    ],
                }),
            ]
        }]
    });

    return await Packer.toBlob(doc);
};
