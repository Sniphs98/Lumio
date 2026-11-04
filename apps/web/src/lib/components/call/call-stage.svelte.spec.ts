import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import type { AttachableTrack, CallParticipant, StreamControls } from '#lib/call.svelte.ts';
import CallStage from './call-stage.svelte';

function person(name: string, overrides: Partial<CallParticipant> = {}): CallParticipant {
	return {
		identity: name.toLowerCase(),
		name,
		isLocal: false,
		speaking: false,
		micMuted: false,
		camera: null,
		streaming: false,
		watching: false,
		screen: null,
		...overrides
	};
}

function fakeTrack(): AttachableTrack {
	return { attach: vi.fn((el) => el), detach: vi.fn((el) => el) };
}

function fakeStreams(): StreamControls {
	return { watchStream: vi.fn(), stopWatching: vi.fn() };
}

describe('CallStage', () => {
	it('shows a tile per participant with initials, mute state and the speaker', async () => {
		await render(CallStage, {
			participants: [
				person('Anna Berg', { isLocal: true }),
				person('Ben', { micMuted: true, speaking: true })
			]
		});

		const anna = page.getByRole('listitem', { name: 'Anna Berg' });
		await expect.element(anna).toMatchTextContent('AB');
		await expect.element(anna).toMatchTextContent('Anna Berg (you)');
		const ben = page.getByRole('listitem', { name: 'Ben' });
		await expect.element(ben).toHaveAttribute('data-speaking', 'true');
		await expect.element(ben.getByLabelText('Muted')).toBeInTheDocument();
	});

	it('shows a screen share as its own tile and attaches the track', async () => {
		const screen = fakeTrack();
		const { unmount } = await render(CallStage, {
			participants: [person('Ben', { streaming: true, watching: true, screen })]
		});

		await expect.element(page.getByRole('listitem', { name: "Ben's screen" })).toBeVisible();
		await expect.element(page.getByRole('listitem', { name: 'Ben', exact: true })).toBeVisible();
		expect(screen.attach).toHaveBeenCalledWith(expect.any(HTMLVideoElement));

		unmount();
		expect(screen.detach).toHaveBeenCalledOnce();
	});

	it('only receives a stream once the user chooses to watch it, then shows it large', async () => {
		const streams = fakeStreams();
		const ben = person('Ben', { streaming: true });
		const { rerender } = await render(CallStage, {
			participants: [person('Anna', { isLocal: true }), ben],
			streams
		});

		const tile = page.getByRole('listitem', { name: "Ben's screen" });
		await expect.element(tile).toMatchTextContent('Ben is sharing their screen.');
		await expect
			.element(page.getByRole('listitem', { name: 'Ben', exact: true }))
			.toMatchTextContent(/Ben\s*LIVE/);
		await tile.getByRole('button', { name: 'Watch stream' }).click();
		expect(streams.watchStream).toHaveBeenCalledWith('ben');

		await rerender({
			participants: [
				person('Anna', { isLocal: true }),
				{ ...ben, watching: true, screen: fakeTrack() }
			]
		});
		await expect.element(tile).toHaveAttribute('aria-current', 'true');
		await tile.getByRole('button', { name: 'Show everyone' }).click();
		await expect.element(tile).not.toHaveAttribute('aria-current');
		await tile.getByRole('button', { name: 'Focus stream' }).click();
		await expect.element(tile).toHaveAttribute('aria-current', 'true');

		await tile.getByRole('button', { name: 'Stop watching' }).click();
		expect(streams.stopWatching).toHaveBeenCalledWith('ben');
		await expect.element(tile).not.toHaveAttribute('aria-current');
	});

	it('shows your own stream without a watch button', async () => {
		await render(CallStage, {
			participants: [
				person('Anna', { isLocal: true, streaming: true, watching: true, screen: fakeTrack() })
			],
			streams: fakeStreams()
		});

		const tile = page.getByRole('listitem', { name: "Anna's screen" });
		await expect.element(tile.getByRole('button', { name: 'Full screen' })).toBeInTheDocument();
		await expect
			.element(tile.getByRole('button', { name: 'Stop watching' }))
			.not.toBeInTheDocument();
		await expect
			.element(tile.getByRole('button', { name: 'Watch stream' }))
			.not.toBeInTheDocument();
	});

	it('shows who this user muted or turned down for themselves', async () => {
		const audio = {
			userAudioOf: (id: string) =>
				({
					ben: { volume: 1, muted: true },
					cleo: { volume: 0.4, muted: false },
					dave: { volume: 1.5, muted: false }
				})[id] ?? { volume: 1, muted: false }
		};
		await render(CallStage, {
			participants: [
				person('Anna', { isLocal: true }),
				person('Ben'),
				person('Cleo'),
				person('Dave')
			],
			audio
		});

		await expect
			.element(page.getByRole('listitem', { name: 'Ben' }).getByLabelText('Muted for you'))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('listitem', { name: 'Cleo' }).getByLabelText('Volume 40% for you'))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('listitem', { name: 'Dave' }).getByLabelText('Volume 150% for you'))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('listitem', { name: 'Anna' }).getByLabelText(/for you/))
			.not.toBeInTheDocument();
	});
});
