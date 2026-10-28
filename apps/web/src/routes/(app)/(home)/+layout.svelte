<script lang="ts">
	import { page } from '$app/state';
	import FriendsSidebar from '#lib/components/home/friends-sidebar.svelte';
	import { cn } from '#lib/utils.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	// On phones either the lists or the open chat is shown, never both.
	const chatOpen = $derived(Boolean(page.params.id));

	// Friend requests show up without a reload: the app layout invalidates `app:home` on events.
</script>

<!-- Home tab: friends and group chats as separate lists. -->
<aside
	class={cn(
		'w-full shrink-0 flex-col overflow-y-auto md:flex md:w-64 md:border-r',
		chatOpen ? 'hidden' : 'flex'
	)}
	aria-label="Friends and groups"
>
	<FriendsSidebar
		friends={data.friends}
		incoming={data.incoming}
		outgoing={data.outgoing}
		groups={data.groups}
		directConversationIds={data.directConversationIds}
		activeConversationId={page.params.id}
		friendLinkUrl={new URL(`/add/${data.friendLinkCode}`, page.url.origin).href}
		notice={page.form?.friendNotice}
		error={page.form?.friendError}
	/>
</aside>

<div class={cn('min-w-0 flex-1 flex-col md:flex', chatOpen ? 'flex' : 'hidden')}>
	{@render children()}
</div>
