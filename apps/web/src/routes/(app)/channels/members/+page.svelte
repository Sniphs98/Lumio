<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowLeft, CircleAlert, Users } from '@lucide/svelte';
	import UserAvatar from '#lib/components/groups/user-avatar.svelte';
	import * as Alert from '#lib/components/ui/alert/index.ts';
	import { Badge } from '#lib/components/ui/badge/index.ts';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.ts';
	import * as Card from '#lib/components/ui/card/index.ts';
	import * as Item from '#lib/components/ui/item/index.ts';
	import UserContextMenu from '#lib/components/users/user-context-menu.svelte';
	import { getUserMenuContext } from '#lib/user-menu.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// The channels layout asks for confirmation; right-clicking a member offers the same.
	const menu = getUserMenuContext();
</script>

<svelte:head>
	<title>Members · Lumio</title>
</svelte:head>

<header class="flex h-12 shrink-0 items-center gap-2 border-b px-3">
	<a
		href={resolve('/(app)/channels')}
		class={buttonVariants({ variant: 'ghost', size: 'icon', class: '-ml-1 size-8 md:hidden' })}
		aria-label="Back to channels"
	>
		<ArrowLeft />
	</a>
	<Users class="size-4 text-muted-foreground" />
	<h1 class="truncate font-semibold">Members</h1>
</header>

<div class="min-h-0 flex-1 overflow-y-auto">
	<div class="mx-auto grid max-w-xl grid-cols-[minmax(0,1fr)] gap-6 p-4">
		{#if form?.error}
			<Alert.Root variant="destructive">
				<CircleAlert />
				<Alert.Description>{form.error}</Alert.Description>
			</Alert.Root>
		{:else if form?.kicked || form?.banned}
			<Alert.Root role="status">
				<Alert.Description>
					{form.kicked ? 'Kicked and signed out everywhere.' : 'Banned and signed out everywhere.'}
				</Alert.Description>
			</Alert.Root>
		{/if}

		<Card.Root role="region" aria-labelledby="members-heading" class="gap-4">
			<Card.Header>
				<Card.Title>
					<h2 id="members-heading">
						{data.members.length}
						{data.members.length === 1 ? 'member' : 'members'}
					</h2>
				</Card.Title>
			</Card.Header>
			<Card.Content class="px-2 sm:px-4">
				<Item.Group class="gap-0">
					{#each data.members as member (member.id)}
						<UserContextMenu user={member}>
							{#snippet child({ props })}
								<Item.Root {...props} size="sm" class="flex-nowrap px-2 py-2" role="listitem">
									<Item.Media>
										<UserAvatar user={member} />
									</Item.Media>
									<Item.Content class="min-w-0">
										<Item.Title class="line-clamp-none block w-full truncate font-normal">
											{member.name}
										</Item.Title>
									</Item.Content>
									<Item.Actions class="gap-1.5">
										{#if member.isOwner}<Badge variant="secondary">Owner</Badge>{/if}
										{#if member.isGuest}<Badge variant="outline">Guest</Badge>{/if}
										{#if member.canKick}
											<Button
												variant="outline"
												size="sm"
												onclick={() => menu.moderate('kick', member)}
											>
												Kick
											</Button>
										{/if}
										{#if member.canBan}
											<Button
												variant="destructive"
												size="sm"
												onclick={() => menu.moderate('ban', member)}
											>
												Ban
											</Button>
										{/if}
									</Item.Actions>
								</Item.Root>
							{/snippet}
						</UserContextMenu>
					{/each}
				</Item.Group>
			</Card.Content>
		</Card.Root>
	</div>
</div>
