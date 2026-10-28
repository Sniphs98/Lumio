import { describe, expect, it } from 'vitest';
import { generateInviteCode } from './invite-code.ts';

describe('generateInviteCode', () => {
	it('creates URL-safe codes without confusable characters', () => {
		for (let i = 0; i < 100; i++) {
			expect(generateInviteCode()).toMatch(/^[A-HJ-NP-Za-km-z2-9]{10}$/);
		}
	});

	it('creates a different code every time', () => {
		const codes = new Set(Array.from({ length: 1000 }, generateInviteCode));
		expect(codes.size).toBe(1000);
	});
});
