import { expect, type Browser, type Page } from '@playwright/test';

type Viewport = { width: number; height: number };

/**
 * Invite link that every test user joins with. `e2e/setup.ts` creates it (and the instance
 * owner, on an empty database) before the tests run.
 */
export const E2E_INVITE_CODE = 'e2e-shared-invite';

export function uniqueEmail(name: string) {
	return `${name.toLowerCase().replace(/\W/g, '')}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
}

/** Creates an account through an invite link and returns its email. */
export async function signUp(page: Page, name: string, inviteCode = E2E_INVITE_CODE) {
	const email = uniqueEmail(name);
	await page.goto(`/invite/${inviteCode}`);
	await page.getByLabel('Display name').fill(name);
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('correct horse battery');
	await page.getByRole('button', { name: 'Create account and join' }).click();
	await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
	return email;
}

/** Signs up a new user in a fresh browser context and opens the Home tab. */
export async function newUser(browser: Browser, name: string, viewport?: Viewport) {
	const context = await browser.newContext({ viewport });
	const page = await context.newPage();
	const email = await signUp(page, name);
	await page.goto('/');
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
