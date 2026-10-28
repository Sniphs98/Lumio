<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { call } from '#lib/call.svelte.ts';
	import type { UserEvent } from '#lib/chat.ts';
	import CallBar from '#lib/components/call/call-bar.svelte';
	import IncomingCall from '#lib/components/call/incoming-call.svelte';
	import AccountSuggestion from '#lib/components/guest/account-suggestion.svelte';
	import TabBar from '#lib/components/shell/tab-bar.svelte';
	import { startVisit } from '#lib/guests.ts';
	import { sounds } from '#lib/sound-player.svelte.ts';
	import { shouldPlayMessageSound } from '#lib/sounds.ts';
	import { setUnreadContext } from '#lib/unread-context.ts';
	import { clearUnread } from '#lib/unread.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	// Unread counts for the tabs and sidebars. Reloaded from the server on activity; a chat
	// the user reads is cleared right away.
	let unread = $derived(data.unread);
	setUnreadContext({
		get counts() {
			return unread;
		},
		clear(chatId) {
			unread = clearUnread(unread, chatId);
		}
	});

	// Activity often comes in bursts, so the counts are reloaded at most every half second.
	let reloadTimer: ReturnType<typeof setTimeout> | undefined;
	function reloadUnread() {
		reloadTimer ??= setTimeout(() => {
			reloadTimer = undefined;
			invalidate('app:unread');
		}, 500);
	}

	// Events for the signed-in user on every tab: friend and group list changes, incoming
	// calls and new messages in other chats.
	$effect(() => {
		const source = new EventSource('/api/me/events');
		let opened = false;
		source.addEventListener('open', () => {
			if (opened) {
				invalidate('app:home');
				invalidate('app:unread');
			}
			opened = true;
		});
		source.addEventListener('message.activity', (e) => {
			const event = JSON.parse((e as MessageEvent<string>).data) as UserEvent;
			if (event.type !== 'message.activity') return;
			const openChat = { id: page.params.id, visible: document.visibilityState === 'visible' };
			if (shouldPlayMessageSound(event, data.user.id, openChat)) sounds.play('message');
			// The open chat marks new messages as read itself.
			const chatId = event.channelId ?? event.conversationId;
			if (chatId === openChat.id && openChat.visible) return;
			reloadUnread();
		});
		source.addEventListener('home.changed', () => invalidate('app:home'));
		source.addEventListener('conversation.removed', async (e) => {
			const event = JSON.parse((e as MessageEvent<string>).data) as UserEvent;
			if (event.type !== 'conversation.removed') return;
			// Removed from or left the group that is open: go back to the Home start page.
			if (page.params.id === event.conversationId) await goto(resolve('/(app)/(home)'));
			invalidate('app:home');
		});
		source.addEventListener('call.ringing', (e) => {
			const event = JSON.parse((e as MessageEvent<string>).data) as UserEvent;
			if (event.type === 'call.ringing') call.ring(event);
		});
		return () => {
			source.close();
			clearTimeout(reloadTimer);
			reloadTimer = undefined;
		};
	});

	// Mute, deafen and the audio devices are stored in this browser.
	$effect(() => call.restoreSettings());

	// When a guest comes back for another visit, suggest creating an account.
	let suggestAccount = $state(false);
	$effect(() => {
		if (data.user.isGuest && startVisit()) suggestAccount = true;
	});

	async function joinRinging() {
		const ringing = call.ringing;
		if (!ringing) return;
		const href = resolve('/(app)/(home)/dm/[id]', { id: ringing.conversationId });
		// Join first: browsers only allow audio playback right after a click.
		const joining = call.join({
			kind: 'conversation',
			id: ringing.conversationId,
			name: ringing.title
		});
		await goto(href);
		await joining;
	}
</script>

<div class="flex h-dvh flex-col bg-background text-foreground">
	<TabBar
		instanceName={data.instance.name}
		isGuest={data.user.isGuest}
		{unread}
		openChatId={page.params.id}
	/>
	<div class="flex min-h-0 flex-1">
		{@render children()}
	</div>
	{#if call.ringing}
		<IncomingCall
			ringing={call.ringing}
			onjoin={joinRinging}
			ondismiss={() => call.dismissRinging()}
		/>
	{/if}
	<CallBar {call} />
	{#if data.user.isGuest}
		<AccountSuggestion bind:open={suggestAccount} />
	{/if}
</div>
