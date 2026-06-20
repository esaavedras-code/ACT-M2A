import assert from 'node:assert';
import { roundedAmt } from '../lib/utils';
import { calculateLaborTotal, applyAC51Rules, calculateEquipmentRental } from '../lib/fa2Calculations';

// Colores de consola para una visualización elegante
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const BLUE = '\x1b[34m';

console.log(`${BOLD}${BLUE}=== INICIANDO SUITE DE PRUEBAS DE CÁLCULOS Y ALGORITMOS (PACT) ===${RESET}\n`);

let totalTests = 0;
let passedTests = 0;

function runTest(name: string, fn: () => void) {
    totalTests++;
    try {
        fn();
        passedTests++;
        console.log(`  ${GREEN}✓ Passed:${RESET} ${name}`);
    } catch (error: any) {
        console.error(`  ${RED}✗ Failed:${RESET} ${name}`);
        console.error(`    Error: ${error.message}`);
        if (error.actual !== undefined && error.expected !== undefined) {
            console.error(`    Obtenido: ${error.actual}, Esperado: ${error.expected}`);
        }
    }
}

// -------------------------------------------------------------
// 1. PRUEBAS DE REDONDEO BANCARIO (Banker's Rounding - roundedAmt)
// -------------------------------------------------------------
console.log(`${BOLD}1. Pruebas de Redondeo Bancario (roundedAmt)...${RESET}`);

runTest('Redondeo normal a 2 decimales (hacia arriba y abajo)', () => {
    assert.strictEqual(roundedAmt(1.234, 2), 1.23);
    assert.strictEqual(roundedAmt(1.236, 2), 1.24);
});

runTest('Caso límite de Banker\'s Rounding: termina exactamente en 5 y cifra previa es PAR (redondea hacia abajo)', () => {
    // 1.225 -> El 2 anterior al 5 es par, por ende redondea a 1.22
    assert.strictEqual(roundedAmt(1.225, 2), 1.22);
});

runTest('Caso límite de Banker\'s Rounding: termina exactamente en 5 y cifra previa es IMPAR (redondea hacia arriba)', () => {
    // 1.235 -> El 3 anterior al 5 es impar, por ende redondea a 1.24
    assert.strictEqual(roundedAmt(1.235, 2), 1.24);
});

runTest('Caso límite de Banker\'s Rounding: estrictamente mayor que 5 (redondea hacia arriba)', () => {
    // 1.2251 -> Cifra es mayor que 5, por ende redondea a 1.23
    assert.strictEqual(roundedAmt(1.2251, 2), 1.23);
});

runTest('Banker\'s Rounding con valores negativos', () => {
    assert.strictEqual(roundedAmt(-1.225, 2), -1.22);
    assert.strictEqual(roundedAmt(-1.235, 2), -1.24);
});

runTest('Manejo seguro de valores nulos, vacíos o incorrectos', () => {
    assert.strictEqual(roundedAmt(null, 2), 0);
    assert.strictEqual(roundedAmt(undefined, 2), 0);
    assert.strictEqual(roundedAmt('', 2), 0);
    assert.strictEqual(roundedAmt('abc', 2), 0);
});

runTest('Conversión correcta de String a Float', () => {
    assert.strictEqual(roundedAmt('1.235', 2), 1.24);
    assert.strictEqual(roundedAmt(' 1.225 ', 2), 1.22);
});

// -------------------------------------------------------------
// 2. PRUEBAS DE FUERZA DE TAREAS / FORCE ACCOUNT (AC-51)
// -------------------------------------------------------------
console.log(`\n${BOLD}2. Pruebas de Fuerza de Tareas AC-51 / FA2...${RESET}`);

runTest('Cálculo total de Mano de Obra con horas extra (1.5x y 2.0x)', () => {
    const laborEntry = {
        hoursReg: 40,   // 40 hrs reg * $20 = $800
        hours15: 10,    // 10 hrs 1.5x * $20 * 1.5 = $300
        hours20: 5,     // 5 hrs 2.0x * $20 * 2.0 = $200
        hourlyRate: 20
    };
    // Esperado: 800 + 300 + 200 = 1300
    assert.strictEqual(calculateLaborTotal(laborEntry), 1300);
});

