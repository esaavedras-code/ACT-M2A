// Script para insertar items de CHO faltantes en contract_items del proyecto ac-017418
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://dtpfhwxwodzpitzmrbqr.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0cGZod3h3b2R6cGl0em1yYnFyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTc4NDE5MCwiZXhwIjoyMDg3MzYwMTkwfQ.unqVuW0ZzNv5MYVHcHHqrmhN2wFe4McuhyzTEERpGLU';
const PROJECT_ID = 'fe6fbe3c-c0c5-4ce9-ba71-53d475da27e1'; // ac-017418

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
  // Obtener items actuales del contrato
  const { data: contractItems, error: ciErr } = await supabase
    .from('contract_items')
    .select('item_num')
    .eq('project_id', PROJECT_ID);

  if (ciErr) { console.error('Error leyendo contract_items:', ciErr); process.exit(1); }

  const existingNums = new Set(contractItems.map(ci => String(ci.item_num).trim().padStart(3, '0')));
  console.log(`Contract items existentes: ${existingNums.size}`);

  // Obtener todos los CHOs del proyecto
  const { data: chos, error: choErr } = await supabase
    .from('chos')
    .select('cho_num, doc_status, items')
    .eq('project_id', PROJECT_ID);

  if (choErr) { console.error('Error leyendo chos:', choErr); process.exit(1); }
  console.log(`CHOs encontrados: ${chos.length}`);

  // Recolectar items únicos faltantes (primer aparición gana)
  const missingMap = new Map();
  for (const cho of chos) {
    for (const item of (cho.items || [])) {
      const rawNum = String(item.item_num || '').trim();
      if (!rawNum) continue;
      const paddedNum = rawNum.padStart(3, '0');
      if (existingNums.has(paddedNum)) continue;
      if (missingMap.has(paddedNum)) continue;
      const spec = String(item.specification || '').trim();
      const desc = String(item.description || '').trim();
      if (!spec && !desc) continue; // Ignorar completamente vacíos
      missingMap.set(paddedNum, {
        project_id: PROJECT_ID,
        item_num: rawNum,
        specification: spec,
        description: desc,
        additional_description: '',
        quantity: 0,
        unit: String(item.unit || '').trim(),
        unit_price: parseFloat(item.unit_price) || 0,
        fund_source: String(item.fund_source || 'FHWA:100%').trim(),
        requires_mfg_cert: false,
        mfg_cert_qty: 1,
        mfg_cert_description: '',
        ia_metadata: {}
      });
    }
  }

  if (missingMap.size === 0) {
    console.log('No hay items nuevos para insertar. Todo está al día.');
    return;
  }

  const toInsert = Array.from(missingMap.values()).sort((a, b) => {
    return parseInt(a.item_num) - parseInt(b.item_num);
  });

  console.log(`\nInsertando ${toInsert.length} items faltantes...`);

  let ok = 0, fail = 0;
  for (const item of toInsert) {
    const { error } = await supabase.from('contract_items').insert(item);
    if (error) {
      console.error(`  ERROR ${item.item_num}: ${JSON.stringify(error)}`);
      fail++;
    } else {
      console.log(`  OK: ${item.item_num} | ${item.specification} | ${item.description}`);
      ok++;
    }
  }

  console.log(`\nFinalizado. Insertados: ${ok}  Fallidos: ${fail}`);
}

main().catch(console.error);
