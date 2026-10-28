<script lang="ts">
	import { resolve } from '$app/paths';
	import { HeadphoneOff, Headphones, Mic, MicOff, Settings } from '@lucide/svelte';
	import type { AudioControls } from '#lib/call.svelte.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { cn } from '#lib/utils.ts';
	import SettingsDialog from '#lib/components/settings/settings-dialog.svelte';

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

<!-- Bottom left of the sidebars, like in Discord: who is signed in, mute, deafen and the settings. -->
<section class="flex shrink-0 items-center gap-1 border-t bg-muted/40 p-2" aria-label="You">
	<a
		href={resolve('/(app)/account')}
		class="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-0.5 hover:bg-muted"
	>
		{#if user.image}
			<img src={user.image} alt="" class="size-8 shrink-0 rounded-full object-cover" />
		{:else}
			<span
				class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
				aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span
			>
		{/if}
		<span class="grid min-w-0 leading-tight">
			<span class="truncate text-sm font-medium">{user.name}</span>
			<span class="truncate text-xs text-muted-foreground">{status}</span>
		</span>
	</a>
	<Button
		variant="ghost"
		size="icon"
		class={toggleClass(audio.muted)}
		aria-label={audio.muted ? 'Unmute' : 'Mute'}
		aria-pressed={audio.muted}
		title={audio.muted ? 'Unmute' : 'Mute'}
		onclick={() => audio.toggleMute()}
	>
		{#if audio.muted}<MicOff />{:else}<Mic />{/if}
	</Button>
	<Button
		variant="ghost"
		size="icon"
		class={toggleClass(audio.deafened)}
		aria-label={audio.deafened ? 'Undeafen' : 'Deafen'}
		aria-pressed={audio.deafened}
		title={audio.deafened ? 'Undeafen' : 'Deafen'}
		onclick={() => audio.toggleDeafen()}
	>
		{#if audio.deafened}<HeadphoneOff />{:else}<Headphones />{/if}
	</Button>
	<Button
		variant="ghost"
		size="icon"
		class="size-8"
		aria-label="Settings"
		title="Settings"
		onclick={() => (settingsOpen = true)}
	>
		<Settings />
	</Button>
</section>

<SettingsDialog {audio} bind:open={settingsOpen} section="audio" />
