const fs = require('fs');

const repairContent = (filePath) => {
    let text = fs.readFileSync(filePath, 'utf8');

    // Sometimes the issue is already UTF-8 interpreted as latin1
    try {
        text = text.replace(/Ã[¡©\xAD\xB1\xB3\xBA\xBC\x81\x89\x8D\x91\x93\x9A\x9C]/g, (match) => {
            return Buffer.from(match, 'latin1').toString('utf8');
        });

        let customReps = {
            'DescripciÃ³n': 'Descripción',
            'Ãtem': 'Ítem',
            'AÃ±adimos': 'Añadimos',
            'FÃ¡brica': 'Fábrica',
            'TrÃ¡mite': 'Trámite',
            'PrÃ³rrogas': 'Prórrogas',
            'Ã“rdenes': 'Órdenes',
            'Ã“RDENES': 'ÓRDENES',
            'DistribuciÃ³n': 'Distribución',
            'AdiciÃ³n': 'Adición',
            'DeducciÃ³n': 'Deducción',
            'InformaciÃ³n': 'Información',
            'INFORMACIÃ“N': 'INFORMACIÓN',
            'dÃ­as': 'días',
            'CertificaciÃ³n': 'Certificación',
            'CERTIFICACIÃ“N': 'CERTIFICACIÓN',
            'SECCIÃ“N': 'SECCIÓN',
            'DiseÃ±ador': 'Diseñador',
            'TransportaciÃ³n': 'Transportación'
        };
        for (const [bad, good] of Object.entries(customReps)) {
            text = text.split(bad).join(good);
        }

    } catch (e) { }

    fs.writeFileSync(filePath, text, 'utf8');
};

repairContent('src/lib/reportLogic.ts');
repairContent('src/lib/generateLiquidacionReport.ts');
