import { test, expect } from '@playwright/test';

test('sanctuary renders, every place opens, and a private thought becomes a real lantern', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const outbound = [];
  page.on('websocket', socket => socket.on('framesent', frame => outbound.push(String(frame.payload))));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Nothing to do. Nowhere to rush.' })).toBeVisible();
  await expect(page.getByText('Here, together. Quietly.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Release a thought/ })).toBeVisible();
  await page.getByRole('button', { name: 'Let go', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('A thought to release').fill('A private test worry');
  await page.getByRole('button', { name: 'Release this thought' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Your lantern is on its way');
  expect(outbound.join(' ')).not.toContain('private test worry');
  expect(outbound.some(frame => frame.includes('"release"'))).toBeTruthy();
  await page.getByRole('button', { name: 'Find warmth', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'You’re in good company.' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Simply be', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Let stillness take root.' })).toBeVisible();
  await page.getByRole('button', { name: 'Make room for stillness' }).click();
  await page.getByRole('button', { name: 'Enable ambient sound' }).click();
  await expect(page.getByRole('button', { name: 'Mute ambient sound' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Mute ambient sound' }).click();
  await page.getByRole('button', { name: /Lighting: Golden hour/ }).click();
  await expect(page.getByText('Soft dusk', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Wander', exact: true }).click();
  await page.screenshot({ path: 'artifacts/desktop.png' });
  expect(errors).toEqual([]);
});

test('garden blooms after real idle duration and a new activity does not remove flowers', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.goto('/');
  await expect(page.getByText('Here, together. Quietly.')).toBeVisible();
  await page.getByRole('button', { name: 'Simply be', exact: true }).click();
  await page.getByRole('button', { name: 'Make room for stillness' }).click();
  // Freeze wall-clock drift so a slow test machine cannot cross the 2-minute
  // boundary during the assertion. Activity then starts at exactly this time.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.mouse.move(13, 13);
  await page.clock.fastForward(119_000);
  await expect(page.getByText('Flowers are growing in your garden.')).toHaveCount(0);
  await page.clock.fastForward(2000);
  await expect(page.getByText('Flowers are growing in your garden.')).toHaveCount(1);
  await page.mouse.move(10, 10);
  await expect(page.getByText('Flowers are growing in your garden.')).toHaveCount(1);
});

test('another visitor can send anonymous support and the owner receives it', async ({ browser }) => {
  const first = await browser.newContext();
  const second = await browser.newContext();
  const owner = await first.newPage();
  const visitor = await second.newPage();
  try {
    await owner.goto('http://localhost:5173');
    await visitor.goto('http://localhost:5173');
    await expect(owner.getByText('Here, together. Quietly.')).toBeVisible();
    await expect(visitor.getByText('Here, together. Quietly.')).toBeVisible();
    await expect(visitor.getByRole('button', { name: /Release a thought/ })).toBeVisible();
    // A reused development server can still hold a previous test's lanterns.
    // Acknowledge those first so the next passing light belongs to this owner.
    const kindness = visitor.getByRole('button', { name: 'Send kindness to a passing lantern' });
    for (let i = 0; i < 30 && await kindness.count(); i++) await kindness.click();
    await expect(kindness).toHaveCount(0);
    await owner.getByRole('button', { name: 'Let go', exact: true }).click();
    await owner.getByLabel('A thought to release').fill('Letting the day settle');
    await owner.getByRole('button', { name: 'Release this thought' }).click();
    await expect(owner.getByRole('status')).toContainText('Your lantern is on its way');
    await visitor.getByRole('button', { name: 'Send kindness to a passing lantern' }).click();
    await expect(owner.getByRole('status')).toContainText('Someone held a little space for you');
    await expect(visitor.getByRole('button', { name: 'Send kindness to a passing lantern' })).toHaveCount(0);
    await owner.screenshot({ path: 'artifacts/release.png' });
  } finally { await first.close(); await second.close(); }
});

test('phone layout keeps controls accessible and dialogs inside viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Release a thought/ })).toBeVisible();
  await page.screenshot({ path: 'artifacts/mobile.png' });
  const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: innerWidth }));
  expect(width.scroll).toBe(width.viewport);
  await page.getByRole('button', { name: 'Let go', exact: true }).click();
  const box = await page.getByRole('dialog').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.getByLabel('A thought to release').fill('A passing thought');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'About this sanctuary' }).click();
  await expect(page.getByRole('heading', { name: 'A softer place to land.' })).toBeVisible();
});

test('missing backend stops WebSocket retries and can recover without losing a typed thought', async ({ page }) => {
  await page.clock.install();
  const sockets = [];
  page.on('websocket', socket => { if (new URL(socket.url()).pathname === '/ws') sockets.push(socket); });
  let probes = 0;
  await page.route('**/ws', async route => { probes++; await route.fulfill({ status: 200, contentType: 'text/html', body: '<html>Static Vercel fallback</html>' }); });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Retry live connection' })).toBeVisible();
  await page.clock.fastForward(60_000);
  expect(sockets).toHaveLength(0);
  expect(probes).toBeLessThanOrEqual(2); // Strict Mode may abort its first probe.
  await page.getByRole('button', { name: 'Let go', exact: true }).click();
  await page.getByLabel('A thought to release').fill('Keep this thought until the river returns');
  await expect(page.getByRole('button', { name: 'Release this thought' })).toBeDisabled();
  await page.unroute('**/ws');
  await page.getByRole('button', { name: 'Try connecting again' }).click();
  await expect(page.getByRole('button', { name: 'Release this thought' })).toBeEnabled();
  await expect(page.getByLabel('A thought to release')).toHaveValue('Keep this thought until the river returns');
  await page.getByRole('button', { name: 'Release this thought' }).click();
  await expect(page.getByRole('status')).toContainText('Your lantern is on its way');
});

test('349 by 498 viewport keeps navigation onscreen without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 349, height: 498 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Release a thought/ })).toBeVisible();
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, viewportWidth: innerWidth, viewportHeight: innerHeight }));
  expect(dimensions.width).toBe(dimensions.viewportWidth);
  expect(dimensions.height).toBe(dimensions.viewportHeight);
  const navigation = await page.getByRole('navigation').boundingBox();
  expect(navigation.y).toBeGreaterThan(0);
  expect(navigation.y + navigation.height).toBeLessThanOrEqual(498);
  await page.getByRole('button', { name: 'Let go', exact: true }).click();
  const dialog = await page.getByRole('dialog').boundingBox();
  expect(dialog.y).toBeGreaterThanOrEqual(0);
  expect(dialog.y + dialog.height).toBeLessThanOrEqual(498);
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.screenshot({ path: 'artifacts/compact-mobile.png' });
});
