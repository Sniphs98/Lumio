<script lang="ts">
	import { MicOff } from '@lucide/svelte';
	import type { Attachment } from 'svelte/attachments';
	import { initials } from '#lib/calls.ts';
	import type { AttachableTrack, CallParticipant } from '#lib/call.svelte.ts';
	import * as Avatar from '#lib/components/ui/avatar/index.ts';
	import UserContextMenu from '#lib/components/users/user-context-menu.svelte';
	import { cn } from '#lib/utils.ts';

	let { participants, class: className }: { participants: CallParticipant[]; class?: string } =
		$props();

	type Tile = { key: string; participant: CallParticipant; kind: 'screen' | 'person' };

	// Screen shares come first and get their own large tile next to the person sharing.
	const tiles = $derived<Tile[]>([
		...participants
			.filter((p) => p.screen)
			.map((p) => ({ key: `${p.identity}:screen`, participant: p, kind: 'screen' as const })),
		...participants.map((p) => ({ key: p.identity, participant: p, kind: 'person' as const }))
	]);
	const hasScreen = $derived(tiles.some((t) => t.kind === 'screen'));

	function video(track: AttachableTrack): Attachment<HTMLVideoElement> {
		return (element) => {
			track.attach(element);
			return () => track.detach(element);
		};
	}
</script>

<ul
	class={cn(
		'grid auto-rows-fr gap-2 p-2',
		hasScreen
			? 'grid-cols-2 md:grid-cols-4'
			: 'grid-cols-2 md:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]',
		className
	)}
	aria-label="Participants"
>
	{#each tiles as tile (tile.key)}
		{@const p = tile.participant}
		<UserContextMenu user={{ id: p.identity, name: p.name }}>
			{#snippet child({ props })}
				<li
					{...props}
					class={cn(
						'relative flex min-h-24 items-center justify-center overflow-hidden rounded-lg bg-muted',
						tile.kind === 'screen' && 'col-span-2 row-span-2 bg-black md:col-span-3',
						tile.kind === 'person' && p.speaking && 'ring-2 ring-emerald-500'
					)}
					aria-label={tile.kind === 'screen' ? `${p.name}'s screen` : p.name}
					data-speaking={tile.kind === 'person' ? p.speaking : undefined}
				>
					{#if tile.kind === 'screen' && p.screen}
						{#key p.screen}
							<video
								{@attach video(p.screen)}
								class="size-full object-contain"
								autoplay
								playsinline
								muted
							></video>
						{/key}
					{:else if p.camera}
						{#key p.camera}
							<video
								{@attach video(p.camera)}
								class={cn('size-full object-cover', p.isLocal && '-scale-x-100')}
								autoplay
								playsinline
								muted
							></video>
						{/key}
					{:else}
						<Avatar.Root class="size-14" aria-hidden="true">
							<Avatar.Fallback class="bg-background text-lg font-semibold text-foreground">
								{initials(p.name)}
							</Avatar.Fallback>
						</Avatar.Root>
					{/if}
					<span
						class="absolute bottom-1.5 left-1.5 flex max-w-[calc(100%-0.75rem)] items-center gap-1 rounded bg-background/80 px-1.5 py-0.5 text-xs"
					>
						{#if tile.kind === 'person' && p.micMuted}
							<MicOff class="size-3 shrink-0 text-destructive" aria-label="Muted" />
						{/if}
						<span class="truncate">
							{tile.kind === 'screen'
								? `${p.name}'s screen`
								: p.isLocal
									? `${p.name} (you)`
									: p.name}
						</span>
					</span>
				</li>
			{/snippet}
		</UserContextMenu>
	{/each}
</ul>
