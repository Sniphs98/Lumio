<script lang="ts">
	import { MicOff } from '@lucide/svelte';
	import type { VoiceMember } from '#lib/calls.ts';
	import { cn } from '#lib/utils.ts';

	type Member = VoiceMember & {
		/** Only known while the user is in the call too. */
		speaking?: boolean;
	};

	let {
		members,
		label,
		class: className
	}: { members: Member[]; label: string; class?: string } = $props();
</script>

<ul class={cn('grid gap-0.5', className)} aria-label={label}>
	{#each members as m (m.id)}
		<li
			class="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground"
			data-speaking={m.speaking ?? false}
		>
			<span
				class={cn(
					'size-2 shrink-0 rounded-full',
					m.speaking ? 'bg-emerald-500' : 'bg-muted-foreground/40'
				)}
			></span>
			<span class="truncate">{m.name}</span>
			{#if m.muted}<MicOff class="size-3 shrink-0" aria-label="Muted" />{/if}
			{#if m.streaming}
				<span
					class="shrink-0 rounded bg-red-600 px-1 text-[0.625rem] leading-4 font-semibold text-white"
					title="Sharing their screen">LIVE</span
				>
			{/if}
		</li>
	{/each}
</ul>
