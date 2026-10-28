/** Shared reaction types and rules, used on the server and in the browser. */

/** One emoji on a message and everyone who reacted with it, in the order they did. */
export type Reaction = {
	emoji: string;
	users: { id: string; name: string }[];
};

/** Different emojis one message can have. */
export const MAX_REACTIONS_PER_MESSAGE = 20;

/** Emojis offered in the reaction picker. */
export const QUICK_REACTIONS = [
	'👍',
	'❤️',
	'😂',
	'😮',
	'😢',
	'😡',
	'🎉',
	'🔥',
	'👀',
	'✅',
	'❌',
	'🙏',
	'👎',
	'😍',
	'🤔',
	'💯'
] as const;

// One or more emoji: pictographs with skin tones, variation selectors and joiners, flags and keycaps.
const EMOJI =
	/^(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Regional_Indicator}|\p{Emoji_Modifier}|[#*0-9]️?⃣|️|‍)+$/u;
const DIGITS_ONLY = /^[#*0-9]+$/;

/** Checks a reaction sent by a client: one short emoji sequence, nothing else. */
export function parseEmoji(raw: unknown): string | null {
	if (typeof raw !== 'string') return null;
	const emoji = raw.trim();
	if (emoji.length === 0 || emoji.length > 32) return null;
	if (!EMOJI.test(emoji) || DIGITS_ONLY.test(emoji)) return null;
	return emoji;
}

/** Groups reaction rows (oldest first) by emoji, keeping the order emojis were first used. */
export function groupReactions(
	rows: { emoji: string; userId: string; userName: string }[]
): Reaction[] {
	const byEmoji = new Map<string, Reaction>();
	for (const row of rows) {
		let reaction = byEmoji.get(row.emoji);
		if (!reaction) {
			reaction = { emoji: row.emoji, users: [] };
			byEmoji.set(row.emoji, reaction);
		}
		reaction.users.push({ id: row.userId, name: row.userName });
	}
	return [...byEmoji.values()];
}

/** Tooltip of a reaction, e.g. `Anna, Ben and 2 others reacted with 👍`. */
export function describeReaction(reaction: Reaction, meId?: string): string {
	const names = reaction.users.map((u) => (u.id === meId ? 'You' : u.name));
	const shown = names.slice(0, 3);
	const rest = names.length - shown.length;
	const who =
		rest > 0
			? `${shown.join(', ')} and ${rest} ${rest === 1 ? 'other' : 'others'}`
			: shown.length > 1
				? `${shown.slice(0, -1).join(', ')} and ${shown.at(-1)}`
				: (shown[0] ?? 'Nobody');
	return `${who} reacted with ${reaction.emoji}`;
}
