import { ParticipantInfo_State, TrackSource, type ParticipantInfo } from 'livekit-server-sdk';
import { parseRoomName, type VoiceEvent, type VoiceMember, type VoiceState } from '#lib/calls.ts';

export function voiceMember(p: ParticipantInfo): VoiceMember {
	const mic = p.tracks.find((t) => t.source === TrackSource.MICROPHONE);
	return {
		id: p.identity,
		name: p.name || p.identity,
		muted: !mic || mic.muted,
		streaming: p.tracks.some((t) => t.source === TrackSource.SCREEN_SHARE && !t.muted)
	};
}

/**
 * Builds the voice state from LiveKit's rooms. Conversation calls and hidden participants
 * (e.g. recorders) are left out; members are listed in the order they joined.
 */
export function voiceStateFromRooms(
	rooms: { name: string; participants: ParticipantInfo[] }[]
): VoiceState {
	const state: VoiceState = {};
	for (const room of rooms) {
		const target = parseRoomName(room.name);
		if (target?.kind !== 'channel') continue;
		const members = room.participants
			.filter((p) => p.state !== ParticipantInfo_State.DISCONNECTED && !p.permission?.hidden)
			.sort((a, b) => Number(a.joinedAt - b.joinedAt) || a.identity.localeCompare(b.identity))
			.map(voiceMember);
		if (members.length > 0) state[target.id] = members;
	}
	return state;
}

/** One `voice.changed` event for every channel whose members differ between two states. */
export function voiceChanges(prev: VoiceState, next: VoiceState): VoiceEvent[] {
	const ids = new Set([...Object.keys(prev), ...Object.keys(next)]);
	const events: VoiceEvent[] = [];
	for (const channelId of ids) {
		const members = next[channelId] ?? [];
		if (JSON.stringify(prev[channelId] ?? []) !== JSON.stringify(members)) {
			events.push({ type: 'voice.changed', channelId, members });
		}
	}
	return events;
}

/** The part of a voice state a user may see. */
export function visibleVoiceState(state: VoiceState, channelIds: Set<string>): VoiceState {
	return Object.fromEntries(Object.entries(state).filter(([id]) => channelIds.has(id)));
}
