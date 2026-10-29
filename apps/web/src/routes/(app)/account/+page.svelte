<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from '$app/forms';
	import { ArrowLeft, CircleAlert, LogOut, UserRound } from '@lucide/svelte';
	import { call } from '#lib/call.svelte.ts';
	import * as Alert from '#lib/components/ui/alert/index.ts';
	import * as AlertDialog from '#lib/components/ui/alert-dialog/index.ts';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.ts';
	import { Badge } from '#lib/components/ui/badge/index.ts';
	import * as Card from '#lib/components/ui/card/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Label } from '#lib/components/ui/label/index.ts';
	import { forgetGuest, NAME_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '#lib/guests.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// Members sign in with their password, so the guest session in this browser is no longer needed.
	const createAccount: SubmitFunction = () => {
		return async ({ result, update }) => {
			if (result.type === 'success') forgetGuest();
			await update();
		};
	};

	let signOutOpen = $state(false);

	// The guest saved in this browser cannot sign back in after signing out, so forget it.
	const signOut: SubmitFunction = () => {
		return async ({ update }) => {
			forgetGuest();
			signOutOpen = false;
			await call.leave();
			await update();
		};
	};
</script>

{#snippet signOutForm(label: string)}
	<form method="post" action={resolve('/logout')} use:enhance={signOut} class="w-full sm:w-fit">
		<Button type="submit" variant="destructive" class="w-full sm:w-fit">
			<LogOut />
			{label}
		</Button>
	</form>
{/snippet}

<svelte:head>
	<title>Account · Lumio</title>
</svelte:head>

<div class="flex min-w-0 flex-1 flex-col">
	<header class="flex h-12 shrink-0 items-center gap-2 border-b px-3">
		<a
			href={resolve('/(app)/(home)')}
			class={buttonVariants({ variant: 'ghost', size: 'icon', class: '-ml-1 size-8' })}
			aria-label="Back to Home"
		>
			<ArrowLeft />
		</a>
		<UserRound class="size-4 text-muted-foreground" />
		<h1 class="truncate font-semibold">Account</h1>
	</header>

	<div class="min-h-0 flex-1 overflow-y-auto">
		<div class="mx-auto grid max-w-md grid-cols-[minmax(0,1fr)] gap-6 p-4">
			{#if data.user.isGuest}
				<Card.Root role="region" aria-labelledby="create-account-heading">
					<Card.Header>
						<Card.Title><h2 id="create-account-heading">Create your account</h2></Card.Title>
						<Card.Description>
							You are a guest right now, saved only in this browser. Add an email and password to
							keep everything (messages, friends and roles) and to sign in on any device.
						</Card.Description>
					</Card.Header>
					<Card.Content>
						<form
							method="post"
							action="?/createAccount"
							use:enhance={createAccount}
							class="grid gap-4"
						>
							<div class="grid gap-2">
								<Label for="name">Display name</Label>
								<Input
									id="name"
									name="name"
									required
									maxlength={NAME_MAX_LENGTH}
									value={data.user.name}
									autocomplete="nickname"
								/>
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
									minlength={PASSWORD_MIN_LENGTH}
									autocomplete="new-password"
								/>
							</div>
							{#if form?.message}
								<Alert.Root variant="destructive">
									<CircleAlert />
									<Alert.Description>{form.message}</Alert.Description>
								</Alert.Root>
							{/if}
							<Button type="submit" class="w-full">Create account</Button>
						</form>
					</Card.Content>
				</Card.Root>
			{:else}
				<Card.Root role="region" aria-labelledby="account-heading">
					<Card.Header>
						<Card.Title>
							<h2 id="account-heading">
								{form?.upgraded ? 'Your account is ready' : 'Your account'}
							</h2>
						</Card.Title>
						{#if form?.upgraded}
							<Card.Description>
								Everything you did as a guest is kept. Sign in with your email and password on any
								device.
							</Card.Description>
						{/if}
					</Card.Header>
					<Card.Content>
						<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
							<dt class="text-muted-foreground">Name</dt>
							<dd class="truncate">{data.user.name}</dd>
							<dt class="text-muted-foreground">Email</dt>
							<dd class="truncate">{data.email}</dd>
						</dl>
					</Card.Content>
				</Card.Root>

				{#if data.discord.enabled || data.discord.connected}
					{@const discordMessage = form?.discordMessage ?? data.discord.error}
					<Card.Root role="region" aria-labelledby="discord-heading">
						<Card.Header>
							<Card.Title class="flex items-center gap-2">
								<h2 id="discord-heading">Discord</h2>
								{#if data.discord.connected}<Badge variant="secondary">Connected</Badge>{/if}
							</Card.Title>
							<Card.Description>
								{#if data.discord.connected}
									You can sign in with your Discord account.
								{:else}
									Connect your Discord account to sign in with it.
								{/if}
							</Card.Description>
						</Card.Header>
						{#if discordMessage}
							<Card.Content>
								<Alert.Root variant="destructive">
									<CircleAlert />
									<Alert.Description>{discordMessage}</Alert.Description>
								</Alert.Root>
							</Card.Content>
						{/if}
						<Card.Footer>
							{#if !data.discord.connected}
								<!-- No `use:enhance`: the action redirects to Discord. -->
								<form method="post" action="?/connectDiscord" class="w-full sm:w-fit">
									<Button type="submit" variant="outline" class="w-full sm:w-fit">
										Connect Discord
									</Button>
								</form>
							{:else if data.discord.hasPassword}
								<form
									method="post"
									action="?/disconnectDiscord"
									use:enhance
									class="w-full sm:w-fit"
								>
									<Button type="submit" variant="outline" class="w-full sm:w-fit">
										Disconnect Discord
									</Button>
								</form>
							{:else}
								<p class="text-sm text-muted-foreground">
									Discord is your only way to sign in, so it stays connected.
								</p>
							{/if}
						</Card.Footer>
					</Card.Root>
				{/if}
			{/if}

			<Card.Root role="region" aria-labelledby="sign-out-heading">
				<Card.Header>
					<Card.Title><h2 id="sign-out-heading">Sign out</h2></Card.Title>
					<Card.Description>
						{#if data.user.isGuest}
							As a guest you have no password: after signing out you cannot get back into this guest
							account. Create an account first to keep it.
						{:else}
							Sign out of Lumio in this browser.
						{/if}
					</Card.Description>
				</Card.Header>
				<Card.Footer>
					{#if data.user.isGuest}
						<Button
							variant="destructive"
							class="w-full sm:w-fit"
							onclick={() => (signOutOpen = true)}
						>
							<LogOut />
							Sign out
						</Button>
					{:else}
						{@render signOutForm('Sign out')}
					{/if}
				</Card.Footer>
			</Card.Root>
		</div>
	</div>
</div>

<AlertDialog.Root bind:open={signOutOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Sign out and lose this guest account?</AlertDialog.Title>
			<AlertDialog.Description>
				Your messages stay, but you cannot sign in as {data.user.name} again. Create an account first
				if you want to keep it.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			{@render signOutForm('Sign out anyway')}
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
