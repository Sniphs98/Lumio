<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowLeft, Phone, Users } from '@lucide/svelte';
	import ChatView from '#lib/components/chat/chat-view.svelte';
	import { Button } from '#lib/components/ui/button/index.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const title = $derived(
		data.conversation.type === 'group'
			? (data.conversation.name ?? data.conversation.others.map((u) => u.name).join(', '))
			: (data.conversation.others[0]?.name ?? 'Deleted user')
	);
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
	<!-- Calls start from the top right of a chat. Joining the LiveKit room comes with the call bar. -->
	<Button
		variant="ghost"
		size="icon"
		class="size-8"
		aria-label="Start call"
		title="Calls are coming soon"
		disabled
	>
		<Phone />
	</Button>
</header>

<ChatView
	messages={data.messages}
	eventsUrl="/api/conversations/{data.conversation.id}/events"
	label={title}
	emptyText="This is the start of your conversation with {title}."
	canSend={data.canSend}
	cannotSendText="You can only message your friends."
	error={form?.error}
/>
