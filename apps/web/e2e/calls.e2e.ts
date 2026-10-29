import { expect, test, type Page } from '@playwright/test';
import { friends, newUser } from './helpers.ts';

// Calls connect to the LiveKit server from docker-compose.dev.yml. CI always runs it;
// locally the tests that need it are skipped when it is not running.
const livekitHttp = (process.env.LIVEKIT_URL ?? 'ws://localhost:7880').replace(/^ws/, 'http');
async function livekitRunning() {
	if (process.env.CI) return true;
	return fetch(livekitHttp, { signal: AbortSignal.timeout(1000) }).then(
		(res) => res.ok,
		() => false
	);
}

async function openDm(page: Page, name: string) {
	await page.getByRole('link', { name, exact: true }).click();
	await expect(page.getByRole('heading', { name })).toBeVisible();
	return new URL(page.url()).pathname.slice('/dm/'.length);
}

async function openLounge(page: Page) {
	await page.getByRole('navigation', { name: 'Instances' }).getByRole('link').nth(1).click();
	await page.getByRole('link', { name: 'Lounge' }).click();
	await expect(page.getByRole('heading', { name: 'Lounge', level: 1 })).toBeVisible();
	return new URL(page.url()).pathname.slice('/channels/'.length);
}

const tokenFor = (page: Page, room: unknown) =>
	page.request.post('/api/livekit/token', { data: { room } });

test('call tokens are only issued to members of the call', async ({ browser }) => {
	const { anna, ben } = await friends(browser);
	const dmId = await openDm(anna.page, 'Ben');
	const carl = await newUser(browser, 'Carl');

	const res = await tokenFor(anna.page, `conversation:${dmId}`);
	expect(res.status()).toBe(200);
	const body = await res.json();
	expect(body.token).toEqual(expect.any(String));
	expect(body.sources).toContain('screen_share');

	expect((await tokenFor(carl.page, `conversation:${dmId}`)).status()).toBe(404);
	expect((await tokenFor(carl.page, 'general')).status()).toBe(400);

	// Everyone may join the default voice channel, but text channels are not calls.
	const loungeId = await openLounge(carl.page);
	expect((await tokenFor(carl.page, `channel:${loungeId}`)).status()).toBe(200);
	await carl.page.getByRole('link', { name: 'general' }).click();
	await expect(carl.page.getByRole('heading', { name: 'general' })).toBeVisible();
	const generalId = new URL(carl.page.url()).pathname.slice('/channels/'.length);
	expect((await tokenFor(carl.page, `channel:${generalId}`)).status()).toBe(404);

	await anna.context.close();
	await ben.context.close();
	await carl.context.close();
});

test('joining a direct call rings the friend on any tab', async ({ browser }) => {
	const { anna, ben } = await friends(browser);
	const dmId = await openDm(anna.page, 'Ben');
	// Ben is somewhere else in the app.
	await openLounge(ben.page);

	await tokenFor(anna.page, `conversation:${dmId}`);
	const ringing = ben.page.getByRole('alertdialog', { name: 'Incoming call' });
	await expect(ringing).toContainText('Anna is calling you');

	await ben.page.getByRole('button', { name: 'Dismiss call' }).click();
	await expect(ringing).toBeHidden();

	await anna.context.close();
	await ben.context.close();
});

