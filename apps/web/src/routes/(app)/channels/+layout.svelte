<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Hash, Settings, UserPlus, Users, Volume2 } from '@lucide/svelte';
	import { call } from '#lib/call.svelte.ts';
	import { applyVoiceEvent, type VoiceEvent, type VoiceMember } from '#lib/calls.ts';
	import UserPanel from '#lib/components/audio/user-panel.svelte';
	import VoiceMembers from '#lib/components/call/voice-members.svelte';
	import UnreadBadge from '#lib/components/unread/unread-badge.svelte';
	import { getUnreadContext } from '#lib/unread-context.ts';
	import { NO_UNREAD } from '#lib/unread.ts';
	import { cn } from '#lib/utils.ts';
	import { setVoiceContext } from '#lib/voice-context.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const unread = getUnreadContext();

	// Who is in which voice channel, live for everyone, also without joining.
	let voice = $derived(data.voice);
	setVoiceContext({
		get channels() {
			return voice;
		}
	});
	$effect(() => {
		const source = new EventSource('/api/voice/events');
		const onEvent = (e: Event) => {
			voice = applyVoiceEvent(voice, JSON.parse((e as MessageEvent<string>).data) as VoiceEvent);
		};
		source.addEventListener('voice.state', onEvent);
		source.addEventListener('voice.changed', onEvent);
		return () => source.close();
	});

	function membersOf(channelId: string): (VoiceMember & { speaking?: boolean })[] {
		// In the call itself LiveKit tells us more, e.g. who is speaking, and without delay.
		if (call.isIn('channel', channelId)) {
			return call.participants.map((p) => ({
				id: p.identity,
				name: p.name,
				muted: p.micMuted,
				streaming: p.screen !== null,
				speaking: p.speaking
			}));
		}
		return voice[channelId] ?? [];
	}

	const textChannels = $derived(data.channels.filter((c) => c.type === 'text'));
	const voiceChannels = $derived(data.channels.filter((c) => c.type === 'voice'));
	const invitesOpen = $derived(page.route.id === '/(app)/channels/invites');
	const settingsOpen = $derived(page.route.id === '/(app)/channels/settings');
	const membersOpen = $derived(page.route.id === '/(app)/channels/members');
	// On phones either the channel list or the open page is shown, never both.
	const channelOpen = $derived(
		Boolean(page.params.id) || invitesOpen || settingsOpen || membersOpen
	);
</script>

<aside
	class={cn(
		'w-full shrink-0 flex-col md:flex md:w-60 md:border-r',
		channelOpen ? 'hidden' : 'flex'
	)}
	aria-label="Channels"
>
	<div class="min-h-0 flex-1 overflow-y-auto p-3">
		<div class="grid gap-0.5 pb-3">
			<a
				href={resolve('/(app)/channels/members')}
				class={cn(
					'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted',
					membersOpen ? 'bg-muted text-foreground' : 'text-muted-foreground'
				)}
				aria-current={membersOpen ? 'page' : undefined}
			>
				<Users class="size-4 shrink-0" />
				<span class="truncate">Members</span>
			</a>
			{#if data.canInvite}
				<a
					href={resolve('/(app)/channels/invites')}
					class={cn(
						'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted',
						invitesOpen ? 'bg-muted text-foreground' : 'text-muted-foreground'
					)}
					aria-current={invitesOpen ? 'page' : undefined}
				>
					<UserPlus class="size-4 shrink-0" />
					<span class="truncate">Invite people</span>
				</a>
			{/if}
			{#if data.canManageServer}
				<a
					href={resolve('/(app)/channels/settings')}
					class={cn(
						'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted',
						settingsOpen ? 'bg-muted text-foreground' : 'text-muted-foreground'
					)}
					aria-current={settingsOpen ? 'page' : undefined}
				>
					<Settings class="size-4 shrink-0" />
					<span class="truncate">Server settings</span>
				</a>
			{/if}
		</div>
		<h2 class="px-2 pb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
			Text channels
		</h2>
		<ul class="grid gap-0.5 pb-4">
			{#each textChannels as c (c.id)}
				<li>
					<a
						href={resolve('/(app)/channels/[id]', { id: c.id })}
						class={cn(
							'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted',
							page.params.id === c.id ? 'bg-muted text-foreground' : 'text-muted-foreground'
						)}
						aria-current={page.params.id === c.id ? 'page' : undefined}
					>
						<Hash class="size-4 shrink-0" />
						<span class="truncate">{c.name}</span>
						{#if page.params.id !== c.id}
							<UnreadBadge unread={unread.counts.channels[c.id] ?? NO_UNREAD} />
						{/if}
					</a>
				</li>
			{/each}
		</ul>
		<h2 class="px-2 pb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
			Voice channels
		</h2>
		<ul class="grid gap-0.5">
			{#each voiceChannels as c (c.id)}
				{@const members = membersOf(c.id)}
				<li>
					<a
						href={resolve('/(app)/channels/[id]', { id: c.id })}
						class={cn(
							'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted',
							page.params.id === c.id ? 'bg-muted text-foreground' : 'text-muted-foreground'
						)}
						aria-current={page.params.id === c.id ? 'page' : undefined}
					>
						<Volume2 class="size-4 shrink-0" />
						<span class="truncate">{c.name}</span>
						{#if page.params.id !== c.id}
							<UnreadBadge unread={unread.counts.channels[c.id] ?? NO_UNREAD} />
						{/if}
					</a>
					{#if members.length > 0}
						<VoiceMembers {members} label="In {c.name}" class="py-0.5 pl-8" />
					{/if}
				</li>
			{/each}
		</ul>
	</div>
	<UserPanel user={data.user} audio={call} />
</aside>

<div class={cn('min-w-0 flex-1 flex-col md:flex', channelOpen ? 'flex' : 'hidden')}>
	{@render children()}
</div>
