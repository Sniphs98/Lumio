import { expect, test, type Page } from '@playwright/test';
import { friends, newUser } from './helpers.ts';

function messages(page: Page) {
	return page.getByRole('list', { name: 'Messages' });
}

function messageWith(page: Page, text: string) {
	return messages(page).getByRole('listitem').filter({ hasText: text }).first();
}

async function openChat(page: Page, name: string) {
	await page.getByRole('link', { name }).first().click();
	await expect(page.getByRole('heading', { name })).toBeVisible();
}

test('reactions and replies show up live for both people', async ({ browser }) => {
	const { anna, ben } = await friends(browser);
	await openChat(anna.page, 'Ben');
	await openChat(ben.page, 'Anna');

	await ben.page.getByLabel('Message Anna').fill('Pizza tonight?');
	await ben.page.keyboard.press('Enter');
	const pizza = messageWith(anna.page, 'Pizza tonight?');
	await expect(pizza).toBeVisible();

	// Anna reacts from the message's actions.
	await pizza.hover();
	await pizza.getByRole('button', { name: 'Add reaction' }).click();
	await anna.page.getByRole('menuitem', { name: 'React with 👍' }).click();
	await expect(pizza.getByRole('button', { name: '👍 1' })).toHaveAttribute('aria-pressed', 'true');

	// Ben sees it live and adds his own.
	const benPizza = messageWith(ben.page, 'Pizza tonight?');
	const benThumbs = benPizza.getByRole('button', { name: '👍 1' });
	await expect(benThumbs).toHaveAttribute('aria-pressed', 'false');
	await benThumbs.click();
	await expect(pizza.getByRole('button', { name: '👍 2' })).toBeVisible();

	// Anna replies; the reply quotes Ben's message and counts as mentioning him.
	await pizza.hover();
	await pizza.getByRole('button', { name: 'Reply' }).click();
	await expect(anna.page.getByText('Replying to Ben')).toBeVisible();
	await anna.page.getByLabel('Message Ben').fill('Yes, at eight!');
	await anna.page.keyboard.press('Enter');
	await expect(anna.page.getByText('Replying to Ben')).toBeHidden();

	const reply = messageWith(ben.page, 'Yes, at eight!');
	await expect(reply.getByRole('button', { name: '@Ben Pizza tonight?' })).toBeVisible();
	await expect(reply).toHaveAttribute('data-mentions-me', 'true');
	await expect(messageWith(anna.page, 'Yes, at eight!')).toHaveAttribute(
		'data-mentions-me',
		'false'
	);

	// Everything is stored.
	await ben.page.reload();
	await expect(
		messageWith(ben.page, 'Pizza tonight?').getByRole('button', { name: '👍 2' })
	).toHaveAttribute('aria-pressed', 'true');
	await expect(
		messageWith(ben.page, 'Yes, at eight!').getByRole('button', { name: '@Ben Pizza tonight?' })
	).toBeVisible();

	await anna.context.close();
	await ben.context.close();
});

test('unread direct messages are counted until the chat is opened', async ({ browser }) => {
	const { anna, ben } = await friends(browser);
	await openChat(anna.page, 'Ben');

	for (const text of ['Are you there?', 'Hello?']) {
		await anna.page.getByLabel('Message Ben').fill(text);
		await anna.page.keyboard.press('Enter');
		await expect(messages(anna.page).getByText(text)).toBeVisible();
	}

	// Ben is on the Home tab and sees the count without a reload.
	const sidebar = ben.page.getByRole('complementary', { name: 'Friends and groups' });
	const annaUnread = sidebar.getByRole('link', { name: /^Anna/ }).getByRole('status');
	await expect(annaUnread).toHaveAccessibleName('2 unread messages');
	await expect(
		ben.page.getByRole('navigation', { name: 'Instances' }).getByRole('link', { name: /^Home/ })
	).toContainText('2');

	await openChat(ben.page, 'Anna');
	await expect(messages(ben.page).getByText('Hello?')).toBeVisible();
	await expect(annaUnread).toBeHidden();

	// Still read after a reload, so the server knows too.
	await ben.page.goto('/');
	await expect(sidebar.getByRole('link', { name: /^Anna/ })).toBeVisible();
	await expect(annaUnread).toBeHidden();

	await anna.context.close();
	await ben.context.close();
});

test('mentions are suggested, highlighted and counted', async ({ browser }) => {
	const suffix = Date.now().toString(36);
	const yannName = `Yann${suffix}`;
	const zoe = await newUser(browser, `Zoe${suffix}`);
	const yann = await newUser(browser, yannName);

	await zoe.page.getByRole('navigation', { name: 'Instances' }).getByRole('link').nth(1).click();
	await zoe.page.getByRole('link', { name: 'general' }).click();
	const input = zoe.page.getByLabel('Message #general');

	// Typing @ and part of a name suggests people; Enter picks the highlighted one.
	await input.pressSequentially(`hey @${yannName.toLowerCase()}`);
	const suggestions = zoe.page.getByRole('listbox', { name: 'Mention someone' });
	await expect(suggestions.getByRole('option', { name: yannName })).toBeVisible();
	await input.press('Enter');
	await expect(input).toHaveValue(`hey @${yannName} `);
	await expect(suggestions).toBeHidden();
	await input.pressSequentially('look at this');
	await input.press('Enter');

	const sent = messageWith(zoe.page, `@${yannName}`);
	await expect(sent).toContainText(`hey @${yannName} look at this`);

	// Yann, still on the Home tab, sees a mention on the instance tab and on the channel.
	const instanceTab = yann.page
		.getByRole('navigation', { name: 'Instances' })
		.getByRole('link')
		.nth(1);
	await expect(instanceTab.getByRole('status')).toHaveText(/^@/);
	await instanceTab.click();
	const general = yann.page
		.getByRole('complementary', { name: 'Channels' })
		.getByRole('link', { name: /^general/ });
	await expect(general.getByRole('status')).toHaveText(/^@/);

	await general.click();
	const received = messageWith(yann.page, `@${yannName}`);
	await expect(received).toHaveAttribute('data-mentions-me', 'true');
	await expect(received.getByText(`@${yannName}`)).toBeVisible();
	await expect(general.getByRole('status')).toBeHidden();

	await zoe.context.close();
	await yann.context.close();
});
