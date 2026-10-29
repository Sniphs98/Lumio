/** Counts attempts per key in fixed time windows, see `#lib/server/rate-limit.ts`. */

export type RateLimitRule = {
	/** Attempts allowed per window. */
	max: number;
	windowMs: number;
};

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

/** Above this many keys, expired windows are removed before a new key is added. */
const MAX_KEYS = 100_000;

export class RateLimiter {
	private readonly windows = new Map<string, { count: number; resetAt: number }>();

	constructor(private readonly now: () => number = Date.now) {}

	/** Counts one attempt for `key` and says whether it is allowed under `rule`. */
	hit(key: string, rule: RateLimitRule): RateLimitResult {
		const now = this.now();
		const current = this.windows.get(key);
		if (!current || current.resetAt <= now) {
			if (!current && this.windows.size >= MAX_KEYS) this.prune(now);
			this.windows.set(key, { count: 1, resetAt: now + rule.windowMs });
			return { ok: true };
		}
		if (current.count >= rule.max) {
			return { ok: false, retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000) };
		}
		current.count++;
		return { ok: true };
	}

	private prune(now: number) {
		for (const [key, window] of this.windows) {
			if (window.resetAt <= now) this.windows.delete(key);
		}
		// Still full: drop the oldest keys rather than grow without bound.
		for (const key of this.windows.keys()) {
			if (this.windows.size < MAX_KEYS) break;
			this.windows.delete(key);
		}
	}
}

/** The message shown when a limit is reached. */
export function tooManyAttempts(result: { retryAfterSeconds: number }): string {
	const minutes = Math.ceil(result.retryAfterSeconds / 60);
	return result.retryAfterSeconds < 60
		? `Too many attempts. Try again in ${result.retryAfterSeconds} seconds.`
		: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}
