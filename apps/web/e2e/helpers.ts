import { expect, type Browser, type Page } from '@playwright/test';

type Viewport = { width: number; height: number };

/** Signs up a new user in a fresh browser context. */
export async function newUser(browser: Browser, name: string, viewport?: Viewport) {
	const context = await browser.newContext({ viewport });
	const page = await context.newPage();
	const email = `${name.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;

	await page.goto('/login');
	await page.getByRole('button', { name: 'Register' }).click();
	await page.getByLabel('Display name').fill(name);
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('correct horse battery');
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
	return { context, page, email };
}

export async function addFriend(page: Page, email: string) {
	await page.getByLabel("Friend's email").fill(email);
	await page.getByRole('button', { name: 'Send friend request' }).click();
}

/** Signs up two users and makes them friends. */
export async function friends(browser: Browser, viewport?: Viewport) {
	const anna = await newUser(browser, 'Anna', viewport);
	const ben = await newUser(browser, 'Ben', viewport);

	await addFriend(anna.page, ben.email);
	await expect(anna.page.getByRole('status')).toHaveText('Friend request sent to Ben.');
	await ben.page.getByRole('button', { name: 'Accept Anna' }).click();
	await expect(ben.page.getByRole('link', { name: 'Anna', exact: true })).toBeVisible();
	await expect(anna.page.getByRole('link', { name: 'Ben', exact: true })).toBeVisible();
	return { anna, ben };
}
