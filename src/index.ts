import puppeteer from 'puppeteer';
import fs from 'fs';

/**
 * Automates login to Sunvoy, scrapes users from /list, and writes them to users.json.
 */
(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Step 1: Go to login page and log in
  await page.goto('https://challenge.sunvoy.com/login', { waitUntil: 'networkidle0' });
  await page.type('input[name="username"]', 'demo@example.org');
  await page.type('input[name="password"]', 'test');
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
  ]);

  // Step 2: Go to /list and wait for content
  await page.goto('https://challenge.sunvoy.com/list', { waitUntil: 'networkidle0' });

  // Step 3: Extract users from DOM
  const users = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('div[class*="rounded"]'));
    return cards.map(card => {
      const lines = card.textContent?.split('\n').map(line => line.trim()).filter(Boolean) || [];
      const name = lines[0] || '';
      const email = lines[1] || '';
      const id = (lines[2] || '').replace('ID: ', '');
      return { name, email, id };
    });
  });

  // Step 4: Write to users.json
  fs.writeFileSync('users.json', JSON.stringify(users, null, 2));
  console.log(`users.json written with ${users.length} users`);

  await browser.close();
})();
