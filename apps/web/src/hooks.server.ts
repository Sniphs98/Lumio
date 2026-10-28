import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
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

export const handle: Handle = handleBetterAuth;