runTest('Reglas de Coeficientes e Indirectos AC-51', () => {
    const laborTotal = 1000;
    const equipmentTotal = 500;
    const materialTotal = 800;

    const result = applyAC51Rules(laborTotal, equipmentTotal, materialTotal);

    // Mano de Obra:
    // 1. plus20MO = laborTotal * 1.20 = 1200
    assert.strictEqual(result.labor.plus20, 1200);

    // 2. Seguros sobre plus20MO (1200):
    //    stateInsurance (5%) = 60
    //    socialSecurity (6.2%) = 74.4
    //    unemployment (1%) = 12
    //    publicLiability (2%) = 24
    //    disability (0.5%) = 6
    //    Subtotal MO = 1200 + 60 + 74.4 + 12 + 24 + 6 = 1376.4
    // 3. BI Mano de Obra (6% sobre Subtotal MO) = 1376.4 * 0.06 = 82.584
    // 4. Final MO Total = 1376.4 + 82.584 = 1458.984
    const subtotalMO = 1200 + (1200 * 0.05) + (1200 * 0.062) + (1200 * 0.01) + (1200 * 0.02) + (1200 * 0.005);
    const expectedBI_MO = subtotalMO * 0.06;
    const expectedFinalMO = subtotalMO + expectedBI_MO;

    assert.strictEqual(result.labor.bi, expectedBI_MO);
    assert.strictEqual(result.labor.total, expectedFinalMO);

    // Equipo:
    // BI (15%) = 500 * 0.15 = 75
    // Final EQ = 500 + 75 = 575
    assert.strictEqual(result.equipment.bi, 75);
    assert.strictEqual(result.equipment.total, 575);

    // Materiales:
    // BI (15%) = 800 * 0.15 = 120
    // Final MAT = 800 + 120 = 920
    assert.strictEqual(result.materials.bi, 120);
    assert.strictEqual(result.materials.total, 920);

    // Grand Total:
    const expectedGrandTotal = expectedFinalMO + 575 + 920;
    assert.strictEqual(result.grandTotal, expectedGrandTotal);
});

// -------------------------------------------------------------
// 3. PRUEBAS DE LÓGICA DE MATERIAL ON SITE (MOS)
// -------------------------------------------------------------
console.log(`\n${BOLD}3. Pruebas de Lógica de Material on Site (MOS)...${RESET}`);

// Función que emula la consolidación de MOS en generateAct117CExcel
function calculateMOSBalances(allCerts: any[], currentCertNum: number) {
    let materialBalance = 0;
    let runningMOS = 0;

    allCerts.forEach((c: any) => {
        const itemsList = c.items || [];
        let certMOS = 0;

        itemsList.forEach((it: any) => {
            const p = parseFloat(it.unit_price) || 0;
            const hasMOS = it.has_material_on_site;
            const invoiceTotal = parseFloat(it.mos_invoice_total) || 0;
            const qtyFromMOS = parseFloat(it.qty_from_mos) || 0;
            const mosPU = parseFloat(it.mos_unit_price) || p;

            // Fórmula oficial de PACT
            certMOS += (hasMOS ? invoiceTotal : 0) - (qtyFromMOS * mosPU);
        });

        runningMOS += certMOS;

        if (c.cert_num === currentCertNum) {
            materialBalance = runningMOS;
        }
    });

    const prevCerts = allCerts.filter((c: any) => c.cert_num < currentCertNum);
    const prevMOSBalance = prevCerts.reduce((acc: number, c: any) => {
        let cMOS = 0;
        const cItems = c.items || [];
        cItems.forEach((it: any) => {
            const p = parseFloat(it.unit_price) || 0;
            const hasMOS = it.has_material_on_site;
            const invoiceTotal = parseFloat(it.mos_invoice_total) || 0;
            const qtyFromMOS = parseFloat(it.qty_from_mos) || 0;
            const mosPU = parseFloat(it.mos_unit_price) || p;

            cMOS += (hasMOS ? invoiceTotal : 0) - (qtyFromMOS * mosPU);
        });
        return acc + cMOS;
    }, 0);

    const currentMOSChange = materialBalance - prevMOSBalance;

    return {
        materialBalance, // Acumulado al corte del periodo actual
        prevMOSBalance,  // Acumulado anterior al periodo actual
        currentMOSChange // Diferencia neta en este periodo
    };
}

