<script lang="ts">
	import { Users } from '@lucide/svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<main class="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
	<Users class="size-10" />
	<p>Hi {data.user.name}, pick a friend to start chatting.</p>
</main>
