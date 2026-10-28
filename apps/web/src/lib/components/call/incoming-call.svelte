<script lang="ts">
	import { Phone, PhoneIncoming, X } from '@lucide/svelte';
	import type { CallRingingEvent } from '#lib/calls.ts';
	import { Button } from '#lib/components/ui/button/index.ts';

	let {
		ringing,
		onjoin,
		ondismiss
	}: { ringing: CallRingingEvent; onjoin: () => void; ondismiss: () => void } = $props();
</script>

<div
	class="flex shrink-0 items-center gap-3 border-t bg-emerald-500/10 px-3 py-2"
	aria-label="Incoming call"
	role="alertdialog"
	aria-describedby="incoming-call-text"
>
	<PhoneIncoming class="size-5 shrink-0 animate-pulse text-emerald-600 dark:text-emerald-400" />
	<p id="incoming-call-text" class="min-w-0 flex-1 truncate text-sm">
		{#if ringing.title === ringing.caller.name}
			<span class="font-semibold">{ringing.caller.name}</span> is calling you
		{:else}
			<span class="font-semibold">{ringing.caller.name}</span> started a call in
			<span class="font-semibold">{ringing.title}</span>
		{/if}
	</p>
	<Button size="sm" class="bg-emerald-600 text-white hover:bg-emerald-600/90" onclick={onjoin}>
		<Phone />
		Join
	</Button>
	<Button variant="ghost" size="icon" class="size-8" aria-label="Dismiss call" onclick={ondismiss}>
		<X />
	</Button>
</div>
