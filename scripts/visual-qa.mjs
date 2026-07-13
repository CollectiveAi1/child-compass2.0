import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
// The managed workspace runs as uid 0 on a filesystem that intentionally rejects
// ownership changes. Present as an unprivileged process while unpacking Chromium.
Object.defineProperty(process, 'getuid', { value: () => 1000 });
const { default: sparticuz } = await import('@sparticuz/chromium');
const { chromium } = await import('playwright-core');

const output = resolve('artifacts');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: await sparticuz.executablePath(), args: sparticuz.args, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

async function reset() {
  await page.goto('http://127.0.0.1:4000', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText('Choose your view').waitFor();
}

await reset();
check(await page.getByText('Every little moment,').isVisible(), 'Login hero did not render');
check(await page.getByRole('button', { name: /Admin —/ }).isVisible(), 'Admin role missing');
check(await page.getByRole('button', { name: /Teacher —/ }).isVisible(), 'Teacher role missing');
check(await page.getByRole('button', { name: /Parent —/ }).isVisible(), 'Parent role missing');
await page.screenshot({ path: resolve(output, 'login-desktop.png'), fullPage: true });

await page.getByRole('button', { name: /Admin —/ }).click();
await page.getByRole('button', { name: 'Enter Admin Portal' }).click();
await page.getByText('Good morning, Maya.').waitFor();
check((await page.getByText('Classroom pulse').count()) === 1, 'Admin classroom pulse missing');
await page.screenshot({ path: resolve(output, 'admin-desktop.png'), fullPage: true });
await page.getByRole('button', { name: 'Children & Staff' }).click();
check(await page.getByText('Center roster').isVisible(), 'Admin people workspace failed');
check(await page.getByText('Mia Morgan', { exact: true }).first().isVisible(), 'Admin child context failed');

await reset();
await page.getByRole('button', { name: 'Enter Teacher Portal' }).click();
await page.getByRole('heading', { name: /Jordan/ }).waitFor();
check(await page.getByText('What’s happening now?').isVisible(), 'Teacher quick log missing');
await page.screenshot({ path: resolve(output, 'teacher-desktop.png'), fullPage: true });
await page.getByRole('button', { name: 'Attendance' }).click();
await page.getByRole('heading', { name: 'Attendance Kanban' }).waitFor();
const lily = page.getByRole('button').filter({ hasText: 'Lily Chen' });
check((await lily.count()) === 1, 'Lily attendance card missing');
await lily.click();
await page.waitForTimeout(250);
check((await page.getByText('Checked in').count()) >= 1, 'Attendance transition failed');
await page.screenshot({ path: resolve(output, 'teacher-attendance.png'), fullPage: true });

await reset();
await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole('button', { name: /Parent —/ }).click();
await page.getByRole('button', { name: 'Enter Parent Portal' }).click();
await page.getByRole('heading', { name: /Hi, Alex/ }).waitFor();
check(await page.getByText('Today at a glance').isVisible(), 'Parent stories missing');
check(await page.getByText('Mia’s day').isVisible(), 'Parent live feed missing');
await page.screenshot({ path: resolve(output, 'parent-mobile.png'), fullPage: true });
await page.getByRole('button', { name: /Play story/ }).click();
check(await page.getByRole('heading', { name: 'Garden explorers', level: 2 }).isVisible(), 'Story mode failed');
await page.screenshot({ path: resolve(output, 'parent-story.png') });
await page.getByRole('button', { name: 'Close story' }).click();
await page.getByRole('button', { name: 'Messages' }).click();
await page.getByPlaceholder('Message Mia’s teachers…').fill('Pickup will be at 4:30 today.');
await page.locator('.family-chat-card form').getByRole('button').filter({ has: page.locator('svg.lucide-send') }).click();
await page.getByText('Pickup will be at 4:30 today.').waitFor();

const logs = await page.context().pages()[0].evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth }));
check(logs.width <= logs.viewport, `Mobile overflow detected: ${logs.width}px > ${logs.viewport}px`);
await browser.close();
if (failures.length) { console.error(`Visual QA failed:\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log('Visual QA passed: 3 role logins, attendance mutation, story mode, messaging, desktop and 390px mobile.');
