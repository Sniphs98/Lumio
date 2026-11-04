<script lang="ts">
	import { Smile } from '@lucide/svelte';
	import EmojiPanel from '#lib/components/chat/emoji-panel.svelte';
	import GifPanel from '#lib/components/chat/gif-panel.svelte';
	import { Button } from '#lib/components/ui/button/index.ts';
	import * as Popover from '#lib/components/ui/popover/index.ts';
	import * as Tabs from '#lib/components/ui/tabs/index.ts';
	import type { GifResult } from '#lib/gifs.ts';

	type Props = {
		/** Adds an emoji to the draft. The picker stays open, so several can be added. */
		onemoji: (emoji: string) => void;
		/** Sends a GIF right away. */
		ongif: (gif: GifResult) => void;
		/** The configured GIF service; without one, only emojis are offered. */
		gifProvider: 'giphy' | 'tenor' | null;
		/** Called after the picker closed, e.g. to focus the composer again. */
		onclose?: () => void;
	};

	let { onemoji, ongif, gifProvider, onclose }: Props = $props();

	let open = $state(false);
	let tab = $state('emoji');
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				type="button"
				variant="ghost"
				size="icon"
				aria-label={gifProvider ? 'Emojis and GIFs' : 'Emojis'}
			>
				<Smile />
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content
		side="top"
		align="end"
		class="w-80 max-w-[calc(100vw-1rem)] p-2"
		onCloseAutoFocus={(event) => {
			// The composer takes the focus back instead of this button.
			if (!onclose) return;
			event.preventDefault();
			onclose();
		}}
	>
		{#if gifProvider}
			<Tabs.Root bind:value={tab} class="gap-2">
				<Tabs.List class="w-full">
					<Tabs.Trigger value="emoji">Emoji</Tabs.Trigger>
					<Tabs.Trigger value="gif">GIFs</Tabs.Trigger>
				</Tabs.List>
				<Tabs.Content value="emoji">
					{#if tab === 'emoji'}
						<EmojiPanel onpick={onemoji} />
					{/if}
				</Tabs.Content>
				<Tabs.Content value="gif">
					{#if tab === 'gif'}
						<GifPanel
							provider={gifProvider}
							onpick={(gif) => {
								open = false;
								ongif(gif);
							}}
						/>
					{/if}
				</Tabs.Content>
			</Tabs.Root>
		{:else}
			<EmojiPanel onpick={onemoji} />
		{/if}
	</Popover.Content>
</Popover.Root>
