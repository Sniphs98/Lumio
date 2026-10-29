<script lang="ts" module>
	/** The sections of the settings dialog. New sections are added here and below. */
	export type SettingsSection = 'audio';
</script>

<script lang="ts">
	import { AudioLines } from '@lucide/svelte';
	import type { AudioControls } from '#lib/call.svelte.ts';
	import AudioSection from './audio-section.svelte';
	import SettingsShell, { type SettingsShellSection } from './settings-shell.svelte';

	type Props = {
		audio: AudioControls;
		open?: boolean;
		/** The section shown when the dialog opens. */
		section?: SettingsSection;
		/** The browser's audio devices. Tests pass a fixed list. */
		listDevices?: () => Promise<Pick<MediaDeviceInfo, 'deviceId' | 'kind' | 'label'>[]>;
	};

	let {
		audio,
		open = $bindable(false),
		section = $bindable('audio'),
		listDevices
	}: Props = $props();

	const sections: SettingsShellSection<SettingsSection>[] = [
		{ id: 'audio', label: 'Audio & Mic', icon: AudioLines }
	];
</script>

<SettingsShell title="Settings" {sections} bind:open bind:section>
	{#snippet children(id)}
		{#if id === 'audio'}
			<AudioSection {audio} {listDevices} />
		{/if}
	{/snippet}
</SettingsShell>
