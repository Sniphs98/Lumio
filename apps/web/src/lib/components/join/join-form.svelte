<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import type { SubmitFunction } from '$app/forms';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Label } from '#lib/components/ui/label/index.ts';
	import * as Tabs from '#lib/components/ui/tabs/index.ts';
	import { NAME_MAX_LENGTH, saveGuest, startVisit, type StoredGuest } from '#lib/guests.ts';

	type Props = {
		/** Whether this link lets people join as a guest with only a name. */
		allowGuests: boolean;
		/** Error of the last attempt, shown under the form. */
		message?: string;
	};

	let { allowGuests, message }: Props = $props();

	let mode = $state<'guest' | 'account'>('guest');
	const current = $derived(allowGuests ? mode : 'account');

	/**
	 * A guest has no password, so their session is also kept in this browser's storage.
	 * The current visit counts as started, so the account suggestion waits for the next one.
	 */
	const keepGuest: SubmitFunction = () => {
		return async ({ result, update }) => {
			if (result.type === 'success' && result.data?.guest) {
				saveGuest(result.data.guest as StoredGuest);
				startVisit();
				// The action returns a path inside the app, e.g. `/channels` or the new friend's chat.
				// eslint-disable-next-line svelte/no-navigation-without-resolve
				await goto(result.data.redirectTo as string, { invalidateAll: true });
				return;
			}
			await update();
		};
	};
</script>

<div class="grid gap-4">
	{#if allowGuests}
		<Tabs.Root bind:value={mode}>
			<Tabs.List class="w-full">
				<Tabs.Trigger value="guest">Join as guest</Tabs.Trigger>
				<Tabs.Trigger value="account">Create account</Tabs.Trigger>
			</Tabs.List>
		</Tabs.Root>
	{/if}

	{#if current === 'guest'}
		<form method="post" action="?/guest" use:enhance={keepGuest} class="grid gap-4">
			<div class="grid gap-2">
				<Label for="guest-name">Your name</Label>
				<Input
					id="guest-name"
					name="name"
					required
					maxlength={NAME_MAX_LENGTH}
					autocomplete="nickname"
				/>
			</div>
			<p class="text-sm text-muted-foreground">
				No email or password needed. Your guest access is saved in this browser; create an account
				later to keep everything and use it on other devices.
			</p>
			{#if message}
				<p class="text-sm text-destructive" role="alert">{message}</p>
			{/if}
			<Button type="submit" class="w-full">Join as guest</Button>
		</form>
	{:else}
		<form method="post" action="?/account" use:enhance class="grid gap-4">
			<div class="grid gap-2">
				<Label for="name">Display name</Label>
				<Input id="name" name="name" required maxlength={NAME_MAX_LENGTH} autocomplete="nickname" />
			</div>
			<div class="grid gap-2">
				<Label for="email">Email</Label>
				<Input id="email" name="email" type="email" required autocomplete="email" />
			</div>
			<div class="grid gap-2">
				<Label for="password">Password</Label>
				<Input
					id="password"
					name="password"
					type="password"
					required
					minlength={8}
					autocomplete="new-password"
				/>
			</div>
			{#if message}
				<p class="text-sm text-destructive" role="alert">{message}</p>
			{/if}
			<Button type="submit" class="w-full">Create account and join</Button>
		</form>
	{/if}
</div>
