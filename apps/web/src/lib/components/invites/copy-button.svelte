<script lang="ts">
	import { Check, Copy } from '@lucide/svelte';
	import { Button } from '#lib/components/ui/button/index.ts';

	let { text, label }: { text: string; label: string } = $props();

	let copied = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	async function copy() {
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			// The clipboard API needs HTTPS; without it the link stays selectable in the field.
			return;
		}
		copied = true;
		clearTimeout(timer);
		timer = setTimeout(() => (copied = false), 2000);
	}
</script>

<Button type="button" size="icon" variant="ghost" class="size-8" aria-label={label} onclick={copy}>
	{#if copied}<Check />{:else}<Copy />{/if}
</Button>
<span class="sr-only" role="status">{copied ? 'Copied' : ''}</span>
