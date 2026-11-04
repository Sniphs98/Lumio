<script lang="ts">
	import GifPanel from '#lib/components/chat/gif-panel.svelte';
	import { Button } from '#lib/components/ui/button/index.ts';
	import * as Popover from '#lib/components/ui/popover/index.ts';
	import * as Tooltip from '#lib/components/ui/tooltip/index.ts';
	import type { GifResult } from '#lib/gifs.ts';

	type Props = {
		/** The configured GIF service. */
		provider: 'giphy' | 'tenor';
		/** Sends a GIF right away. */
		onpick: (gif: GifResult) => void;
		/** Called after the picker closed, e.g. to focus the composer again. */
		onclose?: () => void;
	};

	let { provider, onpick, onclose }: Props = $props();

	let open = $state(false);
</script>

<Popover.Root bind:open>
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props: tooltipProps })}
				<Popover.Trigger {...tooltipProps}>
					{#snippet child({ props })}
						<Button
							{...props}
							type="button"
							variant="ghost"
							size="icon"
							class="text-xs font-bold tracking-tight"
							aria-label="GIFs"
						>
							GIF
						</Button>
					{/snippet}
				</Popover.Trigger>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content>Send a GIF</Tooltip.Content>
	</Tooltip.Root>
	<Popover.Content
		side="top"
		align="end"
		class="w-80 max-w-[calc(100vw-1rem)] p-2"
		onCloseAutoFocus={(event) => {
			if (!onclose) return;
			event.preventDefault();
			onclose();
		}}
	>
		<GifPanel
			{provider}
			onpick={(gif) => {
				open = false;
				onpick(gif);
			}}
		/>
	</Popover.Content>
</Popover.Root>
