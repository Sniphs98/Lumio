import { describe, expect, it } from 'vitest';
import { parseServerName, SERVER_NAME_MAX_LENGTH } from './instance.ts';

describe('parseServerName', () => {
	it('trims the name and collapses spaces', () => {
		expect(parseServerName('  Game   night ')).toEqual({ ok: true, name: 'Game night' });
	});

	it('needs a name', () => {
		expect(parseServerName('   ')).toEqual({ ok: false, error: 'Give the server a name.' });
		expect(parseServerName(null)).toEqual({ ok: false, error: 'Give the server a name.' });
	});

	it('limits the length', () => {
		expect(parseServerName('a'.repeat(SERVER_NAME_MAX_LENGTH)).ok).toBe(true);
		expect(parseServerName('a'.repeat(SERVER_NAME_MAX_LENGTH + 1))).toEqual({
			ok: false,
			error: `Server names can be at most ${SERVER_NAME_MAX_LENGTH} characters long.`
		});
	});
});
