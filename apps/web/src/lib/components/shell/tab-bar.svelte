<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { House, MessagesSquare, Plus, UserRound } from '@lucide/svelte';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.ts';
	import * as Tooltip from '#lib/components/ui/tooltip/index.ts';
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
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<!-- Disabled buttons get no pointer events, so the wrapper shows the tooltip. -->
				<span {...props} class="mb-1 shrink-0">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						class="size-7 text-muted-foreground hover:bg-background/60"
						aria-label="Connect another instance"
						aria-describedby="connect-instance-hint"
						disabled
					>
						<Plus class="size-4" />
					</Button>
				</span>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content side="bottom">Connecting more instances is coming soon</Tooltip.Content>
	</Tooltip.Root>
	<span id="connect-instance-hint" class="sr-only">Connecting more instances is coming soon</span>
	{#if isGuest}
		<!-- Guests are reminded on every page that their access only lives in this browser. -->
		<a
			href={resolve('/(app)/account')}
			class={buttonVariants({
				variant: 'ghost',
				size: 'sm',
				class:
					'mb-1 ml-auto h-7 px-2 text-xs font-normal text-muted-foreground hover:bg-background/60'
			})}
		>
			<UserRound class="size-3.5" />
			Guest · Create account
		</a>
	{/if}
</nav>
