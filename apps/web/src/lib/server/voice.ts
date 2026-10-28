import { RoomServiceClient } from 'livekit-server-sdk';
import { LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL } from '$app/env/private';
import type { VoiceState } from '#lib/calls.ts';
import { publish } from '#lib/server/realtime.ts';
import { voiceChanges, voiceStateFromRooms } from '#lib/server/voice-state.ts';

/** Topic of the `voice.*` events, see `/api/voice/events`. */
export const VOICE_TOPIC = 'voice';

// LiveKit is asked who is in which voice channel every POLL_MS while someone watches.
// Polling needs no webhook setup and catches up on its own after LiveKit restarts.
const POLL_MS = 2000;

const rooms = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
	requestTimeout: 3,
	failover: false
});

let state: VoiceState = {};
let fetchedAt = 0;
let inflight: Promise<VoiceState> | null = null;
let watchers = 0;
let timer: ReturnType<typeof setInterval> | undefined;

async function fetchVoiceState(): Promise<VoiceState> {
	const list = await rooms.listRooms();
	return voiceStateFromRooms(
		await Promise.all(
			list.map(async (room) => ({
				name: room.name,
				participants: await rooms.listParticipants(room.name)
			}))
		)
	);
}

/** Asks LiveKit for the current voice state and publishes what changed. */
export function refreshVoiceState(): Promise<VoiceState> {
	inflight ??= fetchVoiceState()
		.then((next) => {
			const events = voiceChanges(state, next);
			// Update first, so a stream that subscribed and then reads the state misses nothing.
			state = next;
			fetchedAt = Date.now();
			for (const event of events) publish(VOICE_TOPIC, event);
			return next;
		})
		.finally(() => {
			inflight = null;
		});
	return inflight;
}

/** The current voice state. Falls back to the last known one while LiveKit is unreachable. */
export async function getVoiceState(): Promise<VoiceState> {
	if (Date.now() - fetchedAt < POLL_MS) return state;
	return refreshVoiceState().catch(() => state);
}

/** Keeps the voice state fresh until the returned function is called. */
export function watchVoiceState(): () => void {
	watchers++;
	timer ??= setInterval(() => void refreshVoiceState().catch(() => {}), POLL_MS);
	let stopped = false;
	return () => {
		if (stopped) return;
		stopped = true;
		watchers--;
		if (watchers === 0) {
			clearInterval(timer);
			timer = undefined;
		}
	};
}
