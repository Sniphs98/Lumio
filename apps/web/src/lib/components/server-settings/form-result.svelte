<script lang="ts">
	import { CircleAlert } from '@lucide/svelte';
	import * as Alert from '#lib/components/ui/alert/index.ts';

	let {
		error,
		saved,
		message = 'Saved.'
	}: { error?: string; saved: boolean; message?: string } = $props();
</script>

{#if error}
	<Alert.Root variant="destructive">
		<CircleAlert />
		<Alert.Description>{error}</Alert.Description>
	</Alert.Root>
{:else if saved}
	<p class="text-sm text-muted-foreground" role="status">{message}</p>
{/if}
