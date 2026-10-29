<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		HeadphoneOff,
		Headphones,
		Mic,
		MicOff,
		PhoneOff,
		ScreenShare,
		ScreenShareOff,
		Video,
		VideoOff,
		Volume2,
		X
	} from '@lucide/svelte';
	import { SCREEN_SHARE_QUALITY, type ScreenShareQuality } from '#lib/calls.ts';
	import type { CallControls, CallTarget } from '#lib/call.svelte.ts';
	import { getCallPanels } from '#lib/call-panels.svelte.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.ts';
	import { cn } from '#lib/utils.ts';

	type Props = {
		call: CallControls;
		/**
		 * `bar` spans the bottom of the page and has every control. `panel` sits in a sidebar
		 * above the user panel, which already has mute and deafen, and is only shown from `md` up.
		 */
		variant?: 'bar' | 'panel';
		class?: string;
	};

	let { call, variant = 'bar', class: className }: Props = $props();

	const callPanels = getCallPanels();
	$effect(() => {
		if (variant === 'panel') return callPanels?.register();
	});

	const sectionClass = $derived(
		variant === 'panel'
			? 'hidden shrink-0 flex-col gap-1 border-t bg-muted/40 p-2 md:flex'
			: 'flex shrink-0 flex-col gap-1 border-t bg-muted/40 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]'
	);

	const qualities = Object.entries(SCREEN_SHARE_QUALITY) as [
		ScreenShareQuality,
		(typeof SCREEN_SHARE_QUALITY)[ScreenShareQuality]
	][];

	const statusText = $derived(
		call.status === 'connecting'
			? 'Connecting…'
			: call.status === 'reconnecting'
				? 'Reconnecting…'
				: 'Voice connected'
	);

	const targetHref = (target: CallTarget) =>
		target.kind === 'channel'
			? resolve('/(app)/channels/[id]', { id: target.id })
			: resolve('/(app)/(home)/dm/[id]', { id: target.id });

	// The panel puts camera, screen sharing and "Enable audio" in a second row.
	const hasMediaRow = $derived(
		call.audioBlocked ||
			call.canPublish('camera') ||
			(call.screenShareSupported && call.canPublish('screen_share'))
	);

	const iconSize = $derived(variant === 'panel' ? 'size-8' : 'size-9');

	const toggleClass = (off: boolean) =>
		cn(iconSize, off && 'text-destructive hover:text-destructive');
</script>

{#snippet targetLink(target: CallTarget)}
	<a href={targetHref(target)} class="flex min-w-0 flex-1 flex-col rounded-md px-1 hover:bg-muted">
		<span
			class={cn(
				'flex items-center gap-1.5 text-xs font-semibold',
				call.status === 'connected'
					? 'text-emerald-600 dark:text-emerald-400'
					: 'text-muted-foreground'
			)}
			role="status"
		>
			<span
				class={cn(
					'size-2 shrink-0 rounded-full',
					call.status === 'connected' ? 'bg-emerald-500' : 'animate-pulse bg-amber-500'
				)}
			></span>
			<span class="truncate">{statusText}</span>
		</span>
		<span class="truncate text-sm">{target.name}</span>
	</a>
{/snippet}

{#snippet enableAudio()}
	{#if call.audioBlocked}
		<Button variant="outline" size="sm" onclick={() => call.startAudio()}>
			<Volume2 />
			<span class={variant === 'bar' ? 'hidden sm:inline' : ''}>Enable audio</span>
			{#if variant === 'bar'}<span class="sm:hidden">Audio</span>{/if}
		</Button>
	{/if}
{/snippet}

{#snippet voiceButtons()}
	<Button
		variant="ghost"
		size="icon"
		class={toggleClass(call.muted)}
		aria-label={call.muted ? 'Unmute' : 'Mute'}
		aria-pressed={call.muted}
		disabled={call.status !== 'connected' || !call.canPublish('microphone')}
		onclick={() => call.toggleMute()}
	>
		{#if call.muted}<MicOff />{:else}<Mic />{/if}
	</Button>
	<Button
		variant="ghost"
		size="icon"
		class={toggleClass(call.deafened)}
		aria-label={call.deafened ? 'Undeafen' : 'Deafen'}
		aria-pressed={call.deafened}
		disabled={call.status !== 'connected'}
		onclick={() => call.toggleDeafen()}
	>
		{#if call.deafened}<HeadphoneOff />{:else}<Headphones />{/if}
	</Button>
{/snippet}

{#snippet mediaButtons()}
	{#if call.canPublish('camera')}
		<Button
			variant="ghost"
			size="icon"
			class={iconSize}
			aria-label={call.cameraOn ? 'Turn off camera' : 'Turn on camera'}
			aria-pressed={call.cameraOn}
			disabled={call.status !== 'connected'}
			onclick={() => call.toggleCamera()}
		>
			{#if call.cameraOn}<VideoOff />{:else}<Video />{/if}
		</Button>
	{/if}
	{#if call.screenShareSupported && call.canPublish('screen_share')}
		{#if call.screenSharing}
			<Button
				variant="ghost"
				size="icon"
				class={cn(iconSize, 'text-emerald-600 dark:text-emerald-400')}
				aria-label="Stop sharing"
				aria-pressed="true"
				onclick={() => call.toggleScreenShare()}
			>
				<ScreenShareOff />
			</Button>
		{:else}
			<DropdownMenu.Root>
				<DropdownMenu.Trigger disabled={call.status !== 'connected'}>
					{#snippet child({ props })}
						<Button
							{...props}
							variant="ghost"
							size="icon"
							class={iconSize}
							aria-label="Share screen"
						>
							<ScreenShare />
						</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content side="top" align={variant === 'panel' ? 'start' : 'end'}>
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
{/snippet}

{#snippet hangUp()}
	<Button
		variant="destructive"
		size="icon"
		class={cn(iconSize, variant === 'bar' && 'ml-1')}
		aria-label="Hang up"
		onclick={() => call.leave()}
	>
		<PhoneOff />
	</Button>
{/snippet}

<!-- Stays visible on every tab while a call is running: in the sidebar from `md` up, otherwise at the bottom. -->
{#if call.target && call.status !== 'idle'}
	<section class={cn(sectionClass, className)} aria-label="Call">
		{#if variant === 'panel'}
			<div class="flex items-center gap-1">
				{@render targetLink(call.target)}
				{@render hangUp()}
			</div>
			{#if hasMediaRow}
				<div class="flex flex-wrap items-center gap-0.5">
					{@render mediaButtons()}
					{@render enableAudio()}
				</div>
			{/if}
		{:else}
			<div class="flex items-center gap-2">
				{@render targetLink(call.target)}
				{@render enableAudio()}
				<div class="flex shrink-0 items-center gap-0.5">
					{@render voiceButtons()}
					{@render mediaButtons()}
					{@render hangUp()}
				</div>
			</div>
		{/if}
		{#if call.error}
			<p class="px-1 text-xs text-destructive" role="alert">{call.error}</p>
		{/if}
	</section>
{:else if call.error}
	<!-- Why the last call ended or could not start. -->
	<section class={cn(sectionClass, 'flex-row items-center gap-2', className)} aria-label="Call">
		<p class="min-w-0 flex-1 text-sm text-destructive" role="alert">{call.error}</p>
		<Button
			variant="ghost"
			size="icon"
			class="size-8"
			aria-label="Dismiss"
			onclick={() => call.dismissError()}
		>
			<X />
		</Button>
	</section>
{/if}
