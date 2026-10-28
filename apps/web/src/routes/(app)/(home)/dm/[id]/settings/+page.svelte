<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { ArrowLeft, LogOut, Settings, UserMinus } from '@lucide/svelte';
	import FriendPicker from '#lib/components/groups/friend-picker.svelte';
	import UserAvatar from '#lib/components/groups/user-avatar.svelte';
	import { Badge } from '#lib/components/ui/badge/index.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Label } from '#lib/components/ui/label/index.ts';
	import { groupTitle, MAX_GROUP_MEMBERS, MAX_GROUP_NAME_LENGTH } from '#lib/groups.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const title = $derived(groupTitle(data.group.name, data.group.others));
	const isOwner = $derived(data.group.ownerId === data.user.id);
	const members = $derived([data.user, ...data.group.others]);
	const freeSlots = $derived(MAX_GROUP_MEMBERS - members.length);
	const section = 'grid gap-3';
	const sectionHeading = 'font-semibold';
</script>

<svelte:head>
	<title>{title} settings · Lumio</title>
</svelte:head>

<header class="flex h-12 shrink-0 items-center gap-2 border-b px-3">
	<a
		href={resolve('/(app)/(home)/dm/[id]', { id: data.group.id })}
		class="-ml-1 flex size-8 items-center justify-center rounded-md hover:bg-muted"
		aria-label="Back to chat"
	>
		<ArrowLeft class="size-4" />
	</a>
	<Settings class="size-4 shrink-0 text-muted-foreground" />
	<h1 class="min-w-0 truncate font-semibold">{title}</h1>
</header>

<div class="min-h-0 flex-1 overflow-y-auto">
	<div class="mx-auto grid max-w-xl gap-8 p-4">
		<section class={section} aria-labelledby="name-heading">
			<h2 id="name-heading" class={sectionHeading}>Name</h2>
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
			{#if form?.renameError}
				<p class="text-sm text-destructive" role="alert">{form.renameError}</p>
			{/if}
		</section>

		<section class={section} aria-labelledby="members-heading">
			<h2 id="members-heading" class={sectionHeading}>
				Members <span class="font-normal text-muted-foreground">({members.length})</span>
			</h2>
			<ul class="grid gap-0.5" aria-label="Members">
				{#each members as member (member.id)}
					<li class="flex min-h-10 items-center gap-3 rounded-md px-2 text-sm">
						<UserAvatar user={member} />
						<span class="min-w-0 flex-1 truncate">
							{member.name}{member.id === data.user.id ? ' (you)' : ''}
						</span>
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
					</li>
				{/each}
			</ul>
			{#if form?.membersError}
				<p class="text-sm text-destructive" role="alert">{form.membersError}</p>
			{/if}
		</section>

		<section class={section} aria-labelledby="add-heading">
			<h2 id="add-heading" class={sectionHeading}>Add friends</h2>
			{#if freeSlots <= 0}
				<p class="text-sm text-muted-foreground">
					This group is full ({MAX_GROUP_MEMBERS} members).
				</p>
			{:else if data.addable.length === 0}
				<p class="text-sm text-muted-foreground">All your friends are already in this group.</p>
			{:else}
				<form method="post" action="?/add" use:enhance class="grid gap-3">
					<FriendPicker friends={data.addable} label="Friends to add" />
					<Button type="submit" class="sm:w-fit">Add to group</Button>
				</form>
			{/if}
			{#if form?.addError}
				<p class="text-sm text-destructive" role="alert">{form.addError}</p>
			{/if}
		</section>

		<section class={section} aria-labelledby="leave-heading">
			<h2 id="leave-heading" class={sectionHeading}>Leave group</h2>
			<p class="text-sm text-muted-foreground">
				You stop getting messages from this group.
				{#if isOwner && members.length > 1}
					The member who has been in the group the longest becomes the owner.
				{/if}
			</p>
			<form method="post" action="?/leave" use:enhance>
				<Button type="submit" variant="destructive" class="w-full sm:w-fit">
					<LogOut /> Leave group
				</Button>
			</form>
		</section>
	</div>
</div>
