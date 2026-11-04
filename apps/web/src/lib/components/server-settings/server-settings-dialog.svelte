<script lang="ts" module>
	import type { UploadQuotas } from '#lib/attachments.ts';

	/** The sections of the server settings. New sections are added here and below. */
	export type ServerSettingsSection = 'overview' | 'files' | 'chat' | 'bans';

	export type BannedUser = { userId: string; name: string; reason: string | null; createdAt: Date };

	/** What the dialog shows. A part is null when the user may not change it. */
	export type ServerSettings = {
		/** Needs Manage server. */
		general: {
			name: string;
			iconUrl: string | null;
			isPublic: boolean;
			maxUploadSize: number;
			quotas: UploadQuotas;
			/** Whether GIF search is set up, and whether by the environment. */
			gifs: { hasKey: boolean; fromEnv: boolean };
		} | null;
		/** Needs Ban members. */
		bans: BannedUser[] | null;
	};
</script>

<script lang="ts">
	import { resolve } from '$app/paths';
	import { Ban, HardDrive, ImagePlay, SlidersHorizontal } from '@lucide/svelte';
	import SettingsShell, {
		type SettingsShellSection
	} from '#lib/components/settings/settings-shell.svelte';
	import BansSection from './bans-section.svelte';
	import ChatSection from './chat-section.svelte';
	import FilesSection from './files-section.svelte';
	import OverviewSection from './overview-section.svelte';

	type Props = {
		settings: ServerSettings;
		open?: boolean;
		/** The section shown when the dialog opens. Falls back to the first one the user may see. */
		section?: ServerSettingsSection;
	};

	let { settings, open = $bindable(false), section = $bindable('overview') }: Props = $props();

	// The form actions, so the dialog works on every page of the server.
	const action = resolve('/(app)/channels/settings');

	const sections = $derived(
		(
			[
				settings.general && { id: 'overview', label: 'Overview', icon: SlidersHorizontal },
				settings.general && { id: 'files', label: 'Files & storage', icon: HardDrive },
				settings.general && { id: 'chat', label: 'GIFs', icon: ImagePlay },
				settings.bans && { id: 'bans', label: 'Bans', icon: Ban }
			] satisfies (SettingsShellSection<ServerSettingsSection> | null)[]
		).filter((s) => s !== null)
	);
</script>

<SettingsShell title="Server settings" {sections} bind:open bind:section>
	{#snippet children(id)}
		{#if id === 'overview' && settings.general}
			<OverviewSection
				{action}
				name={settings.general.name}
				iconUrl={settings.general.iconUrl}
				isPublic={settings.general.isPublic}
			/>
		{:else if id === 'files' && settings.general}
			<FilesSection
				{action}
				maxUploadSize={settings.general.maxUploadSize}
				quotas={settings.general.quotas}
			/>
		{:else if id === 'chat' && settings.general}
			<ChatSection {action} gifs={settings.general.gifs} />
		{:else if id === 'bans' && settings.bans}
			<BansSection {action} bans={settings.bans} />
		{/if}
	{/snippet}
</SettingsShell>
