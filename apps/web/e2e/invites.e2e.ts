import { expect, test, type Page } from '@playwright/test';
import { newUser, signUp } from './helpers.ts';

async function openInvites(page: Page) {
	await page.getByRole('navigation', { name: 'Instances' }).getByRole('link').nth(1).click();
	await page.getByRole('link', { name: 'Invite people' }).click();
	await expect(page.getByRole('heading', { name: 'Invite people' })).toBeVisible();
}

async function pickOption(page: Page, label: string, option: string) {
	await page.getByLabel(label).click();
	await page.getByRole('option', { name: option, exact: true }).click();
}

async function createInvite(page: Page, options: { expiry?: string; maxUses?: string } = {}) {
	if (options.expiry) await pickOption(page, 'Expire after', options.expiry);
	if (options.maxUses) await pickOption(page, 'Max number of uses', options.maxUses);
	await page.getByRole('button', { name: 'Create invite link' }).click();
	const link = page.getByLabel('Your new invite link');
	await expect(link).toHaveValue(/\/invite\/\w+$/);
	return new URL(await link.inputValue()).pathname.slice('/invite/'.length);
}

test('a friend joins with a single-use invite link on a phone', async ({ browser }) => {
	const anna = await newUser(browser, 'Anna');
	await openInvites(anna.page);
	const code = await createInvite(anna.page, { expiry: '1 day', maxUses: '1 use' });

	const invites = anna.page.getByRole('region', { name: 'Your active invite links' });
	await expect(invites).toContainText(`/invite/${code}`);
	await expect(invites).toContainText(/0 of 1 used · Expires in (1 day|23 hours)/);

	// The invited friend sees who invited them and lands in the server after signing up.
	const phone = await browser.newContext({ viewport: { width: 390, height: 800 } });
	const ben = await phone.newPage();
	await ben.goto(`/invite/${code}`);
	await expect(ben.getByText('Anna invited you.')).toBeVisible();
	const scrollWidth = await ben.evaluate(() => document.documentElement.scrollWidth);
	expect(scrollWidth).toBeLessThanOrEqual(390);
	await signUp(ben, 'Ben', code);
	await expect(ben).toHaveURL(/\/channels$/);
	await expect(ben.getByRole('link', { name: 'general' })).toBeVisible();

	// Opening the link again while signed in goes straight to the server.
	await ben.goto(`/invite/${code}`);
	await expect(ben).toHaveURL(/\/channels$/);

	// The only use is taken, so the link is gone from the list and cannot be used again.
	await anna.page.reload();
	await expect(invites).not.toContainText(code);
	const late = await browser.newPage();
	await late.goto(`/invite/${code}`);
	await expect(late.getByText('This invite is no longer valid')).toBeVisible();

	await anna.context.close();
	await phone.close();
	await late.context().close();
});

test('a revoked invite link no longer works', async ({ browser }) => {
	const anna = await newUser(browser, 'Anna');
	await openInvites(anna.page);
	const code = await createInvite(anna.page);

	await anna.page.getByRole('button', { name: `Revoke invite link ${code}` }).click();
	await expect(
		anna.page.getByRole('region', { name: 'Your active invite links' })
	).not.toContainText(code);

	const visitor = await browser.newPage();
	await visitor.goto(`/invite/${code}`);
	await expect(visitor.getByText('This invite is no longer valid')).toBeVisible();
	await expect(visitor.getByRole('button', { name: 'Create account and join' })).toBeHidden();

	await anna.context.close();
	await visitor.context().close();
});

test('the invite page works at phone width', async ({ browser }) => {
	const { page, context } = await newUser(browser, 'Cleo', { width: 390, height: 800 });
	await page.getByRole('navigation', { name: 'Instances' }).getByRole('link').nth(1).click();
	await page.getByRole('link', { name: 'Invite people' }).click();

	// The channel list gives way to the full-width invite page.
	await expect(page.getByRole('complementary', { name: 'Channels' })).toBeHidden();
	await createInvite(page);
	const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
	expect(scrollWidth).toBeLessThanOrEqual(390);

	await page.getByRole('link', { name: 'Back to channels' }).click();
	await expect(page.getByRole('link', { name: 'Invite people' })).toBeVisible();

	await context.close();
});
