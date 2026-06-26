import { NextResponse } from "next/server";
import PDFParser from "pdf2json";

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const pdfParser = new (PDFParser as any)(null, 1); // 1 = extract text
        
        return new Promise((resolve) => {
            pdfParser.on("pdfParser_dataError", (errData: any) => {
                console.error(errData.parserError);
                resolve(NextResponse.json({ error: "Failed to parse PDF" }, { status: 500 }));
            });

            pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
                const rawText = pdfParser.getRawTextContent();
                
                // Parse text
                const parsedData = extractProjectStatusData(rawText);
                resolve(NextResponse.json({ success: true, data: parsedData, rawText }));
            });

            pdfParser.parseBuffer(buffer);
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

function extractProjectStatusData(text: string) {
    const data: any = {
        globals: {},
        items: []
    };

    const parseAmount = (val: string) => {
        if (!val) return 0;
        return parseFloat(val.replace(/[$,\s]/g, ''));
    };

    // Globals
    const originalMatch = text.match(/Original:\s+\$?([0-9,.-]+)/i);
    const revisedMatch = text.match(/Revised:\s+\$?([0-9,.-]+)/i);
    const certifiedMatch = text.match(/Certified:\s+\$?([0-9,.-]+)/i);
    const remainingMatch = text.match(/Remaining:\s+\$?([0-9,.-]+)/i);
    const lastCertifiedMatch = text.match(/Last Certified:\s+\$?([0-9,.-]+)/i);
    const netPaidMatch = text.match(/Net Paid:\s+\$?([0-9,.-]+)/i);
    const lastRetentionMatch = text.match(/Last Retention:\s+-?\$?([0-9,.-]+)/i);
    const retentionTDMatch = text.match(/Retention TD:\s+-?\$?([0-9,.-]+)/i);

    if (originalMatch) data.globals.original = parseAmount(originalMatch[1]);
    if (revisedMatch) data.globals.revised = parseAmount(revisedMatch[1]);
    if (certifiedMatch) data.globals.certified = parseAmount(certifiedMatch[1]);
    if (remainingMatch) data.globals.remaining = parseAmount(remainingMatch[1]);
    if (lastCertifiedMatch) data.globals.lastCertified = parseAmount(lastCertifiedMatch[1]);
    if (netPaidMatch) data.globals.netPaid = parseAmount(netPaidMatch[1]);
    if (lastRetentionMatch) data.globals.lastRetention = parseAmount(lastRetentionMatch[1]);
    if (retentionTDMatch) data.globals.retentionTD = parseAmount(retentionTDMatch[1]);

    // Items
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    // Pattern logic: look for lines containing a contract number like "2023-000151"
    const contractRegex = /\d{4}-\d{6}/;
    
    // Some lines might be split. In pdf2json, text from the same Y coordinate usually stays together.
    // If not, we might need a more robust parsing.
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        
        // Fix split item numbers, e.g. "[EXW]888-\r\n000" if OCR splits them, but pdf2json text might be better.
        if (contractRegex.test(line)) {
            let tokens = line.split(/\s+/);
            let contractIdx = tokens.findIndex(t => contractRegex.test(t));
            
            if (contractIdx >= 0) {
                // If itemNum was split into previous line because it was long
                let itemNum = tokens.slice(0, contractIdx).join("");
                if (itemNum.endsWith("-") && i > 0) {
                    // Try to grab from previous line if it was split?
                }
                
                // Let's identify the 7 numerical columns from the end of the line
                // In some formats it's 7 amounts/quantities: U.Price, Qty, Amount, Cert Qty, Cert Amnt, Rem Qty, Rem Amnt
                // Sometimes it's split. Let's just find the last 7 numeric-looking tokens
                
                let numTokens = [];
                let p = tokens.length - 1;
                while (p > contractIdx && numTokens.length < 7) {
                    let val = tokens[p].replace(/[$,]/g, '');
                    if (!isNaN(parseFloat(val))) {
                        numTokens.unshift(tokens[p]);
                    } else if (numTokens.length > 0) {
                        // If we already started collecting numbers and find a non-number, we might be at UOM
                        break;
                    }
                    p--;
                }
                
                if (numTokens.length === 7) {
                    const uom = tokens[p];
                    const desc = tokens.slice(contractIdx + 1, p).join(" ");
                    
                    data.items.push({
                        itemNum: itemNum,
                        description: desc,
                        uom: uom,
                        unitPrice: parseAmount(numTokens[0]),
                        qty: parseAmount(numTokens[1]),
                        amount: parseAmount(numTokens[2]),
                        certQty: parseAmount(numTokens[3]),
                        certAmnt: parseAmount(numTokens[4]),
                        remQty: parseAmount(numTokens[5]),
                        remAmnt: parseAmount(numTokens[6])
                    });
                }
            }
        }
    }

    return data;
}
