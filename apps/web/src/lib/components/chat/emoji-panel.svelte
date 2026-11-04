<script lang="ts">
	import { Clock } from '@lucide/svelte';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import * as Tabs from '#lib/components/ui/tabs/index.ts';
	import {
		addRecent,
		EMOJI_GROUPS,
		frequentEmojis,
		loadEmojis,
		readRecent,
		saveRecent,
		searchEmojis,
		type Emoji
	} from '#lib/emoji.ts';

	type Props = {
		onpick: (emoji: string) => void;
		/** Accessible name of an emoji button, e.g. `React with thumbs up`. */
		actionLabel?: (label: string) => string;
	};

	let { onpick, actionLabel = (label) => label }: Props = $props();

	let emojis: Emoji[] = $state([]);
	let loadError = $state(false);
	let query = $state('');
	let tab = $state('frequent');
	let recent = $state(readRecent());
	/** The emoji under the pointer or focused, named below the grid. */
	let hovered: { emoji: string; label: string } | null = $state(null);

	const byEmoji = $derived(new Map(emojis.map((e) => [e.emoji, e])));
	const results = $derived(searchEmojis(emojis, query));
	const frequent = $derived(
		frequentEmojis(recent).map((emoji) => byEmoji.get(emoji) ?? { emoji, label: emoji })
	);

	$effect(() => {
		loadEmojis()
			.then((list) => (emojis = list))
			.catch(() => (loadError = true));
	});

	function pick(emoji: string) {
		recent = addRecent(recent, emoji);
		saveRecent(recent);
		onpick(emoji);
	}

	function inGroup(id: number) {
		return emojis.filter((e) => e.group === id);
	}
</script>

{#snippet grid(list: { emoji: string; label: string }[], label: string)}
	<div
		class="grid grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-0.5"
		role="group"
		aria-label={label}
	>
		{#each list as item (item.emoji)}
			<Button
				variant="ghost"
				size="icon"
				class="size-9 text-xl leading-none"
				aria-label={actionLabel(item.label)}
				onclick={() => pick(item.emoji)}
				onpointerenter={() => (hovered = item)}
				onfocus={() => (hovered = item)}
			>
				{item.emoji}
			</Button>
		{/each}
	</div>
{/snippet}

<div class="flex flex-col gap-2">
	<Input
		type="search"
		bind:value={query}
		placeholder="Search emojis"
		aria-label="Search emojis"
		autocomplete="off"
	/>
	{#if query.trim()}
		<div class="h-64 flex-none overflow-y-auto">
			{#if results.length > 0}
				{@render grid(results, 'Search results')}
			{:else}
				<p class="py-8 text-center text-sm text-muted-foreground">
					{emojis.length === 0 && !loadError ? 'Loading emojis…' : 'No emoji found.'}
				</p>
			{/if}
		</div>
	{:else}
		<Tabs.Root bind:value={tab} class="gap-2">
			<Tabs.List variant="line" class="w-full justify-between" aria-label="Emoji categories">
				<Tabs.Trigger value="frequent" class="px-0 text-base" aria-label="Frequently used">
					<Clock />
				</Tabs.Trigger>
				{#each EMOJI_GROUPS as group (group.id)}
					<Tabs.Trigger value={String(group.id)} class="px-0 text-base" aria-label={group.name}>
						{group.icon}
					</Tabs.Trigger>
				{/each}
			</Tabs.List>
			<Tabs.Content value="frequent" class="h-64 flex-none overflow-y-auto">
				{#if tab === 'frequent'}
					<p class="pb-1 text-xs font-medium text-muted-foreground">Frequently used</p>
					{@render grid(frequent, 'Frequently used')}
				{/if}
			</Tabs.Content>
			{#each EMOJI_GROUPS as group (group.id)}
				<Tabs.Content value={String(group.id)} class="h-64 flex-none overflow-y-auto">
					{#if tab === String(group.id)}
						<p class="pb-1 text-xs font-medium text-muted-foreground">{group.name}</p>
						{#if loadError}
							<p class="py-8 text-center text-sm text-destructive">Could not load emojis.</p>
						{:else if emojis.length === 0}
							<p class="py-8 text-center text-sm text-muted-foreground">Loading emojis…</p>
						{:else}
							{@render grid(inGroup(group.id), group.name)}
						{/if}
					{/if}
				</Tabs.Content>
			{/each}
		</Tabs.Root>
	{/if}
	<p class="flex h-6 items-center gap-2 truncate border-t pt-1 text-xs text-muted-foreground">
		{#if hovered}
			<span class="text-base leading-none">{hovered.emoji}</span>
			<span class="truncate">{hovered.label}</span>
		{/if}
	</p>
</div>
