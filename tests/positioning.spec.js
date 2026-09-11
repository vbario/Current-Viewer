import { test, expect } from '@playwright/test';

async function screenPoint(page, p) {
  return page.locator('.circuit-canvas > g').evaluate((scene, p) => {
    const point = new DOMPoint(p.x, p.y).matrixTransform(scene.getScreenCTM());
    return { x: point.x, y: point.y };
  }, p);
}
async function dragScene(page, from, to) {
  const a = await screenPoint(page, from), b = await screenPoint(page, to);
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 }); await page.mouse.up();
}
async function clickScene(page, p, double = false) {
  const at = await screenPoint(page, p);
  if (double) await page.mouse.dblclick(at.x, at.y);
  else await page.mouse.click(at.x, at.y);
}
async function model(page) {
  // Let React flush the edit and pending-save effect before observing storage.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.locator('.save-status')).toContainText('All changes saved');
  return page.evaluate(() => JSON.parse(localStorage.getItem('current-workbench-v1')));
}
test.beforeEach(async ({ page }) => { await page.goto('/'); await expect(page.locator('[data-component="r1"]')).toBeVisible(); await page.evaluate(() => document.fonts.ready); });

test('placed components move from wire mode and by their labels without losing wire routes', async ({ page }) => {
  const initial = await model(page);
  await page.getByRole('button', { name: 'Wire (W)' }).click();
  await dragScene(page, { x: 507, y: 274 }, { x: 551, y: 306 });
  let p = await model(page);
  expect(p.components.find(c => c.id === 'r1')).toMatchObject({ x: 551, y: 306 });
  expect(p.wires).toEqual(initial.wires);
  await expect(page.getByRole('button', { name: 'Select (V)' })).toHaveClass(/active/);
  await dragScene(page, { x: 551, y: 259 }, { x: 567, y: 279 });
  p = await model(page);
  expect(p.components.find(c => c.id === 'r1')).toMatchObject({ x: 567, y: 326 });
  await page.keyboard.press('Shift+ArrowRight');
  p = await model(page);
  expect(p.components.find(c => c.id === 'r1').x).toBe(587);
  await page.getByRole('button', { name: 'Run simulation' }).click();
  await expect(page.locator('.reading-card').nth(1)).toContainText('20.5');
  await expect(page.locator('.current-flow')).toHaveCount(4);
});

test('wire segments and bends move while endpoints and live current stay connected', async ({ page }) => {
  const initial = await model(page);
  await page.getByRole('button', { name: 'Run simulation' }).click();
  await dragScene(page, { x: 205, y: 183 }, { x: 205, y: 223 });
  let p = await model(page), w = p.wires.find(w => w.id === 'w1');
  expect(w.via.slice(0, 2)).toEqual([{ x: 118, y: 223 }, { x: 294, y: 223 }]);
  expect(w.from).toBe('bat1:0'); expect(w.to).toBe('sw1:0');
  expect(p.components).toEqual(initial.components);
  await expect(page.locator('.reading-card').nth(1)).toContainText('20.5');
  await dragScene(page, { x: 118, y: 223 }, { x: 94, y: 251 });
  p = await model(page); w = p.wires.find(w => w.id === 'w1');
  expect(w.via[0]).toEqual({ x: 94, y: 251 });
  await page.getByRole('button', { name: 'Undo (⌘Z)' }).click();
  expect((await model(page)).wires.find(w => w.id === 'w1').via[0]).toEqual({ x: 118, y: 223 });
  await page.getByRole('button', { name: 'Redo (⌘⇧Z)' }).click();
  expect((await model(page)).wires.find(w => w.id === 'w1').via[0]).toEqual({ x: 94, y: 251 });
  await page.reload();
  expect((await model(page)).wires.find(w => w.id === 'w1').via[0]).toEqual({ x: 94, y: 251 });
});

test('wire bends can be added, removed, reset, and restored with undo', async ({ page }) => {
  await clickScene(page, { x: 230, y: 183 }, true);
  await expect(page.locator('[data-wire-bend]')).toHaveCount(4);
  const p = await model(page), w = p.wires.find(w => w.id === 'w1');
  expect(w.via[1].x).toBeCloseTo(230, 3);
  expect(w.via[1].y).toBe(183);
  await page.locator('[data-wire-bend="1"]').focus();
  await page.keyboard.press('ArrowDown');
  expect((await model(page)).wires.find(w => w.id === 'w1').via[1].y).toBe(187);
  await page.keyboard.press('Delete');
  await expect(page.locator('[data-wire-bend]')).toHaveCount(3);
  await page.getByRole('button', { name: 'Add bend', exact: true }).click();
  await expect(page.locator('[data-wire-bend]')).toHaveCount(4);
  await page.getByRole('button', { name: 'Reset route', exact: true }).click();
  expect((await model(page)).wires.find(w => w.id === 'w1').via).toBeUndefined();
  await page.getByRole('button', { name: 'Undo (⌘Z)' }).click();
  expect((await model(page)).wires.find(w => w.id === 'w1').via).toHaveLength(4);
  const bend = (await model(page)).wires.find(w => w.id === 'w1').via[0];
  await clickScene(page, bend, true);
  await expect(page.locator('[data-wire-bend]')).toHaveCount(3);
});

