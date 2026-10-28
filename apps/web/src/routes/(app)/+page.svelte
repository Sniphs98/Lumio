<script lang="ts">
	import { Users } from '@lucide/svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<!-- Home tab: friends and group chats as separate lists. -->
<!-- On phones the lists take the full width; the chat opens as its own page. -->
<aside class="flex w-full shrink-0 flex-col overflow-y-auto md:w-64 md:border-r">
	<section class="p-3">
		<h2 class="px-2 pb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
			Friends
		</h2>
		<p class="px-2 text-sm text-muted-foreground">No friends added yet.</p>
	</section>
	<section class="p-3">
		<h2 class="px-2 pb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
			Groups
		</h2>
		<p class="px-2 text-sm text-muted-foreground">No group chats yet.</p>
	</section>
</aside>

<main
	class="hidden flex-1 flex-col items-center justify-center gap-2 text-muted-foreground md:flex"
>
	<Users class="size-10" />
	<p>Hi {data.user.name}, pick a friend to start chatting.</p>
</main>
