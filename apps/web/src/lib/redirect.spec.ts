import { describe, expect, it } from 'vitest';
import { localRedirectTarget } from './redirect.ts';

const origin = 'https://chat.example.com';

describe('localRedirectTarget', () => {
	it('keeps local paths with their query and hash', () => {
		expect(localRedirectTarget('/add/abc', origin)).toBe('/add/abc');
		expect(localRedirectTarget('/channels?x=1#y', origin)).toBe('/channels?x=1#y');
	});

	it('falls back to Home without a value or for relative and absolute URLs', () => {
		expect(localRedirectTarget(null, origin)).toBe('/');
		expect(localRedirectTarget('', origin)).toBe('/');
		expect(localRedirectTarget('channels', origin)).toBe('/');
		expect(localRedirectTarget('https://evil.example', origin)).toBe('/');
	});

	it('does not lead to other sites', () => {
		for (const raw of [
			'//evil.example',
			'/\\evil.example',
			'/\t/evil.example',
			'/\n/evil.example',
			'/\\/evil.example'
		]) {
			expect(localRedirectTarget(raw, origin)).not.toContain('evil.example');
		}
	});
});
