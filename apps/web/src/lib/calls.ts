/** Shared call types and rules, used on the server and in the browser. */
import { hasPermission, Permission } from '#lib/permissions.ts';

/** A call happens in a voice channel or in a direct or group conversation. */
export type CallKind = 'channel' | 'conversation';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Name of the LiveKit room for a voice channel or conversation, e.g. `channel:<id>`. */
export function roomName(kind: CallKind, id: string): string {
	return `${kind}:${id}`;
}

/** Parses a room name from a client. Returns null for anything that is not a known room. */
export function parseRoomName(room: unknown): { kind: CallKind; id: string } | null {
	if (typeof room !== 'string') return null;
	const [kind, id, ...rest] = room.split(':');
	if (rest.length > 0 || (kind !== 'channel' && kind !== 'conversation') || !UUID.test(id ?? '')) {
		return null;
	}
	return { kind, id };
}

/** Track sources a participant may publish, as named in LiveKit grants. */
export type CallSource = 'microphone' | 'camera' | 'screen_share' | 'screen_share_audio';

/**
 * Sources a member of a voice channel may publish: `Speak` allows the microphone,
 * `Stream` allows the camera and screen sharing.
 */
export function allowedSources(permissions: bigint): CallSource[] {
	const sources: CallSource[] = [];
	if (hasPermission(permissions, Permission.Speak)) sources.push('microphone');
	if (hasPermission(permissions, Permission.Stream)) {
		sources.push('camera', 'screen_share', 'screen_share_audio');
	}
	return sources;
}

export type ScreenShareQuality = '1080p30' | '1080p60';

/** Capture and encoding settings for screen sharing. 1080p at 30 fps is the default. */
export const SCREEN_SHARE_QUALITY = {
	'1080p30': {
		label: '1080p, 30 fps',
		width: 1920,
		height: 1080,
		frameRate: 30,
		maxBitrate: 4_000_000
	},
	'1080p60': {
		label: '1080p, 60 fps',
		width: 1920,
		height: 1080,
		frameRate: 60,
		maxBitrate: 6_000_000
	}
} as const satisfies Record<ScreenShareQuality, object>;

/** How long an incoming call is shown before it is dismissed on its own. */
export const RING_TIMEOUT_MS = 30_000;

/** Sent to the other members of a conversation when someone starts or joins its call. */
export type CallRingingEvent = {
	type: 'call.ringing';
	conversationId: string;
	/** Name of the conversation as the receiver sees it, e.g. the caller's name in a DM. */
	title: string;
	caller: { id: string; name: string };
};

/** Two-letter initials for avatars, e.g. `Anna Berg` becomes `AB`. */
export function initials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return '?';
	const letters =
		parts.length === 1 ? [...parts[0]].slice(0, 2) : [[...parts[0]][0], [...parts.at(-1)!][0]];
	return letters.join('').toUpperCase();
}
