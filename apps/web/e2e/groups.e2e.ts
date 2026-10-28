import { expect, test, type Browser, type Page } from '@playwright/test';
import { addFriend, friends, newUser } from './helpers.ts';

/** Anna is friends with Ben and Carl; Ben and Carl do not know each other. */
async function threeFriends(browser: Browser, viewport?: { width: number; height: number }) {
	const { anna, ben } = await friends(browser, viewport);
	const carl = await newUser(browser, 'Carl', viewport);
	await addFriend(anna.page, carl.email);
	await carl.page.getByRole('button', { name: 'Accept Anna' }).click();
	await expect(anna.page.getByRole('link', { name: 'Carl', exact: true })).toBeVisible();
	return {
		anna,
		ben,
		carl,
		close: () => Promise.all([anna, ben, carl].map((u) => u.context.close()))
	};
}

function groupsList(page: Page) {
	return page.getByRole('region', { name: 'Groups' });
}

test('create a group, chat in it, rename it and manage its members', async ({ browser }) => {
	const { anna, ben, carl, close } = await threeFriends(browser);
	const name = `Raid night ${Date.now()}`;

	await anna.page.getByRole('link', { name: 'Create group' }).click();
	await anna.page.getByLabel('Name (optional)').fill(name);
	await anna.page.getByRole('checkbox', { name: 'Ben' }).click();
	await anna.page.getByRole('checkbox', { name: 'Carl' }).click();
	await anna.page.getByRole('button', { name: 'Create group' }).click();
	await expect(anna.page.getByRole('heading', { name })).toBeVisible();
	await expect(anna.page.getByRole('button', { name: 'Start call' })).toBeEnabled();

	// The new group shows up for the others without a reload.
	await groupsList(ben.page).getByRole('link', { name }).click();
	await groupsList(carl.page).getByRole('link', { name }).click();
	await expect(carl.page.getByRole('heading', { name })).toBeVisible();

	// Ben and Carl are not friends, but both can write in the group.
	const text = `Hi everyone ${Date.now()}`;
	await ben.page.getByLabel(`Message ${name}`).fill(text);
	await ben.page.keyboard.press('Enter');
	await expect(anna.page.getByRole('list', { name: 'Messages' }).getByText(text)).toBeVisible();
	await expect(carl.page.getByRole('list', { name: 'Messages' }).getByText(text)).toBeVisible();

	// Any member may rename the group; the open chats follow.
	const renamed = `${name} II`;
	await ben.page.getByRole('link', { name: 'Group settings' }).click();
	await ben.page.getByLabel('Group name').fill(renamed);
	await ben.page.getByRole('button', { name: 'Rename' }).click();
	await expect(anna.page.getByRole('heading', { name: renamed })).toBeVisible();
	await expect(groupsList(carl.page).getByRole('link', { name: renamed })).toBeVisible();

	// Only the owner can remove people.
	await expect(ben.page.getByRole('button', { name: 'Remove Carl' })).toHaveCount(0);
	await anna.page.getByRole('link', { name: 'Group settings' }).click();
	await expect(anna.page.getByRole('list', { name: 'Members' })).toContainText('Owner');
	await anna.page.getByRole('button', { name: 'Remove Carl' }).click();
	await expect(anna.page.getByRole('list', { name: 'Members' })).not.toContainText('Carl');

	// Carl had the chat open and is sent back to the start page; the group is gone for him.
	await expect(carl.page).toHaveURL(/\/$/);
	await expect(groupsList(carl.page)).toContainText('No group chats yet.');
	const groupPath = new URL(anna.page.url()).pathname.replace(/\/settings$/, '');
	expect((await carl.page.goto(groupPath))?.status()).toBe(404);

	// Anna adds Carl back, then leaves: Ben becomes the owner.
	await anna.page.getByRole('checkbox', { name: 'Carl' }).click();
	await anna.page.getByRole('button', { name: 'Add to group' }).click();
	await expect(anna.page.getByRole('list', { name: 'Members' })).toContainText('Carl');
	await carl.page.goto('/');
	await expect(groupsList(carl.page).getByRole('link', { name: renamed })).toBeVisible();

	await anna.page.getByRole('button', { name: 'Leave group' }).click();
	await expect(anna.page).toHaveURL(/\/$/);
	await expect(groupsList(anna.page)).toContainText('No group chats yet.');
	await expect(ben.page.getByRole('list', { name: 'Members' })).not.toContainText('Anna');
	await expect(ben.page.getByRole('button', { name: 'Remove Carl' })).toBeVisible();

	await close();
});

test('a group needs at least one friend', async ({ browser }) => {
	const { anna, ben } = await friends(browser);

	await anna.page.getByRole('link', { name: 'Create group' }).click();
	await anna.page.getByRole('button', { name: 'Create group' }).click();
	await expect(anna.page.getByRole('alert')).toHaveText('Pick at least one friend.');

	await anna.context.close();
	await ben.context.close();
});

test('on a phone creating a group and its settings are full screens', async ({ browser }) => {
	const viewport = { width: 390, height: 800 };
	const { anna, ben } = await friends(browser, viewport);
	const { page } = anna;
	const sidebar = page.getByRole('complementary', { name: 'Friends and groups' });

	await page.getByRole('link', { name: 'Create group' }).click();
	await expect(sidebar).toBeHidden();
	await page.getByRole('checkbox', { name: 'Ben' }).click();
	await page.getByRole('button', { name: 'Create group' }).click();
	await expect(page.getByRole('heading', { name: 'Ben' })).toBeVisible();

	await page.getByRole('link', { name: 'Group settings' }).click();
	await expect(sidebar).toBeHidden();
	await expect(page.getByRole('button', { name: 'Leave group' })).toBeVisible();
	const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
	expect(scrollWidth).toBeLessThanOrEqual(390);

	await page.getByRole('link', { name: 'Back to chat' }).click();
	await page.getByRole('link', { name: 'Back to friends' }).click();
	await expect(groupsList(page).getByRole('link', { name: 'Ben' })).toBeVisible();

	await anna.context.close();
	await ben.context.close();
});
