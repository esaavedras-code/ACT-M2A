const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');

const manualsDir = 'c:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\Manual_Detallado';
const outputDir = 'c:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\Manual_Word';

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

async function convertMdToDocx(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath, '.md');
    const lines = content.split('\n');
    
    const children = [];
    
    lines.forEach(line => {
        let trimmed = line.trim();
        if (trimmed.startsWith('# ')) {
            children.push(new Paragraph({
                text: trimmed.replace('# ', ''),
                heading: HeadingLevel.HEADING_1,
            }));
        } else if (trimmed.startsWith('## ')) {
            children.push(new Paragraph({
                text: trimmed.replace('## ', ''),
                heading: HeadingLevel.HEADING_2,
            }));
        } else if (trimmed.startsWith('### ')) {
            children.push(new Paragraph({
                text: trimmed.replace('### ', ''),
                heading: HeadingLevel.HEADING_3,
            }));
        } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            children.push(new Paragraph({
                text: trimmed.replace(/^[-\*]\s+/, ''),
                bullet: { level: 0 }
            }));
        } else if (trimmed.length > 0) {
            // Check for bold (very basic)
            const parts = trimmed.split(/(\*\*.*?\*\*)/g);
            const textRuns = parts.map(p => {
                if (p.startsWith('**') && p.endsWith('**')) {
                    return new TextRun({ text: p.replace(/\*\*/g, ''), bold: true });
                }
                return new TextRun({ text: p });
            });
            children.push(new Paragraph({ children: textRuns }));
        } else {
            children.push(new Paragraph({ text: "" }));
        }
    });

    const doc = new Document({
        sections: [{ children }]
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(path.join(outputDir, `${fileName}.docx`), buffer);
    console.log(`Converted: ${fileName}.docx`);
}

async function run() {
    const files = fs.readdirSync(manualsDir).filter(f => f.endsWith('.md'));
    for (const f of files) {
        await convertMdToDocx(path.join(manualsDir, f));
    }
}

run().catch(console.error);
