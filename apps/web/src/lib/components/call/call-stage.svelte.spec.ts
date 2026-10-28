import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import type { AttachableTrack, CallParticipant } from '#lib/call.svelte.ts';
import CallStage from './call-stage.svelte';

function person(name: string, overrides: Partial<CallParticipant> = {}): CallParticipant {
	return {
		identity: name.toLowerCase(),
		name,
		isLocal: false,
		speaking: false,
		micMuted: false,
		camera: null,
		screen: null,
		...overrides
	};
}

function fakeTrack(): AttachableTrack {
	return { attach: vi.fn((el) => el), detach: vi.fn((el) => el) };
}

describe('CallStage', () => {
	it('shows a tile per participant with initials, mute state and the speaker', async () => {
		render(CallStage, {
			participants: [
				person('Anna Berg', { isLocal: true }),
				person('Ben', { micMuted: true, speaking: true })
			]
		});

		const anna = page.getByRole('listitem', { name: 'Anna Berg' });
		await expect.element(anna).toHaveTextContent('AB');
		await expect.element(anna).toHaveTextContent('Anna Berg (you)');
		const ben = page.getByRole('listitem', { name: 'Ben' });
		await expect.element(ben).toHaveAttribute('data-speaking', 'true');
		await expect.element(ben.getByLabelText('Muted')).toBeInTheDocument();
	});

	it('shows a screen share as its own tile and attaches the track', async () => {
		const screen = fakeTrack();
		const { unmount } = render(CallStage, { participants: [person('Ben', { screen })] });

		await expect.element(page.getByRole('listitem', { name: "Ben's screen" })).toBeVisible();
		await expect.element(page.getByRole('listitem', { name: 'Ben', exact: true })).toBeVisible();
		expect(screen.attach).toHaveBeenCalledWith(expect.any(HTMLVideoElement));

		unmount();
		expect(screen.detach).toHaveBeenCalledOnce();
	});
});
