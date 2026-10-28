<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { ArrowLeft, Users } from '@lucide/svelte';
	import FriendPicker from '#lib/components/groups/friend-picker.svelte';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Label } from '#lib/components/ui/label/index.ts';
	import { MAX_GROUP_MEMBERS, MAX_GROUP_NAME_LENGTH } from '#lib/groups.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>New group · Lumio</title>
</svelte:head>

<header class="flex h-12 shrink-0 items-center gap-2 border-b px-3">
	<a
		href={resolve('/(app)/(home)')}
		class="-ml-1 flex size-8 items-center justify-center rounded-md hover:bg-muted md:hidden"
		aria-label="Back to friends"
	>
		<ArrowLeft class="size-4" />
	</a>
	<Users class="size-4 shrink-0 text-muted-foreground" />
	<h1 class="truncate font-semibold">New group</h1>
</header>

<div class="min-h-0 flex-1 overflow-y-auto">
	{#if data.friends.length === 0}
		<p class="mx-auto max-w-xl p-4 text-sm text-muted-foreground">
			Add some friends first, then you can start a group chat with them.
		</p>
	{:else}
		<form method="post" use:enhance class="mx-auto grid max-w-xl gap-6 p-4">
			<div class="grid gap-2">
				<Label for="group-name">Name (optional)</Label>
				<Input
					id="group-name"
					name="name"
					maxlength={MAX_GROUP_NAME_LENGTH}
					placeholder="e.g. Raid night"
					autocomplete="off"
				/>
			</div>
			<fieldset class="grid gap-2">
				<legend class="pb-2 text-sm font-medium">
					Friends to add
					<span class="font-normal text-muted-foreground">(up to {MAX_GROUP_MEMBERS - 1})</span>
				</legend>
				<FriendPicker friends={data.friends} label="Friends to add" />
			</fieldset>
			{#if form?.error}
				<p class="text-sm text-destructive" role="alert">{form.error}</p>
			{/if}
			<Button type="submit" class="sm:w-fit">Create group</Button>
		</form>
	{/if}
</div>
