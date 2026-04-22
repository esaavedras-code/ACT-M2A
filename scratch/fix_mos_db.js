const fs = require('fs');
const path = require('path');

const projectId = '2e0d8d80-3542-451c-bbef-63a791012e34';
const dataPath = path.join('C:', 'Users', 'Enrique Saavedra', '.gemini', 'antigravity', 'brain', '60a52ab0-737b-47f0-a312-0fb597f386c9', '.system_generated', 'steps', '1057', 'output.txt');

const rawData = fs.readFileSync(dataPath, 'utf8');
const certs = JSON.parse(JSON.parse(rawData).result.split('<untrusted-data-38147a2a-ae1c-47a0-b0d9-d8d9f0a24258>\n')[1].split('\n</untrusted-data-38147a2a-ae1c-47a0-b0d9-d8d9f0a24258>')[0]);

const mosPrices = {
  "043": 2564.5, "088": 4460, "087": 3345, "097": 3902.5, "098": 4460,
  "094": 5575, "102": 557.5, "103": 568.65, "108": 345.65, "109": 1912.23,
  "110": 750, "115": 2453, "116": 2787.5, "117": 1500, "126": 602.1
};

let mosBalances = {}; 

certs.sort((a, b) => a.cert_num - b.cert_num).forEach(cert => {
  let items = cert.items;
  let changed = false;

  items.forEach(item => {
    if (item.has_material_on_site || (parseFloat(item.mos_invoice_total) || 0) > 0) {
      const amt = parseFloat(item.mos_invoice_total) || 0;
      mosBalances[item.item_num] = (mosBalances[item.item_num] || 0) + amt;
    }
  });

  items.forEach(item => {
    const q = parseFloat(item.quantity) || 0;
    const balance = mosBalances[item.item_num] || 0;
    
    if (balance > 0 && q > 0) {
      const pu = mosPrices[item.item_num] || parseFloat(item.unit_price) || 0;
      if (pu > 0) {
        const availableQty = balance / pu;
        const deduceQty = Math.min(q, availableQty);
        
        if (deduceQty > 0.0001) {
          if (Math.abs((parseFloat(item.qty_from_mos) || 0) - deduceQty) > 0.001) {
            item.qty_from_mos = parseFloat(deduceQty.toFixed(4));
            changed = true;
          }
          mosBalances[item.item_num] -= deduceQty * pu;
        }
      }
    }
  });

  if (changed) {
    const jsonItems = JSON.stringify(items).replace(/'/g, "''");
    console.log(`UPDATE payment_certifications SET items = '${jsonItems}' WHERE project_id = '${projectId}' AND cert_num = ${cert.cert_num};`);
  }
});
