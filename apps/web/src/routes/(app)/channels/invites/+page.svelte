<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { ArrowLeft, UserPlus } from '@lucide/svelte';
	import CopyButton from '#lib/components/invites/copy-button.svelte';
	import InviteList from '#lib/components/invites/invite-list.svelte';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Label } from '#lib/components/ui/label/index.ts';
	import {
		DEFAULT_EXPIRY,
		DEFAULT_MAX_USES,
		EXPIRY_OPTIONS,
		MAX_USES_OPTIONS
	} from '#lib/invites.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const inviteUrl = (code: string) => new URL(`/invite/${code}`, page.url.origin).href;
	const invites = $derived(data.invites.map((i) => ({ ...i, url: inviteUrl(i.code) })));
	const createdUrl = $derived(form?.createdCode ? inviteUrl(form.createdCode) : null);

	const selectClass =
		'h-9 w-full rounded-md border border-input bg-background px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30';
</script>

<svelte:head>
	<title>Invite people · Lumio</title>
</svelte:head>

<header class="flex h-12 shrink-0 items-center gap-2 border-b px-3">
	<a
		href={resolve('/(app)/channels')}
		class="-ml-1 flex size-8 items-center justify-center rounded-md hover:bg-muted md:hidden"
		aria-label="Back to channels"
	>
		<ArrowLeft class="size-4" />
	</a>
	<UserPlus class="size-4 text-muted-foreground" />
	<h1 class="truncate font-semibold">Invite people</h1>
</header>

<div class="min-h-0 flex-1 overflow-y-auto">
	<div class="mx-auto grid max-w-xl gap-8 p-4">
		<section class="grid gap-3" aria-labelledby="create-invite-heading">
			<div>
				<h2 id="create-invite-heading" class="font-semibold">Create an invite link</h2>
				<p class="text-sm text-muted-foreground">
					Anyone with the link can create an account and join {data.instance.name}.
				</p>
			</div>
			<form method="post" action="?/create" use:enhance class="grid gap-3 sm:grid-cols-2">
				<div class="grid gap-2">
					<Label for="expiry">Expire after</Label>
					<select id="expiry" name="expiry" class={selectClass} value={DEFAULT_EXPIRY}>
						{#each EXPIRY_OPTIONS as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>
				<div class="grid gap-2">
					<Label for="max-uses">Max number of uses</Label>
					<select id="max-uses" name="maxUses" class={selectClass} value={DEFAULT_MAX_USES}>
						{#each MAX_USES_OPTIONS as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>
				<Button type="submit" class="sm:col-span-2">Create invite link</Button>
			</form>
			{#if form?.inviteError}
				<p class="text-sm text-destructive" role="alert">{form.inviteError}</p>
			{:else if createdUrl}
				<div class="grid gap-2">
					<Label for="new-invite">Your new invite link</Label>
					<div class="flex gap-1">
						<Input
							id="new-invite"
							readonly
							value={createdUrl}
							class="font-mono"
							onfocus={(e) => e.currentTarget.select()}
						/>
						<CopyButton text={createdUrl} label="Copy new invite link" />
					</div>
				</div>
			{/if}
		</section>

		<section class="grid gap-3" aria-labelledby="active-invites-heading">
			<h2 id="active-invites-heading" class="font-semibold">
				{data.canManageAll ? 'Active invite links' : 'Your active invite links'}
			</h2>
			<InviteList {invites} showCreator={data.canManageAll} />
		</section>
	</div>
</div>
