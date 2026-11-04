<script lang="ts">
	import { Smile } from '@lucide/svelte';
	import EmojiPanel from '#lib/components/chat/emoji-panel.svelte';
	import { Button } from '#lib/components/ui/button/index.ts';
	import * as Popover from '#lib/components/ui/popover/index.ts';
	import * as Tooltip from '#lib/components/ui/tooltip/index.ts';

	type Props = {
		/** Adds an emoji to the draft. The picker stays open, so several can be added. */
		onemoji: (emoji: string) => void;
		/** Called after the picker closed, e.g. to focus the composer again. */
		onclose?: () => void;
	};

	let { onemoji, onclose }: Props = $props();
</script>

<Popover.Root>
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props: tooltipProps })}
				<Popover.Trigger {...tooltipProps}>
					{#snippet child({ props })}
						<Button {...props} type="button" variant="ghost" size="icon" aria-label="Emojis">
							<Smile />
						</Button>
					{/snippet}
				</Popover.Trigger>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content>Emojis</Tooltip.Content>
	</Tooltip.Root>
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
		<EmojiPanel onpick={onemoji} />
	</Popover.Content>
</Popover.Root>
