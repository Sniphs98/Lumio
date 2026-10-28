<script lang="ts">
	import type { FriendUser } from '#lib/friends.ts';

	let { user }: { user: FriendUser } = $props();
</script>

{#if user.image}
	<img src={user.image} alt="" class="size-6 shrink-0 rounded-full object-cover" />
{:else}
	<span
		class="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground uppercase"
		aria-hidden="true"
	>
		{user.name.slice(0, 1)}
	</span>
{/if}
