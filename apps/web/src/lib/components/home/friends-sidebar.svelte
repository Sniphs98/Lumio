<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Check, Plus, UserPlus, Users, X } from '@lucide/svelte';
	import UserAvatar from '#lib/components/groups/user-avatar.svelte';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import type { FriendUser } from '#lib/friends.ts';
	import { cn } from '#lib/utils.ts';

	type Props = {
		friends: FriendUser[];
		incoming: FriendUser[];
		outgoing: FriendUser[];
		groups: { id: string; title: string; memberCount: number }[];
		/** Friend id to the id of the direct conversation with them, if there is one. */
		directConversationIds: Record<string, string>;
		/** Conversation shown next to the sidebar, if any. */
		activeConversationId?: string;
		/** Result of the last friend action. */
		notice?: string;
		error?: string;
	};

	let {
		friends,
		incoming,
		outgoing,
		groups,
		directConversationIds,
		activeConversationId,
		notice,
		error
	}: Props = $props();

	const heading = 'px-2 pb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase';
	const row = 'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm';
</script>

<section class="border-b p-3" aria-labelledby="add-friend-heading">
	<h2 id="add-friend-heading" class={heading}>Add friend</h2>
	<form method="post" action="/?/addFriend" class="flex gap-2 px-2" use:enhance>
		<Input
			type="email"
			name="email"
			required
			placeholder="friend@example.com"
			aria-label="Friend's email"
			autocomplete="off"
			class="h-8"
		/>
		<Button type="submit" size="sm" aria-label="Send friend request">
			<UserPlus />
		</Button>
	</form>
	{#if error}
		<p class="px-2 pt-2 text-sm text-destructive" role="alert">{error}</p>
	{:else if notice}
		<p class="px-2 pt-2 text-sm text-muted-foreground" role="status">{notice}</p>
	{/if}
</section>

{#if incoming.length > 0}
	<section class="p-3" aria-labelledby="incoming-heading">
		<h2 id="incoming-heading" class={heading}>Friend requests</h2>
		<ul class="grid gap-0.5">
			{#each incoming as user (user.id)}
				<li class={row}>
					<UserAvatar {user} />
					<span class="min-w-0 flex-1 truncate">{user.name}</span>
					<form method="post" action="/?/accept" use:enhance>
						<input type="hidden" name="userId" value={user.id} />
						<Button
							type="submit"
							size="icon"
							variant="ghost"
							class="size-7"
							aria-label="Accept {user.name}"
						>
							<Check />
						</Button>
					</form>
					<form method="post" action="/?/remove" use:enhance>
						<input type="hidden" name="userId" value={user.id} />
						<Button
							type="submit"
							size="icon"
							variant="ghost"
							class="size-7"
							aria-label="Decline {user.name}"
						>
							<X />
						</Button>
					</form>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<section class="p-3" aria-labelledby="friends-heading">
	<h2 id="friends-heading" class={heading}>Friends</h2>
	{#if friends.length === 0}
		<p class="px-2 text-sm text-muted-foreground">No friends added yet.</p>
	{:else}
		<ul class="grid gap-0.5">
			{#each friends as user (user.id)}
				{@const active =
					activeConversationId !== undefined &&
					directConversationIds[user.id] === activeConversationId}
				<li>
					<a
						href={resolve('/(app)/(home)/friends/[userId]', { userId: user.id })}
						class={cn(
							row,
							'hover:bg-muted',
							active ? 'bg-muted text-foreground' : 'text-muted-foreground'
						)}
						aria-current={active ? 'page' : undefined}
					>
						<UserAvatar {user} />
						<span class="truncate">{user.name}</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>

{#if outgoing.length > 0}
	<section class="p-3" aria-labelledby="outgoing-heading">
		<h2 id="outgoing-heading" class={heading}>Sent requests</h2>
		<ul class="grid gap-0.5">
			{#each outgoing as user (user.id)}
				<li class="{row} text-muted-foreground">
					<UserAvatar {user} />
					<span class="min-w-0 flex-1 truncate">{user.name}</span>
					<form method="post" action="/?/remove" use:enhance>
						<input type="hidden" name="userId" value={user.id} />
						<Button
							type="submit"
							size="icon"
							variant="ghost"
							class="size-7"
							aria-label="Cancel request to {user.name}"
						>
							<X />
						</Button>
					</form>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<section class="p-3" aria-labelledby="groups-heading">
	<div class="flex items-center justify-between pr-1">
		<h2 id="groups-heading" class={heading}>Groups</h2>
		<a
			href={resolve('/(app)/(home)/groups/new')}
			class="-mt-2 flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
			aria-label="Create group"
			title="Create group"
		>
			<Plus class="size-4" />
		</a>
	</div>
	{#if groups.length === 0}
		<p class="px-2 text-sm text-muted-foreground">No group chats yet.</p>
	{:else}
		<ul class="grid gap-0.5">
			{#each groups as group (group.id)}
				<li>
					<a
						href={resolve('/(app)/(home)/dm/[id]', { id: group.id })}
						class={cn(
							row,
							'hover:bg-muted',
							group.id === activeConversationId
								? 'bg-muted text-foreground'
								: 'text-muted-foreground'
						)}
						aria-current={group.id === activeConversationId ? 'page' : undefined}
					>
						<Users class="size-4 shrink-0" />
						<span class="min-w-0 flex-1 truncate">{group.title}</span>
						<span class="shrink-0 text-xs" aria-hidden="true">{group.memberCount}</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>
