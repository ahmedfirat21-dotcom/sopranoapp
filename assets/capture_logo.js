const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  // Transparent viewport
  await page.setViewport({ width: 1400, height: 200, deviceScaleFactor: 2 });

  // Load the logo page
  await page.goto(`http://localhost:8765/logo_export.html`, { waitUntil: 'networkidle0', timeout: 15000 });

  // Wait for font to load
  await page.waitForFunction(() => document.fonts.ready.then(() => true), { timeout: 10000 });
  await new Promise(r => setTimeout(r, 2000)); // Extra wait for font rendering

  // Get the logo element bounds
  const logoEl = await page.$('#logo');
  const box = await logoEl.boundingBox();

  // Screenshot the full logo with transparent background
  await page.screenshot({
    path: path.join(__dirname, 'soprano_chat_full.png'),
    clip: { x: box.x, y: box.y, width: box.width, height: box.height },
    omitBackground: true,
  });
  console.log('✅ soprano_chat_full.png saved');

  // Now get individual elements
  // Soprano part
  const sopranoEl = await page.$('.retro-logo-soprano');
  const sBox = await sopranoEl.boundingBox();
  await page.screenshot({
    path: path.join(__dirname, 'soprano_part.png'),
    clip: { x: sBox.x, y: sBox.y, width: sBox.width, height: sBox.height },
    omitBackground: true,
  });
  console.log('✅ soprano_part.png saved');

  // Chat part
  const chatEl = await page.$('.retro-logo-chat');
  const cBox = await chatEl.boundingBox();
  await page.screenshot({
    path: path.join(__dirname, 'chat_part.png'),
    clip: { x: cBox.x, y: cBox.y, width: cBox.width, height: cBox.height },
    omitBackground: true,
  });
  console.log('✅ chat_part.png saved');

  await browser.close();
  console.log('Done!');
})();
