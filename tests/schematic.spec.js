import { test, expect } from '@playwright/test';

async function model(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.locator('.save-status')).toContainText('All changes saved');
  return page.evaluate(() => JSON.parse(localStorage.getItem('current-workbench-v1')));
}
async function screenPoint(page, p) {
  return page.locator('.circuit-canvas > g').evaluate((scene, p) => {
    const point = new DOMPoint(p.x, p.y).matrixTransform(scene.getScreenCTM());
    return { x: point.x, y: point.y };
  }, p);
}
const schematicView = page => page.getByRole('radio', { name: 'Schematic' });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-component="r1"]')).toBeVisible();
});

test('the schematic shows standard symbols and routed nets for the same circuit', async ({ page }) => {
  await schematicView(page).click();
  await expect(schematicView(page)).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.schematic-part')).toHaveCount(4);
  await expect(page.locator('[data-component="board1"]')).toHaveCount(0);
  await expect(page.locator('.schematic-net')).toHaveCount(4);
  await expect(page.locator('.schematic-label .designator')).toHaveText(['BT1', 'R1', 'LED1', 'SW1']);
  await page.getByRole('button', { name: 'Run simulation' }).click();
  await expect(page.locator('.schematic-flow')).not.toHaveCount(0);
  await expect(page.locator('[data-net-voltage]')).toHaveCount(4);
  await expect(page.locator('.reading-card').nth(1)).toContainText('20.5');
  await page.locator('[data-component="sw1"] > g').first().dblclick();
  await expect(page.locator('.reading-state')).toHaveText('OPEN CIRCUIT');
  await expect(page.locator('.schematic-flow')).toHaveCount(0);
});

test('schematic placement is independent of the workbench and both persist', async ({ page }) => {
  const initial = await model(page);
  await schematicView(page).click();
  const from = await screenPoint(page, { x: 580, y: 260 }), to = await screenPoint(page, { x: 640, y: 320 });
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 }); await page.mouse.up();
  let p = await model(page), r1 = p.components.find(c => c.id === 'r1');
  expect(r1.schematic).toEqual({ x: 640, y: 320, rotation: 0 });
  expect([r1.x, r1.y]).toEqual([507, 274]);
  await page.keyboard.press('r');
  p = await model(page); r1 = p.components.find(c => c.id === 'r1');
  expect(r1.schematic.rotation).toBe(90);
  expect(r1.rotation).toBe(0);
  expect(p.wires).toEqual(initial.wires);
  await page.reload();
  await expect(schematicView(page)).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('s');
  await expect(page.getByRole('radio', { name: 'Model' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('[data-component="r1"] > g').first()).toHaveAttribute('transform', 'translate(507,274) rotate(0)');
});

test('parts added and wired in the schematic join the workbench circuit', async ({ page }) => {
  await schematicView(page).click();
  await page.locator('.search-field input').fill('ammeter');
  await page.locator('.part-ammeter').click();
  const id = await page.locator('[data-component^="ammeter-"]').getAttribute('data-component');
  const wire = await screenPoint(page, { x: 340, y: 260 });
  await page.mouse.click(wire.x, wire.y);
  await expect(page.locator('.inspector-panel')).toContainText('Selected net');
  await page.getByRole('button', { name: 'Wire (W)' }).click();
  await page.locator(`[data-terminal="${id}:0"]`).click();
  await page.locator('[data-terminal="r1:1"]').click();
  await expect(page.locator('.component-total')).toContainText('5 wires');
  const p = await model(page);
  expect(p.wires.at(-1)).toMatchObject({ from: `${id}:0`, to: 'r1:1' });
  expect(p.components.find(c => c.id === id).schematic).toBeTruthy();
  await page.getByRole('radio', { name: 'Model' }).click();
  await expect(page.locator(`[data-component="${id}"]`)).toBeVisible();
  await expect(page.locator(`[data-wire="${p.wires.at(-1).id}"]`)).toBeVisible();
});

test('new parts simulate with their own controls', async ({ page }) => {
  await page.getByRole('button', { name: 'Starter circuits' }).click();
  await page.getByRole('button', { name: /LED dimmer/ }).click();
  await page.getByRole('button', { name: 'Run simulation' }).click();
  await expect(page.locator('.reading-state')).toHaveText('LIVE');
  const before = Number((await page.locator('.reading-card').nth(1).locator('strong').innerText()).replace(/[^\d.]/g, ''));
  await page.locator('[data-component="rv1"] > g').first().click();
  await page.getByRole('slider', { name: 'Wiper position' }).fill('0');
  await expect.poll(async () => Number((await page.locator('.reading-card').nth(1).locator('strong').innerText()).replace(/[^\d.]/g, ''))).toBeGreaterThan(before * 3);
  await page.getByRole('button', { name: 'Starter circuits' }).click();
  await page.getByRole('button', { name: /Night light/ }).click();
  await page.getByRole('button', { name: 'Run simulation' }).click();
  await expect(page.locator('.led-center')).toHaveCount(1);
  await page.locator('[data-component="ldr1"] > g').first().click();
  await page.getByRole('slider', { name: 'Light level slider' }).fill('95');
  await expect(page.locator('.led-center')).toHaveCount(0);
});
