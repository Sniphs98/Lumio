import { expect, test } from '@playwright/test';

test('redirects signed-out visitors to the login page', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveURL(/\/login$/);
	await expect(page.getByText('Welcome back')).toBeVisible();
});

test('a new user can register and lands on the Home tab', async ({ page }) => {
	const email = `e2e-${Date.now()}@example.com`;

	await page.goto('/login');
	await page.getByRole('button', { name: 'Register' }).click();
	await page.getByLabel('Display name').fill('Test User');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('correct horse battery');
	await page.getByRole('button', { name: 'Create account' }).click();

	await expect(page).toHaveURL(/\/$/);
	await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
	await expect(page.getByText('Friends', { exact: true })).toBeVisible();
});

test('the Home tab works at phone width', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 800 });
	const email = `e2e-mobile-${Date.now()}@example.com`;

	await page.goto('/login');
	await page.getByRole('button', { name: 'Register' }).click();
	await page.getByLabel('Display name').fill('Phone User');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('correct horse battery');
	await page.getByRole('button', { name: 'Create account' }).click();

	await expect(page.getByText('Friends', { exact: true })).toBeVisible();
	const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
	expect(scrollWidth).toBeLessThanOrEqual(390);
});
