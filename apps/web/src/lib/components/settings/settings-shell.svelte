<script lang="ts" module>
	import type { AudioLines } from '@lucide/svelte';

	/** One entry in the section list on the left. */
	export type SettingsShellSection<Id extends string> = {
		id: Id;
		label: string;
		icon: typeof AudioLines;
	};
</script>

<script lang="ts" generics="Id extends string">
	import { ArrowLeft } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import { Button } from '#lib/components/ui/button/index.ts';
	import * as Dialog from '#lib/components/ui/dialog/index.ts';
	import { cn } from '#lib/utils.ts';

	type Props = {
		/** The dialog's title, above the section list. */
		title: string;
		sections: SettingsShellSection<Id>[];
		open?: boolean;
		/** The section shown when the dialog opens. */
		section: Id;
		/** Renders the open section. */
		children: Snippet<[Id]>;
	};

	let {
		title,
		sections,
		open = $bindable(false),
		section = $bindable(),
		children
	}: Props = $props();

	const current = $derived(sections.find((s) => s.id === section) ?? sections[0]);

	// On phones the section list and the open section are separate screens. The dialog
	// opens on a section, the back button leads to the list.
	let showList = $state(false);
	$effect(() => {
		if (open) showList = false;
	});

	function select(id: Id) {
		section = id;
		showList = false;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content
		class="flex h-[min(42rem,calc(100dvh-2rem))] max-w-[calc(100%-2rem)] gap-0 overflow-hidden p-0 sm:max-w-3xl"
	>
		<nav
			class={cn(
				'w-full shrink-0 flex-col gap-1 bg-muted/40 p-3 md:flex md:w-52 md:border-r',
				showList ? 'flex' : 'hidden'
			)}
			aria-label="{title} sections"
		>
			<Dialog.Title class="px-2 pt-1 pb-2">{title}</Dialog.Title>
			{#each sections as s (s.id)}
				<Button
					variant="ghost"
					class={cn(
						'justify-start px-2 font-normal',
						s.id === current?.id ? 'bg-muted text-foreground' : 'text-muted-foreground'
					)}
					aria-current={s.id === current?.id ? 'page' : undefined}
					onclick={() => select(s.id)}
				>
					<s.icon />
					{s.label}
				</Button>
			{/each}
		</nav>

		<div class={cn('min-w-0 flex-1 flex-col md:flex', showList ? 'hidden' : 'flex')}>
			<header class="flex h-12 shrink-0 items-center gap-2 border-b px-3 pr-12 md:px-6">
				<Button
					variant="ghost"
					size="icon"
					class="-ml-1 size-8 md:hidden"
					aria-label="All {title.toLowerCase()}"
					onclick={() => (showList = true)}
				>
					<ArrowLeft />
				</Button>
				<h2 class="truncate font-semibold">{current?.label}</h2>
			</header>
			<div class="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
				{#if current}
					{@render children(current.id)}
				{/if}
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>
