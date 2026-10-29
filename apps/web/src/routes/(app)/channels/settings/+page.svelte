<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { ArrowLeft, Settings } from '@lucide/svelte';
	import { formatBytes } from '#lib/attachments.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Label } from '#lib/components/ui/label/index.ts';
	import { Switch } from '#lib/components/ui/switch/index.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const gb = (bytes: number) => Math.round((bytes / 1024 ** 3) * 10) / 10;
</script>

<svelte:head>
	<title>Server settings · Lumio</title>
</svelte:head>

<header class="flex h-12 shrink-0 items-center gap-2 border-b px-3">
	<a
		href={resolve('/(app)/channels')}
		class="-ml-1 flex size-8 items-center justify-center rounded-md hover:bg-muted md:hidden"
		aria-label="Back to channels"
	>
		<ArrowLeft class="size-4" />
	</a>
	<Settings class="size-4 text-muted-foreground" />
	<h1 class="truncate font-semibold">Server settings</h1>
</header>

<div class="min-h-0 flex-1 overflow-y-auto">
	<div class="mx-auto grid max-w-xl gap-8 p-4">
		<section class="grid gap-3" aria-labelledby="access-heading">
			<div>
				<h2 id="access-heading" class="font-semibold">Who can invite people</h2>
				<p class="text-sm text-muted-foreground">
					On a private server only members with an account can bring in new people. Guests can still
					add existing members as friends. On a public server guests can invite people too.
				</p>
			</div>
			<form method="post" action="?/access" use:enhance class="grid gap-3">
				<Label class="flex items-center gap-3 font-normal">
					<Switch name="isPublic" checked={data.isPublic} />
					Public server: guests can invite people
				</Label>
				<Button type="submit" class="sm:w-fit">Save</Button>
			</form>
			{#if form?.accessSaved}
				<p class="text-sm text-muted-foreground" role="status">Saved.</p>
			{/if}
		</section>

		<section class="grid gap-3" aria-labelledby="uploads-heading">
			<div>
				<h2 id="uploads-heading" class="font-semibold">File sharing</h2>
				<p class="text-sm text-muted-foreground">
					Members can share files in channels and direct messages. Files are currently limited to
					{formatBytes(data.maxUploadSize)}.
				</p>
			</div>
			<form method="post" action="?/uploads" use:enhance class="grid gap-3">
				<div class="grid gap-2">
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
				</div>
				<Button type="submit" class="sm:w-fit">Save</Button>
			</form>
			{#if form?.uploadsError}
				<p class="text-sm text-destructive" role="alert">{form.uploadsError}</p>
			{:else if form?.uploadsSaved}
				<p class="text-sm text-muted-foreground" role="status">Saved.</p>
			{/if}
		</section>

		<section class="grid gap-3" aria-labelledby="storage-heading">
			<div>
				<h2 id="storage-heading" class="font-semibold">Storage per person</h2>
				<p class="text-sm text-muted-foreground">
					Limits the total size of the files each person has shared, so nobody can fill up the
					server. Deleting a message frees up the space of its files.
				</p>
			</div>
			<form method="post" action="?/storage" use:enhance class="grid gap-3 sm:grid-cols-2">
				<Label class="flex items-center gap-3 font-normal sm:col-span-2">
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
				<Button type="submit" class="sm:w-fit">Save</Button>
			</form>
			{#if form?.storageError}
				<p class="text-sm text-destructive" role="alert">{form.storageError}</p>
			{:else if form?.storageSaved}
				<p class="text-sm text-muted-foreground" role="status">Saved.</p>
			{/if}
		</section>
	</div>
</div>
