import { describe, expect, it } from 'vitest';
import type { ActivityEvent } from '#lib/chat.ts';
import {
	DEFAULT_SOUND_SETTINGS,
	parseSoundSettings,
	shouldPlayMessageSound,
	soundLength,
	SOUNDS
} from '#lib/sounds.ts';

describe('SOUNDS', () => {
	it('keeps every cue short and quiet', () => {
		for (const recipe of Object.values(SOUNDS)) {
			expect(recipe.notes.length).toBeGreaterThan(0);
			expect(soundLength(recipe)).toBeLessThanOrEqual(0.5);
			expect(recipe.gain).toBeGreaterThan(0);
			expect(recipe.gain).toBeLessThanOrEqual(0.5);
		}
	});

	it('rises for joining and falls for leaving', () => {
		const pitches = (name: keyof typeof SOUNDS) => SOUNDS[name].notes.map((n) => n.frequency);
		const join = pitches('participant.join');
		const leave = pitches('participant.leave');
		expect(join[0]).toBeLessThan(join.at(-1)!);
		expect(leave[0]).toBeGreaterThan(leave.at(-1)!);
		expect(pitches('unmute')).toEqual(pitches('mute').toReversed());
	});
});

describe('parseSoundSettings', () => {
	it('falls back to the defaults', () => {
		expect(parseSoundSettings(null)).toEqual(DEFAULT_SOUND_SETTINGS);
		expect(parseSoundSettings('not json')).toEqual(DEFAULT_SOUND_SETTINGS);
		expect(parseSoundSettings('{"enabled":"yes","volume":"loud"}')).toEqual(DEFAULT_SOUND_SETTINGS);
	});

	it('reads stored settings and clamps the volume', () => {
		expect(parseSoundSettings('{"enabled":false,"volume":0.3}')).toEqual({
			enabled: false,
			volume: 0.3
		});
		expect(parseSoundSettings('{"volume":4}').volume).toBe(1);
		expect(parseSoundSettings('{"volume":-1}').volume).toBe(0);
	});
});

describe('shouldPlayMessageSound', () => {
	const elsewhere = { id: 'other', visible: true };
	const dm: ActivityEvent = {
		type: 'message.activity',
		authorId: 'friend',
		mentionIds: [],
		channelId: null,
		conversationId: 'dm1'
	};
	const channel: ActivityEvent = {
		type: 'message.activity',
		authorId: 'friend',
		mentionIds: [],
		channelId: 'c1',
		conversationId: null
	};

	it('plays for every message in a conversation', () => {
		expect(shouldPlayMessageSound(dm, 'me', elsewhere)).toBe(true);
	});

	it('plays for channel messages only when they mention the user', () => {
		expect(shouldPlayMessageSound(channel, 'me', elsewhere)).toBe(false);
		expect(shouldPlayMessageSound({ ...channel, mentionIds: ['me'] }, 'me', elsewhere)).toBe(true);
	});

	it('stays silent for own messages', () => {
		expect(shouldPlayMessageSound({ ...dm, authorId: 'me' }, 'me', elsewhere)).toBe(false);
	});

	it('stays silent in the open chat unless the page is hidden', () => {
		expect(shouldPlayMessageSound(dm, 'me', { id: 'dm1', visible: true })).toBe(false);
		expect(shouldPlayMessageSound(dm, 'me', { id: 'dm1', visible: false })).toBe(true);
	});
});
