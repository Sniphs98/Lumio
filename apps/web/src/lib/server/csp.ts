/**
 * Origins of the LiveKit server for `connect-src`: its WebSocket URL, plus the same host over
 * HTTP(S), which the LiveKit client uses to check a failed connection.
 */
export function liveKitOrigins(liveKitUrl: string): string[] {
	try {
		const url = new URL(liveKitUrl);
		const http = url.protocol === 'wss:' ? 'https:' : 'http:';
		return [`${url.protocol}//${url.host}`, `${http}//${url.host}`];
	} catch {
		return [];
	}
}

/**
 * Adds origins to the `connect-src` of a Content Security Policy. The LiveKit URL is only known
 * at runtime, while SvelteKit's policy is configured at build time.
 */
export function allowLiveKit(policy: string, origins: string[]): string {
	if (origins.length === 0) return policy;
	return policy.replace(
		/(^|;\s*)connect-src([^;]*)/,
		(_, start: string, sources: string) => `${start}connect-src${sources} ${origins.join(' ')}`
	);
}
