<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowLeft, Hash, Phone, PhoneOff, Volume2 } from '@lucide/svelte';
	import { call } from '#lib/call.svelte.ts';
	import { isJoinable } from '#lib/channels.ts';
	import CallStage from '#lib/components/call/call-stage.svelte';
	import VoiceMembers from '#lib/components/call/voice-members.svelte';
	import ChatView from '#lib/components/chat/chat-view.svelte';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { getUnreadContext } from '#lib/unread-context.ts';
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
		class="-ml-1 flex size-8 items-center justify-center rounded-md hover:bg-muted md:hidden"
		aria-label="Back to channels"
	>
		<ArrowLeft class="size-4" />
	</a>
	{#if joinable}
		<Volume2 class="size-4 shrink-0 text-muted-foreground" />
	{:else}
		<Hash class="size-4 shrink-0 text-muted-foreground" />
	{/if}
	<h1 class="truncate font-semibold">{data.channel.name}</h1>
	{#if data.channel.topic}
		<p class="hidden truncate text-sm text-muted-foreground md:block">{data.channel.topic}</p>
	{/if}
	<!-- Calls start from the top right of a chat; the call bar then follows the user across tabs. -->
	{#if joinable}
		<div class="ml-auto shrink-0">
			{#if inCall}
				<Button
					variant="ghost"
					size="sm"
					class="text-destructive hover:text-destructive"
					onclick={() => call.leave()}
				>
					<PhoneOff />
					Leave voice
				</Button>
			{:else}
				<Button
					size="sm"
					title={data.canConnect ? undefined : 'You cannot join this voice channel.'}
					disabled={!data.canConnect || call.status === 'connecting'}
					onclick={joinVoice}
				>
					<Phone />
					Join voice
				</Button>
			{/if}
		</div>
	{/if}
</header>

{#if inCall}
	<CallStage
		participants={call.participants}
		class="max-h-[45%] shrink-0 overflow-y-auto border-b"
	/>
{:else if members.length > 0}
	<VoiceMembers
		{members}
		label="People in {data.channel.name}"
		class="flex shrink-0 flex-wrap gap-x-4 border-b px-3 py-2"
	/>
{/if}

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
	onread={() => unread.clear(data.channel.id)}
/>