test('breadboard holes move the board in select mode and still connect in wire mode', async ({ page }) => {
  await dragScene(page, { x: 857, y: 390 }, { x: 889, y: 414 });
  const p = await model(page);
  expect(p.components.find(c => c.id === 'board1')).toMatchObject({ x: 604, y: 359 });
  expect(p.wires).toHaveLength(4);
  await page.getByRole('button', { name: 'Wire (W)' }).click();
  await clickScene(page, { x: 889, y: 414 });
  await expect(page.locator('.pending-wire')).toHaveCount(1);
  await page.locator('[data-terminal="r1:0"]').click();
  expect((await model(page)).wires).toHaveLength(5);
  await expect(page.getByRole('button', { name: 'Select (V)' })).toHaveClass(/active/);
});

test('dragging after zoom and pan uses the canvas coordinates and Escape cancels a move', async ({ page }) => {
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.getByRole('button', { name: 'Pan (H)' }).click();
  const a = await screenPoint(page, { x: 507, y: 274 });
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(a.x + 45, a.y + 25); await page.mouse.up();
  await page.getByRole('button', { name: 'Select (V)' }).click();
  const initial = await model(page);
  await dragScene(page, { x: 507, y: 274 }, { x: 535, y: 294 });
  expect((await model(page)).components.find(c => c.id === 'r1')).toMatchObject({ x: 535, y: 294 });
  const before = await model(page), from = await screenPoint(page, { x: 535, y: 294 }), to = await screenPoint(page, { x: 575, y: 320 });
  await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.keyboard.press('Escape'); await page.mouse.up();
  expect(await model(page)).toEqual(before);
  await page.getByRole('button', { name: 'Undo (⌘Z)' }).click();
  expect(await model(page)).toEqual(initial);
});

test('touch users can move components and reshape a selected wire', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const session = await page.context().newCDPSession(page);
  const touchDrag = async (from, to) => {
    const a = await screenPoint(page, from), b = await screenPoint(page, to);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x, y: a.y }] });
    for (let i = 1; i <= 5; i++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + (b.x - a.x) * i / 5, y: a.y + (b.y - a.y) * i / 5 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  await touchDrag({ x: 507, y: 274 }, { x: 547, y: 314 });
  expect((await model(page)).components.find(c => c.id === 'r1')).toMatchObject({ x: 547, y: 314 });
  await touchDrag({ x: 205, y: 183 }, { x: 205, y: 215 });
  expect((await model(page)).wires.find(w => w.id === 'w1').via[0].y).toBe(215);
  await touchDrag({ x: 118, y: 215 }, { x: 94, y: 243 });
  expect((await model(page)).wires.find(w => w.id === 'w1').via[0]).toEqual({ x: 94, y: 243 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('exact position edits and rotation preserve routes, and interrupted gestures roll back', async ({ page }) => {
  const initial = await model(page);
  await page.locator('.position-details summary').click();
  await page.getByRole('spinbutton', { name: 'Component X position' }).fill('630');
  await page.getByRole('spinbutton', { name: 'Component Y position' }).fill('350');
  await page.getByRole('button', { name: 'Rotate component (R)' }).click();
  const positioned = await model(page);
  expect(positioned.components.find(c => c.id === 'r1')).toMatchObject({ x: 630, y: 350, rotation: 90 });
  expect(positioned.wires).toEqual(initial.wires);
  await page.locator('.circuit-canvas').evaluate(svg => svg.addEventListener('pointerdown', e => { svg.dataset.testPointerId = e.pointerId; }, { capture: true, once: true }));
  const a = await screenPoint(page, { x: 630, y: 350 }), b = await screenPoint(page, { x: 674, y: 398 });
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 5 });
  const pointerId = Number(await page.locator('.circuit-canvas').getAttribute('data-test-pointer-id'));
  await page.locator('.circuit-canvas').dispatchEvent('pointercancel', { pointerId }); await page.mouse.up();
  expect(await model(page)).toEqual(positioned);
  await page.getByRole('button', { name: 'Undo (⌘Z)' }).click();
  expect((await model(page)).components.find(c => c.id === 'r1').rotation).toBe(0);
  await page.getByRole('button', { name: 'Redo (⌘⇧Z)' }).click();
  expect(await model(page)).toEqual(positioned);
});
