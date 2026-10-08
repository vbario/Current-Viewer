import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-component="r1"]')).toBeVisible();
});

test('runs the starter circuit, updates electrical values, and toggles effects', async ({ page }) => {
  await page.getByRole('button', { name: 'Run simulation' }).click();
  await expect(page.locator('.reading-card').nth(1)).toContainText('20.5');
  await expect(page.locator('.current-flow')).toHaveCount(4);
  await expect(page.locator('.wire-readout')).toHaveCount(4);
  await expect(page.locator('[data-wire-readout="w1"] .wire-voltage')).toHaveText('8.98 V');
  await expect(page.locator('[data-wire-readout="w3"] .wire-voltage')).toHaveText('2.21 V');
  await expect(page.locator('[data-wire-readout="w4"] .wire-voltage')).toHaveText('0.00 V');
  await expect(page.locator('[data-wire-readout="w3"] .wire-current')).toHaveText('20.52 mA');
  await expect(page.locator('.wire-reference-note')).toContainText('Battery − = 0 V');
  await expect(page.locator('.led-center')).toHaveCount(1);
  await page.getByRole('switch', { name: 'Show current flow' }).click();
  await expect(page.locator('.current-flow')).toHaveCount(0);
  await expect(page.locator('.wire-readout')).toHaveCount(0);
  await page.getByRole('switch', { name: 'Show current flow' }).click();
  await page.getByRole('switch', { name: 'Show heat view' }).click();
  await expect(page.locator('.heat-haze')).not.toHaveCount(0);
  await page.getByRole('button', { name: '1 kΩ', exact: true }).click();
  await expect(page.locator('.reading-card').nth(1)).toContainText('6.9');
  await expect(page.locator('[data-wire-readout="w3"] .wire-current')).toHaveText('6.92 mA');
  await expect(page.locator('[data-wire-readout="w3"] .wire-voltage')).toHaveText('2.07 V');
  await page.getByRole('switch', { name: 'Show component effects' }).click();
  await expect(page.locator('.led-center')).toHaveCount(0);
  await page.getByRole('button', { name: 'Stop simulation' }).click();
  await expect(page.locator('.current-flow')).toHaveCount(0);
  await expect(page.locator('.reading-state')).toHaveText('SIMULATION OFF');
  await expect(page.locator('.wire-readout')).toHaveCount(0);
});

test('opens and closes the circuit using a switch and undo', async ({ page }) => {
  await page.getByRole('button', { name: 'Run simulation' }).click();
  await page.locator('[data-component="sw1"] > g').first().dblclick();
  await expect(page.locator('.reading-state')).toHaveText('OPEN CIRCUIT');
  await expect(page.locator('.wire-readout')).toHaveCount(4);
  await expect(page.locator('[data-wire-readout="w1"] .wire-voltage')).toHaveText('9.00 V');
  await expect(page.locator('[data-wire-readout="w1"] .wire-current')).toHaveText('0.00 mA');
  await expect(page.locator('.current-flow')).toHaveCount(0);
  await expect(page.getByRole('switch', { name: 'Switch position' })).not.toBeChecked();
  await page.getByRole('button', { name: 'Undo (⌘Z)' }).click();
  await expect(page.locator('.reading-state')).toHaveText('LIVE');
  await expect(page.locator('.led-center')).toHaveCount(1);
  await expect(page.locator('[data-wire-readout="w1"] .wire-current')).toHaveText('20.52 mA');
});

