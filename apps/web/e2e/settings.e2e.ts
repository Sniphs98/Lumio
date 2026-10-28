import { expect, test } from '@playwright/test';
import { newUser } from './helpers.ts';

test('the gear opens the settings on Audio & Mic next to the section list', async ({ browser }) => {
	const { page, context } = await newUser(browser, 'Anna');
	await page.getByRole('region', { name: 'You' }).getByRole('button', { name: 'Settings' }).click();

	const dialog = page.getByRole('dialog', { name: 'Settings' });
	const nav = dialog.getByRole('navigation', { name: 'Settings sections' });
	await expect(nav.getByRole('button', { name: 'Audio & Mic' })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await expect(dialog.getByRole('heading', { name: 'Audio & Mic' })).toBeVisible();
	await expect(dialog.getByLabel('Microphone', { exact: true })).toBeVisible();
	await expect(dialog.getByRole('button', { name: 'All settings' })).toBeHidden();

	await context.close();
});

test('on a phone the settings sections are a separate screen', async ({ browser }) => {
	const { page, context } = await newUser(browser, 'Ben', { width: 390, height: 800 });
	await page.getByRole('region', { name: 'You' }).getByRole('button', { name: 'Settings' }).click();

	const dialog = page.getByRole('dialog', { name: 'Settings' });
	const nav = dialog.getByRole('navigation', { name: 'Settings sections' });
	await expect(dialog.getByRole('heading', { name: 'Audio & Mic' })).toBeVisible();
	await expect(nav).toBeHidden();

	await dialog.getByRole('button', { name: 'All settings' }).click();
	await expect(nav).toBeVisible();
	await expect(dialog.getByRole('heading', { name: 'Audio & Mic' })).toBeHidden();

	await nav.getByRole('button', { name: 'Audio & Mic' }).click();
	await expect(dialog.getByRole('switch', { name: 'Noise suppression' })).toBeVisible();
	const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
	expect(scrollWidth).toBeLessThanOrEqual(390);

	await context.close();
});
