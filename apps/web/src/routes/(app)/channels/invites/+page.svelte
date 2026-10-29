<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { ArrowLeft, CircleAlert, UserPlus } from '@lucide/svelte';
	import CopyButton from '#lib/components/invites/copy-button.svelte';
	import InviteList from '#lib/components/invites/invite-list.svelte';
	import * as Alert from '#lib/components/ui/alert/index.ts';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.ts';
	import * as Card from '#lib/components/ui/card/index.ts';
	import { Checkbox } from '#lib/components/ui/checkbox/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Label } from '#lib/components/ui/label/index.ts';
	import * as Select from '#lib/components/ui/select/index.ts';
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

	let expiry = $state<string>(DEFAULT_EXPIRY);
	let maxUses = $state<string>(DEFAULT_MAX_USES);
	const expiryLabel = $derived(EXPIRY_OPTIONS.find((o) => o.value === expiry)?.label);
	const maxUsesLabel = $derived(MAX_USES_OPTIONS.find((o) => o.value === maxUses)?.label);
</script>

<svelte:head>
	<title>Invite people · Lumio</title>
</svelte:head>

<header class="flex h-12 shrink-0 items-center gap-2 border-b px-3">
	<a
		href={resolve('/(app)/channels')}
		class={buttonVariants({ variant: 'ghost', size: 'icon', class: '-ml-1 size-8 md:hidden' })}
		aria-label="Back to channels"
	>
		<ArrowLeft />
	</a>
	<UserPlus class="size-4 text-muted-foreground" />
	<h1 class="truncate font-semibold">Invite people</h1>
</header>

<div class="min-h-0 flex-1 overflow-y-auto">
	<div class="mx-auto grid max-w-xl grid-cols-[minmax(0,1fr)] gap-6 p-4">
		<Card.Root role="region" aria-labelledby="create-invite-heading">
			<Card.Header>
				<Card.Title><h2 id="create-invite-heading">Create an invite link</h2></Card.Title>
				<Card.Description>
					Anyone with the link can join {data.instance.name}, with an account or as a guest.
				</Card.Description>
			</Card.Header>
			<Card.Content class="grid gap-4">
				<form method="post" action="?/create" use:enhance class="grid gap-3 sm:grid-cols-2">
					<div class="grid gap-2">
						<Label for="expiry">Expire after</Label>
						<Select.Root type="single" name="expiry" bind:value={expiry}>
							<Select.Trigger id="expiry" class="w-full data-[size=default]:h-9"
								>{expiryLabel}</Select.Trigger
							>
							<Select.Content>
								{#each EXPIRY_OPTIONS as option (option.value)}
									<Select.Item value={option.value} label={option.label} />
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
					<div class="grid gap-2">
						<Label for="max-uses">Max number of uses</Label>
						<Select.Root type="single" name="maxUses" bind:value={maxUses}>
							<Select.Trigger id="max-uses" class="w-full data-[size=default]:h-9"
								>{maxUsesLabel}</Select.Trigger
							>
							<Select.Content>
								{#each MAX_USES_OPTIONS as option (option.value)}
									<Select.Item value={option.value} label={option.label} />
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
					<Label class="flex items-center gap-2 font-normal sm:col-span-2">
						<Checkbox name="allowGuests" checked />
						Let people join as a guest with just a name
					</Label>
					<Button type="submit" class="sm:col-span-2">Create invite link</Button>
				</form>
				{#if form?.inviteError}
					<Alert.Root variant="destructive">
						<CircleAlert />
						<Alert.Description>{form.inviteError}</Alert.Description>
					</Alert.Root>
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
			</Card.Content>
		</Card.Root>

		<Card.Root role="region" aria-labelledby="active-invites-heading">
			<Card.Header>
				<Card.Title>
					<h2 id="active-invites-heading">
						{data.canManageAll ? 'Active invite links' : 'Your active invite links'}
					</h2>
				</Card.Title>
			</Card.Header>
			<Card.Content>
				<InviteList {invites} showCreator={data.canManageAll} />
			</Card.Content>
		</Card.Root>
	</div>
</div>
