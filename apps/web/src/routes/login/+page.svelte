<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { Button } from '#lib/components/ui/button/index.ts';
	import * as Card from '#lib/components/ui/card/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Label } from '#lib/components/ui/label/index.ts';
	import { forgetGuest, loadGuest, type StoredGuest } from '#lib/guests.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let mode = $state<'signIn' | 'signUp'>('signIn');

	// Keeps `?redirectTo=` when posting, so signing in can continue where the user came from.
	const redirectTo = $derived(page.url.searchParams.get('redirectTo'));
	const action = (name: string) =>
		redirectTo ? `?/${name}&redirectTo=${encodeURIComponent(redirectTo)}` : `?/${name}`;

	// A guest whose session cookie is gone can continue with the session kept in this browser.
	let storedGuest = $state<StoredGuest | null>(null);
	onMount(() => {
		storedGuest = loadGuest();
	});
	const guest = $derived(form?.guestExpired ? null : storedGuest);

	/** An expired guest session cannot come back, so it is removed from this browser. */
	const continueAsGuest: SubmitFunction = () => {
		return async ({ result, update }) => {
			if (result.type === 'failure') forgetGuest();
			await update();
		};
	};
</script>

<main class="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
	<Card.Root class="w-full max-w-sm">
		<Card.Header>
			<Card.Title>{mode === 'signIn' ? 'Welcome back' : 'Create an account'}</Card.Title>
			<Card.Description>
				{mode === 'signIn'
					? 'Sign in to your Lumio server.'
					: 'You are the first one here, so your account will own this Lumio server.'}
			</Card.Description>
		</Card.Header>
		<Card.Content class="grid gap-6">
			{#if guest}
				<form
					method="post"
					action={action('continueAsGuest')}
					use:enhance={continueAsGuest}
					class="grid gap-2"
				>
					<input type="hidden" name="token" value={guest.token} />
					<Button type="submit" variant="secondary" class="w-full">
						Continue as {guest.name} (guest)
					</Button>
				</form>
			{:else if form?.guestExpired}
				<p class="text-sm text-destructive" role="alert">
					Your guest access has expired. Ask a member for a new invite link.
				</p>
			{/if}
			<form method="post" action={action(mode)} use:enhance class="grid gap-4">
				{#if mode === 'signUp'}
					<div class="grid gap-2">
						<Label for="name">Display name</Label>
						<Input id="name" name="name" required autocomplete="nickname" />
					</div>
				{/if}
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
						autocomplete={mode === 'signIn' ? 'current-password' : 'new-password'}
					/>
				</div>
				{#if form?.message}
					<p class="text-sm text-destructive">{form.message}</p>
				{/if}
				<Button type="submit" class="w-full">
					{mode === 'signIn' ? 'Sign in' : 'Create account'}
				</Button>
			</form>
		</Card.Content>
		<Card.Footer class="justify-center text-sm text-muted-foreground">
			{#if mode === 'signIn' && !data.registrationOpen}
				New here? Ask a member for an invite link.
			{:else if mode === 'signIn'}
				No account yet?
				<Button variant="link" class="px-1" onclick={() => (mode = 'signUp')}>Register</Button>
			{:else}
				Already registered?
				<Button variant="link" class="px-1" onclick={() => (mode = 'signIn')}>Sign in</Button>
			{/if}
		</Card.Footer>
	</Card.Root>
</main>
