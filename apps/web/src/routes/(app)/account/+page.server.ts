import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { discordErrorMessage } from '#lib/discord.ts';
import { parseAccountDetails } from '#lib/guests.ts';
import { db } from '#lib/server/db/index.ts';
import { account, user } from '#lib/server/db/schema.ts';
import { connectDiscord, disconnectDiscord, discordEnabled } from '#lib/server/discord.ts';
import { upgradeGuest } from '#lib/server/guests.ts';
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
	const providers = new Set(accounts.map((a) => a.providerId));
	return {
		// Guests get a placeholder address from Better Auth, which is never shown.
		email: row?.isAnonymous ? null : (row?.email ?? null),
		discord: {
			enabled: discordEnabled,
			connected: providers.has('discord'),
			// Discord can only be disconnected while there is another way to sign in.
			hasPassword: providers.has('credential'),
			// Set when connecting fails, see `connectDiscord`.
			error: discordErrorMessage(url.searchParams.get('error'))
		}
	};
};

export const actions: Actions = {
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
	connectDiscord: async (event) => {
		if (!event.locals.user || event.locals.user.isAnonymous) error(401, 'Not signed in');
		return connectDiscord(event);
	},
	disconnectDiscord: async (event) => {
		if (!event.locals.user || event.locals.user.isAnonymous) error(401, 'Not signed in');
		const message = await disconnectDiscord(event.locals.user.id);
		return message ? fail(400, { discordMessage: message }) : { discordDisconnected: true };
	}
};
