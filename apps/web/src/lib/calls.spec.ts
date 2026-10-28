import { describe, expect, it } from 'vitest';
import {
	allowedSources,
	applyVoiceEvent,
	initials,
	parseRoomName,
	roomName,
	type VoiceMember
} from './calls.ts';
import { DEFAULT_PERMISSIONS, Permission } from './permissions.ts';

const id = '0b6f3f0e-6f43-4b8e-9d2a-5c1f3b7a9e21';

describe('room names', () => {
	it('round-trips voice channel and conversation rooms', () => {
		expect(parseRoomName(roomName('channel', id))).toEqual({ kind: 'channel', id });
		expect(parseRoomName(roomName('conversation', id))).toEqual({ kind: 'conversation', id });
	});

	it('rejects anything else', () => {
		for (const room of [undefined, 42, '', id, `server:${id}`, 'channel:abc', `channel:${id}:x`]) {
			expect(parseRoomName(room)).toBeNull();
		}
	});
});

describe('allowedSources', () => {
	it('allows everything with the default permissions', () => {
		expect(allowedSources(DEFAULT_PERMISSIONS)).toEqual([
			'microphone',
			'camera',
			'screen_share',
			'screen_share_audio'
		]);
	});

	it('only allows the microphone without Stream', () => {
		expect(allowedSources(Permission.Connect | Permission.Speak)).toEqual(['microphone']);
	});

	it('allows nothing to listeners', () => {
		expect(allowedSources(Permission.Connect)).toEqual([]);
	});

	it('allows everything to administrators', () => {
		expect(allowedSources(Permission.Administrator)).toHaveLength(4);
	});
});

describe('initials', () => {
	it('uses the first and last name, or the first two letters', () => {
		expect(initials('Anna Berg')).toBe('AB');
		expect(initials('Anna Maria Berg')).toBe('AB');
		expect(initials('ben')).toBe('BE');
		expect(initials('  ')).toBe('?');
	});
});

describe('applyVoiceEvent', () => {
	const anna: VoiceMember = { id: 'anna', name: 'Anna', muted: false, streaming: false };
	const ben: VoiceMember = { id: 'ben', name: 'Ben', muted: true, streaming: true };

	it('replaces everything with a full state', () => {
		expect(
			applyVoiceEvent({ lounge: [anna] }, { type: 'voice.state', channels: { games: [ben] } })
		).toEqual({ games: [ben] });
	});

	it('updates one channel and drops it once it is empty', () => {
		const state = { lounge: [anna], games: [ben] };
		const joined = applyVoiceEvent(state, {
			type: 'voice.changed',
			channelId: 'lounge',
			members: [anna, ben]
		});
		expect(joined).toEqual({ lounge: [anna, ben], games: [ben] });
		expect(state.lounge).toEqual([anna]);

		expect(
			applyVoiceEvent(joined, { type: 'voice.changed', channelId: 'games', members: [] })
		).toEqual({ lounge: [anna, ben] });
	});
});