runTest('MOS: Introducción inicial de material sin instalación (Cert 1)', () => {
    // Escenario: El contratista introduce una factura por $10,000 en el Certificado 1. No hay amortización.
    const certs = [
        {
            cert_num: 1,
            items: [
                {
                    item_num: '009',
                    unit_price: 150,
                    has_material_on_site: true,
                    mos_invoice_total: 10000,
                    mos_unit_price: 100,
                    qty_from_mos: 0
                }
            ]
        }
    ];

    const balances = calculateMOSBalances(certs, 1);

    // Balance acumulado actual debe ser $10,000
    assert.strictEqual(balances.materialBalance, 10000);
    // Balance previo debe ser 0 (ya que es la primera certificación)
    assert.strictEqual(balances.prevMOSBalance, 0);
    // Cambio neto del periodo debe ser $10,000
    assert.strictEqual(balances.currentMOSChange, 10000);
});

runTest('MOS: Instalación en el periodo siguiente y amortización (Cert 2)', () => {
    // Escenario:
    // Cert 1: Ingreso de material = +$10,000 (Balance = 10,000)
    // Cert 2: Se instalan 30 unidades en obra del MOS. Se deduce con qty_from_mos = 30 a $100 c.u. = -$3,000.
    const certs = [
        {
            cert_num: 1,
            items: [
                {
                    item_num: '009',
                    unit_price: 150,
                    has_material_on_site: true,
                    mos_invoice_total: 10000,
                    mos_unit_price: 100,
                    qty_from_mos: 0
                }
            ]
        },
        {
            cert_num: 2,
            items: [
                {
                    item_num: '009',
                    unit_price: 150,
                    has_material_on_site: false, // No hay nueva factura
                    mos_invoice_total: 0,
                    mos_unit_price: 100,
                    qty_from_mos: 30
                }
            ]
        }
    ];

    const balances = calculateMOSBalances(certs, 2);

    // Balance acumulado al corte de Cert 2: 10,000 - 3,000 = $7,000
    assert.strictEqual(balances.materialBalance, 7000);
    // Balance previo (Cert 1): $10,000
    assert.strictEqual(balances.prevMOSBalance, 10000);
    // Cambio neto en el periodo: -$3,000 (descuento del pago mensual)
    assert.strictEqual(balances.currentMOSChange, -3000);
});

runTest('MOS: Uso del precio de contrato como fallback cuando no hay mos_unit_price', () => {
    const certs = [
        {
            cert_num: 1,
            items: [
                {
                    item_num: '010',
                    unit_price: 120, // Precio de contrato es $120
                    has_material_on_site: true,
                    mos_invoice_total: 6000,
                    mos_unit_price: null, // No se especificó precio unitario especial
                    qty_from_mos: 10      // Se instalan 10 unidades. Deduce 10 * 120 = $1,200
                }
            ]
        }
    ];

    const balances = calculateMOSBalances(certs, 1);

    // Balance esperado: 6000 - (10 * 120) = 6000 - 1200 = 4800
    assert.strictEqual(balances.materialBalance, 4800);
});

// -------------------------------------------------------------
// RESUMEN GENERAL DE RESULTADOS
// -------------------------------------------------------------
console.log(`\n${BOLD}=== RESUMEN GENERAL ===${RESET}`);
if (passedTests === totalTests) {
    console.log(`${GREEN}${BOLD}¡TODOS LOS TESTS PASARON CORRECTAMENTE! (${passedTests}/${totalTests})${RESET}`);
} else {
    console.error(`${RED}${BOLD}SE DETECTARON FALLOS EN LA SUITE DE PRUEBAS (${passedTests}/${totalTests})${RESET}`);
    process.exit(1);
}
