import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { sequence } from '@sveltejs/kit/hooks';
import { building } from '$app/env';
import { LIVEKIT_URL } from '$app/env/private';
import { allowLiveKit, liveKitOrigins } from '#lib/server/csp.ts';
import { auth } from '#lib/server/auth.ts';
import { DISCORD_CALLBACK_PATH, readAdmission, clearAdmissionCookie } from '#lib/server/discord.ts';
import { cleanUpUploads } from '#lib/server/uploads.ts';
import { svelteKitHandler } from 'better-auth/svelte-kit';

export const init: ServerInit = () => {
	if (building) return;
	// Removes unfinished uploads and files that were never sent, once an hour.
	setInterval(() => cleanUpUploads().catch(console.error), 60 * 60 * 1000).unref();
};

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}
	// A sign-up through Discord comes back here with the invite or friend link it started from.
	if (event.url.pathname !== DISCORD_CALLBACK_PATH) {
		return svelteKitHandler({ event, resolve, auth, building });
	}
	event.locals.admission = readAdmission(event);
	const response = await svelteKitHandler({ event, resolve, auth, building });
	return withHeader(response, 'Set-Cookie', clearAdmissionCookie(event), true);
};

/**
 * Headers for every response. Other sites may not show Lumio in a frame, so they cannot trick
 * people into clicking its buttons (clickjacking), and links to other sites do not reveal the
 * page someone came from. Responses that set their own policy keep it: pages get SvelteKit's
 * Content Security Policy (see `vite.config.ts`), file downloads their own.
 */
const SECURITY_HEADERS: Record<string, string> = {
	'X-Frame-Options': 'DENY',
	'Content-Security-Policy': "frame-ancestors 'none'",
	'X-Content-Type-Options': 'nosniff',
	'Referrer-Policy': 'strict-origin-when-cross-origin'
};

const handleSecurityHeaders: Handle = async ({ event, resolve }) => {
	let response = await resolve(event);
	const policy = response.headers.get('Content-Security-Policy');
	if (policy?.includes('connect-src')) {
		response = withHeader(
			response,
			'Content-Security-Policy',
			allowLiveKit(policy, liveKitOrigins(LIVEKIT_URL))
		);
	}
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		if (!response.headers.has(name)) response = withHeader(response, name, value);
	}
	return response;
};

/**
 * Sets a header, or adds one with `append`. Some responses, e.g. from `Response.redirect()`,
 * have immutable headers: copy them.
 */
function withHeader(response: Response, name: string, value: string, append = false): Response {
	try {
		response.headers[append ? 'append' : 'set'](name, value);
		return response;
	} catch {
		const copy = new Response(response.body, response);
		copy.headers[append ? 'append' : 'set'](name, value);
		return copy;
	}
}

export const handle: Handle = sequence(handleSecurityHeaders, handleBetterAuth);
