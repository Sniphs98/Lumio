import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { parseAccountDetails } from '#lib/guests.ts';
import { db } from '#lib/server/db/index.ts';
import { user } from '#lib/server/db/schema.ts';
import { upgradeGuest } from '#lib/server/guests.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
	const [row] = await db
		.select({ email: user.email, isAnonymous: user.isAnonymous })
		.from(user)
		.where(eq(user.id, locals.user.id));
	// Guests get a placeholder address from Better Auth, which is never shown.
	return { email: row?.isAnonymous ? null : (row?.email ?? null) };
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
	}
};
