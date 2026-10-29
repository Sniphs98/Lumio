import { TrackEvent, type LocalAudioTrack } from 'livekit-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MIC_WARMUP_MS, warmUpMicrophone } from './mic-warmup.ts';

/** The parts of a LiveKit microphone track the warm-up uses. */
class FakeTrack {
	mediaStreamTrack = { enabled: true } as MediaStreamTrack;
	isMuted = false;
	#listeners = new Map<string, (() => void)[]>();

	on(event: string, listener: () => void) {
		this.#listeners.set(event, [...(this.#listeners.get(event) ?? []), listener]);
		return this;
	}

	emit(event: string) {
		for (const listener of this.#listeners.get(event) ?? []) listener();
	}

	/** What LiveKit does when it opens a new capture, e.g. after switching microphones. */
	restart() {
		this.mediaStreamTrack = { enabled: !this.isMuted } as MediaStreamTrack;
		this.emit(TrackEvent.Restarted);
	}

	mute() {
		this.isMuted = true;
		this.mediaStreamTrack.enabled = false;
		this.emit(TrackEvent.Muted);
	}

	unmute() {
		this.isMuted = false;
		this.mediaStreamTrack.enabled = true;
		this.emit(TrackEvent.Unmuted);
	}
}

function warmUp(track: FakeTrack) {
	warmUpMicrophone(track as unknown as LocalAudioTrack);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('warmUpMicrophone', () => {
	it('sends silence until a fresh microphone has settled', () => {
		const track = new FakeTrack();
		warmUp(track);
		expect(track.mediaStreamTrack.enabled).toBe(false);
		vi.advanceTimersByTime(MIC_WARMUP_MS - 1);
		expect(track.mediaStreamTrack.enabled).toBe(false);
		vi.advanceTimersByTime(1);
		expect(track.mediaStreamTrack.enabled).toBe(true);
		// The track never looks muted to the others.
		expect(track.isMuted).toBe(false);
	});

	it('holds back a new capture after switching microphones', () => {
		const track = new FakeTrack();
		warmUp(track);
		vi.advanceTimersByTime(MIC_WARMUP_MS);
		track.restart();
		expect(track.mediaStreamTrack.enabled).toBe(false);
		vi.advanceTimersByTime(MIC_WARMUP_MS);
		expect(track.mediaStreamTrack.enabled).toBe(true);
	});

	it('restarts the warm-up when switching during it', () => {
		const track = new FakeTrack();
		warmUp(track);
		vi.advanceTimersByTime(MIC_WARMUP_MS / 2);
		track.restart();
		vi.advanceTimersByTime(MIC_WARMUP_MS / 2);
		expect(track.mediaStreamTrack.enabled).toBe(false);
		vi.advanceTimersByTime(MIC_WARMUP_MS / 2);
		expect(track.mediaStreamTrack.enabled).toBe(true);
	});

	it('keeps the microphone off when muted during the warm-up', () => {
		const track = new FakeTrack();
		warmUp(track);
		track.mute();
		vi.advanceTimersByTime(MIC_WARMUP_MS);
		expect(track.mediaStreamTrack.enabled).toBe(false);
	});

	it('stays silent when unmuted during the warm-up', () => {
		const track = new FakeTrack();
		warmUp(track);
		track.mute();
		track.unmute();
		expect(track.mediaStreamTrack.enabled).toBe(false);
		vi.advanceTimersByTime(MIC_WARMUP_MS);
		expect(track.mediaStreamTrack.enabled).toBe(true);
	});

	it('leaves later unmutes alone once settled', () => {
		const track = new FakeTrack();
		warmUp(track);
		vi.advanceTimersByTime(MIC_WARMUP_MS);
		track.mute();
		track.unmute();
		expect(track.mediaStreamTrack.enabled).toBe(true);
	});
});
