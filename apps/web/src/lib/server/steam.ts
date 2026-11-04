import type { BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthEndpoint, isAPIError, sessionMiddleware } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';
import {
	generateState,
	handleOAuthUserInfo,
	linkOAuthAccount,
	parseState
} from 'better-auth/oauth2';
import * as z from 'zod';
import {
	fetchSteamName,
	parseSteamAssertion,
	steamPlaceholderEmail,
	steamSignInUrl,
	verifySteamAssertion
} from '#lib/server/steam-openid.ts';

/** Where Steam sends users back to, relative to Better Auth's base path (`/api/auth`). */
const CALLBACK = '/steam/callback';

/** Where Steam sends users back to. */
export const STEAM_CALLBACK_PATH = `/api/auth${CALLBACK}`;

/** Local paths to continue to after Steam, read by Better Auth's `generateState`. */
const signInBody = z.object({ callbackURL: z.string(), errorCallbackURL: z.string() });

/** The page to come back to, with `?error=<code>` added like Better Auth does for OAuth. */
function withError(url: string, code: string): string {
	return `${url}${url.includes('?') ? '&' : '?'}error=${encodeURIComponent(code)}`;
}

/**
 * Sign in with Steam as a Better Auth plugin. Better Auth only knows OAuth, Steam only OpenID
 * 2.0, so this plugin does the redirect and the check itself (see `#lib/server/steam-openid.ts`)
 * and hands the result to Better Auth's own OAuth helpers. That way Steam accounts go through
 * the same state cookie, user and session hooks and account linking as Discord and Google.
 *
 * `signInSteam` and `linkSteam` are server-only, called from form actions like
 * `auth.api.signInSocial`; only the callback is reachable over HTTP.
 */
export function steam({ apiKey }: { apiKey: string | undefined }) {
	const notSetUp = () =>
		new APIError('NOT_FOUND', { message: 'Signing in with Steam is not set up on this Lumio.' });
	return {
		id: 'steam',
		endpoints: {
			/** Body: `callbackURL` and `errorCallbackURL`, both local paths. Returns Steam's URL. */
			signInSteam: createAuthEndpoint.serverOnly(
				{ method: 'POST', body: signInBody },
				async (c) => {
					if (!apiKey) throw notSetUp();
					const { state } = await generateState(c);
					return { url: steamUrl(c.context.baseURL, state) };
				}
			),
			/** Same for connecting Steam to the signed-in user. */
			linkSteam: createAuthEndpoint.serverOnly(
				{ method: 'POST', body: signInBody, use: [sessionMiddleware], requireHeaders: true },
				async (c) => {
					if (!apiKey) throw notSetUp();
					const { user } = c.context.session;
					const { state } = await generateState(c, {
						link: { userId: user.id, email: user.email }
					});
					return { url: steamUrl(c.context.baseURL, state) };
				}
			),
			steamCallback: createAuthEndpoint(CALLBACK, { method: 'GET' }, async (c) => {
				// Checks the state against the cookie set when the user left for Steam.
				const { callbackURL, errorURL, link } = await parseState(c);
				const fail = (code: string): never => {
					throw c.redirect(withError(errorURL ?? '/', code));
				};

				const query = new URLSearchParams(
					Object.entries((c.query ?? {}) as Record<string, unknown>).flatMap(([key, value]) =>
						typeof value === 'string' ? [[key, value]] : []
					)
				);
				const assertion = parseSteamAssertion(
					query,
					returnTo(c.context.baseURL, query.get('state') ?? '')
				);
				if (!assertion.ok) return fail(assertion.error);
				if (!(await verifySteamAssertion(assertion.params))) return fail('invalid_steam_response');

				const name = apiKey ? await fetchSteamName(assertion.steamId, apiKey) : null;
				if (!name) return fail('steam_unavailable');

				const userInfo = {
					id: assertion.steamId,
					name,
					email: steamPlaceholderEmail(assertion.steamId),
					// The placeholder address is nobody's mailbox, see `steamPlaceholderEmail`.
					emailVerified: false
				};
				const account = { providerId: 'steam', accountId: assertion.steamId };
				const profile = { steamid: assertion.steamId, personaname: name };

				if (link) {
					const result = await linkOAuthAccount(c, { link, userInfo, account, profile });
					if (!result.linked) return fail(result.error.code);
					throw c.redirect(callbackURL);
				}

				let result: Awaited<ReturnType<typeof handleOAuthUserInfo>>;
				try {
					result = await handleOAuthUserInfo(c, {
						userInfo,
						account,
						callbackURL,
						source: { method: 'oauth', oauth: { providerId: 'steam', profile } }
					});
				} catch (error) {
					// Our user and session hooks explain refusals with a code, see `SOCIAL_ERRORS`.
					if (isAPIError(error) && error.body?.code) return fail(error.body.code);
					throw error;
				}
				if (result.error !== null) return fail(result.error.split(' ').join('_'));
				await setSessionCookie(c, result.data);
				throw c.redirect(callbackURL);
			})
		}
	} satisfies BetterAuthPlugin;
}

/** The callback URL with its state, exactly as Steam has to send it back. */
function returnTo(baseURL: string, state: string): string {
	return `${baseURL}${CALLBACK}?state=${encodeURIComponent(state)}`;
}

function steamUrl(baseURL: string, state: string): string {
	return steamSignInUrl(returnTo(baseURL, state), new URL(baseURL).origin);
}
