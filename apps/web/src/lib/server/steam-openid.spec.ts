import { describe, expect, it, vi } from 'vitest';
import {
	fetchSteamName,
	parseSteamAssertion,
	STEAM_OPENID_ENDPOINT,
	steamDisplayName,
	steamPlaceholderEmail,
	steamSignInUrl,
	verifySteamAssertion
} from './steam-openid.ts';

const RETURN_TO = 'https://lumio.example/api/auth/steam/callback?state=abc';
const STEAM_ID = '76561197960287930';

/** A positive answer from Steam, as the browser brings it back. */
function answer(overrides: Record<string, string | null> = {}): URLSearchParams {
	const params: Record<string, string | null> = {
		state: 'abc',
		'openid.ns': 'http://specs.openid.net/auth/2.0',
		'openid.mode': 'id_res',
		'openid.op_endpoint': STEAM_OPENID_ENDPOINT,
		'openid.claimed_id': `https://steamcommunity.com/openid/id/${STEAM_ID}`,
		'openid.identity': `https://steamcommunity.com/openid/id/${STEAM_ID}`,
		'openid.return_to': RETURN_TO,
		'openid.response_nonce': '2026-11-04T20:00:00Zabc',
		'openid.assoc_handle': '1234567890',
		'openid.signed': 'signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle',
		'openid.sig': 'c2lnbmF0dXJl',
		...overrides
	};
	const query = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) if (value !== null) query.set(key, value);
	return query;
}

describe('steamSignInUrl', () => {
	it('asks Steam to pick the account and to come back to this Lumio', () => {
		const url = new URL(steamSignInUrl(RETURN_TO, 'https://lumio.example'));
		expect(url.origin + url.pathname).toBe(STEAM_OPENID_ENDPOINT);
		expect(url.searchParams.get('openid.mode')).toBe('checkid_setup');
		expect(url.searchParams.get('openid.return_to')).toBe(RETURN_TO);
		expect(url.searchParams.get('openid.realm')).toBe('https://lumio.example');
		expect(url.searchParams.get('openid.identity')).toBe(
			'http://specs.openid.net/auth/2.0/identifier_select'
		);
	});
});

describe('parseSteamAssertion', () => {
	it('reads the Steam ID and keeps only the OpenID parameters for checking', () => {
		const result = parseSteamAssertion(answer(), RETURN_TO);
		expect(result).toMatchObject({ ok: true, steamId: STEAM_ID });
		if (!result.ok) return;
		expect(result.params.get('state')).toBeNull();
		expect(result.params.get('openid.sig')).toBe('c2lnbmF0dXJl');
	});

	it('treats cancelling on Steam as such', () => {
		expect(parseSteamAssertion(answer({ 'openid.mode': 'cancel' }), RETURN_TO)).toEqual({
			ok: false,
			error: 'access_denied'
		});
	});

	it('refuses answers meant for another callback or state', () => {
		const other = 'https://lumio.example/api/auth/steam/callback?state=other';
		expect(parseSteamAssertion(answer(), other).ok).toBe(false);
		expect(
			parseSteamAssertion(answer({ 'openid.return_to': 'https://evil.example/' }), RETURN_TO).ok
		).toBe(false);
	});

	it('refuses answers from other providers or for other identities', () => {
		const cases: Record<string, string | null>[] = [
			{ 'openid.op_endpoint': 'https://evil.example/openid/login' },
			{ 'openid.claimed_id': 'https://evil.example/openid/id/76561197960287930' },
			{ 'openid.claimed_id': 'https://steamcommunity.com/openid/id/123' },
			{ 'openid.identity': 'https://steamcommunity.com/openid/id/76561197960287931' },
			{ 'openid.mode': 'setup_needed' },
			{ 'openid.ns': null }
		];
		for (const overrides of cases) {
			expect(parseSteamAssertion(answer(overrides), RETURN_TO)).toEqual({
				ok: false,
				error: 'invalid_steam_response'
			});
		}
	});
});

describe('verifySteamAssertion', () => {
	it('asks Steam to check the signature', async () => {
		const fetchFn = vi.fn(
			async () => new Response('ns:http://specs.openid.net/auth/2.0\nis_valid:true\n')
		);
		const result = parseSteamAssertion(answer(), RETURN_TO);
		if (!result.ok) throw new Error('expected a valid answer');

		expect(await verifySteamAssertion(result.params, fetchFn)).toBe(true);
		const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe(STEAM_OPENID_ENDPOINT);
		expect(init.method).toBe('POST');
		const body = init.body as URLSearchParams;
		expect(body.get('openid.mode')).toBe('check_authentication');
		expect(body.get('openid.sig')).toBe('c2lnbmF0dXJl');
	});

	it('refuses when Steam says no or cannot be reached', async () => {
		const params = new URLSearchParams();
		const invalid = async () =>
			new Response('ns:http://specs.openid.net/auth/2.0\nis_valid:false\n');
		const down = async () => new Response('', { status: 503 });
		const offline = async () => {
			throw new TypeError('fetch failed');
		};
		expect(await verifySteamAssertion(params, invalid)).toBe(false);
		expect(await verifySteamAssertion(params, down)).toBe(false);
		expect(await verifySteamAssertion(params, offline)).toBe(false);
	});
});

describe('fetchSteamName', () => {
	it('reads the display name with the API key', async () => {
		const fetchFn = vi.fn(async () =>
			Response.json({ response: { players: [{ steamid: STEAM_ID, personaname: '  Gabe  ' }] } })
		);
		expect(await fetchSteamName(STEAM_ID, 'key', fetchFn)).toBe('Gabe');
		const url = new URL(String((fetchFn.mock.calls[0] as unknown as [URL])[0]));
		expect(url.searchParams.get('key')).toBe('key');
		expect(url.searchParams.get('steamids')).toBe(STEAM_ID);
	});

	it('gives up without a usable answer', async () => {
		const empty = async () => Response.json({ response: { players: [] } });
		const forbidden = async () => new Response('Forbidden', { status: 403 });
		expect(await fetchSteamName(STEAM_ID, 'key', empty)).toBeNull();
		expect(await fetchSteamName(STEAM_ID, 'wrong', forbidden)).toBeNull();
	});
});

describe('steamDisplayName', () => {
	it('fits names into Lumio rules', () => {
		expect(steamDisplayName('  a   b ')).toBe('a b');
		expect(steamDisplayName('   ')).toBe('Steam user');
		expect(steamDisplayName('x'.repeat(40))).toHaveLength(32);
		// Never cuts an emoji in half.
		const name = steamDisplayName('a'.repeat(31) + '🎮');
		expect(name).toBe('a'.repeat(31));
	});
});

describe('steamPlaceholderEmail', () => {
	it('uses a reserved domain that cannot receive mail', () => {
		expect(steamPlaceholderEmail(STEAM_ID)).toBe(`steam-${STEAM_ID}@steam.lumio.invalid`);
	});
});
