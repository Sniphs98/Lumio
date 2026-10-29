<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { AtSign, Ban, MessageSquare, UserX } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import * as ContextMenu from '#lib/components/ui/context-menu/index.ts';
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
		/** The element that opens the menu on right-click or long-press; spread `props` onto it. */
		child: Snippet<[{ props: Record<string, unknown> }]>;
	};

	let { user, onmention, child }: Props = $props();

	// Outside a server, e.g. in direct messages, there is nobody to kick or ban.
	const menu = hasUserMenuContext() ? getUserMenuContext() : undefined;
	const items = $derived(userMenuItems(user.id, menu?.access, onmention !== undefined));
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
			{#if (items.kick || items.ban) && (items.message || items.mention)}
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
