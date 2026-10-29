import { describe, expect, it } from 'vitest';
import { encodeAdmission, parseAdmission } from './admission-cookie.ts';

describe('admission cookie', () => {
	it('keeps invite and friend links', () => {
		for (const admission of [
			{ kind: 'invite', code: 'aB3_x-9' },
			{ kind: 'friend', code: 'Zz09' }
		] as const) {
			expect(parseAdmission(encodeAdmission(admission))).toEqual(admission);
		}
	});

	it('ignores missing and malformed values', () => {
		expect(parseAdmission(undefined)).toBeUndefined();
		expect(parseAdmission('')).toBeUndefined();
		expect(parseAdmission('owner:abc')).toBeUndefined();
		expect(parseAdmission('invite:')).toBeUndefined();
		expect(parseAdmission('invite:a b')).toBeUndefined();
		expect(parseAdmission(`invite:${'a'.repeat(65)}`)).toBeUndefined();
	});
});
