import { expect, test, type Browser, type Page } from '@playwright/test';
import postgres from 'postgres';
import { friends, newUser } from './helpers.ts';

// The upload limit is a server-wide setting that one test changes, so run these one by one.
test.describe.configure({ mode: 'serial' });

// A 1×1 transparent PNG.
const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
	'base64'
);

async function openGeneral(page: Page) {
	await page.getByRole('navigation', { name: 'Instances' }).getByRole('link').nth(1).click();
	await page.getByRole('link', { name: 'general' }).click();
	await expect(page.getByRole('heading', { name: 'general' })).toBeVisible();
}

async function userInGeneral(browser: Browser, name: string) {
	const user = await newUser(browser, name);
	await openGeneral(user.page);
	return user;
}

/** Picks a file in the composer and waits until it is uploaded. */
async function attach(page: Page, file: { name: string; mimeType: string; buffer: Buffer }) {
	await page.getByLabel('Choose files').setInputFiles(file);
	const pending = page.getByRole('list', { name: 'Files to send' }).getByRole('listitem', {
		name: file.name
	});
	await expect(pending).toBeVisible();
	await expect(pending.getByRole('progressbar')).toHaveCount(0, { timeout: 60_000 });
	await expect(pending).not.toContainText('failed');
}

test('an image shared in a channel shows up live for others', async ({ browser }) => {
	const alice = await userInGeneral(browser, 'Alice');
	const bob = await userInGeneral(browser, 'Bob');

	const name = `cat-${Date.now()}.png`;
	await attach(alice.page, { name, mimeType: 'image/png', buffer: PNG });
	await alice.page.getByLabel('Message #general').fill('Look at this');
	await alice.page.getByRole('button', { name: 'Send' }).click();
	await expect(alice.page.getByRole('list', { name: 'Files to send' })).toHaveCount(0);

	const image = bob.page.getByRole('list', { name: 'Messages' }).getByRole('img', { name });
	await expect(image).toBeVisible();
	await expect(image).toHaveJSProperty('naturalWidth', 1);

	// Members can download it, signed-out visitors cannot.
	const src = (await image.getAttribute('src'))!;
	const response = await bob.page.request.get(src);
	expect(response.status()).toBe(200);
	expect(response.headers()['content-type']).toBe('image/png');
	expect(Buffer.from(await response.body())).toEqual(PNG);
	// Only the uploader may resume or inspect an upload.
	const uploadUrl = `/api/uploads/${src.split('/')[3]}`;
	const tusHeaders = { 'Tus-Resumable': '1.0.0' };
	expect((await alice.page.request.head(uploadUrl, { headers: tusHeaders })).status()).toBe(200);
	expect((await bob.page.request.head(uploadUrl, { headers: tusHeaders })).status()).toBe(404);
	const anonymous = await browser.newContext();
	expect((await anonymous.request.get(new URL(src, bob.page.url()).href)).status()).toBe(401);

	await anonymous.close();
	await alice.context.close();
	await bob.context.close();
});

test('a large file is sent in pieces in a direct message on a phone', async ({ browser }) => {
	const phone = { width: 390, height: 800 };
	const { anna, ben } = await friends(browser, phone);
	await anna.page.getByRole('link', { name: 'Ben', exact: true }).click();
	await ben.page.getByRole('link', { name: 'Anna', exact: true }).click();

	// 20 MB: more than two upload pieces.
	const size = 20 * 1024 ** 2;
	const buffer = Buffer.alloc(size, 7);
	buffer.write('end', size - 3);
	await attach(anna.page, { name: 'holiday.bin', mimeType: 'application/octet-stream', buffer });
	await anna.page.getByRole('button', { name: 'Send' }).click();

	const download = ben.page.getByRole('link', { name: 'Download holiday.bin' });
	await expect(download).toContainText('20 MB');
	const scrollWidth = await ben.page.evaluate(() => document.documentElement.scrollWidth);
	expect(scrollWidth).toBeLessThanOrEqual(phone.width);

	// Downloads can resume: a range request returns just that part.
	const href = (await download.getAttribute('href'))!;
	const tail = await ben.page.request.get(href, { headers: { Range: `bytes=${size - 3}-` } });
	expect(tail.status()).toBe(206);
	expect(tail.headers()['content-range']).toBe(`bytes ${size - 3}-${size - 1}/${size}`);
	expect(await tail.text()).toBe('end');
	expect(tail.headers()['content-disposition']).toMatch(/^attachment;/);

	await anna.context.close();
	await ben.context.close();
});

test('the server owner limits the file size', async ({ browser }) => {
	const admin = await newUser(browser, 'Admin');
	// Members with "Manage server" may change the settings; give this user a role with it.
	const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
	try {
		const [role] = await sql`
			insert into role (name, position, permissions) values ('Admin', 1, ${1 << 2})
			returning id
		`;
		await sql`
			insert into user_role (user_id, role_id)
			select id, ${role.id} from "user" where email = ${admin.email}
		`;
	} finally {
		await sql.end();
	}

	await admin.page.getByRole('navigation', { name: 'Instances' }).getByRole('link').nth(1).click();
	await admin.page.getByRole('link', { name: 'Server settings' }).click();
	const limit = admin.page.getByLabel('Largest file (MB)');
	await expect(limit).toHaveValue('2048');

	try {
		await limit.fill('1');
		await admin.page.getByRole('button', { name: 'Save' }).click();
		await expect(admin.page.getByRole('status')).toHaveText('Saved.');

		await admin.page.getByRole('link', { name: 'general' }).click();
		await admin.page.getByLabel('Choose files').setInputFiles({
			name: 'too-big.bin',
			mimeType: 'application/octet-stream',
			buffer: Buffer.alloc(2 * 1024 ** 2)
		});
		await expect(admin.page.getByRole('alert')).toHaveText('too-big.bin is larger than 1 MB.');
		await expect(admin.page.getByRole('list', { name: 'Files to send' })).toHaveCount(0);
	} finally {
		await admin.page.getByRole('link', { name: 'Server settings' }).click();
		await limit.fill('2048');
		await admin.page.getByRole('button', { name: 'Save' }).click();
		await expect(admin.page.getByRole('status')).toHaveText('Saved.');
	}

	// Members without the permission do not see the settings.
	const member = await newUser(browser, 'Member');
	await member.page.getByRole('navigation', { name: 'Instances' }).getByRole('link').nth(1).click();
	await expect(member.page.getByRole('link', { name: 'general' })).toBeVisible();
	await expect(member.page.getByRole('link', { name: 'Server settings' })).toHaveCount(0);
	expect((await member.page.goto('/channels/settings'))?.status()).toBe(403);

	await admin.context.close();
	await member.context.close();
});
