<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { House, Plus } from '@lucide/svelte';
	import { cn } from '#lib/utils.ts';

	type ServerTab = { id: string; name: string; iconUrl: string | null };

	let { servers }: { servers: ServerTab[] } = $props();

	const isActive = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
</script>

<!-- Servers are shown as browser-like tabs instead of a vertical icon column. -->
<nav
	class="flex h-10 shrink-0 items-end gap-1 overflow-x-auto border-b bg-muted/40 px-2 pt-[env(safe-area-inset-top)]"
	aria-label="Servers"
>
	<a
		href={resolve('/(app)')}
		class={cn(
			'flex h-8 items-center gap-2 rounded-t-md px-3 text-sm',
			isActive('/')
				? 'bg-background text-foreground'
				: 'text-muted-foreground hover:bg-background/60'
		)}
	>
		<House class="size-4" />
		Home
	</a>
	{#each servers as s (s.id)}
		<a
			href={resolve('/(app)/s/[id]', { id: s.id })}
			class={cn(
				'flex h-8 max-w-48 items-center gap-2 truncate rounded-t-md px-3 text-sm',
				isActive(`/s/${s.id}`)
					? 'bg-background text-foreground'
					: 'text-muted-foreground hover:bg-background/60'
			)}
		>
			{#if s.iconUrl}
				<img src={s.iconUrl} alt="" class="size-4 rounded" />
			{/if}
			<span class="truncate">{s.name}</span>
		</a>
	{/each}
	<button
		type="button"
		class="mb-1 flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-background/60"
		aria-label="Join or create a server"
	>
		<Plus class="size-4" />
	</button>
</nav>
