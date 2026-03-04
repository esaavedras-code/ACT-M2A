
const fs = require('fs');

const certsFile = 'C:/Users/Enrique Saavedra/.gemini/antigravity/brain/8d322a6d-0d24-49e7-8ec7-74da5fa5bcdb/.system_generated/steps/34/output.txt';
const content = fs.readFileSync(certsFile, 'utf8');

const match = content.match(/\[\s*\{.*\}\s*\]/s);
if (!match) {
    console.log("No JSON array found");
    process.exit(1);
}

const certs = JSON.parse(match[0]);

let totalCertified = 0;
certs.forEach(cert => {
    let certTotal = 0;
    cert.items.forEach(item => {
        const qty = parseFloat(item.quantity);
        const price = parseFloat(item.unit_price);
        if (!isNaN(qty) && !isNaN(price)) {
            certTotal += qty * price;
        }
    });
    totalCertified += certTotal;
});

console.log('TOTAL_CERTIFIED_BRUTO:' + totalCertified.toFixed(2));
