<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowLeft, Hash } from '@lucide/svelte';
	import ChatView from '#lib/components/chat/chat-view.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>#{data.channel.name} · Lumio</title>
</svelte:head>

<header class="flex h-12 shrink-0 items-center gap-2 border-b px-3">
	<a
		href={resolve('/(app)/channels')}
		class="-ml-1 flex size-8 items-center justify-center rounded-md hover:bg-muted md:hidden"
		aria-label="Back to channels"
	>
		<ArrowLeft class="size-4" />
	</a>
	<Hash class="size-4 text-muted-foreground" />
	<h1 class="truncate font-semibold">{data.channel.name}</h1>
	{#if data.channel.topic}
		<p class="hidden truncate text-sm text-muted-foreground md:block">{data.channel.topic}</p>
	{/if}
</header>

<ChatView
	messages={data.messages}
	eventsUrl="/api/channels/{data.channel.id}/events"
	label="#{data.channel.name}"
	emptyText="This is the start of #{data.channel.name}. Say hi!"
	canSend={data.canSend}
	cannotSendText="You cannot send messages in this channel."
	error={form?.error}
/>
