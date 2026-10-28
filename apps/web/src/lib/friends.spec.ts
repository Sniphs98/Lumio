import { describe, expect, it } from 'vitest';
import { directKey, sortFriendships, type FriendUser } from './friends.ts';

const users = new Map<string, FriendUser>(
	['me', 'anna', 'ben', 'cleo', 'dave'].map((id) => [
		id,
		{ id, name: id[0].toUpperCase() + id.slice(1), image: null }
	])
);

describe('sortFriendships', () => {
	it('sorts rows into friends, incoming and outgoing requests', () => {
		const lists = sortFriendships(
			'me',
			[
				{ requesterId: 'me', addresseeId: 'ben', status: 'accepted' },
				{ requesterId: 'anna', addresseeId: 'me', status: 'accepted' },
				{ requesterId: 'cleo', addresseeId: 'me', status: 'pending' },
				{ requesterId: 'me', addresseeId: 'dave', status: 'pending' }
			],
			users
		);

		expect(lists.friends.map((u) => u.id)).toEqual(['anna', 'ben']);
		expect(lists.incoming.map((u) => u.id)).toEqual(['cleo']);
		expect(lists.outgoing.map((u) => u.id)).toEqual(['dave']);
	});

	it('leaves out blocked users and users that no longer exist', () => {
		const lists = sortFriendships(
			'me',
			[
				{ requesterId: 'me', addresseeId: 'ben', status: 'blocked' },
				{ requesterId: 'gone', addresseeId: 'me', status: 'accepted' }
			],
			users
		);
		expect(lists).toEqual({ friends: [], incoming: [], outgoing: [] });
	});
});

describe('directKey', () => {
	it('is the same in both directions', () => {
		expect(directKey('a', 'b')).toBe('a:b');
		expect(directKey('b', 'a')).toBe('a:b');
	});
});
