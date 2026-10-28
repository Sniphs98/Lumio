/** Shared group chat rules, used on the server and in the browser. */

/** Most people a group chat can hold, including its owner. */
export const MAX_GROUP_MEMBERS = 10;
export const MAX_GROUP_NAME_LENGTH = 100;

/**
 * A group's title as one member sees it: its name, or the other members' names when it has
 * none. Without other members it is "Empty group".
 */
export function groupTitle(name: string | null, others: { name: string }[]): string {
	if (name) return name;
	if (others.length === 0) return 'Empty group';
	return others.map((u) => u.name).join(', ');
}

/**
 * Trims the name typed for a group. An empty name is allowed and stored as null, so the
 * group is shown with its members' names instead.
 */
export function normalizeGroupName(
	raw: unknown
): { ok: true; name: string | null } | { ok: false; error: string } {
	if (raw === null || raw === undefined) return { ok: true, name: null };
	if (typeof raw !== 'string') return { ok: false, error: 'Group name is missing.' };
	const name = raw.replace(/\s+/g, ' ').trim();
	if (name.length > MAX_GROUP_NAME_LENGTH) {
		return {
			ok: false,
			error: `Group names can be at most ${MAX_GROUP_NAME_LENGTH} characters long.`
		};
	}
	return { ok: true, name: name === '' ? null : name };
}

/** The user ids picked in a form, without duplicates or empty values. */
export function parseUserIds(values: FormDataEntryValue[]): string[] {
	const ids = values.filter((v): v is string => typeof v === 'string' && v.trim() !== '');
	return [...new Set(ids.map((v) => v.trim()))];
}

/**
 * Checks the people picked to join a group of `currentSize` members: at least one, all of
 * them friends of the person adding them, and the group must not grow past the limit.
 */
export function checkNewMembers(
	ids: string[],
	friendIds: ReadonlySet<string>,
	currentSize: number
): { ok: true } | { ok: false; error: string } {
	if (ids.length === 0) return { ok: false, error: 'Pick at least one friend.' };
	if (ids.some((id) => !friendIds.has(id))) {
		return { ok: false, error: 'You can only add your friends to a group.' };
	}
	if (currentSize + ids.length > MAX_GROUP_MEMBERS) {
		return { ok: false, error: `A group can have at most ${MAX_GROUP_MEMBERS} members.` };
	}
	return { ok: true };
}
