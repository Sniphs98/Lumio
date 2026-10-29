/**
 * Limits how often something may happen per key, e.g. sign-in attempts per IP address.
 *
 * Better Auth has its own rate limiter, but it only runs for HTTP requests to `/api/auth/*`.
 * The app signs people in and up through form actions that call `auth.api` directly, which
 * skips it, so those actions check these limits instead.
 *
 * Counts live in memory: enough for a single app container. With several app processes this
 * moves to Valkey behind the same function.
 */
import { AUTH_RATE_LIMIT } from '$app/env/private';
import { RateLimiter, type RateLimitResult, type RateLimitRule } from '#lib/server/rate-limiter.ts';

export { tooManyAttempts } from '#lib/server/rate-limiter.ts';

/** Sign-in attempts: per IP address, and per email address against attacks from many IPs. */
export const SIGN_IN_PER_IP: RateLimitRule = { max: 10, windowMs: 60_000 };
export const SIGN_IN_PER_EMAIL: RateLimitRule = { max: 20, windowMs: 15 * 60_000 };
/** New accounts and guests per IP address. */
export const SIGN_UP_PER_IP: RateLimitRule = { max: 10, windowMs: 10 * 60_000 };
/** Guests signing back in with the session token their browser kept. */
export const GUEST_RESTORE_PER_IP: RateLimitRule = { max: 10, windowMs: 60_000 };

const limiter = new RateLimiter();

/**
 * Counts one attempt for each `[name, rule]` pair and fails if any of them is over its limit.
 * Every pair is counted, so a blocked IP address cannot keep trying other email addresses.
 */
export function rateLimit(...checks: [name: string, rule: RateLimitRule][]): RateLimitResult {
	if (!AUTH_RATE_LIMIT) return { ok: true };
	let result: RateLimitResult = { ok: true };
	for (const [name, rule] of checks) {
		const r = limiter.hit(name, rule);
		if (!r.ok && (result.ok || r.retryAfterSeconds > result.retryAfterSeconds)) result = r;
	}
	return result;
}
