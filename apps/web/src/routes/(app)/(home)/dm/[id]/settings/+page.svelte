<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { ArrowLeft, CircleAlert, LogOut, Settings, UserMinus } from '@lucide/svelte';
	import FriendPicker from '#lib/components/groups/friend-picker.svelte';
	import UserAvatar from '#lib/components/groups/user-avatar.svelte';
	import * as Alert from '#lib/components/ui/alert/index.ts';
	import { Badge } from '#lib/components/ui/badge/index.ts';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.ts';
	import * as Card from '#lib/components/ui/card/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import * as Item from '#lib/components/ui/item/index.ts';
	import { Label } from '#lib/components/ui/label/index.ts';
	import { groupTitle, MAX_GROUP_MEMBERS, MAX_GROUP_NAME_LENGTH } from '#lib/groups.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const title = $derived(groupTitle(data.group.name, data.group.others));
	const isOwner = $derived(data.group.ownerId === data.user.id);
	const members = $derived([data.user, ...data.group.others]);
	const freeSlots = $derived(MAX_GROUP_MEMBERS - members.length);
</script>

{#snippet failure(message: string | undefined)}
	{#if message}
		<Alert.Root variant="destructive">
			<CircleAlert />
			<Alert.Description>{message}</Alert.Description>
		</Alert.Root>
	{/if}
{/snippet}

<svelte:head>
	<title>{title} settings · Lumio</title>
</svelte:head>

<header class="flex h-12 shrink-0 items-center gap-2 border-b px-3">
	<a
		href={resolve('/(app)/(home)/dm/[id]', { id: data.group.id })}
		class={buttonVariants({ variant: 'ghost', size: 'icon', class: '-ml-1 size-8' })}
		aria-label="Back to chat"
	>
		<ArrowLeft />
	</a>
	<Settings class="size-4 shrink-0 text-muted-foreground" />
	<h1 class="min-w-0 truncate font-semibold">{title}</h1>
</header>

<div class="min-h-0 flex-1 overflow-y-auto">
	<div class="mx-auto grid max-w-xl grid-cols-[minmax(0,1fr)] gap-6 p-4">
		<Card.Root role="region" aria-labelledby="name-heading">
			<Card.Header>
				<Card.Title><h2 id="name-heading">Name</h2></Card.Title>
			</Card.Header>
			<Card.Content class="grid gap-3">
				<form method="post" action="?/rename" use:enhance class="flex flex-col gap-2 sm:flex-row">
					<Label for="group-name" class="sr-only">Group name</Label>
					<Input
						id="group-name"
						name="name"
						value={data.group.name ?? ''}
						maxlength={MAX_GROUP_NAME_LENGTH}
						placeholder={groupTitle(null, data.group.others)}
						autocomplete="off"
					/>
					<Button type="submit" variant="secondary">Rename</Button>
				</form>
				{@render failure(form?.renameError)}
			</Card.Content>
		</Card.Root>

		<Card.Root role="region" aria-labelledby="members-heading" class="gap-4">
			<Card.Header>
				<Card.Title>
					<h2 id="members-heading">
						Members <span class="font-normal text-muted-foreground">({members.length})</span>
					</h2>
				</Card.Title>
			</Card.Header>
			<Card.Content class="grid gap-3 px-2 sm:px-4">
				<Item.Group class="gap-0" aria-label="Members">
					{#each members as member (member.id)}
						<Item.Root size="sm" class="min-h-12 flex-nowrap px-2 py-1.5" role="listitem">
							<Item.Media>
								<UserAvatar user={member} />
							</Item.Media>
							<Item.Content class="min-w-0">
								<Item.Title class="line-clamp-none block w-full truncate font-normal">
									{member.name}{member.id === data.user.id ? ' (you)' : ''}
								</Item.Title>
							</Item.Content>
							<Item.Actions>
								{#if member.id === data.group.ownerId}
									<Badge variant="secondary">Owner</Badge>
								{/if}
								{#if isOwner && member.id !== data.user.id}
									<form method="post" action="?/remove" use:enhance>
										<input type="hidden" name="userId" value={member.id} />
										<Button
											type="submit"
											variant="ghost"
											size="icon"
											class="size-8"
											aria-label="Remove {member.name}"
										>
											<UserMinus />
										</Button>
									</form>
								{/if}
							</Item.Actions>
						</Item.Root>
					{/each}
				</Item.Group>
				{@render failure(form?.membersError)}
			</Card.Content>
		</Card.Root>

		<Card.Root role="region" aria-labelledby="add-heading">
			<Card.Header>
				<Card.Title><h2 id="add-heading">Add friends</h2></Card.Title>
				{#if freeSlots <= 0}
					<Card.Description>This group is full ({MAX_GROUP_MEMBERS} members).</Card.Description>
				{:else if data.addable.length === 0}
					<Card.Description>All your friends are already in this group.</Card.Description>
				{/if}
			</Card.Header>
			{#if (freeSlots > 0 && data.addable.length > 0) || form?.addError}
				<Card.Content class="grid gap-3">
					{#if freeSlots > 0 && data.addable.length > 0}
						<form method="post" action="?/add" use:enhance class="grid gap-3">
							<FriendPicker friends={data.addable} label="Friends to add" />
							<Button type="submit" class="sm:w-fit">Add to group</Button>
						</form>
					{/if}
					{@render failure(form?.addError)}
				</Card.Content>
			{/if}
		</Card.Root>

		<Card.Root role="region" aria-labelledby="leave-heading">
			<Card.Header>
				<Card.Title><h2 id="leave-heading">Leave group</h2></Card.Title>
				<Card.Description>
					You stop getting messages from this group.
					{#if isOwner && members.length > 1}
						The member who has been in the group the longest becomes the owner.
					{/if}
				</Card.Description>
			</Card.Header>
			<Card.Footer>
				<form method="post" action="?/leave" use:enhance class="w-full sm:w-fit">
					<Button type="submit" variant="destructive" class="w-full sm:w-fit">
						<LogOut /> Leave group
					</Button>
				</form>
			</Card.Footer>
		</Card.Root>
	</div>
</div>
