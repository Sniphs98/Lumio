import { expect, test, type Page } from '@playwright/test';
import {
	E2E_INVITE_CODE,
	grantPermissions,
	joinAsGuest,
	newUser,
	withDatabase
} from './helpers.ts';

// Bits from `#lib/permissions.ts`.
const MANAGE_SERVER = 1n << 2n;
const KICK_MEMBERS = 1n << 6n;
const BAN_MEMBERS = 1n << 7n;
const MANAGE_MESSAGES = 1n << 9n;

async function openGeneral(page: Page) {
	await page.goto('/channels');
	await page.getByRole('link', { name: 'general' }).click();
	await expect(page.getByRole('heading', { name: 'general' })).toBeVisible();
}

async function send(page: Page, text: string) {
	await page.getByLabel('Message #general').fill(text);
	await page.keyboard.press('Enter');
	await expect(page.getByRole('list', { name: 'Messages' }).getByText(text)).toBeVisible();
}

function messageWith(page: Page, text: string) {
	return page.getByRole('listitem').filter({ hasText: text });
}

// Both tests below change server-wide settings, so they must not run at the same time.
test.describe.configure({ mode: 'serial' });

test('guests can only invite people on a public server', async ({ browser }) => {
	const admin = await newUser(browser, 'Admin');
	await grantPermissions(admin.email, MANAGE_SERVER);

	const guestContext = await browser.newContext();
	const guest = await guestContext.newPage();
	await joinAsGuest(guest, `/invite/${E2E_INVITE_CODE}`, `Guest ${Date.now()}`);

	// Private by default: no invite links for guests, also not by hand.
	await expect(guest.getByRole('link', { name: 'Invite people' })).toBeHidden();
	expect((await guest.goto('/channels/invites'))?.status()).toBe(403);

	await admin.page.goto('/channels/settings');
	const access = admin.page.getByRole('region', { name: 'Who can invite people' });
	try {
		await access.getByRole('switch', { name: 'Public server' }).click();
		await access.getByRole('button', { name: 'Save' }).click();
		await expect(access.getByRole('status')).toHaveText('Saved.');

		await guest.goto('/channels');
		await expect(guest.getByRole('link', { name: 'Invite people' })).toBeVisible();
	} finally {
		await withDatabase((sql) => sql`update instance set is_public = false`);
	}

	await admin.context.close();
	await guestContext.close();
});

test('the server settings rename the server', async ({ browser }) => {
	const admin = await newUser(browser, 'Admin');
	await grantPermissions(admin.email, MANAGE_SERVER);
	const [{ name: before }] = await withDatabase((sql) => sql`select name from instance`);

	await admin.page.goto('/channels');
	await admin.page.getByRole('button', { name: 'Server settings' }).click();
	const settings = admin.page.getByRole('dialog', { name: 'Server settings' });
	const overview = settings.getByRole('region', { name: 'Server name' });
	await expect(overview.getByLabel('Name', { exact: true })).toHaveValue(before);
	const renamed = `Game night ${Date.now()}`;
	try {
		await overview.getByLabel('Name', { exact: true }).fill(renamed);
		await overview.getByRole('button', { name: 'Save' }).click();
		await expect(overview.getByRole('status')).toHaveText('Saved.');
		await expect(
			admin.page.getByRole('navigation', { name: 'Instances' }).getByRole('link').nth(1)
		).toHaveText(renamed);
	} finally {
		await withDatabase((sql) => sql`update instance set name = ${before}`);
	}

	await admin.context.close();
});

test('guests are stopped when their storage is full', async ({ browser }) => {
	const guestContext = await browser.newContext();
	const guest = await guestContext.newPage();
	await joinAsGuest(guest, `/invite/${E2E_INVITE_CODE}`, `Guest ${Date.now()}`);

	// The settings page accepts 100 MB at least; a tiny limit keeps the test fast.
	await withDatabase((sql) => sql`update instance set guest_upload_quota = ${1024 ** 2}`);
	try {
		await openGeneral(guest);
		await guest.getByLabel('Choose files').setInputFiles({
			name: 'big.bin',
			mimeType: 'application/octet-stream',
			buffer: Buffer.alloc(2 * 1024 ** 2)
		});
		await expect(guest.getByRole('list', { name: 'Files to send' })).toContainText(
			'Delete messages with files you sent to free up space.'
		);
	} finally {
		await withDatabase((sql) => sql`update instance set guest_upload_quota = ${1024 ** 3}`);
	}

	await guestContext.close();
});

