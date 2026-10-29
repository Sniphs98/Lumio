<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { AtSign, Ban, MessageSquare, UserX } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import { call, type UserAudioControls } from '#lib/call.svelte.ts';
	import * as ContextMenu from '#lib/components/ui/context-menu/index.ts';
	import { Label } from '#lib/components/ui/label/index.ts';
	import { Slider } from '#lib/components/ui/slider/index.ts';
	import {
		getUserMenuContext,
		hasItems,
		hasUserMenuContext,
		userMenuItems,
		type MenuUser
	} from '#lib/user-menu.ts';

	type Props = {
		user: MenuUser;
		/** Offers "Mention", e.g. in a chat the user can write in. */
		onmention?: () => void;
		/** Offers the volume and mute for this user only, e.g. in a voice channel or call. */
		voice?: boolean;
		/** Where the volume is kept. Tests pass a fake. */
		audio?: UserAudioControls;
		/** The element that opens the menu on right-click or long-press; spread `props` onto it. */
		child: Snippet<[{ props: Record<string, unknown> }]>;
	};

	let { user, onmention, voice = false, audio = call, child }: Props = $props();
	const volumeId = $props.id();

	// Outside a server, e.g. in direct messages, there is nobody to kick or ban.
	const menu = hasUserMenuContext() ? getUserMenuContext() : undefined;
	const items = $derived(
		userMenuItems(user.id, menu?.access, { mention: onmention !== undefined, voice })
	);
	const userAudio = $derived(audio.userAudioOf(user.id));
</script>

{#if hasItems(items)}
	<ContextMenu.Root>
		<ContextMenu.Trigger {child} />
		<ContextMenu.Content class="w-52">
			<ContextMenu.Label class="truncate">{user.name}</ContextMenu.Label>
			<ContextMenu.Separator />
			{#if items.message}
				<ContextMenu.Item
					onSelect={() => goto(resolve('/(app)/(home)/friends/[userId]', { userId: user.id }))}
				>
					<MessageSquare />
					Send message
				</ContextMenu.Item>
			{/if}
			{#if items.mention}
				<ContextMenu.Item onSelect={onmention}>
					<AtSign />
					Mention
				</ContextMenu.Item>
			{/if}
			{#if items.volume}
				{#if items.message || items.mention}
					<ContextMenu.Separator />
				{/if}
				<div class="grid gap-2.5 px-1.5 py-1.5">
					<div class="flex items-center justify-between text-sm">
						<Label id="{volumeId}-label" class="font-normal">User volume</Label>
						<span class="text-xs text-muted-foreground tabular-nums">
							{Math.round(userAudio.volume * 100)}%
						</span>
					</div>
					<Slider
						type="single"
						value={Math.round(userAudio.volume * 100)}
						onValueChange={(v) => audio.setUserAudio(user.id, { volume: v / 100 })}
						max={100}
						step={1}
						disabled={userAudio.muted}
						aria-labelledby="{volumeId}-label"
					/>
				</div>
				<ContextMenu.CheckboxItem
					checked={userAudio.muted}
					onCheckedChange={(muted) => audio.setUserAudio(user.id, { muted })}
				>
					Mute
				</ContextMenu.CheckboxItem>
			{/if}
			{#if (items.kick || items.ban) && (items.message || items.mention || items.volume)}
				<ContextMenu.Separator />
			{/if}
			{#if items.kick}
				<ContextMenu.Item variant="destructive" onSelect={() => menu?.moderate('kick', user)}>
					<UserX />
					Kick
				</ContextMenu.Item>
			{/if}
			{#if items.ban}
				<ContextMenu.Item variant="destructive" onSelect={() => menu?.moderate('ban', user)}>
					<Ban />
					Ban
				</ContextMenu.Item>
			{/if}
		</ContextMenu.Content>
	</ContextMenu.Root>
{:else}
	{@render child({ props: {} })}
{/if}
