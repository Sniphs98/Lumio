import { expect, test, type Browser, type Page } from '@playwright/test';
import { signUp } from './helpers.ts';

async function openGeneral(page: Page) {
	await page.getByRole('navigation', { name: 'Instances' }).getByRole('link').nth(1).click();
	await page.getByRole('link', { name: 'general' }).click();
	await expect(page.getByRole('heading', { name: 'general' })).toBeVisible();
}

async function newUser(browser: Browser, name: string) {
	const context = await browser.newContext();
	const page = await context.newPage();
	await signUp(page, name);
	await openGeneral(page);
	return { context, page };
}

test('messages arrive live in another browser', async ({ browser }) => {
	const alice = await newUser(browser, 'Alice');
	const bob = await newUser(browser, 'Bob');

	const text = `Hello from Alice ${Date.now()}`;
	await alice.page.getByLabel('Message #general').fill(text);
	await alice.page.keyboard.press('Enter');

	// Shown for the sender right away, and for Bob without a reload.
	await expect(alice.page.getByRole('list', { name: 'Messages' }).getByText(text)).toBeVisible();
	await expect(bob.page.getByRole('list', { name: 'Messages' }).getByText(text)).toBeVisible();
	await expect(alice.page.getByLabel('Message #general')).toHaveValue('');

	// The message is stored and still there after a reload.
	await bob.page.reload();
	await expect(bob.page.getByRole('list', { name: 'Messages' }).getByText(text)).toHaveCount(1);

	await alice.context.close();
	await bob.context.close();
});

test('Shift+Enter adds a line break instead of sending', async ({ browser }) => {
	const { context, page } = await newUser(browser, 'Carol');
	const input = page.getByLabel('Message #general');

	await input.fill('first line');
	await input.press('Shift+Enter');
	await input.pressSequentially('second line');
	await expect(input).toHaveValue('first line\nsecond line');

	await context.close();
});

test('on a phone the channel list and the chat are separate screens', async ({ browser }) => {
	const context = await browser.newContext({ viewport: { width: 390, height: 800 } });
	const page = await context.newPage();
	await signUp(page, 'Dana');

	await page.getByRole('navigation', { name: 'Instances' }).getByRole('link').nth(1).click();
	await expect(page.getByRole('complementary', { name: 'Channels' })).toBeVisible();

	await page.getByRole('link', { name: 'general' }).click();
	await expect(page.getByRole('complementary', { name: 'Channels' })).toBeHidden();
	await expect(page.getByLabel('Message #general')).toBeVisible();

	await page.getByRole('link', { name: 'Back to channels' }).click();
	await expect(page.getByRole('complementary', { name: 'Channels' })).toBeVisible();

	const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
	expect(scrollWidth).toBeLessThanOrEqual(390);
	await context.close();
});

test('voice channels have the same chat as text channels', async ({ browser }) => {
	const alice = await newUser(browser, 'Alice');
	const bob = await newUser(browser, 'Bob');

	await alice.page.getByRole('link', { name: 'Lounge' }).click();
	await expect(alice.page.getByRole('heading', { name: 'Lounge', level: 1 })).toBeVisible();
	// Joining is offered on top of the chat, but not needed to write.
	await expect(alice.page.getByRole('button', { name: 'Join voice' })).toBeVisible();

	const text = `Voice chat from Alice ${Date.now()}`;
	await alice.page.getByLabel('Message Lounge').fill(text);
	await alice.page.keyboard.press('Enter');
	await expect(alice.page.getByRole('list', { name: 'Messages' }).getByText(text)).toBeVisible();

	// Bob is still in #general: the Lounge counts as unread until he opens it.
	const channels = bob.page.getByRole('complementary', { name: 'Channels' });
	const loungeUnread = channels.getByRole('link', { name: /^Lounge/ }).getByRole('status');
	await expect(loungeUnread).toBeVisible();

	await channels.getByRole('link', { name: /^Lounge/ }).click();
	await expect(bob.page.getByRole('list', { name: 'Messages' }).getByText(text)).toBeVisible();
	await expect(loungeUnread).toBeHidden();

	// Text channels have no join button.
	await channels.getByRole('link', { name: /^general/ }).click();
	await expect(bob.page.getByLabel('Message #general')).toBeVisible();
	await expect(bob.page.getByRole('button', { name: 'Join voice' })).toHaveCount(0);

	await alice.context.close();
	await bob.context.close();
});
