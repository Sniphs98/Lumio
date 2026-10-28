<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { call } from '#lib/call.svelte.ts';
	import type { UserEvent } from '#lib/chat.ts';
	import CallBar from '#lib/components/call/call-bar.svelte';
	import IncomingCall from '#lib/components/call/incoming-call.svelte';
	import TabBar from '#lib/components/shell/tab-bar.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	// Events for the signed-in user on every tab: friend and group list changes and incoming calls.
	$effect(() => {
		const source = new EventSource('/api/me/events');
		let opened = false;
		source.addEventListener('open', () => {
			if (opened) invalidate('app:home');
			opened = true;
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
		return () => source.close();
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
	<TabBar instanceName={data.instance.name} />
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
</div>
