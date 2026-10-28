<script lang="ts">
	import { Hash, Volume2 } from '@lucide/svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<aside class="flex w-full shrink-0 flex-col overflow-y-auto p-3 md:w-60 md:border-r">
	<h1 class="px-2 pb-3 font-semibold">{data.server.name}</h1>
	<ul class="grid gap-0.5">
		{#each data.channels.filter((c) => c.type !== 'category') as c (c.id)}
			<li
				class="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
			>
				{#if c.type === 'voice'}<Volume2 class="size-4" />{:else}<Hash class="size-4" />{/if}
				{c.name}
			</li>
		{/each}
	</ul>
</aside>

<main class="hidden flex-1 items-center justify-center text-muted-foreground md:flex">
	Select a channel.
</main>
