
const data = [
  {"cert_num":1,"items":[{"item_num":"025","mos_invoice_total":0,"qty_from_mos":0,"unit_price":2500,"mos_unit_price":0}]},
  // ... (simplificado para el script)
];

// Datos reales del archivo
const certs = [
  {"cert_num":1,"items":[]},
  {"cert_num":2,"items":[]},
  {"cert_num":3,"items":[]},
  {"cert_num":4,"items":[]},
  {"cert_num":5,"items":[]},
  {"cert_num":6,"items":[{"item_num":"043","mos_invoice_total":7693.50},{"item_num":"088","mos_invoice_total":4460.00},{"item_num":"087","mos_invoice_total":3345},{"item_num":"097","mos_invoice_total":3902.50},{"item_num":"098","mos_invoice_total":22300},{"item_num":"094","mos_invoice_total":16725},{"item_num":"102","mos_invoice_total":18397.50},{"item_num":"103","mos_invoice_total":5686.50},{"item_num":"108","mos_invoice_total":4147.80},{"item_num":"109","mos_invoice_total":34420.14},{"item_num":"110","mos_invoice_total":3750},{"item_num":"115","mos_invoice_total":12265},{"item_num":"116","mos_invoice_total":5575},{"item_num":"117","mos_invoice_total":27000},{"item_num":"126","mos_invoice_total":15654.60}]},
  {"cert_num":7,"items":[]},
  {"cert_num":8,"items":[{"item_num":"052","qty_from_mos":1,"unit_price":300,"mos_unit_price":300},{"item_num":"053","qty_from_mos":1,"unit_price":300,"mos_unit_price":300},{"item_num":"054","qty_from_mos":1,"unit_price":450,"mos_unit_price":450},{"item_num":"055","qty_from_mos":3,"unit_price":490,"mos_unit_price":490},{"item_num":"056","qty_from_mos":9,"unit_price":400,"mos_unit_price":400},{"item_num":"057","qty_from_mos":1,"unit_price":400,"mos_unit_price":400},{"item_num":"058","qty_from_mos":3,"unit_price":800,"mos_unit_price":800},{"item_num":"060","qty_from_mos":1,"unit_price":600,"mos_unit_price":600},{"item_num":"061","qty_from_mos":6,"unit_price":600,"mos_unit_price":600},{"item_num":"063","qty_from_mos":1,"unit_price":375,"mos_unit_price":375},{"item_num":"068","qty_from_mos":1,"unit_price":650,"mos_unit_price":650},{"item_num":"069","qty_from_mos":3,"unit_price":750,"mos_unit_price":750},{"item_num":"075","qty_from_mos":1,"unit_price":400,"mos_unit_price":400},{"item_num":"076","qty_from_mos":444,"unit_price":4,"mos_unit_price":4},{"item_num":"077","qty_from_mos":1805.4,"unit_price":4,"mos_unit_price":4},{"item_num":"087","qty_from_mos":1,"unit_price":10000,"mos_unit_price":10000},{"item_num":"088","qty_from_mos":1,"unit_price":12000,"mos_unit_price":12000},{"item_num":"094","qty_from_mos":1,"unit_price":13000,"mos_unit_price":13000},{"item_num":"097","qty_from_mos":1,"unit_price":10000,"mos_unit_price":10000},{"item_num":"098","qty_from_mos":4,"unit_price":11000,"mos_unit_price":0},{"item_num":"102","qty_from_mos":19,"unit_price":900,"mos_unit_price":0},{"item_num":"103","qty_from_mos":6,"unit_price":900,"mos_unit_price":0},{"item_num":"108","qty_from_mos":12,"unit_price":940,"mos_unit_price":940},{"item_num":"116","qty_from_mos":2,"unit_price":8000,"mos_unit_price":8000}]},
  {"cert_num":9,"items":[{"item_num":"094","qty_from_mos":2,"unit_price":13000},{"item_num":"098","qty_from_mos":1,"unit_price":11000},{"item_num":"102","qty_from_mos":14,"unit_price":900},{"item_num":"103","qty_from_mos":4,"unit_price":900},{"item_num":"109","qty_from_mos":18,"unit_price":2800},{"item_num":"115","qty_from_mos":5,"unit_price":8000},{"item_num":"117","qty_from_mos":17,"unit_price":2000},{"item_num":"126","qty_from_mos":10,"unit_price":1100}]},
  {"cert_num":10,"items":[]},
  {"cert_num":11,"items":[{"item_num":"108","qty_from_mos":1,"unit_price":940},{"item_num":"110","qty_from_mos":5,"unit_price":1000},{"item_num":"117","qty_from_mos":1,"unit_price":2000},{"item_num":"126","qty_from_mos":10,"unit_price":1100}]},
  {"cert_num":12,"items":[{"item_num":"043","qty_from_mos":3,"unit_price":6000},{"item_num":"076","qty_from_mos":444,"unit_price":4},{"item_num":"077","qty_from_mos":1805.4,"unit_price":4}]}
];

// Precios de MOS unitarios (los que se agregaron en cert 6)
const mosPrices = {
  "043": 2564.5,
  "088": 4460,
  "087": 3345,
  "097": 3902.5,
  "098": 4460,
  "094": 5575,
  "102": 557.5,
  "103": 568.65,
  "108": 345.65,
  "109": 1912.23,
  "110": 750,
  "115": 2453,
  "116": 2787.5,
  "117": 1500,
  "126": 602.1
};

// Items que no son de MOS de la Cert 6 pero tienen qty_from_mos en certs posteriores
// (Esto es raro, si no hay MOS previo, la deduccion deberia ser cero)
// Pero Enrique dijo "Los items que no tienen adicion en material on site, no pueden tener deducciones"

let totalAdded = 0;
let totalDeducted = 0;

certs.forEach(c => {
  c.items.forEach(it => {
    if (it.mos_invoice_total) {
      totalAdded += parseFloat(it.mos_invoice_total);
    }
    if (it.qty_from_mos > 0) {
      const pu = mosPrices[it.item_num] || 0; // Solo deducimos si tenemos el precio de MOS
      totalDeducted += it.qty_from_mos * pu;
    }
  });
});

console.log("Total Agregado MOS:", totalAdded);
console.log("Total Deducido MOS:", totalDeducted);
console.log("Balance Final MOS:", totalAdded - totalDeducted);
