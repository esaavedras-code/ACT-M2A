const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  // Configuración
  const url = 'https://act-m2-a.vercel.app';
  const email = 'esaavedras@gmail.com';
  const password = 'Pact2024*';
  const videoDir = './playwright_video';

  if (!fs.existsSync(videoDir)) {
    fs.mkdirSync(videoDir, { recursive: true });
  }

  console.log('Iniciando navegador con grabación de video...');
  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: videoDir }
  });

  const page = await context.newPage();

  // Handle any unexpected dialogs automatically
  page.on('dialog', async dialog => {
    console.log(`Dialog found: ${dialog.message()}`);
    if (dialog.type() === 'prompt') {
      await dialog.accept('C:\\Proyectos\\PR111');
    } else {
      await dialog.accept();
    }
  });

  try {
    console.log('1. Navegando a la página de login...');
    await page.goto(url, { waitUntil: 'networkidle' });

    // Login si es necesario
    if (await page.locator('input[type="email"]').isVisible()) {
      console.log('2. Ingresando credenciales...');
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', password);
      await page.click('button[type="submit"]');
      await page.waitForLoadState('networkidle');
      console.log('Login exitoso.');
    } else {
      console.log('Ya hay sesión activa.');
    }

    // Nuevo Proyecto
    console.log('3. Creando nuevo proyecto...');
    await page.waitForSelector('text=Nuevo Proyecto', { timeout: 10000 }).catch(() => null);
    const newProjectBtn = page.locator('button, a').filter({ hasText: 'Nuevo Proyecto' }).first();
    if (await newProjectBtn.isVisible()) {
      await newProjectBtn.click();
    } else {
      await page.goto(url + '/proyectos/nuevo');
    }
    
    console.log('4. Llenando Datos Generales (Proyecto)...');
    await page.waitForSelector('label:has-text("NÚM. AC")', { timeout: 10000 });
    
    const fillField = async (labelText, value) => {
      // Find the input corresponding to the label
      const input = page.locator(`label:has-text("${labelText}")`).locator('..').locator('input, select').first();
      await input.fill(value.toString());
    };

    await fillField('NÚM. AC', 'AC-011124');
    await fillField('NÚM. FEDERAL', 'STP-PR-0111(024)');
    await fillField('NOMBRE DEL PROYECTO', 'Rehabilitación PR-111');
    await fillField('NÚM. ORACLE', '7200-2026-0045');
    await fillField('NÚM. CONTRATO', 'DTOP-2026-CR-0045');
    await fillField('No. Cuenta', '0045-2026-METRO');
    await fillField('Costo Original ($)', '5250000');
    await fillField('Daños Líquidos Diarios ($)', '1100');
    await fillField('Participación Federal (%)', '80.35');
    
    // Región (select)
    const regionSelect = page.locator('label:has-text("Región")').locator('..').locator('select').first();
    await regionSelect.selectOption({ label: 'Metro' });

    // Fechas
    await fillField('NTP / Fecha de Inicio', '2026-02-01');
    await fillField('Fecha Terminación (Orig.)', '2026-11-30');
    
    // Ruta de grabación
    await page.fill('input[placeholder*="Ej. C:\\Proyectos"]', 'C:\\Proyectos\\PR111');

    console.log('Guardando proyecto...');
    const saveBtn = page.locator('button:has-text("GUARDAR PROYECTO")');
    await saveBtn.click();
    await page.waitForTimeout(3000); // Esperar que guarde y notifique
    
    // Click OK en el alert if it pops up (handled by page.on dialog)
    
    console.log('5. Llenando Datos Contratista...');
    await page.click('button:has-text("2. Contratista")');
    await page.waitForTimeout(1000);
    await fillField('Nombre o Compañía', 'Caribbean Roadbuilders, LLC');
    await fillField('Nombre del Representante', 'Caribbean Roadbuilders, LLC');
    await page.click('button:has-text("GUARDAR CAMBIOS")');
    await page.waitForTimeout(2000);

    // PARTIDAS
    console.log('6. Agregando Partidas...');
    await page.click('button:has-text("4. Partidas")');
    await page.waitForTimeout(1000);
    
    const addItem = async (num, esp, desc, qty, unit, price, sub) => {
      await page.click('button:has-text("Agregar Partida")').catch(() => page.click('button[title*="Agregar"]'));
      await page.waitForTimeout(500);
      
      const rows = page.locator('tr.bg-white, tr.dark\\:bg-slate-900'); // Fila editable reciente
      const lastRow = rows.last();
      
      // Asumimos el orden de las columnas: Number, Spec, Desc, Qty, Unit, UnitPrice, Fund, Action
      await lastRow.locator('input[placeholder="Ej. 001"]').fill(num);
      await lastRow.locator('input[placeholder="Ej. 151-001"]').fill(esp);
      await lastRow.locator('input[placeholder="Descripción de la partida"]').fill(desc);
      await lastRow.locator('input[type="number"]').nth(0).fill(qty); // Qty
      await lastRow.locator('input[placeholder="Ej. LF, TON"]').fill(unit);
      await lastRow.locator('input[type="number"]').nth(1).fill(price); // Unit Price
      
      // Botón Guardar fila (usualmente el primer botón de acción o un Save icon)
      await lastRow.locator('button').first().click().catch(() => {});
      await page.waitForTimeout(500);
    };

    await addItem('001', '151-001', 'Movilización (Mobilization)', '1', 'LS', '250000', 'Caribbean Roadbuilders');
    await addItem('002', '401-002', 'Pavimento Asfáltico Caliente (HMA Tipo II)', '18500', 'TON', '130', 'Asfalto Boricua');
    await addItem('003', '603-003', 'Tubería de Concreto Reforzado (RCP) 24"', '2200', 'LF', '120', 'Tubos del Sur');
    await addItem('004', '606-059', 'Vallas de Seguridad (W-Beam Guardrail)', '6500', 'LF', '40', 'PR Safety Barriers');

    // MANUFACTURA
    console.log('7. Certificado de Manufactura...');
    await page.click('button:has-text("7. Manufactura")');
    await page.waitForTimeout(1000);
    await page.click('button:has-text("NUEVO CERTIFICADO")').catch(() => page.click('button:has-text("Agregar")'));
    await page.waitForTimeout(500);
    
    await fillField('No. / ID Certificado', 'CM-001');
    // Partida
    const partSelect = page.locator('label:has-text("Partida Relacionada")').locator('..').locator('select');
    await partSelect.selectOption({ label: '002 - Pavimento Asfáltico Caliente (HMA Tipo II)' }).catch(() => {});
    
    await fillField('Material Especifico', 'Mezcla Asfáltica en Caliente (HMA) Tipo II');
    await fillField('Fabricante / Planta', 'Asfalto Boricua, Inc. - Planta de Bayamón');
    await fillField('Especificación', 'ACT Sección 403');
    await fillField('Ingeniero Firmante', 'Ing. Carmen Maldonado Torres, PE - Lic. 12457');
    
    await page.fill('input[type="date"]').nth(0).fill('2026-02-01'); // Emisión
    await page.fill('input[type="date"]').nth(1).fill('2027-01-31'); // Vencimiento

    await page.click('button:has-text("GUARDAR")');
    await page.waitForTimeout(2000);

    // MATERIAL ON SITE
    console.log('8. Material On Site...');
    await page.click('button:has-text("8. Materiales")');
    await page.waitForTimeout(1000);
    await page.click('button:has-text("NUEVO REGISTRO")').catch(() => page.click('button:has-text("Agregar")'));
    await page.waitForTimeout(500);
    
    await fillField('ID / Número de Registro', 'MS-001');
    // Partida
    const mosPartSelect = page.locator('label:has-text("Partida")').locator('..').locator('select');
    await mosPartSelect.selectOption({ label: '003 - Tubería de Concreto Reforzado (RCP) 24"' }).catch(() => {});
    
    await fillField('Suplidor', 'Tubos del Sur, Inc.');
    await fillField('Descripción del Material', '440 secciones tubería RCP Clase III 24 pulgadas AASHTO M 170');
    await fillField('Cantidad', '440');
    await fillField('Unidad', 'LF');
    await fillField('Precio Unitario', '120');
    await fillField('Número de Factura', 'TS-2026-0312');
    
    await page.locator('label:has-text("Fecha de Factura")').locator('..').locator('input[type="date"]').fill('2026-02-05');
    await fillField('Ubicación Física', 'Km 16.2 PR-111 área de acopio');
    
    await page.click('button:has-text("GUARDAR REGISTRO")');
    await page.waitForTimeout(2000);

    // CHANGE ORDER
    console.log('9. Change Order...');
    await page.click('button:has-text("5. CHO")');
    await page.waitForTimeout(1000);
    await page.click('button:has-text("NUEVO")').catch(() => page.click('button:has-text("Agregar")'));
    await page.waitForTimeout(1000);
    
    await fillField('Número CHO', 'CO-01');
    await fillField('Número Suplemento', 'SUPP-001');
    const tipoSelect = page.locator('label:has-text("Tipo")').locator('..').locator('select');
    await tipoSelect.selectOption({ value: 'Extra Work' }).catch(() => {});
    
    await page.locator('label:has-text("Descripción de los cambios")').locator('..').locator('textarea').fill('Se encontró roca sólida masiva (Clase D) no indicada en el Estudio Geotécnico');
    await page.locator('label:has-text("Justificación")').locator('..').locator('textarea').fill('El contrato original contempla únicamente excavación no clasificada.');
    
    await fillField('Aumento ($)', '40000');
    await fillField('Aumento (Días)', '15');
    
    await page.click('button:has-text("GUARDAR")');
    await page.waitForTimeout(2000);

    // CERTIFICACION
    console.log('10. Certificación de Pago...');
    await page.click('button:has-text("6. Monthly payments")');
    await page.waitForTimeout(1000);
    await page.click('button:has-text("NUEVA CERTIFICACIÓN")').catch(() => page.click('button:has-text("Agregar")'));
    await page.waitForTimeout(1000);
    
    await fillField('Número Interno', 'Cert-001');
    await fillField('Pay Application', 'PA-2026-001');
    await page.locator('label:has-text("Periodo Desde")').locator('..').locator('input[type="date"]').fill('2026-02-01');
    await page.locator('label:has-text("Periodo Hasta")').locator('..').locator('input[type="date"]').fill('2026-02-28');
    await page.locator('label:has-text("Fecha de Sometimiento")').locator('..').locator('input[type="date"]').fill('2026-03-02');
    
    await page.click('button:has-text("GUARDAR DATOS")');
    await page.waitForTimeout(2000);
    
    console.log('PROCESO COMPLETADO. Tomando captura de pantalla...');
    await page.screenshot({ path: 'playwright_video/resultado_final.png', fullPage: true });

  } catch (error) {
    console.error('Error durante la ejecución:', error);
    await page.screenshot({ path: 'playwright_video/error.png', fullPage: true });
  } finally {
    console.log('Cerrando navegador y finalizando grabación...');
    await browser.close();
  }
})();
