const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER_LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER_ERROR:', err.message));
  await page.goto('http://localhost:3001/proyectos');
  await page.waitForTimeout(3000);
  console.log('--- Navigating to first project ---');
  const projectLink = await page.a[href^="/proyectos/detalle?id="];
  if(projectLink) {
    await projectLink.click();
    await page.waitForTimeout(3000);
  } else {
    console.log('No project link found');
  }
  await browser.close();
})();
