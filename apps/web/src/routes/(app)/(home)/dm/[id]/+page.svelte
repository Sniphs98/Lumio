<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowLeft, Phone, PhoneOff, Settings, Users } from '@lucide/svelte';
	import { call } from '#lib/call.svelte.ts';
	import CallStage from '#lib/components/call/call-stage.svelte';
	import ChatView from '#lib/components/chat/chat-view.svelte';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.ts';
	import * as Tooltip from '#lib/components/ui/tooltip/index.ts';
	import { groupTitle } from '#lib/groups.ts';
	import { getUnreadContext } from '#lib/unread-context.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const unread = getUnreadContext();

	const title = $derived(
		data.conversation.type === 'group'
			? groupTitle(data.conversation.name, data.conversation.others)
			: (data.conversation.others[0]?.name ?? 'Deleted user')
	);
	const inCall = $derived(call.isIn('conversation', data.conversation.id));
	const callLabel = $derived(
		call.ringing?.conversationId === data.conversation.id ? 'Join call' : 'Start call'
	);

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
		class={buttonVariants({ variant: 'ghost', size: 'icon', class: '-ml-1 size-8 md:hidden' })}
		aria-label="Back to friends"
	>
		<ArrowLeft />
	</a>
	{#if data.conversation.type === 'group'}
		<Users class="size-4 shrink-0 text-muted-foreground" />
	{/if}
	<h1 class="min-w-0 flex-1 truncate font-semibold">{title}</h1>
	{#if data.conversation.type === 'group'}
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<a
						{...props}
						href={resolve('/(app)/(home)/dm/[id]/settings', { id: data.conversation.id })}
						class={buttonVariants({ variant: 'ghost', size: 'icon', class: 'size-8' })}
						aria-label="Group settings"
					>
						<Settings />
					</a>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="bottom">Members and settings</Tooltip.Content>
		</Tooltip.Root>
	{/if}
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
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<!-- Disabled buttons get no pointer events, so the wrapper shows the tooltip. -->
					<span {...props} class="inline-flex">
						<Button
							variant="ghost"
							size="icon"
							class="size-8"
							aria-label={callLabel}
							aria-describedby={data.canSend ? undefined : 'call-hint'}
							disabled={!data.canSend}
							onclick={startCall}
						>
							<Phone />
						</Button>
					</span>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="bottom">
				{data.canSend ? callLabel : 'You can only call your friends.'}
			</Tooltip.Content>
		</Tooltip.Root>
		{#if !data.canSend}
			<span id="call-hint" class="sr-only">You can only call your friends.</span>
		{/if}
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
	meId={data.user.id}
	mentionable={data.mentionable}
	canReact={data.canSend}
	onread={() => unread.clear(data.conversation.id)}
/>
