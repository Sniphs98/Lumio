import { expect, test, type Page } from '@playwright/test';
import { E2E_INVITE_CODE, newUser } from './helpers.ts';

/**
 * Posts a Discord form action the way its button does and returns the Discord URL Lumio
 * redirects to. The tests stop there: they never reach Discord itself.
 */
async function startDiscord(page: Page, path: string, action: string) {
	await page.goto(path);
	const button = page.getByRole('button', { name: /Discord/ });
	await expect(button).toBeVisible();
	const response = await page.request.post(`${path}${path.includes('?') ? '&' : '?'}/${action}`, {
		headers: { origin: new URL(page.url()).origin, accept: 'text/html' },
		form: {},
		maxRedirects: 0
	});
	expect(response.status()).toBe(303);
	return new URL(response.headers().location);
}

async function admissionCookie(page: Page) {
	const cookies = await page.context().cookies();
	return cookies.find((c) => c.name === 'lumio-admission');
}

test('joining through an invite link with Discord keeps the link for the way back', async ({
	page
}) => {
	const authorize = await startDiscord(page, `/invite/${E2E_INVITE_CODE}`, 'discord');

	expect(authorize.origin + authorize.pathname).toBe('https://discord.com/api/oauth2/authorize');
	expect(authorize.searchParams.get('client_id')).toBe('e2e-discord-client');
	expect(authorize.searchParams.get('scope')).toBe('identify email');
	expect(new URL(authorize.searchParams.get('redirect_uri')!).pathname).toBe(
		'/api/auth/callback/discord'
	);

	// Better Auth keeps the OAuth state for checking Discord's answer.
	const cookies = await page.context().cookies();
	expect(cookies.some((c) => c.name.endsWith('better-auth.state'))).toBe(true);

	// Only Discord's way back gets the invite, so the new account is admitted like any other.
	const admission = await admissionCookie(page);
	expect(admission?.value).toBe(`invite:${E2E_INVITE_CODE}`);
	expect(admission?.path).toBe('/api/auth/callback/discord');
	expect(admission?.httpOnly).toBe(true);
});

test('a failed Discord sign-in explains why without showing text from the link', async ({
	page
}) => {
	await page.goto('/login?error=not_admitted');
	await expect(page.getByRole('alert')).toContainText('You need a valid invite link');

	await page.goto('/login?error=Call+555-0100+to+unlock+your+account');
	await expect(page.getByRole('alert')).toHaveText(
		'Signing in with Discord did not work. Please try again.'
	);
	await expect(page.getByText('555-0100')).toHaveCount(0);

	// Signing in starts at Discord without an invite: only connected members get in.
	const authorize = await startDiscord(page, '/login', 'discord');
	expect(authorize.origin).toBe('https://discord.com');
	expect(await admissionCookie(page)).toBeUndefined();
});

test('members connect Discord from their account page', async ({ browser }) => {
	const { page, context } = await newUser(browser, 'Dana', { width: 390, height: 800 });
	await page.goto('/account');
	const card = page.getByRole('region', { name: 'Discord' });
	await expect(card).toContainText('Connect your Discord account to sign in with it.');

	const authorize = await startDiscord(page, '/account', 'connectDiscord');
	expect(authorize.searchParams.get('client_id')).toBe('e2e-discord-client');

	// Errors on the way back, e.g. a Discord account another member already connected.
	await page.goto('/account?error=account_already_linked_to_different_user');
	await expect(page.getByRole('region', { name: 'Discord' })).toContainText(
		'already connected to another Lumio account'
	);
	await context.close();
});
