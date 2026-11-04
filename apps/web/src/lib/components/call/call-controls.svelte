<script lang="ts">
	import {
		HeadphoneOff,
		Headphones,
		MessageSquare,
		Mic,
		MicOff,
		PhoneOff,
		ScreenShare,
		ScreenShareOff,
		Video,
		VideoOff
	} from '@lucide/svelte';
	import { SCREEN_SHARE_QUALITY, type ScreenShareQuality } from '#lib/calls.ts';
	import type { CallControls } from '#lib/call.svelte.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.ts';
	import { Separator } from '#lib/components/ui/separator/index.ts';
	import * as Tooltip from '#lib/components/ui/tooltip/index.ts';
	import { cn } from '#lib/utils.ts';

	let {
		call,
		chatOpen,
		ontogglechat,
		class: className
	}: {
		call: CallControls;
		/** Whether the chat next to the call is open. Without `ontogglechat` there is no chat button. */
		chatOpen?: boolean;
		ontogglechat?: () => void;
		class?: string;
	} = $props();

	const qualities = Object.entries(SCREEN_SHARE_QUALITY) as [
		ScreenShareQuality,
		(typeof SCREEN_SHARE_QUALITY)[ScreenShareQuality]
	][];

	const connected = $derived(call.status === 'connected');
	const canShare = $derived(call.screenShareSupported && call.canPublish('screen_share'));

	const buttonClass = 'size-11 rounded-full';
	const offClass =
		'bg-destructive/15 text-destructive hover:bg-destructive/25 hover:text-destructive';
	const onClass =
		'bg-emerald-600 text-white hover:bg-emerald-600/90 hover:text-white dark:bg-emerald-600';
</script>

<!-- The actions of the running call, below the call view: what Discord shows in the middle of a call. -->
<div
	class={cn(
		'mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-1.5 rounded-full border bg-background/95 p-1.5 shadow-lg backdrop-blur-sm',
		className
	)}
	role="toolbar"
	aria-label="Call controls"
>
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					variant="secondary"
					size="icon"
					class={cn(buttonClass, call.muted && offClass)}
					aria-label={call.muted ? 'Unmute' : 'Mute'}
					aria-pressed={call.muted}
					disabled={!connected || !call.canPublish('microphone')}
					onclick={() => call.toggleMute()}
				>
					{#if call.muted}<MicOff />{:else}<Mic />{/if}
				</Button>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content>{call.muted ? 'Unmute' : 'Mute'}</Tooltip.Content>
	</Tooltip.Root>

	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					variant="secondary"
					size="icon"
					class={cn(buttonClass, call.deafened && offClass)}
					aria-label={call.deafened ? 'Undeafen' : 'Deafen'}
					aria-pressed={call.deafened}
					disabled={!connected}
					onclick={() => call.toggleDeafen()}
				>
					{#if call.deafened}<HeadphoneOff />{:else}<Headphones />{/if}
				</Button>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content>{call.deafened ? 'Undeafen' : 'Deafen'}</Tooltip.Content>
	</Tooltip.Root>

	{#if call.canPublish('camera')}
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant="secondary"
						size="icon"
						class={cn(buttonClass, call.cameraOn && onClass)}
						aria-label={call.cameraOn ? 'Turn off camera' : 'Turn on camera'}
						aria-pressed={call.cameraOn}
						disabled={!connected}
						onclick={() => call.toggleCamera()}
					>
						{#if call.cameraOn}<VideoOff />{:else}<Video />{/if}
					</Button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content>{call.cameraOn ? 'Turn off camera' : 'Turn on camera'}</Tooltip.Content>
		</Tooltip.Root>
	{/if}

	{#if canShare}
		{#if call.screenSharing}
			<Button
				variant="secondary"
				class={cn('h-11 rounded-full px-4', onClass)}
				aria-label="Stop sharing"
				aria-pressed="true"
				onclick={() => call.toggleScreenShare()}
			>
				<ScreenShareOff />
				<span class="hidden sm:inline">Stop sharing</span>
			</Button>
		{:else}
			<DropdownMenu.Root>
				<DropdownMenu.Trigger disabled={!connected}>
					{#snippet child({ props })}
						<Button
							{...props}
							variant="secondary"
							class="h-11 rounded-full px-4"
							aria-label="Share screen"
						>
							<ScreenShare />
							<span class="hidden sm:inline">Share screen</span>
						</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content side="top">
					<DropdownMenu.Label>Share screen</DropdownMenu.Label>
					{#each qualities as [quality, q] (quality)}
						<DropdownMenu.Item onSelect={() => call.toggleScreenShare(quality)}>
							{q.label}
						</DropdownMenu.Item>
					{/each}
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		{/if}
	{/if}

	{#if ontogglechat}
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant="secondary"
						size="icon"
						class={cn(
							buttonClass,
							chatOpen && 'bg-primary text-primary-foreground hover:bg-primary/90'
						)}
						aria-label={chatOpen ? 'Hide chat' : 'Show chat'}
						aria-pressed={chatOpen}
						onclick={ontogglechat}
					>
						<MessageSquare />
					</Button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content>{chatOpen ? 'Hide chat' : 'Show chat'}</Tooltip.Content>
		</Tooltip.Root>
	{/if}

	<Separator orientation="vertical" class="mx-0.5 h-7!" />

	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					variant="destructive"
					size="icon"
					class={buttonClass}
					aria-label="Hang up"
					onclick={() => call.leave()}
				>
					<PhoneOff />
				</Button>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content>Hang up</Tooltip.Content>
	</Tooltip.Root>
</div>
