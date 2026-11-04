/**
 * Signing in with Steam. Steam does not offer OAuth, only OpenID 2.0: the browser is sent to
 * Steam, which sends it back with a signed assertion of the user's Steam ID. Lumio asks Steam
 * whether that assertion is genuine (`check_authentication`), so it needs no shared secret.
 * The display name comes from the Steam Web API, which needs an API key.
 *
 * These functions only talk to Steam. The Better Auth plugin in `#lib/server/steam.ts` wires
 * them into sign-in, sign-up and account linking.
 */

import { NAME_MAX_LENGTH } from '#lib/guests.ts';

export const STEAM_OPENID_ENDPOINT = 'https://steamcommunity.com/openid/login';
const OPENID_NS = 'http://specs.openid.net/auth/2.0';
const IDENTIFIER_SELECT = 'http://specs.openid.net/auth/2.0/identifier_select';
const STEAM_ID = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;

/**
 * The Steam page to send the browser to. Steam sends it back to `returnTo` and only for this
 * Lumio (`realm`), and shows the user which site asks.
 */
export function steamSignInUrl(returnTo: string, realm: string): string {
	const url = new URL(STEAM_OPENID_ENDPOINT);
	url.search = new URLSearchParams({
		'openid.ns': OPENID_NS,
		'openid.mode': 'checkid_setup',
		'openid.return_to': returnTo,
		'openid.realm': realm,
		'openid.identity': IDENTIFIER_SELECT,
		'openid.claimed_id': IDENTIFIER_SELECT
	}).toString();
	return url.toString();
}

export type SteamAssertion =
	| { ok: true; steamId: string; params: URLSearchParams }
	| { ok: false; error: 'access_denied' | 'invalid_steam_response' };

/**
 * Reads the answer Steam sent the browser back with, i.e. the callback's query. Checks everything that can be checked
 * locally: that it is a positive answer from Steam, for a Steam ID, and that it was meant for
 * this callback (`expectedReturnTo`, including its `state`). Whether Steam really signed it is
 * checked by `verifySteamAssertion`.
 */
export function parseSteamAssertion(
	query: URLSearchParams,
	expectedReturnTo: string
): SteamAssertion {
	const mode = query.get('openid.mode');
	if (mode === 'cancel') return { ok: false, error: 'access_denied' };
	if (mode !== 'id_res' || query.get('openid.ns') !== OPENID_NS) {
		return { ok: false, error: 'invalid_steam_response' };
	}
	if (query.get('openid.op_endpoint') !== STEAM_OPENID_ENDPOINT) {
		return { ok: false, error: 'invalid_steam_response' };
	}
	const claimedId = query.get('openid.claimed_id');
	const match = claimedId?.match(STEAM_ID);
	if (!match || query.get('openid.identity') !== claimedId) {
		return { ok: false, error: 'invalid_steam_response' };
	}
	if (query.get('openid.return_to') !== expectedReturnTo) {
		return { ok: false, error: 'invalid_steam_response' };
	}
	// Only the `openid.*` parameters go back to Steam for checking.
	const params = new URLSearchParams();
	for (const [key, value] of query) if (key.startsWith('openid.')) params.append(key, value);
	return { ok: true, steamId: match[1], params };
}

/** Asks Steam whether it really signed the assertion. Each assertion can only be checked once. */
export async function verifySteamAssertion(
	params: URLSearchParams,
	fetchFn: typeof fetch = fetch
): Promise<boolean> {
	const body = new URLSearchParams(params);
	body.set('openid.mode', 'check_authentication');
	try {
		const response = await fetchFn(STEAM_OPENID_ENDPOINT, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body,
			signal: AbortSignal.timeout(10_000)
		});
		if (!response.ok) return false;
		// Key-value form: one `key:value` per line.
		return (await response.text()).split('\n').some((line) => line.trim() === 'is_valid:true');
	} catch {
		return false;
	}
}

/**
 * The public display name of a Steam account, shortened to what Lumio accepts, or null if the
 * Steam Web API does not answer.
 */
export async function fetchSteamName(
	steamId: string,
	apiKey: string,
	fetchFn: typeof fetch = fetch
): Promise<string | null> {
	const url = new URL('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/');
	url.search = new URLSearchParams({ key: apiKey, steamids: steamId }).toString();
	try {
		const response = await fetchFn(url, { signal: AbortSignal.timeout(10_000) });
		if (!response.ok) return null;
		const data = (await response.json()) as {
			response?: { players?: { steamid?: string; personaname?: unknown }[] };
		};
		const player = data.response?.players?.find((p) => p.steamid === steamId);
		if (typeof player?.personaname !== 'string') return null;
		return steamDisplayName(player.personaname);
	} catch {
		return null;
	}
}

/**
 * Fits a Steam name into Lumio's rules (see `parseGuestName`): trimmed, not empty, at most
 * 32 characters. Shortening never splits an emoji or other character in two.
 */
export function steamDisplayName(personaName: string): string {
	const chars = [...personaName.trim().replace(/\s+/g, ' ')];
	while (chars.join('').length > NAME_MAX_LENGTH) chars.pop();
	return chars.join('').trim() || 'Steam user';
}

/**
 * Steam shares no email address, but every Lumio user needs a unique one. Steam users get this
 * placeholder, which is never shown and cannot receive mail (`.invalid` is reserved).
 */
export function steamPlaceholderEmail(steamId: string): string {
	return `steam-${steamId}@${STEAM_EMAIL_DOMAIN}`;
}

export const STEAM_EMAIL_DOMAIN = 'steam.lumio.invalid';
