import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import MessageContent from './message-content.svelte';

describe('MessageContent', () => {
	it('shows mentions by name and makes mentions of the user stand out', async () => {
		const { container } = await render(MessageContent, {
			content: 'hey <@ben>, ask <@me> or <@gone>',
			mentions: [
				{ id: 'ben', name: 'Ben' },
				{ id: 'me', name: 'Lukas' }
			],
			meId: 'me'
		});

		await expect.element(page.getByText('hey @Ben, ask @Lukas or @unknown')).toBeVisible();
		const mine = container.querySelector('[data-mention="me"]');
		const other = container.querySelector('[data-mention="ben"]');
		expect(mine?.className).toContain('amber');
		expect(other?.className).not.toContain('amber');
	});

	it('shows plain text as it is', async () => {
		await render(MessageContent, { content: '<b>not html</b>', mentions: [] });
		await expect.element(page.getByText('<b>not html</b>')).toBeVisible();
	});

	it('shows a message that is only a GIF address as the GIF, loaded through Lumio', async () => {
		const url = 'https://media.tenor.com/abc/cat.gif';
		await render(MessageContent, { content: url, mentions: [] });
		const img = page.getByRole('img', { name: 'GIF' });
		await expect.element(img).toBeInTheDocument();
		expect(img.element().getAttribute('src')).toBe(
			`/api/gifs/media?url=${encodeURIComponent(url)}`
		);
	});

	it('keeps GIF addresses within text as text', async () => {
		await render(MessageContent, {
			content: 'see https://media.tenor.com/abc/cat.gif',
			mentions: []
		});
		await expect.element(page.getByText('see https://media.tenor.com/abc/cat.gif')).toBeVisible();
	});
});
