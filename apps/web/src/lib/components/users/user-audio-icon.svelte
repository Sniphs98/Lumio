<script lang="ts">
	import { Volume1, VolumeX } from '@lucide/svelte';
	import type { UserAudio } from '#lib/user-audio.ts';
	import { cn } from '#lib/utils.ts';

	/** Shows that this user muted or turned down someone for themselves, from the user menu. */
	let { audio, class: className }: { audio: UserAudio; class?: string } = $props();
</script>

{#if audio.muted}
	<VolumeX
		class={cn('shrink-0 text-destructive', className)}
		aria-label="Muted for you"
		role="img"
	/>
{:else if audio.volume < 1}
	<Volume1
		class={cn('shrink-0', className)}
		aria-label="Volume {Math.round(audio.volume * 100)}% for you"
		role="img"
	/>
{/if}
