import { expect, test, type Page } from '@playwright/test';
import { E2E_INVITE_CODE, newUser } from './helpers.ts';

/**
 * Posts a sign-in form the way the service's button does and returns the URL Lumio redirects
 * to. The tests stop there: they never reach Discord, Google or Steam.
 */
async function start(page: Page, path: string, action: string, provider: string) {
	await page.goto(path);
	const response = await page.request.post(`${path}${path.includes('?') ? '&' : '?'}/${action}`, {
		headers: { origin: new URL(page.url()).origin, accept: 'text/html' },
		form: { provider },
		maxRedirects: 0
	});
	expect(response.status()).toBe(303);
	return new URL(response.headers().location);
}

async function admissionCookie(page: Page) {
	const cookies = await page.context().cookies();
	return cookies.find((c) => c.name === 'lumio-admission');
}

test('the join page offers every configured service', async ({ page }) => {
	await page.goto(`/invite/${E2E_INVITE_CODE}`);
	for (const name of ['Discord', 'Google', 'Steam']) {
		await expect(page.getByRole('button', { name: `Continue with ${name}` })).toBeVisible();
	}
	await expect(
		page.getByText('You can also use your Discord, Google or Steam account.')
	).toBeVisible();
});

test('joining through an invite link with Discord keeps the link for the way back', async ({
	page
}) => {
	const authorize = await start(page, `/invite/${E2E_INVITE_CODE}`, 'social', 'discord');

	expect(authorize.origin + authorize.pathname).toBe('https://discord.com/api/oauth2/authorize');
	expect(authorize.searchParams.get('client_id')).toBe('e2e-discord-client');
	expect(authorize.searchParams.get('scope')).toBe('identify email');
	expect(new URL(authorize.searchParams.get('redirect_uri')!).pathname).toBe(
		'/api/auth/callback/discord'
	);

	// Better Auth keeps the OAuth state for checking Discord's answer.
	const cookies = await page.context().cookies();
	expect(cookies.some((c) => c.name.endsWith('better-auth.state'))).toBe(true);

	// Only the services' way back gets the invite, so the new account is admitted like any other.
	const admission = await admissionCookie(page);
	expect(admission?.value).toBe(`invite:${E2E_INVITE_CODE}`);
	expect(admission?.path).toBe('/api/auth');
	expect(admission?.httpOnly).toBe(true);
});

test('signing in with Google goes to Google', async ({ page }) => {
	const authorize = await start(page, '/login', 'social', 'google');
	expect(authorize.origin).toBe('https://accounts.google.com');
	expect(authorize.searchParams.get('client_id')).toBe('e2e-google-client');
	expect(new URL(authorize.searchParams.get('redirect_uri')!).pathname).toBe(
		'/api/auth/callback/google'
	);
	// Signing in starts without an invite: only connected members get in.
	expect(await admissionCookie(page)).toBeUndefined();
});

test('signing in with Steam uses OpenID and refuses forged answers', async ({ page }) => {
	const login = await start(page, `/invite/${E2E_INVITE_CODE}`, 'social', 'steam');
	expect(login.origin + login.pathname).toBe('https://steamcommunity.com/openid/login');
	expect(login.searchParams.get('openid.mode')).toBe('checkid_setup');
	expect(login.searchParams.get('openid.realm')).toBe(new URL(page.url()).origin);
	const returnTo = new URL(login.searchParams.get('openid.return_to')!);
	expect(returnTo.pathname).toBe('/api/auth/steam/callback');
	expect(returnTo.searchParams.get('state')).toBeTruthy();

	// An answer Steam never signed: Lumio asks Steam, which refuses it (or cannot be reached).
	const forged = new URL(returnTo);
	for (const [key, value] of Object.entries({
		'openid.ns': 'http://specs.openid.net/auth/2.0',
		'openid.mode': 'id_res',
		'openid.op_endpoint': 'https://steamcommunity.com/openid/login',
		'openid.claimed_id': 'https://steamcommunity.com/openid/id/76561197960287930',
		'openid.identity': 'https://steamcommunity.com/openid/id/76561197960287930',
		'openid.return_to': returnTo.toString(),
		'openid.response_nonce': `${new Date().toISOString().slice(0, 19)}Zforged`,
		'openid.assoc_handle': '1234567890',
		'openid.signed': 'signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle',
		'openid.sig': 'Zm9yZ2Vk'
	})) {
		forged.searchParams.set(key, value);
	}
	await page.goto(forged.toString());
	await expect(page).toHaveURL(/\/invite\/.*error=invalid_steam_response/);
	await expect(page.getByRole('alert')).toHaveText(
		'Signing in with Steam did not work. Please try again.'
	);
	await expect(page.getByRole('link', { name: 'Home' })).toHaveCount(0);

	// Cancelling on Steam's page.
	const again = await start(page, '/login', 'social', 'steam');
	const cancelled = new URL(again.searchParams.get('openid.return_to')!);
	cancelled.searchParams.set('openid.mode', 'cancel');
	await page.goto(cancelled.toString());
	await expect(page).toHaveURL(/\/login\?via=steam&error=access_denied/);
	await expect(page.getByRole('alert')).toHaveText('You cancelled signing in with Steam.');
});

test('a failed sign-in explains why without showing text from the link', async ({ page }) => {
	await page.goto('/login?error=not_admitted&via=google');
	await expect(page.getByRole('alert')).toContainText('continue with Google there');

	await page.goto('/login?error=Call+555-0100+to+unlock+your+account&via=discord');
	await expect(page.getByRole('alert')).toHaveText(
		'Signing in with Discord did not work. Please try again.'
	);
	await expect(page.getByText('555-0100')).toHaveCount(0);
});

test('services that are not set up cannot be used', async ({ page }) => {
	await page.goto('/login');
	const response = await page.request.post('/login?/social', {
		headers: { origin: new URL(page.url()).origin, accept: 'text/html' },
		form: { provider: 'github' },
		maxRedirects: 0
	});
	expect(response.status()).toBe(404);
});

test('members connect services from their account page', async ({ browser }) => {
	const { page, context } = await newUser(browser, 'Dana', { width: 390, height: 800 });
	await page.goto('/account');
	const card = page.getByRole('region', { name: 'Connected accounts' });
	for (const name of ['Discord', 'Google', 'Steam']) {
		await expect(card.getByRole('button', { name: `Connect ${name}` })).toBeVisible();
	}

	const discord = await start(page, '/account', 'connect', 'discord');
	expect(discord.searchParams.get('client_id')).toBe('e2e-discord-client');
	const google = await start(page, '/account', 'connect', 'google');
	expect(google.searchParams.get('client_id')).toBe('e2e-google-client');
	const steam = await start(page, '/account', 'connect', 'steam');
	expect(steam.origin).toBe('https://steamcommunity.com');

	// Errors on the way back, e.g. an account another member already connected.
	await page.goto('/account?error=account_already_linked_to_different_user&via=steam');
	await expect(card).toContainText(
		'That account on Steam is already connected to another Lumio account.'
	);
	await context.close();
});
