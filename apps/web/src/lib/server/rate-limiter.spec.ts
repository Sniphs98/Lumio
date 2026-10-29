import { describe, expect, it } from 'vitest';
import { RateLimiter, tooManyAttempts } from './rate-limiter.ts';

const rule = { max: 3, windowMs: 60_000 };

describe('RateLimiter', () => {
	it('allows attempts up to the limit, then blocks until the window ends', () => {
		let now = 0;
		const limiter = new RateLimiter(() => now);
		for (let i = 0; i < 3; i++) expect(limiter.hit('ip:1', rule)).toEqual({ ok: true });
		expect(limiter.hit('ip:1', rule)).toEqual({ ok: false, retryAfterSeconds: 60 });

		now = 59_500;
		expect(limiter.hit('ip:1', rule)).toEqual({ ok: false, retryAfterSeconds: 1 });

		now = 60_000;
		expect(limiter.hit('ip:1', rule)).toEqual({ ok: true });
	});

	it('counts every key on its own', () => {
		const limiter = new RateLimiter(() => 0);
		for (let i = 0; i < 3; i++) limiter.hit('ip:1', rule);
		expect(limiter.hit('ip:1', rule).ok).toBe(false);
		expect(limiter.hit('ip:2', rule).ok).toBe(true);
	});
});

describe('tooManyAttempts', () => {
	it('names seconds or minutes', () => {
		expect(tooManyAttempts({ retryAfterSeconds: 30 })).toBe(
			'Too many attempts. Try again in 30 seconds.'
		);
		expect(tooManyAttempts({ retryAfterSeconds: 60 })).toBe(
			'Too many attempts. Try again in 1 minute.'
		);
		expect(tooManyAttempts({ retryAfterSeconds: 61 })).toBe(
			'Too many attempts. Try again in 2 minutes.'
		);
	});
});
