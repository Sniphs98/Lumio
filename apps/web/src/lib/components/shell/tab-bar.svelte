<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { House, MessagesSquare, Plus, UserRound } from '@lucide/svelte';
	import { Button } from '#lib/components/ui/button/index.ts';
	import UnreadBadge from '#lib/components/unread/unread-badge.svelte';
	import { sumUnread, type UnreadCounts } from '#lib/unread.ts';
	import { cn } from '#lib/utils.ts';

	type Props = {
		instanceName: string;
		isGuest?: boolean;
		/** Unread counts, summed up on each tab. */
		unread?: UnreadCounts;
		/** The open channel or conversation; its messages are being read. */
		openChatId?: string;
	};

	let {
		instanceName,
		isGuest = false,
		unread = { channels: {}, conversations: {} },
		openChatId
	}: Props = $props();

	const homeUnread = $derived(sumUnread(unread.conversations, openChatId));
	const instanceUnread = $derived(sumUnread(unread.channels, openChatId));

	// Home holds the friend list and every direct or group conversation.
	const homeActive = $derived(!page.url.pathname.startsWith('/channels'));
	const instanceActive = $derived(page.url.pathname.startsWith('/channels'));

	const tabClass = (active: boolean) =>
		cn(
			'flex h-8 max-w-48 shrink-0 items-center gap-2 rounded-t-md px-3 text-sm',
			active ? 'bg-background text-foreground' : 'text-muted-foreground hover:bg-background/60'
		);
</script>

<!--
	Every Lumio instance the user is signed in to is shown as a browser-like tab.
	For now this is only the instance serving this page; connecting more instances comes later.
-->
<nav
	class="flex h-10 shrink-0 items-end gap-1 overflow-x-auto border-b bg-muted/40 px-2 pt-[env(safe-area-inset-top)]"
	aria-label="Instances"
>
	<a href={resolve('/(app)/(home)')} class={tabClass(homeActive)}>
		<House class="size-4" />
		Home
		<UnreadBadge unread={homeUnread} />
	</a>
	<a href={resolve('/(app)/channels')} class={tabClass(instanceActive)}>
		<MessagesSquare class="size-4" />
		<span class="truncate">{instanceName}</span>
		<UnreadBadge unread={instanceUnread} />
	</a>
	<Button
		type="button"
		variant="ghost"
		size="icon"
		class="mb-1 size-7 shrink-0 text-muted-foreground hover:bg-background/60"
		aria-label="Connect another instance"
		disabled
		title="Connecting more instances is coming soon"
	>
		<Plus class="size-4" />
	</Button>
	{#if isGuest}
		<!-- Guests are reminded on every page that their access only lives in this browser. -->
		<a
			href={resolve('/(app)/account')}
			class="mb-1 ml-auto flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground hover:bg-background/60 hover:text-foreground"
		>
			<UserRound class="size-3.5" />
			Guest · Create account
		</a>
	{/if}
</nav>
