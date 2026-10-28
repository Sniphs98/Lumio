<script lang="ts">
	import { page } from '$app/state';
	import { call } from '#lib/call.svelte.ts';
	import UserPanel from '#lib/components/audio/user-panel.svelte';
	import FriendsSidebar from '#lib/components/home/friends-sidebar.svelte';
	import { getUnreadContext } from '#lib/unread-context.ts';
	import { cn } from '#lib/utils.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const unread = getUnreadContext();

	// On phones either the lists or the open page (a chat, creating a group, ...) is shown,
	// never both. Only the Home start page leaves the lists on screen.
	const chatOpen = $derived(page.route.id !== '/(app)/(home)');

	// Friend requests show up without a reload: the app layout invalidates `app:home` on events.
</script>

<!-- Home tab: friends and group chats as separate lists. -->
<aside
	class={cn('w-full shrink-0 flex-col md:flex md:w-64 md:border-r', chatOpen ? 'hidden' : 'flex')}
	aria-label="Friends and groups"
>
	<div class="min-h-0 flex-1 overflow-y-auto">
		<FriendsSidebar
			friends={data.friends}
			incoming={data.incoming}
			outgoing={data.outgoing}
			groups={data.groups}
			directConversationIds={data.directConversationIds}
			activeConversationId={page.params.id}
			unread={unread.counts.conversations}
			friendLinkUrl={new URL(`/add/${data.friendLinkCode}`, page.url.origin).href}
			notice={page.form?.friendNotice}
			error={page.form?.friendError}
		/>
	</div>
	<UserPanel user={data.user} audio={call} />
</aside>

<div class={cn('min-w-0 flex-1 flex-col md:flex', chatOpen ? 'flex' : 'hidden')}>
	{@render children()}
</div>
