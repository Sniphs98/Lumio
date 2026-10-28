import { expect, test } from '@playwright/test';
import { friendLinkOf, friends, newUser } from './helpers.ts';

test('opening a friend link makes both users friends right away', async ({ browser }) => {
	const anna = await newUser(browser, 'Anna');
	const ben = await newUser(browser, 'Ben');

	const link = await friendLinkOf(anna.page);
	expect(new URL(link).pathname).toMatch(/^\/add\/\w+$/);
	await ben.page.goto(link);
	await expect(ben.page.getByText('Add Anna as a friend', { exact: true })).toBeVisible();
	await ben.page.getByRole('button', { name: 'Add Anna' }).click();

	// Ben lands in the chat with Anna; Anna's list updates without a reload.
	await expect(ben.page.getByRole('heading', { name: 'Anna' })).toBeVisible();
	await expect(ben.page.getByLabel('Message Anna')).toBeVisible();
	await expect(anna.page.getByRole('link', { name: 'Ben', exact: true })).toBeVisible();

	// Opening the link again goes straight to the chat.
	await ben.page.goto(link);
	await expect(ben.page.getByRole('heading', { name: 'Anna' })).toBeVisible();

	await anna.context.close();
	await ben.context.close();
});

test('your own friend link is explained, and a reset link stops working', async ({ browser }) => {
	const anna = await newUser(browser, 'Anna');
	const oldLink = await friendLinkOf(anna.page);

	await anna.page.goto(oldLink);
	await expect(anna.page.getByText('This is your friend link', { exact: true })).toBeVisible();

	await anna.page.goto('/');
	await anna.page.getByRole('button', { name: 'Reset friend link' }).click();
	await expect(
		anna.page.getByText('New friend link created. The old one no longer works.')
	).toBeVisible();
	const newLink = await friendLinkOf(anna.page);
	expect(newLink).not.toBe(oldLink);

	const visitor = await browser.newPage();
	await visitor.goto(oldLink);
	await expect(
		visitor.getByText('This friend link is no longer valid', { exact: true })
	).toBeVisible();

	await anna.context.close();
	await visitor.context().close();
});

test('clicking a friend opens the direct messages with live updates', async ({ browser }) => {
	const { anna, ben } = await friends(browser);

	await anna.page.getByRole('link', { name: 'Ben', exact: true }).click();
	await expect(anna.page.getByRole('heading', { name: 'Ben' })).toBeVisible();
	await expect(anna.page.getByRole('button', { name: 'Start call' })).toBeVisible();

	await ben.page.getByRole('link', { name: 'Anna', exact: true }).click();
	await expect(ben.page.getByRole('heading', { name: 'Anna' })).toBeVisible();
	// Both land in the same conversation.
	expect(new URL(ben.page.url()).pathname).toBe(new URL(anna.page.url()).pathname);

	const text = `Hi Ben ${Date.now()}`;
	await anna.page.getByLabel('Message Ben').fill(text);
	await anna.page.keyboard.press('Enter');
	await expect(ben.page.getByRole('list', { name: 'Messages' }).getByText(text)).toBeVisible();

	await ben.page.reload();
	await expect(ben.page.getByRole('list', { name: 'Messages' }).getByText(text)).toHaveCount(1);

	await anna.context.close();
	await ben.context.close();
});

test('other users cannot open a direct conversation', async ({ browser }) => {
	const { anna, ben } = await friends(browser);
	await anna.page.getByRole('link', { name: 'Ben', exact: true }).click();
	await expect(anna.page.getByRole('heading', { name: 'Ben' })).toBeVisible();
	const dmPath = new URL(anna.page.url()).pathname;

	const carl = await newUser(browser, 'Carl');
	const response = await carl.page.goto(dmPath);
	expect(response?.status()).toBe(404);
	const events = await carl.page.request.get(
		`/api/conversations${dmPath.slice('/dm'.length)}/events`
	);
	expect(events.status()).toBe(404);

	await anna.context.close();
	await ben.context.close();
	await carl.context.close();
});

test('on a phone the friend list and the chat are separate screens', async ({ browser }) => {
	const viewport = { width: 390, height: 800 };
	const { anna, ben } = await friends(browser, viewport);
	const { page } = anna;

	await page.getByRole('link', { name: 'Ben', exact: true }).click();
	await expect(page.getByRole('complementary', { name: 'Friends and groups' })).toBeHidden();
	await expect(page.getByLabel('Message Ben')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Start call' })).toBeVisible();

	await page.getByRole('link', { name: 'Back to friends' }).click();
	await expect(page.getByRole('complementary', { name: 'Friends and groups' })).toBeVisible();

	const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
	expect(scrollWidth).toBeLessThanOrEqual(390);

	await anna.context.close();
	await ben.context.close();
});
