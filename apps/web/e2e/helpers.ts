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
	await page.getByRole('tab', { name: 'Create account' }).click();
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

/** Joins through an invite or friend link as a guest, with nothing but a name. */
export async function joinAsGuest(page: Page, link: string, name: string) {
	await page.goto(link);
	await page.getByLabel('Your name').fill(name);
	await page.getByRole('button', { name: 'Join as guest' }).click();
	await expect(page.getByRole('link', { name: 'Guest · Create account' })).toBeVisible();
}

/** The personal friend link shown on the Home tab. */
export async function friendLinkOf(page: Page) {
	return page.getByRole('textbox', { name: 'Your friend link' }).inputValue();
}

/** Opens someone's friend link as a signed-in member, adds them and lands in the chat. */
export async function addFriend(page: Page, link: string, ownerName: string) {
	await page.goto(link);
	await page.getByRole('button', { name: `Add ${ownerName}` }).click();
	await expect(page.getByRole('heading', { name: ownerName })).toBeVisible();
}

/** Signs up two users and makes them friends through Anna's friend link. */
export async function friends(browser: Browser, viewport?: Viewport) {
	const anna = await newUser(browser, 'Anna', viewport);
	const ben = await newUser(browser, 'Ben', viewport);

	await addFriend(ben.page, await friendLinkOf(anna.page), 'Anna');
	await ben.page.goto('/');
	await expect(ben.page.getByRole('link', { name: 'Anna', exact: true })).toBeVisible();
	await expect(anna.page.getByRole('link', { name: 'Ben', exact: true })).toBeVisible();
	return { anna, ben };
}
