/** Guest access rules and browser storage, used on the server and in the browser. */

export const NAME_MAX_LENGTH = 32;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** Checks the name a guest picks. Guests only need a name, nothing else. */
export function parseGuestName(
	raw: unknown
): { ok: true; name: string } | { ok: false; error: string } {
	const name = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
	if (name === '') return { ok: false, error: 'Pick a name.' };
	if (name.length > NAME_MAX_LENGTH) {
		return { ok: false, error: `Names can be at most ${NAME_MAX_LENGTH} characters long.` };
	}
	return { ok: true, name };
}

export type AccountDetails = { name: string; email: string; password: string };

/** Checks the form a guest fills in to turn their guest access into a full account. */
export function parseAccountDetails(
	name: unknown,
	email: unknown,
	password: unknown
): { ok: true; details: AccountDetails } | { ok: false; error: string } {
	const parsedName = parseGuestName(name);
	if (!parsedName.ok) return parsedName;
	const parsedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
	if (!/^[^\s@]+@[^\s@]+$/.test(parsedEmail)) {
		return { ok: false, error: 'Enter a valid email address.' };
	}
	if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
		return {
			ok: false,
			error: `Your password needs at least ${PASSWORD_MIN_LENGTH} characters.`
		};
	}
	if (password.length > PASSWORD_MAX_LENGTH) {
		return {
			ok: false,
			error: `Your password can be at most ${PASSWORD_MAX_LENGTH} characters long.`
		};
	}
	return { ok: true, details: { name: parsedName.name, email: parsedEmail, password } };
}

/* -------------------------------------------------------------------------- */
/*                               Browser storage                              */
/* -------------------------------------------------------------------------- */

/**
 * A guest has no password, so their session is the only way back into their account.
 * Besides the session cookie, it is kept in `localStorage`: if the cookie is gone,
 * the login page offers to continue as this guest.
 */
export type StoredGuest = {
	userId: string;
	name: string;
	/** Signed session token, the value of the Better Auth session cookie. */
	token: string;
};

const GUEST_KEY = 'lumio:guest';
/** Set in `sessionStorage` once per visit, so the account suggestion shows once per visit. */
const VISIT_KEY = 'lumio:visit';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Storage can be missing or throw (private windows, blocked site data), so every access is guarded. */
function storage(kind: 'localStorage' | 'sessionStorage'): StorageLike | null {
	try {
		return globalThis[kind] ?? null;
	} catch {
		return null;
	}
}

export function saveGuest(guest: StoredGuest, store = storage('localStorage')) {
	try {
		store?.setItem(GUEST_KEY, JSON.stringify(guest));
	} catch {
		// Without storage the guest only has the session cookie.
	}
}

export function loadGuest(store = storage('localStorage')): StoredGuest | null {
	try {
		const raw = store?.getItem(GUEST_KEY);
		if (!raw) return null;
		const value = JSON.parse(raw) as Partial<StoredGuest>;
		if (
			typeof value.userId !== 'string' ||
			typeof value.name !== 'string' ||
			typeof value.token !== 'string'
		) {
			return null;
		}
		return { userId: value.userId, name: value.name, token: value.token };
	} catch {
		return null;
	}
}

export function forgetGuest(store = storage('localStorage')) {
	try {
		store?.removeItem(GUEST_KEY);
	} catch {
		// Nothing stored.
	}
}

/**
 * Marks the current visit as started. Returns true only for the first call of a visit
 * (a new browser tab or session), so the account suggestion shows when a guest comes back,
 * but not again while they click around.
 */
export function startVisit(store = storage('sessionStorage')): boolean {
	try {
		if (!store || store.getItem(VISIT_KEY)) return false;
		store.setItem(VISIT_KEY, '1');
		return true;
	} catch {
		return false;
	}
}
