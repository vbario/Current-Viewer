import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';

const FIXTURES = new URL('./fixtures/diagrams/', import.meta.url);
const fixtures = readdirSync(FIXTURES).filter(name => !name.startsWith('.'));

async function model(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.locator('.save-status')).toContainText('All changes saved');
  return page.evaluate(() => JSON.parse(localStorage.getItem('current-workbench-v1')));
}
async function dropFile(page, name, contents) {
  const dataTransfer = await page.evaluateHandle(({ name, contents }) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(contents)], name));
    return transfer;
  }, { name, contents: [...contents] });
  await page.dispatchEvent('body', 'dragenter', { dataTransfer });
  await expect(page.locator('.file-drop-overlay')).toBeVisible();
  await page.dispatchEvent('body', 'drop', { dataTransfer });
  await expect(page.locator('.file-drop-overlay')).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-component="r1"]')).toBeVisible();
});

for (const name of fixtures) {
  test(`imports ${name} as a project that opens in the schematic and simulates`, async ({ page }) => {
    await page.locator('input[type="file"]').setInputFiles(new URL(name, FIXTURES).pathname);
    await expect(page.getByRole('radio', { name: 'Schematic' })).toHaveAttribute('aria-checked', 'true');
    if (await page.getByRole('dialog').count()) await expect(page.getByRole('dialog')).not.toContainText('Couldn’t import');
    await page.keyboard.press('Escape');
    const project = await model(page);
    expect(project.components.length).toBeGreaterThan(2);
    expect(project.wires.length).toBeGreaterThan(1);
    await expect(page.locator('.schematic-part')).toHaveCount(project.components.length);
    await expect(page.locator('.schematic-net')).not.toHaveCount(0);
    await page.getByRole('button', { name: 'Run simulation' }).click();
    await expect(page.locator('.reading-state')).toHaveText('LIVE');
    await page.getByRole('radio', { name: 'Model' }).click();
    await expect(page.locator('.circuit-wire')).toHaveCount(project.wires.length);
  });
}

test('dropping a diagram anywhere imports it, and undo restores the previous circuit', async ({ page }) => {
  const name = fixtures.find(f => f.endsWith('.kicad_sch')) || fixtures[0];
  await dropFile(page, name, readFileSync(new URL(name, FIXTURES)));
  await expect(page.getByRole('radio', { name: 'Schematic' })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  expect((await model(page)).components.some(c => c.id === 'board1')).toBe(false);
  await page.getByRole('button', { name: 'Undo (⌘Z)' }).click();
  await expect(page.locator('.name-button')).toContainText('My first circuit');
  expect((await model(page)).components.some(c => c.id === 'board1')).toBe(true);
});

test('pictures and unsupported files explain what to do instead', async ({ page }) => {
  await dropFile(page, 'photo.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]));
  const dialog = page.getByRole('dialog', { name: 'Import a diagram' });
  await expect(dialog).toContainText('Couldn’t import photo.png');
  await expect(page.locator('.name-button')).toContainText('My first circuit');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Import a diagram' })).toContainText('KiCad schematic');
});
