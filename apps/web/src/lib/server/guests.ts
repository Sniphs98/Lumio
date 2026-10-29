import type { RequestEvent } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { eq, sql } from 'drizzle-orm';
import type { AccountDetails, StoredGuest } from '#lib/guests.ts';
import { auth } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import { account, user } from '#lib/server/db/schema.ts';
import type { Admission } from '#lib/server/invites.ts';
import { rateLimit, SIGN_UP_PER_IP, tooManyAttempts } from '#lib/server/rate-limit.ts';

/** New guests and accounts per IP address, so one link cannot be used to create endless users. */
function signUpLimit(event: RequestEvent): { ok: false; error: string } | null {
	const limited = rateLimit([`sign-up:ip:${event.getClientAddress()}`, SIGN_UP_PER_IP]);
	return limited.ok ? null : { ok: false, error: tooManyAttempts(limited) };
}

/**
 * Creates a guest with only a name and signs them in. The returned guest, session token
 * included, is kept in the browser's `localStorage`, see `#lib/guests.ts`.
 */
export async function signInAsGuest(
	event: RequestEvent,
	name: string,
	admission: Admission
): Promise<{ ok: true; guest: StoredGuest } | { ok: false; error: string }> {
	const limited = signUpLimit(event);
	if (limited) return limited;
	// Read by the Better Auth hooks: the user hook checks the link, the plugin takes the name.
	event.locals.admission = admission;
	event.locals.guestName = name;
	try {
		const result = await auth.api.signInAnonymous({ headers: event.request.headers });
		const { sessionToken } = (await auth.$context).authCookies;
		// The signed cookie value Better Auth just set on this response.
		const token = event.cookies.get(sessionToken.name);
		if (!token) return { ok: false, error: 'Could not start your guest session.' };
		return { ok: true, guest: { userId: result.user.id, name, token } };
	} catch (error) {
		if (error instanceof APIError) {
			return { ok: false, error: error.message || 'Could not join as a guest.' };
		}
		throw error;
	}
}

/**
 * Signs a guest back in with the session token their browser kept, e.g. after the session
 * cookie was cleared. Only works while the session is valid and its user is still a guest:
 * members sign in with their password. Returns false if the token is no longer usable.
 */
export async function restoreGuestSession(event: RequestEvent, token: string): Promise<boolean> {
	const ctx = await auth.$context;
	const cookie = ctx.authCookies.sessionToken;
	const session = await auth.api.getSession({
		headers: new Headers({ cookie: `${cookie.name}=${encodeURIComponent(token)}` })
	});
	if (!session?.user.isAnonymous) return false;

	event.cookies.set(cookie.name, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: cookie.attributes.secure ?? false,
		maxAge: ctx.sessionConfig.expiresIn
	});
	return true;
}

/**
 * Turns a guest into a full member with email and password. The user id stays the same,
 * so messages, roles, friends and conversations all stay where they are.
 */
export async function upgradeGuest(
	userId: string,
	details: AccountDetails
): Promise<{ ok: true } | { ok: false; error: string }> {
	const [current] = await db
		.select({ isAnonymous: user.isAnonymous })
		.from(user)
		.where(eq(user.id, userId));
	if (!current?.isAnonymous) return { ok: false, error: 'You already have an account.' };

	const emailTaken = { ok: false as const, error: 'This email address is already in use.' };
	const [taken] = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(sql`lower(${user.email})`, details.email));
	if (taken) return emailTaken;

	const ctx = await auth.$context;
	const password = await ctx.password.hash(details.password);
	const now = new Date();
	try {
		await db.transaction(async (tx) => {
			await tx
				.update(user)
				.set({ name: details.name, email: details.email, isAnonymous: false })
				.where(eq(user.id, userId));
			// The same row Better Auth creates for an email sign-up.
			await tx.insert(account).values({
				id: crypto.randomUUID(),
				accountId: userId,
				providerId: 'credential',
				userId,
				password,
				createdAt: now,
				updatedAt: now
			});
		});
	} catch (error) {
		// Someone else took the email address in the meantime.
		const pg = error as { code?: string; cause?: { code?: string } };
		if ((pg.code ?? pg.cause?.code) === '23505') return emailTaken;
		throw error;
	}
	return { ok: true };
}

/** Creates a full account through an invite or friend link and signs it in. */
export async function signUpWithAccount(
	event: RequestEvent,
	details: { name: string; email: string; password: string },
	admission: Admission
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
	const limited = signUpLimit(event);
	if (limited) return limited;
	// Read by the Better Auth user hook, which checks the link and uses up one join of an invite.
	event.locals.admission = admission;
	try {
		const result = await auth.api.signUpEmail({ body: details });
		return { ok: true, userId: result.user.id };
	} catch (error) {
		if (error instanceof APIError) {
			return { ok: false, error: error.message || 'Registration failed' };
		}
		throw error;
	}
}
