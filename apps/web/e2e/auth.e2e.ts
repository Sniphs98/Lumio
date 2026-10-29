import { expect, test } from '@playwright/test';
import { signUp, uniqueEmail } from './helpers.ts';

test('redirects signed-out visitors to the login page', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveURL(/\/login$/);
	await expect(page.getByText('Welcome back')).toBeVisible();
});

test('the login page only offers registration through an invite link', async ({ page }) => {
	// setup.ts already created the instance, so the first-user registration is closed.
	await page.goto('/login');
	await expect(page.getByText('New here? Ask a member for an invite link.')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Register' })).toBeHidden();
});

test('the sign-up API refuses accounts without an invite', async ({ request }) => {
	const response = await request.post('/api/auth/sign-up/email', {
		headers: { origin: 'http://localhost:4173' },
		data: { name: 'Mallory', email: uniqueEmail('mallory'), password: 'correct horse battery' }
	});
	expect(response.status()).toBe(403);
	expect(await response.text()).toContain('You need an invite link to join this Lumio.');
});

test('pages cannot be framed by other sites', async ({ request }) => {
	const response = await request.get('/login');
	expect(response.headers()['x-frame-options']).toBe('DENY');
	expect(response.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
	expect(response.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
});

test('signing in never redirects to another site', async ({ page }) => {
	const email = await signUp(page, 'Redirect User');
	await page.context().clearCookies();

	await page.goto('/login?redirectTo=/%09/example.com');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('correct horse battery');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByText('Friends', { exact: true })).toBeVisible();
	expect(new URL(page.url()).host).toBe('localhost:4173');
});

test('the account API refuses image URLs and overlong names', async ({ page }) => {
	await signUp(page, 'Profile User');
	const update = (data: object) =>
		page.request.post('/api/auth/update-user', {
			headers: { origin: 'http://localhost:4173' },
			data
		});

	expect((await update({ image: 'https://tracker.example/pixel.png' })).status()).toBe(400);
	expect((await update({ name: 'x'.repeat(100) })).status()).toBe(400);
	expect((await update({ name: '  Renamed   User ' })).status()).toBe(200);
});

test('a new user can join with an invite link and sign in again later', async ({ page }) => {
	const email = await signUp(page, 'Test User');
	await expect(page).toHaveURL(/\/channels$/);

	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('correct horse battery');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByText('Friends', { exact: true })).toBeVisible();
});

test('the Home tab works at phone width', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 800 });
	await signUp(page, 'Phone User');
	await page.getByRole('link', { name: 'Home' }).click();

	await expect(page.getByText('Friends', { exact: true })).toBeVisible();
	const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
	expect(scrollWidth).toBeLessThanOrEqual(390);
});
