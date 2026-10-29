import {
	ParticipantInfo,
	ParticipantInfo_State,
	Room,
	TrackInfo,
	TrackSource
} from 'livekit-server-sdk';
import { describe, expect, it, vi } from 'vitest';
import { roomName } from '#lib/calls.ts';
import {
	fetchChannelRooms,
	visibleVoiceState,
	voiceChanges,
	voiceStateFromRooms
} from './voice-state.ts';

const lounge = '0b6f3f0e-6f43-4b8e-9d2a-5c1f3b7a9e21';
const games = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';

function participant(
	identity: string,
	name: string,
	{
		joinedAt = 1n,
		tracks = [] as TrackInfo[],
		state = ParticipantInfo_State.ACTIVE,
		hidden = false
	} = {}
) {
	return new ParticipantInfo({
		identity,
		name,
		joinedAt,
		tracks,
		state,
		permission: { hidden }
	});
}

const mic = (muted: boolean) => new TrackInfo({ source: TrackSource.MICROPHONE, muted });
const screen = new TrackInfo({ source: TrackSource.SCREEN_SHARE });

describe('voiceStateFromRooms', () => {
	it('lists voice channel members in join order with mute and screen share state', () => {
		const state = voiceStateFromRooms([
			{
				name: roomName('channel', lounge),
				participants: [
					participant('ben', 'Ben', { joinedAt: 20n, tracks: [mic(true), screen] }),
					participant('anna', 'Anna', { joinedAt: 10n, tracks: [mic(false)] }),
					participant('carl', '', { joinedAt: 30n })
				]
			}
		]);
		expect(state).toEqual({
			[lounge]: [
				{ id: 'anna', name: 'Anna', muted: false, streaming: false },
				{ id: 'ben', name: 'Ben', muted: true, streaming: true },
				// Without a microphone track they count as muted.
				{ id: 'carl', name: 'carl', muted: true, streaming: false }
			]
		});
	});

	it('leaves out conversation calls, empty rooms, hidden and disconnected participants', () => {
		const state = voiceStateFromRooms([
			{
				name: roomName('conversation', lounge),
				participants: [participant('anna', 'Anna')]
			},
			{ name: roomName('channel', games), participants: [] },
			{
				name: roomName('channel', lounge),
				participants: [
					participant('rec', 'Recorder', { hidden: true }),
					participant('gone', 'Gone', { state: ParticipantInfo_State.DISCONNECTED })
				]
			},
			{ name: 'something-else', participants: [participant('x', 'X')] }
		]);
		expect(state).toEqual({});
	});
});

describe('voiceChanges', () => {
	const anna = { id: 'anna', name: 'Anna', muted: false, streaming: false };
	const ben = { id: 'ben', name: 'Ben', muted: false, streaming: false };

	it('reports joined, changed and emptied channels only', () => {
		const events = voiceChanges(
			{ [lounge]: [anna], [games]: [ben], other: [anna] },
			{ [lounge]: [anna, ben], other: [anna] }
		);
		expect(events).toEqual([
			{ type: 'voice.changed', channelId: lounge, members: [anna, ben] },
			{ type: 'voice.changed', channelId: games, members: [] }
		]);
	});

	it('notices mute changes', () => {
		expect(voiceChanges({ [lounge]: [anna] }, { [lounge]: [{ ...anna, muted: true }] })).toEqual([
			{ type: 'voice.changed', channelId: lounge, members: [{ ...anna, muted: true }] }
		]);
	});
});

describe('visibleVoiceState', () => {
	it('keeps only the given channels', () => {
		const anna = { id: 'anna', name: 'Anna', muted: false, streaming: false };
		expect(visibleVoiceState({ [lounge]: [anna], [games]: [anna] }, new Set([games]))).toEqual({
			[games]: [anna]
		});
	});
});

describe('fetchChannelRooms', () => {
	const notFound = Object.assign(new Error('requested room does not exist'), { status: 404 });

	it('only asks for voice channel rooms', async () => {
		const listParticipants = vi.fn(async () => [participant('a', 'Anna')]);
		const rooms = await fetchChannelRooms({
			listRooms: async () => [
				new Room({ name: roomName('channel', lounge) }),
				new Room({ name: roomName('conversation', games) })
			],
			listParticipants
		});
		expect(listParticipants).toHaveBeenCalledExactlyOnceWith(roomName('channel', lounge));
		expect(rooms).toEqual([
			{ name: roomName('channel', lounge), participants: [participant('a', 'Anna')] }
		]);
	});

	it('counts a room that closed in the meantime as empty', async () => {
		const rooms = await fetchChannelRooms({
			listRooms: async () => [
				new Room({ name: roomName('channel', lounge) }),
				new Room({ name: roomName('channel', games) })
			],
			listParticipants: async (room) => {
				if (room === roomName('channel', games)) throw notFound;
				return [participant('a', 'Anna')];
			}
		});
		expect(voiceStateFromRooms(rooms)).toEqual({
			[lounge]: [expect.objectContaining({ id: 'a' })]
		});
	});

	it('still fails when LiveKit is unreachable', async () => {
		await expect(
			fetchChannelRooms({
				listRooms: async () => [new Room({ name: roomName('channel', lounge) })],
				listParticipants: async () => {
					throw new Error('fetch failed');
				}
			})
		).rejects.toThrow('fetch failed');
	});
});
