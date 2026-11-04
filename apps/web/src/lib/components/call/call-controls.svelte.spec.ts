import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import type { CallControls as Controls } from '#lib/call.svelte.ts';
import CallControls from './call-controls.svelte';

function fakeCall(overrides: Partial<Controls> = {}): Controls {
	return {
		status: 'connected',
		target: { kind: 'channel', id: 'lounge', name: 'Lounge' },
		participants: [],
		muted: false,
		deafened: false,
		cameraOn: false,
		screenSharing: false,
		screenShareSupported: true,
		audioBlocked: false,
		error: null,
		canPublish: () => true,
		isIn: () => true,
		join: vi.fn(async () => {}),
		leave: vi.fn(async () => {}),
		toggleMute: vi.fn(async () => {}),
		toggleDeafen: vi.fn(),
		toggleCamera: vi.fn(async () => {}),
		toggleScreenShare: vi.fn(async () => {}),
		startAudio: vi.fn(async () => {}),
		dismissError: vi.fn(),
		...overrides
	};
}

describe('CallControls', () => {
	it('has every call action in one bar', async () => {
		const call = fakeCall();
		const ontogglechat = vi.fn();
		await render(CallControls, { call, chatOpen: false, ontogglechat });

		const bar = page.getByRole('toolbar', { name: 'Call controls' });
		await bar.getByRole('button', { name: 'Mute' }).click();
		await bar.getByRole('button', { name: 'Deafen' }).click();
		await bar.getByRole('button', { name: 'Turn on camera' }).click();
		await bar.getByRole('button', { name: 'Show chat' }).click();
		await bar.getByRole('button', { name: 'Hang up' }).click();

		expect(call.toggleMute).toHaveBeenCalledOnce();
		expect(call.toggleDeafen).toHaveBeenCalledOnce();
		expect(call.toggleCamera).toHaveBeenCalledOnce();
		expect(ontogglechat).toHaveBeenCalledOnce();
		expect(call.leave).toHaveBeenCalledOnce();
	});

	it('shares the screen in the chosen quality and stops it directly', async () => {
		const call = fakeCall();
		const { rerender } = await render(CallControls, { call });

		await expect
			.element(page.getByRole('button', { name: 'Share screen' }))
			.toHaveTextContent('Share screen');
		await page.getByRole('button', { name: 'Share screen' }).click();
		await page.getByRole('menuitem', { name: '1080p, 60 fps' }).click();
		expect(call.toggleScreenShare).toHaveBeenCalledWith('1080p60');

		const sharing = fakeCall({ screenSharing: true });
		await rerender({ call: sharing });
		await page.getByRole('button', { name: 'Stop sharing' }).click();
		expect(sharing.toggleScreenShare).toHaveBeenCalledOnce();
	});

	it('shows the chat button only next to a chat, and what is on', async () => {
		await render(CallControls, {
			call: fakeCall({ muted: true, cameraOn: true }),
			chatOpen: true,
			ontogglechat: () => {}
		});

		await expect
			.element(page.getByRole('button', { name: 'Unmute' }))
			.toHaveAttribute('aria-pressed', 'true');
		await expect
			.element(page.getByRole('button', { name: 'Turn off camera' }))
			.toHaveAttribute('aria-pressed', 'true');
		await expect
			.element(page.getByRole('button', { name: 'Hide chat' }))
			.toHaveAttribute('aria-pressed', 'true');
	});

	it('leaves out what the user may not publish or the browser cannot do', async () => {
		await render(CallControls, {
			call: fakeCall({ canPublish: (s) => s === 'microphone', screenShareSupported: false })
		});

		await expect.element(page.getByRole('button', { name: 'Hang up' })).toBeVisible();
		await expect.element(page.getByRole('button', { name: /camera/ })).not.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: 'Share screen' }))
			.not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: /chat/ })).not.toBeInTheDocument();
	});
});
