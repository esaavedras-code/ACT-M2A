const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data: projs, error } = await supabase.from('projects').select('id, name, num_act').ilike('num_act', '%017418%');
    if (error) return console.error(error);
    const proj = projs[0];
    if (!proj) return console.log("Project not found");
    
    console.log("Project Num Act:", proj.num_act);
    
    const { data: chos } = await supabase.from('chos').select('id, cho_num, doc_status, items, cho_date').eq('project_id', proj.id);
    for (const cho of chos) {
        console.log(`CHO ${cho.cho_num}: status=${cho.doc_status} date=${cho.cho_date}`);
        const choItems = Array.isArray(cho.items) ? cho.items : cho.items?.list || [];
        const choItem63 = choItems.find(i => i.item_num == '063' || i.item_num == 63);
        if (choItem63) {
            console.log("  => CHO Item 63 price:", choItem63.unit_price);
        }
    }
    
    const { data: certs } = await supabase.from('payment_certifications').select('id, cert_num, items, cert_date').eq('project_id', proj.id);
    for (const cert of (certs || [])) {
        if (cert.cert_num != 8) continue;
        console.log(`Cert ${cert.cert_num}: date=${cert.cert_date}`);
        const certItems = Array.isArray(cert.items) ? cert.items : cert.items?.list || [];
        const certItem63 = certItems.find(i => i.item_num == '063' || i.item_num == 63);
        if (certItem63) {
            console.log("  => Cert Item 63 price (raw db):", certItem63.unit_price);
        }
    }
}
check();
