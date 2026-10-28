const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const CODE_LENGTH = 10;

/** A random, URL-safe invite code without easily confused characters. */
export function generateInviteCode(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
	// 256 is not a multiple of the alphabet size, but the small bias does not matter here.
	return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}
