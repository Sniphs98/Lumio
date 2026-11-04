<script lang="ts">
	import { MicOff } from '@lucide/svelte';
	import { call, type UserAudioControls } from '#lib/call.svelte.ts';
	import UserAvatar from '#lib/components/groups/user-avatar.svelte';
	import { Badge } from '#lib/components/ui/badge/index.ts';
	import * as Tooltip from '#lib/components/ui/tooltip/index.ts';
	import UserAudioIcon from '#lib/components/users/user-audio-icon.svelte';
	import UserContextMenu from '#lib/components/users/user-context-menu.svelte';
	import type { VoiceMember } from '#lib/calls.ts';
	import { cn } from '#lib/utils.ts';

	type Member = VoiceMember & {
		/** Only known while the user is in the call too. */
		speaking?: boolean;
	};

	let {
		members,
		label,
		audio = call,
		class: className
	}: {
		members: Member[];
		label: string;
		/** Who this user turned down or muted for themselves. Tests pass a fake. */
		audio?: Pick<UserAudioControls, 'userAudioOf'>;
		class?: string;
	} = $props();
</script>

<ul class={cn('grid gap-0.5', className)} aria-label={label}>
	{#each members as m (m.id)}
		<UserContextMenu user={m} voice>
			{#snippet child({ props })}
				<li
					{...props}
					class="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground"
					data-speaking={m.speaking ?? false}
				>
					<UserAvatar
						user={m}
						class={cn(
							'size-5 ring-2 data-[size=sm]:size-5',
							m.speaking ? 'ring-emerald-500' : 'ring-transparent'
						)}
						fallbackClass="text-[0.625rem] font-semibold"
					/>
					<span class="truncate">{m.name}</span>
					{#if m.muted}<MicOff class="size-3 shrink-0" aria-label="Muted" />{/if}
					<UserAudioIcon audio={audio.userAudioOf(m.id)} class="size-3" />
					{#if m.streaming}
						<Tooltip.Root>
							<Tooltip.Trigger>
								{#snippet child({ props })}
									<Badge
										{...props}
										class="h-4 rounded bg-red-600 px-1 text-[0.625rem] font-semibold text-white"
										aria-label="Sharing their screen">LIVE</Badge
									>
								{/snippet}
							</Tooltip.Trigger>
							<Tooltip.Content>Sharing their screen</Tooltip.Content>
						</Tooltip.Root>
					{/if}
				</li>
			{/snippet}
		</UserContextMenu>
	{/each}
</ul>
