import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { parseAccountDetails } from '#lib/guests.ts';
import { db } from '#lib/server/db/index.ts';
import { account, user } from '#lib/server/db/schema.ts';
import { connect, disconnect, enabledProviders } from '#lib/server/social.ts';
import { STEAM_EMAIL_DOMAIN } from '#lib/server/steam-openid.ts';
import { upgradeGuest } from '#lib/server/guests.ts';
import { setProfilePicture, storeImage } from '#lib/server/images.ts';
import { isSocialProvider, SOCIAL_PROVIDERS, socialErrorFromUrl } from '#lib/social.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) redirect(302, '/login');
	const [[row], accounts] = await Promise.all([
		db
			.select({ email: user.email, isAnonymous: user.isAnonymous })
			.from(user)
			.where(eq(user.id, locals.user.id)),
		db
			.select({ providerId: account.providerId })
			.from(account)
			.where(eq(account.userId, locals.user.id))
	]);
	const connected = new Set(accounts.map((a) => a.providerId));
	const hasPlaceholderEmail =
		!row || row.isAnonymous || row.email.endsWith(`@${STEAM_EMAIL_DOMAIN}`);
	return {
		// Guests get a placeholder address from Better Auth, Steam users one from Lumio, which is
		// never shown.
		email: hasPlaceholderEmail ? null : row.email,
		// Services this Lumio offers, and ones connected before the owner turned them off.
		services: SOCIAL_PROVIDERS.filter((p) => enabledProviders.includes(p) || connected.has(p)).map(
			(provider) => ({
				provider,
				enabled: enabledProviders.includes(provider),
				connected: connected.has(provider)
			})
		),
		// A service can only be disconnected while there is another way to sign in.
		signInMethods: connected.size,
		// Set when connecting fails, see `connect`.
		socialError: socialErrorFromUrl(url)
	};
};

export const actions: Actions = {
	/** Uploads a new profile picture, replacing the old one. */
	picture: async ({ locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		const stored = await storeImage(locals.user.id, (await request.formData()).get('image'));
		if (!stored.ok) return fail(400, { error: stored.error });
		await setProfilePicture(locals.user.id, stored.url);
		return { pictureSaved: true };
	},
	removePicture: async ({ locals }) => {
		if (!locals.user) error(401, 'Not signed in');
		await setProfilePicture(locals.user.id, null);
		return { pictureSaved: true };
	},
	/** Turns the signed-in guest into a full member, keeping everything they have. */
	createAccount: async ({ locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		const form = await request.formData();
		const parsed = parseAccountDetails(form.get('name'), form.get('email'), form.get('password'));
		if (!parsed.ok) return fail(400, { message: parsed.error });

		const result = await upgradeGuest(locals.user.id, parsed.details);
		if (!result.ok) return fail(400, { message: result.error });
		return { upgraded: true };
	},
	/** Sends the member to Discord, Google or Steam to connect their account there. */
	connect: async (event) => {
		if (!event.locals.user || event.locals.user.isAnonymous) error(401, 'Not signed in');
		const provider = (await event.request.formData()).get('provider');
		if (!isSocialProvider(provider)) error(400, 'Unknown service');
		return connect(event, provider);
	},
	disconnect: async (event) => {
		if (!event.locals.user || event.locals.user.isAnonymous) error(401, 'Not signed in');
		const provider = (await event.request.formData()).get('provider');
		if (!isSocialProvider(provider)) error(400, 'Unknown service');
		const message = await disconnect(event.locals.user.id, provider);
		return message ? fail(400, { socialMessage: message }) : { disconnected: provider };
	}
};
