/**
 * A path on this site to continue to, taken from a `?redirectTo=` value, or `/` for anything
 * else. The value is resolved the way a browser resolves a `Location` header, so tricks such as
 * `//evil.example`, `/\evil.example` or `/<tab>/evil.example` cannot lead to another site.
 */
export function localRedirectTarget(raw: string | null, origin: string): string {
	if (!raw?.startsWith('/')) return '/';
	let resolved: URL;
	try {
		resolved = new URL(raw, origin);
	} catch {
		return '/';
	}
	if (resolved.origin !== new URL(origin).origin) return '/';
	return resolved.pathname + resolved.search + resolved.hash;
}
