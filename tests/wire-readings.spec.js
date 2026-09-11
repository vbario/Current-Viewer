import { test, expect } from '@playwright/test';

test('wire readouts show individual branch currents and the common reference voltage', async ({ page }) => {
  const project = {
    name: 'Parallel resistors',
    components: [
      { id: 'bat1', type: 'battery', x: 155, y: 390, rotation: 0, value: 9, label: 'Supply' },
      { id: 'r1', type: 'resistor', x: 460, y: 274, rotation: 0, value: 100 },
      { id: 'r2', type: 'resistor', x: 650, y: 390, rotation: 0, value: 200 },
    ],
    wires: [
      { id: 'a', from: 'bat1:0', to: 'r1:0', color: '#dc6a52' },
      { id: 'b', from: 'bat1:0', to: 'r2:0', color: '#d5a143' },
      { id: 'c', from: 'r1:1', to: 'bat1:1', color: '#78977b' },
      { id: 'd', from: 'r2:1', to: 'bat1:1', color: '#687b8d' },
    ],
  };
  await page.addInitScript(p => localStorage.setItem('current-workbench-v1', JSON.stringify(p)), project);
  await page.goto('/');
  await page.getByRole('button', { name: 'Run simulation' }).click();
  await expect(page.locator('[data-wire-readout="a"] .wire-current')).toHaveText('88.67 mA');
  await expect(page.locator('[data-wire-readout="b"] .wire-current')).toHaveText('44.33 mA');
  await expect(page.locator('[data-wire-readout="a"] .wire-voltage')).toHaveText('8.87 V');
  await expect(page.locator('[data-wire-readout="b"] .wire-voltage')).toHaveText('8.87 V');
  await expect(page.locator('[data-wire-readout="d"] .wire-voltage')).toHaveText('0.00 V');
  await expect(page.locator('.wire-reference-note')).toContainText('Supply − = 0 V');
});

test('wire readings follow route edits and remain readable on mobile', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await page.evaluate(() => document.fonts.ready);
  await page.getByRole('button', { name: 'Run simulation' }).click();
  const readout = page.locator('[data-wire-readout="w1"]');
  await expect(readout).toBeVisible();
  const before = await readout.locator('path').getAttribute('d');
  const points = await page.locator('.circuit-canvas > g').evaluate(scene => [new DOMPoint(205, 183), new DOMPoint(205, 223)].map(p => { const s = p.matrixTransform(scene.getScreenCTM()); return { x: s.x, y: s.y }; }));
  await page.mouse.move(points[0].x, points[0].y); await page.mouse.down();
  await page.mouse.move(points[1].x, points[1].y, { steps: 6 }); await page.mouse.up();
  await expect(readout.locator('path')).not.toHaveAttribute('d', before);
  await expect(readout.locator('.wire-voltage')).toHaveText('8.98 V');
  await expect(readout.locator('.wire-current')).toHaveText('20.52 mA');
  await expect(page.locator('.current-flow')).toHaveCount(4);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.wire-readout')).toHaveCount(4);
  for (const label of await page.locator('.wire-readout > g').all()) {
    await expect(label).toBeInViewport();
    await expect.poll(async () => (await label.boundingBox()).width).toBeGreaterThan(100);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  expect(errors).toEqual([]);
});
