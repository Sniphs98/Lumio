<script lang="ts">
	import { SmilePlus } from '@lucide/svelte';
	import { Button } from '#lib/components/ui/button/index.ts';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.ts';
	import { QUICK_REACTIONS } from '#lib/reactions.ts';

	let { onpick }: { onpick: (emoji: string) => void } = $props();
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="ghost" size="icon" class="size-7" aria-label="Add reaction">
				<SmilePlus class="size-4" />
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content side="top" align="end" class="grid w-auto grid-cols-8 gap-0.5">
		{#each QUICK_REACTIONS as emoji (emoji)}
			<DropdownMenu.Item
				class="justify-center p-1 text-lg"
				aria-label="React with {emoji}"
				onSelect={() => onpick(emoji)}
			>
				{emoji}
			</DropdownMenu.Item>
		{/each}
	</DropdownMenu.Content>
</DropdownMenu.Root>
