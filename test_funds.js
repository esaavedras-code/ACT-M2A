require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const projectId = 'dtpfhwxwodzpitzmrbqr'; // Just any ID for testing?
  const { data: projs, error: err1 } = await supabase.from('projects').select('id').limit(1);
  if (err1) { console.error(err1); return; }
  const realProjId = projs[0].id;
  
  console.log("Using projId:", realProjId);
  const { data: funds, error: err2 } = await supabase.from('project_agreement_funds').select('*').eq('project_id', realProjId);
  console.log("Funds:", funds?.length);
  
  if (funds && funds.length > 0) {
      const { error } = await supabase.from('project_agreement_funds').upsert([{ ...funds[0], participating: 555 }]);
      console.log("Upsert Error:", error);
  } else {
      const { error } = await supabase.from('project_agreement_funds').upsert([{ project_id: realProjId, unit_name: "Test", participating: 444 }]);
      console.log("Insert Error:", error);
  }
}
test();
