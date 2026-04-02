require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const { data: projs, error: err1 } = await supabase.from('projects').select('id, date_contract_sign').limit(1);
  if (err1) { console.error(err1); return; }
  const p = projs[0];
  console.log("Original date:", p.date_contract_sign);
  
  const { data, error } = await supabase.from('projects').update({ date_contract_sign: '2026-10-15' }).eq('id', p.id).select();
  if (error) {
    console.error("Update Error:", error);
  } else {
    console.log("Updated data:", data[0].date_contract_sign);
  }
}
test();
