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

test('the emoji picker adds emojis at the caret', async ({ browser }) => {
	const { context, page } = await newUser(browser, 'Erin');
	const input = page.getByLabel('Message #general');

	await input.fill('I like  a lot');
	await input.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(7, 7));
	// No GIF service is configured in tests, so the picker only has emojis.
	await page.getByRole('button', { name: 'Emojis', exact: true }).click();
	await page.getByLabel('Search emojis').fill('pizza');
	await page.getByRole('button', { name: 'pizza', exact: true }).click();
	await page.keyboard.press('Escape');
	await expect(input).toHaveValue('I like 🍕 a lot');
	await expect(input).toBeFocused();

	await input.press('Enter');
	await expect(
		page.getByRole('list', { name: 'Messages' }).getByText('I like 🍕 a lot')
	).toBeVisible();

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

test('voice channels open the same chat with a button', async ({ browser }) => {
	const alice = await newUser(browser, 'Alice');
	const bob = await newUser(browser, 'Bob');

	await alice.page.getByRole('link', { name: 'Lounge' }).click();
	await expect(alice.page.getByRole('heading', { name: 'Lounge', level: 1 })).toBeVisible();
	// The voice view fills the page; the chat opens next to it with the chat button.
	await expect(alice.page.getByRole('button', { name: 'Join voice' })).toBeInViewport();
	const input = alice.page.getByLabel('Message Lounge');
	await expect(input).toBeHidden();
	await alice.page.getByRole('button', { name: 'Show chat' }).click();
	await expect(input).toBeInViewport();
	await expect(alice.page.getByRole('button', { name: 'Join voice' })).toBeInViewport();

	const [voiceBox, chatBox] = await Promise.all([
		alice.page.getByRole('region', { name: 'Voice' }).boundingBox(),
		alice.page.getByRole('region', { name: 'Chat' }).boundingBox()
	]);
	expect(chatBox!.x).toBeGreaterThanOrEqual(voiceBox!.x + voiceBox!.width - 1);

	const text = `Voice chat from Alice ${Date.now()}`;
	await input.fill(text);
	await alice.page.keyboard.press('Enter');
	await expect(alice.page.getByRole('list', { name: 'Messages' }).getByText(text)).toBeVisible();

	// Bob is still in #general: the Lounge counts as unread until he opens it.
	const channels = bob.page.getByRole('complementary', { name: 'Channels' });
	const loungeUnread = channels.getByRole('link', { name: /^Lounge/ }).getByRole('status');
	await expect(loungeUnread).toBeVisible();
	await channels.getByRole('link', { name: /^Lounge/ }).click();
	await expect(bob.page.getByRole('heading', { name: 'Lounge', level: 1 })).toBeVisible();
	await bob.page.getByRole('button', { name: 'Show chat' }).click();
	await expect(bob.page.getByRole('list', { name: 'Messages' }).getByText(text)).toBeVisible();
	await expect(loungeUnread).toBeHidden();

	// Text channels are only a chat, without a join button.
	await channels.getByRole('link', { name: /^general/ }).click();
	await expect(bob.page.getByLabel('Message #general')).toBeVisible();
	await expect(bob.page.getByRole('button', { name: 'Join voice' })).toHaveCount(0);

	await alice.context.close();
	await bob.context.close();
});

test('on a phone the voice channel chat replaces the voice view', async ({ browser }) => {
	const context = await browser.newContext({ viewport: { width: 390, height: 800 } });
	const page = await context.newPage();
	await signUp(page, 'Erin');
	await page.getByRole('navigation', { name: 'Instances' }).getByRole('link').nth(1).click();
	await page.getByRole('link', { name: 'Lounge' }).click();

	await expect(page.getByRole('button', { name: 'Join voice' })).toBeInViewport();
	await page.getByRole('button', { name: 'Show chat' }).click();
	await expect(page.getByLabel('Message Lounge')).toBeInViewport();
	await expect(page.getByRole('button', { name: 'Join voice' })).toBeHidden();
	await page.getByRole('button', { name: 'Hide chat' }).click();
	await expect(page.getByRole('button', { name: 'Join voice' })).toBeInViewport();
	const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
	expect(scrollWidth).toBeLessThanOrEqual(390);
	await context.close();
});
