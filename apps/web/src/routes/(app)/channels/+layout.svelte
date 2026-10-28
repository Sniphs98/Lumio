<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Hash, MicOff, Settings, UserPlus, Volume2 } from '@lucide/svelte';
	import { call } from '#lib/call.svelte.ts';
	import UnreadBadge from '#lib/components/unread/unread-badge.svelte';
	import { getUnreadContext } from '#lib/unread-context.ts';
	import { NO_UNREAD } from '#lib/unread.ts';
	import { cn } from '#lib/utils.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const unread = getUnreadContext();

	const textChannels = $derived(data.channels.filter((c) => c.type === 'text'));
	const voiceChannels = $derived(data.channels.filter((c) => c.type === 'voice'));
	const invitesOpen = $derived(page.route.id === '/(app)/channels/invites');
	const settingsOpen = $derived(page.route.id === '/(app)/channels/settings');
	// On phones either the channel list or the open page is shown, never both.
	const channelOpen = $derived(Boolean(page.params.id) || invitesOpen || settingsOpen);
</script>

<aside
	class={cn(
		'w-full shrink-0 flex-col overflow-y-auto p-3 md:flex md:w-60 md:border-r',
		channelOpen ? 'hidden' : 'flex'
	)}
	aria-label="Channels"
>
	<div class="grid gap-0.5 pb-3 empty:hidden">
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
				</a>
				{#if call.isIn('channel', c.id)}
					<!-- Who is in the voice channel, while the user is in it too. -->
					<ul class="grid gap-0.5 py-0.5 pl-8" aria-label="In {c.name}">
						{#each call.participants as p (p.identity)}
							<li class="flex items-center gap-1.5 text-sm text-muted-foreground">
								<span
									class={cn(
										'size-2 shrink-0 rounded-full',
										p.speaking ? 'bg-emerald-500' : 'bg-muted-foreground/40'
									)}
								></span>
								<span class="truncate">{p.name}</span>
								{#if p.micMuted}<MicOff class="size-3 shrink-0" aria-label="Muted" />{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</li>
		{/each}
	</ul>
</aside>

<div class={cn('min-w-0 flex-1 flex-col md:flex', channelOpen ? 'flex' : 'hidden')}>
	{@render children()}
</div>