test('a moderator bans a member, who is signed out and cannot come back until unbanned', async ({
	browser
}) => {
	const moderator = await newUser(browser, 'Moderator');
	await grantPermissions(moderator.email, KICK_MEMBERS | BAN_MEMBERS);
	const name = `Troll ${Date.now()}`;
	const troll = await newUser(browser, name);
	await openGeneral(troll.page);

	await moderator.page.goto('/channels/members');
	const row = moderator.page.getByRole('listitem').filter({ hasText: name });
	await row.getByRole('button', { name: 'Ban' }).click();
	const dialog = moderator.page.getByRole('alertdialog', { name: `Ban ${name}?` });
	await dialog.getByLabel('Reason (optional)').fill('Spam');
	await dialog.getByRole('button', { name: 'Ban' }).click();
	// Unread badges are statuses too, so the result is picked by its text.
	await expect(
		moderator.page.getByRole('status').filter({ hasText: 'Banned and signed out everywhere.' })
	).toBeVisible();
	// Bans are lifted in the server settings, which moderators see with just the bans.
	await moderator.page.getByRole('button', { name: 'Server settings' }).click();
	const settings = moderator.page.getByRole('dialog', { name: 'Server settings' });
	await expect(settings.getByRole('heading', { name: 'Bans' })).toBeVisible();
	await expect(settings.getByRole('button', { name: 'Overview' })).toHaveCount(0);
	await expect(
		settings.getByRole('region', { name: 'Banned' }).getByRole('listitem')
	).toContainText([name]);

	// The open page notices right away and ends on the login page.
	await expect(troll.page).toHaveURL(/\/login/);
	await troll.page.getByLabel('Email').fill(troll.email);
	await troll.page.getByLabel('Password').fill('correct horse battery');
	await troll.page.getByRole('button', { name: 'Sign in' }).click();
	await expect(troll.page.getByText('You are banned from this Lumio.')).toBeVisible();

	await settings
		.getByRole('region', { name: 'Banned' })
		.getByRole('listitem')
		.filter({ hasText: name })
		.getByRole('button', { name: 'Unban' })
		.click();
	await expect(settings.getByRole('status')).toHaveText('The ban was lifted.');
	await expect(settings.getByText('Nobody is banned.')).toBeVisible();
	await troll.page.getByRole('button', { name: 'Sign in' }).click();
	await expect(troll.page.getByRole('link', { name: 'Home' })).toBeVisible();

	await moderator.context.close();
	await troll.context.close();
});

test('a moderator kicks someone from the chat by right-clicking their name', async ({
	browser
}) => {
	const moderator = await newUser(browser, 'Moderator');
	await grantPermissions(moderator.email, KICK_MEMBERS);
	const name = `Spammer ${Date.now()}`;
	const spammer = await newUser(browser, name);
	await openGeneral(spammer.page);
	const text = `Buy now ${Date.now()}`;
	await send(spammer.page, text);

	// Loaded after the grant, so the menu knows the moderator may kick.
	await openGeneral(moderator.page);
	await messageWith(moderator.page, text).getByText(name).click({ button: 'right' });
	const menu = moderator.page.getByRole('menu');
	await expect(menu.getByRole('menuitem', { name: 'Mention' })).toBeVisible();
	await expect(menu.getByRole('menuitem', { name: 'Ban' })).toHaveCount(0);
	await menu.getByRole('menuitem', { name: 'Kick' }).click();
	const dialog = moderator.page.getByRole('alertdialog', { name: `Kick ${name}?` });
	await dialog.getByRole('button', { name: 'Kick' }).click();
	await expect(dialog).toBeHidden();

	await expect(spammer.page).toHaveURL(/\/login/);
	await moderator.context.close();
	await spammer.context.close();
});

