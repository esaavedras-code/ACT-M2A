import { 
    Document, Paragraph, TextRun, Packer, AlignmentType, HeadingLevel,
    Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType
} from "docx";
import { supabase } from './supabase';
import { formatDate as utilsFormatDate, formatCurrency, roundedAmt } from './utils';

export const generateMinutesReportDocx = async (projectId: string, minuteData: any): Promise<Blob> => {
    // 1. Fetch All Necessary Project Data for Snapshot
    const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
    if (!project) throw new Error('Proyecto no encontrado');

    const { data: chos } = await supabase.from('chos').select('*').eq('project_id', projectId);
    const { data: certs } = await supabase.from('payment_certifications').select('*').eq('project_id', projectId).order('cert_num');
    const { data: items } = await supabase.from('contract_items').select('*').eq('project_id', projectId);
    const { data: compliance } = await supabase.from('labor_compliance').select('*').eq('project_id', projectId);

    // --- Consecutive Meeting Numbering & Previous Summary ---
    const currentMeetingDate = minuteData.meeting_date || project.last_meeting_date || new Date().toISOString().split('T')[0];
    const { count: minutesCountBefore } = await supabase
        .from('meeting_minutes')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .lte('meeting_date', currentMeetingDate);
    
    const { data: prevMinute } = await supabase
        .from('meeting_minutes')
        .select('participants')
        .eq('project_id', projectId)
        .lt('meeting_date', currentMeetingDate)
        .order('meeting_date', { ascending: false })
        .limit(1)
        .maybeSingle();

    let previousSummary = 'No hay resumen de la reunión anterior disponible.';
    if (prevMinute) {
        const parsedPrev = prevMinute.participants && typeof prevMinute.participants === 'object' && !Array.isArray(prevMinute.participants)
            ? prevMinute.participants
            : {};
        previousSummary = parsedPrev?.summary || (Array.isArray(prevMinute.participants) ? 'No hay resumen de la reunión anterior disponible.' : (prevMinute.participants || 'No hay resumen de la reunión anterior disponible.'));
    }

    // --- Calculations for Snapshot ---
    const originalCost = project.cost_original || items?.reduce((acc, item) => roundedAmt(acc + roundedAmt(item.quantity * item.unit_price, 2), 2), 0) || 0;
    
    const approvedCHOs = chos?.filter(c => c.doc_status === 'Aprobado') || [];
    const approvedCHOAmt = approvedCHOs.reduce((acc, c) => roundedAmt(acc + parseFloat(c.proposed_change || '0'), 2), 0);
    const approvedCHODays = approvedCHOs.reduce((acc, c) => acc + (c.time_extension_days || 0), 0);
    
    const currentContractAmt = roundedAmt(originalCost + approvedCHOAmt, 2);
    
    let totalGrossCertified = 0;
    let totalNetCertified = 0;
    let totalPaidGross = 0;
    let totalPaidNet = 0;
    let latestCertNum = 0;
    let latestCertDate = '';
    let latestPaidCertNum = 0;
    let latestPaidCertDate = '';
    let latestCertRetention = 0;
    let latestPaidRetention = 0;

    certs?.forEach(c => {
        const certItems = Array.isArray(c.items) ? c.items : (c.items?.list || []);
        let certGross = 0;
        certItems.forEach((it: any) => {
            certGross = roundedAmt(certGross + (parseFloat(it.quantity) * parseFloat(it.unit_price)), 2);
        });
        
        totalGrossCertified = roundedAmt(totalGrossCertified + certGross, 2);
        const retention = c.skip_retention ? 0 : roundedAmt(certGross * 0.05, 2);
        const net = roundedAmt(certGross - retention, 2);
        totalNetCertified = roundedAmt(totalNetCertified + net, 2);

        latestCertNum = c.cert_num;
        latestCertDate = c.cert_date;
        latestCertRetention = retention;

        if (c.cert_num < Math.max(0, (certs.length))) {
            totalPaidGross = roundedAmt(totalPaidGross + certGross, 2);
            totalPaidNet = roundedAmt(totalPaidNet + net, 2);
            latestPaidCertNum = c.cert_num;
            latestPaidCertDate = c.cert_date;
            latestPaidRetention = retention;
        }
    });

    const physicalProgress = currentContractAmt > 0 ? (totalGrossCertified / currentContractAmt) * 100 : 0;
    
    const startDate = project.date_project_start ? new Date(`${project.date_project_start}T00:00:00`) : null;
    const origEndDate = project.date_orig_completion ? new Date(`${project.date_orig_completion}T23:59:59`) : null;
    let origDays = 0;
    if (startDate && origEndDate) origDays = Math.ceil((origEndDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
    const currentDays = origDays + approvedCHODays;
    
    const today = new Date();
    let elapsedDays = 0;
    if (startDate) elapsedDays = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
    const timeElapsedPct = currentDays > 0 ? (elapsedDays / currentDays) * 100 : 0;
    
    const revEndDate = project.date_rev_completion 
        ? new Date(`${project.date_rev_completion}T23:59:59`) 
        : (startDate ? new Date(startDate.getTime() + (currentDays * 24 * 60 * 60 * 1000)) : null);

    // --- Metadatos de la minuta ---
    const parsedParticipants = minuteData.participants && typeof minuteData.participants === 'object' && !Array.isArray(minuteData.participants) 
        ? minuteData.participants 
        : {};

    const meetingNum = minuteData.meeting_number || minuteData.meeting_num || (minutesCountBefore || 1);
    const meetingDate = utilsFormatDate(minuteData.meeting_date || new Date().toISOString());
    const meetingTime = minuteData.meeting_time || parsedParticipants?.meeting_time || 'N/A';
    const attendees = minuteData.attendees || parsedParticipants?.attendees || (Array.isArray(minuteData.participants) ? minuteData.participants.join(', ') : 'No se registró lista de asistentes.');
    const summary = minuteData.summary || parsedParticipants?.summary || 'No hay resumen disponible.';
    const minutes = minuteData.minutes || minuteData.content || 'No hay minutas disponibles.';

    // Styles helpers
    const headerCell = (text: string, size = 18, widthPercent = 25) => new TableCell({
        children: [new Paragraph({
            children: [new TextRun({ text, bold: true, size, color: "FFFFFF" })],
            alignment: AlignmentType.CENTER
        })],
        width: { size: widthPercent, type: WidthType.PERCENTAGE },
        shading: { fill: "0056B3" }
    });

    const dataCell = (text: string, bold = false, align: any = AlignmentType.CENTER, size = 18) => new TableCell({
        children: [new Paragraph({
            children: [new TextRun({ text, bold, size })],
            alignment: align
        })],
        shading: { fill: "FFFFFF" }
    });

    const labelCell = (text: string, size = 16) => new TableCell({
        children: [new Paragraph({
            children: [new TextRun({ text, bold: true, size, color: "0056B3" })],
            alignment: AlignmentType.LEFT
        })],
        shading: { fill: "F2F5F9" }
    });

    const thinBorders = {
        top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
        left: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
        right: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" }
    };

    const sectionPairs = [
        ["2. Construction permit", "2. Permiso de construcción"],
        ["3. Owner Controlled Insurance Program (OCIP) Claims", "3. Reclamaciones OCIP (Owner Controlled Insurance Program)"],
        ["4. Construction Progress Tracking", "4. Seguimiento del progreso de construcción"],
        ["5. Main Critical Activities (Four Weeks Look Ahead)", "5. Actividades críticas principales (Four Weeks Look Ahead)"],
        ["6. Marked-up red lined drawings", "6. Planos marcados (Red-lined drawings)"],
        ["7. Safety (SA)", "7. Seguridad (SA)"],
        ["8. Schedule (SC)", "8. Cronograma (SC)"],
        ["9. Procurement (PR)", "9. Adquisiciones (PR)"],
        ["10. Construction (CO)", "10. Construcción (CO)"],
        ["11. Administration (AD)", "11. Administración (AD)"],
        ["12. Other (OT)", "12. Otros (OT)"],
        ["13. Substantial Completion", "13. Terminación Substancial"]
    ];

    const childrenElements: any[] = [
        new Paragraph({
            children: [new TextRun({ text: "ACTA DE REUNIÓN DE PROGRESO", bold: true, size: 32, color: "0056B3" })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 }
        }),
        new Paragraph({
            children: [new TextRun({ text: (project.project_name || 'Nombre del Proyecto').toUpperCase(), bold: true, size: 24 })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 }
        }),
        
        // Metadata Table
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: thinBorders,
            rows: [
                new TableRow({
                    children: [
                        labelCell("REUNIÓN NÚMERO:"),
                        dataCell(`${meetingNum}`, true, AlignmentType.LEFT),
                        labelCell("FECHA:"),
                        dataCell(`${meetingDate}`, true, AlignmentType.LEFT)
                    ]
                }),
                new TableRow({
                    children: [
                        labelCell("HORA:"),
                        dataCell(`${meetingTime}`, false, AlignmentType.LEFT),
                        labelCell("PROYECTO:"),
                        dataCell(`${project.project_name || project.num_act || 'N/A'}`, false, AlignmentType.LEFT)
                    ]
                }),
                new TableRow({
                    children: [
                        labelCell("ASISTENTES:"),
                        new TableCell({
                            columnSpan: 3,
                            children: [new Paragraph({ children: [new TextRun({ text: attendees, size: 18 })] })],
                            shading: { fill: "FFFFFF" }
                        })
                    ]
                })
            ]
        }),

        new Paragraph({ text: "", spacing: { before: 240 } }),

        // SECTION HEADER: SNAPSHOT
        new Paragraph({
            children: [new TextRun({ text: "RESUMEN DEL CONTROL DEL PROYECTO (SNAPSHOT)", bold: true, size: 20, color: "0056B3" })],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 120 }
        }),

        // Snapshot Grid 1 (Progress & Time)
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: thinBorders,
            rows: [
                new TableRow({
                    children: [
                        headerCell("Progreso Físico", 16, 25),
                        headerCell("Tiempo Transcurrido (días)", 16, 25),
                        headerCell("% Certificado (Bruto)", 16, 25),
                        headerCell("Días Adelantados/Atrasados", 16, 25)
                    ]
                }),
                new TableRow({
                    children: [
                        dataCell(`${physicalProgress.toFixed(2)}%`, true),
                        dataCell(`${elapsedDays}`),
                        dataCell("N/A"),
                        dataCell("N/A")
                    ]
                }),
                new TableRow({
                    children: [
                        headerCell("% Tiempo Transcurrido", 16, 25),
                        headerCell("Fecha de Comienzo", 16, 25),
                        headerCell("Fecha Orig. Terminación", 16, 25),
                        headerCell("Fecha Rev. Terminación", 16, 25)
                    ]
                }),
                new TableRow({
                    children: [
                        dataCell(`${timeElapsedPct.toFixed(2)}%`, true),
                        dataCell(utilsFormatDate(project.date_project_start)),
                        dataCell(utilsFormatDate(project.date_orig_completion)),
                        dataCell(utilsFormatDate(revEndDate))
                    ]
                })
            ]
        }),

        new Paragraph({ text: "", spacing: { before: 240 } }),

        // Snapshot Grid 2 (Schedule & Cost)
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: thinBorders,
            rows: [
                new TableRow({
                    children: [
                        labelCell("Cronograma del Proyecto", 18),
                        labelCell("Costo del Proyecto", 18)
                    ]
                }),
                new TableRow({
                    children: [
                        new TableCell({
                            children: [
                                new Paragraph({ children: [new TextRun({ text: `Duración Original: ${origDays} días`, size: 16 })] }),
                                new Paragraph({ children: [new TextRun({ text: `Duración Actual: ${currentDays} días`, size: 16 })] })
                            ],
                            width: { size: 50, type: WidthType.PERCENTAGE }
                        }),
                        new TableCell({
                            children: [
                                new Paragraph({ children: [new TextRun({ text: `Monto Original: ${formatCurrency(originalCost)}`, size: 16 })] }),
                                new Paragraph({ children: [new TextRun({ text: `+ Órdenes de Cambio: ${formatCurrency(approvedCHOAmt)}`, size: 16 })] }),
                                new Paragraph({ children: [new TextRun({ text: `Monto Actual Contrato: ${formatCurrency(currentContractAmt)}`, bold: true, size: 16 })] })
                            ],
                            width: { size: 50, type: WidthType.PERCENTAGE }
                        })
                    ]
                })
            ]
        }),

        new Paragraph({ text: "", spacing: { before: 240 } }),

        // Snapshot Grid 3 (Certifications Summary)
        new Paragraph({
            children: [new TextRun({ text: "Resumen de Certificaciones:", bold: true, size: 18, color: "0056B3" })],
            spacing: { before: 120, after: 120 }
        }),
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: thinBorders,
            rows: [
                new TableRow({
                    children: [
                        headerCell("Detalle", 16, 28),
                        headerCell("A la Fecha", 16, 24),
                        headerCell("Última Sometida", 16, 24),
                        headerCell("Última Pagada", 16, 24)
                    ]
                }),
                new TableRow({
                    children: [
                        labelCell("Número de Cert."),
                        dataCell(`${certs?.length || 0}`),
                        dataCell(`${latestCertNum}`),
                        dataCell(`${latestPaidCertNum}`)
                    ]
                }),
                new TableRow({
                    children: [
                        labelCell("Fecha Cert."),
                        dataCell("N/A"),
                        dataCell(utilsFormatDate(latestCertDate)),
                        dataCell(utilsFormatDate(latestPaidCertDate))
                    ]
                }),
                new TableRow({
                    children: [
                        labelCell("Monto Bruto"),
                        dataCell(formatCurrency(totalGrossCertified)),
                        dataCell("N/A"),
                        dataCell(formatCurrency(totalPaidGross))
                    ]
                }),
                new TableRow({
                    children: [
                        labelCell("Retención (5%)"),
                        dataCell(formatCurrency(roundedAmt(totalGrossCertified - totalNetCertified, 2))),
                        dataCell(formatCurrency(latestCertRetention)),
                        dataCell(formatCurrency(latestPaidRetention))
                    ]
                }),
                new TableRow({
                    children: [
                        labelCell("Monto Neto"),
                        dataCell(formatCurrency(totalNetCertified), true),
                        dataCell("N/A"),
                        dataCell(formatCurrency(totalPaidNet), true)
                    ]
                })
            ]
        }),

        new Paragraph({ text: "", spacing: { before: 240 } }),

        // Snapshot Grid 4 (Change Orders Summary)
        new Paragraph({
            children: [new TextRun({ text: "Cambios de Orden:", bold: true, size: 18, color: "0056B3" })],
            spacing: { before: 120, after: 120 }
        }),
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: thinBorders,
            rows: [
                new TableRow({
                    children: [
                        headerCell("Métrica de Orden de Cambio", 16, 50),
                        headerCell("Última Sometida / Aprobada", 16, 50)
                    ]
                }),
                new TableRow({
                    children: [
                        labelCell("Total de COs Sometidas al Cliente"),
                        dataCell(`(${chos?.length || 0}) ${chos?.map(c => c.amendment_letter || c.cho_num).join(', ') || 'N/A'}`)
                    ]
                }),
                new TableRow({
                    children: [
                        labelCell("Costo Acumulado de COs Aprobadas"),
                        dataCell(formatCurrency(approvedCHOAmt), true)
                    ]
                }),
                new TableRow({
                    children: [
                        labelCell("Extensión de Tiempo Acumulada"),
                        dataCell(`${approvedCHODays} días`)
                    ]
                })
            ]
        }),

        new Paragraph({ text: "", spacing: { before: 240 } }),

        // SECTION HEADER: DISCUSSION
        new Paragraph({
            children: [new TextRun({ text: "DISCUSIÓN DE TEMAS", bold: true, size: 20, color: "0056B3" })],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 120 }
        }),

        // 1. Resumen Ejecutivo
        new Paragraph({
            children: [new TextRun({ text: "1. Resumen Ejecutivo", bold: true, size: 22, color: "0056B3" })],
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 180, after: 60 }
        }),
        new Paragraph({
            children: [new TextRun({ text: "A. PUNTOS PRINCIPALES DE LA REUNIÓN PASADA:", bold: true, size: 18, color: "0056B3" })],
            spacing: { before: 120, after: 60 }
        }),
        ...summaryTextToWordParagraphs(previousSummary),
        new Paragraph({
            children: [new TextRun({ text: "B. PUNTOS PRINCIPALES DE LA REUNIÓN ACTUAL:", bold: true, size: 18, color: "0056B3" })],
            spacing: { before: 120, after: 60 }
        }),
        ...summaryTextToWordParagraphs(summary),

        // 2. Permisos
        new Paragraph({
            children: [new TextRun({ text: "2. Permisos de construcción", bold: true, size: 22, color: "0056B3" })],
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 180, after: 120 }
        })
    ];

    // Permisos Table
    const rawPermits = compliance?.filter(c => c.doc_type.toLowerCase().includes('permiso') || c.doc_type === 'PUI') || [];
    const permitRecords = [...rawPermits].sort((a, b) => new Date(a.date_received || 0).getTime() - new Date(b.date_received || 0).getTime());
    if (permitRecords.length > 0) {
        childrenElements.push(new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: thinBorders,
            rows: [
                new TableRow({
                    children: [
                        headerCell("Nombre del Permiso / Agencia / Número", 16, 60),
                        headerCell("Fecha Efectiva", 16, 20),
                        headerCell("Fecha Expiración", 16, 20)
                    ]
                }),
                ...permitRecords.map(p => new TableRow({
                    children: [
                        labelCell(p.doc_type + (p.subcontractor_name ? ` (${p.subcontractor_name})` : "")),
                        dataCell(utilsFormatDate(p.date_received)),
                        dataCell(utilsFormatDate(p.date_expiry))
                    ]
                }))
            ]
        }));
    } else {
        childrenElements.push(new Paragraph({ children: [new TextRun({ text: "No se encontraron permisos registrados.", size: 18 })] }));
    }

    // 3. Seguros
    childrenElements.push(
        new Paragraph({
            children: [new TextRun({ text: "3. Seguros", bold: true, size: 22, color: "0056B3" })],
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 180, after: 120 }
        })
    );

    const rawInsurance = compliance?.filter(c => c.doc_type.toLowerCase().includes('póliza')) || [];
    const insuranceRecords = [...rawInsurance].sort((a, b) => new Date(a.date_received || 0).getTime() - new Date(b.date_received || 0).getTime());
    if (insuranceRecords.length > 0) {
        childrenElements.push(new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: thinBorders,
            rows: [
                new TableRow({
                    children: [
                        headerCell("Tipo de Seguro / Entidad", 16, 50),
                        headerCell("Fecha Efectiva", 16, 25),
                        headerCell("Fecha Expiración", 16, 25)
                    ]
                }),
                ...insuranceRecords.map(p => new TableRow({
                    children: [
                        labelCell(p.doc_type + (p.subcontractor_name ? ` (${p.subcontractor_name})` : "")),
                        dataCell(utilsFormatDate(p.date_received)),
                        dataCell(utilsFormatDate(p.date_expiry))
                    ]
                }))
            ]
        }));
    } else {
        childrenElements.push(new Paragraph({ children: [new TextRun({ text: "No se encontraron seguros registrados.", size: 18 })] }));
    }

    // Rest of sections (4 to 13)
    sectionPairs.forEach(([enName, esName]) => {
        if (esName.startsWith("2.") || esName.startsWith("3.")) return;

        childrenElements.push(new Paragraph({
            children: [new TextRun({ text: esName, bold: true, size: 22, color: "0056B3" })],
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 180, after: 60 }
        }));

        let startIdx = minutes.indexOf(esName);
        let currentHeaderUsed = esName;
        if (startIdx === -1) {
            startIdx = minutes.indexOf(enName);
            currentHeaderUsed = enName;
        }

        if (startIdx !== -1) {
            let nextSecIdx = minutes.length;
            sectionPairs.forEach(([enOther, esOther]) => {
                [enOther, esOther].forEach(header => {
                    const idx = minutes.indexOf(header);
                    if (idx > startIdx && idx < nextSecIdx) nextSecIdx = idx;
                });
            });

            const content = minutes.substring(startIdx + currentHeaderUsed.length, nextSecIdx).replace(/^[:\s-]+/, '').trim();
            if (content) {
                childrenElements.push(...summaryTextToWordParagraphs(content));
            } else {
                childrenElements.push(new Paragraph({ children: [new TextRun({ text: "No se discutieron puntos específicos.", size: 18 })] }));
            }
        } else {
            childrenElements.push(new Paragraph({ children: [new TextRun({ text: "No se discutieron puntos específicos.", size: 18 })] }));
        }
    });

    // Signatures
    childrenElements.push(
        new Paragraph({ text: "", spacing: { before: 360 } }),
        new Paragraph({
            children: [new TextRun({ text: "CERTIFICACIÓN:", bold: true, size: 20, color: "0056B3" })],
            spacing: { before: 240, after: 60 }
        }),
        new Paragraph({
            children: [new TextRun({ text: "Damos fe de que estos puntos fueron discutidos y acordados en la reunión citada.", size: 16 })],
            spacing: { after: 360 }
        }),
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
                top: { style: BorderStyle.NONE, size: 0, color: "auto" },
                bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
                left: { style: BorderStyle.NONE, size: 0, color: "auto" },
                right: { style: BorderStyle.NONE, size: 0, color: "auto" }
            },
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            children: [
                                new Paragraph({ children: [new TextRun({ text: "____________________________________", size: 18 })], alignment: AlignmentType.CENTER }),
                                new Paragraph({ children: [new TextRun({ text: "Administrador del Proyecto", bold: true, size: 16 })], alignment: AlignmentType.CENTER }),
                                new Paragraph({ children: [new TextRun({ text: "ACT - Área de Construcción", size: 14 })], alignment: AlignmentType.CENTER })
                            ],
                            width: { size: 50, type: WidthType.PERCENTAGE }
                        }),
                        new TableCell({
                            children: [
                                new Paragraph({ children: [new TextRun({ text: "____________________________________", size: 18 })], alignment: AlignmentType.CENTER }),
                                new Paragraph({ children: [new TextRun({ text: "Representante del Contratista", bold: true, size: 16 })], alignment: AlignmentType.CENTER }),
                                new Paragraph({ children: [new TextRun({ text: project.contractor_name || 'Empresa Contratista', size: 14 })], alignment: AlignmentType.CENTER })
                            ],
                            width: { size: 50, type: WidthType.PERCENTAGE }
                        })
                    ]
                })
            ]
        })
    );

    const doc = new Document({
        sections: [{
            properties: {},
            children: childrenElements
        }]
    });

    return await Packer.toBlob(doc);
};

// Helper to convert markdown-like summary text to docx Paragraphs
function summaryTextToWordParagraphs(text: string): Paragraph[] {
    const lines = (text || '').split('\n');
    const paragraphs: Paragraph[] = [];

    lines.forEach(line => {
        const clean = line.trim();
        if (!clean) return;

        // Check if bullet point
        const isBullet = clean.startsWith('-') || clean.startsWith('*');
        const textContent = isBullet ? clean.substring(1).trim() : clean;

        // Check if bold text markers
        const parts = textContent.split('**');
        const runs: TextRun[] = [];

        parts.forEach((part, index) => {
            const isBold = index % 2 !== 0;
            runs.push(new TextRun({
                text: part,
                bold: isBold,
                size: 18
            }));
        });

        paragraphs.push(new Paragraph({
            children: runs,
            spacing: { after: 120 },
            bullet: isBullet ? { level: 0 } : undefined
        }));
    });

    if (paragraphs.length === 0) {
        paragraphs.push(new Paragraph({
            children: [new TextRun({ text: "No hay información disponible.", size: 18 })],
            spacing: { after: 120 }
        }));
    }

    return paragraphs;
}
