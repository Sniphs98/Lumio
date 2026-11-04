<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { gifMediaPath, MAX_GIF_QUERY_LENGTH, type GifPage, type GifResult } from '#lib/gifs.ts';

	type Props = {
		/** The configured GIF service, credited below the results as its terms ask. */
		provider: 'giphy' | 'tenor';
		onpick: (gif: GifResult) => void;
	};

	let { provider, onpick }: Props = $props();

	const providerName = $derived(provider === 'giphy' ? 'GIPHY' : 'Tenor');

	let query = $state('');
	let results: GifResult[] = $state([]);
	let next: string | null = $state(null);
	let loading = $state(false);
	let failed = $state(false);
	/** Counts searches, so answers to an older search are dropped. */
	let generation = 0;

	async function load(search: string, more: boolean) {
		const current = more ? generation : ++generation;
		loading = true;
		failed = false;
		const params = `q=${encodeURIComponent(search)}${more && next ? `&next=${encodeURIComponent(next)}` : ''}`;
		try {
			const response = await fetch(`/api/gifs?${params}`);
			if (!response.ok) throw new Error(String(response.status));
			const page = (await response.json()) as GifPage;
			if (current !== generation) return;
			const known = new Set(more ? results.map((r) => r.id) : []);
			results = [...(more ? results : []), ...page.results.filter((r) => !known.has(r.id))];
			next = page.next;
		} catch {
			if (current === generation) failed = true;
		} finally {
			if (current === generation) loading = false;
		}
	}

	// Searches while typing, once the user pauses; an empty search shows trending GIFs.
	$effect(() => {
		const search = query.trim();
		const timer = setTimeout(() => load(search, false), search ? 350 : 0);
		return () => clearTimeout(timer);
	});
</script>

<div class="flex flex-col gap-2">
	<Input
		type="search"
		bind:value={query}
		maxlength={MAX_GIF_QUERY_LENGTH}
		placeholder="Search {providerName}"
		aria-label="Search GIFs"
		autocomplete="off"
	/>
	<div class="h-72 overflow-y-auto" aria-busy={loading}>
		{#if results.length > 0}
			<ul class="columns-2 gap-1" aria-label="GIFs">
				{#each results as gif (gif.id)}
					<li class="mb-1 break-inside-avoid">
						<Button
							variant="ghost"
							class="block h-auto w-full overflow-hidden rounded-md bg-muted p-0"
							aria-label="Send GIF: {gif.title}"
							onclick={() => onpick(gif)}
						>
							<img
								src={gifMediaPath(gif.preview)}
								alt={gif.title}
								loading="lazy"
								width={gif.width}
								height={gif.height}
								class="h-auto w-full"
							/>
						</Button>
					</li>
				{/each}
			</ul>
			{#if next}
				<Button
					variant="ghost"
					size="sm"
					class="mt-1 w-full"
					disabled={loading}
					onclick={() => load(query.trim(), true)}
				>
					{loading ? 'Loading…' : 'Load more'}
				</Button>
			{/if}
		{:else if failed}
			<p class="py-8 text-center text-sm text-destructive">Could not load GIFs.</p>
		{:else if loading}
			<p class="py-8 text-center text-sm text-muted-foreground">Loading GIFs…</p>
		{:else}
			<p class="py-8 text-center text-sm text-muted-foreground">No GIFs found.</p>
		{/if}
	</div>
	<p class="text-right text-xs text-muted-foreground">Powered by {providerName}</p>
</div>