test('right-clicking a message author mentions them', async ({ browser }) => {
	const anna = await newUser(browser, 'Anna');
	const name = `Ben ${Date.now()}`;
	const ben = await newUser(browser, name);
	await openGeneral(anna.page);
	await openGeneral(ben.page);
	const text = `Hello ${Date.now()}`;
	await send(ben.page, text);

	await messageWith(anna.page, text).getByText(name).click({ button: 'right' });
	await expect(anna.page.getByRole('menuitem', { name: 'Kick' })).toHaveCount(0);
	await anna.page.getByRole('menuitem', { name: 'Mention' }).click();
	await expect(anna.page.getByLabel('Message #general')).toHaveValue(`@${name} `);
	const welcome = `welcome ${Date.now()}`;
	await anna.page.keyboard.type(welcome);
	await anna.page.keyboard.press('Enter');
	await expect(messageWith(ben.page, welcome)).toHaveAttribute('data-mentions-me', 'true');

	await anna.context.close();
	await ben.context.close();
});

test('the owner cannot be kicked and members cannot moderate', async ({ browser }) => {
	const member = await newUser(browser, 'Member');
	await member.page.goto('/channels/members');
	await expect(
		member.page.getByRole('listitem').filter({ hasText: 'Owner' }).first()
	).toBeVisible();
	await expect(member.page.getByRole('button', { name: 'Kick' })).toHaveCount(0);
	await expect(member.page.getByRole('button', { name: 'Ban' })).toHaveCount(0);
	await member.context.close();
});

test('people delete their own messages, moderators anyone’s', async ({ browser }) => {
	const anna = await newUser(browser, 'Anna');
	const ben = await newUser(browser, 'Ben');
	const mod = await newUser(browser, 'Mod');
	await grantPermissions(mod.email, MANAGE_MESSAGES);
	await openGeneral(anna.page);
	await openGeneral(ben.page);
	await openGeneral(mod.page);

	const first = `Delete me ${Date.now()}`;
	await send(anna.page, first);
	await expect(messageWith(ben.page, first)).toBeVisible();

	// Ben cannot delete Anna's message; Anna can, and it disappears for Ben too.
	await expect(
		messageWith(ben.page, first).getByRole('button', { name: 'Delete message' })
	).toHaveCount(0);
	await messageWith(anna.page, first).hover();
	await messageWith(anna.page, first).getByRole('button', { name: 'Delete message' }).click();
	await anna.page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
	await expect(messageWith(anna.page, first)).toHaveCount(0);
	await expect(messageWith(ben.page, first)).toHaveCount(0);

	const second = `Off topic ${Date.now()}`;
	await send(ben.page, second);
	await expect(messageWith(mod.page, second)).toBeVisible();
	await messageWith(mod.page, second).hover();
	await messageWith(mod.page, second).getByRole('button', { name: 'Delete message' }).click();
	await mod.page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
	await expect(messageWith(ben.page, second)).toHaveCount(0);

	await ben.page.reload();
	await expect(messageWith(ben.page, second)).toHaveCount(0);

	await anna.context.close();
	await ben.context.close();
	await mod.context.close();
});

test('a guest is warned before signing out', async ({ browser }) => {
	const context = await browser.newContext();
	const page = await context.newPage();
	await joinAsGuest(page, `/invite/${E2E_INVITE_CODE}`, `Guest ${Date.now()}`);
	await page.goto('/account');
	await page.getByRole('button', { name: 'Sign out' }).click();
	const dialog = page.getByRole('alertdialog', { name: 'Sign out and lose this guest account?' });
	await dialog.getByRole('button', { name: 'Sign out anyway' }).click();
	await expect(page).toHaveURL(/\/login$/);
	expect(await page.evaluate(() => localStorage.getItem('lumio:guest'))).toBeNull();
	await context.close();
});
