const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const PDFParser = require('pdf2json');

async function testGeneration() {
    const pdfDoc = await PDFDocument.create();
    const fR = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const BK = rgb(0, 0, 0);
    const WH = rgb(1, 1, 1);
    const RED = rgb(0.85, 0, 0);

    const PW = 792, PH = 612;
    const ML = 36, MR = 36, MT = 26;
    const CW = PW - ML - MR;

    const roundedAmt = (val, dec) => Math.round(val * Math.pow(10, dec)) / Math.pow(10, dec);
    const formatC = (val) => val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const utilsFormatDate = (d) => {
        if (!d) return 'N/A';
        const date = new Date(d);
        return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    };

    const TXT = (
        pg, text,
        x, y, sz,
        bold = false,
        align = 'left',
        maxW,
        customColor
    ) => {
        if (text === undefined || text === null) return;
        let s = text.toString().replace(/[\x00-\x09\x0B-\x1F]/g, '');
        if (!s) return;

        let textColor = customColor || BK;
        const trimmed = s.trim();
        if (!customColor && trimmed.startsWith('-')) {
            const val = parseFloat(trimmed.replace(/[^\d.-]/g, '')) || 0;
            if (val < 0) {
                textColor = RED;
                s = `(${trimmed.substring(1).trim()})`;
            } else {
                s = trimmed.substring(1).trim();
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

    const RECT = (pg, x, y, w, h, fill = WH, bw = 0.5) =>
        pg.drawRectangle({ x, y, width: w, height: h, color: fill, borderColor: BK, borderWidth: bw });

    const H_LINE = (pg, x1, y, x2, bw = 0.5) =>
        pg.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: bw, color: BK });

    const drawItemPage = (item, certRows, choRows, pageIndex, totalItems) => {
        const pg = pdfDoc.addPage([PW, PH]);
        const qOrig = parseFloat(item.quantity) || 0;
        const pUnit = parseFloat(item.unit_price) || 0;
        const mOrig = roundedAmt(qOrig * pUnit, 2);

        const totalExe = certRows.reduce((a, r) => a + r.qty, 0);
        const choTotalQty = choRows.reduce((a, r) => a + r.qty, 0);
        const choTotalAmt = choRows.reduce((a, r) => a + r.amt, 0);

        let Y = PH - MT;
        const topY = PH - MT;
        const pageCenter = PW / 2;

        TXT(pg, 'Sistema de Control de Proyectos', pageCenter, topY - 8, 9, false, 'center');
        TXT(pg, 'Autoridad de Carreteras y Transportación - Área de Construcción', pageCenter, topY - 20, 9, true, 'center');
        TXT(pg, `PROYECTO: TEST PROJECT - AC-017418`, pageCenter, topY - 32, 9, true, 'center');
        TXT(pg, `Fecha de impresión del reporte: ${utilsFormatDate(new Date())}`, pageCenter, topY - 44, 7.5, false, 'center');

        Y -= 55;
        TXT(pg, 'LIQUIDACION', ML, Y, 11, true);
        Y -= 16;
        H_LINE(pg, ML, Y, ML + CW, 0.8);
        Y -= 35;

        // Fila 1
        TXT(pg, 'Partida #', ML, Y, 7);
        TXT(pg, item.item_num || '', ML + 48, Y, 9, true);
        H_LINE(pg, ML + 46, Y - 2, ML + 106, 0.5);

        TXT(pg, 'Descripción', ML + 114, Y, 7);
        TXT(pg, item.description || '', ML + 166, Y, 7.5, false, 'left', 240);
        H_LINE(pg, ML + 166, Y - 2, ML + 406, 0.5);

        TXT(pg, 'Proyecto', ML + 414, Y, 7);
        TXT(pg, 'TEST PROJECT', ML + 454, Y, 7, false, 'left', CW - 454);
        H_LINE(pg, ML + 454, Y - 2, ML + CW, 0.5);

        Y -= 17;

        // Fila 2
        TXT(pg, 'Cantidad Original', ML, Y, 7);
        TXT(pg, `${qOrig} ${item.unit || ''}`, ML + 82, Y, 8, true);
        H_LINE(pg, ML + 80, Y - 2, ML + 152, 0.5);

        TXT(pg, '@', ML + 157, Y, 8);
        TXT(pg, `$ ${formatC(pUnit)}`, ML + 167, Y, 8, true);
        H_LINE(pg, ML + 167, Y - 2, ML + 235, 0.5);

        TXT(pg, '=', ML + 240, Y, 8);
        TXT(pg, `$ ${formatC(mOrig)}`, ML + 250, Y, 8, true);
        H_LINE(pg, ML + 250, Y - 2, ML + 320, 0.5);

        TXT(pg, 'Codificación', ML + 330, Y, 7);
        TXT(pg, item.specification || '', ML + 384, Y, 7.5, false, 'left', CW - 384);
        H_LINE(pg, ML + 384, Y - 2, ML + CW, 0.5);

        Y -= 11;

        const COL_W = [110, 72, 46, 84, 34, 34, 42, 110, 188];
        const COL_X = [ML];
        for (let i = 1; i < COL_W.length; i++) COL_X[i] = COL_X[i - 1] + COL_W[i - 1];

        const HDR_H = 26;
        COL_W.forEach((w, i) => RECT(pg, COL_X[i], Y - HDR_H, w, HDR_H, WH));

        const hCX = (i) => COL_X[i] + COL_W[i] / 2;
        const hdrs = [
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

        // Detail rows
        const detailRows = [];
        certRows.forEach(({ cert, qty }) => {
            detailRows.push({
                type: 'cert',
                label: `Cert. #${cert.cert_num}  ${utilsFormatDate(cert.cert_date)}`,
                qty,
                unit: item.unit || ''
            });
        });
        choRows.forEach(({ cho, ci, qty }) => {
            const choNum = cho.cho_num || cho.cho_number || '';
            const amend = cho.amendment_letter || '';
            const choDateStr = cho.cho_date ? utilsFormatDate(cho.cho_date) : '';
            const label = `C.H.O. #${choNum}${amend}${choDateStr ? '  ' + choDateStr : ''}`.trim();
            detailRows.push({
                type: 'cho',
                label,
                qty,
                unit: item.unit || ci.unit || '',
                info: ci.specification || ''
            });
        });

        const MAX_ROWS = Math.max(9, detailRows.length);
        const ROW_H = MAX_ROWS > 9 ? Math.max(9, Math.floor(108 / MAX_ROWS)) : 12;

        let rowsDrawn = 0;
        detailRows.slice(0, MAX_ROWS).forEach((row) => {
            for (let i = 0; i < 8; i++) RECT(pg, COL_X[i], Y - ROW_H, COL_W[i], ROW_H, WH, 0.4);
            const isCho = row.type === 'cho';
            const fSize = ROW_H < 11 ? 5 : 5.5;
            const qSize = ROW_H < 11 ? 5.5 : 6.5;
            const yOff = ROW_H < 11 ? 7 : 8;

            TXT(pg, row.label, COL_X[0] + 2, Y - yOff, fSize, isCho);
            const qtyStr = isCho && row.qty > 0 ? `+${row.qty.toFixed(3)}` : row.qty.toFixed(3);
            TXT(pg, qtyStr, COL_X[1] + COL_W[1] - 3, Y - yOff, qSize, false, 'right');
            TXT(pg, row.unit, hCX(2), Y - yOff, qSize, false, 'center');
            if (row.info) {
                TXT(pg, row.info, COL_X[3] + 2, Y - yOff, fSize, false, 'left', COL_W[3] - 4);
            }
            Y -= ROW_H;
            rowsDrawn++;
        });

        for (let r = rowsDrawn; r < MAX_ROWS; r++) {
            for (let i = 0; i < 8; i++) RECT(pg, COL_X[i], Y - ROW_H, COL_W[i], ROW_H, WH, 0.4);
            Y -= ROW_H;
        }

        const SUM_H = 13;
        const subAmt = roundedAmt(totalExe * pUnit, 2);
        const totalQty = roundedAmt(qOrig + choTotalQty, 4);
        const totalAmt = roundedAmt(mOrig + choTotalAmt, 2);
        const econQty = roundedAmt(totalQty - totalExe, 4);
        const econAmt = roundedAmt(totalAmt - subAmt, 2);

        // Fila 1: SUB-TOTAL | AUMENTO
        for (let i = 0; i < 8; i++) RECT(pg, COL_X[i], Y - SUM_H, COL_W[i], SUM_H, WH, 0.5);
        TXT(pg, 'SUB-TOTAL', hCX(0), Y - 9, 6.5, true, 'center');
        TXT(pg, totalExe.toFixed(3), COL_X[1] + COL_W[1] - 3, Y - 9, 6.5, false, 'right');

        TXT(pg, 'AUMENTO', hCX(3), Y - 9, 6.5, true, 'center');
        if (choTotalQty !== 0) {
            const sign = choTotalQty > 0 ? '+' : '';
            TXT(pg, `${sign}${choTotalQty.toFixed(3)}`, COL_X[4] + 2, Y - 9, 5.5);
            TXT(pg, `${sign}$ ${formatC(choTotalAmt)}`, COL_X[6] + 2, Y - 9, 5.5, true);
        } else {
            TXT(pg, 'N/A', COL_X[4] + 2, Y - 9, 5.5);
        }
        Y -= SUM_H;

        // Fila 2: BALANCE TOTAL | ECONOMIA
        for (let i = 0; i < 8; i++) RECT(pg, COL_X[i], Y - SUM_H, COL_W[i], SUM_H, WH, 0.5);
        TXT(pg, 'BALANCE TOTAL', hCX(0), Y - 9, 6.5, true, 'center');
        TXT(pg, totalQty.toFixed(3), COL_X[1] + COL_W[1] - 3, Y - 9, 6.5, false, 'right');

        TXT(pg, 'ECONOMIA', hCX(3), Y - 9, 6.5, true, 'center');
        if (Math.abs(econQty) > 0.001) {
            const eSign = econQty > 0 ? '+' : '';
            TXT(pg, `${eSign}${econQty.toFixed(3)}`, COL_X[4] + 2, Y - 9, 5.5);
            TXT(pg, `${eSign}$ ${formatC(econAmt)}`, COL_X[6] + 2, Y - 9, 5.5, true);
        } else {
            TXT(pg, '—', COL_X[4] + 2, Y - 9, 5.5);
        }
        Y -= SUM_H;

        const isNotExecuted = totalExe <= 0.0001;
        const isCompleted = !isNotExecuted && totalQty > 0 && (totalExe >= totalQty || Math.abs(totalExe - totalQty) < 0.001);

        if (isNotExecuted || isCompleted) {
            const badgeText = isNotExecuted ? 'NO EJECUTADA' : '100% EJECUTADA';
            const badgeColor = isNotExecuted ? RED : rgb(0, 0.5, 0.15);
            const fontSize = 16;
            const textWidth = fB.widthOfTextAtSize(badgeText, fontSize);
            const boxPaddingX = 14;
            const boxPaddingY = 6;
            const boxW = textWidth + (boxPaddingX * 2);
            const boxH = fontSize + (boxPaddingY * 2);
            const boxX = (PW - boxW) / 2;
            const boxY = (PH / 2) - (boxH / 2);

            pg.drawRectangle({
                x: boxX,
                y: boxY,
                width: boxW,
                height: boxH,
                color: WH,
                borderColor: badgeColor,
                borderWidth: 1.5,
            });

            pg.drawText(badgeText, {
                x: (PW - textWidth) / 2,
                y: boxY + boxPaddingY + 2,
                size: fontSize,
                font: fB,
                color: badgeColor,
            });
        }

        Y -= 30;
        // Firmas...
        Y -= 48;

        const OBS_H = 65;
        const ewoW = 75;
        const obsW = CW - ewoW;
        const halfEH = OBS_H / 2;

        RECT(pg, ML, Y - OBS_H, obsW, OBS_H, WH, 0.7);
        RECT(pg, ML + obsW, Y - halfEH, ewoW, halfEH, WH, 0.7);
        RECT(pg, ML + obsW, Y - OBS_H, ewoW, halfEH, WH, 0.7);

        let statusText = '';
        if (isNotExecuted) {
            statusText = 'NO EJECUTADA';
        } else if (isCompleted) {
            statusText = '100% EJECUTADA';
        }

        TXT(pg, 'Observaciones:', ML + 3, Y - 10, 8, true);
        if (statusText) {
            const sCol = isNotExecuted ? RED : rgb(0, 0.5, 0.15);
            TXT(pg, statusText, ML + 80, Y - 10, 8, true, 'left', undefined, sCol);
        }
        TXT(pg, 'E.W.O. #', ML + obsW + 4, Y - 10, 7.5, true);
        TXT(pg, 'PAG. #', ML + obsW + 4, Y - OBS_H + halfEH - 10, 7.5, true);
        TXT(pg, `${pageIndex + 1} de ${totalItems}`, ML + obsW + ewoW - 5, Y - OBS_H + halfEH - 10, 8, true, 'right');
    };

    // Página 1: Partida NO EJECUTADA
    drawItemPage(
        { item_num: '101', description: 'Excavación no clasificada', quantity: 500, unit_price: 25, unit: 'M3' },
        [], // Cero certificaciones
        [], // Cero CHOs
        0, 3
    );

    // Página 2: Partida 100% EJECUTADA
    drawItemPage(
        { item_num: '102', description: 'Acero de refuerzo', quantity: 1000, unit_price: 1.5, unit: 'LBS' },
        [
            { cert: { cert_num: 1, cert_date: '2024-01-15' }, qty: 600 },
            { cert: { cert_num: 2, cert_date: '2024-02-15' }, qty: 400 }
        ],
        [],
        1, 3
    );

    // Página 3: Partida con Change Order incluido
    drawItemPage(
        { item_num: '103', description: 'Hormigón Estructural Clase A', quantity: 100, unit_price: 350, unit: 'M3' },
        [
            { cert: { cert_num: 1, cert_date: '2024-01-15' }, qty: 50 },
            { cert: { cert_num: 2, cert_date: '2024-02-15' }, qty: 70 }
        ],
        [
            { cho: { cho_num: 1, cho_date: '2024-02-01' }, ci: { item_num: '103', specification: 'Aumento zapatas' }, qty: 20, amt: 7000 }
        ],
        2, 3
    );

    const pdfBytes = await pdfDoc.save();
    const outputPath = path.join(__dirname, 'test_liquidacion_output.pdf');
    fs.writeFileSync(outputPath, pdfBytes);
    console.log('PDF generado exitosamente en:', outputPath);

    // Parsear el PDF para verificar textos generados
    const pdfParser = new PDFParser();
    pdfParser.on("pdfParser_dataReady", pdfData => {
        pdfData.Pages.forEach((p, idx) => {
            console.log(`\n=== PÁGINA ${idx + 1} ===`);
            const pageTexts = p.Texts.map(t => decodeURIComponent(t.R[0].T).trim()).filter(Boolean);
            console.log('Textos encontrados:', pageTexts.filter(t => t.includes('EJECUTADA') || t.includes('C.H.O.') || t.includes('Cert.')));
            if (idx === 0) {
                const hasNoExe = pageTexts.includes('NO EJECUTADA');
                console.log('Página 1 tiene "NO EJECUTADA":', hasNoExe);
            }
            if (idx === 1) {
                const has100 = pageTexts.includes('100% EJECUTADA');
                console.log('Página 2 tiene "100% EJECUTADA":', has100);
            }
            if (idx === 2) {
                const hasCho = pageTexts.some(t => t.includes('C.H.O. #1'));
                const has100 = pageTexts.includes('100% EJECUTADA');
                console.log('Página 3 tiene "C.H.O. #1":', hasCho);
                console.log('Página 3 tiene "100% EJECUTADA" (100+20 = 120 ejecutados):', has100);
            }
        });
    });
    pdfParser.loadPDF(outputPath);
}

testGeneration().catch(console.error);
