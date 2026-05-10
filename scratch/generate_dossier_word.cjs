const {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, HeadingLevel, AlignmentType, BorderStyle,
  WidthType, ShadingType, Header, ImageRun
} = require('docx');
const fs = require('fs');
const path = require('path');

// ─── ESTILOS ─────────────────────────────────────────────────────────────────
const COLOR_HEADER   = '1E3A5F';  // Azul oscuro ACT
const COLOR_SUBHEAD  = '2E6DA4';  // Azul medio
const COLOR_ROW_ALT  = 'EBF2FA';  // Azul muy claro (filas alternas)
const COLOR_WARN     = 'FFF3CD';  // Amarillo advertencia
const COLOR_TIP      = 'D4EDDA';  // Verde tip
const COLOR_WHITE    = 'FFFFFF';

const styleTitle = (text) => new Paragraph({
  children: [new TextRun({ text, bold: true, size: 36, color: COLOR_HEADER, font: 'Calibri' })],
  alignment: AlignmentType.CENTER,
  spacing: { after: 120 }
});

const styleSubtitle = (text) => new Paragraph({
  children: [new TextRun({ text, size: 24, color: COLOR_SUBHEAD, font: 'Calibri', italics: true })],
  alignment: AlignmentType.CENTER,
  spacing: { after: 200 }
});

const styleH1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  children: [new TextRun({ text, bold: true, size: 28, color: COLOR_WHITE, font: 'Calibri' })],
  shading: { type: ShadingType.SOLID, color: COLOR_HEADER },
  spacing: { before: 300, after: 120 },
  indent: { left: 100 }
});

const styleH2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  children: [new TextRun({ text, bold: true, size: 24, color: COLOR_HEADER, font: 'Calibri' })],
  spacing: { before: 200, after: 80 }
});

const styleH3 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_3,
  children: [new TextRun({ text, bold: true, size: 22, color: COLOR_SUBHEAD, font: 'Calibri' })],
  spacing: { before: 160, after: 60 }
});

const styleNote = (text, bgColor = COLOR_WARN) => new Paragraph({
  children: [new TextRun({ text, size: 18, font: 'Calibri', italics: true })],
  shading: { type: ShadingType.SOLID, color: bgColor },
  spacing: { before: 80, after: 80 },
  indent: { left: 200, right: 200 }
});

const styleParagraph = (text) => new Paragraph({
  children: [new TextRun({ text, size: 20, font: 'Calibri' })],
  spacing: { after: 80 }
});

const spacer = () => new Paragraph({ spacing: { after: 100 } });

const makeHeaderRow = (cells) => new TableRow({
  children: cells.map(c => new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text: c, bold: true, size: 18, color: COLOR_WHITE, font: 'Calibri' })],
      alignment: AlignmentType.CENTER
    })],
    shading: { type: ShadingType.SOLID, color: COLOR_HEADER }
  }))
});

const makeDataRow = (cells, alt = false) => new TableRow({
  children: cells.map((c, i) => new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text: String(c), size: 18, font: 'Calibri', bold: i === 0 })],
      alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.CENTER
    })],
    shading: { type: ShadingType.SOLID, color: alt ? COLOR_ROW_ALT : COLOR_WHITE }
  }))
});

const makeKVTable = (rows) => new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: rows.map(([k, v], idx) => new TableRow({
    children: [
      new TableCell({
        width: { size: 35, type: WidthType.PERCENTAGE },
        children: [new Paragraph({
          children: [new TextRun({ text: k, bold: true, size: 18, font: 'Calibri', color: COLOR_HEADER })]
        })],
        shading: { type: ShadingType.SOLID, color: idx % 2 === 0 ? COLOR_ROW_ALT : COLOR_WHITE }
      }),
      new TableCell({
        width: { size: 65, type: WidthType.PERCENTAGE },
        children: [new Paragraph({
          children: [new TextRun({ text: v, size: 18, font: 'Calibri' })]
        })],
        shading: { type: ShadingType.SOLID, color: idx % 2 === 0 ? COLOR_ROW_ALT : COLOR_WHITE }
      })
    ]
  }))
});

