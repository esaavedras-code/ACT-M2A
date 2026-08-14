const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    const { data: proj } = await supabase.from('projects').select('id, project_number, items').ilike('project_number', 'ac-017418').single();
    if (!proj) return console.log("Project not found");
    const { data: certs } = await supabase.from('payment_certs').select('id, cert_num, items').eq('project_id', proj.id).eq('cert_num', 8);
    console.log("Cert 8 items:");
    for (const cert of certs) {
        const items = Array.isArray(cert.items) ? cert.items : cert.items?.list || [];
        const item63 = items.find(i => i.item_num == '063' || i.item_num == 63);
        console.log("Cert", cert.cert_num, "item 63:", item63);
    }
}
check();
