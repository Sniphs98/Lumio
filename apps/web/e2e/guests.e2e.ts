import { expect, test, type Page } from '@playwright/test';
import { E2E_INVITE_CODE, friendLinkOf, joinAsGuest, newUser, uniqueEmail } from './helpers.ts';

const phone = { width: 390, height: 800 };

async function sendInGeneral(page: Page, text: string) {
	await page.goto('/channels');
	await page.getByRole('link', { name: 'general' }).click();
	await page.getByLabel('Message #general').fill(text);
	await page.keyboard.press('Enter');
	await expect(page.getByRole('list', { name: 'Messages' }).getByText(text)).toBeVisible();
}

test('a guest joins with only a name, comes back and turns into a full account', async ({
	browser
}) => {
	const context = await browser.newContext({ viewport: phone });
	const page = await context.newPage();
	const name = `Guest ${Date.now()}`;

	await joinAsGuest(page, `/invite/${E2E_INVITE_CODE}`, name);
	await expect(page).toHaveURL(/\/channels$/);
	const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
	expect(scrollWidth).toBeLessThanOrEqual(phone.width);
	// No account suggestion on the very first visit.
	await expect(page.getByRole('dialog')).toBeHidden();

	const text = `Sent as a guest ${Date.now()}`;
	await sendInGeneral(page, text);

	// The guest session is kept in localStorage, so it survives losing the cookie.
	const stored = await page.evaluate(() => localStorage.getItem('lumio:guest'));
	expect(JSON.parse(stored ?? '{}')).toMatchObject({ name });
	await context.clearCookies();
	await page.goto('/login');
	await page.getByRole('button', { name: `Continue as ${name} (guest)` }).click();
	await expect(page.getByRole('link', { name: 'Guest · Create account' })).toBeVisible();

	// The next visit (a new tab) suggests creating an account.
	const nextVisit = await context.newPage();
	await nextVisit.goto('/');
	const dialog = nextVisit.getByRole('dialog', { name: 'Welcome back! Create an account?' });
	await expect(dialog).toBeVisible();
	await dialog.getByRole('link', { name: 'Create account' }).click();

	await expect(nextVisit.getByRole('heading', { name: 'Create your account' })).toBeVisible();
	await expect(nextVisit.getByLabel('Display name')).toHaveValue(name);
	const email = uniqueEmail('guest');
	await nextVisit.getByLabel('Email').fill(email);
	await nextVisit.getByLabel('Password').fill('correct horse battery');
	await nextVisit.getByRole('button', { name: 'Create account' }).click();
	await expect(nextVisit.getByRole('heading', { name: 'Your account is ready' })).toBeVisible();
	await expect(nextVisit.getByRole('link', { name: 'Guest · Create account' })).toBeHidden();
	expect(await nextVisit.evaluate(() => localStorage.getItem('lumio:guest'))).toBeNull();

	// On another device the same account signs in with email and password, messages included.
	const other = await browser.newPage();
	await other.goto('/login');
	await other.getByLabel('Email').fill(email);
	await other.getByLabel('Password').fill('correct horse battery');
	await other.getByRole('button', { name: 'Sign in' }).click();
	await expect(other.getByRole('link', { name: 'Home' })).toBeVisible();
	await other.goto('/channels');
	await other.getByRole('link', { name: 'general' }).click();
	const message = other.getByRole('listitem').filter({ hasText: text });
	await expect(message).toContainText(name);

	await context.close();
	await other.context().close();
});

test('a newcomer opens a friend link on a phone, joins as a guest and lands in the chat', async ({
	browser
}) => {
	const anna = await newUser(browser, 'Anna');
	const link = await friendLinkOf(anna.page);

	const context = await browser.newContext({ viewport: phone });
	const page = await context.newPage();
	await page.goto(link);
	await expect(page.getByText('Become friends with Anna', { exact: true })).toBeVisible();
	const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
	expect(scrollWidth).toBeLessThanOrEqual(phone.width);

	await joinAsGuest(page, link, 'Ben');
	await expect(page.getByRole('heading', { name: 'Anna' })).toBeVisible();
	await expect(page.getByLabel('Message Anna')).toBeVisible();
	await expect(anna.page.getByRole('link', { name: 'Ben', exact: true })).toBeVisible();

	await anna.context.close();
	await context.close();
});

test('invite links can be limited to people with an account', async ({ browser }) => {
	const anna = await newUser(browser, 'Anna');
	await anna.page.goto('/channels/invites');
	await anna.page.getByRole('checkbox', { name: 'Let people join as a guest' }).click();
	await anna.page.getByRole('button', { name: 'Create invite link' }).click();
	const link = await anna.page.getByLabel('Your new invite link').inputValue();
	await expect(anna.page.getByRole('region', { name: 'Your active invite links' })).toContainText(
		'Accounts only'
	);

	const visitor = await browser.newPage();
	await visitor.goto(link);
	await expect(visitor.getByText('Anna invited you. Create an account to join.')).toBeVisible();
	await expect(visitor.getByRole('tab', { name: 'Join as guest' })).toBeHidden();
	await expect(visitor.getByLabel('Your name')).toBeHidden();

	// The server refuses guests too, even when the form is sent by hand.
	const response = await visitor.request.post(`${new URL(link).pathname}?/guest`, {
		form: { name: 'Sneaky' },
		headers: { origin: new URL(link).origin, 'x-sveltekit-action': 'true' }
	});
	expect(await response.text()).toContain('does not allow guests');

	await anna.context.close();
	await visitor.context().close();
});
