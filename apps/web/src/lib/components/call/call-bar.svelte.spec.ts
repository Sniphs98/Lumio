import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import type { CallControls } from '#lib/call.svelte.ts';
import CallBar from './call-bar.svelte';

vi.mock('$app/paths', () => ({
	resolve: (route: string, params: Record<string, string> = {}) =>
		route.replace(/\/\([^)]+\)/g, '').replace(/\[(\w+)\]/g, (_, key: string) => params[key]) || '/'
}));

function fakeCall(overrides: Partial<CallControls> = {}): CallControls {
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

describe('CallBar', () => {
	it('is hidden while there is no call', async () => {
		render(CallBar, { call: fakeCall({ status: 'idle', target: null }) });
		await expect.element(page.getByRole('region', { name: 'Call' })).not.toBeInTheDocument();
	});

	it('shows the call and links back to it', async () => {
		render(CallBar, { call: fakeCall() });

		await expect.element(page.getByRole('status')).toHaveTextContent('Voice connected');
		await expect
			.element(page.getByRole('link', { name: /Lounge/ }))
			.toHaveAttribute('href', '/channels/lounge');
	});

	it('links conversation calls to the chat', async () => {
		render(CallBar, {
			call: fakeCall({ target: { kind: 'conversation', id: 'c1', name: 'Ben' } })
		});
		await expect.element(page.getByRole('link', { name: /Ben/ })).toHaveAttribute('href', '/dm/c1');
	});

	it('mutes, deafens and hangs up', async () => {
		const call = fakeCall();
		render(CallBar, { call });

		await page.getByRole('button', { name: 'Mute' }).click();
		await page.getByRole('button', { name: 'Deafen' }).click();
		await page.getByRole('button', { name: 'Hang up' }).click();

		expect(call.toggleMute).toHaveBeenCalledOnce();
		expect(call.toggleDeafen).toHaveBeenCalledOnce();
		expect(call.leave).toHaveBeenCalledOnce();
	});

	it('shows the muted and deafened state', async () => {
		render(CallBar, { call: fakeCall({ muted: true, deafened: true }) });

		await expect
			.element(page.getByRole('button', { name: 'Unmute' }))
			.toHaveAttribute('aria-pressed', 'true');
		await expect
			.element(page.getByRole('button', { name: 'Undeafen' }))
			.toHaveAttribute('aria-pressed', 'true');
	});

	it('offers 30 and 60 fps screen sharing', async () => {
		const call = fakeCall();
		render(CallBar, { call });

		await page.getByRole('button', { name: 'Share screen' }).click();
		await page.getByRole('menuitem', { name: '1080p, 60 fps' }).click();
		expect(call.toggleScreenShare).toHaveBeenCalledWith('1080p60');
	});

	it('stops a running screen share directly', async () => {
		const call = fakeCall({ screenSharing: true });
		render(CallBar, { call });

		await page.getByRole('button', { name: 'Stop sharing' }).click();
		expect(call.toggleScreenShare).toHaveBeenCalledOnce();
	});

	it('hides screen sharing where the browser cannot capture the screen', async () => {
		render(CallBar, { call: fakeCall({ screenShareSupported: false }) });

		await expect.element(page.getByRole('button', { name: 'Hang up' })).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Share screen' }))
			.not.toBeInTheDocument();
	});

	it('hides what the user may not publish', async () => {
		render(CallBar, { call: fakeCall({ canPublish: (s) => s === 'microphone' }) });

		await expect.element(page.getByRole('button', { name: 'Mute' })).toBeEnabled();
		await expect
			.element(page.getByRole('button', { name: 'Turn on camera' }))
			.not.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: 'Share screen' }))
			.not.toBeInTheDocument();
	});

	it('leaves mute and deafen to the user panel in the sidebar', async () => {
		const call = fakeCall();
		render(CallBar, { call, variant: 'panel' });
		const panel = page.getByRole('region', { name: 'Call' });

		await expect.element(panel.getByRole('status')).toHaveTextContent('Voice connected');
		await expect.element(panel.getByRole('button', { name: 'Mute' })).not.toBeInTheDocument();
		await expect.element(panel.getByRole('button', { name: 'Deafen' })).not.toBeInTheDocument();
		await expect.element(panel.getByRole('button', { name: 'Turn on camera' })).toBeVisible();
		await panel.getByRole('button', { name: 'Hang up' }).click();
		expect(call.leave).toHaveBeenCalledOnce();
	});

	it('keeps showing why a call ended until dismissed', async () => {
		const call = fakeCall({ status: 'idle', target: null, error: 'The call was disconnected.' });
		render(CallBar, { call });

		await expect.element(page.getByRole('alert')).toHaveTextContent('The call was disconnected.');
		await page.getByRole('button', { name: 'Dismiss' }).click();
		expect(call.dismissError).toHaveBeenCalledOnce();
	});
});
