require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const projectId = 'dtpfhwxwodzpitzmrbqr'; // ACT Project
  const dataToSave = { date_contract_sign: '2026-10-15' };
  
  const { data, error } = await supabase.from('projects').update(dataToSave).eq('id', projectId).select();
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Updated data:", data[0].date_contract_sign);
  }
}
test();