// ─── DOCUMENTO ───────────────────────────────────────────────────────────────
const doc = new Document({
  creator: 'PACT - Ing. Enrique Saavedra Sada, PE',
  title: 'Dossier de Prueba PACT - Rehabilitación PR-111',
  description: 'Documento de prueba del sistema PACT para proyecto vial en Puerto Rico',
  sections: [{
    children: [

      // ── PORTADA ──────────────────────────────────────────────────────────
      spacer(),
      styleTitle('🛣️  DOSSIER DE PROYECTO DE PRUEBA — PACT'),
      styleSubtitle('Rehabilitación de Pavimento y Mejoras de Drenaje — PR-111'),
      styleSubtitle('Versión Simplificada para Prueba de Sistema'),
      spacer(),
      new Paragraph({
        children: [new TextRun({ text: 'Diseñador del Sistema PACT: Ing. Enrique Saavedra Sada, PE', size: 20, font: 'Calibri', bold: true, color: COLOR_SUBHEAD })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      }),

      // ── SECCIÓN 1: DATOS GENERALES ────────────────────────────────────
      styleH1('📌  1. REQUISITOS GENERALES DEL PROYECTO'),
      styleNote('⚠️  IMPORTANTE: El Número AC y el Número de Contrato son campos distintos en PACT. El AC identifica el proyecto ante la ACT; el número de contrato es el documento legal firmado con el contratista.', COLOR_WARN),
      spacer(),
      makeKVTable([
        ['Nombre del Proyecto',         'Rehabilitación de Pavimento, Mejoras a Drenaje y Seguridad Vial en la PR-111'],
        ['Tipo de Proyecto',            'Construcción de Carretera / Federal-Aid Project'],
        ['Región',                      'Metro'],
        ['Ubicación',                   'PR-111, Km 15.0 al Km 22.5, Jurisdicción de San Sebastián a Lares, PR'],
        ['Dueño del Proyecto (Owner)',  'Autoridad de Carreteras y Transportación (ACT)'],
        ['Contratista General (GC)',    'Caribbean Roadbuilders, LLC'],
        ['Ingeniero de Récord',         'Vías PR Engineering Group, CSP'],
        ['Inspector Asignado',          'Ing. Roberto Colón Meléndez, PE'],
        ['Fecha de Inicio (NTP)',       '1 de febrero de 2026'],
        ['Fecha de Terminación',        '30 de noviembre de 2026 (303 días calendario)'],
        ['Monto Total del Contrato',    '$5,250,000.00'],
        ['Tipo de Contrato',            'Precio Unitario (Unit Price)'],
        ['🔑 Número AC',               'AC-011124'],
        ['🔑 Número de Contrato',      'DTOP-2026-CR-0045'],
        ['Número Federal (Fed-Aid)',    'STP-PR-0111(024)'],
        ['Número Oracle',              '7200-2026-0045'],
        ['Número de Cuenta',           '0045-2026-METRO'],
        ['Retención (Retainage)',       '10% hasta alcanzar 50% de progreso físico; luego 5% a discreción de la agencia'],
      ]),

      // ── SECCIÓN 2: PARTIDAS ───────────────────────────────────────────
      styleH1('📊  2. PARTIDAS DEL PROYECTO — MICRO SOV (4 Partidas)'),
      styleParagraph('De las 15 partidas originales del proyecto, se seleccionaron 4 para ejercitar diferentes módulos de PACT.'),
      spacer(),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          makeHeaderRow(['No.', 'Descripción', 'Cantidad', 'Unidad', 'P. Unitario', 'Costo Total', 'Subcontratista']),
          makeDataRow(['001', 'Movilización (Mobilization)', '1.00', 'LS', '$250,000.00', '$250,000.00', 'Caribbean Roadbuilders (Self)'], false),
          makeDataRow(['007', 'Pavimento Asfáltico Caliente (HMA Tipo II)', '18,500.00', 'TON', '$130.00', '$2,405,000.00', 'Asfalto Boricua, Inc.'], true),
          makeDataRow(['009', 'Tubería de Concreto Reforzado (RCP) 24"', '2,200.00', 'LF', '$120.00', '$264,000.00', 'Tubos del Sur, Inc.'], false),
          makeDataRow(['011', 'Vallas de Seguridad (W-Beam Guardrail)', '6,500.00', 'LF', '$40.00', '$260,000.00', 'PR Safety Barriers, Inc.'], true),
          makeHeaderRow(['', '', '', '', 'TOTAL MICRO-SOV:', '$3,179,000.00', '']),
        ]
      }),
      spacer(),
      styleNote('📝  El monto total del contrato en PACT debe registrarse como $5,250,000.00 (contrato completo). El Micro-SOV solo representa las 4 partidas activas en esta prueba.', COLOR_TIP),

      // ── SECCIÓN 3: CHANGE ORDER ───────────────────────────────────────
      styleH1('🔁  3. CHANGE ORDER — CO-01'),
      styleH2('CO-01: Ajuste por Condición Variable de Suelo'),
      makeKVTable([
        ['Número de CO',              'CO-01'],
        ['Número de Suplemento',      'SUPP-001 (ACT-123)'],
        ['Tipo',                      'Trabajo Extra / Condición Imprevista (Unforeseen Condition)'],
        ['Descripción',               'Se encontró roca sólida masiva (Clase D) no indicada en el Estudio Geotécnico durante la excavación de la Partida 004'],
        ['Justificación',             'El contrato original contempla únicamente excavación no clasificada. La roca requiere equipo especializado (martillo hidráulico) y métodos distintos'],
        ['Partida Nueva Creada',      '004-A: Excavación en Roca'],
        ['Cantidad',                  '500 CY'],
        ['Precio Unitario',           '$80.00/CY'],
        ['Impacto en Costo',          '+$40,000.00'],
        ['Nuevo Total del Contrato',  '$5,290,000.00'],
        ['Impacto en Tiempo',         '+15 días calendario'],
        ['Nueva Fecha de Terminación','14 de diciembre de 2026'],
        ['Referencia RFI',            'RFI-007 (emitido el 15 de marzo de 2026)'],
        ['Aprobación Requerida',      'Ing. Supervisor ACT / Administrador de Contratos'],
      ]),

      // ── SECCIÓN 4: MATERIAL ON-SITE ───────────────────────────────────
      styleH1('🏗️  4. MATERIAL ALMACENADO EN OBRA (Material On-Site)'),
      styleH2('Registro MS-001: Tubería RCP 24" — Item 009'),
      makeKVTable([
        ['ID de Registro',          'MS-001'],
        ['Partida Relacionada',     '009 — Tubería de Concreto Reforzado (RCP) 24"'],
        ['Suplidor',                'Tubos del Sur, Inc.'],
        ['Descripción',             '440 secciones de tubería RCP Clase III de 24", 5 pies de longitud, conforme a AASHTO M 170'],
        ['Ubicación de Almacenaje', 'Predio del proyecto, Km 16.2 PR-111, área de acopio designada'],
        ['Cantidad Almacenada',     '440 LF'],
        ['Precio Unitario',         '$120.00/LF'],
        ['Valor del Material',      '$52,800.00'],
        ['Factura de Compra',       'Factura No. TS-2026-0312 de Tubos del Sur, Inc.'],
        ['Fecha de Factura',        '5 de febrero de 2026'],
        ['Evidencia de Pago',       'Cheque No. 4421 de Caribbean Roadbuilders — Cancelado el 10 de febrero de 2026'],
        ['Documentación Requerida', 'Factura pagada, foto de material en obra, certificado de manufactura'],
        ['Estado',                  'On-Site (Almacenado)'],
      ]),

      // ── SECCIÓN 5: CERTIFICADO DE MANUFACTURA ────────────────────────
      styleH1('🏭  5. CERTIFICADO DE MANUFACTURA — CM-001'),
      styleH2('Planta Asfáltica — Item 007: Pavimento Asfáltico Caliente'),
      makeKVTable([
        ['ID de Certificado',       'CM-001'],
        ['Partida Relacionada',     '007 — Pavimento Asfáltico Caliente (HMA Tipo II)'],
        ['Tipo de Material',        'Mezcla Asfáltica en Caliente (HMA) Tipo II — Capa de Rodamiento'],
        ['Fabricante / Planta',     'Asfalto Boricua, Inc. — Planta de Bayamón'],
        ['Dirección de la Planta',  'Carr. PR-2, Km 11.3, Bayamón, PR 00961'],
        ['Número de Certificado',   'ASFB-CM-2026-007'],
        ['Fecha de Emisión',        '1 de febrero de 2026'],
        ['Fecha de Vencimiento',    '31 de enero de 2027'],
        ['Diseño de Mezcla (JMF)', 'JMF-PR111-2026 — Aprobado por ACT el 20 de enero de 2026'],
        ['Especificación',          'ACT Sección 403 — Pavimento Asfáltico Caliente'],
        ['Contenido de Asfalto',    '5.8% en peso de la mezcla total'],
        ['Tipo de Asfalto',         'PG 76-22 (Performance Grade)'],
        ['% de Vacíos',             '4.0% (rango especificado 3.0%–5.0%)'],
        ['Densidad Máxima (Rice)',  '2.467 g/cm³'],
        ['Ingeniero Firmante',      'Ing. Carmen Maldonado Torres, PE — Lic. 12457'],
        ['Ingeniería que Aprueba',  'Vías PR Engineering Group, CSP'],
      ]),
      spacer(),
      styleNote('⛔  PACT no debe permitir el cobro del Item 007 si el Certificado CM-001 no ha sido cargado y aprobado previamente en el sistema.', COLOR_WARN),

      // ── SECCIÓN 6: CERTIFICACIÓN DE PAGO ─────────────────────────────
      styleH1('💰  6. CERTIFICACIÓN DE PAGO #1'),
      styleH2('Periodo: 1 al 28 de febrero de 2026'),
      makeKVTable([
        ['Número de Certificación', 'Cert-001'],
        ['Número de Pay Application','PA-2026-001'],
        ['Periodo de Pago',         '1 de febrero al 28 de febrero de 2026'],
        ['Fecha de Sometimiento',   '2 de marzo de 2026'],
        ['Fecha de Aprobación Est.','9 de marzo de 2026'],
      ]),
      spacer(),
      styleH3('6.1 Desglose por Partida'),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          makeHeaderRow(['No.', 'Descripción', 'Costo Total', '% Completado', 'Monto Bruto']),
          makeDataRow(['001', 'Movilización (LS)', '$250,000.00', '25.00%', '$62,500.00'], false),
          makeDataRow(['007', 'Pavimento Asfáltico', '$2,405,000.00', '0.00%', '$0.00'], true),
          makeDataRow(['009', 'Tubería RCP 24"', '$264,000.00', '0.00%', '$0.00'], false),
          makeDataRow(['011', 'Vallas de Seguridad', '$260,000.00', '0.00%', '$0.00'], true),
          makeDataRow(['MS-001', 'Material On-Site (Tubería RCP)', '—', '—', '$52,800.00'], false),
          makeHeaderRow(['', '', '', 'TOTAL BRUTO:', '$115,300.00']),
        ]
      }),
      spacer(),
      styleH3('6.2 Cálculo de Retenciones y Pago Neto'),
      makeKVTable([
        ['Total Bruto del Periodo',    '$115,300.00'],
        ['Retención 10% (Retainage)', '-$11,530.00'],
        ['TOTAL NETO A PAGAR',        '$103,770.00'],
        ['Pagos Anteriores',          '$0.00'],
        ['Saldo Pendiente Contrato',  '$5,134,700.00'],
      ]),
      spacer(),
      styleH3('6.3 Documentación a Adjuntar en PACT'),
      styleParagraph('☐  Certificado de Manufactura CM-001 (Asfalto HMA)'),
      styleParagraph('☐  Factura No. TS-2026-0312 (Tubos del Sur)'),
      styleParagraph('☐  Cheque No. 4421 (Evidencia de Pago cancelado)'),
      styleParagraph('☐  Fotos de material almacenado en obra (Km 16.2)'),
      styleParagraph('☐  Informes Diarios ACT-45 (semanas del 1 al 28 de febrero de 2026)'),

      // ── SECCIÓN 7: CUMPLIMIENTO LABORAL ──────────────────────────────
      styleH1('🧾  7. CUMPLIMIENTO LABORAL (Labor Compliance)'),
      styleH2('Clasificaciones Davis-Bacon'),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          makeHeaderRow(['Clasificación', 'Tasa Base', 'Fringe Benefits', 'Total/Hr']),
          makeDataRow(['Operador de Equipo Pesado Grupo I', '$24.50/hr', '$9.15/hr', '$33.65/hr'], false),
          makeDataRow(['Operador de Equipo Pesado Grupo II', '$21.75/hr', '$9.15/hr', '$30.90/hr'], true),
          makeDataRow(['Carpintero', '$19.80/hr', '$8.90/hr', '$28.70/hr'], false),
          makeDataRow(['Obrero (Laborer)', '$16.25/hr', '$8.25/hr', '$24.50/hr'], true),
        ]
      }),
      spacer(),
      styleH2('Subcontratistas con WH-347 requerido (Febrero 2026)'),
      makeKVTable([
        ['Asfalto Boricua, Inc.',    'WH-347 semanas 1–4 de febrero 2026'],
        ['PR Safety Barriers, Inc.', 'WH-347 semanas 3–4 de febrero 2026'],
      ]),

      // ── SECCIÓN 8: DOCUMENTACIÓN GENERAL ─────────────────────────────
      styleH1('📁  8. DOCUMENTACIÓN GENERAL A CARGAR EN PACT'),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          makeHeaderRow(['#', 'Documento', 'Tipo', 'Obligatorio', 'Estado']),
          makeDataRow(['1', 'Contrato DTOP-2026-CR-0045', 'Contrato', 'Sí', 'Pendiente'], false),
          makeDataRow(['2', 'Performance Bond SURETY-2026-4421', 'Fianza', 'Sí', 'Pendiente'], true),
          makeDataRow(['3', 'Payment Bond SURETY-2026-4422', 'Fianza', 'Sí', 'Pendiente'], false),
          makeDataRow(['4', 'Certificate of Insurance GL-789456', 'Seguro', 'Sí', 'Pendiente'], true),
          makeDataRow(['5', 'Job Mix Formula JMF-PR111-2026', 'Submittal', 'Sí', 'Pendiente'], false),
          makeDataRow(['6', 'Certificado de Manufactura CM-001', 'Cert. Manufactura', 'Sí', 'Pendiente'], true),
          makeDataRow(['7', 'Factura Tubos del Sur TS-2026-0312', 'Factura', 'Sí', 'Pendiente'], false),
          makeDataRow(['8', 'Cheque No. 4421 (Evidencia de Pago)', 'Evidencia', 'Sí', 'Pendiente'], true),
          makeDataRow(['9', 'Informes Diarios ACT-45 (Feb 2026)', 'Daily Logs', 'Sí', 'Pendiente'], false),
          makeDataRow(['10', 'Fotos Acopio Tubería RCP — Km 16.2', 'Fotografías', 'Sí', 'Pendiente'], true),
        ]
      }),
      spacer(),
      styleNote('💡  SECUENCIA RECOMENDADA EN PACT: (1) Crear el Proyecto → (2) Ingresar 4 Partidas → (3) Subir Certificado CM-001 → (4) Registrar Material On-Site MS-001 → (5) Crear CHO CO-01 → (6) Generar Certificación Cert-001', COLOR_TIP),
      spacer(),

      // ── PIE DE PÁGINA ──────────────────────────────────────────────
      new Paragraph({
        children: [new TextRun({ text: 'Documento generado por PACT — Ing. Enrique Saavedra Sada, PE — Mayo 2026', size: 16, italics: true, color: '888888', font: 'Calibri' })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 300 }
      }),
    ]
  }]
});

const outputPath = path.join(__dirname, 'Dossier_Prueba_PACT_PR111.docx');
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(outputPath, buffer);
  console.log('✅ Documento Word generado exitosamente en:');
  console.log(outputPath);
}).catch(err => {
  console.error('❌ Error al generar el documento:', err);
});
