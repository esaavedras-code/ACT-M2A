
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

// Load environment variables
const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim();
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const projectId = '488f8f15-fa0b-4456-8e3d-dd19a8d8f222';
const reportsDir = path.join(process.cwd(), 'Reportes');

if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir);
}

const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);
};

const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('es-PR');
};

async function generateReports() {
    console.log('Fetching data...');

    // 1. Fetch Items
    const { data: items } = await supabase.from('contract_items').select('*').eq('project_id', projectId).order('item_num');

    // 2. Fetch CHOs
    const { data: chos } = await supabase.from('chos').select('*').eq('project_id', projectId);

    // 3. Fetch Certs
    const { data: certs } = await supabase.from('payment_certifications').select('*').eq('project_id', projectId).order('cert_num');

    // 4. Fetch Mfg Certs
    const { data: mfgCerts } = await supabase.from('manufacturing_certificates').select('*').eq('project_id', projectId);

    console.log('Data fetched. Processing...');

    // Process balances
    const balances = items.map(item => {
        const itemChos = chos.filter(c => {
            const choppedItems = Array.isArray(c.items) ? c.items : [];
            return choppedItems.some(i => i.item_id === item.id);
        });

        const choQty = itemChos.reduce((acc, c) => {
            const i = c.items.find(it => it.item_id === item.id);
            return acc + (parseFloat(i.proposed_change) || 0);
        }, 0);

        const certQty = certs.reduce((acc, c) => {
            const certItems = Array.isArray(c.items) ? c.items : (c.items?.list || []);
            const i = certItems.find(it => it.item_id === item.id);
            return acc + (parseFloat(i?.quantity || 0));
        }, 0);

        const totalQty = (parseFloat(item.quantity) || 0) + choQty;
        const balance = totalQty - certQty;

        return {
            ...item,
            choQty,
            totalQty,
            certQty,
            balance,
            balanceCash: balance * (parseFloat(item.unit_price) || 0)
        };
    });

    // Report 1: Balances de Partidas
    await createPdf('Reporte_1_Balances_Partidas.pdf', 'REPORTE DE BALANCES DE PARTIDAS', [
        ['Item', 'Descripción', 'Unidad', 'Cant. Orig.', 'CHO', 'Total', 'Certificado', 'Balance'],
        ...balances.map(b => [
            b.item_num,
            b.description?.substring(0, 30) + '...',
            b.unit,
            b.quantity.toString(),
            b.choQty.toString(),
            b.totalQty.toString(),
            b.certQty.toString(),
            b.balance.toString()
        ])
    ]);

    // Report 2: Partidas con CHO y Certificaciones
    const report2Data = [];
    balances.forEach(b => {
        report2Data.push([`PARTIDA: ${b.item_num}`, b.description, '', '', '']);
        report2Data.push(['  - Original:', b.quantity, b.unit, '@', b.unit_price]);

        const itemChos = chos.filter(c => {
            const choppedItems = Array.isArray(c.items) ? c.items : [];
            return choppedItems.some(i => i.item_id === b.id);
        });
        itemChos.forEach(c => {
            const i = c.items.find(it => it.item_id === b.id);
            report2Data.push([`  - CHO #${c.cho_num}:`, i.proposed_change, b.unit, formatDate(c.cho_date), '']);
        });

        const itemCerts = certs.filter(c => {
            const certItems = Array.isArray(c.items) ? c.items : (c.items?.list || []);
            return certItems.some(it => it.item_id === b.id);
        });
        itemCerts.forEach(c => {
            const i = (Array.isArray(c.items) ? c.items : (c.items?.list || [])).find(it => it.item_id === b.id);
            report2Data.push([`  - Cert #${c.cert_num}:`, i.quantity, b.unit, formatDate(c.cert_date), '']);
        });
        report2Data.push(['', '', '', '', '']); // Spacer
    });

    await createPdf('Reporte_2_Detalle_Partidas_CHO_Certs.pdf', 'REPORTE DE PARTIDAS CON CHO Y CERTIFICACIONES', report2Data);

    // Report 3: Certificados de Manufactura Metidos
    await createPdf('Reporte_3_Certificados_Manufactura.pdf', 'REPORTE DE CERTIFICADOS DE MANUFACTURA', [
        ['Item', 'Especificación', 'Cantidad', 'Fecha'],
        ...mfgCerts.map(c => [
            c.item_num,
            c.specification,
            c.quantity.toString(),
            formatDate(c.cert_date)
        ])
    ]);

    // Report 4: Certificados de Manufactura Faltantes
    const missingCerts = balances.filter(b => b.requires_mfg_cert).map(b => {
        const itemMfgCerts = mfgCerts.filter(c => c.item_id === b.id);
        const mfgQty = itemMfgCerts.reduce((acc, c) => acc + (parseFloat(c.quantity) || 0), 0);
        const missing = b.certQty - mfgQty;

        // Find date when it started missing
        let dateMissing = 'N/A';
        let runningCertQty = 0;
        if (missing > 0) {
            for (const cert of certs) {
                const certItems = Array.isArray(cert.items) ? cert.items : (cert.items?.list || []);
                const i = certItems.find(it => it.item_id === b.id);
                if (i) {
                    runningCertQty += parseFloat(i.quantity) || 0;
                    if (runningCertQty > mfgQty) {
                        dateMissing = formatDate(cert.cert_date);
                        break;
                    }
                }
            }
        }

        return {
            item_num: b.item_num,
            description: b.description,
            certQty: b.certQty,
            mfgQty,
            missing,
            dateMissing
        };
    }).filter(m => m.missing > 0);

    await createPdf('Reporte_4_Certificados_Faltantes.pdf', 'REPORTE DE CERTIFICADOS DE MANUFACTURA FALTANTES', [
        ['Item', 'Cant. Certificada (Pagada)', 'Cant. en Cert. MFG', 'Faltante', 'Fecha Inicio Falta'],
        ...missingCerts.map(m => [
            m.item_num,
            m.certQty.toString(),
            m.mfgQty.toString(),
            m.missing.toString(),
            m.dateMissing
        ])
    ]);

    console.log('All reports generated successfully in /Reportes');
}

async function createPdf(filename, title, data) {
    const pdfDoc = await PDFDocument.create();
    const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const timesRomanBoldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

    let page = pdfDoc.addPage([600, 800]);
    const { width, height } = page.getSize();
    let y = height - 50;

    // Header
    page.drawText('M2A Group - Sistema de Control de Proyectos', { x: 50, y, size: 10, font: timesRomanFont });
    y -= 25;
    page.drawText(title, { x: 50, y, size: 16, font: timesRomanBoldFont });
    y -= 30;
    page.drawText(`Fecha: ${new Date().toLocaleDateString('es-PR')}`, { x: 50, y, size: 10, font: timesRomanFont });
    y -= 40;

    // Table
    const fontSize = 8;
    const colWidths = [60, 200, 50, 50, 50, 50, 50, 50];

    data.forEach((row, rowIndex) => {
        if (y < 50) {
            page = pdfDoc.addPage([600, 800]);
            y = 750;
        }

        let x = 30;
        row.forEach((cell, cellIndex) => {
            const font = (rowIndex === 0 || cell?.toString().startsWith('PARTIDA:')) ? timesRomanBoldFont : timesRomanFont;
            page.drawText(cell?.toString() || '', {
                x,
                y,
                size: fontSize,
                font: font
            });
            x += colWidths[cellIndex] || 50;
        });

        y -= 15;
    });

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(path.join(reportsDir, filename), pdfBytes);
}

generateReports().catch(console.error);
