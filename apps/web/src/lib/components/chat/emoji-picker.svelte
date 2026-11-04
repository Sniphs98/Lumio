<script lang="ts">
	import { SmilePlus } from '@lucide/svelte';
	import EmojiPanel from '#lib/components/chat/emoji-panel.svelte';
	import { Button } from '#lib/components/ui/button/index.ts';
	import * as Popover from '#lib/components/ui/popover/index.ts';

	let { onpick }: { onpick: (emoji: string) => void } = $props();

	let open = $state(false);
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="ghost" size="icon" class="size-7" aria-label="Add reaction">
				<SmilePlus class="size-4" />
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content side="top" align="end" class="w-80 max-w-[calc(100vw-1rem)] p-2">
		<EmojiPanel
			actionLabel={(label) => `React with ${label}`}
			onpick={(emoji) => {
				open = false;
				onpick(emoji);
			}}
		/>
	</Popover.Content>
</Popover.Root>
