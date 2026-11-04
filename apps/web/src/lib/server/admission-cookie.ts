import type { Admission } from '#lib/server/invites.ts';

/**
 * Signing up with another service (Discord, Google, Steam) leaves Lumio for that service's
 * page. The invite or friend link the sign-up started from is kept in this cookie until the
 * service sends the user back, where
 * `src/hooks.server.ts` hands it to the Better Auth user hook. The link is checked there like
 * on any other sign-up, so the cookie needs no signature.
 */
export const ADMISSION_COOKIE = 'lumio-admission';

/** Only sent to Better Auth, which holds the callbacks of all services. */
export const ADMISSION_COOKIE_PATH = '/api/auth';

/** Long enough to sign in to the service and accept, short enough not to linger. */
export const ADMISSION_COOKIE_MAX_AGE = 10 * 60;

export function encodeAdmission(admission: Admission): string {
	return `${admission.kind}:${admission.code}`;
}

/** Reads the cookie value back. Anything malformed counts as no link. */
export function parseAdmission(value: string | undefined): Admission | undefined {
	const match = value?.match(/^(invite|friend):([\w-]{1,64})$/);
	if (!match) return undefined;
	return { kind: match[1] as Admission['kind'], code: match[2] };
}
