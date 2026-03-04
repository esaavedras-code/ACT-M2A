const fs = require('fs');

try {
    const content = fs.readFileSync('C:/Users/Enrique Saavedra/.gemini/antigravity/brain/ea3c87de-769a-45a2-a89e-40c6ab6bd8b1/.system_generated/steps/77/output.txt', 'utf8');

    const lines = content.split('\n');
    let jsonStr = '';
    let inJson = false;
    for (const line of lines) {
        if (line.trim().startsWith('[') || line.trim().startsWith('{')) inJson = true;
        if (inJson) jsonStr += line + '\n';
        if (line.trim().endsWith(']') || line.trim().endsWith('}')) {
            // Try to parse it to check if it's done
            try {
                JSON.parse(jsonStr);
                break;
            } catch (e) { }
        }
    }

    const certs = JSON.parse(jsonStr);

    const getInvoicePUFromList = (certsList, itemNum, currentCertIdx) => {
        for (let i = currentCertIdx; i >= 0; i--) {
            if (!certsList[i]) continue;
            const its = Array.isArray(certsList[i].items) ? certsList[i].items : (certsList[i].items?.list || []);
            const match = its.find((itx) => itx.item_num === itemNum && itx.has_material_on_site && parseFloat(itx.mos_unit_price) > 0);
            if (match) return parseFloat(match.mos_unit_price);
        }
        return 0;
    };

    const cert1 = certs.find(c => c.cert_num === 1);
    const cert4 = certs.find(c => c.cert_num === 4);

    console.log("Cert 1 found:", !!cert1);
    console.log("Cert 4 found:", !!cert4);

    if (cert1) {
        const item9_cert1 = cert1.items.find(it => it.item_num === "009");
        console.log("Item 009 in Cert 1 detail:", JSON.stringify(item9_cert1, null, 2));
    }

    if (cert4) {
        const item9_cert4 = cert4.items.find(it => it.item_num === "009");
        console.log("Item 009 in Cert 4 detail:", JSON.stringify(item9_cert4, null, 2));
    }

    const pu1 = getInvoicePUFromList(certs, "009", 0);
    console.log("PU calculated for 009 in Cert 1:", pu1);

    const pu4 = getInvoicePUFromList(certs, "009", 3);
    console.log("PU calculated for 009 in Cert 4:", pu4);

} catch (err) {
    console.error("Error:", err.message);
}
