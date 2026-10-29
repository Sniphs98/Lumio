import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import VoiceMembers from './voice-members.svelte';

describe('VoiceMembers', () => {
	it('lists who is in a voice channel with mute, screen share and speaking state', async () => {
		render(VoiceMembers, {
			label: 'In Lounge',
			members: [
				{ id: 'anna', name: 'Anna', muted: false, streaming: false, speaking: true },
				{ id: 'ben', name: 'Ben', muted: true, streaming: true }
			]
		});

		const list = page.getByRole('list', { name: 'In Lounge' });
		const items = list.getByRole('listitem');
		await expect.element(items.nth(0)).toHaveTextContent('Anna');
		await expect.element(items.nth(0).getByLabelText('Muted')).not.toBeInTheDocument();
		await expect.element(items.nth(0)).toHaveAttribute('data-speaking', 'true');
		await expect.element(items.nth(1)).toHaveAttribute('data-speaking', 'false');
		await expect.element(items.nth(1)).toHaveTextContent(/Ben\s*LIVE/);
		await expect.element(items.nth(1).getByLabelText('Muted')).toBeInTheDocument();
	});

	it('shows who this user muted for themselves', async () => {
		render(VoiceMembers, {
			label: 'In Lounge',
			members: [
				{ id: 'anna', name: 'Anna', muted: false, streaming: false },
				{ id: 'ben', name: 'Ben', muted: false, streaming: false }
			],
			audio: { userAudioOf: (id) => ({ volume: 1, muted: id === 'ben' }) }
		});

		const items = page.getByRole('list', { name: 'In Lounge' }).getByRole('listitem');
		await expect.element(items.nth(1).getByLabelText('Muted for you')).toBeInTheDocument();
		await expect.element(items.nth(0).getByLabelText('Muted for you')).not.toBeInTheDocument();
		// Muted for this user only; Ben's own microphone is on.
		await expect
			.element(items.nth(1).getByLabelText('Muted', { exact: true }))
			.not.toBeInTheDocument();
	});
});
