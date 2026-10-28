/** Shared friend list types and rules, used on the server and in the browser. */

export type FriendUser = { id: string; name: string; image: string | null };

/** A friendship row as stored: `requesterId` sent the request to `addresseeId`. */
export type FriendshipRow = {
	requesterId: string;
	addresseeId: string;
	status: 'pending' | 'accepted' | 'blocked';
};

export type FriendLists = {
	friends: FriendUser[];
	/** Requests other users sent to me. */
	incoming: FriendUser[];
	/** Requests I sent that are not answered yet. */
	outgoing: FriendUser[];
};

/**
 * Sorts a user's friendship rows into friends, incoming and outgoing requests.
 * Blocked rows are left out. Every list is sorted by name.
 */
export function sortFriendships(
	me: string,
	rows: FriendshipRow[],
	users: Map<string, FriendUser>
): FriendLists {
	const lists: FriendLists = { friends: [], incoming: [], outgoing: [] };
	for (const row of rows) {
		const otherId = row.requesterId === me ? row.addresseeId : row.requesterId;
		const other = users.get(otherId);
		if (!other) continue;
		if (row.status === 'accepted') lists.friends.push(other);
		else if (row.status === 'pending') {
			(row.requesterId === me ? lists.outgoing : lists.incoming).push(other);
		}
	}
	const byName = (a: FriendUser, b: FriendUser) => a.name.localeCompare(b.name);
	lists.friends.sort(byName);
	lists.incoming.sort(byName);
	lists.outgoing.sort(byName);
	return lists;
}

/** The unique key of the direct conversation between two users, independent of their order. */
export function directKey(a: string, b: string): string {
	return a < b ? `${a}:${b}` : `${b}:${a}`;
}
