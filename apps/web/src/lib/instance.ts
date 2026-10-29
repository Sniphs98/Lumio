/** Server-wide settings rules, used on the server and in the browser. */

export const SERVER_NAME_MAX_LENGTH = 50;

/** Checks the server name the owner picks in the server settings. */
export function parseServerName(
	raw: unknown
): { ok: true; name: string } | { ok: false; error: string } {
	const name = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
	if (name === '') return { ok: false, error: 'Give the server a name.' };
	if (name.length > SERVER_NAME_MAX_LENGTH) {
		return {
			ok: false,
			error: `Server names can be at most ${SERVER_NAME_MAX_LENGTH} characters long.`
		};
	}
	return { ok: true, name };
}
