import puppeteer from 'puppeteer';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Automates login to Sunvoy, scrapes users from /list,
 * adds current user from /settings, and writes all to users.json.
 */
(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Step 1: Go to login page and log in using credentials from .env
  await page.goto('https://challenge.sunvoy.com/login', { waitUntil: 'networkidle0' });
  await page.type('input[name="username"]', process.env.EMAIL || '');
  await page.type('input[name="password"]', process.env.PASSWORD || '');
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
  ]);

  // Step 2: Go to /list and extract list of users
  await page.goto('https://challenge.sunvoy.com/list', { waitUntil: 'networkidle0' });

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

  // Step 3: Go to /settings and extract current user based on input order
  await page.goto('https://challenge.sunvoy.com/settings', { waitUntil: 'networkidle0' });

  // Wait for inputs to be present
  await page.waitForSelector('input');

  const currentUser = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input')) as HTMLInputElement[];

    // DOM order: [0] = ID, [1] = First Name, [2] = Last Name, [3] = Email
    const id = inputs[0]?.value || '';
    const firstName = inputs[1]?.value || '';
    const lastName = inputs[2]?.value || '';
    const email = inputs[3]?.value || '';
    const name = `${firstName} ${lastName}`.trim();

    return { name, email, id };
  });

  // Step 4: Append current user to users array and save to users.json
  users.push(currentUser);
  fs.writeFileSync('users.json', JSON.stringify(users, null, 2));
  console.log(`users.json written with ${users.length} total users`);

  await browser.close();
})();
