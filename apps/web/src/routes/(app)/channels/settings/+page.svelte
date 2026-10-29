<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { ArrowLeft, CircleAlert, Settings } from '@lucide/svelte';
	import { formatBytes } from '#lib/attachments.ts';
	import * as Alert from '#lib/components/ui/alert/index.ts';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.ts';
	import * as Card from '#lib/components/ui/card/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Label } from '#lib/components/ui/label/index.ts';
	import { Switch } from '#lib/components/ui/switch/index.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const gb = (bytes: number) => Math.round((bytes / 1024 ** 3) * 10) / 10;
</script>

{#snippet result(error: string | undefined, saved: boolean | undefined)}
	{#if error}
		<Alert.Root variant="destructive">
			<CircleAlert />
			<Alert.Description>{error}</Alert.Description>
		</Alert.Root>
	{:else if saved}
		<p class="text-sm text-muted-foreground" role="status">Saved.</p>
	{/if}
{/snippet}

<svelte:head>
	<title>Server settings · Lumio</title>
</svelte:head>

<header class="flex h-12 shrink-0 items-center gap-2 border-b px-3">
	<a
		href={resolve('/(app)/channels')}
		class={buttonVariants({ variant: 'ghost', size: 'icon', class: '-ml-1 size-8 md:hidden' })}
		aria-label="Back to channels"
	>
		<ArrowLeft />
	</a>
	<Settings class="size-4 text-muted-foreground" />
	<h1 class="truncate font-semibold">Server settings</h1>
</header>

<div class="min-h-0 flex-1 overflow-y-auto">
	<div class="mx-auto grid max-w-xl grid-cols-[minmax(0,1fr)] gap-6 p-4">
		<Card.Root role="region" aria-labelledby="access-heading">
			<Card.Header>
				<Card.Title><h2 id="access-heading">Who can invite people</h2></Card.Title>
				<Card.Description>
					On a private server only members with an account can bring in new people. Guests can still
					add existing members as friends. On a public server guests can invite people too.
				</Card.Description>
			</Card.Header>
			<form method="post" action="?/access" use:enhance class="grid gap-6">
				<Card.Content>
					<Label class="font-normal">
						<Switch name="isPublic" checked={data.isPublic} />
						Public server: guests can invite people
					</Label>
				</Card.Content>
				<Card.Footer class="gap-3">
					<Button type="submit">Save</Button>
					{@render result(undefined, form?.accessSaved)}
				</Card.Footer>
			</form>
		</Card.Root>

		<Card.Root role="region" aria-labelledby="uploads-heading">
			<Card.Header>
				<Card.Title><h2 id="uploads-heading">File sharing</h2></Card.Title>
				<Card.Description>
					Members can share files in channels and direct messages. Files are currently limited to
					{formatBytes(data.maxUploadSize)}.
				</Card.Description>
			</Card.Header>
			<form method="post" action="?/uploads" use:enhance class="grid gap-6">
				<Card.Content class="grid gap-2">
					<Label for="max-upload-size">Largest file (MB)</Label>
					<Input
						id="max-upload-size"
						name="maxUploadSizeMb"
						type="number"
						inputmode="numeric"
						min="1"
						step="1"
						value={Math.round(data.maxUploadSize / 1024 ** 2)}
					/>
				</Card.Content>
				<Card.Footer class="flex-wrap gap-3">
					<Button type="submit">Save</Button>
					{@render result(form?.uploadsError, form?.uploadsSaved)}
				</Card.Footer>
			</form>
		</Card.Root>

		<Card.Root role="region" aria-labelledby="storage-heading">
			<Card.Header>
				<Card.Title><h2 id="storage-heading">Storage per person</h2></Card.Title>
				<Card.Description>
					Limits the total size of the files each person has shared, so nobody can fill up the
					server. Deleting a message frees up the space of its files.
				</Card.Description>
			</Card.Header>
			<form method="post" action="?/storage" use:enhance class="grid gap-6">
				<Card.Content class="grid gap-4 sm:grid-cols-2">
					<Label class="font-normal sm:col-span-2">
						<Switch name="quotaEnabled" checked={data.quotas.enabled} />
						Limit storage per person
					</Label>
					<div class="grid gap-2">
						<Label for="member-quota">Members (GB)</Label>
						<Input
							id="member-quota"
							name="memberQuotaGb"
							type="number"
							inputmode="decimal"
							min="0.1"
							step="0.1"
							value={gb(data.quotas.member)}
						/>
					</div>
					<div class="grid gap-2">
						<Label for="guest-quota">Guests (GB)</Label>
						<Input
							id="guest-quota"
							name="guestQuotaGb"
							type="number"
							inputmode="decimal"
							min="0.1"
							step="0.1"
							value={gb(data.quotas.guest)}
						/>
					</div>
				</Card.Content>
				<Card.Footer class="flex-wrap gap-3">
					<Button type="submit">Save</Button>
					{@render result(form?.storageError, form?.storageSaved)}
				</Card.Footer>
			</form>
		</Card.Root>
	</div>
</div>
