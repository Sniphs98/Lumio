import { expect, test } from '@playwright/test';
import { addFriend, friends, newUser } from './helpers.ts';

test('a friend request shows up live and can be accepted', async ({ browser }) => {
	const anna = await newUser(browser, 'Anna');
	const ben = await newUser(browser, 'Ben');

	await addFriend(anna.page, ben.email);
	await expect(anna.page.getByRole('region', { name: 'Sent requests' })).toContainText('Ben');

	// Ben sees the request without reloading, and accepting it updates Anna's list too.
	await ben.page.getByRole('button', { name: 'Accept Anna' }).click();
	await expect(ben.page.getByRole('link', { name: 'Anna', exact: true })).toBeVisible();
	await expect(anna.page.getByRole('link', { name: 'Ben', exact: true })).toBeVisible();
	await expect(anna.page.getByRole('region', { name: 'Sent requests' })).toBeHidden();

	await anna.context.close();
	await ben.context.close();
});

test('adding yourself or an unknown email shows an error', async ({ browser }) => {
	const anna = await newUser(browser, 'Anna');

	await addFriend(anna.page, anna.email);
	await expect(anna.page.getByRole('alert')).toHaveText('You cannot add yourself.');

	await addFriend(anna.page, `nobody-${Date.now()}@example.com`);
	await expect(anna.page.getByRole('alert')).toHaveText(
		'Nobody on this Lumio uses that email address.'
	);

	await anna.context.close();
});

test('a declined request disappears for both users', async ({ browser }) => {
	const anna = await newUser(browser, 'Anna');
	const ben = await newUser(browser, 'Ben');

	await addFriend(anna.page, ben.email);
	await ben.page.getByRole('button', { name: 'Decline Anna' }).click();

	await expect(ben.page.getByRole('region', { name: 'Friend requests' })).toBeHidden();
	await expect(anna.page.getByRole('region', { name: 'Sent requests' })).toBeHidden();
	await expect(anna.page.getByText('No friends added yet.')).toBeVisible();

	await anna.context.close();
	await ben.context.close();
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
