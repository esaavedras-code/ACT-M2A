const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
    // 1. Fetch CHOs to find an item 81
    console.log('Fetching CHOs...');
    const { data: chos, error: err1 } = await supabase.from('chos').select('*');
    if (err1) console.error(err1);
    
    for (const cho of chos) {
        if (!cho.items) continue;
        const items = Array.isArray(cho.items) ? cho.items : (cho.items.list || []);
        for (const item of items) {
            if (item.item_num == '81' || item.item_num == '081') {
                console.log(`Found item 81 in CHO ${cho.id}, unit_price:`, item.unit_price);
                
                // Get contract_item for this project
                const { data: contractItem } = await supabase.from('contract_items').select('*').eq('project_id', cho.project_id).eq('item_num', item.item_num).single();
                console.log(`Contract item for 81 in project ${cho.project_id}:`, contractItem ? contractItem.unit_price : 'Not found');
                
                // Get certification for this project
                const { data: certs } = await supabase.from('payment_certifications').select('*').eq('project_id', cho.project_id);
                for (const cert of (certs || [])) {
                    const cItems = Array.isArray(cert.items) ? cert.items : [];
                    for (const ci of cItems) {
                        if (ci.item_num == '81' || ci.item_num == '081') {
                            console.log(`Cert ${cert.id}, item 81 unit_price:`, ci.unit_price);
                        }
                    }
                }
            }
        }
    }
}
main();
