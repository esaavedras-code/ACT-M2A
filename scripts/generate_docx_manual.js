const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, BorderStyle, WidthType } = require("docx");
const fs = require("fs");
const path = require("path");

function createManualDocx() {
    const doc = new Document({
        creator: "Ing. Enrique Saavedra Sada, PE",
        title: "MANUAL DE INSTRUCCIONES: DASHBOARD DE RESUMEN (PACT)",
        description: "Explicación detallada de fórmulas, alertas y métricas del panel de control de PACT.",
        sections: [
            {
                properties: {},
                children: [
                    // --- PORTADA ---
                    new Paragraph({
                        text: "\n\n\nMANUAL DE INSTRUCCIONES\n",
                        heading: HeadingLevel.TITLE,
                        alignment: AlignmentType.CENTER,
                    }),
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({
                                text: "DASHBOARD DE RESUMEN (PACT)",
                                bold: true,
                                size: 36,
                                color: "2563EB", // Azul
                            }),
                        ]
                    }),
                    new Paragraph({
                        text: "\nSistema de Control y Administración de Proyectos",
                        heading: HeadingLevel.HEADING_2,
                        alignment: AlignmentType.CENTER,
                    }),
                    new Paragraph({
                        text: "\n\n\n\n\n\n\n\n",
                        alignment: AlignmentType.CENTER,
                    }),
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({
                                text: "Diseño y Conceptualización:\n",
                                bold: true,
                                size: 24,
                            }),
                            new TextRun({
                                text: "Ing. Enrique Saavedra Sada, PE\n",
                                bold: true,
                                size: 28,
                                color: "1E293B",
                            }),
                            new TextRun({
                                text: "Diseñador de Software\n\n",
                                italic: true,
                                size: 20,
                            }),
                            new TextRun({
                                text: "Versión Oficial y Detallada\nJulio 2026\nAutoridad de Carreteras y Transportación (ACT)",
                                size: 18,
                                color: "64748B",
                            }),
                        ]
                    }),
                    
                    // --- SALTO DE PÁGINA ---
                    new Paragraph({ text: "", pageBreakBefore: true }),

                    // --- INTRODUCCIÓN ---
                    new Paragraph({
                        text: "1. INTRODUCCIÓN AL DASHBOARD DE RESUMEN",
                        heading: HeadingLevel.HEADING_1,
                    }),
                    new Paragraph({
                        text: "El Dashboard de Resumen es el panel neurálgico del sistema PACT. Consolida en tiempo real la información técnica, presupuestaria y de cumplimiento contractual de la obra. Su objetivo es dotar al Administrador del Programa y al Ingeniero de Proyecto de una herramienta analítica precisa para supervisar los rendimientos de costo, tiempo e inspección física sin tener que navegar por las bases de datos crudas.",
                        alignment: AlignmentType.JUSTIFY,
                    }),
                    new Paragraph({ text: "" }),

                    // --- ALERTAS ---
                    new Paragraph({
                        text: "2. ALERTAS CRÍTICAS Y FLUJO DE VALIDACIÓN",
                        heading: HeadingLevel.HEADING_1,
                    }),
                    new Paragraph({
                        text: "El sistema efectúa un escaneo proactivo en cada carga de datos para desplegar banners preventivos y de advertencia:",
                    }),
                    new Paragraph({
                        text: "• Alertas FMIS (Federal Medical/Infrastructure Funding End Date): Monitorea la fecha límite del financiamiento federal. Si faltan 30 días o menos, se muestra una alerta ámbar con el tiempo restante. Si la fecha actual sobrepasa el límite, se activa un banner rojo de alta prioridad con los días de atraso acumulados.",
                        style: "List Bullet"
                    }),
                    new Paragraph({
                        text: "• Alertas de Cumplimiento Laboral: Escanea la fecha de vencimiento (date_expiry) de las certificaciones de subcontratistas. El sistema implementa la regla de que si el proyecto cuenta con fecha de 'Terminación Sustancial' formal y los documentos expiran después de esta fecha, no se marcarán como vencidos.",
                        style: "List Bullet"
                    }),
                    new Paragraph({
                        text: "• Alertas de Certificados de Manufactura (CM) Insuficientes: Bloquea e identifica qué partidas físicas están siendo facturadas por cantidades superiores a las certificadas en planta. Para partidas estándar, calcula: Cantidad Disponible = Cantidad Aprobada por CM - Cantidad Facturada en Certificaciones Anteriores. Para partidas Lumpsum (LS), aplica un escalado en porcentaje basado en la cantidad límite (mfg_cert_qty) configurada.",
                        style: "List Bullet"
                    }),
                    new Paragraph({ text: "" }),

                    // --- TIEMPO ---
                    new Paragraph({
                        text: "3. MÓDULO DE FECHAS CLAVE Y BALANCE DE TIEMPO",
                        heading: HeadingLevel.HEADING_1,
                    }),
                    new Paragraph({
                        text: "Este bloque gobierna los plazos de vigencia de la obra. Los cálculos automáticos operan bajo la siguiente lógica:",
                    }),
                    
                    new Paragraph({
                        text: "• Días de Contrato Originales (D_total): Diferencia entre la fecha original de finalización y la fecha de comienzo:",
                    }),
                    new Paragraph({
                        text: "   D_total = Fecha Terminación Original - Fecha Comienzo + 1",
                        alignment: AlignmentType.CENTER,
                    }),
                    new Paragraph({
                        text: "• Días de Prórroga por Change Orders (D_ext_CHO): Sumatoria de días autorizados por órdenes de cambio aprobadas:",
                    }),
                    new Paragraph({
                        text: "   D_ext_CHO = Sumatoria(time_extension_days de CHOs Aprobados)",
                        alignment: AlignmentType.CENTER,
                    }),
                    new Paragraph({
                        text: "• Días de Contrato Revisados (D_revisados): Plazo total vigente:",
                    }),
                    new Paragraph({
                        text: "   D_revisados = D_total + D_ext_CHO",
                        alignment: AlignmentType.CENTER,
                    }),
                    new Paragraph({
                        text: "• Tiempo Transcurrido (D_transcurrido): Si la obra tiene fecha de Terminación Sustancial o Real, los días consumidos se congelan a esa fecha. En caso contrario, se calculan con respecto al día de hoy:",
                    }),
                    new Paragraph({
                        text: "   D_transcurrido = Fecha Límite - Fecha Comienzo + 1",
                        alignment: AlignmentType.CENTER,
                    }),
                    new Paragraph({
                        text: "• Balance de Días: Días de contrato restantes. Si el balance es negativo, se destaca visualmente en rojo indicando un desfase:",
                    }),
                    new Paragraph({
                        text: "   D_balance = D_revisados - D_transcurrido",
                        alignment: AlignmentType.CENTER,
                    }),
                    new Paragraph({ text: "" }),

                    // --- COSTOS ---
                    new Paragraph({
                        text: "4. MÓDULO DE COSTOS, PAGOS Y AVANCE DE OBRA",
                        heading: HeadingLevel.HEADING_1,
                    }),
                    new Paragraph({
                        text: "Consolida las métricas financieras clave para el análisis presupuestario:",
                    }),
                    new Paragraph({
                        text: "• Costo Original: Sumatoria del producto de cantidades originales por precio unitario en el listado de partidas contractuales.",
                    }),
                    new Paragraph({
                        text: "• Costo Ajustado: Costo vigente del proyecto tras considerar el impacto acumulado de las órdenes de cambio aprobadas:",
                    }),
                    new Paragraph({
                        text: "   Costo Ajustado = Costo Original + Sumatoria(Monto CHOs Aprobados)",
                        alignment: AlignmentType.CENTER,
                    }),
                    new Paragraph({
                        text: "• Trabajo Certificado hasta la Fecha (WP): Acumulado de la producción directa de partidas ejecutadas facturada en las certificaciones válidas (no excluidas).",
                    }),
                    new Paragraph({
                        text: "• Balance del Contrato (Remaining Balance): Presupuesto pendiente por facturar:",
                    }),
                    new Paragraph({
                        text: "   Balance Remaining = Costo Ajustado - Trabajo Certificado",
                        alignment: AlignmentType.CENTER,
                    }),
                    new Paragraph({
                        text: "• Porcentaje de Obra Ejecutada: Progreso financiero acumulado del proyecto:",
                    }),
                    new Paragraph({
                        text: "   Progreso Obra (%) = (Trabajo Certificado / Costo Ajustado) * 100",
                        alignment: AlignmentType.CENTER,
                    }),
                    new Paragraph({
                        text: "• Desglose de Participación de Fondos: Para cada pago, las partidas se clasifican según la aportación configurada:",
                    }),
                    new Paragraph({
                        text: "   FHWA Share = Monto Partida * (Tasa Federal % / 100)\n   ACT Share = Monto Partida - FHWA Share",
                        alignment: AlignmentType.CENTER,
                    }),
                    new Paragraph({ text: "" }),

                    // --- SALTO DE PÁGINA ---
                    new Paragraph({ text: "", pageBreakBefore: true }),

                    // --- MATERIAL ON SITE ---
                    new Paragraph({
                        text: "5. MÓDULO DE MATERIAL ON SITE (MOS)",
                        heading: HeadingLevel.HEADING_1,
                    }),
                    new Paragraph({
                        text: "Administra y rastrea de forma pormenorizada los fondos adelantados al contratista por concepto de acopio de materiales en el sitio de la obra:",
                    }),
                    new Paragraph({
                        text: "• Balance Histórico Pagado: Sumatoria de los montos totales aprobados por acopio de materiales en base a facturas verificadas por la inspección.",
                    }),
                    new Paragraph({
                        text: "• Amortización del MOS: Cuando el contratista incorpora y coloca el material en la obra física, el inspector certifica la partida correspondiente. El sistema calcula y deduce de forma automática el valor del material del balance disponible de acopio (MOS Balance Actual) aplicando el precio de la factura del material (obtenido de manera retrospectiva del historial de certificaciones).",
                        alignment: AlignmentType.JUSTIFY,
                    }),
                    new Paragraph({ text: "" }),

                    // --- CHANGE ORDERS ---
                    new Paragraph({
                        text: "6. MÓDULO DE CHANGE ORDERS (ÓRDENES DE CAMBIO)",
                        heading: HeadingLevel.HEADING_1,
                    }),
                    new Paragraph({
                        text: "Clasifica y tabula el universo de órdenes de cambio en dos grupos según su estatus administrativo:",
                    }),
                    new Paragraph({
                        text: "1. Aprobadas: Documentos con aprobación legal que incrementan o decrementan el presupuesto y el tiempo de contrato.",
                        style: "List Bullet"
                    }),
                    new Paragraph({
                        text: "2. En Trámite: Documentos en fase de evaluación que permiten proyectar el balance financiero futuro de la obra.",
                        style: "List Bullet"
                    }),
                    new Paragraph({
                        text: "El sistema calcula el porcentaje de variación presupuestal global mediante la relación:",
                    }),
                    new Paragraph({
                        text: "   % Cambio Costo = (Sumatoria Monto CHOs Aprobados / Costo Original) * 100",
                        alignment: AlignmentType.CENTER,
                    }),
                    new Paragraph({ text: "" }),

                    // --- RETENCIONES ---
                    new Paragraph({
                        text: "7. RETENCIONES, PENALIDADES Y LIQUIDACIÓN (NET PAID)",
                        heading: HeadingLevel.HEADING_1,
                    }),
                    new Paragraph({
                        text: "Establece la contabilidad neta transferida al contratista deduciendo todas las obligaciones contractuales:",
                    }),
                    new Paragraph({
                        text: "• Retención Contractual (5%): Retención automática aplicada sobre las partidas físicas que no gozan de exención aprobada (skip_retention = false).",
                    }),
                    new Paragraph({
                        text: "• Daños Líquidos (Liquidated Damages - DLQ): Penalización diaria acumulada por el retraso de obra una vez se sobrepasa la fecha revisada de terminación del contrato:",
                    }),
                    new Paragraph({
                        text: "   DLQ = Máximo(0, (Tiempo Transcurrido - Tiempo de Contrato Revisado) * Tasa Diaria)",
                        alignment: AlignmentType.CENTER,
                    }),
                    new Paragraph({
                        text: "• Retención Total: Suma de la retención del 5%, retenciones extraordinarias, multas por seguros y otras penalidades, descontando las devoluciones de retención, devoluciones por penalidades y ajustes de precios aplicados.",
                    }),
                    new Paragraph({
                        text: "• Net Paid (Pago Neto): Cantidad final pagada al contratista:",
                    }),
                    new Paragraph({
                        text: "   Net Paid = Trabajo Certificado - Retención Total",
                        alignment: AlignmentType.CENTER,
                    }),
                    new Paragraph({ text: "" }),

                    // --- CIERRE ---
                    new Paragraph({
                        text: "8. MÓDULO DE CIERRE Y LIQUIDACIÓN DE PARTIDAS",
                        heading: HeadingLevel.HEADING_1,
                    }),
                    new Paragraph({
                        text: "Mide el avance del proceso de cierre administrativo por partida contractual. Para liquidar una partida, se requiere recolectar la firma digital de tres agentes clave: Administrador del Proyecto, Contratista e Ingeniero Liquidador.",
                    }),
                    new Paragraph({
                        text: "El progreso porcentual de firmas recolectadas se calcula de la siguiente manera:",
                    }),
                    new Paragraph({
                        text: "   % Firmas Recolectadas = [ Firmas Recolectadas / (Cantidad Total de Partidas * 3) ] * 100",
                        alignment: AlignmentType.CENTER,
                    }),
                    new Paragraph({
                        text: "Asimismo, este módulo despliega la lista dinámica de documentos y certificaciones federales requeridas para proceder con la liquidación y el cierre oficial del expediente del proyecto ante la Autoridad de Carreteras y la FHWA.",
                        alignment: AlignmentType.JUSTIFY,
                    }),
                    new Paragraph({ text: "" }),

                    // --- PIE DE PÁGINA ---
                    new Paragraph({
                        text: "\n\n\nFin del Manual de Instrucciones del Dashboard de Resumen (PACT).",
                        alignment: AlignmentType.CENTER,
                    }),
                ],
            },
        ],
    });

    Packer.toBuffer(doc).then((buffer) => {
        const destFolder = "C:\\Users\\Enrique Saavedra\\Documents\\PROGRAMAS AI\\Programa ACT\\Documentos\\MANUAL PACT JULIO 2026";
        
        // Crear carpeta si no existe
        if (!fs.existsSync(destFolder)) {
            fs.mkdirSync(destFolder, { recursive: true });
        }

        const destFile = path.join(destFolder, "MANUAL_RESUMEN_PACT.docx");
        fs.writeFileSync(destFile, buffer);
        console.log("Documento WORD creado exitosamente en: " + destFile);
    }).catch(err => {
        console.error("Error al empaquetar el documento docx:", err);
    });
}

createManualDocx();
