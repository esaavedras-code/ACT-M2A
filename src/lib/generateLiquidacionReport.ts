import { supabase } from './supabase';
import { formatDate as utilsFormatDate } from './utils';


const roundedAmt = (val: number, dec: number) =>
    Math.round(val * Math.pow(10, dec)) / Math.pow(10, dec);
const formatC = (val: number) =>
    val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ═══════════════════════════════════════════════════════════════
// REPORTE — HOJAS DE LIQUIDACIÓN
// Landscape Letter (792 × 612)
// Réplica exacta del formulario oficial "LIQUIDACION" de la
// Autoridad de Carreteras y Transportación — Puerto Rico
// ═══════════════════════════════════════════════════════════════
export const generateLiquidacionItemsReportLogic = async (projectId: string) => {

    // ── 1. Fetch data ──────────────────────────────────────────
    const { data: proj } = await supabase.from('projects').select('*').eq('id', projectId).single();
    if (!proj) throw new Error('Proyecto no encontrado');

    const { data: contr } = await supabase.from('contractors').select('name').eq('project_id', projectId).single();
    const fallbackContractor = contr?.name || '';

    const { data: items } = await supabase
        .from('contract_items').select('*').eq('project_id', projectId)
        .order('item_num', { ascending: true });

    if (!items || items.length === 0) {
        alert('No hay partidas registradas para este proyecto.');
        return;
    }

    const { data: certs } = await supabase
        .from('payment_certifications').select('*').eq('project_id', projectId)
        .order('cert_num', { ascending: true });

    const { data: chos } = await supabase
        .from('chos').select('*').eq('project_id', projectId)
        .order('cho_num', { ascending: true });

    // ── 2. PDF Setup ───────────────────────────────────────────
    const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.create();
    const fR = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const BK = rgb(0, 0, 0);
    const WH = rgb(1, 1, 1);

    // ── Logo ACT (Carreteras) ──────────────────────────────────
    // Primero el logo oficial ACT, luego icon.png como respaldo
    let logoImg: any = null;
    try {
        const paths = ['/act_logo.png', '/icon.png', '/logo.png'];
        for (const p of paths) {
            try {
                const resp = await fetch(p);
                if (resp.ok) {
                    const bytes = await resp.arrayBuffer();
                    const arr = new Uint8Array(bytes);
                    // Detectar PNG (89 50 4E 47) o JPG (FF D8)
                    if (arr[0] === 0x89 && arr[1] === 0x50) {
                        logoImg = await pdfDoc.embedPng(arr);
                    } else if (arr[0] === 0xFF && arr[1] === 0xD8) {
                        logoImg = await pdfDoc.embedJpg(arr);
                    }
                    if (logoImg) break;
                }
            } catch (_) { /* continuar con siguiente */ }
        }
    } catch (_) { }


    // ── Dimensiones: Landscape Letter 792 × 612 ────────────────
    const PW = 792, PH = 612;
    const ML = 36, MR = 36, MT = 26, MB = 24;
    const CW = PW - ML - MR;   // 720 pts de ancho útil

    // ──────────────────────────────────────────────────────────
    // Helpers de dibujo (todo en B&W)
    // ──────────────────────────────────────────────────────────
    const RED = rgb(0.8, 0, 0);
    const TXT = (
        pg: any, text: string,
        x: number, y: number, sz: number,
        bold = false,
        align: 'left' | 'center' | 'right' = 'left',
        maxW?: number
    ) => {
        if (text === undefined || text === null) return;
        let s = text.toString().replace(/[\x00-\x09\x0B-\x1F]/g, '');
        if (!s) return;

        let textColor = BK;
        const trimmed = s.trim();
        if (trimmed.startsWith('-')) {
            const val = parseFloat(trimmed.replace(/[^\d.-]/g, '')) || 0;
            if (val < 0) {
                textColor = RED;
                s = `(${trimmed.substring(1).trim()})`;
            } else {
                s = trimmed.substring(1).trim(); // Remueve el menos si es cero
            }
        }

        const font = bold ? fB : fR;
        if (maxW) {
            while (s.length > 1 && font.widthOfTextAtSize(s, sz) > maxW - 2) {
                s = s.slice(0, -1);
            }
        }
        let px = x;
        if (align === 'center') px = x - font.widthOfTextAtSize(s, sz) / 2;
        if (align === 'right') px = x - font.widthOfTextAtSize(s, sz);
        pg.drawText(s, { x: px, y, size: sz, font, color: textColor });
    };

    const RECT = (pg: any, x: number, y: number, w: number, h: number,
        fill = WH, bw = 0.5) =>
        pg.drawRectangle({ x, y, width: w, height: h, color: fill, borderColor: BK, borderWidth: bw });

    const H_LINE = (pg: any, x1: number, y: number, x2: number, bw = 0.5) =>
        pg.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: bw, color: BK });

    // ──────────────────────────────────────────────────────────
    // Datos por partida
    // ──────────────────────────────────────────────────────────
    const getItemData = (item: any) => {
        const certRows: { cert: any; qty: number }[] = [];
        (certs || []).forEach((cert: any) => {
            const ci = Array.isArray(cert.items) ? cert.items : [];
            const m = ci.find((it: any) => it.item_num === item.item_num);
            if (m) certRows.push({ cert, qty: parseFloat(m.quantity) || 0 });
        });

        const choRows: { cho: any; ci: any }[] = [];
        (chos || []).forEach((cho: any) => {
            const ci = Array.isArray(cho.items) ? cho.items : [];
            const m = ci.find((it: any) => it.item_num === item.item_num);
            if (m) choRows.push({ cho, ci: m });
        });

        const totalExe = certRows.reduce((a, r) => a + r.qty, 0);
        const choTotalQty = choRows.reduce((a, r) => a + (parseFloat(r.ci.quantity) || 0), 0);
        const choTotalAmt = choRows.reduce((a, r) =>
            a + roundedAmt((parseFloat(r.ci.quantity) || 0) * (parseFloat(r.ci.unit_price) || 0), 2), 0);

        return { certRows, choRows, totalExe, choTotalQty, choTotalAmt };
    };

    // ──────────────────────────────────────────────────────────
    // Dibujar UNA página landscape por partida
    // ──────────────────────────────────────────────────────────
    const drawItemPage = (item: any, pageIndex: number, totalItems: number) => {
        const pg = pdfDoc.addPage([PW, PH]);

        const { certRows, totalExe, choTotalQty, choTotalAmt } = getItemData(item);
        const qOrig = parseFloat(item.quantity) || 0;
        const pUnit = parseFloat(item.unit_price) || 0;
        const mOrig = roundedAmt(qOrig * pUnit, 2);

        let Y = PH - MT;

        // ══════════════════════════════════════════════════════
        // ENCABEZADO
        // Logos en las esquinas y texto institucional centrado
        // ══════════════════════════════════════════════════════
        const LOGO_MAXW = 100, LOGO_MAXH = 40;
        const topY = PH - MT;

        if (logoImg) {
            const dims = logoImg.scaleToFit(LOGO_MAXW, LOGO_MAXH);
            pg.drawImage(logoImg, {
                x: ML,
                y: topY - dims.height,
                width: dims.width,
                height: dims.height,
            });
        }


        // Texto institucional y de M2A Group centrado
        const pageCenter = PW / 2;
        TXT(pg, 'M2A Group - Sistema de Control de Proyectos', pageCenter, topY - 8, 9, false, 'center');
        TXT(pg, 'Autoridad de Carreteras y Transportación - Área de Construcción', pageCenter, topY - 20, 9, true, 'center');

        // Número de proyecto ACT centralizado
        const actNum = proj.num_act || (proj.num_contrato || '');
        if (actNum) {
            TXT(pg, `PROYECTO: ${proj.name || ''} - ${actNum}`, pageCenter, topY - 32, 9, true, 'center');
        }

        TXT(pg, `Fecha de impresión del reporte: ${utilsFormatDate(new Date())}`, pageCenter, topY - 44, 7.5, false, 'center');

        Y -= 55;

        // ══════════════════════════════════════════════════════
        // TÍTULO: LIQUIDACION  (sin fondo de color)
        // ══════════════════════════════════════════════════════
        TXT(pg, 'LIQUIDACION', ML, Y, 11, true);
        Y -= 4;
        H_LINE(pg, ML, Y, ML + CW, 0.8);
        Y -= 35;

        // ══════════════════════════════════════════════════════
        // FILA 1: Partida # | Descripción | Proyecto
        // ══════════════════════════════════════════════════════
        TXT(pg, 'Partida #', ML, Y, 7);
        const pNumLblW = 46;
        const pNumValW = 60;
        TXT(pg, item.item_num || '', ML + pNumLblW + 2, Y, 9, true);
        H_LINE(pg, ML + pNumLblW, Y - 2, ML + pNumLblW + pNumValW, 0.5);

        const dscLblX = ML + pNumLblW + pNumValW + 8;
        TXT(pg, 'Descripción', dscLblX, Y, 7);
        const dscValX = dscLblX + 52;
        const dscValW = 240;
        TXT(pg, item.description || '', dscValX, Y, 7.5, false, 'left', dscValW);
        H_LINE(pg, dscValX, Y - 2, dscValX + dscValW, 0.5);

        const proyLblX = dscValX + dscValW + 8;
        TXT(pg, 'Proyecto', proyLblX, Y, 7);
        const proyValX = proyLblX + 40;
        const proyValW = ML + CW - proyValX;
        TXT(pg, proj.name || '', proyValX, Y, 7, false, 'left', proyValW);
        H_LINE(pg, proyValX, Y - 2, proyValX + proyValW, 0.5);

        Y -= 17;

        // ══════════════════════════════════════════════════════
        // FILA 2: Cantidad Original @ PU = Monto | Codificación
        // ══════════════════════════════════════════════════════
        TXT(pg, 'Cantidad Original', ML, Y, 7);
        const cLblW = 80, cNumW = 72;
        const cantUnitStr = `${qOrig.toString()}  ${item.unit || ''}`.trim();
        TXT(pg, cantUnitStr, ML + cLblW + 2, Y, 8, true);
        H_LINE(pg, ML + cLblW, Y - 2, ML + cLblW + cNumW, 0.5);

        const atX = ML + cLblW + cNumW + 5;
        TXT(pg, '@', atX, Y, 8);

        const puValX = atX + 10;
        const puValW = 68;
        TXT(pg, `$ ${formatC(pUnit)}`, puValX, Y, 8, true);
        H_LINE(pg, puValX, Y - 2, puValX + puValW, 0.5);

        const eqX = puValX + puValW + 5;
        TXT(pg, '=', eqX, Y, 8);

        const montoValX = eqX + 10;
        const montoValW = 70;
        TXT(pg, `$ ${formatC(mOrig)}`, montoValX, Y, 8, true);
        H_LINE(pg, montoValX, Y - 2, montoValX + montoValW, 0.5);

        const codLblX = montoValX + montoValW + 10;
        TXT(pg, 'Codificación', codLblX, Y, 7);
        const codValX = codLblX + 54;
        const codValW = ML + CW - codValX;
        TXT(pg, item.specification || '', codValX, Y, 7.5, false, 'left', codValW);
        H_LINE(pg, codValX, Y - 2, codValX + codValW, 0.5);

        Y -= 11;

        // ══════════════════════════════════════════════════════
        // TABLA PRINCIPAL  (todas las celdas en BLANCO, sin color)
        //
        // Columnas (CW = 720 pts):
        //  0: Localización o Progresiva   — 110
        //  1: Cantidad Ejecutada          — 72
        //  2: Unidad                      — 46
        //  3: Obra y/o Estructura         — 84
        //  4: Tipo                        — 34
        //  5: Rótulo                      — 34
        //  6: Código                      — 42
        //  7: Libreta de Campo y/o        — 110
        //     Rollos Milimétricos
        //  8: Referencia                  — 188
        //  Total: 110+72+46+84+34+34+42+110+188 = 720 ✓
        // ══════════════════════════════════════════════════════
        const COL_W = [110, 72, 46, 84, 34, 34, 42, 110, 188];
        const COL_X: number[] = [ML];
        for (let i = 1; i < COL_W.length; i++) COL_X[i] = COL_X[i - 1] + COL_W[i - 1];

        const HDR_H = 26;

        // Encabezados en BLANCO (sin color azul)
        COL_W.forEach((w, i) => RECT(pg, COL_X[i], Y - HDR_H, w, HDR_H, WH));

        // Textos de encabezado centrados
        const hCX = (i: number) => COL_X[i] + COL_W[i] / 2;
        const hdrs: [string, string][] = [
            ['Localización o', 'Progresiva'],
            ['Cantidad', 'Ejecutada'],
            ['Unidad', ''],
            ['Obra y/o', 'Estructura'],
            ['Tipo', ''],
            ['Rótulo', ''],
            ['Código', ''],
            ['Libreta de Campo y/o', 'Rollos Milimétricos'],
            ['Referencia', ''],
        ];
        hdrs.forEach(([l1, l2], i) => {
            if (l2) {
                TXT(pg, l1, hCX(i), Y - 9, 5.5, true, 'center');
                TXT(pg, l2, hCX(i), Y - 18, 5.5, true, 'center');
            } else {
                TXT(pg, l1, hCX(i), Y - 16, 5.5, true, 'center');
            }
        });
        Y -= HDR_H;

        // ── FILAS DE DATOS ──────────────────────────────
        const ROW_H = 12;
        const MAX_ROWS = 9;

        let rowsDrawn = 0;
        certRows.slice(0, MAX_ROWS).forEach(({ cert, qty }) => {
            for (let i = 0; i < 8; i++) RECT(pg, COL_X[i], Y - ROW_H, COL_W[i], ROW_H, WH, 0.4);
            TXT(pg, `Cert. #${cert.cert_num}  ${utilsFormatDate(cert.cert_date)}`, COL_X[0] + 2, Y - 8, 5.5);
            TXT(pg, qty.toFixed(3), COL_X[1] + COL_W[1] - 3, Y - 8, 6.5, false, 'right');
            TXT(pg, item.unit || '', hCX(2), Y - 8, 6.5, false, 'center');
            Y -= ROW_H;
            rowsDrawn++;
        });

        // Filas vacías
        for (let r = rowsDrawn; r < MAX_ROWS; r++) {
            for (let i = 0; i < 8; i++) RECT(pg, COL_X[i], Y - ROW_H, COL_W[i], ROW_H, WH, 0.4);
            Y -= ROW_H;
        }

        // ── FILAS RESUMEN ────────────────────────────────
        const SUM_H = 13;
        const subAmt = roundedAmt(totalExe * pUnit, 2);
        const totalQty = roundedAmt(qOrig + choTotalQty, 4);
        const totalAmt = roundedAmt(mOrig + choTotalAmt, 2);

        // Economía = diferencia entre lo presupuestado original y lo ejecutado
        const econQty = roundedAmt(totalQty - totalExe, 4);
        const econAmt = roundedAmt(totalAmt - subAmt, 2);

        // ── Fila 1: SUB-TOTAL (izq) | AUMENTO (centro-der) ──
        for (let i = 0; i < 8; i++) RECT(pg, COL_X[i], Y - SUM_H, COL_W[i], SUM_H, WH, 0.5);

        // SUB-TOTAL: label + cantidad ejecutada
        TXT(pg, 'SUB-TOTAL', hCX(0), Y - 9, 6.5, true, 'center');
        TXT(pg, totalExe.toFixed(3), COL_X[1] + COL_W[1] - 3, Y - 9, 6.5, false, 'right');

        // AUMENTO: label + qty CHO + monto CHO (si hubo)
        TXT(pg, 'AUMENTO', hCX(3), Y - 9, 6.5, true, 'center');
        if (choTotalQty !== 0) {
            const sign = choTotalQty > 0 ? '+' : '';
            TXT(pg, `${sign}${choTotalQty.toFixed(3)}`, COL_X[4] + 2, Y - 9, 5.5);
            TXT(pg, `${sign}$ ${formatC(choTotalAmt)}`, COL_X[6] + 2, Y - 9, 5.5, true);
        } else {
            TXT(pg, 'N/A', COL_X[4] + 2, Y - 9, 5.5);
        }
        Y -= SUM_H;

        // ── Fila 2: TOTAL (izq) | ECONOMIA (centro-der) ──
        for (let i = 0; i < 8; i++) RECT(pg, COL_X[i], Y - SUM_H, COL_W[i], SUM_H, WH, 0.5);

        // TOTAL: label + cantidad total ajustada
        TXT(pg, 'TOTAL', hCX(0), Y - 9, 6.5, true, 'center');
        TXT(pg, totalQty.toFixed(3), COL_X[1] + COL_W[1] - 3, Y - 9, 6.5, false, 'right');

        // ECONOMIA: diferencia entre total ajustado y lo realmente ejecutado
        TXT(pg, 'ECONOMIA', hCX(3), Y - 9, 6.5, true, 'center');
        if (Math.abs(econQty) > 0.001) {
            const eSign = econQty > 0 ? '+' : '';
            TXT(pg, `${eSign}${econQty.toFixed(3)}`, COL_X[4] + 2, Y - 9, 5.5);
            TXT(pg, `${eSign}$ ${formatC(econAmt)}`, COL_X[6] + 2, Y - 9, 5.5, true);
        } else {
            TXT(pg, '—', COL_X[4] + 2, Y - 9, 5.5);
        }
        Y -= SUM_H;

        // ── COLUMNA 8: REFERENCIA ─────────────────────────
        const refColX = COL_X[8];
        const refColW = COL_W[8];
        const refTotalH = MAX_ROWS * ROW_H + 2 * SUM_H;
        RECT(pg, refColX, Y, refColW, refTotalH, WH, 0.5);

        // Items de referencia 1-10, agrupados en pares (número + sub-línea)
        const refItems = [
            { num: '1. Subcontrato aprobado', sub: 'en cartapacio #' },
            { num: '2. Certificados fabricante', sub: 'en cartapacio #' },
            { num: '3. Informes de laboratorios', sub: 'en cartapacio #' },
            { num: '4. Hojas del Plano #', sub: '' },
            { num: '5. Conduces Asfalto u otros', sub: 'en cartapacio #' },
            { num: '6. Planta, mezcla y/o diseño', sub: 'en cartapacio #' },
            { num: '7. Informes diarios', sub: 'en cartapacio #' },
            { num: '8. Correspondencia y/o dibujos', sub: 'en cartapacio #' },
            { num: '9. Otros', sub: '' },
            { num: '10.', sub: '' },
        ];

        const refSpacing = refTotalH / (refItems.length + 0.5);
        refItems.forEach((ref, idx) => {
            const ry = Y + refTotalH - (idx + 0.8) * refSpacing;
            TXT(pg, ref.num, refColX + 3, ry, 5.5);
            if (ref.sub) TXT(pg, ref.sub, refColX + 9, ry - 7, 5);
        });

        Y -= 30; // espacio antes de firmas

        // ══════════════════════════════════════════════════════
        // FIRMAS: ADM. DEL PROYECTO | CONTRATISTA | LIQUIDADOR
        // Con nombre de la persona debajo de cada rol
        // ══════════════════════════════════════════════════════
        const sigW = (CW - 20) / 3;
        const sx = [ML, ML + sigW + 10, ML + 2 * (sigW + 10)];

        // Nombres de las personas (del proyecto)
        const sigPersonas = [
            proj.admin_name || '',
            proj.contractor_name || fallbackContractor,
            proj.liquidador_name || '',
        ];

        // Líneas de firma
        sx.forEach(x => H_LINE(pg, x, Y, x + sigW, 0.8));
        Y -= 11;

        // Roles (en negrita)
        const sigLabels = ['ADM. DEL PROYECTO', 'CONTRATISTA', 'LIQUIDADOR'];
        sx.forEach((x, i) => TXT(pg, sigLabels[i], x + sigW / 2, Y, 7, true, 'center'));
        Y -= 10;

        // Nombres (en normal, debajo del rol)
        sx.forEach((x, i) => {
            if (sigPersonas[i]) {
                TXT(pg, sigPersonas[i], x + sigW / 2, Y, 6.5, false, 'center', sigW - 4);
            }
        });
        Y -= 16;

        // Fechas
        sx.forEach(x => {
            TXT(pg, 'FECHA', x, Y, 7, true);
            H_LINE(pg, x + 32, Y - 2, x + sigW, 0.5);
        });

        Y -= 11;
        H_LINE(pg, ML, Y, ML + CW, 0.6);
        Y -= 2;

        // ══════════════════════════════════════════════════════
        // BLOQUE INFERIOR: Observaciones | E.W.O. # | PAG. #
        // Altura reducida y fija
        // ══════════════════════════════════════════════════════
        const OBS_H = 65;   // Triplicado el espacio para observaciones
        const ewoW = 75;
        const obsW = CW - ewoW;
        const halfEH = OBS_H / 2;

        RECT(pg, ML, Y - OBS_H, obsW, OBS_H, WH, 0.7);
        RECT(pg, ML + obsW, Y - halfEH, ewoW, halfEH, WH, 0.7);
        RECT(pg, ML + obsW, Y - OBS_H, ewoW, halfEH, WH, 0.7);

        TXT(pg, 'Observaciones:', ML + 3, Y - 10, 8, true);
        TXT(pg, 'E.W.O. #', ML + obsW + 4, Y - 10, 7.5, true);
        TXT(pg, 'PAG. #', ML + obsW + 4, Y - OBS_H + halfEH - 10, 7.5, true);
        TXT(pg, `${pageIndex + 1} de ${totalItems}`, ML + obsW + ewoW - 5, Y - OBS_H + halfEH - 10, 8, true, 'right');
    };

    // ── 3. Generar páginas ─────────────────────────────────────
    items.forEach((item: any, idx: number) => {
        drawItemPage(item, idx, items.length);
    });

    // ── 4. Guardar y descargar ─────────────────────────────────
    // Numeración global al pie
    const pages = pdfDoc.getPages();
    if (pages.length > 1) {
        pages.forEach((p, i) => {
            p.drawText(`Page ${i + 1} of ${pages.length}`, {
                x: PW - MR - 60,
                y: 15,
                size: 8,
                font: fR,
                color: BK
            });
        });
    }

    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes as any], { type: 'application/pdf' });
};

