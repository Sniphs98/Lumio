<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowLeft, Phone, PhoneOff, Users } from '@lucide/svelte';
	import { call } from '#lib/call.svelte.ts';
	import CallStage from '#lib/components/call/call-stage.svelte';
	import ChatView from '#lib/components/chat/chat-view.svelte';
	import { Button } from '#lib/components/ui/button/index.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const title = $derived(
		data.conversation.type === 'group'
			? (data.conversation.name ?? data.conversation.others.map((u) => u.name).join(', '))
			: (data.conversation.others[0]?.name ?? 'Deleted user')
	);
	const inCall = $derived(call.isIn('conversation', data.conversation.id));

	function startCall() {
		call.join({
			kind: 'conversation',
			id: data.conversation.id,
			name: title
		});
	}
</script>

<svelte:head>
	<title>{title} · Lumio</title>
</svelte:head>

<header class="flex h-12 shrink-0 items-center gap-2 border-b px-3">
	<a
		href={resolve('/(app)/(home)')}
		class="-ml-1 flex size-8 items-center justify-center rounded-md hover:bg-muted md:hidden"
		aria-label="Back to friends"
	>
		<ArrowLeft class="size-4" />
	</a>
	{#if data.conversation.type === 'group'}
		<Users class="size-4 shrink-0 text-muted-foreground" />
	{/if}
	<h1 class="min-w-0 flex-1 truncate font-semibold">{title}</h1>
	<!-- Calls start from the top right of a chat; the call bar then follows the user across tabs. -->
	{#if inCall}
		<Button
			variant="ghost"
			size="icon"
			class="size-8 text-destructive hover:text-destructive"
			aria-label="Leave call"
			onclick={() => call.leave()}
		>
			<PhoneOff />
		</Button>
	{:else}
		<Button
			variant="ghost"
			size="icon"
			class="size-8"
			aria-label={call.ringing?.conversationId === data.conversation.id
				? 'Join call'
				: 'Start call'}
			title={data.canSend ? undefined : 'You can only call your friends.'}
			disabled={!data.canSend}
			onclick={startCall}
		>
			<Phone />
		</Button>
	{/if}
</header>

{#if inCall}
	<CallStage
		participants={call.participants}
		class="max-h-[45%] shrink-0 overflow-y-auto border-b"
	/>
{/if}

<ChatView
	messages={data.messages}
	eventsUrl="/api/conversations/{data.conversation.id}/events"
	label={title}
	emptyText="This is the start of your conversation with {title}."
	canSend={data.canSend}
	cannotSendText="You can only message your friends."
	error={form?.error}
	uploadTarget="conversation:{data.conversation.id}"
	maxUploadSize={data.maxUploadSize}
/>
