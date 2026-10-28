<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowLeft, Hash, Phone, Volume2 } from '@lucide/svelte';
	import { call } from '#lib/call.svelte.ts';
	import CallStage from '#lib/components/call/call-stage.svelte';
	import ChatView from '#lib/components/chat/chat-view.svelte';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { getUnreadContext } from '#lib/unread-context.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const unread = getUnreadContext();

	const inCall = $derived(data.kind === 'voice' && call.isIn('channel', data.channel.id));

	function joinVoice() {
		call.join({
			kind: 'channel',
			id: data.channel.id,
			name: data.channel.name
		});
	}
</script>

<svelte:head>
	<title>{data.kind === 'voice' ? data.channel.name : `#${data.channel.name}`} · Lumio</title>
</svelte:head>

<header class="flex h-12 shrink-0 items-center gap-2 border-b px-3">
	<a
		href={resolve('/(app)/channels')}
		class="-ml-1 flex size-8 items-center justify-center rounded-md hover:bg-muted md:hidden"
		aria-label="Back to channels"
	>
		<ArrowLeft class="size-4" />
	</a>
	{#if data.kind === 'voice'}
		<Volume2 class="size-4 text-muted-foreground" />
	{:else}
		<Hash class="size-4 text-muted-foreground" />
	{/if}
	<h1 class="truncate font-semibold">{data.channel.name}</h1>
	{#if data.channel.topic}
		<p class="hidden truncate text-sm text-muted-foreground md:block">{data.channel.topic}</p>
	{/if}
</header>

{#if data.kind === 'voice'}
	{#if inCall}
		<CallStage participants={call.participants} class="min-h-0 flex-1 overflow-y-auto" />
	{:else}
		<div class="m-auto flex flex-col items-center gap-3 p-6 text-center">
			<span class="flex size-16 items-center justify-center rounded-full bg-muted">
				<Volume2 class="size-7 text-muted-foreground" />
			</span>
			<h2 class="text-lg font-semibold">{data.channel.name}</h2>
			{#if data.canConnect}
				<p class="text-sm text-muted-foreground">Talk, share your screen or turn on your camera.</p>
				<Button onclick={joinVoice} disabled={call.status === 'connecting'}>
					<Phone />
					Join voice
				</Button>
			{:else}
				<p class="text-sm text-muted-foreground">You cannot join this voice channel.</p>
			{/if}
		</div>
	{/if}
{:else}
	<ChatView
		messages={data.messages}
		eventsUrl="/api/channels/{data.channel.id}/events"
		label="#{data.channel.name}"
		emptyText="This is the start of #{data.channel.name}. Say hi!"
		canSend={data.canSend}
		cannotSendText="You cannot send messages in this channel."
		error={form?.error}
		uploadTarget={data.canAttach ? `channel:${data.channel.id}` : undefined}
		maxUploadSize={data.maxUploadSize}
		meId={data.user.id}
		mentionable={data.mentionable}
		canReact={data.canReact}
		onread={() => unread.clear(data.channel.id)}
	/>
{/if}
