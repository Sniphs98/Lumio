<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowLeft, Hash, MessageSquare, Phone, Volume2 } from '@lucide/svelte';
	import { call } from '#lib/call.svelte.ts';
	import { isJoinable } from '#lib/channels.ts';
	import CallControls from '#lib/components/call/call-controls.svelte';
	import CallStage from '#lib/components/call/call-stage.svelte';
	import VoiceMembers from '#lib/components/call/voice-members.svelte';
	import ChatView from '#lib/components/chat/chat-view.svelte';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.ts';
	import { getUnreadContext } from '#lib/unread-context.ts';
	import { cn } from '#lib/utils.ts';
	import { getVoiceContext } from '#lib/voice-context.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const unread = getUnreadContext();
	const voice = getVoiceContext();

	// Text and voice channels share the same chat; voice channels can also be joined.
	const joinable = $derived(isJoinable(data.channel.type));
	const members = $derived(joinable ? (voice.channels[data.channel.id] ?? []) : []);
	const inCall = $derived(joinable && call.isIn('channel', data.channel.id));
	const label = $derived(joinable ? data.channel.name : `#${data.channel.name}`);

	// In voice channels the chat opens next to the voice view with a button, on phones
	// instead of it. It stays mounted while closed, so no message is missed.
	let chatOpen = $state(false);
	const showChat = $derived(!joinable || chatOpen);
	const toggleChat = () => (chatOpen = !chatOpen);

	function joinVoice() {
		call.join({
			kind: 'channel',
			id: data.channel.id,
			name: data.channel.name
		});
	}
</script>

<svelte:head>
	<title>{label} · Lumio</title>
</svelte:head>

<header class="flex h-12 shrink-0 items-center gap-2 border-b px-3">
	<a
		href={resolve('/(app)/channels')}
		class={buttonVariants({ variant: 'ghost', size: 'icon', class: '-ml-1 size-8 md:hidden' })}
		aria-label="Back to channels"
	>
		<ArrowLeft />
	</a>
	{#if joinable}
		<Volume2 class="size-4 shrink-0 text-muted-foreground" />
	{:else}
		<Hash class="size-4 shrink-0 text-muted-foreground" />
	{/if}
	<h1 class="min-w-0 truncate font-semibold">{data.channel.name}</h1>
	{#if data.channel.topic}
		<p class="hidden truncate text-sm text-muted-foreground md:block">{data.channel.topic}</p>
	{/if}
	{#if joinable}
		<Button
			variant={chatOpen ? 'secondary' : 'ghost'}
			size="sm"
			class="ml-auto shrink-0"
			aria-label={chatOpen ? 'Hide chat' : 'Show chat'}
			aria-pressed={chatOpen}
			onclick={toggleChat}
		>
			<MessageSquare />
			<span class="hidden sm:inline">Chat</span>
		</Button>
	{/if}
</header>

{#snippet chat()}
	<ChatView
		messages={data.messages}
		eventsUrl="/api/channels/{data.channel.id}/events"
		{label}
		emptyText="This is the start of {label}. Say hi!"
		canSend={data.canSend}
		cannotSendText="You cannot send messages in this channel."
		error={form?.error}
		uploadTarget={data.canAttach ? `channel:${data.channel.id}` : undefined}
		maxUploadSize={data.maxUploadSize}
		meId={data.user.id}
		mentionable={data.mentionable}
		canReact={data.canReact}
		canManageMessages={data.canManageMessages}
		onread={() => unread.clear(data.channel.id)}
		visible={showChat}
		gifProvider={data.gifProvider}
	/>
{/snippet}

{#snippet voiceView()}
	{#if inCall}
		<CallStage participants={call.participants} class="min-h-0 flex-1 overflow-y-auto" />
		<CallControls {call} {chatOpen} ontogglechat={toggleChat} class="mb-3 shrink-0" />
	{:else}
		<div class="m-auto flex flex-col items-center gap-3 p-6 text-center">
			<span class="flex size-16 items-center justify-center rounded-full bg-muted">
				<Volume2 class="size-7 text-muted-foreground" />
			</span>
			<h2 class="text-lg font-semibold">{data.channel.name}</h2>
			{#if members.length > 0}
				<VoiceMembers
					{members}
					label="People in {data.channel.name}"
					class="w-56 max-w-full rounded-lg border p-2 text-left"
				/>
			{/if}
			{#if data.canConnect}
				<p class="text-sm text-muted-foreground">
					{members.length > 0
						? 'Jump in and say hi.'
						: 'Talk, share your screen or turn on your camera.'}
				</p>
				<Button onclick={joinVoice} disabled={call.status === 'connecting'}>
					<Phone />
					Join voice
				</Button>
			{:else}
				<p class="text-sm text-muted-foreground">You cannot join this voice channel.</p>
			{/if}
		</div>
	{/if}
{/snippet}

{#if joinable}
	<div class="flex min-h-0 flex-1">
		<section
			class={cn('min-w-0 flex-1 flex-col', chatOpen ? 'hidden md:flex' : 'flex')}
			aria-label="Voice"
		>
			{@render voiceView()}
		</section>
		<section
			class={cn(
				'min-w-0 flex-1 flex-col md:w-96 md:flex-none md:border-l xl:w-[28rem]',
				chatOpen ? 'flex' : 'hidden'
			)}
		>
			{@render chat()}
		</section>
	</div>
{:else}
	{@render chat()}
{/if}
