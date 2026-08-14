const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
    const projectId = 'fe6fbe3c-c0c5-4ce9-ba71-53d475da27e1';
    const { data: chos } = await supabase.from('chos').select('*').eq('project_id', projectId).order('cho_num', { ascending: false });
    const { data: contractItems } = await supabase.from('contract_items').select('*').eq('project_id', projectId);

    const itemsToUpdate = [];
    const updatedItemNums = new Set();
    
    // Simulate what happens in CHOForm saveData
    for (const cho of chos) {
        for (const item of (cho.items || [])) {
            if (item.item_num && !updatedItemNums.has(item.item_num)) {
                const existingItem = contractItems.find(
                    ci => (ci.item_num || "").toString().trim().padStart(3, '0') === (item.item_num || "").toString().trim().padStart(3, '0')
                );
                if (existingItem) {
                    updatedItemNums.add(item.item_num);
                    itemsToUpdate.push({
                        id: existingItem.id, // UUID
                        project_id: projectId,
                        item_num: item.item_num,
                        unit_price_from_cho: item.unit_price || 0,
                        unit_price_in_db: existingItem.unit_price
                    });
                }
            }
        }
    }
    console.log(itemsToUpdate.filter(i => i.item_num == '81' || i.item_num == '081'));
}
main();
