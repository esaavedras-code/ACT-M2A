const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');
const pdfParse = require('pdf-parse');

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
    try {
        const { data, error } = await supabase.storage.from('project-documents').download('488f8f15-fa0b-4456-8e3d-dd19a8d8f222/AC200023 PROJECT AGREEMENT.pdf');
        if (error) { console.error('Error downloading:', error); return; }
        
        const buffer = Buffer.from(await data.arrayBuffer());
        fs.writeFileSync('agreement.pdf', buffer);
        console.log('Downloaded. Parsing PDF...');
        
        const pdfData = await pdfParse(buffer);
        console.log('--- PDF CONTENT ---');
        console.log(pdfData.text);
    } catch (e) {
        console.error('Error:', e);
    }
})();
