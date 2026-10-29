/**
 * A microphone that was just opened sounds bad for a moment: the browser's noise suppression
 * has not learned the background noise yet, automatic gain control starts out too loud and
 * some devices pop. Sent right away, others in the call hear that as a burst of loud noise
 * when someone joins, unmutes for the first time or switches microphones.
 *
 * So every fresh capture sends silence until it has settled. The track stays unmuted for
 * LiveKit, so nobody sees the mute icon flicker, and the browser keeps processing the
 * capture in the background while it is held back.
 */
import {
	createLocalAudioTrack,
	TrackEvent,
	type AudioCaptureOptions,
	type LocalAudioTrack
} from 'livekit-client';

/** How long a fresh capture is held back. Noise suppression settles in about half a second. */
export const MIC_WARMUP_MS = 750;

const watched = new WeakSet<LocalAudioTrack>();

/**
 * Holds back the current capture of `track` for `ms` and every later one, as LiveKit opens a
 * new capture when switching microphones or changing voice processing.
 */
export function warmUpMicrophone(track: LocalAudioTrack, ms = MIC_WARMUP_MS): void {
	if (watched.has(track)) return;
	watched.add(track);
	let warming: MediaStreamTrack | null = null;
	let timer: ReturnType<typeof setTimeout> | undefined;

	const hold = () => {
		clearTimeout(timer);
		const capture = track.mediaStreamTrack;
		warming = capture;
		capture.enabled = false;
		timer = setTimeout(() => {
			if (warming !== capture) return;
			warming = null;
			// A mute during the warm-up keeps the microphone off.
			if (track.mediaStreamTrack === capture) capture.enabled = !track.isMuted;
		}, ms);
	};

	track.on(TrackEvent.Restarted, hold);
	// Unmuting turns the capture on again, which has to wait for the warm-up too.
	track.on(TrackEvent.Unmuted, () => {
		if (warming && warming === track.mediaStreamTrack) warming.enabled = false;
	});
	hold();
}

/** Opens the microphone and holds it back until it has settled, see `warmUpMicrophone`. */
export async function openMicrophone(options: AudioCaptureOptions): Promise<LocalAudioTrack> {
	const track = await createLocalAudioTrack(options);
	warmUpMicrophone(track);
	return track;
}
