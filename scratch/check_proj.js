const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    const { data: projs } = await supabase.from('projects').select('id, project_number, items').ilike('project_number', '%017418%');
    console.log("Found projects:", projs.map(p => p.project_number));
    const proj = projs[0];
    if (!proj) return;
    
    const { data: certs } = await supabase.from('payment_certs').select('id, cert_num, items').eq('project_id', proj.id).eq('cert_num', 8);
    console.log("Cert 8 items:");
    for (const cert of certs) {
        const items = Array.isArray(cert.items) ? cert.items : cert.items?.list || [];
        const item63 = items.find(i => i.item_num == '063' || i.item_num == 63);
        console.log("Cert", cert.cert_num, "item 63:", item63);
    }
    
    const { data: chos } = await supabase.from('chos').select('id, cho_number, doc_status, items, cho_date').eq('project_id', proj.id);
    for (const cho of chos) {
        console.log("CHO", cho.cho_number, "status", cho.doc_status, "Array.isArray(cho.items):", Array.isArray(cho.items));
        const choItems = Array.isArray(cho.items) ? cho.items : cho.items?.list || [];
        const choItem63 = choItems.find(i => i.item_num == '063' || i.item_num == 63);
        if (choItem63) {
            console.log("  => Item 63 price:", choItem63.unit_price);
        }
    }
}
check();
