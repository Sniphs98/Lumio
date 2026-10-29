<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { ArrowLeft, Users } from '@lucide/svelte';
	import { Badge } from '#lib/components/ui/badge/index.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import * as Dialog from '#lib/components/ui/dialog/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
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
		class="-ml-1 flex size-8 items-center justify-center rounded-md hover:bg-muted md:hidden"
		aria-label="Back to channels"
	>
		<ArrowLeft class="size-4" />
	</a>
	<Users class="size-4 text-muted-foreground" />
	<h1 class="truncate font-semibold">Members</h1>
</header>

<div class="min-h-0 flex-1 overflow-y-auto">
	<div class="mx-auto grid max-w-xl gap-8 p-4">
		{#if form?.error}
			<p class="text-sm text-destructive" role="alert">{form.error}</p>
		{:else if form?.kicked}
			<p class="text-sm text-muted-foreground" role="status">Kicked and signed out everywhere.</p>
		{:else if form?.banned}
			<p class="text-sm text-muted-foreground" role="status">Banned and signed out everywhere.</p>
		{:else if form?.unbanned}
			<p class="text-sm text-muted-foreground" role="status">The ban was lifted.</p>
		{/if}

		<section class="grid gap-2" aria-labelledby="members-heading">
			<h2 id="members-heading" class="font-semibold">
				{data.members.length}
				{data.members.length === 1 ? 'member' : 'members'}
			</h2>
			<ul class="grid divide-y rounded-md border">
				{#each data.members as member (member.id)}
					<li class="flex min-w-0 items-center gap-2 px-3 py-2">
						<span class="min-w-0 flex-1 truncate text-sm">{member.name}</span>
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
					</li>
				{/each}
			</ul>
		</section>

		{#if data.canBan}
			<section class="grid gap-2" aria-labelledby="bans-heading">
				<h2 id="bans-heading" class="font-semibold">Banned</h2>
				{#if data.bans.length === 0}
					<p class="text-sm text-muted-foreground">Nobody is banned.</p>
				{:else}
					<ul class="grid divide-y rounded-md border">
						{#each data.bans as entry (entry.userId)}
							<li class="flex min-w-0 items-center gap-2 px-3 py-2">
								<span class="grid min-w-0 flex-1">
									<span class="truncate text-sm">{entry.name}</span>
									<span class="truncate text-xs text-muted-foreground">
										{dateFormat.format(entry.createdAt)}{entry.reason ? ` · ${entry.reason}` : ''}
									</span>
								</span>
								<form method="post" action="?/unban" use:enhance>
									<input type="hidden" name="userId" value={entry.userId} />
									<Button type="submit" variant="outline" size="sm">Unban</Button>
								</form>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/if}
	</div>
</div>

<Dialog.Root bind:open={dialogOpen}>
	<Dialog.Content>
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
				<Dialog.Header>
					<Dialog.Title>
						{pending.action === 'kick' ? 'Kick' : 'Ban'}
						{pending.name}?
					</Dialog.Title>
					<Dialog.Description>
						{#if pending.action === 'ban'}
							They are signed out on every device and cannot sign in again until you lift the ban.
						{:else if pending.isGuest}
							They are signed out on every device. Guests have no password, so they lose access for
							good.
						{:else}
							They are signed out on every device and taken out of calls. With their password they
							can sign in again; ban them to keep them out.
						{/if}
					</Dialog.Description>
				</Dialog.Header>
				{#if pending.action === 'ban'}
					<div class="grid gap-2">
						<Label for="ban-reason">Reason (optional)</Label>
						<Input id="ban-reason" name="reason" maxlength={BAN_REASON_MAX_LENGTH} />
					</div>
				{/if}
				<Dialog.Footer>
					<Button type="button" variant="outline" onclick={() => (dialogOpen = false)}>
						Cancel
					</Button>
					<Button type="submit" variant="destructive">
						{pending.action === 'kick' ? 'Kick' : 'Ban'}
					</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
