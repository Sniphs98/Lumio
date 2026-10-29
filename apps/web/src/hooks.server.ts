import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { sequence } from '@sveltejs/kit/hooks';
import { building } from '$app/env';
import { auth } from '#lib/server/auth.ts';
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

	return svelteKitHandler({ event, resolve, auth, building });
};

/**
 * Headers for every response. Other sites may not show Lumio in a frame, so they cannot trick
 * people into clicking its buttons (clickjacking), and links to other sites do not reveal the
 * page someone came from. Responses that set their own policy, e.g. file downloads, keep it.
 */
const SECURITY_HEADERS: Record<string, string> = {
	'X-Frame-Options': 'DENY',
	'Content-Security-Policy': "frame-ancestors 'none'",
	'X-Content-Type-Options': 'nosniff',
	'Referrer-Policy': 'strict-origin-when-cross-origin'
};

const handleSecurityHeaders: Handle = async ({ event, resolve }) => {
	let response = await resolve(event);
	const missing = Object.entries(SECURITY_HEADERS).filter(([name]) => !response.headers.has(name));
	if (missing.length === 0) return response;
	try {
		for (const [name, value] of missing) response.headers.set(name, value);
	} catch {
		// Some responses, e.g. from `Response.redirect()`, have immutable headers: copy them.
		response = new Response(response.body, response);
		for (const [name, value] of missing) response.headers.set(name, value);
	}
	return response;
};

export const handle: Handle = sequence(handleSecurityHeaders, handleBetterAuth);
