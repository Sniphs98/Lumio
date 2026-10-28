import { describe, expect, it } from 'vitest';
import {
	forgetGuest,
	loadGuest,
	parseAccountDetails,
	parseGuestName,
	saveGuest,
	startVisit
} from './guests.ts';

/** A small in-memory stand-in for `localStorage` and `sessionStorage`. */
function memoryStorage() {
	const items = new Map<string, string>();
	return {
		getItem: (key: string) => items.get(key) ?? null,
		setItem: (key: string, value: string) => void items.set(key, value),
		removeItem: (key: string) => void items.delete(key)
	};
}

const brokenStorage = {
	getItem: () => {
		throw new Error('blocked');
	},
	setItem: () => {
		throw new Error('blocked');
	},
	removeItem: () => {
		throw new Error('blocked');
	}
};

describe('parseGuestName', () => {
	it('trims and collapses spaces', () => {
		expect(parseGuestName('  Ben   the  Guest ')).toEqual({ ok: true, name: 'Ben the Guest' });
	});

	it('rejects empty and too long names', () => {
		expect(parseGuestName('   ').ok).toBe(false);
		expect(parseGuestName(null).ok).toBe(false);
		expect(parseGuestName('x'.repeat(33)).ok).toBe(false);
		expect(parseGuestName('x'.repeat(32)).ok).toBe(true);
	});
});

describe('parseAccountDetails', () => {
	it('accepts a name, an email and a long enough password', () => {
		expect(parseAccountDetails(' Ben ', ' Ben@Example.com ', 'correct horse')).toEqual({
			ok: true,
			details: { name: 'Ben', email: 'ben@example.com', password: 'correct horse' }
		});
	});

	it('rejects a missing name, a broken email and short passwords', () => {
		expect(parseAccountDetails('', 'ben@example.com', 'correct horse').ok).toBe(false);
		expect(parseAccountDetails('Ben', 'ben', 'correct horse').ok).toBe(false);
		expect(parseAccountDetails('Ben', 'ben@example.com', 'short').ok).toBe(false);
		expect(parseAccountDetails('Ben', 'ben@example.com', 'x'.repeat(129)).ok).toBe(false);
	});
});

describe('guest storage', () => {
	const guest = { userId: 'u1', name: 'Ben', token: 'token.signature' };

	it('saves, loads and forgets the guest', () => {
		const store = memoryStorage();
		expect(loadGuest(store)).toBeNull();
		saveGuest(guest, store);
		expect(loadGuest(store)).toEqual(guest);
		forgetGuest(store);
		expect(loadGuest(store)).toBeNull();
	});

	it('ignores broken entries and blocked storage', () => {
		const store = memoryStorage();
		store.setItem('lumio:guest', '{not json');
		expect(loadGuest(store)).toBeNull();
		store.setItem('lumio:guest', JSON.stringify({ name: 'Ben' }));
		expect(loadGuest(store)).toBeNull();

		expect(() => saveGuest(guest, brokenStorage)).not.toThrow();
		expect(loadGuest(brokenStorage)).toBeNull();
		expect(() => forgetGuest(brokenStorage)).not.toThrow();
		expect(loadGuest(null)).toBeNull();
	});
});

describe('startVisit', () => {
	it('is true only for the first call of a visit', () => {
		const session = memoryStorage();
		expect(startVisit(session)).toBe(true);
		expect(startVisit(session)).toBe(false);
		// A new browser session starts a new visit.
		expect(startVisit(memoryStorage())).toBe(true);
	});

	it('never suggests anything when storage is unavailable', () => {
		expect(startVisit(null)).toBe(false);
		expect(startVisit(brokenStorage)).toBe(false);
	});
});