test.describe('with LiveKit', () => {
	test.beforeEach(async () => {
		test.skip(!(await livekitRunning()), 'LiveKit is not running');
	});

	test('friends talk in a direct call that follows them across tabs', async ({ browser }) => {
		const { anna, ben } = await friends(browser);
		await openDm(anna.page, 'Ben');

		await anna.page.getByRole('button', { name: 'Start call' }).click();
		const annaBar = anna.page.getByRole('region', { name: 'Call' });
		await expect(annaBar.getByRole('status')).toHaveText('Voice connected');

		// Ben answers from the incoming call banner and lands in the chat.
		await ben.page.getByRole('button', { name: 'Join', exact: true }).click();
		await expect(ben.page.getByRole('heading', { name: 'Anna' })).toBeVisible();
		const benStage = ben.page.getByRole('list', { name: 'Participants' });
		await expect(benStage.getByRole('listitem', { name: 'Anna', exact: true })).toBeVisible();
		await expect(benStage.getByRole('listitem', { name: 'Ben', exact: true })).toBeVisible();

		// The call bar stays while Anna switches to the instance tab.
		await anna.page.getByRole('navigation', { name: 'Instances' }).getByRole('link').nth(1).click();
		await expect(annaBar.getByRole('status')).toHaveText('Voice connected');
		await expect(annaBar.getByRole('link', { name: /Ben/ })).toBeVisible();

		const annaPanel = anna.page.getByRole('region', { name: 'You' });
		await annaPanel.getByRole('button', { name: 'Mute' }).click();
		await expect(annaPanel.getByRole('button', { name: 'Unmute' })).toBeVisible();
		await expect(
			benStage.getByRole('listitem', { name: 'Anna', exact: true }).getByLabel('Muted')
		).toBeVisible();

		await annaBar.getByRole('button', { name: 'Hang up' }).click();
		await expect(annaBar).toBeHidden();
		await expect(benStage.getByRole('listitem', { name: 'Anna', exact: true })).toBeHidden();

		await anna.context.close();
		await ben.context.close();
	});

	test('mute and audio settings from the user panel carry over into calls', async ({ browser }) => {
		const { page, context } = await newUser(browser, 'Emil');
		await openLounge(page);

		// Muted before joining, like in Discord.
		const panel = page.getByRole('region', { name: 'You' });
		await panel.getByRole('button', { name: 'Mute' }).click();
		await expect(panel.getByRole('button', { name: 'Unmute' })).toBeVisible();

		await panel.getByRole('button', { name: 'Settings' }).click();
		const dialog = page.getByRole('dialog', { name: 'Settings' });
		await dialog.getByRole('switch', { name: 'Noise suppression' }).click();
		await expect(dialog.getByRole('switch', { name: 'Noise suppression' })).not.toBeChecked();
		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();

		// Both are kept in this browser.
		await page.reload();
		await expect(panel.getByRole('button', { name: 'Unmute' })).toBeVisible();
		await panel.getByRole('button', { name: 'Settings' }).click();
		await expect(dialog.getByRole('switch', { name: 'Noise suppression' })).not.toBeChecked();
		await page.keyboard.press('Escape');

		await page.getByRole('button', { name: 'Join voice' }).click();
		// On a wide screen the call sits in the sidebar above the user panel, which has the
		// only mute and deafen buttons.
		const bar = page.getByRole('region', { name: 'Call' });
		await expect(bar.getByRole('status')).toHaveText('Voice connected');
		await expect(bar.getByRole('button', { name: /mute/i })).toHaveCount(0);
		const me = page.getByRole('list', { name: 'Participants' }).getByRole('listitem', {
			name: 'Emil'
		});
		await expect(me.getByLabel('Muted')).toBeVisible();

		// The panel controls the running call.
		await panel.getByRole('button', { name: 'Unmute' }).click();
		await expect(me.getByLabel('Muted')).toBeHidden();
		await panel.getByRole('button', { name: 'Deafen' }).click();
		await expect(panel.getByRole('button', { name: 'Undeafen' })).toBeVisible();
		await expect(me.getByLabel('Muted')).toBeVisible();

		await bar.getByRole('button', { name: 'Hang up' }).click();
		await expect(bar).toBeHidden();
		await expect(panel.getByRole('button', { name: 'Undeafen' })).toBeVisible();

		await context.close();
	});

	test('on a phone the Lounge voice channel can be joined and left', async ({ browser }) => {
		const { page, context } = await newUser(browser, 'Dora', { width: 390, height: 800 });
		await openLounge(page);

		await page.getByRole('button', { name: 'Join voice' }).click();
		const bar = page.getByRole('region', { name: 'Call' });
		await expect(bar.getByRole('status')).toHaveText('Voice connected');
		await expect(
			page.getByRole('list', { name: 'Participants' }).getByRole('listitem', { name: 'Dora' })
		).toBeVisible();
		await expect(bar.getByRole('button', { name: 'Hang up' })).toBeVisible();
		const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
		expect(scrollWidth).toBeLessThanOrEqual(390);

		// The channel list shows who is in the voice channel.
		await page.getByRole('link', { name: 'Back to channels' }).click();
		await expect(page.getByRole('list', { name: 'In Lounge' })).toContainText('Dora');

		await bar.getByRole('button', { name: 'Hang up' }).click();
		await expect(bar).toBeHidden();
		await expect(page.getByRole('list', { name: 'In Lounge' })).toBeHidden();

		await context.close();
	});

	test('everyone sees who is in the Lounge without joining', async ({ browser }) => {
		const anna = await newUser(browser, 'Anna');
		const ben = await newUser(browser, 'Ben');
		await openLounge(anna.page);
		await openLounge(ben.page);
		const benList = ben.page.getByRole('list', { name: 'In Lounge', exact: true });
		const benPage = ben.page.getByRole('list', { name: 'People in Lounge' });

		await anna.page.getByRole('button', { name: 'Join voice' }).click();
		const annaBar = anna.page.getByRole('region', { name: 'Call' });
		await expect(annaBar.getByRole('status')).toHaveText('Voice connected');

		// Ben has not joined, yet sees Anna in the channel list and on the channel page.
		await expect(benList).toContainText('Anna');
		await expect(benPage).toContainText('Anna');
		await expect(ben.page.getByRole('region', { name: 'Call' })).toBeHidden();

		await anna.page
			.getByRole('region', { name: 'You' })
			.getByRole('button', { name: 'Mute' })
			.click();
		await expect(
			benList.getByRole('listitem').filter({ hasText: 'Anna' }).getByLabel('Muted')
		).toBeVisible();

		await annaBar.getByRole('button', { name: 'Hang up' }).click();
		await expect(benList).toBeHidden();
		await expect(benPage).toBeHidden();

		await anna.context.close();
		await ben.context.close();
	});
});
