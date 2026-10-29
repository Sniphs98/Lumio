<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { ArrowLeft, CircleAlert, Users } from '@lucide/svelte';
	import UserAvatar from '#lib/components/groups/user-avatar.svelte';
	import * as Alert from '#lib/components/ui/alert/index.ts';
	import * as AlertDialog from '#lib/components/ui/alert-dialog/index.ts';
	import { Badge } from '#lib/components/ui/badge/index.ts';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.ts';
	import * as Card from '#lib/components/ui/card/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import * as Item from '#lib/components/ui/item/index.ts';
	import { Label } from '#lib/components/ui/label/index.ts';
	import { BAN_REASON_MAX_LENGTH, type ModerationAction } from '#lib/moderation.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	/** The kick or ban waiting for confirmation. */
	let pending: { action: ModerationAction; id: string; name: string; isGuest: boolean } | null =
		$state(null);
	let dialogOpen = $state(false);

	function confirm(
		action: ModerationAction,
		member: { id: string; name: string; isGuest: boolean }
	) {
		pending = { action, ...member };
		dialogOpen = true;
	}

	const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
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
		{:else if form?.kicked || form?.banned || form?.unbanned}
			<Alert.Root role="status">
				<Alert.Description>
					{form.kicked
						? 'Kicked and signed out everywhere.'
						: form.banned
							? 'Banned and signed out everywhere.'
							: 'The ban was lifted.'}
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
						<Item.Root size="sm" class="flex-nowrap px-2 py-2" role="listitem">
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
									<Button variant="outline" size="sm" onclick={() => confirm('kick', member)}>
										Kick
									</Button>
								{/if}
								{#if member.canBan}
									<Button variant="destructive" size="sm" onclick={() => confirm('ban', member)}>
										Ban
									</Button>
								{/if}
							</Item.Actions>
						</Item.Root>
					{/each}
				</Item.Group>
			</Card.Content>
		</Card.Root>

		{#if data.canBan}
			<Card.Root role="region" aria-labelledby="bans-heading" class="gap-4">
				<Card.Header>
					<Card.Title><h2 id="bans-heading">Banned</h2></Card.Title>
					{#if data.bans.length === 0}
						<Card.Description>Nobody is banned.</Card.Description>
					{/if}
				</Card.Header>
				{#if data.bans.length > 0}
					<Card.Content class="px-2 sm:px-4">
						<Item.Group class="gap-0">
							{#each data.bans as entry (entry.userId)}
								<Item.Root size="sm" class="flex-nowrap px-2 py-2" role="listitem">
									<Item.Content class="min-w-0">
										<Item.Title class="line-clamp-none block w-full truncate font-normal">
											{entry.name}
										</Item.Title>
										<Item.Description class="line-clamp-1 text-xs">
											{dateFormat.format(entry.createdAt)}{entry.reason ? ` · ${entry.reason}` : ''}
										</Item.Description>
									</Item.Content>
									<Item.Actions>
										<form method="post" action="?/unban" use:enhance>
											<input type="hidden" name="userId" value={entry.userId} />
											<Button type="submit" variant="outline" size="sm">Unban</Button>
										</form>
									</Item.Actions>
								</Item.Root>
							{/each}
						</Item.Group>
					</Card.Content>
				{/if}
			</Card.Root>
		{/if}
	</div>
</div>

<AlertDialog.Root bind:open={dialogOpen}>
	<AlertDialog.Content>
		{#if pending}
			<form
				method="post"
				action="?/{pending.action}"
				use:enhance={() =>
					async ({ update }) => {
						dialogOpen = false;
						await update();
					}}
				class="grid gap-4"
			>
				<input type="hidden" name="userId" value={pending.id} />
				<AlertDialog.Header>
					<AlertDialog.Title>
						{pending.action === 'kick' ? 'Kick' : 'Ban'}
						{pending.name}?
					</AlertDialog.Title>
					<AlertDialog.Description>
						{#if pending.action === 'ban'}
							They are signed out on every device and cannot sign in again until you lift the ban.
						{:else if pending.isGuest}
							They are signed out on every device. Guests have no password, so they lose access for
							good.
						{:else}
							They are signed out on every device and taken out of calls. With their password they
							can sign in again; ban them to keep them out.
						{/if}
					</AlertDialog.Description>
				</AlertDialog.Header>
				{#if pending.action === 'ban'}
					<div class="grid gap-2">
						<Label for="ban-reason">Reason (optional)</Label>
						<Input id="ban-reason" name="reason" maxlength={BAN_REASON_MAX_LENGTH} />
					</div>
				{/if}
				<AlertDialog.Footer>
					<AlertDialog.Cancel type="button">Cancel</AlertDialog.Cancel>
					<Button type="submit" variant="destructive">
						{pending.action === 'kick' ? 'Kick' : 'Ban'}
					</Button>
				</AlertDialog.Footer>
			</form>
		{/if}
	</AlertDialog.Content>
</AlertDialog.Root>