test('adds, drags, connects, rotates, and deletes a component with undo', async ({ page }) => {
  await page.locator('.part-resistor').click();
  await expect(page.locator('.component-total')).toContainText('6 components');
  const newPart = page.locator('[data-component^="resistor-"]');
  const id = await newPart.getAttribute('data-component');
  const before = await newPart.locator('g').first().getAttribute('transform');
  const body = await newPart.locator('g').first().boundingBox();
  await page.mouse.move(body.x + body.width / 2, body.y + body.height / 2);
  await page.mouse.down();
  await page.mouse.move(body.x + body.width / 2 + 55, body.y + body.height / 2 - 20, { steps: 8 });
  await page.mouse.up();
  await expect(newPart.locator('g').first()).not.toHaveAttribute('transform', before);
  await page.locator('[data-terminal="bat1:0"]').click();
  await page.locator(`[data-terminal="${id}:0"]`).click();
  await page.locator(`[data-terminal="${id}:1"]`).click();
  await page.locator('[data-terminal="bat1:1"]').click();
  await expect(page.locator('.component-total')).toContainText('6 wires');
  await page.getByRole('button', { name: 'Run simulation' }).click();
  await expect(page.locator('.reading-card').nth(1)).toContainText('47.6');
  await page.getByRole('button', { name: 'Select (V)' }).click();
  await newPart.locator('g').first().click();
  await page.getByRole('button', { name: 'Rotate component (R)' }).click();
  await expect(newPart.locator('g').first()).toHaveAttribute('transform', /rotate\(90\)/);
  await page.getByRole('button', { name: 'Delete selected (Backspace)' }).click();
  await expect(page.locator('.component-total')).toContainText('5 components');
  await expect(page.locator('.component-total')).toContainText('4 wires');
  await page.getByRole('button', { name: 'Undo (⌘Z)' }).click();
  await expect(page.locator('.component-total')).toContainText('6 components');
  await expect(page.locator('.component-total')).toContainText('6 wires');
});

test('saves, exports, imports, restores, and opens starter projects', async ({ page }) => {
  await page.locator('.name-button').click();
  await page.getByRole('textbox', { name: 'Circuit name' }).fill('My LED experiment');
  await page.getByRole('textbox', { name: 'Circuit name' }).press('Enter');
  await page.getByRole('button', { name: 'Save circuit', exact: true }).click();
  await page.getByRole('button', { name: 'My circuits' }).click();
  await expect(page.locator('.saved-circuit')).toContainText('My LED experiment');
  await expect(page.locator('.save-status')).toContainText('All changes saved');
  await page.reload();
  await expect(page.locator('.name-button')).toContainText('My LED experiment');
  await page.getByRole('button', { name: 'More circuit options' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export circuit' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('my-led-experiment.json');
  const path = await download.path();
  await page.getByRole('button', { name: 'New circuit', exact: false }).click();
  await page.getByRole('button', { name: /Blank canvas/ }).click();
  await expect(page.locator('.component-total')).toContainText('0 components');
  await page.locator('input[type="file"]').setInputFiles(path);
  await expect(page.locator('.component-total')).toContainText('5 components');
  await expect(page.locator('.name-button')).toContainText('My LED experiment');
  await page.getByRole('button', { name: 'Starter circuits', exact: true }).click();
  await page.getByRole('button', { name: /Make it move/ }).click();
  await page.getByRole('button', { name: 'Run simulation' }).click();
  await expect(page.locator('.motor-spin')).toHaveCount(1);
  await expect(page.locator('.reading-state')).toHaveText('LIVE');
});

test('mobile layout keeps the canvas, library, properties, and help usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.circuit-canvas')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.getByRole('button', { name: 'Run simulation' }).click();
  await expect(page.locator('.current-flow')).toHaveCount(4);
  await page.locator('.mobile-actions').getByRole('button', { name: 'Components' }).click();
  await page.locator('.search-field input').fill('capacitor');
  await expect(page.locator('.part-card')).toHaveCount(1);
  await page.locator('.part-capacitor').click();
  await expect(page.locator('.component-total')).toContainText('6 components');
  await page.locator('.mobile-actions').getByRole('button', { name: 'Properties' }).click();
  await expect(page.locator('.selected-component-card h2')).toHaveText('Capacitor');
  await page.getByRole('button', { name: 'Close panel' }).click({ position: { x: 10, y: 80 } });
  await page.getByRole('button', { name: 'More circuit options' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
});
