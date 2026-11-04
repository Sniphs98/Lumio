import { expect, test, type Page } from '@playwright/test';
import { friends, grantPermissions, newUser } from './helpers.ts';

/** A 4×2 PNG: the browser crops it to a 2×2 square before uploading. */
const png = {
	name: 'photo.png',
	mimeType: 'image/png',
	buffer: Buffer.from(
		'iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAIAAADwyuo0AAAAEElEQVR4nGOwbvoGRwzIHACq+g2Z2ahgEAAAAABJRU5ErkJggg==',
		'base64'
	)
};

async function uploadProfilePicture(page: Page) {
	await page.goto('/account');
	const card = page.getByRole('region', { name: 'Profile picture' });
	await card.getByLabel('Choose a profile picture').setInputFiles(png);
	await expect(card.getByRole('button', { name: 'Change picture' })).toBeVisible();
	return card;
}

test('a profile picture shows up in the user panel and next to messages', async ({ browser }) => {
	const anna = await newUser(browser, 'Anna');
	const ben = await newUser(browser, 'Ben');

	const card = await uploadProfilePicture(anna.page);
	await expect(card.locator('img')).toHaveAttribute('src', /^\/api\/images\//);
	await anna.page.goto('/');
	const panel = anna.page.getByRole('region', { name: 'You' }).locator('img');
	await expect(panel).toHaveAttribute('src', /^\/api\/images\/[0-9a-f-]{36}$/);
	const src = (await panel.getAttribute('src'))!;

	// Scaled and cropped in the browser, served as a square WebP.
	const response = await anna.page.request.get(src);
	expect(response.status()).toBe(200);
	expect(response.headers()['content-type']).toBe('image/webp');
	expect(response.headers()['x-content-type-options']).toBe('nosniff');
	expect(
		await panel.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])
	).toEqual([2, 2]);

	// Only signed-in users can load pictures.
	const anonymous = await browser.newContext();
	expect((await anonymous.request.get(`http://localhost:4173${src}`)).status()).toBe(401);
	await anonymous.close();

	// Others see it next to Anna's messages.
	await anna.page.goto('/channels');
	await anna.page.getByRole('link', { name: 'general' }).click();
	const text = `Look at my picture ${Date.now()}`;
	await anna.page.getByLabel('Message #general').fill(text);
	await anna.page.keyboard.press('Enter');
	await ben.page.goto('/channels');
	await ben.page.getByRole('link', { name: 'general' }).click();
	const message = ben.page.getByRole('listitem').filter({ hasText: text });
	await expect(message.locator('img')).toHaveAttribute('src', src);

	// Removing it deletes the file and brings back the letter.
	await anna.page.goto('/account');
	await card.getByRole('button', { name: 'Remove profile picture' }).click();
	await expect(card.getByRole('button', { name: 'Upload picture' })).toBeVisible();
	await expect(anna.page.getByRole('region', { name: 'You' }).locator('img')).toHaveCount(0);
	expect((await anna.page.request.get(src)).status()).toBe(404);

	await anna.context.close();
	await ben.context.close();
});

test('files that are not pictures are refused', async ({ browser }) => {
	const { page, context } = await newUser(browser, 'Cleo');
	await page.goto('/account');
	const card = page.getByRole('region', { name: 'Profile picture' });
	await card.getByLabel('Choose a profile picture').setInputFiles({
		name: 'evil.png',
		mimeType: 'image/png',
		buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
	});
	await expect(card.getByRole('alert')).toHaveText('Pick a PNG, JPEG, GIF or WebP picture.');
	await expect(card.getByRole('button', { name: 'Upload picture' })).toBeVisible();
	await context.close();
});

test('the server icon shows on the server tab', async ({ browser }) => {
	const { page, context, email } = await newUser(browser, 'Dana');
	// Manage server
	await grantPermissions(email, 1n << 2n);
	await page.goto('/channels');
	await page.getByRole('button', { name: 'Server settings' }).click();

	const dialog = page.getByRole('dialog', { name: 'Server settings' });
	const card = dialog.getByRole('region', { name: 'Server icon' });
	await card.getByLabel('Choose a server icon').setInputFiles(png);
	await expect(card.getByRole('button', { name: 'Change picture' })).toBeVisible();

	const tabs = page.getByRole('navigation', { name: 'Instances' });
	await expect(tabs.getByRole('link').nth(1).locator('img')).toHaveAttribute(
		'src',
		/^\/api\/images\//
	);

	// Put things back for the other tests.
	await card.getByRole('button', { name: 'Remove server icon' }).click();
	await expect(tabs.getByRole('link').nth(1).locator('img')).toHaveCount(0);
	await context.close();
});

test('every group member can set the group picture', async ({ browser }) => {
	const { anna, ben } = await friends(browser);
	const name = `Picture group ${Date.now()}`;
	await anna.page.getByRole('link', { name: 'Create group' }).click();
	await anna.page.getByLabel('Name (optional)').fill(name);
	await anna.page.getByRole('checkbox', { name: 'Ben' }).click();
	await anna.page.getByRole('button', { name: 'Create group' }).click();
	await expect(anna.page.getByRole('heading', { name })).toBeVisible();

	const groups = ben.page.getByRole('region', { name: 'Groups' });
	await groups.getByRole('link', { name }).click();
	await ben.page.getByRole('link', { name: 'Group settings' }).click();
	const card = ben.page.getByRole('region', { name: 'Picture' });
	await card.getByLabel('Choose a group picture').setInputFiles(png);
	await expect(card.getByRole('button', { name: 'Change picture' })).toBeVisible();

	// Anna sees it in her group list without a reload.
	await expect(
		anna.page.getByRole('region', { name: 'Groups' }).getByRole('link', { name }).locator('img')
	).toHaveAttribute('src', /^\/api\/images\//);

	await anna.context.close();
	await ben.context.close();
});
