<script lang="ts">
	import { Expand, Eye, EyeOff, Maximize2, MicOff, Minimize2, Shrink } from '@lucide/svelte';
	import type { Attachment } from 'svelte/attachments';
	import { initials } from '#lib/calls.ts';
	import {
		call,
		type AttachableTrack,
		type CallParticipant,
		type StreamControls,
		type UserAudioControls
	} from '#lib/call.svelte.ts';
	import * as Avatar from '#lib/components/ui/avatar/index.ts';
	import { Badge } from '#lib/components/ui/badge/index.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import * as Tooltip from '#lib/components/ui/tooltip/index.ts';
	import UserAudioIcon from '#lib/components/users/user-audio-icon.svelte';
	import UserContextMenu from '#lib/components/users/user-context-menu.svelte';
	import { cn } from '#lib/utils.ts';

	let {
		participants,
		audio = call,
		streams = call,
		focused = $bindable(null),
		class: className
	}: {
		participants: CallParticipant[];
		/** Who this user turned down or muted for themselves. Tests pass a fake. */
		audio?: Pick<UserAudioControls, 'userAudioOf'>;
		/** Watching screen shares. Tests pass a fake. */
		streams?: StreamControls;
		/** Identity of the person whose stream is shown large above everyone else. */
		focused?: string | null;
		class?: string;
	} = $props();

	type Tile = { key: string; participant: CallParticipant; kind: 'screen' | 'person' };

	// Screen shares come first and get their own large tile next to the person sharing.
	const tiles = $derived<Tile[]>([
		...participants
			.filter((p) => p.streaming)
			.map((p) => ({ key: `${p.identity}:screen`, participant: p, kind: 'screen' as const })),
		...participants.map((p) => ({ key: p.identity, participant: p, kind: 'person' as const }))
	]);
	const hasScreen = $derived(tiles.some((t) => t.kind === 'screen'));

	// Focus ends on its own when the stream does.
	$effect(() => {
		if (focused && !participants.some((p) => p.identity === focused && p.streaming)) {
			focused = null;
		}
	});
	const focusedKey = $derived(focused ? `${focused}:screen` : null);

	/** Key of the tile shown full screen, if any. */
	let fullscreenKey = $state<string | null>(null);

	function video(track: AttachableTrack): Attachment<HTMLVideoElement> {
		return (element) => {
			track.attach(element);
			return () => track.detach(element);
		};
	}

	function watch(p: CallParticipant) {
		streams.watchStream(p.identity);
		// Like in Discord, the stream you start watching is shown large.
		focused = p.identity;
	}

	function stopWatching(p: CallParticipant) {
		if (focused === p.identity) focused = null;
		streams.stopWatching(p.identity);
	}

	function toggleFocus(p: CallParticipant) {
		focused = focused === p.identity ? null : p.identity;
	}

	async function toggleFullscreen(tile: Element | null) {
		if (!tile) return;
		if (document.fullscreenElement === tile) {
			await document.exitFullscreen().catch(() => {});
			return;
		}
		if (tile.requestFullscreen) {
			await tile.requestFullscreen().catch(() => {});
			return;
		}
		// iPhone Safari can only show a video full screen, not other elements.
		const player = tile.querySelector('video') as
			(HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
		player?.webkitEnterFullscreen?.();
	}
</script>

<svelte:document
	onfullscreenchange={() =>
		(fullscreenKey =
			document.fullscreenElement instanceof HTMLElement
				? (document.fullscreenElement.dataset.tile ?? null)
				: null)}
/>

{#snippet control(label: string, onclick: (event: MouseEvent) => void, icon: typeof Eye)}
	{@const Icon = icon}
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					variant="secondary"
					size="icon"
					class="size-8 bg-background/80 backdrop-blur-sm"
					aria-label={label}
					{onclick}
				>
					<Icon />
				</Button>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content>{label}</Tooltip.Content>
	</Tooltip.Root>
{/snippet}

<ul
	class={cn(
		'grid gap-2 p-2',
		focusedKey
			? 'grid-cols-3 md:grid-cols-6'
			: hasScreen
				? 'auto-rows-fr grid-cols-2 md:grid-cols-4'
				: 'auto-rows-fr grid-cols-2 md:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]',
		className
	)}
	aria-label="Participants"
>
	{#each tiles as tile (tile.key)}
		{@const p = tile.participant}
		{@const isFocused = tile.key === focusedKey}
		{@const isFullscreen = tile.key === fullscreenKey}
		<UserContextMenu user={{ id: p.identity, name: p.name }} voice={!p.isLocal}>
			{#snippet child({ props })}
				<li
					{...props}
					class={cn(
						'group relative flex items-center justify-center overflow-hidden rounded-lg bg-muted',
						focusedKey ? 'aspect-video' : 'min-h-24',
						tile.kind === 'screen' && 'bg-black',
						tile.kind === 'screen' && !focusedKey && 'col-span-2 row-span-2 md:col-span-3',
						isFocused && 'order-first col-span-full max-h-[75vh] w-full',
						tile.kind === 'person' && p.speaking && 'ring-2 ring-emerald-500'
					)}
					aria-label={tile.kind === 'screen' ? `${p.name}'s screen` : p.name}
					aria-current={isFocused ? 'true' : undefined}
					data-tile={tile.key}
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
								ondblclick={(e) => toggleFullscreen(e.currentTarget.closest('li'))}
							></video>
						{/key}
						<div
							class="absolute top-1.5 right-1.5 flex gap-1 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
						>
							{@render control(
								isFocused ? 'Show everyone' : 'Focus stream',
								() => toggleFocus(p),
								isFocused ? Minimize2 : Maximize2
							)}
							{@render control(
								isFullscreen ? 'Exit full screen' : 'Full screen',
								(e) => toggleFullscreen((e.currentTarget as Element).closest('li')),
								isFullscreen ? Shrink : Expand
							)}
							{#if !p.isLocal}
								{@render control('Stop watching', () => stopWatching(p), EyeOff)}
							{/if}
						</div>
					{:else if tile.kind === 'screen'}
						<div class="flex flex-col items-center gap-2 p-3 text-center text-white">
							<Badge class="rounded bg-red-600 px-1.5 font-semibold text-white">LIVE</Badge>
							{#if p.watching}
								<p class="text-sm text-white/70">Loading stream…</p>
							{:else}
								<p class="text-sm text-white/70">{p.name} is sharing their screen.</p>
								<Button size="sm" variant="secondary" onclick={() => watch(p)}>
									<Eye />
									Watch stream
								</Button>
							{/if}
						</div>
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
							{#if p.image}
								<Avatar.Image src={p.image} alt="" />
							{/if}
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
						{#if tile.kind === 'person' && !p.isLocal}
							<UserAudioIcon audio={audio.userAudioOf(p.identity)} class="size-3" />
						{/if}
						<span class="truncate">
							{tile.kind === 'screen'
								? `${p.name}'s screen`
								: p.isLocal
									? `${p.name} (you)`
									: p.name}
						</span>
						{#if tile.kind === 'person' && p.streaming}
							<Badge
								class="h-4 rounded bg-red-600 px-1 text-[0.625rem] font-semibold text-white"
								aria-label="Sharing their screen">LIVE</Badge
							>
						{/if}
					</span>
				</li>
			{/snippet}
		</UserContextMenu>
	{/each}
</ul>
