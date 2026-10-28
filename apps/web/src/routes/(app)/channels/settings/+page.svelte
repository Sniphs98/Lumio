<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { ArrowLeft, Settings } from '@lucide/svelte';
	import { formatBytes } from '#lib/attachments.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Label } from '#lib/components/ui/label/index.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
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
	</div>
</div>
