import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import IncomingCall from './incoming-call.svelte';

const caller = { id: 'anna', name: 'Anna' };

describe('IncomingCall', () => {
	it('shows who is calling and joins or dismisses', async () => {
		const onjoin = vi.fn();
		const ondismiss = vi.fn();
		render(IncomingCall, {
			ringing: { type: 'call.ringing', conversationId: 'c1', title: 'Anna', caller },
			onjoin,
			ondismiss
		});

		await expect
			.element(page.getByRole('alertdialog', { name: 'Incoming call' }))
			.toHaveTextContent('Anna is calling you');
		await page.getByRole('button', { name: 'Join' }).click();
		await page.getByRole('button', { name: 'Dismiss call' }).click();
		expect(onjoin).toHaveBeenCalledOnce();
		expect(ondismiss).toHaveBeenCalledOnce();
	});

	it('names the group for group calls', async () => {
		render(IncomingCall, {
			ringing: { type: 'call.ringing', conversationId: 'g1', title: 'Raid night', caller },
			onjoin: () => {},
			ondismiss: () => {}
		});

		await expect
			.element(page.getByRole('alertdialog'))
			.toHaveTextContent('Anna started a call in Raid night');
	});
});
