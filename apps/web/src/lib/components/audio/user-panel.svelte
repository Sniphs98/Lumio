<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import { HeadphoneOff, Headphones, Mic, MicOff, Settings } from '@lucide/svelte';
	import type { AudioControls } from '#lib/call.svelte.ts';
	import UserAvatar from '#lib/components/groups/user-avatar.svelte';
	import SettingsDialog from '#lib/components/settings/settings-dialog.svelte';
	import { Button } from '#lib/components/ui/button/index.ts';
	import * as Tooltip from '#lib/components/ui/tooltip/index.ts';
	import { cn } from '#lib/utils.ts';

	type Props = {
		user: { name: string; image: string | null; isGuest: boolean };
		audio: AudioControls;
	};

	let { user, audio }: Props = $props();

	let settingsOpen = $state(false);

	const status = $derived(
		audio.deafened ? 'Deafened' : audio.muted ? 'Muted' : user.isGuest ? 'Guest' : 'Online'
	);

	const toggleClass = (off: boolean) =>
		cn('size-8', off && 'text-destructive hover:text-destructive');
</script>

{#snippet withTooltip(label: string, button: Snippet<[Record<string, unknown>]>)}
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				{@render button(props)}
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content>{label}</Tooltip.Content>
	</Tooltip.Root>
{/snippet}

{#snippet muteButton(props: Record<string, unknown>)}
	<Button
		{...props}
		variant="ghost"
		size="icon"
		class={toggleClass(audio.muted)}
		aria-label={audio.muted ? 'Unmute' : 'Mute'}
		aria-pressed={audio.muted}
		onclick={() => audio.toggleMute()}
	>
		{#if audio.muted}<MicOff />{:else}<Mic />{/if}
	</Button>
{/snippet}

{#snippet deafenButton(props: Record<string, unknown>)}
	<Button
		{...props}
		variant="ghost"
		size="icon"
		class={toggleClass(audio.deafened)}
		aria-label={audio.deafened ? 'Undeafen' : 'Deafen'}
		aria-pressed={audio.deafened}
		onclick={() => audio.toggleDeafen()}
	>
		{#if audio.deafened}<HeadphoneOff />{:else}<Headphones />{/if}
	</Button>
{/snippet}

{#snippet settingsButton(props: Record<string, unknown>)}
	<Button
		{...props}
		variant="ghost"
		size="icon"
		class="size-8"
		aria-label="Settings"
		onclick={() => (settingsOpen = true)}
	>
		<Settings />
	</Button>
{/snippet}

<!-- Bottom left of the sidebars, like in Discord: who is signed in, mute, deafen and the settings. -->
<section class="flex shrink-0 items-center gap-1 border-t bg-muted/40 p-2" aria-label="You">
	<a
		href={resolve('/(app)/account')}
		class="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-0.5 hover:bg-muted"
	>
		<UserAvatar
			{user}
			size="default"
			fallbackClass="bg-primary font-semibold text-primary-foreground"
		/>
		<span class="grid min-w-0 leading-tight">
			<span class="truncate text-sm font-medium">{user.name}</span>
			<span class="truncate text-xs text-muted-foreground">{status}</span>
		</span>
	</a>
	{@render withTooltip(audio.muted ? 'Unmute' : 'Mute', muteButton)}
	{@render withTooltip(audio.deafened ? 'Undeafen' : 'Deafen', deafenButton)}
	{@render withTooltip('Settings', settingsButton)}
</section>

<SettingsDialog {audio} bind:open={settingsOpen} section="audio" />
