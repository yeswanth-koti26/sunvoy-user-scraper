import puppeteer from 'puppeteer';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const COOKIES_PATH = 'cookies.json';

/**
 * Automates login to Sunvoy, scrapes users from /list,
 * adds current user from /settings, and writes all to users.json.
 */
(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Step 0: Load cookies if they exist
  if (fs.existsSync(COOKIES_PATH)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf-8'));
    await page.setCookie(...cookies);
    console.log(' Loaded cookies from previous session');
  }

  // Step 1: Go to /list and check if still logged in
  await page.goto('https://challenge.sunvoy.com/list', { waitUntil: 'networkidle0' });

  const isLoggedIn = await page.evaluate(() => {
    return !!document.querySelector('div[class*="rounded"]');
  });

  if (!isLoggedIn) {
    console.log(' Session expired or no cookies. Logging in...');

    // Go to login page and perform login
    await page.goto('https://challenge.sunvoy.com/login', { waitUntil: 'networkidle0' });
    await page.type('input[name="username"]', process.env.EMAIL || '');
    await page.type('input[name="password"]', process.env.PASSWORD || '');
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
    ]);

    // Save cookies
    const newCookies = await page.cookies();
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(newCookies, null, 2));
    console.log(' Saved new cookies to cookies.json');

    // Go to /list after login
    await page.goto('https://challenge.sunvoy.com/list', { waitUntil: 'networkidle0' });
  } else {
    console.log(' Reused session via cookies — login skipped');
  }

  // Step 2: Extract list of users
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
  await page.waitForSelector('input');

  const currentUser = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input')) as HTMLInputElement[];

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
  console.log(` users.json written with ${users.length} total users`);

  await browser.close();
})();
