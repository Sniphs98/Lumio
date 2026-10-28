import { describe, expect, it } from 'vitest';
import {
	checkNewMembers,
	groupTitle,
	MAX_GROUP_MEMBERS,
	MAX_GROUP_NAME_LENGTH,
	normalizeGroupName,
	parseUserIds
} from './groups.ts';

describe('groupTitle', () => {
	it('uses the name when there is one', () => {
		expect(groupTitle('Raid night', [{ name: 'Ben' }])).toBe('Raid night');
	});

	it('falls back to the other members', () => {
		expect(groupTitle(null, [{ name: 'Ben' }, { name: 'Cleo' }])).toBe('Ben, Cleo');
		expect(groupTitle(null, [])).toBe('Empty group');
	});
});

describe('normalizeGroupName', () => {
	it('trims and collapses whitespace', () => {
		expect(normalizeGroupName('  Raid \n night ')).toEqual({ ok: true, name: 'Raid night' });
	});

	it('stores an empty name as null', () => {
		expect(normalizeGroupName('   ')).toEqual({ ok: true, name: null });
		expect(normalizeGroupName(null)).toEqual({ ok: true, name: null });
	});

	it('rejects names that are too long', () => {
		expect(normalizeGroupName('x'.repeat(MAX_GROUP_NAME_LENGTH)).ok).toBe(true);
		expect(normalizeGroupName('x'.repeat(MAX_GROUP_NAME_LENGTH + 1)).ok).toBe(false);
	});
});

describe('parseUserIds', () => {
	it('drops duplicates, empty values and files', () => {
		const file = new File([], 'a.txt');
		expect(parseUserIds(['ben', ' ben ', '', 'cleo', file])).toEqual(['ben', 'cleo']);
	});
});

describe('checkNewMembers', () => {
	const friends = new Set(['ben', 'cleo']);

	it('accepts friends while there is room', () => {
		expect(checkNewMembers(['ben', 'cleo'], friends, 1)).toEqual({ ok: true });
	});

	it('needs at least one person', () => {
		expect(checkNewMembers([], friends, 1)).toEqual({
			ok: false,
			error: 'Pick at least one friend.'
		});
	});

	it('only allows friends', () => {
		expect(checkNewMembers(['ben', 'mallory'], friends, 1).ok).toBe(false);
	});

	it('keeps the group within the member limit', () => {
		expect(checkNewMembers(['ben'], friends, MAX_GROUP_MEMBERS - 1).ok).toBe(true);
		expect(checkNewMembers(['ben', 'cleo'], friends, MAX_GROUP_MEMBERS - 1).ok).toBe(false);
	});
});
